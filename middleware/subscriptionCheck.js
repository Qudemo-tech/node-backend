const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Check if company has an active subscription
 */
const checkSubscription = async (req, res, next) => {
  try {
    const { companyId } = req.params || req.query || req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'Company ID required'
      });
    }

    // Get company subscription status
    const { data: company, error } = await supabase
      .from('companies')
      .select('subscription_plan, subscription_status')
      .eq('id', companyId)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    req.subscription = {
      plan: company.subscription_plan || 'free',
      status: company.subscription_status || 'active',
      isActive: ['active', 'trialing', 'on_trial'].includes(company.subscription_status || 'active'),
      isPro: ['pro', 'enterprise'].includes(company.subscription_plan || 'free'),
      isEnterprise: company.subscription_plan === 'enterprise'
    };

    next();
  } catch (error) {
    console.error('❌ Subscription check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check subscription'
    });
  }
};

/**
 * Require Pro or Enterprise plan
 */
const requirePro = async (req, res, next) => {
  try {
    const { companyId } = req.params || req.query || req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'Company ID required'
      });
    }

    const { data: company, error } = await supabase
      .from('companies')
      .select('subscription_plan, subscription_status')
      .eq('id', companyId)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    const plan = company.subscription_plan || 'free';
    const status = company.subscription_status || 'active';
    const isPro = ['pro', 'enterprise'].includes(plan);
    const isActive = ['active', 'trialing', 'on_trial'].includes(status);

    if (!isPro || !isActive) {
      return res.status(403).json({
        success: false,
        error: 'Pro or Enterprise plan required',
        requiresUpgrade: true,
        currentPlan: plan,
        subscriptionStatus: status
      });
    }

    req.subscription = {
      plan,
      status,
      isActive,
      isPro,
      isEnterprise: plan === 'enterprise'
    };

    next();
  } catch (error) {
    console.error('❌ Pro check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify subscription'
    });
  }
};

/**
 * Require Enterprise plan
 */
const requireEnterprise = async (req, res, next) => {
  try {
    const { companyId } = req.params || req.query || req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'Company ID required'
      });
    }

    const { data: company, error } = await supabase
      .from('companies')
      .select('subscription_plan, subscription_status')
      .eq('id', companyId)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    const plan = company.subscription_plan || 'free';
    const status = company.subscription_status || 'active';
    const isEnterprise = plan === 'enterprise';
    const isActive = ['active', 'trialing', 'on_trial'].includes(status);

    if (!isEnterprise || !isActive) {
      return res.status(403).json({
        success: false,
        error: 'Enterprise plan required',
        requiresUpgrade: true,
        currentPlan: plan,
        subscriptionStatus: status
      });
    }

    req.subscription = {
      plan,
      status,
      isActive,
      isPro: true,
      isEnterprise: true
    };

    next();
  } catch (error) {
    console.error('❌ Enterprise check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify subscription'
    });
  }
};

/**
 * Check subscription and attach to request (non-blocking)
 */
const attachSubscription = async (req, res, next) => {
  try {
    const { companyId } = req.params || req.query || req.body;

    if (!companyId) {
      req.subscription = {
        plan: 'free',
        status: 'active',
        isActive: true,
        isPro: false,
        isEnterprise: false
      };
      return next();
    }

    const { data: company, error } = await supabase
      .from('companies')
      .select('subscription_plan, subscription_status')
      .eq('id', companyId)
      .single();

    if (error || !company) {
      req.subscription = {
        plan: 'free',
        status: 'active',
        isActive: true,
        isPro: false,
        isEnterprise: false
      };
      return next();
    }

    req.subscription = {
      plan: company.subscription_plan || 'free',
      status: company.subscription_status || 'active',
      isActive: ['active', 'trialing', 'on_trial'].includes(company.subscription_status || 'active'),
      isPro: ['pro', 'enterprise'].includes(company.subscription_plan || 'free'),
      isEnterprise: company.subscription_plan === 'enterprise'
    };

    next();
  } catch (error) {
    console.error('❌ Attach subscription error:', error);
    req.subscription = {
      plan: 'free',
      status: 'active',
      isActive: true,
      isPro: false,
      isEnterprise: false
    };
    next();
  }
};

module.exports = {
  checkSubscription,
  requirePro,
  requireEnterprise,
  attachSubscription
};

