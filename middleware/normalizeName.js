module.exports = function normalizeName(req, _res, next) {
  const b = req.body || {};
  
  // Prefer Google-provided fields if you have them in the payload
  if (!b.authProvider && b.oauthProvider) b.authProvider = b.oauthProvider;

  // Clean trailing periods on initials: "R." -> "R"
  if (typeof b.firstName === 'string') {
    b.firstName = b.firstName.trim().replace(/\s+/g, ' ');
  }
  if (typeof b.lastName === 'string') {
    b.lastName = b.lastName.trim().replace(/\.$/, '');
    if (b.lastName === '') b.lastName = null;
  }

  // If Google's family_name is missing/short, keep an initial separately
  if (b.authProvider === 'google' || b.isGoogleUser) {
    if (!b.lastName || b.lastName.length < 2) {
      b.lastNameInitial = b.lastName || null;
      // Allow null for Google users
      b.lastName = b.lastName && b.lastName.length ? b.lastName : null;
    }
  }

  // Compute a safe displayName for UI
  if (!b.displayName) {
    const parts = [b.firstName, b.lastName || b.lastNameInitial].filter(Boolean);
    b.displayName = parts.join(' ').trim() || null;
  }

  req.body = b;
  next();
};
