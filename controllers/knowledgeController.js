const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configuration
const PYTHON_API_BASE_URL = process.env.PYTHON_API_BASE_URL || 'http://localhost:5001';
const PYTHON_API_TIMEOUT = parseInt(process.env.PYTHON_API_TIMEOUT) || 300000; // 5 minutes default

class KnowledgeController {
    /**
     * Process website knowledge and store metadata
     */
    async processWebsite(req, res) {
        try {
            const { companyName, websiteUrl } = req.body;

            if (!companyName || !websiteUrl) {
                return res.status(400).json({
                    success: false,
                    error: 'Company name and website URL are required'
                });
            }

            console.log(`🌐 Processing website for ${companyName}: ${websiteUrl}`);

            // Store metadata in knowledge_sources table
            const knowledgeSourceData = {
                id: uuidv4(),
                company_name: companyName.toLowerCase(),
                source_type: 'website',
                source_url: websiteUrl,
                title: `Website: ${new URL(websiteUrl).hostname}`,
                description: `Scraped website content from ${websiteUrl}`,
                status: 'processed',
                processed_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { data: insertedData, error: insertError } = await supabase
                .from('knowledge_sources')
                .insert([knowledgeSourceData])
                .select();

            if (insertError) {
                console.error('❌ Failed to insert knowledge source metadata:', insertError);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to store knowledge source metadata'
                });
            }

            // Call Python API to process website
            const response = await axios.post(
                `${PYTHON_API_BASE_URL}/process-website/${companyName}`,
                { 
                    website_url: websiteUrl,
                    knowledge_source_id: knowledgeSourceData.id  // Pass the UUID
                },
                { timeout: PYTHON_API_TIMEOUT }
            );

            if (response.data.success) {
                res.json({
                    success: true,
                    message: 'Website knowledge processed and stored successfully',
                    data: {
                        ...response.data,
                        knowledgeSource: insertedData[0]
                    }
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: response.data.error || 'Failed to process website'
                });
            }
        } catch (error) {
            console.error('❌ Process website error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to process website knowledge'
            });
        }
    }

    /**
     * Process document knowledge and store metadata
     */
    async processDocument(req, res) {
        try {
            const { companyName } = req.body;

            if (!companyName || !req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'Company name and document file are required'
                });
            }

            console.log(`📄 Processing document for ${companyName}: ${req.file.originalname}`);

            // Create form data for file upload
            const FormData = require('form-data');
            const form = new FormData();
            form.append('file', req.file.buffer, req.file.originalname);

            // Call Python API to process document
            const response = await axios.post(
                `${PYTHON_API_BASE_URL}/process-document/${companyName}`,
                form,
                {
                    timeout: PYTHON_API_TIMEOUT,
                    headers: {
                        ...form.getHeaders()
                    }
                }
            );

            if (response.data.success) {
                // Store metadata in knowledge_sources table
                const knowledgeSourceData = {
                    id: uuidv4(),
                    company_name: companyName.toLowerCase(),
                    source_type: 'document',
                    source_url: null, // Documents don't have URLs
                    title: `Document: ${req.file.originalname}`,
                    description: `Processed document: ${req.file.originalname} (${req.file.size} bytes)`,
                    status: 'processed',
                    processed_at: new Date().toISOString(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                const { data: insertedData, error: insertError } = await supabase
                    .from('knowledge_sources')
                    .insert([knowledgeSourceData])
                    .select();

                if (insertError) {
                    console.error('❌ Failed to insert knowledge source metadata:', insertError);
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to store knowledge source metadata'
                    });
                }

                res.json({
                    success: true,
                    message: 'Document knowledge processed and stored successfully',
                    data: {
                        ...response.data,
                        knowledgeSource: insertedData[0]
                    }
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: response.data.error || 'Failed to process document'
                });
            }
        } catch (error) {
            console.error('❌ Process document error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to process document knowledge'
            });
        }
    }

    /**
     * Get all knowledge sources for a company
     */
    async getKnowledgeSources(req, res) {
        try {
            const { companyName } = req.params;

            if (!companyName) {
                return res.status(400).json({
                    success: false,
                    error: 'Company name is required'
                });
            }

            console.log(`📊 Getting knowledge sources for ${companyName}`);

            const { data: knowledgeSources, error } = await supabase
                .from('knowledge_sources')
                .select('*')
                .eq('company_name', companyName.toLowerCase())
                .order('created_at', { ascending: false });

            if (error) {
                console.error('❌ Failed to fetch knowledge sources:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch knowledge sources'
                });
            }

            res.json({
                success: true,
                data: knowledgeSources || []
            });
        } catch (error) {
            console.error('❌ Get knowledge sources error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get knowledge sources'
            });
        }
    }

    /**
     * Get knowledge source by ID
     */
    async getKnowledgeSourceById(req, res) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    error: 'Knowledge source ID is required'
                });
            }

            console.log(`📊 Getting knowledge source: ${id}`);

            const { data: knowledgeSource, error } = await supabase
                .from('knowledge_sources')
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                console.error('❌ Failed to fetch knowledge source:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch knowledge source'
                });
            }

            if (!knowledgeSource) {
                return res.status(404).json({
                    success: false,
                    error: 'Knowledge source not found'
                });
            }

            res.json({
                success: true,
                data: knowledgeSource
            });
        } catch (error) {
            console.error('❌ Get knowledge source error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get knowledge source'
            });
        }
    }

    /**
     * Get knowledge source content for preview
     */
    async getKnowledgeSourceContent(req, res) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    error: 'Knowledge source ID is required'
                });
            }

            console.log(`📄 Getting knowledge source content: ${id}`);

            // First get the knowledge source metadata
            const { data: knowledgeSource, error: fetchError } = await supabase
                .from('knowledge_sources')
                .select('*')
                .eq('id', id)
                .single();

            if (fetchError || !knowledgeSource) {
                return res.status(404).json({
                    success: false,
                    error: 'Knowledge source not found'
                });
            }

            // Call Python API to get content from Pinecone
            try {
                const response = await axios.get(
                    `${PYTHON_API_BASE_URL}/knowledge/source/${id}/content`,
                    { 
                        params: { company_name: knowledgeSource.company_name },
                        timeout: PYTHON_API_TIMEOUT 
                    }
                );

                if (response.data.success) {
                    res.json({
                        success: true,
                        data: {
                            ...response.data.data,
                            metadata: knowledgeSource
                        }
                    });
                } else {
                    res.status(500).json({
                        success: false,
                        error: response.data.error || 'Failed to fetch content'
                    });
                }
            } catch (pythonError) {
                console.error('❌ Python API error:', pythonError);
                
                // Fallback: return basic metadata if Python API fails
                res.json({
                    success: true,
                    data: {
                        chunks: [],
                        stats: {
                            total_chunks: 0,
                            total_words: 0,
                            total_characters: 0,
                            processing_time: 'N/A'
                        },
                        metadata: knowledgeSource
                    }
                });
            }
        } catch (error) {
            console.error('❌ Get knowledge source content error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get knowledge source content'
            });
        }
    }

    /**
     * Delete knowledge source
     */
    async deleteKnowledgeSource(req, res) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    error: 'Knowledge source ID is required'
                });
            }

            console.log(`🗑️ Deleting knowledge source: ${id}`);

            // First get the knowledge source to get company name
            const { data: knowledgeSource, error: fetchError } = await supabase
                .from('knowledge_sources')
                .select('*')
                .eq('id', id)
                .single();

            if (fetchError || !knowledgeSource) {
                return res.status(404).json({
                    success: false,
                    error: 'Knowledge source not found'
                });
            }

            // Delete from database
            const { error: deleteError } = await supabase
                .from('knowledge_sources')
                .delete()
                .eq('id', id);

            if (deleteError) {
                console.error('❌ Failed to delete knowledge source:', deleteError);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to delete knowledge source'
                });
            }

            // TODO: Also delete from Pinecone (this would require a new Python API endpoint)
            // For now, we'll just delete the metadata

            res.json({
                success: true,
                message: 'Knowledge source deleted successfully',
                data: knowledgeSource
            });
        } catch (error) {
            console.error('❌ Delete knowledge source error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete knowledge source'
            });
        }
    }

    /**
     * Get knowledge summary for a company
     */
    async getKnowledgeSummary(req, res) {
        try {
            const { companyName } = req.params;

            if (!companyName) {
                return res.status(400).json({
                    success: false,
                    error: 'Company name is required'
                });
            }

            console.log(`📊 Getting knowledge summary for ${companyName}`);

            // Get Pinecone summary from Python API
            const response = await axios.get(
                `${PYTHON_API_BASE_URL}/knowledge-summary/${companyName}`,
                { timeout: PYTHON_API_TIMEOUT }
            );

            // Get database summary
            const { data: knowledgeSources, error } = await supabase
                .from('knowledge_sources')
                .select('*')
                .eq('company_name', companyName.toLowerCase());

            if (error) {
                console.error('❌ Failed to fetch knowledge sources:', error);
            }

            // Count by source type
            const sourceCounts = {};
            if (knowledgeSources) {
                knowledgeSources.forEach(source => {
                    const type = source.source_type;
                    sourceCounts[type] = (sourceCounts[type] || 0) + 1;
                });
            }

            res.json({
                success: true,
                data: {
                    ...response.data,
                    sourceCounts,
                    totalSources: knowledgeSources ? knowledgeSources.length : 0,
                    sources: knowledgeSources || []
                }
            });
        } catch (error) {
            console.error('❌ Knowledge summary error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get knowledge summary'
            });
        }
    }
}

module.exports = new KnowledgeController();
