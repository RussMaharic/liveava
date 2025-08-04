import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import { blobToBase64, base64ToBlob, createAudioUrl } from '../lib/audio';

export default function HitlerVoiceAgent() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [responseAudio, setResponseAudio] = useState<string | null>(null);
  const [responseText, setResponseText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<Array<{role: 'user' | 'assistant', text: string}>>([]);
  const [currentStatus, setCurrentStatus] = useState<string>('Ready');
  const [debugInfo, setDebugInfo] = useState<string>('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = async () => {
    try {
      setError(null);
      setCurrentStatus('Starting Recording...');
      setDebugInfo('Requesting microphone access...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log('📼 Audio chunk received, size:', event.data.size);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('🛑 Recording stopped, chunks:', audioChunksRef.current.length);
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
          console.log('🔄 Processing audio blob, size:', audioBlob.size);
          await processAudio(audioBlob);
        } else {
          console.log('❌ No audio chunks to process');
          setCurrentStatus('No Audio Recorded');
          setDebugInfo('No audio was recorded');
          setIsRecording(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setCurrentStatus('Recording...');
      setDebugInfo('Hold the button and speak...');
      console.log('🔴 Recording started');
      
    } catch (err) {
      setError('Failed to access microphone. Please check permissions.');
      setCurrentStatus('Error');
      setDebugInfo('Microphone access failed: ' + err);
      console.error('Microphone access error:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      console.log('🛑 Stopping recording...');
      setCurrentStatus('Processing...');
      setDebugInfo('Processing your audio...');
      mediaRecorderRef.current.stop();
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    setIsRecording(false);
    setError(null);
    setCurrentStatus('Sending to AI...');
    setDebugInfo('Sending audio to Groq API for processing...');

    try {
      const audioBase64 = await blobToBase64(audioBlob);
      setDebugInfo('Audio converted to base64, sending to API...');
      
      const response = await fetch('/api/voice-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioData: audioBase64,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setDebugInfo('AI response received, processing...');
      
      if (data.success) {
        setConversationHistory(prev => [...prev, 
          { role: 'user', text: data.transcribedText || 'User spoke' },
          { role: 'assistant', text: data.text }
        ]);
        
        const audioBlob = base64ToBlob(data.audio);
        const audioUrl = createAudioUrl(audioBlob);
        setResponseAudio(audioUrl);
        setResponseText(data.text);
        setIsSpeaking(true);
        setCurrentStatus('Speaking...');
        setDebugInfo('Playing AI response audio...');
        
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          
          audioRef.current.onended = () => {
            console.log('🔊 Audio playback finished');
            setIsSpeaking(false);
            setCurrentStatus('Ready');
            setDebugInfo('Ready for next recording');
          };
          
          audioRef.current.onerror = (e) => {
            console.error('Audio playback error:', e);
            setIsSpeaking(false);
            setCurrentStatus('Audio Error');
            setDebugInfo('Audio playback failed');
          };
          
          console.log('▶️ Starting audio playback...');
          audioRef.current.play().catch(e => {
            console.error('Audio play error:', e);
            setIsSpeaking(false);
            setCurrentStatus('Audio Error');
            setDebugInfo('Audio play failed');
          });
        }
      } else {
        throw new Error(data.error || 'Failed to process audio');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process audio');
      setCurrentStatus('Error');
      setDebugInfo('API error: ' + err);
      console.error('Processing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const testApiDirectly = async () => {
    console.log('Testing API directly...');
    setIsProcessing(true);
    setCurrentStatus('Testing API...');
    setDebugInfo('Sending test message to API...');
    
    try {
      const response = await fetch('/api/voice-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcribedText: "Hello, this is a test message.",
        }),
      });

      console.log('API Response status:', response.status);
      const data = await response.json();
      console.log('API Response data:', data);
      
      if (data.success) {
        setResponseText(data.text);
        const audioBlob = base64ToBlob(data.audio);
        const audioUrl = createAudioUrl(audioBlob);
        setResponseAudio(audioUrl);
        setCurrentStatus('API Test Success');
        setDebugInfo('API responded successfully, playing audio...');
        
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.play();
        }
      } else {
        setError(data.error || 'API test failed');
        setCurrentStatus('API Test Failed');
        setDebugInfo('API returned an error: ' + (data.error || 'Unknown'));
      }
    } catch (err) {
      console.error('API test error:', err);
      setError(err instanceof Error ? err.message : 'API test failed');
      setCurrentStatus('API Test Error');
      setDebugInfo('API test failed due to network or server error: ' + (err instanceof Error ? err.message : 'Unknown'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (responseAudio) {
        URL.revokeObjectURL(responseAudio);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [responseAudio]);

  return (
    <>
      <Head>
        <title>Hitler Voice Agent</title>
        <meta name="description" content="Voice agent with Hitler character" />
      </Head>

      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">Voice Conversation</h1>
            <p className="text-gray-400 mb-8">Push to talk - hold to speak, release to hear response</p>
          </div>

          <div className="space-y-6">
            {/* Test Button */}
            <button
              onClick={testApiDirectly}
              disabled={isProcessing || isRecording}
              className="w-full py-2 px-4 rounded-lg font-medium text-sm bg-yellow-600 hover:bg-yellow-700 transition-colors"
            >
              🧪 Test API (Skip Voice Detection)
            </button>

            {/* Main Push-to-Talk Button */}
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              disabled={isProcessing || isSpeaking}
              className={`w-full py-8 px-6 rounded-lg font-semibold text-xl transition-all duration-200 ${
                isRecording
                  ? 'bg-red-600 hover:bg-red-700 animate-pulse'
                  : isProcessing || isSpeaking
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isRecording 
                ? '🎤 Recording... (Release to send)' 
                : isProcessing 
                ? '🤔 Processing...' 
                : isSpeaking 
                ? '🗣️ Speaking...' 
                : '🎤 Hold to Speak'
              }
            </button>

            {/* Status Display */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2">Status:</h3>
              <div className="text-center">
                <div className={`text-xl font-bold mb-2 ${
                  currentStatus.includes('Recording') ? 'text-red-400' :
                  currentStatus.includes('Processing') ? 'text-yellow-400' :
                  currentStatus.includes('Speaking') ? 'text-blue-400' :
                  currentStatus.includes('Error') ? 'text-red-400' :
                  'text-gray-300'
                }`}>
                  {currentStatus}
                </div>
                <div className="text-sm text-gray-400">{debugInfo}</div>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-900 border border-red-700 rounded-lg p-4 text-red-200">
                {error}
              </div>
            )}

            {/* Conversation History */}
            {conversationHistory.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4 max-h-60 overflow-y-auto">
                <h3 className="text-lg font-semibold mb-3">Conversation:</h3>
                <div className="space-y-3">
                  {conversationHistory.slice(-4).map((message, index) => (
                    <div
                      key={index}
                      className={`p-2 rounded ${
                        message.role === 'user'
                          ? 'bg-blue-900 bg-opacity-50 text-blue-200'
                          : 'bg-green-900 bg-opacity-50 text-green-200'
                      }`}
                    >
                      <div className="text-xs font-medium mb-1">
                        {message.role === 'user' ? '👤 You' : '🤖 Character'}
                      </div>
                      <div className="text-sm">{message.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Audio Player (hidden but functional) */}
            <audio
              ref={audioRef}
              style={{ display: 'none' }}
            >
              Your browser does not support the audio element.
            </audio>
          </div>

          {/* Instructions */}
          <div className="text-center text-gray-500 text-sm mt-8">
            <p>🎤 Hold the button and speak</p>
            <p>🔄 Release to send your message</p>
            <p>🗣️ Wait for the AI response</p>
            <p>🔄 Repeat for conversation</p>
          </div>
        </div>
      </div>
    </>
  );
} 