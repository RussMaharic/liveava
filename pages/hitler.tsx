import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import { blobToBase64, base64ToBlob, createAudioUrl } from '../lib/audio';

export default function HitlerVoiceAgent() {
  const [isConversationActive, setIsConversationActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [responseAudio, setResponseAudio] = useState<string | null>(null);
  const [responseText, setResponseText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<Array<{role: 'user' | 'assistant', text: string}>>([]);
  const [testMode, setTestMode] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const startConversation = async () => {
    try {
      setError(null);
      console.log('🎬 Starting conversation...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      console.log('🎤 Microphone access granted');
      
      // Initialize audio context for continuous monitoring
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Resume audio context if it's suspended (Chrome requires user interaction)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      analyserRef.current = audioContextRef.current.createAnalyser();
      const microphone = audioContextRef.current.createMediaStreamSource(stream);
      microphone.connect(analyserRef.current);
      
      analyserRef.current.fftSize = 512;
      analyserRef.current.smoothingTimeConstant = 0.8;
      
      console.log('🔊 Audio context initialized');
      
      setIsConversationActive(true);
      startListening();
    } catch (err) {
      setError('Failed to access microphone. Please check permissions.');
      console.error('Microphone access error:', err);
    }
  };

  const stopConversation = () => {
    console.log('🛑 Stopping conversation...');
    setIsConversationActive(false);
    setIsListening(false);
    setIsProcessing(false);
    setIsSpeaking(false);
    
    // Stop any ongoing recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      console.log('🔴 Stopping media recorder');
      mediaRecorderRef.current.stop();
    }
    
    // Clean up audio monitoring
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      console.log('🔊 Closing audio context');
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Stop media stream
    if (streamRef.current) {
      console.log('🎤 Stopping media stream');
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startListening = () => {
    if (!streamRef.current || !isConversationActive) return;
    
    console.log('🎤 Starting to listen...');
    setIsListening(true);
    setIsProcessing(false);
    setIsSpeaking(false);
    
    const mediaRecorder = new MediaRecorder(streamRef.current);
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
      }
    };

    mediaRecorder.start();
    console.log('🔴 MediaRecorder started');
    
    // Start voice activity detection
    startVoiceActivityDetection();
    
    // Fallback: automatically stop after 5 seconds and process whatever we have
    setTimeout(() => {
      if (isListening && mediaRecorderRef.current?.state === 'recording') {
        console.log('⏰ Fallback timeout: stopping recording after 5 seconds');
        stopListening();
      }
    }, 5000);
  };

  const stopListening = () => {
    setIsListening(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    setIsListening(false);
    setError(null);

    try {
      const audioBase64 = await blobToBase64(audioBlob);
      
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
      
      if (data.success) {
        // Add user message to conversation history
        setConversationHistory(prev => [...prev, 
          { role: 'user', text: data.transcribedText || 'User spoke' },
          { role: 'assistant', text: data.text }
        ]);
        
        const audioBlob = base64ToBlob(data.audio);
        const audioUrl = createAudioUrl(audioBlob);
        setResponseAudio(audioUrl);
        setResponseText(data.text);
        setIsSpeaking(true);
        
        // Auto-play the response and continue conversation
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          
          // When response finishes playing, start listening again
          audioRef.current.onended = () => {
            console.log('🔊 Audio playback finished, restarting listening...');
            setIsSpeaking(false);
            if (isConversationActive) {
              // Small delay before starting to listen again
              setTimeout(() => {
                console.log('🔄 Restarting listening cycle...');
                startListening();
              }, 1000);
            }
          };
          
          audioRef.current.onerror = (e) => {
            console.error('Audio playback error:', e);
            setIsSpeaking(false);
            if (isConversationActive) {
              setTimeout(() => startListening(), 1000);
            }
          };
          
          console.log('▶️ Starting audio playback...');
          audioRef.current.play().catch(e => {
            console.error('Audio play error:', e);
            // If audio fails to play, still continue conversation
            setIsSpeaking(false);
            if (isConversationActive) {
              setTimeout(() => startListening(), 1000);
            }
          });
        }
      } else {
        throw new Error(data.error || 'Failed to process audio');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process audio');
      console.error('Processing error:', err);
      
      // If there's an error, continue listening if conversation is active
      if (isConversationActive) {
        setTimeout(() => {
          startListening();
        }, 1000);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const startVoiceActivityDetection = () => {
    if (!analyserRef.current || !isConversationActive) {
      console.log('Voice activity detection failed to start:', { 
        hasAnalyser: !!analyserRef.current, 
        isActive: isConversationActive 
      });
      return;
    }
    
    console.log('Starting voice activity detection...');
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    let silenceStart: number | null = null;
    let speechDetected = false;
    const SILENCE_THRESHOLD = 3; // Ultra low threshold for silence detection
    const SPEECH_THRESHOLD = 8; // Ultra low threshold to detect start of speech
    const SILENCE_DURATION = 1000; // 1 second of silence after speech
    const MIN_SPEECH_DURATION = 300; // Minimum speech duration before considering it valid
    let speechStartTime: number | null = null;
    
    const checkVoiceActivity = () => {
      if (!isListening || !isConversationActive) return;
      
      analyserRef.current?.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      
      // Log audio levels every 2 seconds for debugging
      if (Date.now() % 2000 < 50) {
        console.log('Audio level:', average.toFixed(1), 'Speech detected:', speechDetected);
      }
      
      // Detect start of speech
      if (average > SPEECH_THRESHOLD && !speechDetected) {
        speechDetected = true;
        speechStartTime = Date.now();
        silenceStart = null;
        console.log('🎤 Speech detected! Audio level:', average.toFixed(1));
      }
      
      // Monitor for end of speech
      if (speechDetected) {
        if (average < SILENCE_THRESHOLD) {
          // Silence detected after speech
          if (!silenceStart) {
            silenceStart = Date.now();
            console.log('🤫 Silence started after speech...');
          } else if (Date.now() - silenceStart > SILENCE_DURATION) {
            // Check if we had enough speech duration
            if (speechStartTime && Date.now() - speechStartTime > MIN_SPEECH_DURATION) {
              console.log('✅ End of speech detected, processing audio...');
              stopListening();
              return;
            } else {
              console.log('❌ Speech too short, resetting...');
              speechDetected = false;
              speechStartTime = null;
              silenceStart = null;
            }
          }
        } else {
          // Sound detected again, reset silence timer
          silenceStart = null;
        }
      }
      
      // Continue monitoring
      animationFrameRef.current = requestAnimationFrame(checkVoiceActivity);
    };
    
    checkVoiceActivity();
  };

  const handleConversationToggle = () => {
    if (isConversationActive) {
      stopConversation();
    } else {
      startConversation();
    }
  };

  const testApiDirectly = async () => {
    console.log('Testing API directly...');
    setIsProcessing(true);
    
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
        
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.play();
        }
      } else {
        setError(data.error || 'API test failed');
      }
    } catch (err) {
      console.error('API test error:', err);
      setError(err instanceof Error ? err.message : 'API test failed');
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
      stopConversation();
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
            <p className="text-gray-400 mb-8">Natural conversation with the character</p>
          </div>

          <div className="space-y-6">
            {/* Test Button */}
            <button
              onClick={testApiDirectly}
              disabled={isProcessing}
              className="w-full py-2 px-4 rounded-lg font-medium text-sm bg-yellow-600 hover:bg-yellow-700 transition-colors"
            >
              🧪 Test API (Skip Voice Detection)
            </button>

            {/* Main Button */}
            <button
              onClick={handleConversationToggle}
              disabled={isProcessing}
              className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all duration-200 ${
                isConversationActive
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isConversationActive ? 'End Conversation' : 'Start Conversation'}
            </button>

            {/* Manual Send Button (appears when listening) */}
            {isListening && (
              <button
                onClick={stopListening}
                className="w-full py-2 px-4 rounded-lg font-medium text-sm bg-green-600 hover:bg-green-700 transition-colors"
              >
                ✅ Send Message (Manual)
              </button>
            )}

            {/* Status Indicators */}
            {isConversationActive && (
              <div className="text-center space-y-2">
                {isListening && (
                  <div className="text-green-400 animate-pulse">
                    🎤 Listening... Speak now (auto-detects silence)
                  </div>
                )}
                
                {isProcessing && (
                  <div className="text-yellow-400">
                    🤔 Processing your message...
                  </div>
                )}
                
                {isSpeaking && (
                  <div className="text-blue-400 animate-pulse">
                    🗣️ Speaking...
                  </div>
                )}
                
                {!isListening && !isProcessing && !isSpeaking && (
                  <div className="text-gray-400">
                    💭 Conversation active, ready to listen
                  </div>
                )}
              </div>
            )}

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
            {!isConversationActive ? (
              <>
                <p>Click "Start Conversation" to begin</p>
                <p>The AI will automatically detect when you're speaking</p>
                <p>and respond naturally in real-time</p>
              </>
            ) : (
              <>
                <p>Speak naturally - the AI is listening</p>
                <p>It will automatically respond when you finish</p>
                <p>Click "End Conversation" to stop</p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
} 