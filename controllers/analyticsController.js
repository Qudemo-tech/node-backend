const { createClient } = require('@supabase/supabase-js');
const { authenticateToken } = require('../middleware/auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const analyticsController = {
  // Get all QuDemos with their share links and Q&A data for analytics
  getQudemoAnalytics: async (req, res) => {
    try {
      const userId = req.user?.userId || req.user?.id;
      console.log(`📊 Analytics request from user: ${userId}`);

      // Get user's companies
      const { data: companies, error: companiesError } = await supabase
        .from('companies')
        .select('id, name')
        .eq('user_id', userId);

      if (companiesError || !companies || companies.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No companies found for user'
        });
      }

      const companyIds = companies.map(c => c.id);
      console.log(`📊 Found ${companyIds.length} companies:`, companyIds);

      // Get all QuDemos for user's companies
      const { data: qudemos, error: qudemosError } = await supabase
        .from('qudemos_new')
        .select(`
          id,
          title,
          description,
          created_at,
          is_shared,
          company_id,
          companies!inner(name)
        `)
        .in('company_id', companyIds)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (qudemosError) {
        console.error('❌ Error fetching QuDemos:', qudemosError);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch QuDemos'
        });
      }

      console.log(`📊 Found ${qudemos.length} QuDemos`);

      // Get share links for each QuDemo
      const qudemoIds = qudemos.map(q => q.id);
      const { data: shareLinks, error: shareLinksError } = await supabase
        .from('qudemo_shares')
        .select(`
          id,
          share_token,
          qudemo_id,
          created_at,
          expires_at,
          access_count,
          last_accessed_at,
          client_name,
          client_company,
          client_email,
          client_sl_no
        `)
        .in('qudemo_id', qudemoIds)
        .order('created_at', { ascending: false });

      if (shareLinksError) {
        console.error('❌ Error fetching share links:', shareLinksError);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch share links'
        });
      }

      console.log(`📊 Found ${shareLinks.length} share links`);

      // Get Q&A data from public_qa_interactions table
      const { data: qaData, error: qaError } = await supabase
        .from('public_qa_interactions')
      .select(`
          id,
          qudemo_id,
          share_token,
          company_id,
          question,
          answer,
          confidence_score,
          search_score,
          video_url,
          start_timestamp,
          end_timestamp,
          formatted_timestamp,
          answer_source,
          search_method,
          difficulty_level,
          estimated_time,
          user_ip,
          user_agent,
          is_irrelevant,
          irrelevant_reason,
          created_at,
          updated_at
        `)
        .in('qudemo_id', qudemoIds)
        .order('created_at', { ascending: false });

      if (qaError) {
        console.error('❌ Error fetching Q&A data:', qaError);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch Q&A data'
        });
      }

      console.log(`📊 Found ${qaData.length} Q&A entries`);

      // Organize data by QuDemo
      const analyticsData = qudemos.map(qudemo => {
        const shares = shareLinks.filter(share => share.qudemo_id === qudemo.id);
        const qa = qaData.filter(qa => qa.qudemo_id === qudemo.id);

        return {
          qudemo: {
            id: qudemo.id,
            title: qudemo.title,
            description: qudemo.description,
            created_at: qudemo.created_at,
            is_shared: qudemo.is_shared,
            company_name: qudemo.companies.name
          },
          share_links: shares.map(share => ({
            id: share.id,
            share_token: share.share_token,
            share_url: `${(process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '')}/share/${share.share_token}`,
            created_at: share.created_at,
            expires_at: share.expires_at,
            access_count: share.access_count || 0,
            last_accessed_at: share.last_accessed_at || null,
            client_name: share.client_name || null,
            client_company: share.client_company || null,
            client_email: share.client_email || null,
            client_sl_no: share.client_sl_no || null
          })),
          qa_data: qa.map(qaItem => ({
            id: qaItem.id,
            question: qaItem.question,
            answer: qaItem.answer,
            created_at: qaItem.created_at,
            share_token: qaItem.share_token,
            confidence_score: qaItem.confidence_score,
            search_score: qaItem.search_score,
            video_url: qaItem.video_url,
            start_timestamp: qaItem.start_timestamp,
            end_timestamp: qaItem.end_timestamp,
            formatted_timestamp: qaItem.formatted_timestamp,
            answer_source: qaItem.answer_source,
            search_method: qaItem.search_method,
            difficulty_level: qaItem.difficulty_level,
            estimated_time: qaItem.estimated_time,
            user_ip: qaItem.user_ip,
            user_agent: qaItem.user_agent,
            is_irrelevant: qaItem.is_irrelevant || false,
            irrelevant_reason: qaItem.irrelevant_reason || null
          })),
          total_shares: shares.length,
          total_qa_entries: qa.length,
          total_irrelevant_answers: qa.filter(qa => qa.is_irrelevant).length,
          total_access_count: shares.reduce((sum, share) => sum + (share.access_count || 0), 0)
        };
      });

      console.log(`📊 Returning analytics data for ${analyticsData.length} QuDemos`);

      res.json({
        success: true,
        data: analyticsData,
        summary: {
          total_qudemos: qudemos.length,
          total_share_links: shareLinks.length,
          total_qa_entries: qaData.length,
          total_irrelevant_answers: qaData.filter(qa => qa.is_irrelevant).length,
          total_access_count: shareLinks.reduce((sum, share) => sum + (share.access_count || 0), 0)
        }
      });

    } catch (error) {
      console.error('❌ Error in getQudemoAnalytics:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  },

  // Get detailed analytics for a specific QuDemo
  getQudemoDetailAnalytics: async (req, res) => {
    try {
      const { qudemoId } = req.params;
      const userId = req.user?.userId || req.user?.id;

      console.log(`📊 Detailed analytics request for QuDemo: ${qudemoId}, user: ${userId}`);

      // Verify user has access to this QuDemo
      const { data: qudemo, error: qudemoError } = await supabase
        .from('qudemo_new')
        .select(`
          id,
          title,
          description,
          created_at,
          is_shared,
          company_id,
          companies!inner(id, name, user_id)
        `)
        .eq('id', qudemoId)
        .eq('is_active', true)
        .single();

      if (qudemoError || !qudemo || qudemo.companies.user_id !== userId) {
        return res.status(404).json({
          success: false,
          error: 'QuDemo not found or access denied'
        });
      }

      // Get all share links for this QuDemo
      const { data: shareLinks, error: shareLinksError } = await supabase
        .from('qudemo_shares')
        .select('*')
        .eq('qudemo_id', qudemoId)
        .order('created_at', { ascending: false });

      if (shareLinksError) {
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch share links'
        });
      }

      // Get all Q&A data for this QuDemo from public_qa_interactions
      const { data: qaData, error: qaError } = await supabase
        .from('public_qa_interactions')
        .select('*')
        .eq('qudemo_id', qudemoId)
        .order('created_at', { ascending: false });

      if (qaError) {
        console.error('❌ Error fetching Q&A data:', qaError);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch Q&A data'
        });
      }

      // Get access logs if available
      const { data: accessLogs, error: accessLogsError } = await supabase
        .from('qudemo_access_logs')
        .select('*')
        .eq('qudemo_id', qudemoId)
        .order('created_at', { ascending: false })
        .limit(100);

      const detailedAnalytics = {
        qudemo: {
          id: qudemo.id,
          title: qudemo.title,
          description: qudemo.description,
          created_at: qudemo.created_at,
          is_shared: qudemo.is_shared,
          company_name: qudemo.companies.name
        },
        share_links: shareLinks.map(share => ({
          ...share,
          share_url: `${(process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '')}/share/${share.share_token}`
        })),
        qa_data: qaData,
        access_logs: accessLogs || [],
        statistics: {
          total_share_links: shareLinks.length,
          total_qa_entries: qaData.length,
          total_access_count: shareLinks.reduce((sum, share) => sum + (share.access_count || 0), 0),
          unique_questions: [...new Set(qaData.map(qa => qa.question))].length,
          most_recent_qa: qaData.length > 0 ? qaData[0].created_at : null,
          most_recent_access: shareLinks.length > 0 ? shareLinks.reduce((latest, share) => 
            !latest || (share.last_accessed_at && share.last_accessed_at > latest) ? share.last_accessed_at : latest, null
          ) : null
        }
      };

      res.json({
        success: true,
        data: detailedAnalytics
      });

    } catch (error) {
      console.error('❌ Error in getQudemoDetailAnalytics:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  },

  // Get customer interactions data
  getCustomerInteractions: async (req, res) => {
    try {
      const userId = req.user?.userId || req.user?.id;
      console.log(`📊 Customer interactions request from user: ${userId}`);

      // Get user's companies
      const { data: companies, error: companiesError } = await supabase
        .from('companies')
        .select('id, name')
        .eq('user_id', userId);

      if (companiesError || !companies || companies.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No companies found for user'
        });
      }

      const companyIds = companies.map(c => c.id);
      console.log(`📊 Found ${companyIds.length} companies:`, companyIds);

      // Get all share links with client information and their interactions
      const { data: shares, error: sharesError } = await supabase
        .from('qudemo_shares')
        .select(`
          id,
          share_token,
          client_name,
          client_email,
          client_company,
          access_count,
          last_accessed_at,
          qudemo_id,
          qudemos_new!inner(
            id,
            title,
            company_id
          )
        `)
        .in('company_id', companyIds)
        .not('client_name', 'is', null)
        .order('last_accessed_at', { ascending: false });

      if (sharesError) {
        console.error('❌ Error fetching shares:', sharesError);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch customer interactions'
        });
      }

      console.log(`📊 Found ${shares?.length || 0} share records with client data`);

      // Get Q&A interactions for each share
      const interactions = [];
      for (const share of shares || []) {
        // Get questions and answers for this share
        const { data: qaData, error: qaError } = await supabase
          .from('public_qa_interactions')
          .select('question, answer, created_at')
          .eq('share_token', share.share_token)
          .order('created_at', { ascending: false });

        if (qaError) {
          console.error(`❌ Error fetching Q&A for share ${share.share_token}:`, qaError);
        }

        // Calculate total duration with session-based logic
        const questionCount = qaData?.length || 0;
        let totalDuration = 0;

        if (qaData && qaData.length > 0) {
          // Sort questions by creation time
          const sortedQuestions = qaData.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          
          // Group questions into sessions (gap > 2 hours = new session)
          const sessions = groupQuestionsIntoSessions(sortedQuestions);
          
          console.log(`📊 Found ${sessions.length} sessions for ${share.share_token}:`, 
            sessions.map(s => ({ questionCount: s.questions.length, startTime: s.startTime, endTime: s.endTime }))
          );
          
          // Calculate duration for each session
          sessions.forEach((session, sessionIndex) => {
            const sessionQuestions = session.questions;
            const sessionQuestionCount = sessionQuestions.length;
            
            // Calculate session duration
            const sessionStart = new Date(session.startTime);
            const sessionEnd = new Date(session.endTime);
            const sessionDuration = Math.floor((sessionEnd - sessionStart) / 1000);
            
            // Add time for each question in this session
            const questionTime = sessionQuestionCount * 45; // 45 seconds per question
            
            // Add demo viewing time (only for first session)
            const demoViewingTime = sessionIndex === 0 ? Math.min(sessionDuration * 0.3, 300) : 0;
            
            // Calculate session total
            const sessionTotal = Math.max(
              sessionDuration + questionTime + demoViewingTime,
              sessionQuestionCount * 30 // Minimum 30 seconds per question
            );
            
            totalDuration += Math.min(sessionTotal, 1800); // Max 30 minutes per session
            
            console.log(`📊 Session ${sessionIndex + 1} calculation:`, {
              questionCount: sessionQuestionCount,
              sessionDuration,
              questionTime,
              demoViewingTime,
              sessionTotal: Math.floor(sessionTotal),
              totalDurationSoFar: Math.floor(totalDuration)
            });
          });
          
          console.log(`📊 Final duration calculation for ${share.share_token}:`, {
            totalQuestions: questionCount,
            totalSessions: sessions.length,
            totalDuration: Math.floor(totalDuration)
          });
        } else {
          // No questions - assume minimum demo viewing time
          totalDuration = 60; // 1 minute minimum
        }

        interactions.push({
          share_id: share.id,
          share_token: share.share_token,
          client_name: share.client_name,
          client_email: share.client_email,
          client_company: share.client_company,
          qudemo_title: share.qudemos_new?.title || 'Unknown Demo',
          qudemo_id: share.qudemo_id,
          question_count: questionCount,
          total_duration: totalDuration,
          access_count: share.access_count || 0,
          last_accessed_at: share.last_accessed_at,
          questions: qaData || []
        });
      }

      console.log(`📊 Returning ${interactions.length} customer interactions`);

      res.json({
        success: true,
        data: interactions
      });

    } catch (error) {
      console.error('❌ Error in getCustomerInteractions:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
};

/**
 * Group questions into sessions based on time gaps
 * @param {Array} questions - Sorted questions array
 * @returns {Array} - Array of session objects
 */
function groupQuestionsIntoSessions(questions) {
  if (!questions || questions.length === 0) return [];

  const sessions = [];
  const SESSION_GAP_HOURS = 2; // 2 hours gap = new session
  const SESSION_GAP_MS = SESSION_GAP_HOURS * 60 * 60 * 1000;

  let currentSession = {
    questions: [questions[0]],
    startTime: questions[0].created_at,
    endTime: questions[0].created_at
  };

  for (let i = 1; i < questions.length; i++) {
    const currentQuestion = questions[i];
    const previousQuestion = questions[i - 1];
    
    const timeDiff = new Date(currentQuestion.created_at) - new Date(previousQuestion.created_at);
    
    if (timeDiff > SESSION_GAP_MS) {
      // Gap is too large, start new session
      sessions.push(currentSession);
      currentSession = {
        questions: [currentQuestion],
        startTime: currentQuestion.created_at,
        endTime: currentQuestion.created_at
      };
    } else {
      // Same session, add question
      currentSession.questions.push(currentQuestion);
      currentSession.endTime = currentQuestion.created_at;
    }
  }

  // Add the last session
  sessions.push(currentSession);

  return sessions;
}

module.exports = analyticsController;