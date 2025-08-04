import { NextApiRequest, NextApiResponse } from 'next';
import { getGroqResponse } from '../../lib/groqClient';
import { textToSpeech } from '../../lib/elevenLabs';
import { arrayBufferToBase64 } from '../../lib/audio';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('=== Voice Response API Called ===');
  console.log('Method:', req.method);
  console.log('Headers:', req.headers);
  
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Environment check:', {
      hasGroqKey: !!process.env.GROQ_API_KEY,
      hasElevenLabsKey: !!process.env.ELEVENLABS_API_KEY,
      groqKeyLength: process.env.GROQ_API_KEY?.length || 0,
      elevenKeyLength: process.env.ELEVENLABS_API_KEY?.length || 0
    });
    
    const { audioData, transcribedText } = req.body;

    if (!audioData && !transcribedText) {
      return res.status(400).json({ error: 'Audio data or transcribed text is required' });
    }

    // For now, we'll use the transcribed text if provided, or fake it
    let textToProcess = transcribedText;
    
    if (!textToProcess) {
      // If no transcription provided, use a default message
      textToProcess = "Hello, I would like to discuss peace terms.";
    }

    console.log('Processing text:', textToProcess);

    // Get response from Groq
    console.log('Calling Groq API...');
    const groqResponse = await getGroqResponse(textToProcess);
    console.log('Groq response:', groqResponse);

    // Convert to speech using ElevenLabs
    console.log('Calling ElevenLabs API...');
    const audioBuffer = await textToSpeech(groqResponse);
    console.log('ElevenLabs response received, audio size:', audioBuffer.byteLength);

    // Convert to base64 for transmission
    const audioBase64 = arrayBufferToBase64(audioBuffer);
    console.log('Audio converted to base64, length:', audioBase64.length);

    res.status(200).json({
      success: true,
      audio: audioBase64,
      text: groqResponse,
      transcribedText: textToProcess
    });

  } catch (error) {
    console.error('Voice response error:', error);
    res.status(500).json({ 
      error: 'Failed to process voice request',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 