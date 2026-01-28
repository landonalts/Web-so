import OpenAI from 'openai';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { model, messages, temperature, max_tokens } = req.body;
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    const completion = await openai.chat.completions.create({
      model: model || 'gpt-3.5-turbo',
      messages: messages,
      temperature: temperature || 0.7,
      max_tokens: max_tokens || 1000
    });
    
    res.status(200).json(completion);
    
  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({ 
      error: {
        message: error.message,
        type: error.type
      }
    });
  }
}
