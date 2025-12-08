
import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';
import { generateCineforumEvent, personalizeCandidateReason, getModeratorResponse, getWelcomeMessage, getParticipantGreeting, decideBestTime } from '../services/geminiService';
import { getImageUrl } from '../services/tmdbService';
import { Ticket, Sparkles, Calendar, Clock, Trophy, PlayCircle, MessageCircle, Send, Users, ChevronRight, Bot, Archive, UserCheck, Loader2, Mic, MicOff, Info, BrainCircuit, Eye, Check, Hand, CalendarCheck, HelpCircle, ChevronDown, ChevronUp, AlertTriangle, Phone, PhoneOff, Radio, Tv, Volume2, VolumeX, Rewind } from 'lucide-react';
import { EventCandidate } from '../types';
import MovieCard from '../components/MovieCard';
import AIVisualizer from '../components/AIVisualizer';

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
  const { user, activeEvent, movies, allUsers, userRatings, createEvent, closeEvent, tmdbToken, voteForCandidate, transitionEventPhase, sendEventMessage, eventMessages, toggleEventCommitment, toggleTimeVote, getEpisodeCount, raiseHand, grantTurn, releaseTurn } = useData();
  const [generating, setGenerating] = useState(false);
  const [closing, setClosing] = useState(false);
  const [startingDiscussion, setStartingDiscussion] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [modThinking, setModThinking] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // TTS & Audio Playback State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true); // Default to listening enabled

  // Time Voting State
  const [expandedTimeCat, setExpandedTimeCat] = useState<string | null>(null);

  // Admin Preview State
  const [adminPreviewMode, setAdminPreviewMode] = useState(false);
  const [adminDebatePreview, setAdminDebatePreview] = useState(false);
  const [adminTimePreview, setAdminTimePreview] = useState<{ chosenTime: string, message: string } | null>(null);
  const [simulatingTime, setSimulatingTime] = useState(false);

  // Personalized Reasons State
  const [personalizedReasons, setPersonalizedReasons] = useState<Record<number, string>>({});

  // Auto-scroll chat
  useEffect(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
  }, [eventMessages, modThinking]);

  // Reset states
  useEffect(() => {
      setPersonalizedReasons({});
      setAdminPreviewMode(false);
      setAdminDebatePreview(false);
      setAdminTimePreview(null);
      setExpandedTimeCat(null);
  }, [activeEvent?.id]);

  // AUTO-PLAY AUDIO & TTS LOGIC
  useEffect(() => {
      if (eventMessages.length === 0 || !voiceEnabled) return;
      
      const lastMsg = eventMessages[eventMessages.length - 1];
      // Only play if it's new (simple check: timestamp is recent < 5s)
      if (Date.now() - lastMsg.timestamp > 5000) return;

      const play = async () => {
          setIsPlayingAudio(true);
          
          if (lastMsg.audioBase64) {
              // --- PLAY HUMAN AUDIO ---
              try {
                  const audio = new Audio(`data:audio/webm;base64,${lastMsg.audioBase64}`);
                  audio.onended = () => setIsPlayingAudio(false);
                  await audio.play();
              } catch (e) { console.error("Audio playback error", e); setIsPlayingAudio(false); }
          } else if (lastMsg.role === 'moderator') {
              // --- PLAY AI TTS ---
              if ('speechSynthesis' in window) {
                  window.speechSynthesis.cancel();
                  const utterance = new SpeechSynthesisUtterance(lastMsg.text);
                  utterance.lang = 'es-ES';
                  utterance.rate = 1.1;
                  utterance.onend = () => setIsPlayingAudio(false);
                  window.speechSynthesis.speak(utterance);
              } else {
                  setIsPlayingAudio(false);
              }
          } else {
              setIsPlayingAudio(false);
          }
      };
      
      play();
  }, [eventMessages.length]);

  // VOICE RECORDING HANDLERS
  const startRecording = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          audioChunksRef.current = [];

          mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) audioChunksRef.current.push(event.data);
          };

          mediaRecorder.start();
          setIsRecording(true);
          
          // Also start speech recognition for text transcription
          toggleDictation(); 

      } catch (e) {
          console.error("Mic error:", e);
          alert("Error accediendo al micrófono.");
      }
  };

  const stopRecordingAndSend = async () => {
      if (!mediaRecorderRef.current || !activeEvent) return;

      mediaRecorderRef.current.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
              const base64Audio = (reader.result as string).split(',')[1];
              const textToSend = chatInput.trim() || "(Mensaje de voz)";
              
              await sendEventMessage(activeEvent.id, textToSend, 'user', base64Audio);
              setChatInput('');
              
              // Release turn automatically after speaking
              if (activeEvent.currentSpeakerId === user?.id) {
                  releaseTurn(activeEvent.id);
              }
              
              // Trigger AI logic
              handleAIMentionLogic(textToSend);
          };
      };

      mediaRecorderRef.current.stop();
      setIsRecording(false);
      // Stop dictation
      // (Handled by toggleDictation logic usually)
  };

  // Dictation (STT) for transcription
  const toggleDictation = () => {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) return;
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-ES';
      recognition.interimResults = true;
      recognition.onresult = (event: any) => { 
          if (event.results[0].isFinal) {
              setChatInput(prev => prev + " " + event.results[0][0].transcript); 
          }
      };
      recognition.start();
  };

  // Load personalization
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


  const handleCreate = async () => {
      setGenerating(true);
      try {
          const newEventData = await generateCineforumEvent(movies, allUsers, tmdbToken);
          if (newEventData) await createEvent(newEventData);
      } catch (e) { console.error(String(e)); } finally { setGenerating(false); }
  };

  const handleForceEndVoting = async () => {
      if (!activeEvent) return;
      let winner = activeEvent.candidates[0];
      if (activeEvent.candidates.length > 0) {
          winner = activeEvent.candidates.reduce((prev: EventCandidate, current: EventCandidate) => (prev.votes.length > current.votes.length) ? prev : current);
      }
      await transitionEventPhase(activeEvent.id, 'viewing', winner.tmdbId);
  };

  const handleStartDiscussion = async () => {
      if (!activeEvent || !activeEvent.winnerTmdbId) return;
      setStartingDiscussion(true);
      try {
          const winnerTitle = activeEvent.candidates.find(c => c.tmdbId === activeEvent.winnerTmdbId)?.title || "la película";
          const welcomeText = await getWelcomeMessage(winnerTitle, activeEvent.themeTitle);
          await transitionEventPhase(activeEvent.id, 'discussion', activeEvent.winnerTmdbId);
          await sendEventMessage(activeEvent.id, welcomeText, 'moderator');
      } catch (e) { console.error(String(e)); await transitionEventPhase(activeEvent.id, 'discussion', activeEvent.winnerTmdbId); } finally { setStartingDiscussion(false); }
  };

  const handleCloseEvent = async (e: React.MouseEvent) => {
      e.stopPropagation(); e.preventDefault();
      if (!activeEvent) return;
      setClosing(true);
      try { await closeEvent(activeEvent.id); } catch(e) { console.error(String(e)); } finally { setClosing(false); }
  }

  const handleCallModerator = async (history: any[] = []) => {
      if (!activeEvent) return;
      setModThinking(true);
      try {
          const historyToUse = history.length > 0 ? history : eventMessages.slice(-10).map(m => ({ userName: m.userName, text: m.text }));
          const modText = await getModeratorResponse(historyToUse, activeEvent.winnerTmdbId ? activeEvent.candidates.find(c => c.tmdbId === activeEvent.winnerTmdbId)?.title || "la película" : "la película", activeEvent.themeTitle);
          await sendEventMessage(activeEvent.id, modText, 'moderator');
      } catch (e) { console.error(String(e)); } finally { setModThinking(false); }
  };

  const handleGreetNewUser = async (userName: string, message: string) => {
      if (!activeEvent) return;
      setTimeout(async () => {
          setModThinking(true);
          try {
             const winnerTitle = activeEvent.winnerTmdbId ? activeEvent.candidates.find(c => c.tmdbId === activeEvent.winnerTmdbId)?.title || "la película" : "la película";
             const greeting = await getParticipantGreeting(userName, message, winnerTitle);
             await sendEventMessage(activeEvent.id, greeting, 'moderator');
          } catch(e) { console.error(String(e)); } finally { setModThinking(false); }
      }, 2000);
  };

  const handleAIMentionLogic = (userText: string) => {
        if (!activeEvent || !user) return;
        const hasSpokenBefore = eventMessages.some(m => m.userId === user.id);
        if (!hasSpokenBefore) { handleGreetNewUser(user.name, userText); return; }
        const mentionRegex = /@(ia|moderadora|bot|sistema)/i;
        const isMentioned = mentionRegex.test(userText);
        const lastMessageWasBot = eventMessages.length > 0 && eventMessages[eventMessages.length - 1].role === 'moderator';
        const shouldParticipateSpontaneously = Math.random() < 0.20;
        if (isMentioned || (shouldParticipateSpontaneously && !lastMessageWasBot)) {
            const tempHistory = [...eventMessages.slice(-9).map(m => ({ userName: m.userName, text: m.text })), { userName: user.name, text: userText }];
            if (!isMentioned) setTimeout(() => handleCallModerator(tempHistory), 2000); else handleCallModerator(tempHistory);
        }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!chatInput.trim() || !activeEvent || !user) return;
      const userText = chatInput;
      setChatInput('');
      try {
        await sendEventMessage(activeEvent.id, userText);
        handleAIMentionLogic(userText);
      } catch (e) { console.error(String(e)); }
  };

  const handleSimulateTimeDecision = async () => {
      if (!activeEvent) return;
      setSimulatingTime(true);
      const counts: Record<string, number> = {};
      if (activeEvent.timeVotes) {
          Object.entries(activeEvent.timeVotes).forEach(([time, voters]) => { counts[time] = (voters as string[]).length; });
      }
      const winner = activeEvent.candidates.find(c => c.tmdbId === activeEvent.winnerTmdbId);
      const epNum = await getEpisodeCount();
      const res = await decideBestTime(counts, winner?.title || 'la película', epNum);
      setAdminTimePreview(res);
      setSimulatingTime(false);
  };

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
  // Determine phase based on real state AND simulations
  const currentPhase = adminDebatePreview ? 'discussion' : (adminPreviewMode ? 'viewing' : activeEvent.phase);
  
  let winner: EventCandidate | undefined | null = null;
  
  if (adminPreviewMode || adminDebatePreview) {
      // In simulation, pick current winner
      if (activeEvent.candidates.length > 0) winner = activeEvent.candidates.reduce((prev, current) => (prev.votes.length > current.votes.length) ? prev : current);
  } else if (activeEvent.winnerTmdbId) {
      winner = activeEvent.candidates.find(c => c.tmdbId === activeEvent.winnerTmdbId);
  }

  const votingEndDate = new Date(activeEvent.votingDeadline).toLocaleDateString();
  const viewingEndDate = new Date(activeEvent.viewingDeadline).toLocaleDateString();

  return (
    <div className="min-h-screen bg-cine-dark pb-20 relative overflow-hidden flex flex-col">
        <div className="absolute inset-0 z-0">
            <img src={activeEvent.backdropUrl || activeEvent.candidates[0].posterUrl} alt="Backdrop" className="w-full h-full object-cover opacity-65" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-cine-dark/70 to-cine-dark"></div>
        </div>
        
        {/* Simulation Banners */}
        {adminPreviewMode && !adminDebatePreview && <div className="fixed top-16 left-0 right-0 bg-blue-600/90 text-white text-center py-2 z-40 font-bold animate-pulse">👁️ MODO VISTA PREVIA: FASE PROYECCIÓN (Solo Admin)</div>}
        {adminDebatePreview && <div className="fixed top-16 left-0 right-0 bg-purple-600/90 text-white text-center py-2 z-40 font-bold animate-pulse">👁️ MODO VISTA PREVIA: CINEFORUM DEBATE (Solo Admin)</div>}

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
                
                {/* Visual Header CANDIDATAS */}
                {currentPhase === 'voting' && (
                    <div className="flex flex-col items-center mb-6">
                        <div className="h-1 w-20 bg-cine-gold mb-2"></div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-[0.2em] mb-1">Candidatas a Votación</h2>
                        <p className="text-sm text-gray-300">Selección IA basada en gustos del club</p>
                    </div>
                )}

                <div className="flex justify-center gap-2 drop-shadow-md">
                    <span className={`px-4 py-2 rounded-full text-xs font-bold border ${currentPhase === 'voting' ? 'bg-cine-gold text-black border-cine-gold' : 'bg-black/60 text-gray-400 border-gray-600'}`}>1. VOTACIÓN</span>
                    <ChevronRight className="text-gray-400 self-center"/>
                    <span className={`px-4 py-2 rounded-full text-xs font-bold border ${currentPhase === 'viewing' ? 'bg-cine-gold text-black border-cine-gold' : 'bg-black/60 text-gray-400 border-gray-600'}`}>2. PROYECCIÓN</span>
                    <ChevronRight className="text-gray-400 self-center"/>
                    <span className={`px-4 py-2 rounded-full text-xs font-bold border ${currentPhase === 'discussion' ? 'bg-cine-gold text-black border-cine-gold' : 'bg-black/60 text-gray-400 border-gray-600'}`}>3. DEBATE</span>
                </div>
            </div>

            {currentPhase === 'voting' && (
                <div className="max-w-6xl mx-auto animate-fade-in pb-10">
                    {/* ... (Same Voting UI) ... */}
                    <div className="bg-black/40 backdrop-blur-md border-l-4 border-cine-gold p-6 rounded-r-xl mb-8 flex flex-col md:flex-row items-start gap-6 shadow-lg">
                        <div className="flex-grow">
                             <div className="flex items-center gap-2 text-cine-gold font-bold text-lg mb-2"><Sparkles size={20}/> Elección de la Comunidad</div>
                             <p className="text-gray-200 mb-3">{activeEvent.aiReasoning}</p>
                             <div className="bg-black/40 p-3 rounded-lg border border-cine-gold/20 inline-block">
                                <p className="text-sm font-bold text-gray-300 flex items-center gap-2">
                                    <Calendar size={16} className="text-cine-gold"/> 
                                    Período de Votación: <span className="text-white">Hasta el {votingEndDate}</span>
                                </p>
                             </div>
                        </div>
                        <div className="bg-black/60 p-4 rounded-xl border border-gray-700 max-w-sm">
                            <h4 className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1"><Info size={12}/> Normas del Evento</h4>
                            <ul className="text-xs text-gray-300 space-y-1 list-disc pl-4">
                                <li>Vota tu favorita esta semana.</li>
                                <li className="text-cine-gold font-bold">La IA solo ha seleccionado películas que el 70% del club NO ha visto.</li>
                            </ul>
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
                            <button onClick={() => setAdminPreviewMode(true)} className="bg-blue-600/20 hover:bg-blue-600 hover:text-white text-blue-300 px-8 py-3 rounded-full text-sm font-bold border border-blue-500/30 transition-all backdrop-blur-sm">👁️ Admin: Simular Pantalla Ganador</button>
                            <button onClick={handleForceEndVoting} className="bg-red-900/20 hover:bg-red-900 hover:text-white text-red-300 px-8 py-3 rounded-full text-sm font-bold border border-red-500/30 transition-all backdrop-blur-sm">Forzar Cierre Real</button>
                        </div>
                    )}
                </div>
            )}

            {currentPhase === 'viewing' && winner && (
                <div className="max-w-5xl mx-auto animate-fade-in flex-grow flex flex-col relative">
                    {adminPreviewMode && <div className="absolute top-0 right-0 z-50"><button onClick={() => setAdminPreviewMode(false)} className="bg-white text-black font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-2"><Eye size={18}/> Salir de Vista Previa</button></div>}

                    {/* ... (Same Viewing UI) ... */}
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

                    {/* Final Date Announcement */}
                    {(activeEvent.finalDebateDate || adminTimePreview) && (
                        <div className={`mb-10 relative overflow-hidden p-8 rounded-2xl border-4 text-center animate-fade-in shadow-[0_0_80px_rgba(0,0,0,0.8)] ${adminTimePreview?.chosenTime === 'CANCELLED' ? 'bg-black border-red-600' : 'bg-black border-cine-gold'}`}>
                            {adminTimePreview?.chosenTime === 'CANCELLED' ? (
                                <>
                                    <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#330000_10px,#330000_20px)] opacity-20"></div>
                                    <AlertTriangle className="text-red-600 mx-auto mb-4" size={64} />
                                    <h3 className="text-3xl font-black text-red-500 uppercase mb-2 tracking-widest">EMISIÓN CANCELADA</h3>
                                    <p className="text-gray-400 italic text-lg max-w-2xl mx-auto relative z-10">"{adminTimePreview.message}"</p>
                                </>
                            ) : (
                                <>
                                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cine-gold/20 via-black to-black"></div>
                                    <p className="text-cine-gold text-xs font-black tracking-[0.5em] mb-4 relative z-10">CINE MENSA ORIGINALS PRESENTA</p>
                                    <h3 className="text-4xl md:text-6xl font-black text-white uppercase mb-2 leading-none relative z-10 drop-shadow-[0_4px_0_rgba(212,175,55,0.5)]">EPISODIO</h3>
                                    <p className="text-2xl text-cine-gold font-serif italic mb-6 relative z-10">"{adminTimePreview ? adminTimePreview.message : activeEvent.debateDecisionMessage?.split('|')[1]}"</p>
                                    <div className="inline-block bg-cine-gold text-black px-6 py-2 font-black text-xl uppercase tracking-widest relative z-10 transform -rotate-2">
                                        {adminTimePreview ? adminTimePreview.chosenTime : activeEvent.debateDecisionMessage?.split('|')[0]}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

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

                            {/* TIME VOTING SECTION */}
                            {activeEvent.committedDebaters?.includes(user?.id || '') && !activeEvent.finalDebateDate && !adminTimePreview && (
                                <div className="mt-6 pt-6 border-t border-gray-700 animate-fade-in">
                                    <h4 className="text-cine-gold font-bold mb-3 flex items-center gap-2"><Clock size={16}/> ¿Qué horas te vienen bien?</h4>
                                    <p className="text-xs text-gray-400 mb-3">Marca todas las horas disponibles. La IA decidirá el Jueves.</p>
                                    
                                    <div className="space-y-2">
                                        {TIME_CATEGORIES.map(cat => {
                                            const isExpanded = expandedTimeCat === cat.id;
                                            const votedHoursInCat = cat.hours.filter(h => {
                                                const fullKey = `${cat.label.split(' ')[0]} ${h}`; 
                                                return Object.keys(activeEvent.timeVotes || {}).some(k => k.startsWith(cat.label.split(' ')[0]) && k.includes(h) && activeEvent.timeVotes?.[k]?.includes(user?.id || ''));
                                            }).length;

                                            return (
                                                <div key={cat.id} className="bg-black/30 rounded-lg overflow-hidden border border-gray-800">
                                                    <div 
                                                        onClick={() => setExpandedTimeCat(isExpanded ? null : cat.id)}
                                                        className={`p-3 flex justify-between items-center cursor-pointer transition-colors ${isExpanded ? 'bg-gray-800' : 'hover:bg-gray-800'}`}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-bold text-gray-300">{cat.label}</span>
                                                            {votedHoursInCat > 0 && <span className="text-[10px] bg-cine-gold text-black px-1.5 rounded-full font-bold">{votedHoursInCat}</span>}
                                                        </div>
                                                        {isExpanded ? <ChevronUp size={16} className="text-gray-500"/> : <ChevronDown size={16} className="text-gray-500"/>}
                                                    </div>

                                                    {isExpanded && (
                                                        <div className="p-3 grid grid-cols-4 gap-2 bg-black/50">
                                                            {cat.hours.map(hour => {
                                                                const timeKey = `${cat.label.split(' ')[0]} ${hour}`;
                                                                const votes = activeEvent.timeVotes?.[timeKey] || [];
                                                                const isSelected = votes.includes(user?.id || '');
                                                                return (
                                                                    <button
                                                                        key={hour}
                                                                        onClick={() => toggleTimeVote(activeEvent.id, timeKey)}
                                                                        className={`py-2 rounded text-xs font-bold border transition-all ${isSelected ? 'bg-cine-gold text-black border-cine-gold' : 'bg-gray-900 text-gray-400 border-gray-700 hover:border-gray-500'}`}
                                                                    >
                                                                        {hour}
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {user?.isAdmin && !activeEvent.finalDebateDate && (
                        <div className="mt-12 text-center flex flex-col gap-4 items-center bg-gray-900/50 p-6 rounded-xl border border-gray-700">
                            <h3 className="text-white font-bold text-lg mb-2">Panel de Control Admin</h3>
                            <button onClick={handleSimulateTimeDecision} disabled={simulatingTime} className="bg-purple-900/40 text-purple-300 border border-purple-500 px-6 py-3 rounded-full font-bold hover:bg-purple-900 flex items-center gap-2 disabled:opacity-50">
                                {simulatingTime ? <Loader2 className="animate-spin"/> : '👁️'} Simular Decisión de Hora (Con IA)
                            </button>
                            
                            <div className="flex flex-col md:flex-row gap-4 mt-2">
                                <button onClick={() => setAdminDebatePreview(true)} className="bg-blue-600/40 text-blue-300 border border-blue-500 px-6 py-3 rounded-full font-bold hover:bg-blue-900 flex items-center gap-2">
                                    👁️ Simular Show (Pruebas)
                                </button>
                                
                                <button onClick={handleStartDiscussion} disabled={startingDiscussion} className="bg-red-600 hover:bg-red-500 text-white text-lg px-8 py-3 rounded-full font-bold shadow-[0_0_30px_rgba(220,38,38,0.5)] flex items-center gap-2 animate-pulse disabled:opacity-50">
                                    {startingDiscussion ? <Loader2 className="animate-spin"/> : <Radio size={24}/>} 
                                    EMITIR EN DIRECTO (REAL)
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {currentPhase === 'discussion' && (
                <div className="flex-grow flex flex-col h-[65vh] md:h-[600px] min-h-[60dvh] bg-cine-gray rounded-xl border-4 border-gray-800 overflow-hidden shadow-2xl animate-fade-in max-w-5xl mx-auto w-full backdrop-blur-sm bg-cine-gray/95 relative">
                    
                    {adminDebatePreview && <div className="absolute top-16 right-0 z-[60] bg-purple-600 text-white font-bold px-4 py-1 rounded-l-lg shadow-lg">Simulación Admin</div>}
                    {adminDebatePreview && <button onClick={() => setAdminDebatePreview(false)} className="absolute top-16 left-0 z-[60] bg-white text-black font-bold px-4 py-1 rounded-r-lg shadow-lg hover:bg-gray-200">Salir Simulación</button>}

                    {/* REVERT PHASE BUTTON (EMERGENCY ADMIN) */}
                    {user?.isAdmin && !adminDebatePreview && (
                        <div className="absolute top-20 left-4 z-[60]">
                            <button 
                                onClick={() => transitionEventPhase(activeEvent.id, 'viewing', activeEvent.winnerTmdbId)}
                                className="bg-yellow-600/90 hover:bg-yellow-500 text-black font-bold px-4 py-2 rounded-lg shadow-[0_0_20px_rgba(234,179,8,0.4)] flex items-center gap-2 border-2 border-yellow-400 transition-all text-xs md:text-sm"
                            >
                                <AlertTriangle size={18} /> CORREGIR: Volver a Proyección
                            </button>
                        </div>
                    )}

                    {/* HEADER: AIVisualizer */}
                    <div className="bg-black/80 backdrop-blur-md p-4 border-b border-gray-800 flex items-center justify-between z-50">
                        <div className="flex items-center gap-4">
                            <div className="scale-75">
                                <AIVisualizer 
                                    isUserSpeaking={isRecording} 
                                    isAiSpeaking={isPlayingAudio} 
                                    status="" 
                                    size="sm" 
                                />
                            </div>
                            <div>
                                <h3 className="font-bold text-white flex items-center gap-2"><Radio className="text-red-500 animate-pulse" size={16}/> EN EL AIRE</h3>
                                <p className="text-xs text-cine-gold">Debate en Vivo</p>
                            </div>
                        </div>
                        
                        {/* Audio Controls */}
                        <button 
                            onClick={() => setVoiceEnabled(!voiceEnabled)}
                            className={`p-2 rounded-full border transition-all ${voiceEnabled ? 'bg-cine-gold text-black border-cine-gold' : 'bg-transparent text-gray-500 border-gray-700'}`}
                            title="Activar/Desactivar Audio"
                        >
                            {voiceEnabled ? <Volume2 size={20}/> : <VolumeX size={20}/>}
                        </button>
                    </div>

                    {/* TURN MANAGEMENT UI */}
                    <div className="bg-black/60 p-2 border-b border-gray-800 flex justify-between items-center text-xs px-4">
                        <div className="flex items-center gap-2">
                            <span className="text-gray-400">Turno actual:</span>
                            {activeEvent.currentSpeakerId ? (
                                <span className="font-bold text-green-400 flex items-center gap-1">
                                    <Mic size={12}/> {allUsers.find(u => u.id === activeEvent.currentSpeakerId)?.name || 'Usuario'}
                                </span>
                            ) : (
                                <span className="text-gray-500 italic">Nadie (Micrófono libre)</span>
                            )}
                        </div>
                        
                        {activeEvent.currentSpeakerId === user?.id ? (
                            <button 
                                onMouseDown={startRecording}
                                onMouseUp={stopRecordingAndSend}
                                onTouchStart={startRecording}
                                onTouchEnd={stopRecordingAndSend}
                                className="bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-2 rounded-full shadow-[0_0_15px_rgba(220,38,38,0.5)] animate-pulse flex items-center gap-2 transition-all active:scale-95 select-none"
                            >
                                <Mic size={16}/> {isRecording ? 'GRABANDO... (Suelta para enviar)' : 'MANTÉN PARA HABLAR'}
                            </button>
                        ) : activeEvent.speakerQueue?.includes(user?.id || '') ? (
                            <span className="text-yellow-500 font-bold flex items-center gap-1"><Hand size={14}/> Esperando turno... ({activeEvent.speakerQueue.indexOf(user?.id || '') + 1})</span>
                        ) : (
                            <button onClick={() => raiseHand(activeEvent.id)} className="text-gray-300 hover:text-white flex items-center gap-1 hover:bg-white/10 px-2 py-1 rounded transition-colors">
                                <Hand size={14}/> Pedir Palabra
                            </button>
                        )}

                        {user?.isAdmin && activeEvent.speakerQueue && activeEvent.speakerQueue.length > 0 && !activeEvent.currentSpeakerId && (
                            <button onClick={() => grantTurn(activeEvent.id, activeEvent.speakerQueue![0])} className="bg-blue-600 text-white px-2 py-1 rounded ml-2">
                                Dar turno a {allUsers.find(u => u.id === activeEvent.speakerQueue![0])?.name}
                            </button>
                        )}
                    </div>

                    <div ref={chatContainerRef} className="flex-grow overflow-y-auto p-4 space-y-4 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] custom-scrollbar">
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
                                            {msg.audioBase64 && (
                                                <div className="flex items-center gap-2 mb-2 text-xs bg-black/20 p-1 rounded px-2 w-fit">
                                                    <Mic size={12} className="text-green-400"/> 
                                                    <span>Mensaje de voz</span>
                                                </div>
                                            )}
                                            <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
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
