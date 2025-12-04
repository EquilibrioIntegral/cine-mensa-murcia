

import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { getMovieRecommendations, sendChatToGemini } from '../services/geminiService';
import { getImageUrl } from '../services/tmdbService';
import MovieCard from '../components/MovieCard';
import AIVisualizer from '../components/AIVisualizer';
import { Sparkles, Loader2, AlertTriangle, Bot, Send, User as UserIcon, Mic, MicOff, Volume2, VolumeX, Zap, Phone, PhoneOff, Radio, Tv, X, Lock, Trophy } from 'lucide-react';
import { Movie, ChatMessage } from '../types';

const Recommendations: React.FC = () => {
  const { user, movies, userRatings, tmdbToken, liveSession, startLiveSession, stopLiveSession, topCriticId, getRemainingVoiceSeconds, triggerAction } = useData();
  const [activeTab, setActiveTab] = useState<'simple' | 'chat' | 'live'>('simple');
  
  // Auto-switch to live tab if connected
  useEffect(() => {
      if (liveSession.isConnected) setActiveTab('live');
  }, [liveSession.isConnected]);

  // Simple Mode State
  const [recommendations, setRecommendations] = useState<Movie[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [errorRecs, setErrorRecs] = useState('');

  // Chat Mode State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Chat Visuals State (Side Panel)
  const [chatVisuals, setChatVisuals] = useState<{type: 'movie'|'person', data: any}[]>([]);

  // Voice State (Legacy Text-to-Speech)
  const [isListeningLegacy, setIsListeningLegacy] = useState(false);
  const [voiceEnabledLegacy, setVoiceEnabledLegacy] = useState(false);
  const recognitionRef = useRef<any>(null);

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
      if (recs.length === 0) setErrorRecs("La IA no encontró coincidencias."); 
      else {
          setRecommendations(recs);
          // Trigger Gamification Action
          triggerAction('use_ai');
      }
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
          
          // Update History
          setChatHistory(prev => [...prev, { 
              role: 'model', 
              text: response.text, 
              relatedMovies: response.movies,
              relatedPeople: response.people
          }]);

          // Update Visual Sidebar
          const newVisuals: {type: 'movie'|'person', data: any}[] = [];
          if (response.movies) response.movies.forEach(m => newVisuals.push({ type: 'movie', data: m }));
          if (response.people) response.people.forEach(p => newVisuals.push({ type: 'person', data: p }));
          setChatVisuals(newVisuals);

          if (voiceEnabledLegacy) speakTextLegacy(response.text);
          triggerAction('use_ai_chat'); 
      } catch (error) { 
          setChatHistory(prev => [...prev, { role: 'model', text: "Error de comunicación." }]); 
      } finally { 
          setChatLoading(false); 
      }
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory, chatLoading]);

  // LIVE PERMISSION CHECK
  const isTopCritic = user?.id === topCriticId;
  const canUseLive = user?.isAdmin || isTopCritic;
  const remainingSeconds = getRemainingVoiceSeconds();

  return (
    <div className="container mx-auto px-4 py-8 pb-20 max-w-6xl relative">
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
          <div className="relative">
              <div className="flex flex-col items-center justify-center min-h-[500px] bg-cine-gray rounded-2xl border border-gray-800 p-8 relative overflow-hidden shadow-2xl animate-fade-in">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cine-gold/5 via-transparent to-transparent"></div>
                  
                  {!canUseLive ? (
                      // LOCKED SCREEN FOR REGULAR USERS
                      <div className="text-center z-10 p-6 bg-black/60 rounded-xl backdrop-blur-sm border border-cine-gold/30">
                          <div className="bg-black p-4 rounded-full inline-block mb-4 border border-gray-700">
                              <Lock size={48} className="text-cine-gold" />
                          </div>
                          <h3 className="text-2xl font-bold text-white mb-2">Acceso Exclusivo VIP</h3>
                          <p className="text-gray-400 max-w-md mx-auto mb-6">
                              La línea directa de voz con la IA está reservada exclusivamente para el 
                              <span className="text-cine-gold font-bold mx-1">Crítico #1 del Ranking</span> 
                              (y el Administrador).
                          </p>
                          <div className="bg-cine-gold/10 p-4 rounded-lg border border-cine-gold/20 inline-block">
                              <Trophy className="text-cine-gold mx-auto mb-2" size={24} />
                              <p className="text-sm text-cine-gold font-bold">¡Escribe más reseñas para destronar al líder y ganar acceso!</p>
                          </div>
                      </div>
                  ) : !liveSession.isConnected ? (
                      // CONNECT SCREEN FOR VIPs
                      <div className="text-center z-10">
                          <div className="w-32 h-32 bg-black rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-gray-800 shadow-xl">
                              <Mic size={48} className="text-gray-500" />
                          </div>
                          <h3 className="text-2xl font-bold text-white mb-2">Conversación Natural</h3>
                          <p className="text-gray-400 max-w-md mx-auto mb-6">
                              Habla con la IA como si fuera una llamada real. Interrúmpela cuando quieras.
                          </p>
                          
                          {/* Limit Warning */}
                          <div className="mb-6 text-sm font-mono bg-black/40 px-4 py-2 rounded-full border border-gray-700 inline-flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${remainingSeconds > 60 ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></span>
                              Tiempo restante hoy: {Math.floor(remainingSeconds / 60)}m {remainingSeconds % 60}s
                          </div>

                          <button 
                            onClick={() => { startLiveSession('general'); triggerAction('use_ai_chat'); }}
                            disabled={remainingSeconds <= 0 && !user?.isAdmin}
                            className="bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-10 rounded-full text-lg shadow-[0_0_30px_rgba(22,163,74,0.4)] transition-all transform hover:scale-105 flex items-center gap-3 disabled:opacity-50 disabled:grayscale"
                          >
                              <Phone size={24} /> {remainingSeconds > 0 || user?.isAdmin ? 'Iniciar Llamada' : 'Cupo Agotado'}
                          </button>
                      </div>
                  ) : (
                      // ACTIVE CALL SCREEN
                      <div className="text-center z-10 w-full flex flex-col items-center">
                          {/* NEW VISUALIZER */}
                          <div className="mb-8 scale-125">
                              <AIVisualizer 
                                  isUserSpeaking={liveSession.isUserSpeaking}
                                  isAiSpeaking={liveSession.isAiSpeaking}
                                  status={liveSession.status}
                              />
                          </div>

                          <div className="flex gap-4 mb-4">
                              <button 
                                onClick={stopLiveSession}
                                className="bg-red-600 hover:bg-red-500 text-white p-6 rounded-full shadow-xl transition-all transform hover:scale-110"
                                title="Colgar"
                              >
                                  <PhoneOff size={32} />
                              </button>
                          </div>
                          
                          <p className="mt-2 text-gray-500 text-sm">
                              {liveSession.isUserSpeaking ? "Te estoy escuchando..." : liveSession.isAiSpeaking ? "Hablando..." : "Escuchando..."}
                          </p>
                      </div>
                  )}
              </div>

              {/* VISUAL CONTENT POP-UP OVERLAY */}
              {liveSession.isConnected && (liveSession.visualContent.length > 0 || liveSession.toolInUse) && (
                  <div className="fixed top-20 right-4 w-80 max-h-[80vh] bg-black/80 backdrop-blur-xl border border-cine-gold/30 rounded-xl shadow-2xl overflow-hidden flex flex-col z-50 animate-slide-in-right">
                      <div className="p-3 bg-black/60 border-b border-gray-700 flex justify-between items-center">
                          <h4 className="text-cine-gold font-bold text-sm flex items-center gap-2"><Tv size={14}/> Pantalla Compartida</h4>
                          {liveSession.toolInUse && <div className="flex items-center gap-1 text-xs text-gray-400"><Loader2 size={10} className="animate-spin"/> {liveSession.toolInUse}</div>}
                      </div>
                      <div className="overflow-y-auto p-4 space-y-4 custom-scrollbar flex-grow">
                          {liveSession.visualContent.map((item, idx) => (
                              <div key={idx} className="animate-fade-in">
                                  {item.type === 'movie' ? (
                                      <div className="transform scale-90 origin-top-left">
                                          <MovieCard movie={item.data} showRatingInput={false} />
                                      </div>
                                  ) : (
                                      <div className="flex flex-col items-center bg-cine-gray p-3 rounded-xl border border-gray-700">
                                          <div className="w-20 h-20 rounded-full border-2 border-cine-gold overflow-hidden shadow-lg mb-2">
                                              <img src={getImageUrl(item.data.profile_path, 'w200')} className="w-full h-full object-cover" alt={item.data.name} />
                                          </div>
                                          <span className="text-sm font-bold text-white">{item.data.name}</span>
                                          <span className="text-xs text-gray-500">Actor/Director</span>
                                      </div>
                                  )}
                              </div>
                          ))}
                          <div ref={(el) => el?.scrollIntoView({ behavior: 'smooth' })} />
                      </div>
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
        <div className="relative">
            {/* MAIN CHAT WINDOW */}
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

            {/* SIDE PANEL VISUALS (POP-UP) */}
            {chatVisuals.length > 0 && (
                <div className="absolute top-4 right-4 w-64 md:w-72 max-h-[500px] bg-black/80 backdrop-blur-xl border border-cine-gold/30 rounded-xl shadow-2xl overflow-hidden flex flex-col z-50 animate-slide-in-right">
                    <div className="p-3 bg-black/60 border-b border-gray-700 flex justify-between items-center">
                        <h4 className="text-cine-gold font-bold text-sm flex items-center gap-2"><Tv size={14}/> Contexto Visual</h4>
                        <button onClick={() => setChatVisuals([])} className="text-gray-400 hover:text-white"><X size={14}/></button>
                    </div>
                    <div className="overflow-y-auto p-4 space-y-4 custom-scrollbar flex-grow">
                        {chatVisuals.map((item, idx) => (
                            <div key={idx} className="animate-fade-in">
                                {item.type === 'movie' ? (
                                    <div className="transform scale-90 origin-top-left">
                                        <MovieCard movie={item.data} showRatingInput={false} />
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center bg-cine-gray p-3 rounded-xl border border-gray-700">
                                        <div className="w-20 h-20 rounded-full border-2 border-cine-gold overflow-hidden shadow-lg mb-2">
                                            <img src={getImageUrl(item.data.profile_path, 'w200')} className="w-full h-full object-cover" alt={item.data.name} />
                                        </div>
                                        <span className="text-sm font-bold text-white text-center">{item.data.name}</span>
                                        <span className="text-xs text-gray-500">{item.data.known_for_department}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      )}
    </div>
  );
};

export default Recommendations;
