/**
 * MeAI Memory API Routes
 * Endpoints for the mobile app to view and manage what MeAI remembers.
 */

const express = require('express');
const { getMemories, deleteMemory, clearAllMemories } = require('../engine/memory-store');

const memoryRouter = express.Router();

/**
 * GET /api/memories
 * Returns all extracted memories, optionally filtered by ?type=fact
 */
memoryRouter.get('/memories', (req, res) => {
  try {
    const { type } = req.query;
    const memories = getMemories(type);
    
    // Sort newest first
    memories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json(memories);
  } catch (error) {
    console.error('❌ GET /memories error:', error);
    res.status(500).json({ error: 'Failed to fetch memories' });
  }
});

/**
 * DELETE /api/memories/:id
 * Delete a specific memory by ID.
 */
memoryRouter.delete('/memories/:id', (req, res) => {
  try {
    const { id } = req.params;
    const success = deleteMemory(id);
    
    if (success) {
      res.json({ status: 'ok', message: 'Memory deleted' });
    } else {
      res.status(404).json({ error: 'Memory not found' });
    }
  } catch (error) {
    console.error(`❌ DELETE /memories/${req.params.id} error:`, error);
    res.status(500).json({ error: 'Failed to delete memory' });
  }
});

/**
 * DELETE /api/memories
 * Clear ALL memories ("forget me").
 */
memoryRouter.delete('/memories', (req, res) => {
  try {
    clearAllMemories();
    res.json({ status: 'ok', message: 'All memories deleted' });
  } catch (error) {
    console.error('❌ DELETE /memories error:', error);
    res.status(500).json({ error: 'Failed to clear memories' });
  }
});

module.exports = { memoryRouter };
