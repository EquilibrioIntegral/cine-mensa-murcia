

import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { getMovieRecommendations, sendChatToGemini } from '../services/geminiService';
import MovieCard from '../components/MovieCard';
import { Sparkles, Loader2, RefreshCw, AlertTriangle, MessageSquare, Bot, Send, User as UserIcon, Mic, MicOff, Volume2, VolumeX, Zap } from 'lucide-react';
import { Movie, ChatMessage } from '../types';

const Recommendations: React.FC = () => {
  const { user, movies, userRatings, tmdbToken } = useData();
  const [activeTab, setActiveTab] = useState<'simple' | 'chat'>('simple');
  
  // Simple Mode State
  const [recommendations, setRecommendations] = useState<Movie[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [errorRecs, setErrorRecs] = useState('');

  // Chat Mode State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Voice State
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const recognitionRef = useRef<any>(null);

  // --- VOICE HANDLERS ---
  const toggleListening = () => {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
          alert("Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.");
          return;
      }

      if (isListening) {
          recognitionRef.current?.stop();
          setIsListening(false);
          return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'es-ES';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      
      recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          // If final, append. If interim, could show preview but simpler to just set input
          if (event.results[0].isFinal) {
             setInputMessage(prev => prev + (prev ? ' ' : '') + transcript);
          }
      };

      recognitionRef.current = recognition;
      recognition.start();
  };

  const speakText = (text: string) => {
      if (!text || !voiceEnabled) return;
      window.speechSynthesis.cancel(); // Stop previous
      
      // Clean markdown stars/formatting for speech
      const cleanText = text.replace(/[\*#_]/g, '');
      
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'es-ES';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      
      window.speechSynthesis.speak(utterance);
  };

  // --- SIMPLE HANDLER ---
  const handleGetRecommendations = async () => {
    if (!user) return;
    
    if (!tmdbToken) {
        setErrorRecs("Necesitas configurar el Token de TMDB en el Panel de Admin primero.");
        return;
    }

    if (userRatings.length < 1) {
        setErrorRecs("Necesitas valorar al menos una película para que la IA conozca tus gustos.");
        return;
    }

    setLoadingRecs(true);
    setErrorRecs('');
    
    const watched = movies.filter(m => user.watchedMovies.includes(m.id));
    const watchlist = movies.filter(m => user.watchlist.includes(m.id));
    
    try {
      const recs = await getMovieRecommendations(watched, watchlist, userRatings, tmdbToken);
      if (recs.length === 0) {
          setErrorRecs("La IA no encontró coincidencias exactas en TMDB o falló al generar.");
      } else {
          setRecommendations(recs);
      }
    } catch (err: any) {
      console.error(String(err));
      setErrorRecs('La IA está tomando un descanso para comer palomitas. Inténtalo de nuevo.');
    } finally {
      setLoadingRecs(false);
    }
  };

  // --- CHAT HANDLER ---
  const handleSendMessage = async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!inputMessage.trim() || chatLoading) return;
      if (!user) return;

      const newUserMsg: ChatMessage = { role: 'user', text: inputMessage };
      setChatHistory(prev => [...prev, newUserMsg]);
      setInputMessage('');
      setChatLoading(true);

      const watched = movies.filter(m => user.watchedMovies.includes(m.id));
      const watchlist = movies.filter(m => user.watchlist.includes(m.id));

      try {
          // Pass tmdbToken now
          const response = await sendChatToGemini(chatHistory, newUserMsg.text, watched, watchlist, userRatings, tmdbToken);
          
          setChatHistory(prev => [...prev, { 
              role: 'model', 
              text: response.text, 
              relatedMovies: response.movies 
          }]);

          if (voiceEnabled) {
              speakText(response.text);
          }

      } catch (error) {
          // SANITIZED LOGGING HERE
          console.error("Chat UI Error:", String(error));
          setChatHistory(prev => [...prev, { role: 'model', text: "Error de comunicación. Intenta de nuevo." }]);
      } finally {
          setChatLoading(false);
      }
  };

  useEffect(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, chatLoading]);


  return (
    <div className="container mx-auto px-4 py-8 pb-20 max-w-6xl">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-3 bg-cine-gold/10 rounded-full mb-4">
            <Sparkles className="text-cine-gold" size={32} />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">IA Sommelier de Cine</h2>
        <p className="text-gray-400 max-w-lg mx-auto">
            El poder de Gemini AI para analizar tus gustos cinematográficos.
        </p>
      </div>

      {/* TABS */}
      <div className="flex justify-center mb-8 gap-4 bg-cine-gray p-1 rounded-full w-fit mx-auto border border-gray-800">
          <button 
            onClick={() => setActiveTab('simple')}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${activeTab === 'simple' ? 'bg-cine-gold text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
              <Zap size={20} /> Recomendación Rápida
          </button>
          <button 
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all ${activeTab === 'chat' ? 'bg-cine-gold text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
              <Bot size={20} /> Chat Experto
          </button>
      </div>

      {/* --- SIMPLE MODE VIEW --- */}
      {activeTab === 'simple' && (
          <div className="animate-fade-in">
             <div className="flex flex-col items-center mb-12">
                <button 
                    onClick={handleGetRecommendations}
                    disabled={loadingRecs}
                    className="bg-gradient-to-r from-cine-gold to-yellow-600 text-black font-bold text-lg px-8 py-4 rounded-full shadow-lg hover:shadow-cine-gold/20 hover:scale-105 transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                >
                    {loadingRecs ? <Loader2 className="animate-spin" /> : <Sparkles />}
                    {loadingRecs ? 'Analizando tu perfil...' : 'Analizar mis gustos y recomendar 10 películas'}
                </button>
                {errorRecs && (
                    <div className="mt-4 text-red-400 bg-red-900/20 px-4 py-2 rounded-lg border border-red-900 flex items-center gap-2">
                        <AlertTriangle size={18} /> {errorRecs}
                    </div>
                )}
             </div>

             {loadingRecs && (
                 <div className="text-center py-12">
                     <p className="text-cine-gold animate-pulse text-xl">Consultando la base de datos de TMDB y cruzando con tus notas...</p>
                 </div>
             )}

             {recommendations.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                    {recommendations.map(movie => (
                        <MovieCard key={movie.id} movie={movie} showRatingInput={false} />
                    ))}
                </div>
             )}
             
             {!loadingRecs && recommendations.length === 0 && !errorRecs && (
                 <div className="text-center py-10 opacity-50">
                     <p>Pulsa el botón para recibir 10 recomendaciones personalizadas basadas en tus valoraciones.</p>
                 </div>
             )}
          </div>
      )}

      {/* --- CHAT MODE VIEW --- */}
      {activeTab === 'chat' && (
        <div className="bg-cine-gray rounded-2xl border border-gray-800 overflow-hidden shadow-2xl h-[600px] flex flex-col animate-fade-in relative">
            
            {/* Chat Header */}
            <div className="bg-black/40 p-4 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-cine-gold/20 rounded-full">
                        <Bot className="text-cine-gold" size={24} />
                    </div>
                    <div>
                        <h3 className="text-white font-bold">Asistente Cine Mensa</h3>
                        <p className="text-xs text-green-400 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Online
                        </p>
                    </div>
                </div>
                
                <button 
                    onClick={() => {
                        const newState = !voiceEnabled;
                        setVoiceEnabled(newState);
                        if (!newState) window.speechSynthesis.cancel();
                    }}
                    className={`p-2 rounded-full transition-colors ${voiceEnabled ? 'bg-cine-gold text-black' : 'bg-gray-800 text-gray-400'}`}
                    title={voiceEnabled ? "Desactivar voz" : "Activar lectura por voz"}
                >
                    {voiceEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                </button>
            </div>

            {/* Chat Messages Area */}
            <div className="flex-grow overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]">
                {chatHistory.length === 0 && (
                    <div className="text-center py-10 opacity-60">
                        <MessageSquare className="mx-auto mb-4 text-cine-gold" size={48} />
                        <h4 className="text-xl font-bold text-white mb-2">¡Bienvenido al Chat!</h4>
                        <p className="text-gray-400 text-sm max-w-sm mx-auto mb-6">
                            Soy tu experto personal. Conozco todas las películas que has visto y tus notas detalladas.
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                            <span className="bg-black/40 px-3 py-1 rounded-full text-xs text-gray-300 border border-gray-700">"Quiero algo triste para llorar hoy"</span>
                            <span className="bg-black/40 px-3 py-1 rounded-full text-xs text-gray-300 border border-gray-700">"Recomiéndame un thriller con giro final"</span>
                        </div>
                    </div>
                )}

                {chatHistory.map((msg, idx) => (
                    <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            {msg.role === 'model' && (
                                <div className="w-8 h-8 rounded-full bg-cine-gray border border-cine-gold flex items-center justify-center flex-shrink-0 mt-1">
                                    <Bot size={16} className="text-cine-gold" />
                                </div>
                            )}
                            {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 mt-1">
                                    <UserIcon size={16} className="text-white" />
                                </div>
                            )}

                            <div className={`
                                rounded-2xl p-4 text-sm leading-relaxed shadow-lg
                                ${msg.role === 'user' 
                                    ? 'bg-cine-gold text-cine-dark font-medium rounded-tr-none' 
                                    : 'bg-black/60 text-gray-200 border border-gray-800 rounded-tl-none'}
                            `}>
                                {msg.text.split('\n').map((line, i) => (
                                    <p key={i} className="min-h-[1em] mb-1 last:mb-0">
                                        {line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').split(/(<strong>.*?<\/strong>)/).map((part, j) => 
                                            part.startsWith('<strong>') ? <strong key={j} className="text-cine-gold/90">{part.replace(/<\/?strong>/g, '')}</strong> : part
                                        )}
                                    </p>
                                ))}
                            </div>
                        </div>

                        {/* RENDER ATTACHED MOVIES IF ANY */}
                        {msg.relatedMovies && msg.relatedMovies.length > 0 && (
                            <div className="mt-4 pl-12 grid grid-cols-2 md:grid-cols-3 gap-3 w-full max-w-[85%]">
                                {msg.relatedMovies.map(movie => (
                                    <div key={movie.id} className="transform scale-90 origin-top-left">
                                         <MovieCard movie={movie} showRatingInput={false} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
                
                {chatLoading && (
                     <div className="flex gap-3 justify-start">
                        <div className="w-8 h-8 rounded-full bg-cine-gray border border-cine-gold flex items-center justify-center flex-shrink-0">
                             <Bot size={16} className="text-cine-gold" />
                        </div>
                        <div className="bg-black/60 p-4 rounded-2xl rounded-tl-none border border-gray-800 flex items-center gap-2">
                             <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></span>
                             <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                             <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></span>
                        </div>
                     </div>
                )}
                <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-4 bg-black/40 border-t border-gray-800">
                <form onSubmit={handleSendMessage} className="relative flex gap-2">
                    <div className="relative flex-grow">
                        <input 
                            type="text" 
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            placeholder={isListening ? "Escuchando..." : "Escribe o usa el micrófono..."}
                            className={`w-full bg-cine-gray border ${isListening ? 'border-red-500' : 'border-gray-700'} rounded-full py-4 pl-6 pr-12 text-white placeholder-gray-500 focus:outline-none focus:border-cine-gold shadow-inner transition-colors`}
                            disabled={chatLoading}
                        />
                        <button
                            type="button"
                            onClick={toggleListening}
                            className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded-full transition-all ${isListening ? 'bg-red-600 text-white animate-pulse' : 'text-gray-400 hover:text-white'}`}
                            title="Dictar por voz"
                        >
                            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                        </button>
                    </div>

                    <button 
                        type="submit"
                        disabled={!inputMessage.trim() || chatLoading}
                        className="bg-cine-gold text-black p-4 rounded-full hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                        <Send size={24} />
                    </button>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default Recommendations;