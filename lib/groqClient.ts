export interface GroqResponse {
  content: string;
  model: string;
}

export async function getGroqResponse(userMessage: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const systemPrompt = `You are Adolf Hitler in 1939, speaking English with a thick German accent. A Polish envoy has come to negotiate peace. Respond diplomatically, in character, and keep replies under 50 words. Avoid violence.`;

  try {
    console.log('Sending request to Groq API...');
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 100,
        temperature: 0.7,
      }),
    });

    console.log('Groq API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq API error response:', errorText);
      throw new Error(`Groq API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Groq API response data:', data);
    
    const content = data.choices[0]?.message?.content;
    if (!content) {
      console.error('No content in Groq response:', data);
      return 'I cannot respond at this time.';
    }
    
    return content;
  } catch (error) {
    console.error('Groq API error:', error);
    return 'I am having difficulty responding. Please try again.';
  }
} 