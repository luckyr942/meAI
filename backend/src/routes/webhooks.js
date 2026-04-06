const express = require('express');
const { jobQueue } = require('../engine/jobQueue');

const webhookRouter = express.Router();

/**
 * POST /api/webhooks/gmail
 * Google Cloud Pub/Sub will hit this endpoint when a new email arrives in the inbox.
 */
webhookRouter.post('/gmail', async (req, res) => {
  // Acknowledge receipt to Google as quickly as possible (must be within 10s)
  res.status(200).send('OK');

  try {
    const pubSubMessage = req.body.message;
    if (!pubSubMessage || !pubSubMessage.data) return;

    // Decode the base64 message from Google Pub/Sub
    const decodedData = Buffer.from(pubSubMessage.data, 'base64').toString('utf8');
    const data = JSON.parse(decodedData);

    const emailAddress = data.emailAddress;
    const historyId = data.historyId;

    if (!emailAddress) return;

    console.log(`📩 New Gmail Event Detected for ${emailAddress} [History ID: ${historyId}]`);

    // Dispatch to the local in-process queue
    await jobQueue.add('fetch-and-parse-email', { emailAddress, historyId });

  } catch (error) {
    console.error('❌ Webhook Processing Error:', error.message);
  }
});

module.exports = { webhookRouter };
