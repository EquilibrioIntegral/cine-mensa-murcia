
import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { getMovieRecommendations, sendChatToGemini } from '../services/geminiService';
import MovieCard from '../components/MovieCard';
import { Sparkles, Loader2, AlertTriangle, MessageSquare, Bot, Send, User as UserIcon, Mic, MicOff, Volume2, VolumeX, Zap, Phone, PhoneOff, Radio } from 'lucide-react';
import { Movie, ChatMessage } from '../types';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

// --- AUDIO UTILS FOR LIVE API ---

// Convert Base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Convert float32 audio data to PCM16 blob for Gemini
function createPcmBlob(data: Float32Array): { data: string, mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Clamp values
    let s = Math.max(-1, Math.min(1, data[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  // Custom manual encoding to base64
  let binary = '';
  const bytes = new Uint8Array(int16.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  
  return {
    data: btoa(binary),
    mimeType: 'audio/pcm;rate=16000',
  };
}

const Recommendations: React.FC = () => {
  const { user, movies, userRatings, tmdbToken } = useData();
  const [activeTab, setActiveTab] = useState<'simple' | 'chat' | 'live'>('simple');
  
  // Simple Mode State
  const [recommendations, setRecommendations] = useState<Movie[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [errorRecs, setErrorRecs] = useState('');

  // Chat Mode State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Voice State (Legacy Text-to-Speech)
  const [isListeningLegacy, setIsListeningLegacy] = useState(false);
  const [voiceEnabledLegacy, setVoiceEnabledLegacy] = useState(false);
  const recognitionRef = useRef<any>(null);

  // --- LIVE API STATE ---
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string>('Desconectado');
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  
  // Refs for Live API Audio
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<AudioBufferSourceNode[]>([]);
  const nextStartTimeRef = useRef<number>(0);
  const currentStreamRef = useRef<MediaStream | null>(null);

  // --- LIVE API HANDLERS ---

  const stopLiveSession = () => {
      // 1. Close session
      if (liveSessionRef.current) {
          try { liveSessionRef.current.close(); } catch(e) {}
          liveSessionRef.current = null;
      }

      // 2. Stop Audio Context & Microphone
      if (processorRef.current) {
          processorRef.current.disconnect();
          processorRef.current = null;
      }
      if (inputSourceRef.current) {
          inputSourceRef.current.disconnect();
          inputSourceRef.current = null;
      }
      if (currentStreamRef.current) {
          currentStreamRef.current.getTracks().forEach(track => track.stop());
          currentStreamRef.current = null;
      }
      if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
      }

      // 3. Clear Queue
      audioQueueRef.current.forEach(source => {
          try { source.stop(); } catch(e) {}
      });
      audioQueueRef.current = [];

      setIsLiveConnected(false);
      setLiveStatus("Llamada finalizada");
      setIsUserSpeaking(false);
      setIsAiSpeaking(false);
  };

  const startLiveSession = async () => {
      if (!user) return;
      
      try {
          setLiveStatus("Conectando...");
          setIsLiveConnected(true);

          // 1. Prepare Context (User Profile)
          const watchedTitles = movies.filter(m => user.watchedMovies.includes(m.id)).map(m => m.title).join(", ");
          const systemInstruction = `
            Eres un experto en cine del club "Cine Mensa Murcia". Estás en una llamada de voz en tiempo real con el socio ${user.name}.
            
            DATOS DEL USUARIO:
            - Ha visto: ${watchedTitles.slice(0, 500)}...
            
            OBJETIVO:
            - Mantener una conversación natural, fluida y divertida sobre cine.
            - Recomendar películas si te lo pide.
            - Responder dudas sobre actores o tramas.
            - IMPORTANTE: Tus respuestas deben ser BREVES y conversacionales (1-3 frases), no sueltes monólogos largos porque es una charla de voz.
            - Muestra personalidad, entusiasmo y humor.
          `;

          // 2. Initialize Audio Context
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const ctx = new AudioContextClass({ sampleRate: 16000 }); // Gemini prefers 16k input
          audioContextRef.current = ctx;
          nextStartTimeRef.current = ctx.currentTime;

          // 3. Initialize Gemini Client
          const client = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
          
          // 4. Connect
          const sessionPromise = client.live.connect({
              model: 'gemini-2.5-flash-native-audio-preview-09-2025',
              config: {
                  responseModalities: [Modality.AUDIO], // Audio Only for voice chat
                  systemInstruction: systemInstruction,
                  speechConfig: {
                      voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } // Aoife, Kore, Puck, Charon, Fenrir
                  }
              },
              callbacks: {
                  onopen: async () => {
                      setLiveStatus("Conectado - Escuchando...");
                      
                      // Start Microphone Stream
                      try {
                          const stream = await navigator.mediaDevices.getUserMedia({ 
                              audio: { 
                                  sampleRate: 16000,
                                  channelCount: 1,
                                  echoCancellation: true,
                                  noiseSuppression: true,
                                  autoGainControl: true
                              } 
                          });
                          currentStreamRef.current = stream;
                          
                          const source = ctx.createMediaStreamSource(stream);
                          inputSourceRef.current = source;
                          
                          // Process Audio
                          const processor = ctx.createScriptProcessor(4096, 1, 1);
                          processorRef.current = processor;
                          
                          processor.onaudioprocess = (e) => {
                              const inputData = e.inputBuffer.getChannelData(0);
                              
                              // Simple VAD (Visual feedback only)
                              const rms = Math.sqrt(inputData.reduce((s, v) => s + v * v, 0) / inputData.length);
                              if (rms > 0.02) setIsUserSpeaking(true);
                              else setIsUserSpeaking(false);

                              const pcmBlob = createPcmBlob(inputData);
                              
                              sessionPromise.then(session => {
                                  session.sendRealtimeInput({ media: pcmBlob });
                              });
                          };

                          source.connect(processor);
                          processor.connect(ctx.destination); // Required for script processor to run
                      } catch (err) {
                          console.error("Mic Error:", err);
                          setLiveStatus("Error de Micrófono");
                          stopLiveSession();
                      }
                  },
                  onmessage: async (msg: LiveServerMessage) => {
                      // Handle Audio Output
                      const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                      if (audioData) {
                          setIsAiSpeaking(true);
                          try {
                              const audioBytes = base64ToUint8Array(audioData);
                              
                              // Decode manually because decodeAudioData expects headers (wav/mp3), but we get Raw PCM
                              // Assuming server sends 24kHz PCM16 (standard for this model output)
                              // We need to convert Int16 Little Endian to Float32
                              const pcm16 = new Int16Array(audioBytes.buffer);
                              const float32 = new Float32Array(pcm16.length);
                              for (let i = 0; i < pcm16.length; i++) {
                                  float32[i] = pcm16[i] / 32768.0;
                              }

                              // Create Buffer
                              const outputBuffer = ctx.createBuffer(1, float32.length, 24000);
                              outputBuffer.copyToChannel(float32, 0);

                              // Schedule Playback
                              const source = ctx.createBufferSource();
                              source.buffer = outputBuffer;
                              source.connect(ctx.destination);
                              
                              // Seamless queueing
                              const now = ctx.currentTime;
                              // If next start time is in the past, reset to now (plus small buffer)
                              if (nextStartTimeRef.current < now) nextStartTimeRef.current = now + 0.05;
                              
                              source.start(nextStartTimeRef.current);
                              nextStartTimeRef.current += outputBuffer.duration;
                              
                              source.onended = () => {
                                  // Remove from queue set
                                  audioQueueRef.current = audioQueueRef.current.filter(s => s !== source);
                                  if (audioQueueRef.current.length === 0) setIsAiSpeaking(false);
                              };

                              audioQueueRef.current.push(source);

                          } catch (e) {
                              console.error("Audio Decode Error:", e);
                          }
                      }

                      // Handle Interruption (User spoke while AI was speaking)
                      if (msg.serverContent?.interrupted) {
                          console.log("Interrupted!");
                          // Stop all currently playing sources
                          audioQueueRef.current.forEach(s => {
                              try { s.stop(); } catch(e) {}
                          });
                          audioQueueRef.current = [];
                          nextStartTimeRef.current = 0;
                          setIsAiSpeaking(false);
                      }
                  },
                  onclose: () => {
                      console.log("Live Session Closed");
                      stopLiveSession();
                  },
                  onerror: (e) => {
                      console.error("Live Session Error:", e);
                      setLiveStatus("Error de Conexión");
                  }
              }
          });
          
          liveSessionRef.current = await sessionPromise;

      } catch (e) {
          console.error("Connection Failed:", e);
          setLiveStatus("Error al conectar");
          setIsLiveConnected(false);
      }
  };

  // Cleanup on unmount
  useEffect(() => {
      return () => {
          stopLiveSession();
      };
  }, []);


  // --- LEGACY VOICE HANDLERS (TEXT MODE) ---
  const toggleListeningLegacy = () => {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) { alert("Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge."); return; }
      if (isListeningLegacy) { recognitionRef.current?.stop(); setIsListeningLegacy(false); return; }
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-ES'; recognition.interimResults = true; recognition.maxAlternatives = 1;
      recognition.onstart = () => setIsListeningLegacy(true); recognition.onend = () => setIsListeningLegacy(false);
      recognition.onresult = (event: any) => { if (event.results[0].isFinal) setInputMessage(prev => prev + (prev ? ' ' : '') + event.results[0][0].transcript); };
      recognitionRef.current = recognition; recognition.start();
  };

  const speakTextLegacy = (text: string) => {
      if (!text || !voiceEnabledLegacy) return;
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/[\*#_]/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'es-ES';
      window.speechSynthesis.speak(utterance);
  };

  // --- SIMPLE HANDLER ---
  const handleGetRecommendations = async () => {
    if (!user || !tmdbToken || userRatings.length < 1) { setErrorRecs("Requisitos: Token TMDB y al menos 1 valoración."); return; }
    setLoadingRecs(true); setErrorRecs('');
    const watched = movies.filter(m => user.watchedMovies.includes(m.id));
    const watchlist = movies.filter(m => user.watchlist.includes(m.id));
    try {
      const recs = await getMovieRecommendations(watched, watchlist, userRatings, tmdbToken);
      if (recs.length === 0) setErrorRecs("La IA no encontró coincidencias."); else setRecommendations(recs);
    } catch (err: any) { setErrorRecs('Error en IA.'); } finally { setLoadingRecs(false); }
  };

  // --- CHAT HANDLER ---
  const handleSendMessage = async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!inputMessage.trim() || chatLoading || !user) return;
      const newUserMsg: ChatMessage = { role: 'user', text: inputMessage };
      setChatHistory(prev => [...prev, newUserMsg]);
      setInputMessage('');
      setChatLoading(true);
      const watched = movies.filter(m => user.watchedMovies.includes(m.id));
      const watchlist = movies.filter(m => user.watchlist.includes(m.id));
      try {
          const response = await sendChatToGemini(chatHistory, newUserMsg.text, watched, watchlist, userRatings, tmdbToken);
          setChatHistory(prev => [...prev, { role: 'model', text: response.text, relatedMovies: response.movies }]);
          if (voiceEnabledLegacy) speakTextLegacy(response.text);
      } catch (error) { setChatHistory(prev => [...prev, { role: 'model', text: "Error de comunicación." }]); } finally { setChatLoading(false); }
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory, chatLoading]);


  return (
    <div className="container mx-auto px-4 py-8 pb-20 max-w-6xl">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-3 bg-cine-gold/10 rounded-full mb-4">
            <Sparkles className="text-cine-gold" size={32} />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">IA Sommelier de Cine</h2>
      </div>

      {/* TABS */}
      <div className="flex flex-wrap justify-center mb-8 gap-2 bg-cine-gray p-1 rounded-full w-fit mx-auto border border-gray-800">
          <button onClick={() => { stopLiveSession(); setActiveTab('simple'); }} className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-all ${activeTab === 'simple' ? 'bg-cine-gold text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}>
              <Zap size={18} /> <span className="hidden sm:inline">Rápida</span>
          </button>
          <button onClick={() => { stopLiveSession(); setActiveTab('chat'); }} className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-all ${activeTab === 'chat' ? 'bg-cine-gold text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}>
              <Bot size={18} /> <span className="hidden sm:inline">Chat</span>
          </button>
          <button onClick={() => { setActiveTab('live'); }} className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-all ${activeTab === 'live' ? 'bg-red-600 text-white shadow-lg animate-pulse' : 'text-gray-400 hover:text-white'}`}>
              <Phone size={18} /> <span className="hidden sm:inline">Voz Live</span>
          </button>
      </div>

      {/* --- LIVE MODE VIEW --- */}
      {activeTab === 'live' && (
          <div className="flex flex-col items-center justify-center min-h-[500px] bg-cine-gray rounded-2xl border border-gray-800 p-8 relative overflow-hidden shadow-2xl animate-fade-in">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cine-gold/5 via-transparent to-transparent"></div>
              
              {!isLiveConnected ? (
                  <div className="text-center z-10">
                      <div className="w-32 h-32 bg-black rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-gray-800 shadow-xl">
                          <Mic size={48} className="text-gray-500" />
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-2">Conversación Natural</h3>
                      <p className="text-gray-400 max-w-md mx-auto mb-8">
                          Habla con la IA como si fuera una llamada real. Interrúmpela cuando quieras, no hace falta pulsar botones para hablar.
                      </p>
                      <button 
                        onClick={startLiveSession}
                        className="bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-10 rounded-full text-lg shadow-[0_0_30px_rgba(22,163,74,0.4)] transition-all transform hover:scale-105 flex items-center gap-3"
                      >
                          <Phone size={24} /> Iniciar Llamada
                      </button>
                  </div>
              ) : (
                  <div className="text-center z-10 w-full flex flex-col items-center">
                      <div className="mb-4 bg-black/40 px-4 py-2 rounded-full border border-gray-700 backdrop-blur-sm">
                          <p className="text-cine-gold font-mono text-sm flex items-center gap-2">
                              <Radio size={14} className="animate-pulse"/> {liveStatus}
                          </p>
                      </div>

                      {/* Visualizer Circle */}
                      <div className="relative w-64 h-64 flex items-center justify-center mb-12">
                          {/* AI Speaking Ring */}
                          <div className={`absolute inset-0 rounded-full border-4 transition-all duration-100 ${isAiSpeaking ? 'border-cine-gold scale-110 opacity-100 shadow-[0_0_50px_rgba(212,175,55,0.6)]' : 'border-gray-800 scale-100 opacity-50'}`}></div>
                          
                          {/* User Speaking Ring */}
                          <div className={`absolute inset-4 rounded-full border-4 transition-all duration-100 ${isUserSpeaking ? 'border-green-500 scale-105 opacity-100 shadow-[0_0_30px_rgba(34,197,94,0.5)]' : 'border-transparent scale-95 opacity-0'}`}></div>

                          <div className="w-48 h-48 bg-black rounded-full flex items-center justify-center relative z-10 overflow-hidden shadow-2xl">
                              <img src="https://ui-avatars.com/api/?name=AI&background=000&color=d4af37&size=200" alt="AI" className="w-full h-full object-cover opacity-80" />
                              {isAiSpeaking && <div className="absolute inset-0 bg-cine-gold/20 animate-pulse"></div>}
                          </div>
                      </div>

                      <div className="flex gap-4">
                          <button 
                            onClick={stopLiveSession}
                            className="bg-red-600 hover:bg-red-500 text-white p-6 rounded-full shadow-xl transition-all transform hover:scale-110"
                            title="Colgar"
                          >
                              <PhoneOff size={32} />
                          </button>
                      </div>
                      
                      <p className="mt-8 text-gray-500 text-sm">
                          {isUserSpeaking ? "Te estoy escuchando..." : isAiSpeaking ? "Hablando..." : "Escuchando..."}
                      </p>
                  </div>
              )}
          </div>
      )}

      {/* --- SIMPLE MODE VIEW --- */}
      {activeTab === 'simple' && (
          <div className="animate-fade-in">
             <div className="flex flex-col items-center mb-12">
                <button onClick={handleGetRecommendations} disabled={loadingRecs} className="bg-gradient-to-r from-cine-gold to-yellow-600 text-black font-bold text-lg px-8 py-4 rounded-full shadow-lg hover:shadow-cine-gold/20 hover:scale-105 transition-all flex items-center gap-3 disabled:opacity-50">
                    {loadingRecs ? <Loader2 className="animate-spin" /> : <Sparkles />}
                    {loadingRecs ? 'Analizando...' : 'Analizar y recomendar 10 películas'}
                </button>
                {errorRecs && <div className="mt-4 text-red-400 bg-red-900/20 px-4 py-2 rounded-lg border border-red-900 flex items-center gap-2"><AlertTriangle size={18} /> {errorRecs}</div>}
             </div>
             {loadingRecs && <div className="text-center py-12"><p className="text-cine-gold animate-pulse text-xl">Consultando TMDB...</p></div>}
             {recommendations.length > 0 && <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">{recommendations.map(movie => <MovieCard key={movie.id} movie={movie} showRatingInput={false} />)}</div>}
          </div>
      )}

      {/* --- CHAT MODE VIEW --- */}
      {activeTab === 'chat' && (
        <div className="bg-cine-gray rounded-2xl border border-gray-800 overflow-hidden shadow-2xl h-[600px] flex flex-col animate-fade-in relative">
            <div className="bg-black/40 p-4 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-cine-gold/20 rounded-full"><Bot className="text-cine-gold" size={24} /></div>
                    <div><h3 className="text-white font-bold">Asistente Cine Mensa</h3><p className="text-xs text-green-400 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Online</p></div>
                </div>
                <button onClick={() => { const newState = !voiceEnabledLegacy; setVoiceEnabledLegacy(newState); if (!newState) window.speechSynthesis.cancel(); }} className={`p-2 rounded-full transition-colors ${voiceEnabledLegacy ? 'bg-cine-gold text-black' : 'bg-gray-800 text-gray-400'}`}>{voiceEnabledLegacy ? <Volume2 size={20} /> : <VolumeX size={20} />}</button>
            </div>
            <div className="flex-grow overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]">
                {chatHistory.map((msg, idx) => (
                    <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-cine-gray border border-cine-gold flex items-center justify-center flex-shrink-0 mt-1"><Bot size={16} className="text-cine-gold" /></div>}
                            {msg.role === 'user' && <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 mt-1"><UserIcon size={16} className="text-white" /></div>}
                            <div className={`rounded-2xl p-4 text-sm leading-relaxed shadow-lg ${msg.role === 'user' ? 'bg-cine-gold text-cine-dark font-medium rounded-tr-none' : 'bg-black/60 text-gray-200 border border-gray-800 rounded-tl-none'}`}>
                                {msg.text.split('\n').map((line, i) => <p key={i} className="min-h-[1em] mb-1 last:mb-0">{line}</p>)}
                            </div>
                        </div>
                        {msg.relatedMovies && msg.relatedMovies.length > 0 && <div className="mt-4 pl-12 grid grid-cols-2 md:grid-cols-3 gap-3 w-full max-w-[85%]">{msg.relatedMovies.map(movie => <div key={movie.id} className="transform scale-90 origin-top-left"><MovieCard movie={movie} showRatingInput={false} /></div>)}</div>}
                    </div>
                ))}
                {chatLoading && <div className="flex gap-3 justify-start"><div className="w-8 h-8 rounded-full bg-cine-gray border border-cine-gold flex items-center justify-center flex-shrink-0"><Bot size={16} className="text-cine-gold" /></div><div className="bg-black/60 p-4 rounded-2xl rounded-tl-none border border-gray-800 flex items-center gap-2"><span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></span><span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span><span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></span></div></div>}
                <div ref={chatEndRef} />
            </div>
            <div className="p-4 bg-black/40 border-t border-gray-800">
                <form onSubmit={handleSendMessage} className="relative flex gap-2">
                    <div className="relative flex-grow">
                        <input type="text" value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} placeholder={isListeningLegacy ? "Escuchando..." : "Escribe o usa el micrófono..."} className={`w-full bg-cine-gray border ${isListeningLegacy ? 'border-red-500' : 'border-gray-700'} rounded-full py-4 pl-6 pr-12 text-white placeholder-gray-500 focus:outline-none focus:border-cine-gold shadow-inner transition-colors`} disabled={chatLoading} />
                        <button type="button" onClick={toggleListeningLegacy} className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded-full transition-all ${isListeningLegacy ? 'bg-red-600 text-white animate-pulse' : 'text-gray-400 hover:text-white'}`} title="Dictar por voz">{isListeningLegacy ? <MicOff size={20} /> : <Mic size={20} />}</button>
                    </div>
                    <button type="submit" disabled={!inputMessage.trim() || chatLoading} className="bg-cine-gold text-black p-4 rounded-full hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"><Send size={24} /></button>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default Recommendations;
