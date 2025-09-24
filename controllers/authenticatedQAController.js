const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class AuthenticatedQAController {
  async storeAuthenticatedQA({ userId, companyId, qudemoId, question, answer, metadata = {} }) {
    try {
      console.log('💾 Storing authenticated Q&A interaction:', {
        userId,
        companyId,
        qudemoId,
        questionLength: question.length,
        answerLength: answer.length,
      });

      const { error } = await supabase
        .from('authenticated_qa_interactions')
        .insert({
          id: uuidv4(),
          user_id: userId,
          company_id: companyId,
          qudemo_id: qudemoId,
          question: question,
          answer: answer,
          confidence_score: metadata.confidence || 0.00,
          search_score: metadata.search_score || 0.00,
          video_url: metadata.video_url || null,
          start_timestamp: metadata.start_timestamp || null,
          end_timestamp: metadata.end_timestamp || null,
          formatted_timestamp: metadata.formatted_timestamp || null,
          answer_source: metadata.answer_source || null,
          search_method: metadata.search_method || null,
          difficulty_level: metadata.difficulty_level || null,
          estimated_time: metadata.estimated_time || null,
          hybrid_scores: metadata.hybrid_scores || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error('❌ Error storing authenticated Q&A:', error);
        throw new Error(`Failed to store authenticated Q&A: ${error.message}`);
      }

      return { success: true, message: 'Authenticated Q&A stored successfully' };
    } catch (error) {
      console.error('❌ Authenticated Q&A storage error:', error);
      throw error;
    }
  }

  async getAuthenticatedQAInteractions(userId, qudemoId = null, limit = 50) {
    try {
      let query = supabase
        .from('authenticated_qa_interactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (qudemoId) {
        query = query.eq('qudemo_id', qudemoId);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch authenticated Q&A interactions: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('❌ Error fetching authenticated Q&A interactions:', error);
      throw error;
    }
  }

  async getAuthenticatedQAStats(companyId) {
    try {
      // Total questions for this company
      const { count: totalQuestions, error: countError } = await supabase
        .from('authenticated_qa_interactions')
        .select('*', { count: 'exact' })
        .eq('company_id', companyId);

      if (countError) throw new Error(`Failed to count questions: ${countError.message}`);

      // Average confidence score
      const { data: avgConfidenceData, error: avgConfidenceError } = await supabase
        .from('authenticated_qa_interactions')
        .select('avg(confidence_score)')
        .eq('company_id', companyId);

      if (avgConfidenceError) throw new Error(`Failed to get average confidence: ${avgConfidenceError.message}`);
      const avgConfidence = avgConfidenceData[0]?.avg || 0;

      // Most common questions
      const { data: commonQuestionsData, error: commonQuestionsError } = await supabase
        .from('authenticated_qa_interactions')
        .select('question, count(question) as count')
        .eq('company_id', companyId)
        .group('question')
        .order('count', { ascending: false })
        .limit(5);

      if (commonQuestionsError) throw new Error(`Failed to get common questions: ${commonQuestionsError.message}`);

      return {
        totalQuestions,
        averageConfidenceScore: parseFloat(avgConfidence).toFixed(2),
        mostCommonQuestions: commonQuestionsData,
      };
    } catch (error) {
      console.error('❌ Error fetching authenticated Q&A stats:', error);
      throw error;
    }
  }
}

module.exports = new AuthenticatedQAController();
