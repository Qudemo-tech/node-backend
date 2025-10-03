const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const axios = require('axios');

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const subscriptionController = {
  /**
   * Create checkout session for subscription
   */
  async createCheckout(req, res) {
    try {
      const { plan, billingCycle = 'monthly' } = req.body;
      const authUserId = req.user.userId || req.user.id;

      console.log('🛒 Creating checkout for plan:', plan, 'cycle:', billingCycle);
      console.log('🔍 Auth user ID:', authUserId);
      console.log('🔍 Request body:', req.body);

      // Get user and company info (following the same pattern as companyController)
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
          console.log('❌ User not found in database');
          return res.status(404).json({
            success: false,
            error: 'User not found'
          });
        }
      }

      // Get user's company (handle multiple companies)
      console.log('🔍 Looking for company with user_id:', userId);
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, name')
        .eq('user_id', userId);

      console.log('🔍 Companies lookup result:', { companiesData, companiesError });

      if (companiesError) {
        console.log('❌ Error fetching companies for user_id:', userId);
        return res.status(500).json({
          success: false,
          error: 'Error fetching company data'
        });
      }

      if (!companiesData || companiesData.length === 0) {
        console.log('❌ No companies found for user_id:', userId);
        return res.status(404).json({
          success: false,
          error: 'Company not found'
        });
      }

      // Use the first company (or you could add logic to select the right one)
      const companyData = companiesData[0];
      console.log('✅ Using company:', companyData);

      // Get variant ID based on plan and billing cycle
      const variantKey = `LEMONSQUEEZY_${plan.toUpperCase()}_${billingCycle.toUpperCase()}_VARIANT`;
      const variantId = process.env[variantKey];

      if (!variantId) {
        return res.status(400).json({
          success: false,
          error: `Variant not configured for ${plan} ${billingCycle}`
        });
      }

      // Create checkout session using Lemon Squeezy API
      console.log('🔗 Creating checkout session via API...');
      
      const requestPayload = {
        data: {
          type: 'checkouts',
          attributes: {
            checkout_data: {
              custom: {
                user_id: userId,
                company_id: companyData.id,
                plan: plan,
                billing_cycle: billingCycle
              }
            }
          },
          relationships: {
            store: {
              data: {
                type: 'stores',
                id: process.env.LEMONSQUEEZY_STORE_ID
              }
            },
            variant: {
              data: {
                type: 'variants',
                id: variantId
              }
            }
          }
        }
      };

      const requestHeaders = {
        'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
      };

      console.log('🔗 Lemon Squeezy Request URL:', 'https://api.lemonsqueezy.com/v1/checkouts');
      console.log('🔗 Lemon Squeezy Request Headers:', JSON.stringify(requestHeaders, null, 2));
      console.log('🔗 Lemon Squeezy Request Payload:', JSON.stringify(requestPayload, null, 2));
      
      const checkoutResponse = await axios.post('https://api.lemonsqueezy.com/v1/checkouts', requestPayload, {
        headers: requestHeaders
      });

      console.log('🔗 Lemon Squeezy Response Status:', checkoutResponse.status);
      console.log('🔗 Lemon Squeezy Response Headers:', JSON.stringify(checkoutResponse.headers, null, 2));
      console.log('🔗 Lemon Squeezy Response Data:', JSON.stringify(checkoutResponse.data, null, 2));

      const fullCheckoutUrl = checkoutResponse.data.data.attributes.url;
      console.log('🔗 Generated checkout URL:', fullCheckoutUrl);

      res.json({
        success: true,
        checkoutUrl: fullCheckoutUrl,
        plan,
        billingCycle
      });

    } catch (error) {
      console.error('❌ Error creating checkout:', error);
      
      // Log detailed error information from Lemon Squeezy
      if (error.response) {
        console.error('❌ Lemon Squeezy Error Response Status:', error.response.status);
        console.error('❌ Lemon Squeezy Error Response Headers:', JSON.stringify(error.response.headers, null, 2));
        console.error('❌ Lemon Squeezy Error Response Data:', JSON.stringify(error.response.data, null, 2));
      } else if (error.request) {
        console.error('❌ No response received from Lemon Squeezy:', error.request);
      } else {
        console.error('❌ Request setup error:', error.message);
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to create checkout session',
        details: error.message,
        lemonSqueezyError: error.response?.data || null
      });
    }
  },

  /**
   * Get current subscription status
   */
  async getSubscription(req, res) {
    try {
      const { companyId } = req.params;
      const authUserId = req.user.userId || req.user.id;

      // Get user
      let { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('id', authUserId)
        .single();

      if (userError && userError.code === 'PGRST116') {
        const result = await supabase
          .from('users')
          .select('id')
          .eq('auth_user_id', authUserId)
          .single();
        userData = result.data;
        userError = result.error;
      }

      if (userError) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Get company with subscription info
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .eq('user_id', userData.id)
        .single();

      if (companyError) {
        return res.status(404).json({
          success: false,
          error: 'Company not found or access denied'
        });
      }

      // Get QuDemo counts
      const { count: totalQudemos } = await supabase
        .from('qudemos_new')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('is_active', true);

      const { count: sharedQudemos } = await supabase
        .from('qudemos_new')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('is_shared', true);

      res.json({
        success: true,
        subscription: {
          plan: company.subscription_plan || 'free',
          status: company.subscription_status || 'active',
          subscriptionId: company.subscription_id,
          startDate: company.subscription_start_date,
          endDate: company.subscription_end_date,
          nextBillingDate: company.next_billing_date,
          trialEndDate: company.trial_end_date,
          billingCycle: company.billing_cycle,
          paymentMethodLast4: company.payment_method_last4,
          usage: {
            totalQudemos,
            sharedQudemos
          }
        }
      });

    } catch (error) {
      console.error('❌ Error getting subscription:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get subscription',
        details: error.message
      });
    }
  },

  /**
   * Handle Lemon Squeezy webhooks
   */
  async handleWebhook(req, res) {
    try {
      console.log('🔔 ===== WEBHOOK RECEIVED =====');
      console.log('🔔 Request method:', req.method);
      console.log('🔔 Request URL:', req.url);
      console.log('🔔 Request headers:', JSON.stringify(req.headers, null, 2));
      
      const signature = req.headers['x-signature'];
      
      // req.body is a Buffer when using express.raw()
      const rawBody = req.body.toString('utf8');
      
      console.log('🔔 Webhook signature received:', signature);
      console.log('🔔 Raw body length:', rawBody.length);
      console.log('🔔 Raw body content:', rawBody);
      console.log('🔔 Webhook secret length:', process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.length);

      // Verify webhook signature
      const hmac = crypto.createHmac('sha256', process.env.LEMONSQUEEZY_WEBHOOK_SECRET);
      hmac.update(rawBody);
      const expectedSignature = hmac.digest('hex');

      console.log('🔔 Expected signature:', expectedSignature);
      console.log('🔔 Received signature:', signature);

      if (signature !== expectedSignature) {
        console.error('❌ Invalid webhook signature');
        console.error('❌ Expected:', expectedSignature);
        console.error('❌ Received:', signature);
        return res.status(401).json({
          success: false,
          error: 'Invalid signature'
        });
      }

      // Parse the JSON body
      const event = JSON.parse(rawBody);
      const eventName = event.meta?.event_name;

      console.log('🔔 Parsed event data:', JSON.stringify(event, null, 2));
      console.log('🔔 Event name:', eventName);
      console.log('🔔 Event type:', event.data?.type);
      console.log('🔔 Event ID:', event.data?.id);

      switch (eventName) {
        case 'subscription_created':
          console.log('🔔 Processing subscription_created event...');
          await handleSubscriptionCreated(event);
          break;
        case 'subscription_updated':
          console.log('🔔 Processing subscription_updated event...');
          await handleSubscriptionUpdated(event);
          break;
        case 'subscription_cancelled':
          console.log('🔔 Processing subscription_cancelled event...');
          await handleSubscriptionCancelled(event);
          break;
        case 'subscription_resumed':
          console.log('🔔 Processing subscription_resumed event...');
          await handleSubscriptionResumed(event);
          break;
        case 'subscription_payment_success':
          console.log('🔔 Processing subscription_payment_success event...');
          await handlePaymentSuccess(event);
          break;
        case 'subscription_payment_failed':
          console.log('🔔 Processing subscription_payment_failed event...');
          await handlePaymentFailed(event);
          break;
        default:
          console.log('⚠️ Unhandled webhook event:', eventName);
          console.log('⚠️ Full event data:', JSON.stringify(event, null, 2));
      }

      console.log('🔔 Webhook processing completed successfully');
      res.json({ success: true });

    } catch (error) {
      console.error('❌ Error handling webhook:', error);
      res.status(500).json({
        success: false,
        error: 'Webhook processing failed',
        details: error.message
      });
    }
  },

  /**
   * Cancel subscription
   */
  async cancelSubscription(req, res) {
    try {
      const { companyId } = req.params;
      const authUserId = req.user.userId || req.user.id;

      // Get user
      let { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('id', authUserId)
        .single();

      if (userError && userError.code === 'PGRST116') {
        const result = await supabase
          .from('users')
          .select('id')
          .eq('auth_user_id', authUserId)
          .single();
        userData = result.data;
        userError = result.error;
      }

      if (userError) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Get company
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('subscription_id, lemonsqueezy_customer_id')
        .eq('id', companyId)
        .eq('user_id', userData.id)
        .single();

      if (companyError || !company.subscription_id) {
        return res.status(404).json({
          success: false,
          error: 'No active subscription found'
        });
      }

      // Cancel subscription via Lemon Squeezy API
      const response = await axios.delete(
        `https://api.lemonsqueezy.com/v1/subscriptions/${company.subscription_id}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
            'Accept': 'application/vnd.api+json',
            'Content-Type': 'application/vnd.api+json'
          }
        }
      );

      res.json({
        success: true,
        message: 'Subscription cancelled successfully'
      });

    } catch (error) {
      console.error('❌ Error cancelling subscription:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel subscription',
        details: error.message
      });
    }
  },

  /**
   * Test webhook endpoint (for debugging)
   */
  async testWebhook(req, res) {
    console.log('🔔 ===== WEBHOOK TEST ENDPOINT HIT =====');
    console.log('🔔 Request method:', req.method);
    console.log('🔔 Request URL:', req.url);
    console.log('🔔 Request headers:', JSON.stringify(req.headers, null, 2));
    console.log('🔔 Request body:', req.body);
    
    res.json({
      success: true,
      message: 'Webhook endpoint is reachable',
      timestamp: new Date().toISOString(),
      headers: req.headers,
      body: req.body
    });
  },

  /**
   * Get billing portal URL
   */
  async getBillingPortal(req, res) {
    try {
      const { companyId } = req.params;
      const authUserId = req.user.userId || req.user.id;

      // Get user
      let { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('id', authUserId)
        .single();

      if (userError && userError.code === 'PGRST116') {
        const result = await supabase
          .from('users')
          .select('id')
          .eq('auth_user_id', authUserId)
          .single();
        userData = result.data;
        userError = result.error;
      }

      if (userError) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Get company with subscription details
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('subscription_id, lemonsqueezy_customer_id')
        .eq('id', companyId)
        .eq('user_id', userData.id)
        .single();

      if (companyError || !company.subscription_id) {
        return res.status(404).json({
          success: false,
          error: 'No active subscription found'
        });
      }

      // Get fresh subscription data from Lemon Squeezy API to get customer portal URL
      const subscriptionResponse = await axios.get(
        `https://api.lemonsqueezy.com/v1/subscriptions/${company.subscription_id}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
            'Accept': 'application/vnd.api+json'
          }
        }
      );

      const subscriptionData = subscriptionResponse.data.data.attributes;
      const customerPortalUrl = subscriptionData.urls.customer_portal;

      res.json({
        success: true,
        portalUrl: customerPortalUrl
      });

    } catch (error) {
      console.error('❌ Error getting billing portal:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get billing portal',
        details: error.message
      });
    }
  }
};

