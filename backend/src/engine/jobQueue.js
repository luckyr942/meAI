/**
 * MeAI Job Queue Worker
 * Uses the local in-process queue (no Redis) and SQLite (no MongoDB).
 */

const { google } = require('googleapis');
const { oauth2Client } = require('../services/gmailAuth');
const { parseJobEmail } = require('./jobParser');
const { Jobs, ProcessedEmails } = require('../config/db');
const { LocalQueue } = require('./localQueue');

// Initialize the local queue
const jobQueue = new LocalQueue('email-processing');

// ── Historical Sync Handler ─────────────────────────────
jobQueue.process('historical-sync', async (job) => {
  console.log(`[Worker] Starting Bulk Historical Sync...`);
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const query = 'subject:application OR subject:applied OR subject:interview OR subject:rejected OR subject:offer OR from:linkedin.com OR from:wellfound.com OR from:workday.com OR from:greenhouse.io OR from:naukri.com OR from:instahyre.com OR from:internshala.com';

  const res = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 100,
  });

  const messages = res.data.messages || [];
  console.log(`[Worker] Found ${messages.length} historical emails matching criteria. Queueing...`);

  let queuedCount = 0;
  for (const msg of messages) {
    await jobQueue.add('parse-historical-email', { messageId: msg.id }, {
      delay: queuedCount * 800, // Slightly more spacing for free API tiers
      attempts: 3,
    });
    queuedCount++;
  }
  console.log(`[Worker] Successfully dispatched ${queuedCount} historical jobs!`);
});

// ── Parse Single Historical Email ───────────────────────
jobQueue.process('parse-historical-email', async (job) => {
  const { messageId } = job.data;
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Check if already processed (in either jobs or processed_emails table)
  if (Jobs.findByEmailId(messageId) || ProcessedEmails.isProcessed(messageId, 'jobs')) {
    console.log(`[Worker] Skipping already-processed email ${messageId}`);
    return;
  }

  const fullMsg = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  let emailBody = extractEmailBody(fullMsg.data.payload);

  console.log(`[Worker] Analyzing: ${fullMsg.data.snippet?.substring(0, 60)}...`);
  const parsedData = await parseJobEmail(emailBody);

  if (parsedData.status && parsedData.status !== 'Unknown' && parsedData.company) {
    console.log(`[Worker] ✅ Extracted: ${parsedData.company} — ${parsedData.role} (${parsedData.status})`);

    Jobs.create({
      company: parsedData.company,
      role: parsedData.role || 'Unknown Role',
      status: parsedData.status,
      platform: parsedData.platform || 'Other',
      action_required: parsedData.action_required,
      sourceEmailId: messageId,
    });
  } else {
    // Mark as processed even if not a job email, so we don't re-parse it
    ProcessedEmails.markProcessed(messageId, 'jobs');
  }
});

// ── Webhook Handler (Real-time new emails) ──────────────
jobQueue.process('fetch-and-parse-email', async (job) => {
  const { emailAddress, historyId } = job.data;
  console.log(`[Worker] Processing Gmail History ID: ${historyId} for ${emailAddress}`);
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread category:primary',
    maxResults: 5,
  });

  const messages = res.data.messages || [];
  for (const msg of messages) {
    if (Jobs.findByEmailId(msg.id)) continue;

    const fullMsg = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
    let emailBody = extractEmailBody(fullMsg.data.payload);

    const parsedData = await parseJobEmail(emailBody);
    if (parsedData.status && parsedData.status !== 'Unknown' && parsedData.company) {
      console.log(`[Worker] Webhook extracted: ${parsedData.company}`);
      Jobs.create({
        company: parsedData.company,
        role: parsedData.role || 'Unknown Role',
        status: parsedData.status,
        platform: parsedData.platform || 'Other',
        action_required: parsedData.action_required,
        sourceEmailId: msg.id,
      });
      await gmail.users.messages.modify({
        userId: 'me',
        id: msg.id,
        requestBody: { removeLabelIds: ['UNREAD'] },
      });
    }
  }
});

// ── Finance Email Parser ────────────────────────────────
jobQueue.process('parse-finance-email', async (job) => {
  const { messageId } = job.data;
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const { Finance, ProcessedEmails } = require('../config/db');

  if (ProcessedEmails.isProcessed(messageId, 'finance')) {
    return;
  }

  const fullMsg = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
  let emailBody = extractEmailBody(fullMsg.data.payload);

  // Use AI to extract transaction data
  const { parseFinanceEmail } = require('./financeParser');
  const parsed = await parseFinanceEmail(emailBody);

  if (parsed && parsed.amount) {
    console.log(`[Worker] 💰 Finance: ₹${parsed.amount} at ${parsed.merchant} (${parsed.category})`);
    Finance.create({
      amount: parsed.amount,
      merchant: parsed.merchant,
      category: parsed.category,
      type: parsed.type || 'debit',
      sourceEmailId: messageId,
      transaction_date: parsed.date,
    });
  }
  ProcessedEmails.markProcessed(messageId, 'finance');
});

// ── Finance History Sync ────────────────────────────────
jobQueue.process('finance-historical-sync', async (job) => {
  console.log(`[Worker] Starting Finance Historical Sync...`);
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const query = 'from:paytm.com OR from:phonepe OR from:gpay OR from:hdfcbank.com OR from:sbi.co.in OR from:icicibank.com OR subject:transaction OR subject:payment OR subject:debited OR subject:credited';

  const res = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 100,
  });

  const messages = res.data.messages || [];
  console.log(`[Worker] Found ${messages.length} finance-related emails. Queueing...`);

  let count = 0;
  for (const msg of messages) {
    await jobQueue.add('parse-finance-email', { messageId: msg.id }, {
      delay: count * 800,
      attempts: 3,
    });
    count++;
  }
  console.log(`[Worker] Dispatched ${count} finance parsing jobs!`);
});

// ── Helper: Extract email body from Gmail payload ───────
function extractEmailBody(payload) {
  if (payload.parts) {
    const part = payload.parts.find(p => p.mimeType === 'text/plain') || payload.parts[0];
    if (part?.body?.data) return Buffer.from(part.body.data, 'base64').toString('utf8');
  }
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf8');
  }
  return '';
}

module.exports = { jobQueue };
