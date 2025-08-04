import { NextApiRequest, NextApiResponse } from 'next';
import { getGroqResponse } from '../../lib/groqClient';
import { textToSpeech } from '../../lib/elevenLabs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Testing APIs...');
    
    // Test Groq API
    console.log('Testing Groq API...');
    const groqResponse = await getGroqResponse("Hello, how are you?");
    console.log('Groq test response:', groqResponse);
    
    // Test ElevenLabs API
    console.log('Testing ElevenLabs API...');
    const audioBuffer = await textToSpeech("This is a test message.");
    console.log('ElevenLabs test response size:', audioBuffer.byteLength);
    
    res.status(200).json({
      success: true,
      groqWorking: true,
      elevenLabsWorking: true,
      groqResponse: groqResponse,
      audioSize: audioBuffer.byteLength
    });

  } catch (error) {
    console.error('API test error:', error);
    res.status(500).json({ 
      error: 'API test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 