// Helper functions for webhook events
async function handleSubscriptionCreated(event) {
  const data = event.data;
  const attributes = data.attributes;
  const customData = attributes.custom_data || {};

  console.log('✅ Subscription created:', data.id);

  const updateData = {
    subscription_id: data.id,
    subscription_plan: customData.plan || 'pro',
    subscription_status: 'active',
    subscription_start_date: attributes.created_at,
    next_billing_date: attributes.renews_at,
    billing_cycle: customData.billing_cycle || 'monthly',
    lemonsqueezy_customer_id: attributes.customer_id
  };

  if (customData.company_id) {
    const { error } = await supabase
      .from('companies')
      .update(updateData)
      .eq('id', customData.company_id);

    if (error) {
      console.error('❌ Error updating company subscription:', error);
    } else {
      console.log('✅ Company subscription updated');
    }
  }
}

async function handleSubscriptionUpdated(event) {
  const data = event.data;
  const attributes = data.attributes;

  console.log('🔄 Subscription updated:', data.id);

  const { data: company, error: findError } = await supabase
    .from('companies')
    .select('id')
    .eq('subscription_id', data.id)
    .single();

  if (findError || !company) {
    console.error('❌ Company not found for subscription:', data.id);
    return;
  }

  const updateData = {
    subscription_status: attributes.status,
    next_billing_date: attributes.renews_at,
    subscription_end_date: attributes.ends_at
  };

  const { error } = await supabase
    .from('companies')
    .update(updateData)
    .eq('id', company.id);

  if (error) {
    console.error('❌ Error updating subscription:', error);
  }
}

