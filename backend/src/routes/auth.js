const express = require('express');
const { getAuthUrl, getTokens, oauth2Client } = require('../services/gmailAuth');
const { google } = require('googleapis');

const authRouter = express.Router();

// ── GET /auth/google ─────────────────────────────────────
// Redirects the user to Google's OAuth consent screen
authRouter.get('/google', (req, res) => {
  const url = getAuthUrl();
  console.log('🔗 Redirecting to Google Auth URL:', url);
  res.redirect(url);
});

// ── GET /auth/callback ───────────────────────────────────
// Google redirects back here with the authorization code
authRouter.get('/callback', async (req, res) => {
  const code = req.query.code;
  
  if (!code) {
    return res.status(400).send('❌ Authentication failed! No code returned.');
  }

  try {
    const tokens = await getTokens(code);
    
    // NOTE: In Phase 2, we will save this refresh token securely to MongoDB
    // attached to a User model so the background worker can use it 24/7.
    // For MVP Phase 1 testing, we'll log it (since it's a single-user system initially)
    console.log('✅ Successfully acquired Google Tokens!');
    console.log('Access Token:', tokens.access_token);
    console.log('Refresh Token:', tokens.refresh_token);

    res.send(`
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>✅ Google Integration Successful!</h2>
        <p>MeAI is now authorized to monitor your inbox for job updates.</p>
        <p>You can close this window and return to your dashboard.</p>
      </div>
    `);

    // Optionally: Start Gmail Watch immediately after auth
    // const { watchInbox } = require('../services/gmailWatch');
    // await watchInbox();
    
  } catch (error) {
    console.error('❌ Google Auth Error:', error.message);
    res.status(500).send('Authentication Error: ' + error.message);
  }
});

module.exports = { authRouter };
