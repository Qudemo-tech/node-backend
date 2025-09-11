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

            // Call Python backend for qudemo-specific question answering with hybrid Q&A (optimized for accuracy)
            try {
                // Try hybrid Q&A endpoint first for best accuracy and timestamps
                let response;
                try {
                    console.log(`🚀 Attempting hybrid Q&A for enhanced accuracy...`);
                    response = await axios.post(
                        `${PYTHON_API_BASE_URL}/ask/${qudemo.companies.name}/${qudemoId}`,
                        {
                            question: question.trim()
                        },
                        {
                            timeout: 45000, // 45 seconds timeout for hybrid processing
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    console.log(`✅ Hybrid Q&A response received`);
                } catch (hybridError) {
                    console.log(`⚠️ Hybrid Q&A failed, falling back to standard Q&A: ${hybridError.message}`);
                    // Fallback to standard Q&A endpoint
                    response = await axios.post(
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
                    console.log(`✅ Standard Q&A fallback response received`);
                }

                if (response.data && response.data.success) {
                    console.log(`✅ Qudemo question answered successfully`);
                    console.log(`🔍 Python response data:`, JSON.stringify(response.data, null, 2));
                    
                    // Log the interaction
                    await this.logQudemoInteraction(qudemoId, userId, question, response.data);

                    // Enhanced mapping for hybrid Q&A response with better timestamp handling
                    const primarySource = response.data.primary_source || response.data.answer_source || 'unknown';
                    const sources = Array.isArray(response.data.sources) ? response.data.sources : [];
                    const searchMethod = response.data.search_method || 'standard';

                    // Extract video data with enhanced hybrid Q&A support
                    let videoUrl = response.data.video_url;
                    let start = response.data.start;
                    let end = response.data.end;
                    let videoTitle = response.data.video_title;
                    let formattedTimestamp = response.data.formatted_timestamp;

                    // Enhanced timestamp handling for hybrid Q&A
                    if (searchMethod === 'hybrid' && response.data.hybrid_scores) {
                        console.log(`🎯 Hybrid Q&A detected with scores:`, response.data.hybrid_scores);
                        // Hybrid Q&A provides more accurate timestamps
                        if (start !== undefined && start > 0) {
                            formattedTimestamp = `${Math.floor(start / 60)}:${Math.floor(start % 60).toString().padStart(2, '0')}`;
                        }
                    }

                    // Fallback: if no direct video data, try to find in sources
                    if (!videoUrl && (primarySource === 'video' || primarySource === 'hybrid')) {
                        const firstVideo = sources.find(s => (s.type === 'video' || s.content_type === 'video'));
                        if (firstVideo) {
                            videoUrl = firstVideo.video_url || firstVideo.url;
                            start = firstVideo.start_timestamp || (typeof firstVideo.timestamp === 'number' ? firstVideo.timestamp : undefined);
                            end = firstVideo.end_timestamp;
                            videoTitle = firstVideo.title;
                        }
                    }

                    const finalResponse = {
                        success: true,
                        answer: response.data.answer,
                        sources: sources,
                        video_url: videoUrl,
                        start: start,
                        end: end,
                        video_title: videoTitle,
                        answer_source: primarySource,
                        search_method: searchMethod,
                        confidence: response.data.confidence_score || response.data.confidence,
                        search_score: response.data.search_score,
                        hybrid_scores: response.data.hybrid_scores,
                        formatted_timestamp: formattedTimestamp,
                        difficulty_level: response.data.difficulty_level,
                        estimated_time: response.data.estimated_time
                    };
                    
                    console.log(`🎬 Final response to frontend:`, JSON.stringify(finalResponse, null, 2));
                    console.log(`🎬 Video URL: ${videoUrl}, Start: ${start}, End: ${end}`);
                    
                    return res.json(finalResponse);
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
