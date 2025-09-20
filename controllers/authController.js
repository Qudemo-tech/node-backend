const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Debug Supabase configuration
console.log('🔍 Supabase URL:', process.env.SUPABASE_URL ? 'Set' : 'Not set');
console.log('🔍 Supabase Service Role Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Not set');
const { generateToken, verifyRefreshToken } = require('../middleware/auth');

const authController = {
    /**
     * Register a new user
     */
    async register(req, res) {
        try {
            let { 
                email, 
                password, 
                firstName, 
                lastName, 
                lastNameInitial, 
                displayName, 
                authProvider, 
                companyName, 
                role = 'user', 
                isGoogleUser = false 
            } = req.body;

            // Check if Supabase is configured
            if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
                console.log('❌ Supabase not configured - using fallback registration');
                return res.status(500).json({
                    success: false,
                    error: 'Database not configured. Please contact administrator.'
                });
            }

            console.log('🔍 Register request body:', { 
                email, 
                firstName, 
                lastName, 
                lastNameInitial, 
                displayName, 
                authProvider, 
                isGoogleUser, 
                hasPassword: !!password 
            });

            // Normalize email
            const normalizedEmail = (email || '').trim().toLowerCase();
            if (!normalizedEmail) {
                return res.status(400).json({ success: false, error: 'Email is required' });
            }

            // Determine if user needs profile completion
            const needsProfileCompletion = !lastName || lastName.length < 2;

            // For Google OAuth users, check by auth_user_id instead of email
            if (isGoogleUser) {
                console.log('🔍 Google user - skipping email check, will check by auth_user_id later');
            } else {
                // Check if user already exists (by normalized email) for non-Google users
                let existingUser = null;
                try {
                    console.log('🔍 Checking for existing user with email:', normalizedEmail);
                    const { data, error: checkError } = await supabase
                        .from('users')
                        .select('id')
                        .eq('email', normalizedEmail)
                        .single();

                    existingUser = data;
                    console.log('🔍 Existing user check result:', { existingUser, checkError });

                    if (checkError && checkError.code !== 'PGRST116') {
                        console.log('❌ Error checking user existence:', checkError);
                        return res.status(500).json({
                            success: false,
                            error: 'Database connection error. Please try again.'
                        });
                    }
                } catch (fetchError) {
                    console.error('❌ Supabase fetch error:', fetchError);
                    return res.status(500).json({
                        success: false,
                        error: 'Database connection failed. Please check server configuration.'
                    });
                }

                if (existingUser) {
                    console.log('❌ User already exists with email:', normalizedEmail);
                    return res.status(400).json({
                        success: false,
                        error: 'User with this email already exists'
                    });
                }
            }

            console.log('✅ No existing user found, proceeding with user creation');

            // Handle password for non-Google users
            let hashedPassword = null;
            if (!isGoogleUser) {
                console.log('🔍 Non-Google user, checking password');
                if (!password) {
                    console.log('❌ Password required for non-Google users');
                    return res.status(400).json({ success: false, error: 'Password is required for non-Google users' });
                }
                // Validate password strength for non-Google users
                const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
                if (!passwordRegex.test(password)) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character' 
                    });
                }
                const saltRounds = 12;
                hashedPassword = await bcrypt.hash(password, saltRounds);
            }

            // For regular email/password registration, we don't need authUserId
            // For Google OAuth, authUserId would come from the token
            let authUserId = null;
            if (isGoogleUser && req.user?.userId) {
                authUserId = req.user.userId;
                console.log('🔍 Google user auth ID:', authUserId);
            } else if (!isGoogleUser) {
                console.log('✅ Regular email/password registration - no auth ID needed');
            }

            // Check if user already exists (duplicate protection)
            let duplicateUser = null;
            let duplicateCheckError = null;
            
            if (authUserId) {
                // For Google users, check by auth_user_id
                const result = await supabase
                    .from('users')
                    .select('id, email, auth_user_id')
                    .eq('auth_user_id', authUserId)
                    .single();
                duplicateUser = result.data;
                duplicateCheckError = result.error;
            } else {
                // For regular users, check by email
                const result = await supabase
                    .from('users')
                    .select('id, email, auth_user_id')
                    .eq('email', normalizedEmail)
                    .single();
                duplicateUser = result.data;
                duplicateCheckError = result.error;
            }

            console.log('🔍 Duplicate user check result:', { duplicateUser, duplicateCheckError });

               if (duplicateUser && !duplicateCheckError) {
                   console.log('✅ User already exists, checking if needs Google linking...');
                   
                   // If this is a Google user but the existing user isn't linked to Google
                   if (isGoogleUser && !duplicateUser.auth_user_id) {
                       console.log('🔗 Linking existing user to Google account...');
                       
                       // Update the existing user with Google auth_user_id
                       const updateData = {
                           auth_user_id: authUserId,
                           auth_provider: 'google',
                           needs_profile_completion: needsProfileCompletion,
                           is_active: true,
                           updated_at: new Date().toISOString()
                       };
                       
                       const { data: updatedUser, error: updateError } = await supabase
                           .from('users')
                           .update(updateData)
                           .eq('id', duplicateUser.id)
                           .select('id, email, first_name, last_name, role, auth_user_id')
                           .single();
                           
                       if (updateError) {
                           console.error('❌ Error linking user to Google:', updateError);
                           return res.status(500).json({ success: false, error: 'Error linking user to Google account' });
                       }
                       
                       console.log('✅ User linked to Google successfully:', updatedUser.id);
                       
                       // Generate tokens for the linked user using DATABASE ID
                       const accessToken = generateToken(updatedUser.id, updatedUser.role);
                       const refreshToken = jwt.sign(
                           { userId: updatedUser.id },
                           process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
                           { expiresIn: '30d' }
                       );
                       
                       // Store refresh token
                       await supabase
                           .from('users')
                           .update({ refresh_token: refreshToken })
                           .eq('id', updatedUser.id);
                       
                       return res.status(200).json({
                           success: true,
                           message: 'User linked to Google account successfully',
                           data: { 
                               user: updatedUser, 
                               tokens: { accessToken, refreshToken }
                           }
                       });
                   }
                   
                   // If user already exists and is properly linked, return existing user
                   console.log('✅ User already exists and properly linked:', duplicateUser.id);
                   const accessToken = generateToken(duplicateUser.id, duplicateUser.role);
                   const refreshToken = jwt.sign(
                       { userId: duplicateUser.id },
                       process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
                       { expiresIn: '30d' }
                   );
                   
                   return res.status(200).json({
                       success: true,
                       message: 'User already exists',
                       data: { 
                           user: duplicateUser, 
                           tokens: { accessToken, refreshToken }
                       }
                   });
               }

            console.log('✅ No duplicate user found, proceeding with user creation');

            // Create user with normalized email
            const userData = {
                auth_user_id: authUserId || null, // Link to Supabase user (null for regular users)
                email: normalizedEmail,
                first_name: firstName,
                last_name: lastName,
                last_name_initial: lastNameInitial,
                display_name: displayName || firstName,
                auth_provider: authProvider || (isGoogleUser ? 'google' : 'password'),
                needs_profile_completion: needsProfileCompletion,
                role,
                is_active: true,
                created_at: new Date().toISOString()
            };

            // Only add password_hash for non-Google users
            if (hashedPassword) {
                userData.password_hash = hashedPassword;
            } else {
                userData.password_hash = null; // Explicitly set to null for OAuth users
            }

            console.log('🔍 Inserting user data:', userData);
            console.log('🔍 Auth user ID type:', typeof authUserId, 'Value:', authUserId);

            const { data: user, error: insertError } = await supabase
                .from('users')
                .insert(userData)
                .select('id, email, first_name, last_name, role')
                .single();

            if (insertError) {
                console.error('❌ User creation error:', insertError);
                console.error('❌ Error code:', insertError.code);
                console.error('❌ Error message:', insertError.message);
                console.error('❌ Error details:', insertError.details);
                
                // Handle unique constraint violations (user already exists)
                if (insertError.code === '23505') {
                    console.log('🔄 Email already exists, updating existing user with new auth_user_id');
                    console.log('🔄 Email:', normalizedEmail);
                    console.log('🔄 Auth user ID:', authUserId);
                    
                    // For Google OAuth users, update the existing user with the new auth_user_id
                    if (isGoogleUser) {
                        const updateData = {
                            auth_user_id: authUserId,
                            auth_provider: 'google',
                            first_name: firstName,
                            last_name: lastName,
                            last_name_initial: lastNameInitial,
                            display_name: displayName || firstName,
                            needs_profile_completion: needsProfileCompletion
                        };
                        
                        // Only add updated_at if the column exists (check schema first)
                        try {
                            const { data: updatedUser, error: updateError } = await supabase
                                .from('users')
                                .update(updateData)
                                .eq('email', normalizedEmail)
                                .select('id, email, first_name, last_name, role')
                                .single();

                            if (updateError) {
                                console.error('❌ Failed to update existing user:', updateError);
                                return res.status(500).json({
                                    success: false,
                                    error: 'Failed to update existing user',
                                    details: updateError.message
                                });
                            }

                            console.log('✅ Updated existing user with new auth_user_id:', updatedUser.id);
                            
                            return res.status(200).json({
                                success: true,
                                message: 'Google user linked to existing account',
                                data: {
                                    user: {
                                        id: updatedUser.id,
                                        email: updatedUser.email,
                                        firstName: updatedUser.first_name,
                                        lastName: updatedUser.last_name,
                                        role: updatedUser.role
                                    }
                                }
                            });
                        } catch (updateError) {
                            console.error('❌ Update failed, trying without updated_at:', updateError);
                            
                            // Try again without updated_at field
                            const { data: updatedUser, error: updateError2 } = await supabase
                                .from('users')
                                .update(updateData)
                                .eq('email', normalizedEmail)
                                .select('id, email, first_name, last_name, role')
                                .single();

                            if (updateError2) {
                                console.error('❌ Failed to update existing user (second attempt):', updateError2);
                                return res.status(500).json({
                                    success: false,
                                    error: 'Failed to update existing user',
                                    details: updateError2.message
                                });
                            }

                            console.log('✅ Updated existing user (without updated_at):', updatedUser.id);
                            
                            return res.status(200).json({
                                success: true,
                                message: 'Google user linked to existing account',
                                data: {
                                    user: {
                                        id: updatedUser.id,
                                        email: updatedUser.email,
                                        firstName: updatedUser.first_name,
                                        lastName: updatedUser.last_name,
                                        role: updatedUser.role
                                    }
                                }
                            });
                        }
                    } else {
                        return res.status(409).json({
                            success: false,
                            error: 'User already exists',
                            details: 'A user with this email already exists'
                        });
                    }
                }
                
                return res.status(500).json({
                    success: false,
                    error: 'Failed to create user',
                    details: insertError.message
                });
            }

            console.log('✅ User created successfully:', user);
            console.log('✅ User ID:', user.id);

            // If company name is provided, create company and link user
            if (companyName) {
                try {
                    const normalizedCompany = companyName.trim();
                    // Check if company exists
                    const { data: existingCompany, error: companyCheckError } = await supabase
                        .from('companies')
                        .select('id, name')
                        .eq('name', normalizedCompany)
                        .single();

                    if (companyCheckError && companyCheckError.code !== 'PGRST116') {
                        throw new Error('Error checking company existence');
                    }

                    if (existingCompany) {
                        // Link user to existing company
                        await supabase
                            .from('user_companies')
                            .insert({
                                user_id: user.id,
                                company_id: existingCompany.id,
                                role: 'company_admin',
                                created_at: new Date().toISOString()
                            });
                    } else {
                        // Create new company (without GCS bucket)
                        const { data: company, error: companyError } = await supabase
                            .from('companies')
                            .insert({
                                name: normalizedCompany,
                                is_active: true,
                                created_at: new Date().toISOString()
                            })
                            .select('id, name')
                            .single();

                        if (companyError) {
                            throw new Error('Failed to create company');
                        }

                        // Link user to new company
                        await supabase
                            .from('user_companies')
                            .insert({
                                user_id: user.id,
                                company_id: company.id,
                                role: 'company_admin',
                                created_at: new Date().toISOString()
                            });
                    }
                } catch (error) {
                    console.error('Error creating/linking company:', error);
                    // Continue with user creation even if company creation fails
                }
            }

            // Generate tokens for all users (both Google OAuth and regular users)
            const accessToken = generateToken(user.id, user.role);
            const refreshToken = jwt.sign(
                { userId: user.id },
                process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
                { expiresIn: '30d' }
            );

            // Store refresh token
            await supabase
                .from('users')
                .update({ refresh_token: refreshToken })
                .eq('id', user.id);

            if (isGoogleUser) {
                // For Google OAuth users, return local tokens for consistency
                res.status(201).json({
                    success: true,
                    message: 'Google user registered successfully',
                    data: {
                        user: {
                            id: user.id,
                            email: user.email,
                            firstName: user.first_name,
                            lastName: user.last_name,
                            role: user.role
                        },
                        tokens: {
                            accessToken,
                            refreshToken
                        }
                    }
                });
            } else {
                // For regular users, return the same tokens
                res.status(201).json({
                    success: true,
                    message: 'User registered successfully',
                    data: {
                        user: {
                            id: user.id,
                            email: user.email,
                            firstName: user.first_name,
                            lastName: user.last_name,
                            role: user.role
                        },
                        tokens: {
                            accessToken,
                            refreshToken
                        }
                    }
                });
            }

        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    },

    /**
     * Login user
     */
    async login(req, res) {
        try {
            let { email, password, isGoogleUser = false } = req.body;

            // Normalize email
            const normalizedEmail = (email || '').trim().toLowerCase();
            if (!normalizedEmail) {
                return res.status(400).json({ success: false, error: 'Email is required' });
            }

            // Get user with password hash using normalized email
            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .eq('email', normalizedEmail)
                .single();

            if (error || !user) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid email or password'
                });
            }

            if (!user.is_active) {
                return res.status(401).json({
                    success: false,
                    error: 'Account is deactivated'
                });
            }

            // For Google OAuth users, skip password verification
            if (!isGoogleUser) {
                // Verify password for regular users
                const isValidPassword = await bcrypt.compare(password, user.password_hash);
                if (!isValidPassword) {
                    return res.status(401).json({
                        success: false,
                        error: 'Invalid email or password'
                    });
                }
            }

            // Generate tokens
            const accessToken = generateToken(user.id, user.role);
            const refreshToken = jwt.sign(
                { userId: user.id },
                process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
                { expiresIn: '30d' }
            );

            // Store refresh token
            await supabase
                .from('users')
                .update({ 
                    refresh_token: refreshToken,
                    last_login: new Date().toISOString()
                })
                .eq('id', user.id);

            res.json({
                success: true,
                message: 'Login successful',
                data: {
                    user: {
                        id: user.id,
                        email: user.email,
                        firstName: user.first_name,
                        lastName: user.last_name,
                        role: user.role
                    },
                    tokens: {
                        accessToken,
                        refreshToken
                    }
                }
            });

        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    },

    /**
     * Refresh access token
     */
    async refreshToken(req, res) {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                return res.status(400).json({
                    success: false,
                    error: 'Refresh token is required'
                });
            }

            // Verify refresh token
            const user = await verifyRefreshToken(refreshToken);

            // Generate new access token
            const accessToken = generateToken(user.id, user.role);

            res.json({
                success: true,
                data: {
                    accessToken
                }
            });

        } catch (error) {
            console.error('Token refresh error:', error);
            res.status(401).json({
                success: false,
                error: 'Invalid refresh token'
            });
        }
    },

    /**
     * Logout user
     */
    async logout(req, res) {
        try {
            const { refreshToken } = req.body;

            if (refreshToken) {
                // Invalidate refresh token
                await supabase
                    .from('users')
                    .update({ refresh_token: null })
                    .eq('refresh_token', refreshToken);
            }

            res.json({
                success: true,
                message: 'Logout successful'
            });

        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    },

    /**
     * Get current user profile
     */
    async getProfile(req, res) {
        try {
            console.log('🔍 getProfile: Auth user ID from token:', req.user.userId);
            
            // First try to find user by Database ID (for local JWT tokens)
            let { data: user, error } = await supabase
                .from('users')
                .select('id, email, first_name, last_name, last_name_initial, display_name, auth_provider, needs_profile_completion, role, created_at')
                .eq('id', req.user.userId)
                .single();

            console.log('🔍 getProfile: Database query result (by id):', { user, error });

            // If not found by ID, try by auth_user_id (for Supabase tokens)
            if (error && error.code === 'PGRST116') {
                console.log('🔍 getProfile: Not found by ID, trying auth_user_id...');
                const result = await supabase
                    .from('users')
                    .select('id, email, first_name, last_name, last_name_initial, display_name, auth_provider, needs_profile_completion, role, created_at')
                    .eq('auth_user_id', req.user.userId)
                    .single();
                
                user = result.data;
                error = result.error;
                console.log('🔍 getProfile: Database query result (by auth_user_id):', { user, error });
            }

            if (error) {
                console.error('❌ getProfile: Database error:', error);
                // Handle "user not found" case specifically
                if (error.code === 'PGRST116') {
                    console.log('❌ getProfile: User not found in database');
                    return res.status(404).json({
                        success: false,
                        error: 'User not found'
                    });
                }
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch profile',
                    details: error.message
                });
            }

            if (!user) {
                console.log('❌ getProfile: User not found in database');
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            console.log('✅ getProfile: User found:', user.id);
            res.json({
                success: true,
                data: user
            });

        } catch (error) {
            console.error('Get profile error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    },

    /**
     * Update user profile
     */
    async updateProfile(req, res) {
        try {
            const { firstName, lastName, avatar, preferences } = req.body;

            const updateData = {};
            if (firstName) updateData.first_name = firstName;
            if (lastName) updateData.last_name = lastName;
            if (avatar) updateData.avatar = avatar;
            if (preferences) updateData.preferences = preferences;

            // Note: updated_at field removed as it doesn't exist in the database schema

            const { data: user, error } = await supabase
                .from('users')
                .update(updateData)
                .eq('id', req.user.id)
                .select('id, email, first_name, last_name, role, avatar, preferences')
                .single();

            if (error) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to update profile'
                });
            }

            res.json({
                success: true,
                message: 'Profile updated successfully',
                data: user
            });

        } catch (error) {
            console.error('Update profile error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    },

    /**
     * Change password
     */
    async changePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;

            // Get current password hash
            const { data: user, error } = await supabase
                .from('users')
                .select('password_hash')
                .eq('id', req.user.id)
                .single();

            if (error) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch user'
                });
            }

            // Verify current password
            const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
            if (!isValidPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'Current password is incorrect'
                });
            }

            // Hash new password
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

            // Update password
            await supabase
                .from('users')
                .update({ 
                    password_hash: hashedPassword
                    // Note: updated_at field removed as it doesn't exist in the database schema
                })
                .eq('id', req.user.id);

            res.json({
                success: true,
                message: 'Password changed successfully'
            });

        } catch (error) {
            console.error('Change password error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    },

    /**
     * Request password reset
     */
    async requestPasswordReset(req, res) {
        try {
            const { email } = req.body;

            // Check if user exists
            const { data: user, error } = await supabase
                .from('users')
                .select('id, email')
                .eq('email', email)
                .single();

            if (error || !user) {
                // Don't reveal if email exists or not
                return res.json({
                    success: true,
                    message: 'If the email exists, a password reset link has been sent'
                });
            }

            // Generate reset token
            const resetToken = jwt.sign(
                { userId: user.id, type: 'reset' },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            // Store reset token
            await supabase
                .from('users')
                .update({ 
                    reset_token: resetToken,
                    reset_token_expires: new Date(Date.now() + 3600000).toISOString() // 1 hour
                })
                .eq('id', user.id);

            // TODO: Send email with reset link
            // For now, just return the token (in production, send via email)
            res.json({
                success: true,
                message: 'Password reset link sent',
                data: {
                    resetToken // Remove this in production
                }
            });

        } catch (error) {
            console.error('Password reset request error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    },

    /**
     * Reset password with token
     */
    async resetPassword(req, res) {
        try {
            const { token, password } = req.body;

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            if (decoded.type !== 'reset') {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid reset token'
                });
            }

            // Check if token is expired
            const { data: user, error } = await supabase
                .from('users')
                .select('id, reset_token_expires')
                .eq('id', decoded.userId)
                .eq('reset_token', token)
                .single();

            if (error || !user) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid or expired reset token'
                });
            }

            if (new Date() > new Date(user.reset_token_expires)) {
                return res.status(400).json({
                    success: false,
                    error: 'Reset token has expired'
                });
            }

            // Hash new password
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // Update password and clear reset token
            await supabase
                .from('users')
                .update({ 
                    password_hash: hashedPassword,
                    reset_token: null,
                    reset_token_expires: null
                    // Note: updated_at field removed as it doesn't exist in the database schema
                })
                .eq('id', decoded.userId);

            res.json({
                success: true,
                message: 'Password reset successfully'
            });

        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(400).json({
                    success: false,
                    error: 'Reset token has expired'
                });
            } else if (error.name === 'JsonWebTokenError') {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid reset token'
                });
            }

            console.error('Password reset error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }
};

module.exports = authController; 