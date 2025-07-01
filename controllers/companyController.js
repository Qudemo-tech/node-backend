const { createClient } = require('@supabase/supabase-js');
const { Storage } = require('@google-cloud/storage');

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize Google Cloud Storage
const storage = new Storage({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
});

const companyController = {
    /**
     * Create a new company with GCS bucket and associate it with the user
     */
    async createCompany(req, res) {
        console.log('req.user in createCompany:', req.user);
        try {
            const userId = req.user.userId || req.user.id;
            const { name, displayName, description, bucketName, website, logo } = req.body;

            // 1. Check if user already has a company
            const { data: userCompany, error: userCompanyError } = await supabase
                .from('companies')
                .select('id')
                .eq('user_id', userId)
                .single();

            if (userCompanyError && userCompanyError.code !== 'PGRST116') {
                return res.status(500).json({ success: false, error: 'Error checking for existing company.' });
            }
            if (userCompany) {
                return res.status(409).json({ success: false, error: 'A company has already been created for this user.' });
            }

            // Check if company name already exists
            const { data: existingCompany, error: checkError } = await supabase
                .from('companies')
                .select('id, name')
                .eq('name', name)
                .single();

            if (checkError && checkError.code !== 'PGRST116') {
                return res.status(500).json({
                    success: false,
                    error: 'Error checking company existence'
                });
            }

            if (existingCompany) {
                return res.status(400).json({
                    success: false,
                    error: 'Company name already exists. Please choose a different name.'
                });
            }

            // Check if bucket already exists in GCS
            try {
                const bucket = storage.bucket(bucketName);
                const [exists] = await bucket.exists();
                
                if (exists) {
                    return res.status(400).json({
                        success: false,
                        error: 'Bucket name already exists in Google Cloud Storage. Please choose a different name.'
                    });
                }
            } catch (error) {
                console.error('Error checking bucket existence:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Error checking bucket availability'
                });
            }

            // Create GCS bucket
            try {
                await storage.createBucket(bucketName, {
                    location: 'US',
                    storageClass: 'STANDARD'
                });
                console.log(`✅ Created GCS bucket: ${bucketName}`);
            } catch (error) {
                console.error('Error creating GCS bucket:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to create Google Cloud Storage bucket'
                });
            }

            // Create company in database
            console.log('Inserting company:', {
                user_id: userId,
                name,
                display_name: displayName,
                bucket_name: bucketName,
                is_active: true,
                created_at: new Date().toISOString()
            });
            const { data: company, error: insertError } = await supabase
                .from('companies')
                .insert({
                    user_id: userId,
                    name,
                    display_name: displayName,
                    bucket_name: bucketName,
                    is_active: true,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (insertError) {
                // If database insert fails, delete the created bucket
                try {
                    await storage.bucket(bucketName).delete();
                    console.log(`🗑️ Deleted GCS bucket due to database error: ${bucketName}`);
                } catch (deleteError) {
                    console.error('Error deleting bucket after database failure:', deleteError);
                }

                return res.status(500).json({
                    success: false,
                    error: 'Failed to create company in database'
                });
            }

            res.status(201).json({
                success: true,
                message: 'Company created successfully',
                data: {
                    id: company.id,
                    name: company.name,
                    displayName: company.display_name,
                    bucketName: company.bucket_name,
                    apiEndpoint: `/api/${company.name}/video`
                }
            });

        } catch (error) {
            console.error('Create company error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    },

    /**
     * Get the company for the logged-in user
     */
    async getUserCompany(req, res) {
        try {
            const { id: userId } = req.user;
            const { data: company, error } = await supabase
                .from('companies')
                .select('*')
                .eq('user_id', userId)
                .single();
            
            if (error) {
                if (error.code === 'PGRST116') {
                    // This is not an error, it just means the user has no company yet.
                    return res.status(200).json({ success: true, data: null });
                }
                return res.status(500).json({ success: false, error: 'Failed to fetch company' });
            }

            res.json({ success: true, data: [company] }); // Return as an array to match getAllCompanies
        } catch (error) {
            console.error('Get user company error:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    },

    /**
     * Get all companies (Admin action, keeping it for now but should be protected)
     */
    async getAllCompanies(req, res) {
        try {
            const { data: companies, error } = await supabase
                .from('companies')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch companies'
                });
            }

            res.json({
                success: true,
                data: companies
            });

        } catch (error) {
            console.error('Get companies error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    },

    /**
     * Get company by ID
     */
    async getCompanyById(req, res) {
        try {
            const { companyId } = req.params;

            const { data: company, error } = await supabase
                .from('companies')
                .select('*')
                .eq('id', companyId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return res.status(404).json({
                        success: false,
                        error: 'Company not found'
                    });
                }
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch company'
                });
            }

            res.json({
                success: true,
                data: company
            });

        } catch (error) {
            console.error('Get company error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    },

    /**
     * Get company by name
     */
    async getCompanyByName(req, res) {
        try {
            const { companyName } = req.params;

            const { data: company, error } = await supabase
                .from('companies')
                .select('*')
                .eq('name', companyName)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return res.status(404).json({
                        success: false,
                        error: 'Company not found'
                    });
                }
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch company'
                });
            }

            res.json({
                success: true,
                data: company
            });

        } catch (error) {
            console.error('Get company by name error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    },

    /**
     * Update company
     */
    async updateCompany(req, res) {
        try {
            const { companyId } = req.params;
            const updateData = req.body;

            // Remove bucket_name from update data (should not be changed)
            delete updateData.bucket_name;
            delete updateData.name;

            const { data: company, error } = await supabase
                .from('companies')
                .update({
                    ...updateData,
                    updated_at: new Date().toISOString()
                })
                .eq('id', companyId)
                .select()
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return res.status(404).json({
                        success: false,
                        error: 'Company not found'
                    });
                }
                return res.status(500).json({
                    success: false,
                    error: 'Failed to update company'
                });
            }

            res.json({
                success: true,
                message: 'Company updated successfully',
                data: company
            });

        } catch (error) {
            console.error('Update company error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    },

    /**
     * Delete company (soft delete)
     */
    async deleteCompany(req, res) {
        try {
            const { companyId } = req.params;

            // Get company details first
            const { data: company, error: fetchError } = await supabase
                .from('companies')
                .select('name, bucket_name')
                .eq('id', companyId)
                .single();

            if (fetchError) {
                if (fetchError.code === 'PGRST116') {
                    return res.status(404).json({
                        success: false,
                        error: 'Company not found'
                    });
                }
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch company'
                });
            }

            // Soft delete in database
            const { error: updateError } = await supabase
                .from('companies')
                .update({
                    is_active: false,
                    deleted_at: new Date().toISOString()
                })
                .eq('id', companyId);

            if (updateError) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to delete company'
                });
            }

            // Note: We don't delete the GCS bucket to preserve data
            // The bucket can be manually deleted if needed

            res.json({
                success: true,
                message: 'Company deleted successfully',
                data: {
                    companyName: company.name,
                    bucketName: company.bucket_name,
                    note: 'GCS bucket preserved for data safety'
                }
            });

        } catch (error) {
            console.error('Delete company error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    },

    /**
     * Check bucket availability
     */
    async checkBucketAvailability(req, res) {
        try {
            const { bucketName } = req.params;

            try {
                const bucket = storage.bucket(bucketName);
                const [exists] = await bucket.exists();
                
                res.json({
                    success: true,
                    data: {
                        bucketName,
                        available: !exists,
                        message: exists ? 'Bucket name already exists' : 'Bucket name is available'
                    }
                });
            } catch (error) {
                res.json({
                    success: true,
                    data: {
                        bucketName,
                        available: true,
                        message: 'Bucket name is available'
                    }
                });
            }

        } catch (error) {
            console.error('Check bucket availability error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    },

    /**
     * Get company statistics
     */
    async getCompanyStats(req, res) {
        try {
            const { companyId } = req.params;

            // Get company details
            const { data: company, error: companyError } = await supabase
                .from('companies')
                .select('bucket_name')
                .eq('id', companyId)
                .single();

            if (companyError) {
                return res.status(404).json({
                    success: false,
                    error: 'Company not found'
                });
            }

            // Get bucket statistics from GCS
            try {
                const bucket = storage.bucket(company.bucket_name);
                const [files] = await bucket.getFiles();
                
                const stats = {
                    totalFiles: files.length,
                    totalSize: files.reduce((acc, file) => acc + (file.metadata?.size || 0), 0),
                    fileTypes: files.reduce((acc, file) => {
                        const ext = file.name.split('.').pop()?.toLowerCase();
                        acc[ext] = (acc[ext] || 0) + 1;
                        return acc;
                    }, {}),
                    transcripts: files.filter(f => f.name.includes('transcript')).length,
                    srtFiles: files.filter(f => f.name.endsWith('.srt')).length,
                    faissIndexes: files.filter(f => f.name.includes('faiss')).length
                };

                res.json({
                    success: true,
                    data: stats
                });

            } catch (gcsError) {
                console.error('GCS stats error:', gcsError);
                res.json({
                    success: true,
                    data: {
                        totalFiles: 0,
                        totalSize: 0,
                        fileTypes: {},
                        transcripts: 0,
                        srtFiles: 0,
                        faissIndexes: 0,
                        note: 'Unable to fetch GCS statistics'
                    }
                });
            }

        } catch (error) {
            console.error('Get company stats error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    },

    /**
     * Get companies based on user role.
     * Admin gets all companies, a regular user gets their own company.
     */
    async getCompanies(req, res) {
        try {
            const { role } = req.user;
            const userId = req.user.userId || req.user.id;

            if (role === 'admin') {
                const { data: companies, error } = await supabase
                    .from('companies')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                return res.json({ success: true, data: companies });
            } else {
                const { data: company, error } = await supabase
                    .from('companies')
                    .select('*')
                    .eq('user_id', userId)
                    .limit(1);

                if (error) throw error;
                return res.json({ success: true, data: company || [] });
            }
        } catch (error) {
            console.error('Get companies error:', error);
            res.status(500).json({
                success: false,
                error: 'An error occurred while fetching company data.'
            });
        }
    }
};

module.exports = companyController; 