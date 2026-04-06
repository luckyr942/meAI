const express = require('express');
const { Jobs } = require('../config/db');

const jobsRouter = express.Router();

/**
 * GET /api/jobs
 * Fetches all parsed job applications for the CRM dashboard.
 */
jobsRouter.get('/', (req, res) => {
  try {
    const jobs = Jobs.findAll();
    // Map SQLite column names to match the frontend expectations
    const data = jobs.map(j => ({
      _id: j.id,
      company: j.company,
      role: j.role,
      status: j.status,
      platform: j.platform,
      action_required: !!j.action_required,
      sourceEmailId: j.source_email_id,
      createdAt: j.created_at,
      updatedAt: j.updated_at,
    }));
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Error fetching jobs:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch job applications.' });
  }
});

/**
 * POST /api/jobs/sync-history
 * Triggers the worker to scrape the legacy inbox history for job applications.
 */
jobsRouter.post('/sync-history', async (req, res) => {
  try {
    const { jobQueue } = require('../engine/jobQueue');
    await jobQueue.add('historical-sync', { emailAddress: 'me' });
    res.json({ success: true, message: 'Historical Sync Job successfully dispatched!' });
  } catch (error) {
    console.error('❌ Error dispatching history sync:', error.message);
    res.status(500).json({ success: false, error: 'Failed to start historical sync.' });
  }
});

module.exports = { jobsRouter };
