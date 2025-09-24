/**
 * Public Q&A Controller
 * Handles storage and retrieval of public Q&A interactions
 */

const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class PublicQAController {
    /**
     * Store public Q&A interaction
     * @param {Object} data - Q&A data
     * @param {string} data.shareToken - Share token for the QuDemo
     * @param {string} data.question - User's question
     * @param {string} data.answer - AI-generated answer
     * @param {string} data.qudemoId - QuDemo ID
     * @param {string} data.companyId - Company ID
     * @param {Object} data.metadata - Additional metadata
     */
    async storePublicQA(data) {
        try {
            const {
                shareToken,
                question,
                answer,
                qudemoId,
                companyId,
                metadata = {}
            } = data;

            // Prepare the data for insertion
            const qaData = {
                id: uuidv4(),
                share_token: shareToken,
                qudemo_id: qudemoId,
                company_id: companyId,
                question: question,
                answer: answer,
                confidence_score: metadata.confidence || 0,
                search_score: metadata.search_score || 0,
                video_url: metadata.video_url || null,
                start_timestamp: metadata.start_timestamp || 0,
                end_timestamp: metadata.end_timestamp || 0,
                formatted_timestamp: metadata.formatted_timestamp || '',
                answer_source: metadata.answer_source || 'gcs_transcript_search',
                search_method: metadata.search_method || 'standard',
                difficulty_level: metadata.difficulty_level || 'unknown',
                estimated_time: metadata.estimated_time || 'unknown',
                user_ip: metadata.user_ip || null,
                user_agent: metadata.user_agent || null,
                created_at: new Date().toISOString()
            };

            console.log(`💾 Storing public Q&A interaction:`, {
                shareToken,
                qudemoId,
                companyId,
                questionLength: question.length,
                answerLength: answer.length
            });

            // Insert into public_qa_interactions table
            const { data: insertedData, error } = await supabase
                .from('public_qa_interactions')
                .insert(qaData)
                .select()
                .single();

            if (error) {
                console.error('❌ Error storing public Q&A:', error);
                throw new Error(`Failed to store public Q&A: ${error.message}`);
            }

            console.log(`✅ Public Q&A stored successfully with ID: ${insertedData.id}`);
            return insertedData;

        } catch (error) {
            console.error('❌ Public Q&A storage error:', error);
            throw error;
        }
    }

    /**
     * Get public Q&A interactions for a QuDemo
     * @param {string} qudemoId - QuDemo ID
     * @param {number} limit - Number of interactions to retrieve
     */
    async getPublicQAInteractions(qudemoId, limit = 50) {
        try {
            const { data, error } = await supabase
                .from('public_qa_interactions')
                .select('*')
                .eq('qudemo_id', qudemoId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) {
                console.error('❌ Error fetching public Q&A interactions:', error);
                throw new Error(`Failed to fetch public Q&A: ${error.message}`);
            }

            return data || [];

        } catch (error) {
            console.error('❌ Public Q&A fetch error:', error);
            throw error;
        }
    }

    /**
     * Get public Q&A statistics for a company
     * @param {string} companyId - Company ID
     */
    async getPublicQAStats(companyId) {
        try {
            const { data, error } = await supabase
                .from('public_qa_interactions')
                .select('*')
                .eq('company_id', companyId);

            if (error) {
                console.error('❌ Error fetching public Q&A stats:', error);
                throw new Error(`Failed to fetch public Q&A stats: ${error.message}`);
            }

            // Calculate statistics
            const stats = {
                total_interactions: data.length,
                unique_qudemos: [...new Set(data.map(qa => qa.qudemo_id))].length,
                avg_confidence: data.reduce((sum, qa) => sum + (qa.confidence_score || 0), 0) / data.length || 0,
                avg_search_score: data.reduce((sum, qa) => sum + (qa.search_score || 0), 0) / data.length || 0,
                most_common_questions: this.getMostCommonQuestions(data),
                recent_interactions: data
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                    .slice(0, 10)
            };

            return stats;

        } catch (error) {
            console.error('❌ Public Q&A stats error:', error);
            throw error;
        }
    }

    /**
     * Get most common questions from Q&A data
     * @param {Array} data - Q&A interactions data
     */
    getMostCommonQuestions(data) {
        const questionCounts = {};
        
        data.forEach(qa => {
            const question = qa.question.toLowerCase().trim();
            questionCounts[question] = (questionCounts[question] || 0) + 1;
        });

        return Object.entries(questionCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([question, count]) => ({ question, count }));
    }

    /**
     * Clean up old public Q&A interactions (for maintenance)
     * @param {number} daysOld - Number of days old to clean up
     */
    async cleanupOldInteractions(daysOld = 90) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            const { data, error } = await supabase
                .from('public_qa_interactions')
                .delete()
                .lt('created_at', cutoffDate.toISOString())
                .select();

            if (error) {
                console.error('❌ Error cleaning up old public Q&A:', error);
                throw new Error(`Failed to cleanup old public Q&A: ${error.message}`);
            }

            console.log(`🧹 Cleaned up ${data.length} old public Q&A interactions`);
            return data.length;

        } catch (error) {
            console.error('❌ Public Q&A cleanup error:', error);
            throw error;
        }
    }
}

module.exports = new PublicQAController();
