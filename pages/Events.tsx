
import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';
import { generateCineforumEvent, personalizeCandidateReason, getModeratorResponse, getWelcomeMessage, getParticipantGreeting } from '../services/geminiService';
import { getImageUrl } from '../services/tmdbService';
import { Ticket, Sparkles, Calendar, Clock, Trophy, PlayCircle, MessageCircle, Send, Users, ChevronRight, Bot, Archive, UserCheck, Loader2, Mic, MicOff } from 'lucide-react';
import { EventCandidate } from '../types';

const Events: React.FC = () => {
  const { user, activeEvent, movies, userRatings, createEvent, closeEvent, tmdbToken, voteForCandidate, transitionEventPhase, sendEventMessage, eventMessages } = useData();
  const [generating, setGenerating] = useState(false);
  const [closing, setClosing] = useState(false);
  const [startingDiscussion, setStartingDiscussion] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [modThinking, setModThinking] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Personalized Reasons State
  const [personalizedReasons, setPersonalizedReasons] = useState<Record<number, string>>({});

  // Auto-scroll chat
  useEffect(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
  }, [eventMessages, modThinking]);

  // Effect to load personalized reasons when entering voting phase
  useEffect(() => {
      const loadPersonalization = async () => {
          if (activeEvent?.phase === 'voting' && user && activeEvent.candidates.length > 0) {
              const newReasons: Record<number, string> = {};
              // Only do this if we haven't loaded them yet to save API calls
              if (Object.keys(personalizedReasons).length === 0) {
                  for (const candidate of activeEvent.candidates) {
                      const personal = await personalizeCandidateReason(candidate.title, candidate.reason, userRatings, movies);
                      newReasons[candidate.tmdbId] = personal;
                  }
                  setPersonalizedReasons(newReasons);
              }
          }
      };
      loadPersonalization();
  }, [activeEvent, user, userRatings, movies]);


  const handleCreate = async () => {
      setGenerating(true);
      try {
          const newEventData = await generateCineforumEvent(movies, tmdbToken);
          if (newEventData) {
              await createEvent(newEventData);
          }
      } catch (e) {
          console.error("Error creating event UI:", String(e));
      } finally {
          setGenerating(false);
      }
  };

  const handleEndVoting = async () => {
      if (!activeEvent) return;
      // Calculate winner
      let winner = activeEvent.candidates[0];
      if (activeEvent.candidates.length > 0) {
          winner = activeEvent.candidates.reduce((prev, current) => {
              return (prev.votes.length > current.votes.length) ? prev : current;
          });
      }
      
      await transitionEventPhase(activeEvent.id, 'viewing', winner.tmdbId);
  };

  const handleStartDiscussion = async () => {
      if (!activeEvent || !activeEvent.winnerTmdbId) return;
      
      setStartingDiscussion(true);
      try {
          // 1. Generate Welcome Message from AI
          const winnerTitle = activeEvent.candidates.find(c => c.tmdbId === activeEvent.winnerTmdbId)?.title || "la película";
          const welcomeText = await getWelcomeMessage(winnerTitle, activeEvent.themeTitle);
          
          // 2. Transition Phase
          await transitionEventPhase(activeEvent.id, 'discussion');
          
          // 3. Post Message as Moderator
          await sendEventMessage(activeEvent.id, welcomeText, 'moderator');
          
      } catch (e) {
          console.error("Error starting discussion:", String(e));
          // Fallback transition if AI fails
          await transitionEventPhase(activeEvent.id, 'discussion');
      } finally {
          setStartingDiscussion(false);
      }
  };

  const handleCloseEvent = async (e: React.MouseEvent) => {
      // Prevent event propagation and avoid confirm dialogs
      e.stopPropagation();
      e.preventDefault();
      if (!activeEvent) return;
      
      setClosing(true);
      try {
         await closeEvent(activeEvent.id);
         // Local state update is handled in context via optimistic UI
      } catch(e) {
          console.error(String(e));
      } finally {
          setClosing(false);
      }
  }

  const handleCallModerator = async (history: any[] = []) => {
      if (!activeEvent) return;
      setModThinking(true);
      try {
          const historyToUse = history.length > 0 
            ? history 
            : eventMessages.slice(-10).map(m => ({ userName: m.userName, text: m.text }));

          const modText = await getModeratorResponse(
              historyToUse,
              activeEvent.winnerTmdbId ? activeEvent.candidates.find(c => c.tmdbId === activeEvent.winnerTmdbId)?.title || "la película" : "la película",
              activeEvent.themeTitle
          );
          await sendEventMessage(activeEvent.id, modText, 'moderator');
      } catch (e) {
          console.error("Moderator error", String(e));
      } finally {
          setModThinking(false);
      }
  };

  const handleGreetNewUser = async (userName: string, message: string) => {
      if (!activeEvent) return;
      
      // Delay slightly to feel natural
      setTimeout(async () => {
          setModThinking(true);
          try {
             const winnerTitle = activeEvent.winnerTmdbId ? activeEvent.candidates.find(c => c.tmdbId === activeEvent.winnerTmdbId)?.title || "la película" : "la película";
             const greeting = await getParticipantGreeting(userName, message, winnerTitle);
             await sendEventMessage(activeEvent.id, greeting, 'moderator');
          } catch(e) {
              console.error(String(e));
          } finally {
              setModThinking(false);
          }
      }, 2000);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!chatInput.trim() || !activeEvent || !user) return;

      const userText = chatInput;
      setChatInput('');
      
      try {
        // Check if this is the FIRST time the user speaks in this event
        // We check if there are any previous messages from this user
        const hasSpokenBefore = eventMessages.some(m => m.userId === user.id);

        // 1. Send User Message
        await sendEventMessage(activeEvent.id, userText);
        
        // 2. Logic for AI Intervention
        
        // A) New User Greeting (High Priority)
        if (!hasSpokenBefore) {
            handleGreetNewUser(user.name, userText);
            return; // Exit, don't do other checks to avoid spam
        }

        // B) Direct Mention or Spontaneous
        const mentionRegex = /@(ia|moderadora|bot|sistema)/i;
        const isMentioned = mentionRegex.test(userText);
        
        const lastMessageWasBot = eventMessages.length > 0 && eventMessages[eventMessages.length - 1].role === 'moderator';
        const shouldParticipateSpontaneously = Math.random() < 0.20;

        if (isMentioned || (shouldParticipateSpontaneously && !lastMessageWasBot)) {
            const tempHistory = [
                ...eventMessages.slice(-9).map(m => ({ userName: m.userName, text: m.text })),
                { userName: user.name, text: userText }
            ];
            
            if (!isMentioned) {
                setTimeout(() => handleCallModerator(tempHistory), 2000);
            } else {
                handleCallModerator(tempHistory);
            }
        }
      } catch (e) {
          console.error(String(e));
      }
  };

  if (!activeEvent) {
      return (
          <div className="container mx-auto px-4 py-20 flex flex-col items-center justify-center text-center">
              <Ticket size={64} className="text-gray-600 mb-6" />
              <h2 className="text-3xl font-bold text-white mb-4">No hay eventos activos</h2>
              <p className="text-gray-400 max-w-md mb-8">
                  El Cineforum está descansando. Espera a la próxima convocatoria o sugiere una temática al administrador.
              </p>
              
              {user?.isAdmin && (
                  <button 
                    onClick={handleCreate}
                    disabled={generating}
                    className="bg-gradient-to-r from-cine-gold to-yellow-600 text-black font-bold py-4 px-8 rounded-full shadow-[0_0_20px_rgba(212,175,55,0.4)] hover:scale-105 transition-transform flex items-center gap-3 disabled:opacity-50 disabled:scale-100"
                  >
                      {generating ? <Loader2 className="animate-spin"/> : <Sparkles />}
                      {generating ? 'La IA está pensando...' : 'Invocar a la IA para nuevo Evento'}
                  </button>
              )}
          </div>
      );
  }

  // Determine current user vote
  const myVote = activeEvent.candidates.find(c => c.votes.includes(user?.id || ''));
  const winner = activeEvent.winnerTmdbId 
      ? activeEvent.candidates.find(c => c.tmdbId === activeEvent.winnerTmdbId) 
      : null;

  return (
    <div className="min-h-screen bg-cine-dark pb-20 relative overflow-hidden flex flex-col">
        {/* Aesthetic Background - AI Generated or Fallback */}
        <div className="absolute inset-0 z-0">
            <img 
                src={activeEvent.backdropUrl || activeEvent.candidates[0].posterUrl} 
                alt="Backdrop" 
                className="w-full h-full object-cover opacity-40 blur-sm" 
            />
            <div className="absolute inset-0 bg-gradient-to-b from-cine-dark/80 via-cine-dark/95 to-cine-dark"></div>
        </div>

        <div className="container mx-auto px-4 py-8 relative z-10 flex-grow flex flex-col">
            
            {/* FLYER HEADER */}
            <div className="text-center mb-8 animate-fade-in relative flex-shrink-0">
                {user?.isAdmin && (
                    <button 
                        onClick={handleCloseEvent}
                        disabled={closing}
                        className="absolute top-0 right-0 z-50 bg-red-900/40 hover:bg-red-900 text-red-200 p-2 rounded-lg text-xs font-bold flex items-center gap-1 border border-red-900 transition-colors disabled:opacity-50 cursor-pointer pointer-events-auto shadow-lg"
                        title="Archivar evento"
                    >
                        {closing ? <Loader2 size={14} className="animate-spin"/> : <Archive size={14} />} 
                        {closing ? 'Cerrando...' : 'Cerrar Evento'}
                    </button>
                )}

                <div className="inline-block bg-cine-gold text-black font-bold px-4 py-1 rounded-full text-sm mb-4 uppercase tracking-widest shadow-lg shadow-cine-gold/20">
                    Cineforum Oficial
                </div>
                <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 mb-2 drop-shadow-2xl uppercase italic leading-none tracking-tighter">
                    {activeEvent.themeTitle}
                </h1>
                <p className="text-xl text-gray-200 max-w-3xl mx-auto italic font-serif mb-6 leading-relaxed drop-shadow-md">
                    "{activeEvent.themeDescription}"
                </p>
                <div className="flex justify-center gap-2">
                    <span className={`px-4 py-2 rounded-full text-xs font-bold border ${activeEvent.phase === 'voting' ? 'bg-cine-gold text-black border-cine-gold' : 'bg-black/50 text-gray-500 border-gray-700'}`}>1. VOTACIÓN</span>
                    <ChevronRight className="text-gray-600 self-center"/>
                    <span className={`px-4 py-2 rounded-full text-xs font-bold border ${activeEvent.phase === 'viewing' ? 'bg-cine-gold text-black border-cine-gold' : 'bg-black/50 text-gray-500 border-gray-700'}`}>2. PROYECCIÓN</span>
                    <ChevronRight className="text-gray-600 self-center"/>
                    <span className={`px-4 py-2 rounded-full text-xs font-bold border ${activeEvent.phase === 'discussion' ? 'bg-cine-gold text-black border-cine-gold' : 'bg-black/50 text-gray-500 border-gray-700'}`}>3. DEBATE</span>
                </div>
            </div>

            {/* PHASE 1: VOTING */}
            {activeEvent.phase === 'voting' && (
                <div className="max-w-6xl mx-auto animate-fade-in pb-10">
                    <div className="bg-gradient-to-r from-cine-gold/20 to-transparent border-l-4 border-cine-gold p-6 rounded-r-xl mb-12 flex items-start gap-4">
                        <Sparkles className="text-cine-gold shrink-0 mt-1" size={32} />
                        <div>
                            <h3 className="font-bold text-2xl text-cine-gold mb-2">Elección de la Comunidad</h3>
                            <p className="text-gray-200 text-lg">{activeEvent.aiReasoning}</p>
                            <p className="text-sm text-gray-400 mt-3 flex items-center gap-1"><Clock size={14}/> La votación se cierra en 7 días.</p>
                        </div>
                    </div>

                    <h2 className="text-2xl font-black text-white text-center mb-8 tracking-widest uppercase border-b border-gray-800 pb-4">
                        <span className="text-cine-gold">///</span> Candidatas Oficiales
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {activeEvent.candidates.map(candidate => {
                            const totalVotes = activeEvent.candidates.reduce((acc, c) => acc + c.votes.length, 0);
                            const percent = totalVotes > 0 
                                ? Math.round((candidate.votes.length / totalVotes) * 100) 
                                : 0;
                            const isSelected = myVote?.tmdbId === candidate.tmdbId;
                            const displayReason = personalizedReasons[candidate.tmdbId] || candidate.reason;

                            return (
                                <div key={candidate.tmdbId} className={`group relative rounded-2xl overflow-hidden border-2 transition-all cursor-pointer flex flex-col bg-cine-gray ${isSelected ? 'border-cine-gold shadow-[0_0_30px_rgba(212,175,55,0.2)] scale-105 z-10' : 'border-gray-800 hover:border-gray-500'}`}
                                     onClick={() => voteForCandidate(activeEvent.id, candidate.tmdbId)}
                                >
                                    <div className="aspect-[2/3] relative overflow-hidden">
                                        <img src={candidate.posterUrl} alt={candidate.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80"></div>
                                        <div className="absolute bottom-0 left-0 w-full p-4">
                                            <h3 className="text-2xl font-bold text-white leading-none mb-1">{candidate.title}</h3>
                                            <p className="text-cine-gold font-bold">{candidate.year}</p>
                                        </div>
                                        {isSelected && (
                                            <div className="absolute top-2 right-2 bg-cine-gold text-black p-2 rounded-full shadow-lg">
                                                <Ticket size={24} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-5 flex flex-col flex-grow">
                                        <div className="mb-6 flex-grow">
                                            {personalizedReasons[candidate.tmdbId] ? (
                                                <p className="text-xs text-cine-gold font-bold uppercase mb-2 flex items-center gap-1 tracking-wider"><UserCheck size={14}/> Para ti:</p>
                                            ) : (
                                                <p className="text-xs text-gray-500 font-bold uppercase mb-2 tracking-wider">La Propuesta:</p>
                                            )}
                                            {/* Removed line-clamp to show full text */}
                                            <p className="text-gray-300 italic leading-relaxed text-sm">"{displayReason}"</p>
                                        </div>
                                        
                                        <div className="mt-auto pt-4 border-t border-gray-800">
                                            <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
                                                <span>Votos de socios</span>
                                                <span>{percent}%</span>
                                            </div>
                                            <div className="w-full bg-black h-3 rounded-full overflow-hidden border border-gray-700">
                                                <div className="bg-cine-gold h-full transition-all duration-1000" style={{ width: `${percent}%` }}></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {user?.isAdmin && (
                        <div className="mt-16 text-center">
                            <button onClick={handleEndVoting} className="bg-white/5 hover:bg-white/10 text-white px-8 py-3 rounded-full text-sm font-bold border border-white/20 transition-all hover:scale-105">
                                Admin: Cerrar Votación y Elegir Ganadora
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* PHASE 2: VIEWING */}
            {activeEvent.phase === 'viewing' && winner && (
                <div className="max-w-4xl mx-auto text-center animate-fade-in flex-grow flex flex-col justify-center">
                    <Trophy className="text-cine-gold mx-auto mb-4 animate-bounce" size={64} />
                    <h2 className="text-3xl font-bold text-white mb-2">¡TENEMOS GANADORA!</h2>
                    <p className="text-gray-400 mb-8">La comunidad ha hablado. Preparen las palomitas.</p>
                    
                    <div className="bg-cine-gray rounded-xl border border-cine-gold overflow-hidden shadow-[0_0_50px_rgba(212,175,55,0.2)] max-w-md mx-auto relative group">
                        <img src={winner.posterUrl} alt={winner.title} className="w-full opacity-80 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute bottom-0 w-full bg-gradient-to-t from-black to-transparent p-6 pt-20">
                            <h3 className="text-3xl font-bold text-white mb-1">{winner.title}</h3>
                            <p className="text-cine-gold font-bold">{winner.year}</p>
                        </div>
                    </div>

                    <div className="mt-10">
                         <div className="inline-flex items-center gap-2 bg-black/40 px-6 py-3 rounded-lg border border-gray-700">
                             <Clock className="text-gray-400" />
                             <div className="text-left">
                                 <p className="text-xs text-gray-500 uppercase font-bold">Tiempo para verla</p>
                                 <p className="text-white font-mono">7 DÍAS</p>
                             </div>
                         </div>
                    </div>

                    {user?.isAdmin && (
                        <div className="mt-8">
                            <button 
                                onClick={handleStartDiscussion}
                                disabled={startingDiscussion}
                                className="bg-cine-gold text-black px-6 py-3 rounded-full font-bold hover:bg-white transition-colors flex items-center gap-2 mx-auto disabled:opacity-50"
                            >
                                {startingDiscussion ? <Loader2 className="animate-spin" size={18}/> : <MessageCircle size={18}/>}
                                {startingDiscussion ? 'Preparando Sala...' : 'Admin: Abrir Sala de Debate'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* PHASE 3: DISCUSSION (CHAT) */}
            {activeEvent.phase === 'discussion' && (
                <div className="flex-grow flex flex-col h-[65vh] md:h-[600px] bg-cine-gray rounded-xl border border-gray-800 overflow-hidden shadow-2xl animate-fade-in max-w-5xl mx-auto w-full">
                    {/* Chat Header */}
                    <div className="bg-black/40 p-4 border-b border-gray-800 flex justify-between items-center flex-shrink-0">
                         <div className="flex items-center gap-3">
                             <div className="relative">
                                 <MessageCircle className="text-cine-gold" size={24} />
                                 <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                             </div>
                             <div>
                                 <h3 className="font-bold text-white">Sala de Debate: En Vivo</h3>
                                 <p className="text-xs text-gray-400">Moderado por IA</p>
                             </div>
                         </div>
                         {user?.isAdmin && (
                             <button 
                                onClick={() => handleCallModerator()}
                                disabled={modThinking}
                                className="text-xs bg-cine-gold/20 text-cine-gold px-3 py-1 rounded border border-cine-gold/30 hover:bg-cine-gold/30 disabled:opacity-50"
                             >
                                {modThinking ? 'IA Pensando...' : 'Invocar Moderadora'}
                             </button>
                         )}
                    </div>

                    {/* Chat Messages */}
                    <div 
                        ref={chatContainerRef}
                        className="flex-grow overflow-y-auto p-4 space-y-4 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] custom-scrollbar"
                    >
                        {eventMessages.length === 0 && (
                            <div className="text-center py-10 opacity-50">
                                <p>La sala está abierta. ¡Sé el primero en opinar!</p>
                            </div>
                        )}

                        {eventMessages.map(msg => {
                            const isMe = msg.userId === user?.id;
                            const isMod = msg.role === 'moderator';
                            
                            return (
                                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`flex gap-3 max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                        <div className="flex-shrink-0 flex flex-col items-center">
                                            <img 
                                                src={msg.userAvatar} 
                                                className={`w-8 h-8 rounded-full border ${isMod ? 'border-cine-gold' : 'border-gray-700'}`} 
                                                alt="Avatar" 
                                            />
                                            {isMod && <span className="text-[10px] text-cine-gold font-bold mt-1">HOST</span>}
                                        </div>
                                        
                                        <div className={`
                                            p-3 rounded-2xl text-sm shadow-sm
                                            ${isMe 
                                                ? 'bg-blue-600 text-white rounded-tr-none' // YOU: Distinct Blue
                                                : isMod 
                                                    ? 'bg-black/80 text-cine-gold border border-cine-gold rounded-tl-none shadow-[0_0_15px_rgba(212,175,55,0.15)]' // AI: Premium Gold/Black
                                                    : 'bg-gray-700 text-white border border-gray-600 rounded-tl-none'} // OTHERS: White Text/Gray Bg
                                        `}>
                                            {!isMe && !isMod && <p className="text-xs text-gray-400 font-bold mb-1">{msg.userName}</p>}
                                            <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                                            <span className={`text-[10px] block text-right mt-1 ${isMod ? 'text-cine-gold/50' : 'opacity-50'}`}>
                                                {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {modThinking && (
                             <div className="flex justify-start">
                                 <div className="flex gap-3 max-w-[85%]">
                                     <div className="w-8 h-8 rounded-full bg-cine-gray border border-cine-gold flex items-center justify-center">
                                         <Bot size={16} className="text-cine-gold" />
                                     </div>
                                     <div className="bg-cine-gold/10 p-3 rounded-2xl rounded-tl-none border border-cine-gold/20 flex items-center gap-2">
                                         <span className="text-xs text-cine-gold">Escribiendo</span>
                                         <span className="w-1 h-1 bg-cine-gold rounded-full animate-bounce"></span>
                                         <span className="w-1 h-1 bg-cine-gold rounded-full animate-bounce delay-100"></span>
                                         <span className="w-1 h-1 bg-cine-gold rounded-full animate-bounce delay-200"></span>
                                     </div>
                                 </div>
                             </div>
                        )}
                        <div ref={chatRef} />
                    </div>

                    {/* Input Area (Mobile Friendly) */}
                    <div className="p-3 bg-black/80 border-t border-gray-800 flex-shrink-0">
                        <form onSubmit={handleSendMessage} className="flex gap-2">
                            <input 
                                type="text" 
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder="Escribe tu opinión... (@ia para preguntar al host)"
                                className="flex-grow bg-gray-900 border border-gray-700 rounded-full px-4 py-3 text-white focus:border-cine-gold outline-none text-sm"
                            />
                            <button 
                                type="submit" 
                                disabled={!chatInput.trim()}
                                className="bg-cine-gold text-black p-3 rounded-full hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100"
                            >
                                <Send size={20} />
                            </button>
                        </form>
                    </div>
                </div>
            )}

        </div>
    </div>
  );
};

export default Events;