const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const jwksClient = require('jwks-rsa');

const SUPABASE_JWKS_URI = `${process.env.SUPABASE_URL || 'https://placeholder.supabase.co'}/auth/v1/keys`;

const client = jwksClient({
  jwksUri: SUPABASE_JWKS_URI,
  cache: true,
  rateLimit: true,
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, function (err, key) {
    if (err) {
      callback(err);
    } else {
      const signingKey = key.getPublicKey();
      callback(null, signingKey);
    }
  });
}

/**
 * Verify JWT token middleware
 */
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        console.error('❌ No token provided');
        return res.status(401).json({ success: false, error: 'No token provided' });
    }

    try {
        console.log('🔍 Auth middleware: Received token length:', token ? token.length : 0);
        console.log('🔍 Auth middleware: Token starts with:', token ? token.substring(0, 20) + '...' : 'No token');
        
        // Check if this is our own JWT token (not a Supabase token)
        // Our JWT tokens are signed with our secret and have specific structure
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded.userId && decoded.sub) {
                console.log('✅ Local JWT verified for user:', decoded.userId);
                req.user = {
                    userId: decoded.userId,
                    role: decoded.role || 'user',
                    sub: decoded.sub,
                    iat: decoded.iat,
                    exp: decoded.exp,
                    id: decoded.userId // For compatibility
                };
                console.log('🔍 Auth middleware: Set req.user (JWT):', req.user);
                return next();
            }
        } catch (jwtError) {
            console.log('🔍 Not a local JWT token, trying Supabase verification...');
        }
        
        // Try to verify with Supabase (for OAuth users)
        const { data: { user: supabaseUser }, error: supabaseError } = await supabase.auth.getUser(token);
        
        if (!supabaseError && supabaseUser) {
            console.log('✅ Supabase token verified for user:', supabaseUser.id);
            req.user = {
                userId: supabaseUser.id,
                email: supabaseUser.email,
                role: 'user' // Default role for OAuth users
            };
            console.log('🔍 Auth middleware: Set req.user:', req.user);
            return next();
        } else {
            console.log('❌ Supabase verification failed:', supabaseError);
            console.error('❌ Both Supabase and local JWT verification failed');
            return res.status(403).json({ success: false, error: 'Invalid token' });
        }

    } catch (error) {
        console.error('❌ Token verification error:', error.message);
        return res.status(403).json({ success: false, error: 'Invalid token' });
    }
};

/**
 * Role-based access control middleware
 */
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        const userRole = req.user.role;
        
        if (Array.isArray(roles)) {
            if (!roles.includes(userRole)) {
                return res.status(403).json({
                    success: false,
                    error: 'Insufficient permissions'
                });
            }
        } else {
            if (userRole !== roles) {
                return res.status(403).json({
                    success: false,
                    error: 'Insufficient permissions'
                });
            }
        }

        next();
    };
};

/**
 * Company access control middleware
 */
const requireCompanyAccess = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        const companyName = req.params.companyName || req.body.companyName;
        
        if (!companyName) {
            return res.status(400).json({
                success: false,
                error: 'Company name is required'
            });
        }

        // Admin can access all companies
        if (req.user.role === 'admin') {
            return next();
        }

        // Check if user has access to this company
        const { data: userCompany, error } = await supabase
            .from('companies')
            .select('id, name, user_id')
            .eq('user_id', req.user.id)
            .eq('name', companyName)
            .single();

        if (error || !userCompany) {
            return res.status(403).json({
                success: false,
                error: 'Access denied to this company'
            });
        }

        // Add company info to request
        req.userCompany = userCompany;
        next();

    } catch (error) {
        console.error('Company access middleware error:', error);
        return res.status(500).json({
            success: false,
            error: 'Authorization error'
        });
    }
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', decoded.userId)
                .single();

            if (!error && user && user.is_active) {
                req.user = user;
            }
        }

        next();

    } catch (error) {
        // Continue without authentication
        next();
    }
};

/**
 * Generate JWT token
 */
const generateToken = (userId, role) => {
    return jwt.sign(
        { 
            userId, 
            role,
            sub: userId, // Add sub claim for Supabase compatibility
            iat: Math.floor(Date.now() / 1000)
        },
        process.env.JWT_SECRET,
        { 
            expiresIn: process.env.JWT_EXPIRES_IN || '7d' 
        }
    );
};

/**
 * Verify refresh token
 */
const verifyRefreshToken = async (refreshToken) => {
    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
        
        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, role, refresh_token')
            .eq('id', decoded.userId)
            .single();

        if (error || !user || user.refresh_token !== refreshToken) {
            throw new Error('Invalid refresh token');
        }

        return user;

    } catch (error) {
        throw error;
    }
};

module.exports = {
    authenticateToken,
    requireRole,
    requireCompanyAccess,
    optionalAuth,
    generateToken,
    verifyRefreshToken
}; 