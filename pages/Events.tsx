
import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';
import { generateCineforumEvent, personalizeCandidateReason, generateTVShowIntro, generateTVHostComment } from '../services/geminiService';
import { Ticket, Sparkles, Calendar, Clock, Trophy, PlayCircle, MessageCircle, Send, Users, ChevronRight, Bot, Archive, UserCheck, Loader2, Info, Eye, Check, Hand, CalendarCheck, ChevronDown, ChevronUp, AlertTriangle, Radio, Tv } from 'lucide-react';
import { EventCandidate } from '../types';

const TIME_CATEGORIES = [
    { 
        id: 'fri_night', 
        label: 'Viernes Noche', 
        hours: ['20:00', '21:00', '22:00', '23:00', '00:00'] 
    },
    { 
        id: 'sat_morning', 
        label: 'Sábado Mañana', 
        hours: ['10:00', '11:00', '12:00', '13:00'] 
    },
    { 
        id: 'sat_afternoon', 
        label: 'Sábado Tarde', 
        hours: ['16:00', '17:00', '18:00', '19:00'] 
    },
    { 
        id: 'sat_night', 
        label: 'Sábado Noche', 
        hours: ['20:00', '21:00', '22:00', '23:00', '00:00'] 
    },
    { 
        id: 'sun_morning', 
        label: 'Domingo Mañana', 
        hours: ['10:00', '11:00', '12:00', '13:00'] 
    },
    { 
        id: 'sun_afternoon', 
        label: 'Domingo Tarde', 
        hours: ['16:00', '17:00', '18:00', '19:00'] 
    },
    { 
        id: 'sun_night', 
        label: 'Domingo Noche', 
        hours: ['20:00', '21:00', '22:00', '23:00'] 
    }
];

