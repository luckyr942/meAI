const { OpenAI } = require('openai');
const { config } = require('../config');

// Initialize OpenAI client to point to OpenRouter (or Groq if overridden)
const ai = new OpenAI({
  baseURL: config.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  apiKey: config.OPENROUTER_API_KEY,
  // We can pass GROQ_API_KEY and https://api.groq.com/openai/v1 as fallbacks if needed dynamically
});

const PARSE_JOB_PROMPT = `
You are an expert HR and recruitment assistant. Your job is to read an email body and extract strictly structured JSON about a job application.
Extract the following exact fields:
- "company": (String) Name of the company.
- "role": (String) The job title they applied for.
- "status": (String) Must be exact: "Applied", "Interviewing", "Rejected", "Offer", "Action Required" or "Unknown".
- "platform": (String) Must be exact: "LinkedIn", "Wellfound", "Direct", or "Other".
- "action_required": (Boolean) true if the email is asking the candidate to schedule an interview, complete a take-home assignment, or reply.

Return ONLY valid JSON. No markdown formatting, no explanations.
`;

/**
 * Parses raw email body using the specified model.
 * @param {string} emailBody The raw text of the email
 * @param {string} model The model to use (defaults to fast/cheap models via OpenRouter/Groq)
 */
async function parseJobEmail(emailBody, model = config.PRIMARY_MODEL) {
  try {
    const response = await ai.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: PARSE_JOB_PROMPT },
        { role: 'user', content: emailBody },
      ],
      // OpenRouter supports forcing JSON format on some models
      response_format: { type: 'json_object' },
    });

    const rawContent = response.choices[0]?.message?.content || '{}';
    return JSON.parse(rawContent);
  } catch (error) {
    console.error('❌ AI Parsing Error:', error.message);
    throw error;
  }
}

module.exports = { parseJobEmail };
