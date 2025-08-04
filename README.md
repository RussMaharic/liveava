# Voice Agent - Hitler Character

A full-stack Next.js voice agent that allows you to speak with an AI character in real-time. The agent responds with a German-accented voice using Groq API for text generation and ElevenLabs for text-to-speech.

## Features

- 🎤 Real-time voice recording using browser microphone
- 🤖 AI-powered responses using Groq's Mixtral model
- 🔊 Text-to-speech with German accent using ElevenLabs
- 🎨 Clean, modern UI with Tailwind CSS
- ⚡ Fast response times
- 📱 Mobile-friendly design

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Copy the example environment file and add your API keys:

```bash
cp env.example .env.local
```

Edit `.env.local` and add your API keys:

```env
GROQ_API_KEY=your_groq_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```

### 3. Get API Keys

- **Groq API**: Sign up at [groq.com](https://groq.com) and get your API key
- **ElevenLabs API**: Sign up at [elevenlabs.io](https://elevenlabs.io) and get your API key

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Navigate to `/hitler` or the app will redirect you automatically
2. Click the "Talk" button to start recording
3. Speak your message clearly
4. Click "Stop Recording" to send your message
5. Wait for the AI response (both text and audio)
6. The response will play automatically

## Project Structure

```
├── pages/
│   ├── hitler.tsx          # Main voice agent page
│   ├── index.tsx           # Redirect page
│   ├── _app.tsx           # App wrapper
│   └── api/
│       └── voice-response.ts # API endpoint
├── lib/
│   ├── groqClient.ts      # Groq API integration
│   ├── elevenLabs.ts      # ElevenLabs TTS integration
│   └── audio.ts           # Audio utility functions
├── styles/
│   └── globals.css        # Global styles with Tailwind
└── env.example            # Environment variables template
```

## API Endpoints

### POST /api/voice-response

Processes voice input and returns AI response with audio.

**Request Body:**
```json
{
  "audioData": "base64_encoded_audio",
  "transcribedText": "optional_transcribed_text"
}
```

**Response:**
```json
{
  "success": true,
  "audio": "base64_encoded_response_audio",
  "text": "AI response text",
  "transcribedText": "processed text"
}
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## Technical Details

- **Frontend**: Next.js with TypeScript and Tailwind CSS
- **Audio Recording**: MediaRecorder API with getUserMedia
- **AI Processing**: Groq API with Mixtral model
- **Text-to-Speech**: ElevenLabs API
- **Audio Format**: WAV for input, MP3 for output

## Troubleshooting

### Microphone Access Issues
- Ensure your browser has microphone permissions
- Try refreshing the page
- Check browser console for errors

### API Errors
- Verify your API keys are correct
- Check that you have sufficient credits for both APIs
- Ensure environment variables are properly set

### Audio Playback Issues
- Check browser audio settings
- Try a different browser
- Ensure audio files are not blocked by browser security

## License

MIT License - feel free to use this project for educational purposes.

## Disclaimer

This project is for educational and entertainment purposes only. The character portrayal is fictional and should not be taken as endorsement of any historical figures or ideologies. 