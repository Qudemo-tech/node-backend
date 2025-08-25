const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const { generateToken, verifyRefreshToken } = require('../middleware/auth');

const authController = {
    /**
     * Register a new user
     */
    async register(req, res) {
        try {
            const { email, password, firstName, lastName, companyName, role = 'user' } = req.body;

            // Check if user already exists
            const { data: existingUser, error: checkError } = await supabase
                .from('users')
                .select('id')
                .eq('email', email)
                .single();

            if (checkError && checkError.code !== 'PGRST116') {
                return res.status(500).json({
                    success: false,
                    error: 'Error checking user existence'
                });
            }

            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    error: 'User with this email already exists'
                });
            }

            // Hash password
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // Create user
            const { data: user, error: insertError } = await supabase
                .from('users')
                .insert({
                    email,
                    password_hash: hashedPassword,
                    first_name: firstName,
                    last_name: lastName,
                    role,
                    is_active: true,
                    created_at: new Date().toISOString()
                })
                .select('id, email, first_name, last_name, role')
                .single();

            if (insertError) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to create user'
                });
            }

            // If company name is provided, create company and link user
            if (companyName) {
                try {
                    // Check if company exists
                    const { data: existingCompany, error: companyCheckError } = await supabase
                        .from('companies')
                        .select('id, name')
                        .eq('name', companyName)
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
                                name: companyName,
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
                .update({ refresh_token: refreshToken })
                .eq('id', user.id);

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
            const { email, password } = req.body;

            // Get user with password hash
            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
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

            // Verify password
            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            if (!isValidPassword) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid email or password'
                });
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
            const { data: user, error } = await supabase
                .from('users')
                .select('id, email, first_name, last_name, role, created_at')
                .eq('id', req.user.userId)
                .single();

            if (error) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch profile'
                });
            }

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

            updateData.updated_at = new Date().toISOString();

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
                    password_hash: hashedPassword,
                    updated_at: new Date().toISOString()
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
                    reset_token_expires: null,
                    updated_at: new Date().toISOString()
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