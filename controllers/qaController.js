const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configuration
const PYTHON_API_BASE_URL = process.env.PYTHON_API_BASE_URL || 'http://localhost:5001';

class QAController {
    /**
     * Ask a question about a specific qudemo
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async askQudemoQuestion(req, res) {
        try {
            const { qudemoId } = req.params;
            const { question } = req.body;
            const userId = req.user.userId || req.user.id;

            console.log(`❓ Qudemo question: ${question} for qudemo: ${qudemoId}`);

            // Validate required parameters
            if (!question || !question.trim()) {
                return res.status(400).json({
                    success: false,
                    error: 'Question is required'
                });
            }

            if (!qudemoId) {
                return res.status(400).json({
                    success: false,
                    error: 'Qudemo ID is required'
                });
            }

            // Verify user has access to this qudemo
            const { data: qudemo, error: qudemoError } = await supabase
                .from('qudemos_new')
                .select(`
                    id, 
                    title, 
                    description, 
                    company_id,
                    companies!inner(name)
                `)
                .eq('id', qudemoId)
                .single();

            if (qudemoError || !qudemo) {
                return res.status(404).json({
                    success: false,
                    error: 'Qudemo not found'
                });
            }

            // Check if user has access to the company
            const { data: companyAccess, error: accessError } = await supabase
                .from('companies')
                .select('id')
                .eq('id', qudemo.company_id)
                .eq('user_id', userId)
                .single();

            if (accessError || !companyAccess) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied to this qudemo'
                });
            }

            console.log(`✅ Access verified for qudemo: ${qudemo.title}`);

            // Call Python backend for qudemo-specific question answering with the new endpoint
            try {
                const response = await axios.post(
                    `${PYTHON_API_BASE_URL}/ask/${qudemo.companies.name}/${qudemoId}`,
                    {
                        question: question.trim()
                    },
                    {
                        timeout: 30000, // 30 seconds timeout
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }
                );

                if (response.data && response.data.success) {
                    console.log(`✅ Qudemo question answered successfully`);
                    
                    // Log the interaction
                    await this.logQudemoInteraction(qudemoId, userId, question, response.data);

                    return res.json({
                        success: true,
                        answer: response.data.answer,
                        sources: response.data.sources || [],
                        video_url: response.data.video_url,
                        start: response.data.start,
                        end: response.data.end,
                        video_title: response.data.video_title,
                        answer_source: response.data.answer_source,
                        confidence: response.data.confidence
                    });
                } else {
                    throw new Error(response.data.error || 'Failed to get answer');
                }

            } catch (pythonError) {
                console.error('❌ Python API error:', pythonError);
                
                let errorMessage = 'Failed to process question';
                if (pythonError.response?.data?.detail) {
                    errorMessage = pythonError.response.data.detail;
                } else if (pythonError.message) {
                    errorMessage = pythonError.message;
                }

                return res.status(500).json({
                    success: false,
                    error: errorMessage
                });
            }

        } catch (error) {
            console.error('❌ Ask qudemo question error:', error);
            
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    /**
     * Log qudemo interaction for analytics
     * @param {string} qudemoId - Qudemo ID
     * @param {string} userId - User ID
     * @param {string} question - User question
     * @param {Object} response - AI response
     */
    async logQudemoInteraction(qudemoId, userId, question, response) {
        try {
            const interactionData = {
                id: require('uuid').v4(),
                qudemo_id: qudemoId,
                user_id: userId,
                question: question,
                answer: response.answer,
                answer_source: response.answer_source || 'unknown',
                has_video_timestamp: !!(response.video_url && response.start !== undefined),
                created_at: new Date().toISOString()
            };

            const { error: insertError } = await supabase
                .from('qudemo_interactions')
                .insert(interactionData);

            if (insertError) {
                console.error('❌ Failed to log qudemo interaction:', insertError);
            } else {
                console.log('✅ Qudemo interaction logged successfully');
            }

        } catch (error) {
            console.error('❌ Error logging qudemo interaction:', error);
        }
    }
}

module.exports = new QAController();
