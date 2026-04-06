const express = require('express');
const { Finance } = require('../config/db');

const financeRouter = express.Router();

/**
 * GET /api/finance
 * Gets all financial transactions.
 */
financeRouter.get('/', (req, res) => {
  try {
    const transactions = Finance.findAll();
    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error('❌ Error fetching finance:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch finance data.' });
  }
});

/**
 * GET /api/finance/summary
 * Gets monthly breakdown + total spent.
 */
financeRouter.get('/summary', (req, res) => {
  try {
    const breakdown = Finance.getMonthlyBreakdown();
    const totalSpent = Finance.getTotalSpent(30);
    res.json({ success: true, data: { breakdown, totalSpent } });
  } catch (error) {
    console.error('❌ Error fetching finance summary:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch finance summary.' });
  }
});

/**
 * POST /api/finance/sync-history
 * Triggers the worker to scrape financial emails.
 */
financeRouter.post('/sync-history', async (req, res) => {
  try {
    const { jobQueue } = require('../engine/jobQueue');
    await jobQueue.add('finance-historical-sync', { emailAddress: 'me' });
    res.json({ success: true, message: 'Finance Sync dispatched!' });
  } catch (error) {
    console.error('❌ Error dispatching finance sync:', error.message);
    res.status(500).json({ success: false, error: 'Failed to start finance sync.' });
  }
});

module.exports = { financeRouter };
