// LiveAvatar Session Creation Route
const express = require('express');
const router = express.Router();

/**
 * Redacts API key for logging
 */
function redactKey(k) {
  if (!k) return '<MISSING>';
  const safe = String(k);
  if (safe.length <= 10) return '***REDACTED***';
  return `${safe.slice(0, 6)}...${safe.slice(-4)} (len=${safe.length})`;
}

/**
 * Safely read response text
 */
async function safeText(resp) {
  try {
    return await resp.text();
  } catch (e) {
    return `<unable to read body: ${String(e)}>`;
  }
}

/**
 * POST /api/liveavatar/create-session
 * Creates a HeyGen LiveAvatar session and returns LiveKit credentials
 */
router.post('/create-session', async (req, res) => {
  console.log('\n' + '='.repeat(80));
  console.log('>>> NEW REQUEST TO create-liveavatar-session <<<');
  console.log('='.repeat(80));

  const heygenApiKey = process.env.HEYGEN_API_KEY;
  const avatarId = process.env.HEYGEN_AVATAR_ID;
  const voiceId = process.env.HEYGEN_VOICE_ID;
  const contextId = process.env.HEYGEN_CONTEXT_ID;

  console.log('\n📋 ENVIRONMENT VARIABLES CHECK:');
  console.log('  HEYGEN_API_KEY:', redactKey(heygenApiKey));
  console.log('  HEYGEN_AVATAR_ID:', avatarId ?? '<MISSING>');
  console.log('  HEYGEN_VOICE_ID:', voiceId ?? '<MISSING>');
  console.log('  HEYGEN_CONTEXT_ID:', contextId ?? '<MISSING>');

  if (!heygenApiKey || !avatarId || !voiceId) {
    console.error('❌ FATAL: Missing required environment variables');
    return res.status(500).json({ 
      success: false,
      error: 'Missing required environment variables (HEYGEN_API_KEY, HEYGEN_AVATAR_ID, HEYGEN_VOICE_ID)' 
    });
  }

  try {
    // --- STEP 1: CREATE SESSION TOKEN ---
    console.log('\n' + '─'.repeat(80));
    console.log('STEP 1: Creating session token');
    console.log('─'.repeat(80));
    
    const tokenUrl = 'https://api.liveavatar.com/v1/sessions/token';
    const tokenPayload = {
      mode: 'FULL',
      avatar_id: avatarId,
      avatar_persona: {
        voice_id: voiceId,
        context_id: contextId,
        language: 'en',
      },
    };

    console.log('📤 REQUEST:');
    console.log('  URL:', tokenUrl);
    console.log('  Payload:', JSON.stringify(tokenPayload, null, 2));

    const tokenOptions = {
      method: 'POST',
      headers: {
        'X-API-KEY': heygenApiKey,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tokenPayload),
    };

    const tokenResp = await fetch(tokenUrl, tokenOptions).catch(e => {
      console.error('❌ FETCH FAILED:', String(e));
      throw new Error('fetch-token-failed: ' + String(e));
    });

    const tokenRespText = await safeText(tokenResp);
    console.log('\n📥 RESPONSE:');
    console.log('  Status:', tokenResp.status, tokenResp.statusText);

    let tokenData = null;
    try {
      tokenData = JSON.parse(tokenRespText);
    } catch (e) {
      console.log('  ⚠️  Body is not valid JSON');
      console.log('  Raw body:', tokenRespText.substring(0, 500));
    }

    if (!tokenResp.ok) {
      console.error('❌ TOKEN REQUEST FAILED');
      return res.status(tokenResp.status || 500).json({
        success: false,
        error: 'Failed to create session token',
        details: tokenData ?? tokenRespText
      });
    }

    const sessionToken = tokenData?.data?.session_token;
    const sessionId = tokenData?.data?.session_id;

    if (!sessionToken || !sessionId) {
      console.error('❌ MALFORMED TOKEN RESPONSE');
      return res.status(500).json({
        success: false,
        error: 'Malformed token response',
        details: tokenData ?? tokenRespText
      });
    }

    console.log('✅ Session token created successfully');
    console.log('  Session ID:', sessionId);

    // --- STEP 2: START SESSION ---
    console.log('\n' + '─'.repeat(80));
    console.log('STEP 2: Starting session');
    console.log('─'.repeat(80));

    const startUrl = 'https://api.liveavatar.com/v1/sessions/start';
    const startPayload = { session_id: sessionId };

    const startOptions = {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify(startPayload),
    };

    const startResp = await fetch(startUrl, startOptions).catch(e => {
      console.error('❌ FETCH FAILED:', String(e));
      throw new Error('fetch-start-failed: ' + String(e));
    });

    const startRespText = await safeText(startResp);
    console.log('\n📥 RESPONSE:');
    console.log('  Status:', startResp.status, startResp.statusText);

    let startData = null;
    try {
      startData = JSON.parse(startRespText);
    } catch (e) {
      console.log('  ⚠️  Body is not valid JSON');
      console.log('  Raw body:', startRespText.substring(0, 500));
    }

    if (!startResp.ok) {
      console.error('❌ START REQUEST FAILED');
      return res.status(startResp.status || 500).json({
        success: false,
        error: 'Failed to start session',
        details: startData ?? startRespText
      });
    }

    // Extract livekit info
    const livekitUrl = startData?.data?.livekit_url ?? startData?.livekit_url ?? null;
    const livekitClientToken = startData?.data?.livekit_client_token ?? startData?.livekit_client_token ?? null;

    if (!livekitUrl || !livekitClientToken) {
      console.warn('⚠️  START SUCCEEDED BUT MISSING LIVEKIT INFO');
      return res.status(200).json({
        success: true,
        data: {
          sessionId,
          sessionToken,
          warning: 'startSucceededButNoLivekitInfo'
        },
        startData
      });
    }

    console.log('\n✅ SUCCESS - Returning LiveKit credentials');
    console.log('='.repeat(80));

    return res.status(200).json({
      success: true,
      data: {
        sessionId,
        sessionToken,
        livekitUrl,
        livekitClientToken
      }
    });

  } catch (err) {
    console.error('\n❌ EXCEPTION IN HANDLER');
    console.error(err);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: err instanceof Error ? err.message : String(err)
    });
  }
});

module.exports = router;

