/**
 * Tavus API Controller
 * Handles Tavus CVI conversation management
 */

/**
 * Create a Tavus CVI conversation
 * POST /api/tavus/create-conversation
 */
const createConversation = async (req, res) => {
  try {
    console.log('\n========================================');
    console.log('📱 TAVUS CONVERSATION REQUEST');
    console.log('========================================');

    const {
      userId = 'default-user',
      personaId,
      customGreeting,
      conversationalContext,
      language = 'english'
    } = req.body;

    console.log('User ID:', userId);
    console.log('Persona ID from request:', personaId);
    console.log('Request method:', req.method);

    // Get Tavus API key from environment
    const TAVUS_API_KEY = process.env.TAVUS_API_KEY;

    // Use persona_id from request body, fall back to env var if not provided
    const TAVUS_PERSONA_ID = personaId || process.env.TAVUS_PERSONA_ID;

    if (!TAVUS_API_KEY) {
      console.error('❌ Missing TAVUS_API_KEY environment variable');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error',
        message: 'Missing Tavus API key'
      });
    }

    if (!TAVUS_PERSONA_ID) {
      console.error('❌ Missing persona_id in request and no TAVUS_PERSONA_ID env var');
      return res.status(400).json({
        success: false,
        error: 'Bad request',
        message: 'Missing persona_id - provide it in URL path (/v2-avatar/:personaId) or set TAVUS_PERSONA_ID env var'
      });
    }

    console.log('✅ API Key found:', TAVUS_API_KEY ? `${TAVUS_API_KEY.substring(0, 8)}...` : 'undefined');
    console.log('✅ Using Persona ID:', TAVUS_PERSONA_ID);

    // Build request payload
    const payload = {
      persona_id: TAVUS_PERSONA_ID,
      properties: {
        language: language
      }
    };

    // Add optional fields if provided
    if (customGreeting) {
      payload.custom_greeting = customGreeting;
    }
    if (conversationalContext) {
      payload.conversational_context = conversationalContext;
    }

    console.log('\n🚀 Creating Tavus conversation...');
    console.log('Payload:', JSON.stringify(payload, null, 2));

    // Create conversation via Tavus API
    const response = await fetch('https://tavusapi.com/v2/conversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TAVUS_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Tavus API error:', response.status, errorData);
      return res.status(response.status).json({
        success: false,
        error: 'Failed to create conversation',
        details: errorData,
      });
    }

    const data = await response.json();

    console.log('✅ Conversation created successfully');
    console.log('   Conversation ID:', data.conversation_id);
    console.log('   Conversation URL:', data.conversation_url ? `${data.conversation_url.substring(0, 40)}...` : 'MISSING');
    console.log('   Status:', data.status);

    if (!data.conversation_url) {
      console.error('❌ Missing conversation_url in response:', data);
      return res.status(500).json({
        success: false,
        error: 'Malformed response',
        message: 'Missing conversation_url (Daily.co room URL)',
        details: data,
      });
    }

    // Return conversation data
    return res.status(200).json({
      success: true,
      conversationId: data.conversation_id,
      conversationName: data.conversation_name,
      conversationUrl: data.conversation_url,  // Daily.co room URL
      status: data.status,
      createdAt: data.created_at,
      _backend: 'node-backend',
    });

  } catch (error) {
    console.error('Error creating Tavus conversation:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * End a Tavus CVI conversation
 * POST /api/tavus/end-conversation
 */
const endConversation = async (req, res) => {
  try {
    console.log('\n========================================');
    console.log('📱 TAVUS END CONVERSATION REQUEST');
    console.log('========================================');
    console.log('Content-Type:', req.headers['content-type']);

    // Parse body - handle both regular JSON and sendBeacon requests
    // sendBeacon with Blob may come as text/plain or application/json
    let body = req.body;

    // If body is a string (text/plain from sendBeacon), try to parse it as JSON
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
        console.log('Parsed string body as JSON');
      } catch (e) {
        console.error('Failed to parse body as JSON:', e.message);
      }
    }

    const { conversationId } = body || {};

    if (!conversationId) {
      console.error('❌ Missing conversationId in request body');
      return res.status(400).json({
        success: false,
        error: 'Bad request',
        message: 'Missing conversationId'
      });
    }

    console.log('Conversation ID:', conversationId);

    // Get Tavus API key from environment
    const TAVUS_API_KEY = process.env.TAVUS_API_KEY;

    if (!TAVUS_API_KEY) {
      console.error('❌ Missing TAVUS_API_KEY environment variable');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error',
        message: 'Missing Tavus API key'
      });
    }

    console.log('✅ API Key found:', TAVUS_API_KEY ? `${TAVUS_API_KEY.substring(0, 8)}...` : 'undefined');

    console.log('\n🛑 Ending Tavus conversation...');

    // End conversation via Tavus API
    const response = await fetch(`https://tavusapi.com/v2/conversations/${conversationId}/end`, {
      method: 'POST',
      headers: {
        'x-api-key': TAVUS_API_KEY,
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Tavus API error:', response.status, errorData);

      // If conversation already ended or not found, treat as success
      if (response.status === 404 || response.status === 400) {
        console.log('⚠️ Conversation may already be ended or not found - treating as success');
        return res.status(200).json({
          success: true,
          conversationId,
          message: 'Conversation ended (or already ended)',
        });
      }

      return res.status(response.status).json({
        success: false,
        error: 'Failed to end conversation',
        details: errorData,
      });
    }

    console.log('✅ Conversation ended successfully');

    return res.status(200).json({
      success: true,
      conversationId,
      message: 'Conversation ended successfully',
    });

  } catch (error) {
    console.error('Error ending Tavus conversation:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Cleanup all active Tavus conversations
 * POST /api/tavus/cleanup-all-sessions
 */
const cleanupAllSessions = async (req, res) => {
  try {
    console.log('\n========================================');
    console.log('🧹 TAVUS CLEANUP ALL SESSIONS REQUEST');
    console.log('========================================');

    // Get Tavus API key from environment
    const TAVUS_API_KEY = process.env.TAVUS_API_KEY;

    if (!TAVUS_API_KEY) {
      console.error('❌ Missing TAVUS_API_KEY environment variable');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error',
        message: 'Missing Tavus API key'
      });
    }

    console.log('✅ API Key found:', TAVUS_API_KEY ? `${TAVUS_API_KEY.substring(0, 8)}...` : 'undefined');

    // Optional: filter by persona_id from request body
    const { personaId } = req.body || {};
    console.log('Persona ID filter:', personaId || 'none (all personas)');

    console.log('\n📋 Fetching all conversations...');

    // List all conversations
    const listResponse = await fetch('https://tavusapi.com/v2/conversations', {
      method: 'GET',
      headers: {
        'x-api-key': TAVUS_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!listResponse.ok) {
      const errorData = await listResponse.text();
      console.error('❌ Failed to list conversations:', listResponse.status, errorData);
      return res.status(500).json({
        success: false,
        error: 'Failed to list conversations',
        details: errorData,
      });
    }

    const listData = await listResponse.json();
    const conversations = listData.data || listData || [];

    console.log(`📊 Found ${conversations.length} total conversations`);

    // Filter to active conversations only (and optionally by persona)
    const activeConversations = conversations.filter(c => {
      const isActive = c.status === 'active' || c.status === 'in_progress';
      const matchesPersona = !personaId || c.persona_id === personaId;
      return isActive && matchesPersona;
    });

    console.log(`🔍 Found ${activeConversations.length} active conversations to clean up`);

    if (activeConversations.length === 0) {
      console.log('✅ No active conversations to clean up');
      return res.status(200).json({
        success: true,
        message: 'No active conversations to clean up',
        ended: 0,
        total: conversations.length,
      });
    }

    // End all active conversations
    const results = await Promise.allSettled(
      activeConversations.map(async (conversation) => {
        const conversationId = conversation.conversation_id;
        console.log(`🛑 Ending conversation: ${conversationId}`);

        try {
          const endResponse = await fetch(`https://tavusapi.com/v2/conversations/${conversationId}/end`, {
            method: 'POST',
            headers: {
              'x-api-key': TAVUS_API_KEY,
            },
          });

          if (endResponse.ok || endResponse.status === 404 || endResponse.status === 400) {
            // 404/400 means already ended - that's fine
            console.log(`✅ Ended conversation: ${conversationId}`);
            return { conversationId, success: true };
          } else {
            const errorData = await endResponse.text();
            console.error(`❌ Failed to end ${conversationId}:`, errorData);
            return { conversationId, success: false, error: errorData };
          }
        } catch (e) {
          console.error(`❌ Error ending ${conversationId}:`, e.message);
          return { conversationId, success: false, error: e.message };
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    console.log(`\n📊 Cleanup complete: ${successful} ended, ${failed} failed`);

    return res.status(200).json({
      success: true,
      message: `Cleaned up ${successful} conversation(s)`,
      ended: successful,
      failed: failed,
      total: conversations.length,
      details: results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason }),
    });

  } catch (error) {
    console.error('Error in cleanup-all-sessions:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
};

module.exports = {
  createConversation,
  endConversation,
  cleanupAllSessions,
};
