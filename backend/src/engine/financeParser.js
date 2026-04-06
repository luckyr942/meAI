/**
 * MeAI Finance Email Parser
 * Uses AI to extract transaction data from bank/UPI notification emails.
 */

const { OpenAI } = require('openai');
const { config } = require('../config');

const ai = new OpenAI({
  baseURL: config.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  apiKey: config.OPENROUTER_API_KEY,
});

const PARSE_FINANCE_PROMPT = `
You are a financial data extraction expert. Read the email body and extract transaction information.
Extract the following fields as JSON:
- "amount": (Number) The transaction amount in INR (just the number, no currency symbol).
- "merchant": (String) Name of the merchant/store/service.
- "category": (String) Must be exact: "Food", "Transport", "Subscriptions", "Shopping", "Bills", "Entertainment", "Education", "Health", or "Other".
- "type": (String) Must be exact: "credit" or "debit".
- "date": (String) Transaction date in ISO format (YYYY-MM-DD), or null if not found.

If this email is NOT a financial transaction (e.g., promotional email), return: {"amount": null}

Return ONLY valid JSON. No markdown formatting, no explanations.
`;

async function parseFinanceEmail(emailBody, model = config.PRIMARY_MODEL) {
  try {
    const response = await ai.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: PARSE_FINANCE_PROMPT },
        { role: 'user', content: emailBody },
      ],
      response_format: { type: 'json_object' },
    });

    const rawContent = response.choices[0]?.message?.content || '{}';
    return JSON.parse(rawContent);
  } catch (error) {
    console.error('❌ Finance AI Parsing Error:', error.message);
    return { amount: null };
  }
}

module.exports = { parseFinanceEmail };
