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
      
      const checkoutResponse = await axios.post('https://api.lemonsqueezy.com/v1/checkouts', {
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
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
          'Accept': 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
        }
      });

      const fullCheckoutUrl = checkoutResponse.data.data.attributes.url;
      const checkoutId = checkoutResponse.data.data.id;
      
      console.log('🔗 Generated checkout URL:', fullCheckoutUrl);
      console.log('🔗 Checkout ID:', checkoutId);

      // Store the checkout ID temporarily to link with the customer later
      // This helps us track the checkout session
      console.log('🔍 Checkout created with custom data:', {
        user_id: userId,
        company_id: companyData.id,
        plan: plan,
        billing_cycle: billingCycle
      });

      res.json({
        success: true,
        checkoutUrl: fullCheckoutUrl,
        plan,
        billingCycle,
        checkoutId: checkoutId
      });

    } catch (error) {
      console.error('❌ Error creating checkout:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create checkout session',
        details: error.message
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
      const signature = req.headers['x-signature'];
      
      // req.body is a Buffer when using express.raw()
      const rawBody = req.body.toString('utf8');
      
      console.log('🔔 Webhook signature received:', signature);
      console.log('🔔 Raw body length:', rawBody.length);
      console.log('🔔 Webhook secret length:', process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.length);
      console.log("Secret from env:", process.env.LEMONSQUEEZY_WEBHOOK_SECRET);
      console.log("Signature header:", signature);

      // Verify webhook signature
      const hmac = crypto.createHmac('sha256', process.env.LEMONSQUEEZY_WEBHOOK_SECRET);
      hmac.update(rawBody);
      const expectedSignature = hmac.digest('hex');

      console.log('🔔 Expected signature:', expectedSignature);
      console.log('🔔 Received signature:', signature);
      console.log("Expected signature:", expectedSignature);

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

      console.log('🔔 Webhook received:', eventName);
      console.log('🔔 Full webhook payload:', JSON.stringify(event, null, 2));

      switch (eventName) {
        case 'subscription_created':
          await handleSubscriptionCreated(event);
          break;
        case 'subscription_updated':
          await handleSubscriptionUpdated(event);
          break;
        case 'subscription_cancelled':
          await handleSubscriptionCancelled(event);
          break;
        case 'subscription_resumed':
          await handleSubscriptionResumed(event);
          break;
        case 'subscription_payment_success':
          await handlePaymentSuccess(event);
          break;
        case 'subscription_payment_failed':
          await handlePaymentFailed(event);
          break;
        default:
          console.log('⚠️ Unhandled webhook event:', eventName);
      }

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

      if (companyError) {
        return res.status(404).json({
          success: false,
          error: 'Company not found'
        });
      }

      // Check if this is a real Lemon Squeezy subscription or manually created
      if (company.lemonsqueezy_customer_id && company.subscription_id) {
        // This is a real Lemon Squeezy subscription - cancel via API
        try {
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
        } catch (lsError) {
          console.error('❌ Lemon Squeezy API error:', lsError.response?.status, lsError.response?.data);
          return res.status(500).json({
            success: false,
            error: 'Failed to cancel subscription with payment provider'
          });
        }
      } else {
        // This is a manually created subscription - just update the database
        const { error: updateError } = await supabase
          .from('companies')
          .update({
            subscription_status: 'cancelled',
            subscription_end_date: new Date().toISOString(),
            subscription_id: null,
            lemonsqueezy_customer_id: null
          })
          .eq('id', companyId);

        if (updateError) {
          console.error('❌ Database update error:', updateError);
          return res.status(500).json({
            success: false,
            error: 'Failed to cancel subscription'
          });
        }

        res.json({
          success: true,
          message: 'Subscription cancelled successfully'
        });
      }

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
   * Get billing portal URL
   */
  async getBillingPortal(req, res) {
    try {
      console.log('🔍 Billing portal request for company:', req.params.companyId);
      const { companyId } = req.params;
      const authUserId = req.user.userId || req.user.id;
      console.log('🔍 Auth user ID:', authUserId);

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

      console.log('🔍 Company data:', { company, companyError });

      if (companyError) {
        console.log('❌ Company error:', companyError);
        return res.status(404).json({
          success: false,
          error: 'Company not found'
        });
      }

      if (!company.subscription_id) {
        console.log('❌ No subscription ID found');
        return res.status(404).json({
          success: false,
          error: 'No active subscription found'
        });
      }

      // Get fresh subscription data from Lemon Squeezy API to get customer portal URL
      console.log('🔍 Fetching subscription from Lemon Squeezy:', company.subscription_id);
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
      console.log('🔍 Customer portal URL:', customerPortalUrl);

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
  
  // Check multiple possible locations for custom data
  let customData = attributes.custom_data || {};
  
  // Also check if custom data is in meta
  if (event.meta && event.meta.custom_data) {
    customData = { ...customData, ...event.meta.custom_data };
  }
  
  // Check if custom data is directly in attributes
  if (attributes.custom) {
    customData = { ...customData, ...attributes.custom };
  }

  console.log('✅ Subscription created:', data.id);
  console.log('🔍 Custom data from attributes:', attributes.custom_data);
  console.log('🔍 Custom data from meta:', event.meta?.custom_data);
  console.log('🔍 Custom data from attributes.custom:', attributes.custom);
  console.log('🔍 Final custom data:', customData);
  console.log('🔍 Customer ID:', attributes.customer_id);

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
    console.log('🔍 Updating company:', customData.company_id, 'with data:', updateData);
    
    const { error } = await supabase
      .from('companies')
      .update(updateData)
      .eq('id', customData.company_id);

    if (error) {
      console.error('❌ Error updating company subscription:', error);
    } else {
      console.log('✅ Company subscription updated');
    }
  } else {
    console.error('❌ No company_id in custom_data');
    console.log('🔍 Attempting to find company by customer_id:', attributes.customer_id);
    
    // Fallback 1: Try to find company by customer_id
    let { data: company, error: findError } = await supabase
      .from('companies')
      .select('id, lemonsqueezy_customer_id, user_id')
      .eq('lemonsqueezy_customer_id', attributes.customer_id)
      .single();

    if (company && !findError) {
      console.log('🔍 Found company by customer_id:', company.id);
    } else {
      console.log('🔍 No company found by customer_id, trying to find by user email...');
      
      // Fallback 2: Try to find company by user email
      if (attributes.user_email) {
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('email', attributes.user_email)
          .single();
        
        if (userData) {
          console.log('🔍 Found user by email:', userData.id);
          const { data: companiesData } = await supabase
            .from('companies')
            .select('id, user_id')
            .eq('user_id', userData.id)
            .limit(1);
          
          if (companiesData && companiesData.length > 0) {
            company = companiesData[0];
            console.log('🔍 Found company by user email:', company.id);
          }
        }
      }
    }

    if (company) {
      const { error: updateError } = await supabase
        .from('companies')
        .update(updateData)
        .eq('id', company.id);

      if (updateError) {
        console.error('❌ Error updating company:', updateError);
      } else {
        console.log('✅ Company subscription updated successfully');
      }
    } else {
      console.error('❌ Could not find company by any method');
      console.log('🔍 Available data for debugging:');
      console.log('   - Customer ID:', attributes.customer_id);
      console.log('   - User Email:', attributes.user_email);
      console.log('   - Subscription ID:', data.id);
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

