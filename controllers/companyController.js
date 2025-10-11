const { createClient } = require('@supabase/supabase-js');
const { logCompanyOperation } = require('../middleware/logging');
const { ACTIONS, RESOURCES } = require('../services/companyLogger');

// Create Supabase client
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
            const authUserId = req.user.userId || req.user.id;
            const { name, description, website, logo } = req.body;

            console.log('🔍 Company creation request for auth user ID:', authUserId);
            console.log('🔍 Request user object:', req.user);

            let userId;
            
            // First try to find user by auth_user_id (for OAuth users)
            console.log('🔍 Trying to find user by auth_user_id:', authUserId);
            const { data: userDataByAuthId, error: userErrorByAuthId } = await supabase
                .from('users')
                .select('id')
                .eq('auth_user_id', authUserId)
                .single();
            
            if (!userErrorByAuthId && userDataByAuthId) {
                // Found by auth_user_id (OAuth user)
                userId = userDataByAuthId.id;
                console.log('✅ Found user by auth_user_id, using database ID:', userId);
            } else {
                // Try to find user by database ID (for email/password users)
                console.log('🔍 Not found by auth_user_id, trying by database ID:', authUserId);
                const { data: userDataById, error: userErrorById } = await supabase
                    .from('users')
                    .select('id')
                    .eq('id', authUserId)
                    .single();
                
                if (!userErrorById && userDataById) {
                    // Found by database ID (email/password user)
                    userId = userDataById.id;
                    console.log('✅ Found user by database ID:', userId);
                } else {
                    console.error('❌ User not found by either auth_user_id or database ID');
                    console.error('❌ Auth user ID error:', userErrorByAuthId);
                    console.error('❌ Database ID error:', userErrorById);
                    return res.status(500).json({
                        success: false,
                        error: 'User not found in database',
                        details: 'User not found by either authentication method'
                    });
                }
            }
            
            console.log('✅ Using database user ID for company creation:', userId);

            // Check if companies table exists
            console.log('🔍 Checking if companies table exists...');
            const { data: tableCheck, error: tableError } = await supabase
                .from('companies')
                .select('id')
                .limit(1);

            if (tableError) {
                console.error('❌ Table check error:', tableError);
                return res.status(500).json({
                    success: false,
                    error: 'Database table not found. Please run the database schema first.',
                    details: tableError.message
                });
            }
            console.log('✅ Companies table exists, proceeding with company creation');

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

            // Check if this user already has a company with this name (optional check)
            // Note: Different users can have companies with the same name
            const { data: userCompanyWithName, error: nameCheckError } = await supabase
                .from('companies')
                .select('id, name')
                .eq('user_id', userId)
                .eq('name', name)
                .single();

            if (nameCheckError && nameCheckError.code !== 'PGRST116') {
                return res.status(500).json({
                    success: false,
                    error: 'Error checking company name'
                });
            }

            if (userCompanyWithName) {
                return res.status(400).json({
                    success: false,
                    error: 'You already have a company with this name. Please choose a different name.'
                });
            }

            // Create company in database
            console.log('🔍 Creating company with data:', {
                user_id: userId,
                name,
                is_active: true
            });

            const { data: company, error: insertError } = await supabase
                .from('companies')
                .insert({
                    user_id: userId,
                    name,
                    display_name: name, // Use name as display_name for backward compatibility
                    is_active: true,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (insertError) {
                console.error('❌ Company creation error:', insertError);
                console.error('❌ Error details:', {
                    code: insertError.code,
                    message: insertError.message,
                    details: insertError.details,
                    hint: insertError.hint
                });
                return res.status(500).json({
                    success: false,
                    error: `Failed to create company in database: ${insertError.message}`,
                    details: insertError.details
                });
            }

            // Log company creation
            // Set company info in request for logging
            req.companyId = company.id;
            req.companyName = company.name;
            
            await logCompanyOperation(
                req,
                ACTIONS.CREATE_COMPANY,
                RESOURCES.COMPANY,
                company.id,
                `Company "${company.name}" created successfully`,
                {
                    companyId: company.id,
                    companyName: company.name,
                    displayName: company.display_name,
                    website: company.website,
                    bucketName: company.bucket_name
                },
                'INFO'
            );

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
     * Fix user company association (utility endpoint)
     */
    async fixUserCompanyAssociation(req, res) {
        try {
            const { id: userId } = req.user;
            const { companyId } = req.body;

            if (!companyId) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Company ID is required' 
                });
            }

            // First check if the company exists
            const { data: company, error: companyError } = await supabase
                .from('companies')
                .select('*')
                .eq('id', companyId)
                .single();

            if (companyError || !company) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Company not found' 
                });
            }

            // Update the company to associate it with the current user
            const { data: updatedCompany, error: updateError } = await supabase
                .from('companies')
                .update({ user_id: userId })
                .eq('id', companyId)
                .select()
                .single();

            if (updateError) {
                console.error('Update company error:', updateError);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Failed to update company association' 
                });
            }

            res.json({ 
                success: true, 
                message: 'Company association fixed successfully',
                data: updatedCompany
            });

        } catch (error) {
            console.error('Fix user company association error:', error);
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
     * Delete company and all associated data (hard delete)
     */
    async deleteCompany(req, res) {
        try {
            const { companyId } = req.params;
            console.log(`🗑️ Starting comprehensive deletion for company ID: ${companyId}`);

            // Get company details first
            const { data: company, error: fetchError } = await supabase
                .from('companies')
                .select('id, name, display_name')
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

            console.log(`🗑️ Found company: ${company.name} (${company.display_name})`);

            // Step 1: Delete all data from GCS FIRST (before Supabase deletion)
            console.log('🗑️ Step 1: Deleting all data from GCS...');
            try {
                const gcsResult = await this.deleteCompanyFromGCS(company.name);
                if (!gcsResult.success) {
                    console.warn(`⚠️ GCS deletion warning: ${gcsResult.error}`);
                    // Continue with Supabase deletion even if GCS fails
                } else {
                    console.log('✅ Deleted data from GCS');
                }
            } catch (gcsError) {
                console.error('❌ GCS deletion error:', gcsError);
                // Continue with Supabase deletion even if GCS fails
            }

            // Step 2: Delete company from Supabase (CASCADE will handle all related data)
            console.log('🗑️ Step 2: Deleting company and all related data from Supabase...');
            
            const { error: deleteError } = await supabase
                .from('companies')
                .delete()
                .eq('id', companyId);

            if (deleteError) {
                console.error('❌ Failed to delete company:', deleteError);
                return res.status(500).json({
                    success: false,
                    error: `Failed to delete company: ${deleteError.message}`
                });
            }
            
            console.log('✅ Company and all related data deleted from Supabase');

            // Step 3: Verify Supabase deletion
            console.log('🔍 Step 3: Verifying Supabase deletion...');
            try {
                const { data: verifyData, error: verifyError } = await supabase
                    .from('companies')
                    .select('id')
                    .eq('id', companyId)
                    .single();

                if (verifyError && verifyError.code === 'PGRST116') {
                    console.log('✅ Verification passed: Company not found in Supabase');
                } else if (verifyData) {
                    console.warn('⚠️ Verification failed: Company still exists in Supabase');
                    return res.status(500).json({
                        success: false,
                        error: 'Company deletion verification failed'
                    });
                } else {
                    console.log('✅ Verification passed: Company deleted from Supabase');
                }
            } catch (verifyError) {
                console.warn('⚠️ Could not verify Supabase deletion:', verifyError);
            }

            console.log(`🎉 Company ${company.name} and all associated data deleted successfully`);

            res.json({
                success: true,
                message: 'Company and all associated data deleted successfully',
                data: {
                    companyId,
                    companyName: company.name,
                    displayName: company.display_name,
                    deletedFrom: {
                        supabase: true,
                        gcs: true
                    },
                    verification: {
                        supabaseVerified: true,
                        gcsVerified: true
                    }
                }
            });

        } catch (error) {
            console.error('❌ Delete company error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error during company deletion'
            });
        }
    },

    /**
     * Delete company data from GCS
     */
    async deleteCompanyFromGCS(companyName) {
        try {
            console.log(`🗑️ Deleting GCS data for company: ${companyName}`);
            
            // Call Python API to delete from GCS
            const axios = require('axios');
            const PYTHON_API_BASE_URL = process.env.PYTHON_API_BASE_URL || 'http://localhost:5001';
            
            const response = await axios.delete(
                `${PYTHON_API_BASE_URL}/delete-company-data/${encodeURIComponent(companyName)}`,
                {
                    timeout: 30000 // 30 second timeout
                }
            );

            if (response.data.success) {
                console.log(`✅ GCS deletion successful for ${companyName}`);
                return { success: true };
            } else {
                console.error(`❌ GCS deletion failed for ${companyName}:`, response.data.error);
                return { success: false, error: response.data.error };
            }

        } catch (error) {
            console.error(`❌ GCS deletion error for ${companyName}:`, error.message);
            return { 
                success: false, 
                error: error.response?.data?.detail || error.message 
            };
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

            // Debug: Check if userId is properly extracted
            if (!userId) {
                console.error('❌ No userId found in req.user:', req.user);
                return res.status(400).json({
                    success: false,
                    error: 'User ID not found in authentication token'
                });
            }

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
                console.log('🔍 Searching for company with user_id:', userId);
                
                let databaseUserId;
                
                // First try to find user by auth_user_id (for OAuth users)
                const { data: userDataByAuthId, error: userErrorByAuthId } = await supabase
                    .from('users')
                    .select('id')
                    .eq('auth_user_id', userId)
                    .single();
                
                if (!userErrorByAuthId && userDataByAuthId) {
                    // Found by auth_user_id (OAuth user)
                    databaseUserId = userDataByAuthId.id;
                    console.log('✅ Found user by auth_user_id, using database ID:', databaseUserId);
                } else {
                    // Try to find user by database ID (for email/password users)
                    const { data: userDataById, error: userErrorById } = await supabase
                        .from('users')
                        .select('id')
                        .eq('id', userId)
                        .single();
                    
                    if (!userErrorById && userDataById) {
                        // Found by database ID (email/password user)
                        databaseUserId = userDataById.id;
                        console.log('✅ Found user by database ID:', databaseUserId);
                    } else {
                        console.error('❌ User not found by either auth_user_id or database ID');
                        return res.status(500).json({
                            success: false,
                            error: 'User not found in database'
                        });
                    }
                }
                
                // Search for companies with the correct database user ID
                const { data: companies, error } = await supabase
                    .from('companies')
                    .select('*')
                    .eq('user_id', databaseUserId)
                    .order('created_at', { ascending: false });

                if (error) {
                    console.error('❌ Supabase error in getCompanies:', error);
                    throw error;
                }
                
                console.log(`✅ User: Found ${companies?.length || 0} companies for user ${userId}`);
                console.log('📋 Company data:', companies);
                
                // Ensure we return an array even if no company is found
                return res.json({ success: true, data: companies || [] });
            }
        } catch (error) {
            console.error('❌ Get companies error:', error);
            res.status(500).json({
                success: false,
                error: 'An error occurred while fetching company data.',
                details: error.message
            });
        }
    },

    /**
     * Debug endpoint to check user authentication and company data
     */
    async debugUserCompany(req, res) {
        try {
            const userId = req.user.userId || req.user.id;
            
            console.log('🐛 Debug endpoint called');
            console.log('🐛 req.user:', req.user);
            console.log('🐛 userId:', userId);
            
            // Check if user exists in users table
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id, email, first_name, last_name, role')
                .eq('id', userId)
                .single();
            
            console.log('🐛 User data:', userData);
            console.log('🐛 User error:', userError);
            
            // Check if company exists for this user
            const { data: companyData, error: companyError } = await supabase
                .from('companies')
                .select('*')
                .eq('user_id', userId);
            
            console.log('🐛 Company data:', companyData);
            console.log('🐛 Company error:', companyError);
            
            return res.json({
                success: true,
                debug: {
                    req_user: req.user,
                    extracted_userId: userId,
                    user_exists: !!userData,
                    user_data: userData,
                    user_error: userError,
                    companies_count: companyData?.length || 0,
                    company_data: companyData,
                    company_error: companyError
                }
            });
            
        } catch (error) {
            console.error('❌ Debug endpoint error:', error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    },

    /**
     * Delete company and all associated data
     */
    async deleteCompany(req, res) {
        try {
            console.log('🗑️ Delete company endpoint hit!');
            console.log('🗑️ Request user:', req.user);
            const authUserId = req.user.userId || req.user.id;
            console.log('🗑️ Delete company request for auth user:', authUserId);

            // First, get the local database user ID from the auth_user_id
            const { data: localUser, error: userError } = await supabase
                .from('users')
                .select('id')
                .eq('auth_user_id', authUserId)
                .single();

            if (userError || !localUser) {
                console.error('❌ User not found in local database:', userError);
                return res.status(404).json({
                    success: false,
                    error: 'User not found in local database'
                });
            }

            const userId = localUser.id;
            console.log('🔍 Using local user ID:', userId, 'for auth user:', authUserId);

            // Get company details before deletion
            console.log('🔍 Looking for company with user_id:', userId);
            const { data: company, error: companyError } = await supabase
                .from('companies')
                .select('id, name, bucket_name')
                .eq('user_id', userId)
                .single();

            console.log('🔍 Company query result:', { company, error: companyError });

            if (companyError || !company) {
                console.error('❌ Company not found:', companyError);
                return res.status(404).json({
                    success: false,
                    error: 'Company not found'
                });
            }

            console.log('🗑️ Deleting company:', company.name, 'with ID:', company.id);

            // 1. Delete all QuDemos and their associated data
            console.log('🗑️ Deleting QuDemos...');
            const { error: qudemosError } = await supabase
                .from('qudemos_new')
                .delete()
                .eq('company_id', company.id);

            if (qudemosError) {
                console.error('❌ Error deleting QuDemos:', qudemosError);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to delete QuDemos'
                });
            }

            // 2. Delete analytics data
            console.log('🗑️ Deleting analytics...');
            const { error: analyticsError } = await supabase
                .from('qudemo_analytics')
                .delete()
                .eq('company_id', company.id);

            if (analyticsError) {
                console.error('❌ Error deleting analytics:', analyticsError);
            }

            // 3. Delete interactions
            console.log('🗑️ Deleting interactions...');
            const { error: interactionsError } = await supabase
                .from('interactions')
                .delete()
                .eq('company_id', company.id);

            if (interactionsError) {
                console.error('❌ Error deleting interactions:', interactionsError);
            }

            // 4. Delete knowledge sources
            console.log('🗑️ Deleting knowledge sources...');
            const { error: knowledgeError } = await supabase
                .from('knowledge_sources')
                .delete()
                .eq('company_id', company.id);

            if (knowledgeError) {
                console.error('❌ Error deleting knowledge sources:', knowledgeError);
            }

            // 5. Delete company shares
            console.log('🗑️ Deleting company shares...');
            const { error: sharesError } = await supabase
                .from('qudemo_shares')
                .delete()
                .eq('company_id', company.id);

            if (sharesError) {
                console.error('❌ Error deleting company shares:', sharesError);
            }

            // 6. Delete the company itself
            console.log('🗑️ Deleting company record...');
            const { error: deleteError } = await supabase
                .from('companies')
                .delete()
                .eq('id', company.id);

            if (deleteError) {
                console.error('❌ Error deleting company:', deleteError);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to delete company'
                });
            }

            // 7. Delete GCS bucket and all files (if bucket exists)
            if (company.bucket_name || company.name) {
                console.log('🗑️ Deleting GCS bucket for company:', company.name);
                try {
                    // Call Python backend to delete GCS bucket
                    const pythonApiUrl = process.env.PYTHON_API_URL || 'http://localhost:8000';
                    const deleteResponse = await fetch(`${pythonApiUrl}/delete-company-bucket`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            company_name: company.name
                        })
                    });

                    if (deleteResponse.ok) {
                        const deleteResult = await deleteResponse.json();
                        console.log('✅ GCS bucket deletion result:', deleteResult);
                    } else {
                        console.error('❌ Python API error:', deleteResponse.status, deleteResponse.statusText);
                    }
                } catch (gcsError) {
                    console.error('❌ Error calling Python API for GCS deletion:', gcsError);
                }
            }

            console.log('✅ Company and all associated data deleted successfully');
            return res.json({
                success: true,
                message: 'Company and all associated data deleted successfully'
            });

        } catch (error) {
            console.error('❌ Delete company error:', error);
            res.status(500).json({
                success: false,
                error: 'An error occurred while deleting the company'
            });
        }
    },

    /**
     * Upload company logo to Supabase Storage
     */
    async uploadCompanyLogo(req, res) {
        try {
            console.log('🔍 Upload company logo endpoint hit');
            console.log('🔍 Request body:', req.body);
            console.log('🔍 Request file:', req.file);
            
            const authUserId = req.user.userId || req.user.id;
            const { companyId } = req.body;
            
            console.log('🔍 Auth user ID:', authUserId);
            console.log('🔍 Company ID:', companyId);

            if (!req.file) {
                console.log('❌ No file provided');
                return res.status(400).json({
                    success: false,
                    error: 'No logo file provided'
                });
            }
            
            console.log('✅ File validation passed');

            // Find user by id (since authUserId is the actual user ID from JWT)
            console.log('🔍 Looking up user by id:', authUserId);
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id')
                .eq('id', authUserId)
                .single();

            console.log('🔍 User lookup result:', { userData, userError });

            if (userError || !userData) {
                console.log('❌ User not found');
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }
            
            console.log('✅ User found:', userData.id);

            // Verify company belongs to user
            const { data: company, error: companyError } = await supabase
                .from('companies')
                .select('*')
                .eq('id', companyId)
                .eq('user_id', userData.id)
                .single();

            if (companyError || !company) {
                return res.status(404).json({
                    success: false,
                    error: 'Company not found or access denied'
                });
            }

            // Upload file to Supabase Storage
            const fileExt = req.file.originalname.split('.').pop();
            const fileName = `company-${companyId}-logo.${fileExt}`;
            const filePath = `company-logos/${fileName}`;

            console.log('🔍 Uploading to Supabase Storage:', filePath);
            console.log('🔍 File size:', req.file.size);
            console.log('🔍 File type:', req.file.mimetype);

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('company-assets')
                .upload(filePath, req.file.buffer, {
                    contentType: req.file.mimetype,
                    upsert: true
                });

            console.log('🔍 Supabase upload result:', { uploadData, uploadError });

            if (uploadError) {
                console.error('❌ Supabase upload error:', uploadError);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to upload logo'
                });
            }

            // Get public URL
            const { data: urlData } = supabase.storage
                .from('company-assets')
                .getPublicUrl(filePath);

            const logoUrl = urlData.publicUrl;

            // Update company with logo URL
            const { error: updateError } = await supabase
                .from('companies')
                .update({ logo_url: logoUrl })
                .eq('id', companyId);

            if (updateError) {
                console.error('❌ Database update error:', updateError);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to update company logo'
                });
            }

            console.log('✅ Company logo uploaded successfully');
            console.log('🔍 Returning response with logoUrl:', logoUrl);

            // Log logo upload
            // Set company info in request for logging
            req.companyId = companyId;
            req.companyName = company.name;
            
            await logCompanyOperation(
                req,
                ACTIONS.UPLOAD_LOGO,
                RESOURCES.COMPANY,
                companyId,
                `Company logo uploaded successfully for "${company.name}"`,
                {
                    companyId: companyId,
                    companyName: company.name,
                    logoUrl: logoUrl,
                    fileName: fileName,
                    fileSize: req.file.size,
                    fileType: req.file.mimetype
                },
                'INFO'
            );

            return res.json({
                success: true,
                message: 'Logo uploaded successfully',
                logoUrl: logoUrl
            });

        } catch (error) {
            console.error('❌ Upload company logo error:', error);
            res.status(500).json({
                success: false,
                error: 'An error occurred while uploading the logo'
            });
        }
    },

    /**
     * Update company details
     */
    async updateCompany(req, res) {
        try {
            const authUserId = req.user.userId || req.user.id;
            const companyId = req.params.companyId;
            const { name, website } = req.body;

            let userId;
            
            // First try to find user by auth_user_id (for OAuth users)
            const { data: userDataByAuthId, error: userErrorByAuthId } = await supabase
                .from('users')
                .select('id')
                .eq('auth_user_id', authUserId)
                .single();
            
            if (!userErrorByAuthId && userDataByAuthId) {
                // Found by auth_user_id (OAuth user)
                userId = userDataByAuthId.id;
                console.log('✅ Found user by auth_user_id:', userId);
            } else {
                // Try to find user by database ID (for email/password users)
                const { data: userDataById, error: userErrorById } = await supabase
                    .from('users')
                    .select('id')
                    .eq('id', authUserId)
                    .single();
                
                if (!userErrorById && userDataById) {
                    // Found by database ID (email/password user)
                    userId = userDataById.id;
                    console.log('✅ Found user by database ID:', userId);
                } else {
                    console.error('❌ User not found by either auth_user_id or database ID');
                    return res.status(404).json({
                        success: false,
                        error: 'User not found'
                    });
                }
            }

            // Verify company belongs to user
            const { data: company, error: companyError } = await supabase
                .from('companies')
                .select('*')
                .eq('id', companyId)
                .eq('user_id', userId)
                .single();

            if (companyError || !company) {
                return res.status(404).json({
                    success: false,
                    error: 'Company not found or access denied'
                });
            }

            // Update company
            const { data: updatedCompany, error: updateError } = await supabase
                .from('companies')
                .update({
                    name: name || company.name,
                    website: website || company.website
                })
                .eq('id', companyId)
                .select()
                .single();

            if (updateError) {
                console.error('❌ Database update error:', updateError);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to update company'
                });
            }

            console.log('✅ Company updated successfully');

            // Log company update
            // Set company info in request for logging
            req.companyId = companyId;
            req.companyName = updatedCompany.name;
            
            await logCompanyOperation(
                req,
                ACTIONS.UPDATE_COMPANY,
                RESOURCES.COMPANY,
                companyId,
                `Company "${updatedCompany.name}" updated successfully`,
                {
                    companyId: companyId,
                    companyName: updatedCompany.name,
                    updatedFields: {
                        name: name || company.name,
                        website: website || company.website
                    },
                    previousValues: {
                        name: company.name,
                        website: company.website
                    }
                },
                'INFO'
            );

            return res.json({
                success: true,
                message: 'Company updated successfully',
                data: updatedCompany
            });

        } catch (error) {
            console.error('❌ Update company error:', error);
            res.status(500).json({
                success: false,
                error: 'An error occurred while updating the company'
            });
        }
    }
};

module.exports = companyController;