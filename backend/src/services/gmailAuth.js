const { google } = require('googleapis');
const { config } = require('../config');
const fs = require('fs');
const path = require('path');

// Path to persist tokens so they survive server restarts
const TOKEN_PATH = path.resolve(__dirname, '../../.gmail-tokens.json');

// Initialize Google OAuth2 Client
const oauth2Client = new google.auth.OAuth2(
  config.GOOGLE_CLIENT_ID,
  config.GOOGLE_CLIENT_SECRET,
  config.GOOGLE_REDIRECT_URI
);

// ── Scopes ────────────────────────────────────────────────
// gmail.readonly: Read job application emails
// gmail.modify:   Mark processed emails as read (removes UNREAD label)
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
];

/**
 * On startup, try to load previously saved tokens from disk.
 * This means you only need to auth ONCE, and restarts won't wipe the session.
 */
function loadSavedTokens() {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const raw = fs.readFileSync(TOKEN_PATH, 'utf8');
      const tokens = JSON.parse(raw);
      oauth2Client.setCredentials(tokens);
      console.log('🔑 Loaded saved Google tokens from disk (no re-auth needed!)');
      return true;
    }
  } catch (err) {
    console.warn('⚠️ Could not load saved tokens:', err.message);
  }
  return false;
}

/**
 * Save tokens to disk so they persist across restarts.
 */
function saveTokens(tokens) {
  try {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    console.log('💾 Google tokens saved to disk for persistence.');
  } catch (err) {
    console.error('❌ Failed to save tokens:', err.message);
  }
}

/**
 * Returns the URL that the user needs to visit to authorize MeAI
 */
function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
}

/**
 * Exchanges the code returned from Google for an access + refresh token.
 * Automatically persists tokens to disk.
 */
async function getTokens(code) {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  saveTokens(tokens);
  return tokens;
}

// Automatically load tokens on module initialization
loadSavedTokens();

module.exports = {
  oauth2Client,
  getAuthUrl,
  getTokens,
  loadSavedTokens,
};