const Events: React.FC = () => {
  const { user, activeEvent, movies, allUsers, userRatings, createEvent, closeEvent, tmdbToken, voteForCandidate, transitionEventPhase, sendEventMessage, eventMessages, toggleEventCommitment, toggleTimeVote } = useData();
  const [generating, setGenerating] = useState(false);
  const [closing, setClosing] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [modThinking, setModThinking] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const silenceTimerRef = useRef<number | null>(null);

  // Expanded Time Categories
  const [expandedTimeCat, setExpandedTimeCat] = useState<string | null>(null);

  // Personalized Reasons
  const [personalizedReasons, setPersonalizedReasons] = useState<Record<number, string>>({});

  // Auto-scroll chat
  useEffect(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
  }, [eventMessages, modThinking]);

  // AUTO-PARTICIPATION LOGIC (TV HOST)
  useEffect(() => {
      if (activeEvent?.phase !== 'discussion') return;

      // Clear existing timer on any new message
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      // If last message was user (not host), verify if Host should reply immediately
      const lastMsg = eventMessages[eventMessages.length - 1];
      
      if (lastMsg && lastMsg.role !== 'moderator') {
          // IMMEDIATE REPLY: If user mentioned @ia or just to keep flow (random chance)
          // For this requirement: "animandolos a hablar haciendoles preguntas por sus nombres"
          // We will reply frequently to keep it "TV Show" style.
          const shouldReply = Math.random() < 0.7; // 70% chance to reply to a user directly to simulate host engagement
          
          if (shouldReply) {
              const t = setTimeout(() => triggerAIResponse('reply'), 3000); // 3s delay for realism
              return () => clearTimeout(t);
          }
      }

      // SILENCE BREAKER: If no one speaks for 45 seconds, Host jumps in.
      silenceTimerRef.current = window.setTimeout(() => {
          triggerAIResponse('silence_breaker');
      }, 45000); 

      return () => {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      }
  }, [eventMessages, activeEvent?.phase]);

  const triggerAIResponse = async (type: 'reply' | 'silence_breaker') => {
      if (!activeEvent) return;
      
      setModThinking(true);
      try {
          const winnerTitle = activeEvent.winnerTmdbId 
              ? activeEvent.candidates.find(c => c.tmdbId === activeEvent.winnerTmdbId)?.title || "la película" 
              : "la película";
          
          const comment = await generateTVHostComment(
              eventMessages.slice(-10).map(m => ({ userName: m.userName, text: m.text })), 
              winnerTitle,
              type
          );
          
          if (comment) {
              await sendEventMessage(activeEvent.id, comment, 'moderator');
          }
      } catch (e) {
          console.error(e);
      } finally {
          setModThinking(false);
      }
  }

  // Handle Event Creation
  const handleCreate = async () => {
      setGenerating(true);
      try {
          const newEventData = await generateCineforumEvent(movies, allUsers, tmdbToken);
          if (newEventData) await createEvent(newEventData);
      } catch (e) { console.error(String(e)); } finally { setGenerating(false); }
  };

  // Admin Controls
  const handleForceEndVoting = async () => {
      if (!activeEvent) return;
      let winner = activeEvent.candidates[0];
      if (activeEvent.candidates.length > 0) {
          winner = activeEvent.candidates.reduce((prev: EventCandidate, current: EventCandidate) => (prev.votes.length > current.votes.length) ? prev : current);
      }
      await transitionEventPhase(activeEvent.id, 'viewing', winner.tmdbId);
  };

  const handleStartShow = async () => {
      if (!activeEvent || !activeEvent.winnerTmdbId) return;
      
      try {
          await transitionEventPhase(activeEvent.id, 'discussion');
          
          setModThinking(true);
          const winner = activeEvent.candidates.find(c => c.tmdbId === activeEvent.winnerTmdbId);
          // Only Admin triggers the Intro Monologue
          const intro = await generateTVShowIntro(
              winner?.title || "la película", 
              activeEvent.themeTitle,
              movies.find(m => m.tmdbId === activeEvent.winnerTmdbId)?.director || "el director"
          );
          
          await sendEventMessage(activeEvent.id, intro, 'moderator');
      } catch (e) { 
          console.error(String(e)); 
      } finally { 
          setModThinking(false); 
      }
  };

  const handleCloseEvent = async (e: React.MouseEvent) => {
      e.stopPropagation(); e.preventDefault();
      if (!activeEvent) return;
      setClosing(true);
      try { await closeEvent(activeEvent.id); } catch(e) { console.error(String(e)); } finally { setClosing(false); }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!chatInput.trim() || !activeEvent || !user) return;
      const userText = chatInput;
      setChatInput('');
      try {
        await sendEventMessage(activeEvent.id, userText);
        // AI response is handled by useEffect
      } catch (e) { console.error(String(e)); }
  };

  // Personalization Loading
  useEffect(() => {
      const loadPersonalization = async () => {
          if (activeEvent?.phase === 'voting' && user && activeEvent.candidates.length > 0) {
              for (const candidate of activeEvent.candidates) {
                  if (personalizedReasons[candidate.tmdbId]) continue;
                  try {
                      const personal = await personalizeCandidateReason(candidate.title, candidate.reason, userRatings, movies);
                      setPersonalizedReasons(prev => ({ ...prev, [candidate.tmdbId]: personal }));
                  } catch (e) { console.error(String(e)); }
              }
          }
      };
      loadPersonalization();
  }, [activeEvent, user, userRatings, movies]);


  // --- VIEW RENDERING ---

  if (!activeEvent) {
      return (
          <div className="container mx-auto px-4 py-20 flex flex-col items-center justify-center text-center">
              <Ticket size={64} className="text-gray-600 mb-6" />
              <h2 className="text-3xl font-bold text-white mb-4">No hay eventos activos</h2>
              {user?.isAdmin && (
                  <button onClick={handleCreate} disabled={generating} className="bg-gradient-to-r from-cine-gold to-yellow-600 text-black font-bold py-4 px-8 rounded-full flex items-center gap-3 disabled:opacity-50">
                      {generating ? <Loader2 className="animate-spin"/> : <Sparkles />}
                      {generating ? 'La IA está pensando...' : 'Invocar a la IA para nuevo Evento'}
                  </button>
              )}
          </div>
      );
  }

  const myVote = activeEvent.candidates.find(c => c.votes.includes(user?.id || ''));
  let winner: EventCandidate | undefined | null = null;
  if (activeEvent.winnerTmdbId) {
      winner = activeEvent.candidates.find(c => c.tmdbId === activeEvent.winnerTmdbId);
  }

  const votingEndDate = new Date(activeEvent.votingDeadline).toLocaleDateString();
  const viewingEndDate = new Date(activeEvent.viewingDeadline).toLocaleDateString();

  const votingStartExact = new Date(activeEvent.startDate).toLocaleTimeString([], {year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'});
  const votingEndExact = new Date(activeEvent.votingDeadline).toLocaleTimeString([], {year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'});

  return (
    <div className="min-h-screen bg-cine-dark pb-20 relative overflow-hidden flex flex-col">
        <div className="absolute inset-0 z-0">
            <img src={activeEvent.backdropUrl || activeEvent.candidates[0].posterUrl} alt="Backdrop" className="w-full h-full object-cover opacity-65" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-cine-dark/70 to-cine-dark"></div>
        </div>
        
        <div className="container mx-auto px-4 py-8 relative z-10 flex-grow flex flex-col">
            <div className="text-center mb-8 animate-fade-in relative flex-shrink-0">
                {user?.isAdmin && (
                    <button onClick={handleCloseEvent} disabled={closing} className="absolute top-0 right-0 z-50 bg-red-900/60 hover:bg-red-900 text-red-100 p-2 rounded-lg text-xs font-bold flex items-center gap-1 border border-red-800 disabled:opacity-50 backdrop-blur-sm cursor-pointer">
                        {closing ? <Loader2 size={14} className="animate-spin"/> : <Archive size={14} />} 
                        {closing ? 'Cerrando...' : 'Cerrar Evento'}
                    </button>
                )}
                <div className="inline-block bg-cine-gold text-black font-bold px-4 py-1 rounded-full text-sm mb-4 uppercase tracking-widest shadow-lg shadow-cine-gold/20">Cineforum Oficial</div>
                <h1 className="text-4xl md:text-6xl font-black text-white mb-2 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] uppercase italic leading-none tracking-tighter">{activeEvent.themeTitle}</h1>
                <p className="text-xl text-white max-w-3xl mx-auto italic font-serif mb-6 leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">"{activeEvent.themeDescription}"</p>
                
                <div className="flex justify-center gap-2 drop-shadow-md">
                    <span className={`px-4 py-2 rounded-full text-xs font-bold border ${activeEvent.phase === 'voting' ? 'bg-cine-gold text-black border-cine-gold' : 'bg-black/60 text-gray-400 border-gray-600'}`}>1. VOTACIÓN</span>
                    <ChevronRight className="text-gray-400 self-center"/>
                    <span className={`px-4 py-2 rounded-full text-xs font-bold border ${activeEvent.phase === 'viewing' ? 'bg-cine-gold text-black border-cine-gold' : 'bg-black/60 text-gray-400 border-gray-600'}`}>2. PROYECCIÓN</span>
                    <ChevronRight className="text-gray-400 self-center"/>
                    <span className={`px-4 py-2 rounded-full text-xs font-bold border ${activeEvent.phase === 'discussion' ? 'bg-red-600 text-white border-red-500 animate-pulse' : 'bg-black/60 text-gray-400 border-gray-600'}`}>3. EL SHOW</span>
                </div>
            </div>

            {activeEvent.phase === 'voting' && (
                <div className="max-w-6xl mx-auto animate-fade-in pb-10">
                    <div className="bg-black/40 backdrop-blur-md border-l-4 border-cine-gold p-6 rounded-r-xl mb-8 flex flex-col md:flex-row items-start gap-6 shadow-lg">
                        <div className="flex-grow">
                             <div className="flex items-center gap-2 text-cine-gold font-bold text-lg mb-2"><Sparkles size={20}/> Elección de la Comunidad</div>
                             <p className="text-gray-200 mb-3">{activeEvent.aiReasoning}</p>
                             <div className="bg-black/40 p-3 rounded-lg border border-cine-gold/20 inline-block">
                                <p className="text-sm font-bold text-gray-300 flex flex-col gap-1">
                                    <span className="flex items-center gap-2"><Calendar size={16} className="text-cine-gold"/> Inicio: <span className="text-white">{votingStartExact}</span></span>
                                    <span className="flex items-center gap-2"><Clock size={16} className="text-red-500"/> Cierre: <span className="text-white">{votingEndExact}</span></span>
                                </p>
                             </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {activeEvent.candidates.map(candidate => {
                            const totalVotes = activeEvent.candidates.reduce((acc, c) => acc + c.votes.length, 0);
                            const percent = totalVotes > 0 ? Math.round((candidate.votes.length / totalVotes) * 100) : 0;
                            const isSelected = myVote?.tmdbId === candidate.tmdbId;
                            const personalReason = personalizedReasons[candidate.tmdbId];

                            return (
                                <div key={candidate.tmdbId} className={`group relative rounded-2xl overflow-hidden border-2 transition-all cursor-pointer flex flex-col bg-cine-gray ${isSelected ? 'border-cine-gold scale-105 z-10' : 'border-gray-800 hover:border-gray-500'}`} onClick={() => voteForCandidate(activeEvent.id, candidate.tmdbId)}>
                                    <div className="aspect-[2/3] relative overflow-hidden">
                                        <img src={candidate.posterUrl} alt={candidate.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80"></div>
                                        <div className="absolute bottom-0 left-0 w-full p-4">
                                            <h3 className="text-2xl font-bold text-white leading-none mb-1">{candidate.title}</h3>
                                            <p className="text-cine-gold font-bold">{candidate.year}</p>
                                        </div>
                                        {isSelected && <div className="absolute top-2 right-2 bg-cine-gold text-black p-2 rounded-full shadow-lg"><Ticket size={24} /></div>}
                                    </div>
                                    <div className="p-5 flex flex-col flex-grow bg-cine-gray">
                                        <div className="mb-6 flex-grow space-y-4">
                                            <div><p className="text-xs text-gray-500 font-bold uppercase mb-2">La Propuesta:</p><p className="text-gray-300 text-sm">"{candidate.reason}"</p></div>
                                            <div className="bg-cine-gold/5 border-l-2 border-cine-gold pl-3 py-2 rounded-r-lg mt-3">
                                                <p className="text-xs text-cine-gold font-bold uppercase mb-2 flex items-center gap-1"><UserCheck size={14}/> Para ti:</p>
                                                {personalReason ? <p className="text-gray-200 italic text-sm animate-fade-in">"{personalReason}"</p> : <div className="flex items-center gap-2 text-gray-500 italic text-sm py-1"><Loader2 size={14} className="animate-spin text-cine-gold"/><span>IA analizando tus gustos...</span></div>}
                                            </div>
                                        </div>
                                        <div className="mt-auto pt-4 border-t border-gray-800">
                                            <div className="flex justify-between text-xs font-bold text-gray-500 mb-1"><span>Votos de socios</span><span>{percent}%</span></div>
                                            <div className="w-full bg-black h-3 rounded-full overflow-hidden border border-gray-700"><div className="bg-cine-gold h-full transition-all duration-1000" style={{ width: `${percent}%` }}></div></div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {user?.isAdmin && (
                        <div className="mt-16 text-center space-x-4">
                            <button onClick={handleForceEndVoting} className="bg-red-900/20 hover:bg-red-900 hover:text-white text-red-300 px-8 py-3 rounded-full text-sm font-bold border border-red-500/30 transition-all backdrop-blur-sm">Forzar Cierre Real</button>
                        </div>
                    )}
                </div>
            )}

            {activeEvent.phase === 'viewing' && winner && (
                <div className="max-w-5xl mx-auto animate-fade-in flex-grow flex flex-col relative">
                    <div className="text-center mb-10">
                        <Trophy className="text-cine-gold mx-auto mb-4 animate-bounce" size={64} />
                        <h2 className="text-3xl font-bold text-white mb-2">¡TENEMOS GANADORA!</h2>
                        
                        <div className="inline-flex flex-col md:flex-row gap-4 justify-center items-center bg-black/40 p-4 rounded-xl border border-cine-gold/30 mt-4">
                             <div className="flex items-center gap-2 text-gray-300 text-sm">
                                 <CalendarCheck className="text-cine-gold" size={18} />
                                 <span>Periodo:</span>
                                 <span className="text-white font-bold">{votingEndDate} - {viewingEndDate}</span>
                             </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
                        <div className="bg-cine-gray rounded-xl border border-cine-gold overflow-hidden shadow-[0_0_50px_rgba(212,175,55,0.2)] relative group mx-auto md:mx-0 max-w-sm">
                            <img src={winner.posterUrl} alt={winner.title} className="w-full opacity-90 group-hover:opacity-100 transition-opacity" />
                            <div className="absolute bottom-0 w-full bg-gradient-to-t from-black to-transparent p-6 pt-20">
                                <h3 className="text-3xl font-bold text-white mb-1">{winner.title}</h3>
                                <p className="text-cine-gold font-bold">{winner.year}</p>
                            </div>
                        </div>

                        <div className="space-y-8 bg-black/40 p-6 rounded-2xl border border-gray-700 backdrop-blur-sm">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Users className="text-cine-gold"/> Participación</h3>
                            
                            <div className="border-b border-gray-700 pb-6">
                                <div className="flex justify-between items-center mb-4"><h4 className="text-gray-300 font-bold">Espectadores</h4><span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400">{activeEvent.committedViewers?.length || 0}</span></div>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {activeEvent.committedViewers?.map(uid => { const u = allUsers.find(user => user.id === uid); return u ? <img key={uid} src={u.avatarUrl} title={u.name} className="w-8 h-8 rounded-full border border-gray-600" /> : null; })}
                                </div>
                                <button onClick={() => toggleEventCommitment(activeEvent.id, 'view')} className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${activeEvent.committedViewers?.includes(user?.id || '') ? 'bg-green-900/40 text-green-400 border border-green-600' : 'bg-gray-700 text-white hover:bg-white hover:text-black'}`}>
                                    {activeEvent.committedViewers?.includes(user?.id || '') ? <Check size={18}/> : <Eye size={18}/>} {activeEvent.committedViewers?.includes(user?.id || '') ? 'Me he comprometido' : 'Me comprometo a verla'}
                                </button>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-4"><h4 className="text-gray-300 font-bold">Contertulios (Debate)</h4><span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400">{activeEvent.committedDebaters?.length || 0}</span></div>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {activeEvent.committedDebaters?.map(uid => { const u = allUsers.find(user => user.id === uid); return u ? <img key={uid} src={u.avatarUrl} title={u.name} className="w-8 h-8 rounded-full border border-gray-600" /> : null; })}
                                </div>
                                <button onClick={() => toggleEventCommitment(activeEvent.id, 'debate')} className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${activeEvent.committedDebaters?.includes(user?.id || '') ? 'bg-cine-gold/20 text-cine-gold border border-cine-gold' : 'bg-gray-700 text-white hover:bg-white hover:text-black'}`}>
                                    {activeEvent.committedDebaters?.includes(user?.id || '') ? <Check size={18}/> : <Hand size={18}/>} {activeEvent.committedDebaters?.includes(user?.id || '') ? 'Asistencia Confirmada' : 'Asistiré al debate'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {user?.isAdmin && (
                        <div className="mt-12 text-center flex flex-col gap-4 items-center">
                            <button onClick={handleStartShow} className="bg-red-600 hover:bg-red-500 text-white text-lg px-8 py-4 rounded-full font-bold shadow-[0_0_30px_rgba(220,38,38,0.5)] flex items-center gap-2 animate-pulse">
                                <Radio size={24}/> INICIAR EMISIÓN EN DIRECTO
                            </button>
                        </div>
                    )}
                </div>
            )}

            {activeEvent.phase === 'discussion' && (
                <div className="flex-grow flex flex-col h-[65vh] md:h-[600px] min-h-[60dvh] bg-gray-900 rounded-xl border-4 border-gray-800 overflow-hidden shadow-2xl animate-fade-in max-w-5xl mx-auto w-full relative">
                    
                    {/* TV HEADER */}
                    <div className="bg-black p-4 border-b-4 border-gray-800 flex items-center justify-between z-50 shadow-xl">
                        <div className="flex items-center gap-4">
                            <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse shadow-[0_0_10px_red]"></div>
                            <div>
                                <h3 className="font-black text-white text-xl tracking-widest flex items-center gap-2">
                                    CINE MENSA <span className="text-cine-gold">TV</span>
                                </h3>
                                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Emisión en Directo • {activeEvent.candidates.find(c => c.tmdbId === activeEvent?.winnerTmdbId)?.title}</p>
                            </div>
                        </div>
                        <div className="bg-gray-800 px-3 py-1 rounded border border-gray-700">
                            <p className="text-xs text-gray-400 font-mono">LIVE</p>
                        </div>
                    </div>

                    {/* CHAT AREA */}
                    <div ref={chatContainerRef} className="flex-grow overflow-y-auto p-4 md:p-6 space-y-6 bg-gray-900 custom-scrollbar relative">
                        {eventMessages.map(msg => {
                            const isMe = msg.userId === user?.id;
                            const isMod = msg.role === 'moderator';
                            
                            if (isMod) {
                                return (
                                    <div key={msg.id} className="flex justify-center my-6 animate-slide-up">
                                        <div className="max-w-2xl w-full bg-gradient-to-r from-cine-gold/10 to-transparent border-l-4 border-cine-gold p-4 rounded-r-xl">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="w-10 h-10 rounded-full border-2 border-cine-gold bg-black flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.5)]">
                                                    <Tv size={20} className="text-cine-gold"/>
                                                </div>
                                                <span className="text-cine-gold font-black uppercase tracking-wider text-sm">Presentadora</span>
                                            </div>
                                            <p className="text-white text-base md:text-lg leading-relaxed font-medium italic">
                                                "{msg.text}"
                                            </p>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                                    <div className={`flex gap-3 max-w-[85%] md:max-w-[70%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                        <div className="flex-shrink-0 flex flex-col items-center">
                                            <img src={msg.userAvatar} className="w-10 h-10 rounded-full border-2 border-gray-700" alt="Avatar" />
                                        </div>
                                        <div className={`p-4 rounded-2xl text-sm shadow-md ${isMe ? 'bg-blue-900/40 text-blue-100 border border-blue-800 rounded-tr-none' : 'bg-gray-800 text-gray-200 border border-gray-700 rounded-tl-none'}`}>
                                            {!isMe && <p className="text-xs text-gray-400 font-bold mb-1 uppercase tracking-wide">{msg.userName}</p>}
                                            <p className="leading-relaxed">{msg.text}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        
                        {modThinking && (
                            <div className="flex justify-center animate-pulse">
                                <span className="text-cine-gold text-xs font-bold uppercase tracking-widest bg-black/50 px-3 py-1 rounded-full">La Presentadora está escribiendo...</span>
                            </div>
                        )}
                        <div ref={chatRef} />
                    </div>

                    {/* INPUT AREA */}
                    <div className="p-4 bg-black border-t-4 border-gray-800 flex-shrink-0">
                        <form onSubmit={handleSendMessage} className="flex gap-2 max-w-4xl mx-auto">
                            <input 
                                type="text" 
                                value={chatInput} 
                                onChange={(e) => setChatInput(e.target.value)} 
                                placeholder="Participa en el debate..." 
                                className="flex-grow bg-gray-900 border-2 border-gray-700 rounded-lg px-4 py-4 text-white focus:border-cine-gold outline-none text-base placeholder-gray-500 transition-colors" 
                            />
                            <button 
                                type="submit" 
                                disabled={!chatInput.trim()} 
                                className="bg-cine-gold hover:bg-white text-black font-black px-6 rounded-lg uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(212,175,55,0.4)] hover:shadow-[0_0_30px_rgba(255,255,255,0.6)]"
                            >
                                ENVIAR
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
