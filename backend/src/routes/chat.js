/**
 * MeAI Chat Routes
 * REST endpoint for chat.
 */

const { Router } = require('express');
const { chat } = require('../engine/conversation');

const chatRouter = Router();

/**
 * POST /api/chat
 * Send a message to MeAI and get a response.
 */
chatRouter.post('/chat', async (req, res) => {
  try {
    const { message, conversation_id } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required and must be a non-empty string' });
    }

    if (message.length > 5000) {
      return res.status(400).json({ error: 'Message must be 5000 characters or less' });
    }

    const result = await chat(message.trim(), conversation_id);

    res.json({
      message: result.response,
      conversation_id: result.conversationId,
      detected_mood: result.detectedMood,
    });
  } catch (error) {
    console.error('❌ Chat error:', error);
    res.status(500).json({
      error: 'Failed to generate response',
      details: error.message || 'Unknown error',
    });
  }
});

module.exports = { chatRouter };
