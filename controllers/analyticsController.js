const { createClient } = require('@supabase/supabase-js');
const { authenticateToken } = require('../middleware/auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const analyticsController = {
  // Get overview statistics for dashboard
  getOverviewStats: async (req, res) => {
    try {
      const userId = req.user?.userId || req.user?.id;
      console.log(`📊 Overview stats request from user: ${userId}`);

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

      // Get total demo views (access_count from qudemo_shares)
      const { data: totalViewsData, error: viewsError } = await supabase
        .from('qudemo_shares')
        .select('access_count')
        .in('company_id', companyIds);

      let totalViews = 0;
      if (!viewsError && totalViewsData) {
        totalViews = totalViewsData.reduce((sum, share) => sum + (share.access_count || 0), 0);
      }

      // Get total questions asked (count from public_qa_interactions)
      const { data: questionsData, error: questionsError } = await supabase
        .from('public_qa_interactions')
        .select('id')
        .in('company_id', companyIds);

      const questionsAsked = questionsError ? 0 : (questionsData?.length || 0);

      // Calculate average engagement (percentage of shares that have interactions)
      const { data: sharesData, error: sharesError } = await supabase
        .from('qudemo_shares')
        .select('id')
        .in('company_id', companyIds);

      const { data: interactionsData, error: interactionsError } = await supabase
        .from('public_qa_interactions')
        .select('share_token')
        .in('company_id', companyIds);

      let avgEngagement = 0;
      if (!sharesError && !interactionsError && sharesData && interactionsData) {
        const totalShares = sharesData.length;
        const sharesWithInteractions = new Set(interactionsData.map(i => i.share_token)).size;
        if (totalShares > 0) {
          avgEngagement = Math.round((sharesWithInteractions / totalShares) * 100);
        }
      }

      const overviewStats = {
        totalViews,
        questionsAsked,
        avgEngagement
      };

      console.log('📊 Overview stats calculated:', overviewStats);

      res.json(overviewStats);
    } catch (error) {
      console.error('❌ Error in getOverviewStats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch overview statistics'
      });
    }
  },

  // Get recent interactions for overview page
  getRecentInteractions: async (req, res) => {
    try {
      const userId = req.user?.userId || req.user?.id;
      console.log(`📊 Recent interactions request from user: ${userId}`);

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

      // Get recent interactions with customer details
      const { data: interactions, error: interactionsError } = await supabase
        .from('public_qa_interactions')
        .select(`
          id,
          question,
          created_at,
          share_token,
          company_id
        `)
        .in('company_id', companyIds)
        .order('created_at', { ascending: false })
        .limit(20);

      console.log('Raw interactions:', interactions);

      // Get share details for the interactions
      const shareTokens = [...new Set(interactions.map(i => i.share_token))];
      const { data: shares, error: sharesError } = await supabase
        .from('qudemo_shares')
        .select('share_token, client_name, client_email, client_company')
        .in('share_token', shareTokens);

      console.log('Shares data:', shares);

      if (interactionsError || sharesError) {
        console.error('❌ Error fetching recent interactions:', interactionsError || sharesError);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch recent interactions'
        });
      }

      // Create a map of share tokens to share details
      const shareMap = new Map();
      if (shares) {
        shares.forEach(share => {
          shareMap.set(share.share_token, share);
        });
      }

      // Group interactions by share_token to get unique customers
      const customerMap = new Map();
      
      if (interactions) {
        interactions.forEach(interaction => {
          const shareToken = interaction.share_token;
          const share = shareMap.get(shareToken);
          
          if (!customerMap.has(shareToken)) {
            customerMap.set(shareToken, {
              client_name: share?.client_name || 'Anonymous User',
              client_email: share?.client_email || '',
              client_company: share?.client_company || 'No company',
              share_token: shareToken,
              questionCount: 0,
              lastInteractionDate: interaction.created_at,
              latestQuestion: interaction.question
            });
          }
          
          const customer = customerMap.get(shareToken);
          customer.questionCount += 1;
          
          // Update to the most recent interaction date
          if (new Date(interaction.created_at) > new Date(customer.lastInteractionDate)) {
            customer.lastInteractionDate = interaction.created_at;
            customer.latestQuestion = interaction.question;
          }
        });
      }

      // Convert to array and sort by last interaction date
      const recentInteractions = Array.from(customerMap.values())
        .sort((a, b) => new Date(b.lastInteractionDate) - new Date(a.lastInteractionDate))
        .slice(0, 10); // Limit to 10 most recent

      console.log(`📊 Found ${recentInteractions.length} recent interactions`);
      console.log('Recent interactions data:', recentInteractions);

      res.json(recentInteractions);
    } catch (error) {
      console.error('❌ Error in getRecentInteractions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch recent interactions'
      });
    }
  },
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
      // Include both bulk shares (with client info) and single links (without client info)
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
        .order('last_accessed_at', { ascending: false });

      if (sharesError) {
        console.error('❌ Error fetching shares:', sharesError);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch customer interactions'
        });
      }

      console.log(`📊 Found ${shares?.length || 0} share records (including both bulk shares and single links)`);

      // Get Q&A interactions for each share
      const interactions = [];
      for (const share of shares || []) {
        // Get questions and answers for this share
        const { data: qaData, error: qaError } = await supabase
          .from('public_qa_interactions')
          .select('question, answer, created_at, start_timestamp, end_timestamp, formatted_timestamp, video_url')
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
          // No questions - no time tracked
          totalDuration = 0;
        }

        // Handle both bulk shares (with client info) and single links (without client info)
        const isSingleLink = !share.client_name;
        
        // Only include interactions where user has actually engaged (asked questions or spent time)
        if (questionCount > 0 || totalDuration > 0 || (share.access_count && share.access_count > 0)) {
          interactions.push({
            share_id: share.id,
            share_token: share.share_token,
            client_name: share.client_name || 'Anonymous User',
            client_email: share.client_email || null,
            client_company: share.client_company || 'Unknown Company',
            qudemo_title: share.qudemos_new?.title || 'Unknown Demo',
            qudemo_id: share.qudemo_id,
            question_count: questionCount,
            total_duration: totalDuration,
            access_count: share.access_count || 0,
            last_accessed_at: share.last_accessed_at,
            questions: qaData || [],
            is_single_link: isSingleLink
          });
        }
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

