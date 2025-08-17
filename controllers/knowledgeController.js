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

            console.log(`🔍 DEBUG: Creating knowledge source for company: "${companyName}"`);
            console.log(`🔍 DEBUG: Website URL: "${websiteUrl}"`);

            // Store metadata in knowledge_sources table with processing status
            const knowledgeSourceData = {
                id: uuidv4(),
                company_name: companyName.toLowerCase(),
                source_type: 'website',
                source_url: websiteUrl,
                title: `Website: ${new URL(websiteUrl).hostname}`,
                description: `Processing website content from ${websiteUrl}`,
                status: 'processing',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            console.log(`🔍 DEBUG: Knowledge source data:`, knowledgeSourceData);

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

            console.log(`🔍 DEBUG: Knowledge source created successfully:`, insertedData);

            console.log(`🔍 DEBUG: Calling Python API for website processing`);
            console.log(`🔍 DEBUG: Python API URL: ${PYTHON_API_BASE_URL}/process-website/${companyName}`);

            // Call Python API to process website
            const response = await axios.post(
                `${PYTHON_API_BASE_URL}/process-website/${companyName}`,
                { 
                    website_url: websiteUrl,
                    knowledge_source_id: knowledgeSourceData.id
                },
                { timeout: PYTHON_API_TIMEOUT }
            );

            console.log(`🔍 DEBUG: Python API response:`, response.data);

            if (response.data.success) {
                console.log(`🔍 DEBUG: Python API returned success, updating knowledge source status`);
                console.log(`🔍 DEBUG: Knowledge source ID: ${knowledgeSourceData.id}`);
                
                // Update status to processed
                const { data: updateData, error: updateError } = await supabase
                    .from('knowledge_sources')
                    .update({
                        status: 'processed',
                        processed_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', knowledgeSourceData.id)
                    .select();

                if (updateError) {
                    console.error('❌ Failed to update knowledge source status:', updateError);
                } else {
                    console.log('✅ Knowledge source status updated to processed');
                    console.log(`🔍 DEBUG: Updated knowledge source:`, updateData);
                }

                res.json({
                    success: true,
                    message: 'Website knowledge processed and stored successfully',
                    data: {
                        ...response.data,
                        knowledgeSource: insertedData[0]
                    }
                });
            } else {
                // Clean up all data if processing failed
                await this.cleanupFailedWebsiteData(knowledgeSourceData.id, websiteUrl, companyName);

                res.status(500).json({
                    success: false,
                    error: response.data.error || 'Failed to process website'
                });
            }
        } catch (error) {
            console.error('❌ Process website error:', error);
            
            // Clean up all data if processing failed
            if (error.config && error.config.data) {
                try {
                    const requestData = JSON.parse(error.config.data);
                    if (requestData.website_url) {
                        await this.cleanupFailedWebsiteData(null, requestData.website_url, requestData.companyName || companyName);
                    }
                } catch (cleanupError) {
                    console.error('❌ Failed to cleanup failed website data:', cleanupError);
                }
            }
            
            res.status(500).json({
                success: false,
                error: 'Failed to process website knowledge'
            });
        }
    }

    /**
     * Clean up failed website data from both Supabase and Pinecone
     */
    async cleanupFailedWebsiteData(knowledgeSourceId, websiteUrl, companyName) {
        console.log(`🧹 Cleaning up failed website data for: ${websiteUrl}`);
        
        try {
            // Delete from knowledge_sources table
            if (knowledgeSourceId) {
                console.log(`🗑️ Deleting from knowledge_sources table: ${knowledgeSourceId}`);
                const { error: deleteError } = await supabase
                    .from('knowledge_sources')
                    .delete()
                    .eq('id', knowledgeSourceId);
                
                if (deleteError) {
                    console.error(`❌ Failed to delete from knowledge_sources table:`, deleteError);
                } else {
                    console.log(`✅ Deleted from knowledge_sources table`);
                }
            }

            // Also delete by URL if no ID
            if (websiteUrl) {
                console.log(`🗑️ Deleting from knowledge_sources table by URL: ${websiteUrl}`);
                const { error: deleteError } = await supabase
                    .from('knowledge_sources')
                    .delete()
                    .eq('source_url', websiteUrl)
                    .eq('source_type', 'website');
                
                if (deleteError) {
                    console.error(`❌ Failed to delete from knowledge_sources table by URL:`, deleteError);
                } else {
                    console.log(`✅ Deleted from knowledge_sources table by URL`);
                }
            }

            // Delete from Pinecone
            console.log(`🗑️ Deleting from Pinecone for company: ${companyName}`);
            try {
                const response = await axios.delete(`${PYTHON_API_BASE_URL}/delete-website-data/${companyName}`, {
                    data: {
                        website_url: websiteUrl,
                        knowledge_source_id: knowledgeSourceId
                    },
                    timeout: 30000
                });
                
                if (response.data.success) {
                    console.log(`✅ Deleted from Pinecone`);
                } else {
                    console.error(`❌ Failed to delete from Pinecone:`, response.data.error);
                }
            } catch (pineconeError) {
                console.error(`❌ Pinecone deletion error:`, pineconeError.message);
            }

            console.log(`✅ Cleanup completed for failed website: ${websiteUrl}`);
            
        } catch (cleanupError) {
            console.error(`❌ Cleanup failed:`, cleanupError);
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

            // Store metadata in knowledge_sources table with processing status
            const knowledgeSourceData = {
                id: uuidv4(),
                company_name: companyName.toLowerCase(),
                source_type: 'document',
                source_url: null, // Documents don't have URLs
                title: `Document: ${req.file.originalname}`,
                description: `Processing document: ${req.file.originalname} (${req.file.size} bytes)`,
                status: 'processing',
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
                // Update status to completed
                const { error: updateError } = await supabase
                    .from('knowledge_sources')
                    .update({
                        status: 'completed',
                        processed_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', knowledgeSourceData.id);

                if (updateError) {
                    console.error('❌ Failed to update knowledge source status:', updateError);
                } else {
                    console.log('✅ Knowledge source status updated to completed');
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
                // Clean up all data if processing failed
                await this.cleanupFailedDocumentData(knowledgeSourceData.id, req.file.originalname, companyName);

                res.status(500).json({
                    success: false,
                    error: response.data.error || 'Failed to process document'
                });
            }
        } catch (error) {
            console.error('❌ Process document error:', error);
            
            // Clean up all data if processing failed
            if (error.config && error.config.data) {
                try {
                    const requestData = JSON.parse(error.config.data);
                    if (requestData.companyName) {
                        await this.cleanupFailedDocumentData(null, req.file?.originalname, requestData.companyName);
                    }
                } catch (cleanupError) {
                    console.error('❌ Failed to cleanup failed document data:', cleanupError);
                }
            }
            
            res.status(500).json({
                success: false,
                error: 'Failed to process document knowledge'
            });
        }
    }

    /**
     * Clean up failed document data from both Supabase and Pinecone
     */
    async cleanupFailedDocumentData(knowledgeSourceId, fileName, companyName) {
        console.log(`🧹 Cleaning up failed document data for: ${fileName}`);
        
        try {
            // Delete from knowledge_sources table
            if (knowledgeSourceId) {
                console.log(`🗑️ Deleting from knowledge_sources table: ${knowledgeSourceId}`);
                const { error: deleteError } = await supabase
                    .from('knowledge_sources')
                    .delete()
                    .eq('id', knowledgeSourceId);
                
                if (deleteError) {
                    console.error(`❌ Failed to delete from knowledge_sources table:`, deleteError);
                } else {
                    console.log(`✅ Deleted from knowledge_sources table`);
                }
            }

            // Also delete by title if no ID
            if (fileName) {
                console.log(`🗑️ Deleting from knowledge_sources table by title: ${fileName}`);
                const { error: deleteError } = await supabase
                    .from('knowledge_sources')
                    .delete()
                    .eq('title', `Document: ${fileName}`)
                    .eq('source_type', 'document');
                
                if (deleteError) {
                    console.error(`❌ Failed to delete from knowledge_sources table by title:`, deleteError);
                } else {
                    console.log(`✅ Deleted from knowledge_sources table by title`);
                }
            }

            // Delete from Pinecone
            console.log(`🗑️ Deleting from Pinecone for company: ${companyName}`);
            try {
                const response = await axios.delete(`${PYTHON_API_BASE_URL}/delete-document-data/${companyName}`, {
                    data: {
                        file_name: fileName,
                        knowledge_source_id: knowledgeSourceId
                    },
                    timeout: 30000
                });
                
                if (response.data.success) {
                    console.log(`✅ Deleted from Pinecone`);
                } else {
                    console.error(`❌ Failed to delete from Pinecone:`, response.data.error);
                }
            } catch (pineconeError) {
                console.error(`❌ Pinecone deletion error:`, pineconeError.message);
            }

            console.log(`✅ Cleanup completed for failed document: ${fileName}`);
            
        } catch (cleanupError) {
            console.error(`❌ Cleanup failed:`, cleanupError);
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

            console.log(`🔍 DEBUG: Getting knowledge sources for company: "${companyName}"`);

            // First try to get from Supabase (for legacy data)
            const { data: supabaseSources, error: fetchError } = await supabase
                .from('knowledge_sources')
                .select('*')
                .eq('company_name', companyName.toLowerCase())
                .order('created_at', { ascending: false });

            if (fetchError) {
                console.error('❌ Failed to fetch Supabase knowledge sources:', fetchError);
            }

            // Then get from Python backend (Pinecone data)
            let pythonSources = [];
            try {
                console.log(`🔍 DEBUG: Fetching from Python backend: ${PYTHON_API_BASE_URL}/knowledge/sources/${companyName}`);
                
                const pythonResponse = await axios.get(
                    `${PYTHON_API_BASE_URL}/knowledge/sources/${companyName}`,
                    { timeout: 10000 }
                );

                if (pythonResponse.data.success && pythonResponse.data.data) {
                    console.log(`🔍 DEBUG: Python backend returned ${pythonResponse.data.data.sources?.length || 0} sources`);
                    
                    // Transform Python backend data to match expected format
                    pythonSources = (pythonResponse.data.data.sources || []).map((source, index) => {
                        // For Settle Help Center, use a single ID
                        const isSettleHelpCenter = source.url && source.url.includes('help.settle.com');
                        const sourceId = isSettleHelpCenter ? 'settle_help_center' : `source_${index}`;
                        
                        return {
                            id: sourceId,
                            company_name: companyName.toLowerCase(),
                            source_type: source.type || 'website',
                            source_url: source.url || '',
                            title: source.title || 'Unknown Source',
                            description: `Content from ${source.title || 'unknown source'}`,
                            status: 'processed',
                            chunks: source.chunks || 0,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        };
                    });
                }
            } catch (pythonError) {
                console.error('❌ Failed to fetch from Python backend:', pythonError.message);
            }

            // Combine and filter sources
            const allSources = [...(supabaseSources || []), ...pythonSources];
            
            console.log(`🔍 DEBUG: Total sources found: ${allSources.length} (Supabase: ${supabaseSources?.length || 0}, Python: ${pythonSources.length})`);

            // Filter for completed/processed sources
            const knowledgeSources = allSources.filter(source => {
                const isNonVideo = source.source_type !== 'video' && 
                                  source.source_type !== 'youtube' && 
                                  source.source_type !== 'loom';
                
                const hasValidStatus = source.status === 'processed' || 
                                      !source.status;
                
                return isNonVideo && hasValidStatus;
            });

            console.log(`🔍 DEBUG: After filtering: ${knowledgeSources.length} knowledge sources`);

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
            const { company_name } = req.query;

            console.log(`🔍 DEBUG: Node.js received request - ID: ${id}, company_name from query: ${company_name}`);
            console.log(`🔍 DEBUG: Full query object:`, req.query);

            if (!id) {
                return res.status(400).json({
                    success: false,
                    error: 'Knowledge source ID is required'
                });
            }

            // Try to get the knowledge source metadata from Supabase first
            let knowledgeSource = null;
            let companyName = company_name;
            
            console.log(`🔍 DEBUG: Initial companyName set to: ${companyName}`);
            
            try {
                const { data: supabaseSource, error: fetchError } = await supabase
                    .from('knowledge_sources')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (!fetchError && supabaseSource) {
                    knowledgeSource = supabaseSource;
                    companyName = supabaseSource.company_name;
                }
            } catch (error) {
                console.log('🔍 DEBUG: No Supabase metadata found for source ID:', id);
            }

            // If no Supabase metadata, create basic metadata for Python backend sources
            if (!knowledgeSource) {
                knowledgeSource = {
                    id: id,
                    company_name: companyName || 'koott', // Use the company name from query params, not 'unknown'
                    source_type: 'website',
                    source_url: id,
                    title: id,
                    description: `Content from ${id}`,
                    status: 'processed'
                };
                console.log(`🔍 DEBUG: Created fallback metadata with company_name: ${knowledgeSource.company_name}`);
            }
            
            // Ensure we have a valid company name
            console.log(`🔍 DEBUG: Before company name validation - companyName: ${companyName}`);
            if (!companyName) {
                companyName = knowledgeSource.company_name || 'koott'; // Default to koott if not found
                console.log(`🔍 DEBUG: Company name was empty, set to: ${companyName}`);
            }
            console.log(`🔍 DEBUG: Final companyName before Python API call: ${companyName}`);

            // Call Python API to get content from Pinecone
            try {
                console.log(`🔍 DEBUG: Fetching content from Python backend for source: ${id}, company: ${companyName}`);
                
                // Handle Settle Help Center ID specially
                let pythonSourceId = id;
                if (id === 'settle_help_center') {
                    pythonSourceId = 'settle_help_center'; // Keep the same ID, don't convert to URL
                }
                
                console.log(`🔍 DEBUG: Calling Python API with source ID: ${pythonSourceId}`);
                console.log(`🔍 DEBUG: Company name being sent: ${companyName}`);
                
                const response = await axios.get(
                    `${PYTHON_API_BASE_URL}/knowledge/source/${pythonSourceId}/content`,
                    { 
                        params: { company_name: companyName },
                        timeout: PYTHON_API_TIMEOUT 
                    }
                );

                if (response.data.success) {
                    console.log('✅ Python API returned success!');
                    console.log('✅ Python API response data:', response.data.data);
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
                console.error('❌ Python API error details:', pythonError.response?.data || pythonError.message);
                console.error('❌ Python API error status:', pythonError.response?.status);
                
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
            const { company_name, source_type, source_url, title } = req.body;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    error: 'Knowledge source ID is required'
                });
            }

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

            // Delete from Pinecone via Python API first
            try {
                console.log(`🗑️ Deleting from Pinecone for company: ${knowledgeSource.company_name}`);
                
                const response = await axios.delete(
                    `${PYTHON_API_BASE_URL}/delete-knowledge-source/${knowledgeSource.company_name}`,
                    {
                        data: {
                            source_id: id,
                            source_type: knowledgeSource.source_type,
                            source_url: knowledgeSource.source_url,
                            title: knowledgeSource.title
                        },
                        timeout: PYTHON_API_TIMEOUT
                    }
                );

                if (response.data.success) {
                    console.log('✅ Successfully deleted from Pinecone');
                } else {
                    console.warn('⚠️ Pinecone deletion failed:', response.data.error);
                }
            } catch (pineconeError) {
                console.error('❌ Pinecone deletion error:', pineconeError);
                // Continue with database deletion even if Pinecone fails
            }

            // Delete from database
            const { error: deleteError } = await supabase
                .from('knowledge_sources')
                .delete()
                .eq('id', id);

            if (deleteError) {
                console.error('❌ Failed to delete knowledge source from database:', deleteError);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to delete knowledge source from database'
                });
            }

            console.log('✅ Successfully deleted knowledge source from database');

            res.json({
                success: true,
                message: 'Knowledge source deleted successfully from database and vector store',
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