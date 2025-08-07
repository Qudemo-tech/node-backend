const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const companyController = {
    /**
     * Create a new company with GCS bucket and associate it with the user
     */
    async createCompany(req, res) {
    
        try {
            const userId = req.user.userId || req.user.id;
            const { name, displayName, description, website, logo } = req.body;

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

            // Create company in database
            const { data: company, error: insertError } = await supabase
                .from('companies')
                .insert({
                    user_id: userId,
                    name,
                    display_name: displayName,
                    is_active: true,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (insertError) {
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
                    displayName: company.display_name
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
                console.error('Supabase error in getUserCompany:', error);
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

            // Remove name from update data (should not be changed)
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
                .select('name')
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

            res.json({
                success: true,
                message: 'Company deleted successfully',
                data: {
                    companyId,
                    companyName: company.name
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
     * Get company statistics
     */
    async getCompanyStats(req, res) {
        try {
            const { companyId } = req.params;

            // Get company details
            const { data: company, error: companyError } = await supabase
                .from('companies')
                .select('id, name')
                .eq('id', companyId)
                .single();

            if (companyError) {
                return res.status(404).json({
                    success: false,
                    error: 'Company not found'
                });
            }

            // Get company statistics (no GCS access)
            try {
                const stats = {
                    totalFiles: 0, // Placeholder, no GCS access
                    totalSize: 0, // Placeholder, no GCS access
                    fileTypes: {}, // Placeholder, no GCS access
                    transcripts: 0, // Placeholder, no GCS access
                    srtFiles: 0, // Placeholder, no GCS access
                    faissIndexes: 0, // Placeholder, no GCS access
                    note: 'GCS statistics not available' // Placeholder, no GCS access
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

            console.log('🏢 getCompanies called with:', {
                role,
                userId,
                user: req.user
            });

            if (role === 'admin') {
                console.log('👑 Admin user - fetching all companies');
                const { data: companies, error } = await supabase
                    .from('companies')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                console.log(`✅ Admin: Found ${companies?.length || 0} companies`);
                return res.json({ success: true, data: companies });
            } else {
                console.log('👤 Regular user - fetching user company');
                const { data: company, error } = await supabase
                    .from('companies')
                    .select('*')
                    .eq('user_id', userId)
                    .limit(1);

                if (error) throw error;
                console.log(`✅ User: Found ${company?.length || 0} companies for user ${userId}`);
                console.log('📋 Company data:', company);
                return res.json({ success: true, data: company || [] });
            }
        } catch (error) {
            console.error('❌ Get companies error:', error);
            res.status(500).json({
                success: false,
                error: 'An error occurred while fetching company data.'
            });
        }
    }
};

module.exports = companyController; 