module.exports = {
  ...analyticsController,
  
  // Generate AI insight summary from customer questions
  generateInsightSummary: async (req, res) => {
    try {
      const { questions, customerName, qudemoTitle } = req.body;
      
      console.log(`🤖 Generating AI insight summary for ${customerName || 'customer'}`);
      console.log(`📝 Number of questions received: ${questions?.length || 0}`);
      
      if (!questions || questions.length === 0) {
        return res.json({
          success: true,
          data: {
            summary: `${customerName || 'The prospect'} accessed ${qudemoTitle || 'the demo'} but hasn't asked any questions yet.`
          }
        });
      }
      
      // Helper function to generate smart fallback based on actual questions
      const generateSmartFallback = () => {
        const questionTexts = questions.map(q => q.question.toLowerCase());
        const allText = questionTexts.join(' ');
        
        // Analyze keywords to determine focus areas
        const topics = [];
        if (allText.match(/\b(price|pricing|cost|payment|subscription|plan)\b/i)) topics.push('pricing');
        if (allText.match(/\b(security|secure|encryption|compliance|gdpr|soc)\b/i)) topics.push('security');
        if (allText.match(/\b(integrat|api|connect|sync)\b/i)) topics.push('integration');
        if (allText.match(/\b(scale|scalab|performance|speed|large)\b/i)) topics.push('scalability');
        if (allText.match(/\b(support|help|training|onboarding)\b/i)) topics.push('support');
        if (allText.match(/\b(custom|configurab|flexib)\b/i)) topics.push('customization');
        if (allText.match(/\b(feature|capability|function)\b/i)) topics.push('features');
        
        let summary = `${customerName || 'The prospect'} asked ${questions.length} question${questions.length > 1 ? 's' : ''} about ${qudemoTitle || 'the product'}`;
        
        if (topics.length > 0) {
          const topicText = topics.length === 1 ? topics[0] : 
                           topics.length === 2 ? `${topics[0]} and ${topics[1]}` :
                           `${topics.slice(0, -1).join(', ')}, and ${topics[topics.length - 1]}`;
          summary += `, focusing primarily on ${topicText}`;
        }
        
        // Add buying intent indicator
        if (questions.length >= 5) {
          summary += '. The detailed questioning suggests strong evaluation interest and potential buying intent.';
        } else if (questions.length >= 3) {
          summary += '. The multiple questions indicate active interest in understanding the solution.';
        } else {
          summary += '. They are in the early exploration phase.';
        }
        
        return summary;
      };
      
      // Use OpenAI ChatGPT API to analyze questions
      const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
      
      if (!OPENAI_API_KEY) {
        console.log('⚠️ No OpenAI API key found, using smart fallback');
        return res.json({
          success: true,
          data: {
            summary: generateSmartFallback()
          }
        });
      }
      
      console.log('🔑 OpenAI API key found, calling ChatGPT...');
      
      // Format questions for analysis
      const questionsList = questions.map((q, idx) => `${idx + 1}. ${q.question}`).join('\n');
      
      console.log(`📋 Questions being analyzed:\n${questionsList}`);
      
      const prompt = `Analyze these customer questions about ${qudemoTitle || 'the product'}:

${questionsList}

Based ONLY on the actual questions above, write 1-2 sentences (max 200 characters total) that:
1. Identifies what the prospect is specifically interested in or needs
2. Indicates their buying stage (researching/evaluating/ready to buy)

Focus on the CONTENT of their questions, not the quantity. Be specific about their interests.`;

      const fetch = (await import('node-fetch')).default;
      const response = await fetch(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: 'You are a B2B sales analyst. Analyze customer questions to identify their specific needs and buying intent. Write 1-2 concise sentences (max 200 chars). Focus on WHAT they asked about, not HOW MANY questions. Never mention question counts. Be specific about their interests based on question content.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.5,
            max_tokens: 100
          })
        }
      );
      
      console.log(`🌐 OpenAI API response status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ OpenAI API response received');
        const summary = data.choices?.[0]?.message?.content;
        
        if (summary) {
          console.log(`📄 AI-generated summary: ${summary}`);
          return res.json({
            success: true,
            data: { summary: summary.trim() }
          });
        } else {
          console.log('⚠️ No summary in response, using smart fallback');
          return res.json({
            success: true,
            data: { summary: generateSmartFallback() }
          });
        }
      } else {
        const errorText = await response.text();
        console.error(`❌ OpenAI API error: ${response.status} - ${errorText}`);
        return res.json({
          success: true,
          data: { summary: generateSmartFallback() }
        });
      }
      
    } catch (error) {
      console.error('❌ Error generating insight summary:', error);
      console.error('Stack trace:', error.stack);
      
      // Generate smart fallback based on questions
      const questions = req.body.questions || [];
      const customerName = req.body.customerName;
      const qudemoTitle = req.body.qudemoTitle;
      
      let fallbackSummary = `${customerName || 'The prospect'} showed interest in ${qudemoTitle || 'the demo'}`;
      if (questions.length > 0) {
        fallbackSummary += ` by asking ${questions.length} question${questions.length > 1 ? 's' : ''} about the product`;
      }
      fallbackSummary += '.';
      
      return res.json({
        success: true,
        data: { summary: fallbackSummary }
      });
    }
  },

  // Get lightweight customer list (without detailed Q&A data)
  getCustomerList: async (req, res) => {
    try {
      const userId = req.user?.userId || req.user?.id;
      console.log(`📊 Customer list request from user: ${userId}`);

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

      // Get share links with basic client information (no Q&A data)
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
        .order('last_accessed_at', { ascending: false });

      if (sharesError) {
        console.error('❌ Error fetching shares:', sharesError);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch customer list'
        });
      }

      console.log(`📊 Found ${shares?.length || 0} share records`);

      // Get all share tokens for batch question count query
      const shareTokens = shares?.map(share => share.share_token) || [];
      
      // Single batch query to get question counts and total duration for all shares
      let questionCounts = {};
      let totalDurations = {};
      if (shareTokens.length > 0) {
        const { data: qaData, error: qaError } = await supabase
          .from('public_qa_interactions')
          .select('share_token, created_at')
          .in('share_token', shareTokens)
          .order('share_token, created_at');

        if (qaError) {
          console.error(`❌ Error fetching Q&A data:`, qaError);
        } else {
          // Count questions and calculate total duration per share token using session-based logic
          const shareGroups = qaData?.reduce((acc, qa) => {
            if (!acc[qa.share_token]) {
              acc[qa.share_token] = [];
            }
            acc[qa.share_token].push(qa);
            return acc;
          }, {}) || {};

          // Calculate question counts and durations using the same logic as detailed view
          for (const [shareToken, qaList] of Object.entries(shareGroups)) {
            questionCounts[shareToken] = qaList.length;
            
            let totalDuration = 0;
            if (qaList.length > 0) {
              // Sort questions by creation time
              const sortedQuestions = qaList.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
              
              // Group questions into sessions (gap > 2 hours = new session)
              const sessions = groupQuestionsIntoSessions(sortedQuestions);
              
              sessions.forEach((session, sessionIndex) => {
                const sessionQuestions = session.questions;
                const sessionQuestionCount = sessionQuestions.length;
                
                const sessionStart = new Date(session.startTime);
                const sessionEnd = new Date(session.endTime);
                const sessionDuration = Math.floor((sessionEnd - sessionStart) / 1000);
                
                const questionTime = sessionQuestionCount * 45;
                const demoViewingTime = sessionIndex === 0 ? Math.min(sessionDuration * 0.3, 300) : 0;
                
                const sessionTotal = Math.max(
                  sessionDuration + questionTime + demoViewingTime,
                  sessionQuestionCount * 30
                );
                
                totalDuration += Math.min(sessionTotal, 1800);
              });
            }
            
            totalDurations[shareToken] = totalDuration;
          }
        }
      }

      // Build customer list with pre-calculated question counts and durations
      const customerList = [];
      for (const share of shares || []) {
        const questionCount = questionCounts[share.share_token] || 0;
        const totalDuration = totalDurations[share.share_token] || 0;

        // Only include interactions where user has actually engaged
        if (questionCount > 0 || (share.access_count && share.access_count > 0)) {
          customerList.push({
            share_id: share.id,
            share_token: share.share_token,
            client_name: share.client_name || 'Anonymous User',
            client_email: share.client_email || null,
            client_company: share.client_company || 'Unknown Company',
            qudemo_title: share.qudemos_new?.title || 'Unknown Demo',
            qudemo_id: share.qudemo_id,
            question_count: questionCount,
            total_duration: totalDuration,
            access_count: share.access_count || 0,
            last_accessed_at: share.last_accessed_at,
            is_single_link: !share.client_name
          });
        }
      }

      console.log(`📊 Returning ${customerList.length} customers (lightweight)`);

      res.json({
        success: true,
        data: customerList
      });

    } catch (error) {
      console.error('❌ Error in getCustomerList:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  },

  // Get detailed interaction data for a specific customer
  getCustomerInteractionDetails: async (req, res) => {
    try {
      const { shareToken } = req.params;
      const userId = req.user?.userId || req.user?.id;
      
      console.log(`📊 Customer interaction details request for share: ${shareToken}, user: ${userId}`);

      // Verify user has access to this share
      const { data: share, error: shareError } = await supabase
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
            company_id,
            companies!inner(user_id)
          )
        `)
        .eq('share_token', shareToken)
        .eq('qudemos_new.companies.user_id', userId)
        .single();

      if (shareError || !share) {
        return res.status(404).json({
          success: false,
          error: 'Share not found or access denied'
        });
      }

      // Get detailed Q&A interactions for this share
      const { data: qaData, error: qaError } = await supabase
        .from('public_qa_interactions')
        .select('question, answer, created_at, start_timestamp, end_timestamp, formatted_timestamp, video_url')
        .eq('share_token', shareToken)
        .order('created_at', { ascending: false });

      if (qaError) {
        console.error(`❌ Error fetching Q&A for share ${shareToken}:`, qaError);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch interaction details'
        });
      }

      // Calculate total duration with session-based logic
      const questionCount = qaData?.length || 0;
      let totalDuration = 0;

      if (qaData && qaData.length > 0) {
        const sortedQuestions = qaData.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const sessions = groupQuestionsIntoSessions(sortedQuestions);
        
        sessions.forEach((session, sessionIndex) => {
          const sessionQuestions = session.questions;
          const sessionQuestionCount = sessionQuestions.length;
          
          const sessionStart = new Date(session.startTime);
          const sessionEnd = new Date(session.endTime);
          const sessionDuration = Math.floor((sessionEnd - sessionStart) / 1000);
          
          const questionTime = sessionQuestionCount * 45;
          const demoViewingTime = sessionIndex === 0 ? Math.min(sessionDuration * 0.3, 300) : 0;
          
          const sessionTotal = Math.max(
            sessionDuration + questionTime + demoViewingTime,
            sessionQuestionCount * 30
          );
          
          totalDuration += Math.min(sessionTotal, 1800);
        });
      }

      const interactionDetails = {
        share_id: share.id,
        share_token: share.share_token,
        client_name: share.client_name || 'Anonymous User',
        client_email: share.client_email || null,
        client_company: share.client_company || 'Unknown Company',
        qudemo_title: share.qudemos_new?.title || 'Unknown Demo',
        qudemo_id: share.qudemo_id,
        question_count: questionCount,
        total_duration: totalDuration,
        access_count: share.access_count || 0,
        last_accessed_at: share.last_accessed_at,
        questions: qaData || [],
        is_single_link: !share.client_name
      };

      console.log(`📊 Returning detailed interaction data for ${shareToken}`);

      res.json({
        success: true,
        data: interactionDetails
      });

    } catch (error) {
      console.error('❌ Error in getCustomerInteractionDetails:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  },

  // Get interactions for a specific QuDemo
  getQudemoInteractions: async (req, res) => {
    try {
      const userId = req.user?.userId || req.user?.id;
      const { qudemoId } = req.params;
      
      console.log(`📊 QuDemo interactions request from user: ${userId} for QuDemo: ${qudemoId}`);

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

      // Verify user has access to this QuDemo
      const { data: qudemo, error: qudemoError } = await supabase
        .from('qudemos_new')
        .select('id, title, company_id')
        .eq('id', qudemoId)
        .in('company_id', companyIds)
        .single();

      if (qudemoError || !qudemo) {
        return res.status(404).json({
          success: false,
          error: 'QuDemo not found or access denied'
        });
      }

      // Get all share links for this specific QuDemo
      const { data: shares, error: sharesError } = await supabase
        .from('qudemo_shares')
        .select(`
          id,
          share_token,
          client_name,
          client_email,
          client_company,
          access_count,
          last_accessed_at
        `)
        .eq('qudemo_id', qudemoId)
        .eq('company_id', qudemo.company_id);

      if (sharesError) {
        console.error('❌ Error fetching shares:', sharesError);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch QuDemo interactions'
        });
      }

      console.log(`📊 Found ${shares?.length || 0} share records for QuDemo ${qudemoId}`);

      // Get Q&A interactions for each share
      const interactions = [];
      for (const share of shares || []) {
        // Get questions and answers for this share
        const { data: qaData, error: qaError } = await supabase
          .from('public_qa_interactions')
          .select('question, answer, created_at, start_timestamp, end_timestamp, formatted_timestamp, video_url')
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
        });
      } else {
        // No questions - no time tracked
        totalDuration = 0;
      }

        // Only include interactions where user has actually engaged (asked questions or spent time)
        if (questionCount > 0 || totalDuration > 0 || (share.access_count && share.access_count > 0)) {
          interactions.push({
            share_id: share.id,
            share_token: share.share_token,
            client_name: share.client_name,
            client_email: share.client_email,
            client_company: share.client_company,
            qudemo_title: qudemo.title,
            qudemo_id: qudemo.id,
            question_count: questionCount,
            total_duration: totalDuration,
            access_count: share.access_count || 0,
            last_accessed_at: share.last_accessed_at,
            questions: qaData || []
          });
        }
      }

      console.log(`📊 Returning ${interactions.length} interactions for QuDemo ${qudemoId}`);

      res.json({
        success: true,
        data: interactions
      });

  } catch (error) {
      console.error('❌ Error in getQudemoInteractions:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}; 