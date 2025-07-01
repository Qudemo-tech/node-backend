const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const jwksClient = require('jwks-rsa');

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SUPABASE_JWKS_URI = `${process.env.SUPABASE_URL}/auth/v1/keys`;

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
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    // Try to verify with your own secret first (for email/password users)
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (!err) {
            req.user = user;
            return next();
        }

        // If that fails, try to verify with Supabase JWKS (for Google users)
        jwt.verify(token, getKey, { algorithms: ['RS256'] }, (err, decoded) => {
            if (err) {
                return res.status(403).json({ error: 'Invalid token' });
            }
            req.user = decoded;
            next();
        });
    });
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
            .from('user_companies')
            .select('company_id, role')
            .eq('user_id', req.user.id)
            .eq('company_name', companyName)
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