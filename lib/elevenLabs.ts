export async function textToSpeech(text: string): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not configured');
  }

  try {
    console.log('Sending request to ElevenLabs API...');
    const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      }),
    });

    console.log('ElevenLabs API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error response:', errorText);
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    console.log('ElevenLabs API success, audio size:', audioBuffer.byteLength);
    return audioBuffer;
  } catch (error) {
    console.error('ElevenLabs API error:', error);
    throw error;
  }
} 