async function handleSubscriptionCancelled(event) {
  const data = event.data;
  const attributes = data.attributes;

  console.log('❌ Subscription cancelled:', data.id);

  const { data: company, error: findError } = await supabase
    .from('companies')
    .select('id')
    .eq('subscription_id', data.id)
    .single();

  if (findError || !company) {
    console.error('❌ Company not found for subscription:', data.id);
    return;
  }

  // Update subscription status and disable shares
  const { error: updateError } = await supabase
    .from('companies')
    .update({
      subscription_status: 'cancelled',
      subscription_end_date: attributes.ends_at
    })
    .eq('id', company.id);

  // Disable all shared QuDemos
  const { error: qudemoError } = await supabase
    .from('qudemos_new')
    .update({ is_shared: false })
    .eq('company_id', company.id);

  if (updateError || qudemoError) {
    console.error('❌ Error handling cancellation:', updateError || qudemoError);
  }
}

async function handleSubscriptionResumed(event) {
  const data = event.data;
  const attributes = data.attributes;

  console.log('✅ Subscription resumed:', data.id);

  const { data: company, error: findError } = await supabase
    .from('companies')
    .select('id')
    .eq('subscription_id', data.id)
    .single();

  if (findError || !company) {
    console.error('❌ Company not found for subscription:', data.id);
    return;
  }

  const { error } = await supabase
    .from('companies')
    .update({
      subscription_status: 'active',
      next_billing_date: attributes.renews_at
    })
    .eq('id', company.id);

  if (error) {
    console.error('❌ Error resuming subscription:', error);
  }
}

async function handlePaymentSuccess(event) {
  const data = event.data;
  const attributes = data.attributes;

  console.log('💰 Payment success for subscription:', data.id);

  const { data: company, error: findError } = await supabase
    .from('companies')
    .select('id')
    .eq('subscription_id', data.id)
    .single();

  if (findError || !company) {
    return;
  }

  const { error } = await supabase
    .from('companies')
    .update({
      subscription_status: 'active',
      next_billing_date: attributes.renews_at
    })
    .eq('id', company.id);

  if (error) {
    console.error('❌ Error updating payment success:', error);
  }
}

async function handlePaymentFailed(event) {
  const data = event.data;

  console.log('❌ Payment failed for subscription:', data.id);

  const { data: company, error: findError } = await supabase
    .from('companies')
    .select('id')
    .eq('subscription_id', data.id)
    .single();

  if (findError || !company) {
    return;
  }

  const { error } = await supabase
    .from('companies')
    .update({
      subscription_status: 'past_due'
    })
    .eq('id', company.id);

  if (error) {
    console.error('❌ Error updating payment failed:', error);
  }
}

module.exports = subscriptionController;

