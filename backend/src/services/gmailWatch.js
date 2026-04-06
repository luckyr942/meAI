const { google } = require('googleapis');
const { oauth2Client } = require('./gmailAuth');

// The Topic Name that must be created in Google Cloud Platform
// It routes notifications from Gmail to our Webhook URL
const TOPIC_NAME = 'projects/PLACEHOLDER_PROJECT_ID/topics/meai-gmail-push';

/**
 * Commands Google to start watching the authenticated user's inbox.
 * Any new email will trigger a push notification to our Webhook.
 */
async function startWatching() {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  
  try {
    const res = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName: TOPIC_NAME,
        labelIds: ['INBOX'], // we only care about new emails landing in the inbox
        labelFilterAction: 'include',
      },
    });

    console.log('📡 Gmail Watch Started successfully!', res.data);
    return res.data;
  } catch (error) {
    console.error('❌ Failed to start Gmail watch. Did you create the Google Cloud Pub/Sub topic?', error.message);
    throw error;
  }
}

/**
 * Commands Google to stop sending push notifications
 */
async function stopWatching() {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  try {
    await gmail.users.stop({ userId: 'me' });
    console.log('🛑 Stopped Gmail Watch.');
  } catch (error) {
    console.error('❌ Failed to stop Gmail watch.', error.message);
  }
}

module.exports = {
  startWatching,
  stopWatching,
};
