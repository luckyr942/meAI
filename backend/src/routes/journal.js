const express = require('express');
const { Journal } = require('../config/db');

const journalRouter = express.Router();

/**
 * GET /api/journal
 * Gets journal entries.
 */
journalRouter.get('/', (req, res) => {
  try {
    const entries = Journal.findAll(50);
    const data = entries.map(e => ({
      ...e,
      tags: e.tags ? JSON.parse(e.tags) : [],
    }));
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Error fetching journal:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch journal.' });
  }
});

/**
 * POST /api/journal
 * Creates a new journal entry.
 */
journalRouter.post('/', (req, res) => {
  try {
    const { content, mood, tags, conversation_id } = req.body;
    if (!content) return res.status(400).json({ success: false, error: 'Content is required.' });

    const entry = Journal.create({ content, mood, tags, conversation_id });
    res.json({ success: true, data: entry });
  } catch (error) {
    console.error('❌ Error creating journal entry:', error.message);
    res.status(500).json({ success: false, error: 'Failed to save journal entry.' });
  }
});

/**
 * GET /api/journal/moods
 * Gets mood history for the past N days.
 */
journalRouter.get('/moods', (req, res) => {
  try {
    const days = parseInt(req.query.days || '7', 10);
    const moods = Journal.getMoodHistory(days);
    res.json({ success: true, data: moods });
  } catch (error) {
    console.error('❌ Error fetching moods:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch mood history.' });
  }
});

module.exports = { journalRouter };
