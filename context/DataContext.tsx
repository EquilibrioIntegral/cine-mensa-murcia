
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Movie, User, UserRating, ViewState, DetailedRating, CineEvent, EventPhase, EventMessage, AppFeedback, NewsItem, LiveSessionState, Mission } from '../types';
import { auth, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail
} from "firebase/auth";
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  onSnapshot, 
  arrayUnion,
  arrayRemove,
  deleteDoc,
  query,
  orderBy,
  addDoc,
  limit,
  where,
  getCountFromServer
} from "firebase/firestore";
import { decideBestTime, generateCinemaNews } from '../services/geminiService';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { findMovieByTitleAndYear, getImageUrl, searchPersonTMDB, searchMoviesTMDB } from '../services/tmdbService';
import { MISSIONS, XP_PER_LEVEL } from '../constants';

// --- AUDIO UTILS ---
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function createPcmBlob(data: Float32Array): { data: string, mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    let s = Math.max(-1, Math.min(1, data[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  let binary = '';
  const bytes = new Uint8Array(int16.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return { data: btoa(binary), mimeType: 'audio/pcm;rate=16000' };
}

// MAX DAILY SECONDS (5 Minutes)
const DAILY_VOICE_LIMIT_SECONDS = 300; 

interface DataContextType {
  user: User | null;
  allUsers: User[]; 
  movies: Movie[];
  userRatings: UserRating[];
  activeEvent: CineEvent | null;
  eventMessages: EventMessage[];
  news: NewsItem[];
  feedbackList: AppFeedback[];
  currentView: ViewState;
  selectedMovieId: string | null;
  tmdbToken: string;
  
  // Logic needed for locking features
  topCriticId: string | null;
  getRemainingVoiceSeconds: () => number;
  
  // Live Session Global State
  liveSession: LiveSessionState;
  startLiveSession: (mode: 'general' | 'debate', contextData?: any) => Promise<void>;
  stopLiveSession: () => void;

  setTmdbToken: (token: string) => Promise<void>;
  login: (email: string, name: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  register: (email: string, name: string, password: string, avatarUrl?: string) => Promise<{ success: boolean; message: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  updateUserProfile: (name: string, avatarUrl: string) => Promise<void>;
  approveUser: (userId: string) => void;
  rejectUser: (userId: string) => void;
  setView: (view: ViewState, movieId?: string) => void;
  rateMovie: (movieId: string, rating: DetailedRating, comment?: string, spoiler?: string) => void;
  unwatchMovie: (movieId: string) => Promise<void>;
  toggleWatchlist: (movieId: string) => Promise<void>;
  toggleReviewVote: (targetUserId: string, movieId: string, voteType: 'like' | 'dislike') => void;
  addMovie: (movie: Movie) => Promise<void>;
  getMovie: (id: string) => Movie | undefined;
  
  createEvent: (eventData: Partial<CineEvent>) => Promise<void>;
  closeEvent: (eventId: string) => Promise<void>;
  voteForCandidate: (eventId: string, tmdbId: number) => Promise<void>;
  transitionEventPhase: (eventId: string, phase: EventPhase, winnerId?: number) => Promise<void>;
  sendEventMessage: (eventId: string, text: string, role?: 'user' | 'moderator', audioBase64?: string) => Promise<void>;
  toggleEventCommitment: (eventId: string, type: 'view' | 'debate') => Promise<void>;
  toggleTimeVote: (eventId: string, timeSlot: string) => Promise<void>;

  // Turn Management
  raiseHand: (eventId: string) => Promise<void>;
  grantTurn: (eventId: string, userId: string) => Promise<void>;
  releaseTurn: (eventId: string) => Promise<void>;

  sendFeedback: (type: 'bug' | 'feature', text: string) => Promise<void>;
  resolveFeedback: (feedbackId: string, response?: string) => Promise<void>;
  publishNews: (title: string, content: string, type: 'general' | 'update' | 'event', imageUrl?: string) => Promise<void>;
  deleteFeedback: (id: string) => Promise<void>;
  
  getEpisodeCount: () => Promise<number>;
  
  // Notification State (For Gamification)
  notification: { message: string, type: 'level' | 'mission' } | null;
  clearNotification: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [userRatings, setUserRatings] = useState<UserRating[]>([]);
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.LOGIN);
  const [selectedMovieId, setSelectedMovieId] = useState<string | null>(null);
  const [tmdbToken, setTmdbTokenState] = useState<string>('');
  
  const [activeEvent, setActiveEvent] = useState<CineEvent | null>(null);
  const [eventMessages, setEventMessages] = useState<EventMessage[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [feedbackList, setFeedbackList] = useState<AppFeedback[]>([]);
  
  const [notification, setNotification] = useState<{ message: string, type: 'level' | 'mission' } | null>(null);
  
  // Top Critic Calculation
  const [topCriticId, setTopCriticId] = useState<string | null>(null);

  // --- LIVE SESSION STATE ---
  const [liveSession, setLiveSession] = useState<LiveSessionState>({
      isConnected: false,
      status: 'Desconectado',
      isUserSpeaking: false,
      isAiSpeaking: false,
      toolInUse: null,
      visualContent: []
  });

  // Refs for Live API Audio (Persisted in Provider)
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<AudioBufferSourceNode[]>([]);
  const nextStartTimeRef = useRef<number>(0);
  const currentStreamRef = useRef<MediaStream | null>(null);
  
  // Timer Ref for usage tracking
  const usageIntervalRef = useRef<number | null>(null);

  // --- GAMIFICATION ENGINE ---
  const checkAchievements = async (currentUser: User) => {
      if (!currentUser) return;
      
      const myRatings = userRatings.filter(r => r.userId === currentUser.id);
      
      // Calculate Stats
      const stats = {
          ratingsCount: myRatings.length,
          reviewsCount: myRatings.filter(r => r.comment && r.comment.length > 5).length,
          likesReceived: myRatings.reduce((acc, r) => acc + (r.likes?.length || 0), 0),
          horrorCount: myRatings.filter(r => {
              const m = movies.find(mov => mov.id === r.movieId);
              return m && m.genre.some(g => g.toLowerCase().includes('terror') || g.toLowerCase().includes('horror'));
          }).length
      };

      let newXp = currentUser.xp || 0; 
      let newCompletedMissions = [...(currentUser.completedMissions || [])]; // SAFE INIT
      let missionsCompletedNow: Mission[] = [];

      MISSIONS.forEach(mission => {
          if (!newCompletedMissions.includes(mission.id)) {
              if (mission.condition(currentUser, stats)) {
                  newXp += mission.xpReward;
                  newCompletedMissions.push(mission.id);
                  missionsCompletedNow.push(mission);
              }
          }
      });

      // Calculate Level
      // Level 1 = 0-99 XP, Level 2 = 100-199 XP...
      const oldLevel = currentUser.level || 1;
      const newLevel = Math.floor(newXp / XP_PER_LEVEL) + 1;

      // Update Database only if changes
      if (newXp !== currentUser.xp || newCompletedMissions.length !== (currentUser.completedMissions || []).length) {
          try {
              await updateDoc(doc(db, 'users', currentUser.id), {
                  xp: newXp,
                  level: newLevel,
                  completedMissions: newCompletedMissions
              });
              
              // Notifications
              if (newLevel > oldLevel) {
                  setNotification({ message: `¡HAS SUBIDO AL NIVEL ${newLevel}!`, type: 'level' });
              } else if (missionsCompletedNow.length > 0) {
                  setNotification({ message: `¡Misión Completada: ${missionsCompletedNow[0].title}!`, type: 'mission' });
              }
          } catch(e) { console.error("Gamification update error", e); }
      }
  };

  // Trigger gamification check when relevant data changes
  useEffect(() => {
      if (user && userRatings.length > 0) {
          // Debounce to avoid spamming
          const t = setTimeout(() => checkAchievements(user), 2000);
          return () => clearTimeout(t);
      }
  }, [userRatings.length, user?.avatarUrl]); // Triggers on rating count change or avatar change

  const clearNotification = () => setNotification(null);

  // --- CALCULATE TOP CRITIC ---
  useEffect(() => {
      if (allUsers.length > 0 && userRatings.length > 0) {
          const stats = allUsers
            .filter(u => u.status === 'active' || u.isAdmin)
            .map(u => {
                const reviews = userRatings.filter(r => r.userId === u.id);
                const totalLikes = reviews.reduce((acc, r) => acc + (r.likes?.length || 0), 0);
                const totalDislikes = reviews.reduce((acc, r) => acc + (r.dislikes?.length || 0), 0);
                const prestige = totalLikes - totalDislikes;
                return { id: u.id, prestige, reviewCount: reviews.length };
            })
            .sort((a, b) => {
                // 1. Sort by Prestige (desc)
                if (b.prestige !== a.prestige) return b.prestige - a.prestige;
                // 2. Sort by Review Count (desc) as tie-breaker
                return b.reviewCount - a.reviewCount;
            });
          
          if (stats.length > 0) {
              setTopCriticId(stats[0].id);
          }
      }
  }, [allUsers, userRatings]);

  const getRemainingVoiceSeconds = (): number => {
      if (!user) return 0;
      
      const today = new Date().setHours(0,0,0,0);
      const lastUsageDate = user.voiceUsageDate || 0;
      const usedToday = lastUsageDate === today ? (user.voiceUsageSeconds || 0) : 0;
      
      return Math.max(0, DAILY_VOICE_LIMIT_SECONDS - usedToday);
  };

  // Function to track usage every second while connected
  const startUsageTracking = () => {
      if (usageIntervalRef.current) clearInterval(usageIntervalRef.current);
      
      usageIntervalRef.current = window.setInterval(async () => {
          if (!auth.currentUser) return;
          
          const today = new Date().setHours(0,0,0,0);
          
          // Optimistic update locally? We need to read fresh user state if possible or rely on component state
          // For simplicity, we update Firestore directly. Ideally use a transaction.
          const userRef = doc(db, 'users', auth.currentUser.uid);
          // We assume we are inside a context with 'user', but inside setInterval closure 'user' might be stale.
          // Using a small atomic increment would be better, but Firestore doesn't allow 'increment' + 'date check' easily in one line without logic.
          // We will fetch fresh doc to be safe.
          try {
              const snap = await getDoc(userRef);
              if (snap.exists()) {
                  const data = snap.data() as User;
                  const lastDate = data.voiceUsageDate || 0;
                  let currentSeconds = data.voiceUsageSeconds || 0;
                  
                  if (lastDate !== today) {
                      currentSeconds = 0; // Reset if new day
                  }
                  
                  const newSeconds = currentSeconds + 1;
                  
                  if (newSeconds >= DAILY_VOICE_LIMIT_SECONDS) {
                      stopLiveSession(); // Hard cut
                      alert("Has alcanzado tu límite diario de 5 minutos de voz con la IA.");
                  }

                  await updateDoc(userRef, {
                      voiceUsageDate: today,
                      voiceUsageSeconds: newSeconds
                  });
              }
          } catch(e) {
              console.error("Usage tracking error", e);
          }

      }, 1000);
  };

  const stopUsageTracking = () => {
      if (usageIntervalRef.current) {
          clearInterval(usageIntervalRef.current);
          usageIntervalRef.current = null;
      }
  };

  // --- LIVE SESSION METHODS ---
  const stopLiveSession = () => {
      stopUsageTracking();

      if (liveSessionRef.current) {
          try { liveSessionRef.current.close(); } catch(e) {}
          liveSessionRef.current = null;
      }
      if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
      if (inputSourceRef.current) { inputSourceRef.current.disconnect(); inputSourceRef.current = null; }
      if (currentStreamRef.current) { currentStreamRef.current.getTracks().forEach(track => track.stop()); currentStreamRef.current = null; }
      if (audioContextRef.current) { 
          try { audioContextRef.current.close(); } catch(e) {}
          audioContextRef.current = null; 
      }
      audioQueueRef.current.forEach(source => { try { source.stop(); } catch(e) {} });
      audioQueueRef.current = [];

      setLiveSession({
          isConnected: false,
          status: 'Llamada finalizada',
          isUserSpeaking: false,
          isAiSpeaking: false,
          toolInUse: null,
          visualContent: []
      });
  };

  const startLiveSession = async (mode: 'general' | 'debate', contextData?: any) => {
      if (!user) return;

      // 1. CHECK PERMISSIONS & LIMITS
      const isTopCritic = user.id === topCriticId;
      if (!user.isAdmin && !isTopCritic) {
          alert("Acceso denegado: Solo el Administrador y el Crítico #1 del ranking pueden usar la voz en vivo. ¡Gana prestigio para desbloquearlo!");
          return;
      }

      const remaining = getRemainingVoiceSeconds();
      if (remaining <= 0 && !user.isAdmin) {
          alert("Has consumido tus 5 minutos diarios de voz. ¡Vuelve mañana!");
          return;
      }
      
      try {
          setLiveSession(prev => ({ ...prev, isConnected: true, status: 'Conectando...', visualContent: [] }));

          let systemInstruction = '';

          // MODE: RECOMMENDATIONS
          if (mode === 'general') {
              const watchedTitles = movies.filter(m => user.watchedMovies.includes(m.id)).map(m => m.title).join(", ");
              systemInstruction = `
                Eres un experto en cine del club "Cine Mensa Murcia". Estás en una llamada de voz en tiempo real con el socio ${user.name}.
                DATOS: Ha visto: ${watchedTitles.slice(0, 500)}...
                OBJETIVO: Conversación natural, fluida y divertida. Respuestas BREVES (1-3 frases).
                
                HERRAMIENTAS VISUALES (PANTALLA COMPARTIDA):
                - Tienes una PANTALLA COMPARTIDA con el usuario. ÚSALA CONSTANTEMENTE.
                - Si mencionas una PELÍCULA -> Ejecuta "show_movie(titulo)".
                - Si mencionas un ACTOR o DIRECTOR -> Ejecuta "show_person(nombre)".
                - ¡Es obligatorio! Muestra el contenido visualmente.
              `;
          } 
          // MODE: CINEFORUM DEBATE MODERATOR
          else if (mode === 'debate') {
              const { movieTitle, themeTitle } = contextData || { movieTitle: 'La película', themeTitle: 'General' };
              systemInstruction = `
                Eres la PRESENTADORA ESTRELLA de TV del programa "Cine Mensa Murcia".
                Estás en una tertulia en vivo con el socio ${user.name} sobre la película: "${movieTitle}" (Tema: ${themeTitle}).
                
                TU ROL:
                - ¡HABLA PRIMERO! Nada más conectar, haz una INTRO ÉPICA, saluda al usuario y presenta la película.
                - Moderar la charla, lanzar preguntas interesantes sobre la trama, el guion o los actores.
                - Ser carismática, usar humor inteligente y tono de "Showwoman".
                - HABLA POCO: Tus intervenciones deben ser cortas (1-2 frases) para dejar hablar al usuario.
                - ESPAÑOL NEUTRO INTERNACIONAL (Sin localismos de Murcia).
                - ¡IMPROVISA Y SÉ DIVERTIDA!
                
                HERRAMIENTAS VISUALES:
                - Si hablas de un actor o una escena, ¡ÚSALAS!
                - show_person(nombre) para mostrar actores.
                - show_movie(titulo) para referenciar otras pelis.
              `;
          }

          const tools = [{
            functionDeclarations: [
              {
                name: "show_movie",
                description: "Muestra la ficha y carátula de una película en la pantalla del usuario. USAR SIEMPRE al mencionar una película.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: "Título de la película en español" },
                    year: { type: Type.NUMBER, description: "Año de estreno (opcional)" }
                  },
                  required: ["title"]
                }
              },
              {
                name: "show_person",
                description: "Muestra la foto de un actor, director o miembro del equipo en pantalla. USAR SIEMPRE al mencionar una persona.",
                parameters: {
                  type: Type.OBJECT,
                  properties: { name: { type: Type.STRING, description: "Nombre del actor o director" } },
                  required: ["name"]
                }
              }
            ]
          }];

          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const ctx = new AudioContextClass({ sampleRate: 16000 });
          audioContextRef.current = ctx;
          nextStartTimeRef.current = ctx.currentTime;

          const client = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
          const sessionPromise = client.live.connect({
              model: 'gemini-2.5-flash-native-audio-preview-09-2025',
              config: {
                  responseModalities: [Modality.AUDIO],
                  systemInstruction: systemInstruction,
                  tools: tools,
                  speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
              },
              callbacks: {
                  onopen: async () => {
                      setLiveSession(prev => ({ ...prev, status: 'Conectado - Escuchando...' }));
                      
                      // START TRACKING TIME IF NOT ADMIN
                      if (!user.isAdmin) {
                          startUsageTracking();
                      }

                      try {
                          const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
                          currentStreamRef.current = stream;
                          const source = ctx.createMediaStreamSource(stream);
                          inputSourceRef.current = source;
                          const processor = ctx.createScriptProcessor(4096, 1, 1);
                          processorRef.current = processor;
                          
                          processor.onaudioprocess = (e) => {
                              const inputData = e.inputBuffer.getChannelData(0);
                              const rms = Math.sqrt(inputData.reduce((s, v) => s + v * v, 0) / inputData.length);
                              setLiveSession(prev => ({ ...prev, isUserSpeaking: rms > 0.02 }));
                              const pcmBlob = createPcmBlob(inputData);
                              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                          };
                          source.connect(processor);
                          processor.connect(ctx.destination);

                      } catch (err) {
                          console.error("Mic Error:", err);
                          stopLiveSession(); 
                      }
                  },
                  onmessage: async (msg: LiveServerMessage) => {
                      const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                      if (audioData) {
                          setLiveSession(prev => ({ ...prev, isAiSpeaking: true }));
                          try {
                              const audioBytes = base64ToUint8Array(audioData);
                              const pcm16 = new Int16Array(audioBytes.buffer);
                              const float32 = new Float32Array(pcm16.length);
                              for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768.0;
                              
                              const outputBuffer = ctx.createBuffer(1, float32.length, 24000);
                              outputBuffer.copyToChannel(float32, 0);
                              const source = ctx.createBufferSource();
                              source.buffer = outputBuffer;
                              source.connect(ctx.destination);
                              const now = ctx.currentTime;
                              if (nextStartTimeRef.current < now) nextStartTimeRef.current = now + 0.05;
                              source.start(nextStartTimeRef.current);
                              nextStartTimeRef.current += outputBuffer.duration;
                              source.onended = () => {
                                  audioQueueRef.current = audioQueueRef.current.filter(s => s !== source);
                                  if (audioQueueRef.current.length === 0) setLiveSession(prev => ({ ...prev, isAiSpeaking: false }));
                              };
                              audioQueueRef.current.push(source);
                          } catch (e) { console.error(e); }
                      }

                      if (msg.serverContent?.interrupted) {
                          audioQueueRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
                          audioQueueRef.current = [];
                          nextStartTimeRef.current = 0;
                          setLiveSession(prev => ({ ...prev, isAiSpeaking: false }));
                      }

                      if (msg.toolCall) {
                          const functionResponses = [];
                          for (const fc of msg.toolCall.functionCalls) {
                              if (fc.name === 'show_movie') {
                                  const { title, year } = fc.args as any;
                                  setLiveSession(prev => ({ ...prev, toolInUse: `Buscando: ${title}` }));
                                  
                                  findMovieByTitleAndYear(title, year, tmdbToken).then(tmdbData => {
                                      setLiveSession(prev => ({ ...prev, toolInUse: null }));
                                      if (tmdbData) {
                                          const mappedMovie: Movie = {
                                              id: `tmdb-${tmdbData.id}`,
                                              tmdbId: tmdbData.id,
                                              title: tmdbData.title,
                                              year: parseInt(tmdbData.release_date?.split('-')[0]) || 0,
                                              director: "IA",
                                              genre: [],
                                              posterUrl: getImageUrl(tmdbData.poster_path),
                                              description: tmdbData.overview,
                                              rating: tmdbData.vote_average,
                                              totalVotes: 0
                                          };
                                          setLiveSession(prev => ({
                                              ...prev,
                                              visualContent: [...prev.visualContent, { type: 'movie', data: mappedMovie }]
                                          }));
                                      }
                                  }).catch(() => setLiveSession(prev => ({ ...prev, toolInUse: null })));

                                  functionResponses.push({ id: fc.id, name: fc.name, response: { result: "ok" } });
                              }
                              else if (fc.name === 'show_person') {
                                  const { name } = fc.args as any;
                                  setLiveSession(prev => ({ ...prev, toolInUse: `Buscando: ${name}` }));
                                  searchPersonTMDB(name, tmdbToken).then(results => {
                                      setLiveSession(prev => ({ ...prev, toolInUse: null }));
                                      if (results && results.length > 0) {
                                          setLiveSession(prev => ({
                                              ...prev,
                                              visualContent: [...prev.visualContent, { type: 'person', data: results[0] }]
                                          }));
                                      }
                                  }).catch(() => setLiveSession(prev => ({ ...prev, toolInUse: null })));
                                  functionResponses.push({ id: fc.id, name: fc.name, response: { result: "ok" } });
                              }
                          }
                          if (functionResponses.length > 0) {
                              sessionPromise.then(session => session.sendToolResponse({ functionResponses }));
                          }
                      }
                  },
                  onclose: () => stopLiveSession(),
                  onerror: (e) => { 
                      console.error(e); 
                      if (liveSessionRef.current) setLiveSession(prev => ({ ...prev, status: 'Error de conexión' })); 
                  }
              }
          });
          liveSessionRef.current = await sessionPromise;
      } catch (e) {
          console.error(e);
          stopLiveSession(); 
          setLiveSession(prev => ({ ...prev, isConnected: false, status: 'Error al iniciar' }));
      }
  };

  // ... Auth useEffect ...
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
              const userData = userDoc.data() as User;
              if (userData.status === 'active' || userData.isAdmin) {
                setUser(userData);
                setCurrentView(ViewState.NEWS);
              } else {
                setUser(null);
                setCurrentView(ViewState.LOGIN);
              }
            } else { setUser(null); }
        } catch (e: any) { console.error(String(e)); setUser(null); }
      } else { setUser(null); setCurrentView(ViewState.LOGIN); }
    });
    return () => unsubscribe();
  }, []);

  const getEpisodeCount = async (): Promise<number> => {
      try {
          const coll = collection(db, 'events');
          const q = query(coll, where("phase", "==", "closed"));
          const snapshot = await getCountFromServer(q);
          return snapshot.data().count + 1; 
      } catch (e) {
          return 1;
      }
  };

  const resolveVotingOutcome = async (event: CineEvent) => {
      try {
          let winner = event.candidates[0];
          if (event.candidates.length > 0) {
              const sorted = [...event.candidates].sort((a, b) => b.votes.length - a.votes.length);
              winner = sorted[0];
          }
          if (winner) {
              await updateDoc(doc(db, 'events', event.id), { 
                  phase: 'viewing',
                  winnerTmdbId: winner.tmdbId
              });
          }
      } catch (e) { console.error(String(e)); }
  };

  const resolveTimeDecision = async (event: CineEvent, winnerMovieTitle: string) => {
      try {
          const counts: Record<string, number> = {};
          if (event.timeVotes) {
              Object.entries(event.timeVotes).forEach(([time, voters]) => {
                  counts[time] = voters.length;
              });
          }

          const episodeNum = await getEpisodeCount();
          const result = await decideBestTime(counts, winnerMovieTitle, episodeNum);
          
          await updateDoc(doc(db, 'events', event.id), {
              finalDebateDate: Date.now(), 
              debateDecisionMessage: `${result.chosenTime} | ${result.message}`
          });
      } catch (e) { console.error(String(e)); }
  };

  // AUTO NEWS GENERATOR (TRIGGER ON VISIT)
  useEffect(() => {
        const checkAndGenerateNews = async () => {
            if (news.length === 0 || !tmdbToken) return; // Need news to check date, and token to search images
            
            const now = Date.now();
            const lastNewsTime = news[0]?.timestamp || 0;
            const hoursSinceLast = (now - lastNewsTime) / (1000 * 60 * 60);
            
            // Check daily limit (10 per day)
            const startOfDay = new Date();
            startOfDay.setHours(0,0,0,0);
            const todayNewsCount = news.filter(n => n.timestamp > startOfDay.getTime() && n.type === 'general').length;

            // Trigger if: > 2 hours since last AND < 10 today
            if (hoursSinceLast > 2 && todayNewsCount < 10) {
                console.log("Auto-generating news...");
                try {
                    const existingTitles = news.map(n => n.title);
                    const generatedList = await generateCinemaNews(existingTitles);
                    
                    if (generatedList.length > 0) {
                        const item = generatedList[0];
                        // Try to get real image
                        let imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(item.visualPrompt)}?nologo=true&width=800&height=400`;
                        
                        if (item.searchQuery && tmdbToken) {
                             try {
                                 // Prioritize movie image
                                 const movies = await searchMoviesTMDB(item.searchQuery, tmdbToken);
                                 if (movies.length > 0 && movies[0].backdrop_path) {
                                     imgUrl = getImageUrl(movies[0].backdrop_path, 'original');
                                 } else if (movies.length > 0 && movies[0].poster_path) {
                                     imgUrl = getImageUrl(movies[0].poster_path, 'w500');
                                 } else {
                                     // Fallback person
                                     const people = await searchPersonTMDB(item.searchQuery, tmdbToken);
                                     if (people.length > 0 && people[0].profile_path) {
                                         imgUrl = getImageUrl(people[0].profile_path, 'original');
                                     }
                                 }
                             } catch(e) {
                                 console.warn("Auto-news image search failed, using AI fallback");
                             }
                        }

                        await publishNews(item.title, item.content, 'general', imgUrl);
                    }
                } catch (e) {
                    console.error("Auto news error", e);
                }
            }
        };

        // Run check 5 seconds after load to ensure data is ready
        const timer = setTimeout(checkAndGenerateNews, 5000);
        return () => clearTimeout(timer);
  }, [news.length, tmdbToken]);

  useEffect(() => {
    if (!user?.id) return;
    const safeSnapshotError = (err: any) => console.log("Snapshot error:", String(err));

    // ... Standard collections listeners ...
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setAllUsers(snapshot.docs.map(doc => doc.data() as User));
      if (auth.currentUser) {
          const me = snapshot.docs.find(d => d.id === auth.currentUser?.uid)?.data() as User;
          if (me && (me.status === 'active' || me.isAdmin)) setUser(me);
      }
    }, safeSnapshotError);

    const unsubMovies = onSnapshot(collection(db, 'movies'), (snapshot) => setMovies(snapshot.docs.map(doc => doc.data() as Movie)), safeSnapshotError);
    const unsubRatings = onSnapshot(collection(db, 'ratings'), (snapshot) => setUserRatings(snapshot.docs.map(doc => doc.data() as UserRating)), safeSnapshotError);
    const unsubConfig = onSnapshot(doc(db, 'settings', 'tmdb'), (doc) => { if (doc.exists()) setTmdbTokenState(doc.data().token || ''); }, safeSnapshotError);
    const unsubNews = onSnapshot(query(collection(db, 'news'), orderBy('timestamp', 'desc'), limit(20)), (snapshot) => setNews(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NewsItem))), safeSnapshotError);
    const unsubFeedback = onSnapshot(query(collection(db, 'feedback'), orderBy('timestamp', 'desc')), (snapshot) => setFeedbackList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppFeedback))), safeSnapshotError);

    // EVENTS & AUTOMATION
    const eventsQuery = query(collection(db, 'events'), orderBy('startDate', 'desc'));
    const unsubEvents = onSnapshot(eventsQuery, (snapshot) => {
        if (!snapshot.empty) {
            const evt = snapshot.docs[0].data() as CineEvent;
            
            // 1. Check Voting Deadline
            if (evt.phase === 'voting' && Date.now() > evt.votingDeadline) {
                resolveVotingOutcome(evt);
            }

            // 2. Check Time Voting Deadline (Thursday before Sunday deadline)
            const timeVotingDeadline = evt.viewingDeadline - (3 * 24 * 60 * 60 * 1000); 
            if (evt.phase === 'viewing' && !evt.finalDebateDate && Date.now() > timeVotingDeadline) {
                const winnerMovie = evt.candidates.find(c => c.tmdbId === evt.winnerTmdbId);
                resolveTimeDecision(evt, winnerMovie?.title || 'la película');
            }

            // 3. AUTO-START DISCUSSION PHASE (When scheduled time arrives)
            // Using finalDebateDate as the trigger.
            if (evt.phase === 'viewing' && evt.finalDebateDate && Date.now() > evt.finalDebateDate) {
                transitionEventPhase(evt.id, 'discussion');
            }

            if (evt.phase !== 'closed') setActiveEvent(evt);
            else setActiveEvent(null);
        } else { setActiveEvent(null); }
    }, safeSnapshotError);

    return () => { unsubUsers(); unsubMovies(); unsubRatings(); unsubConfig(); unsubEvents(); unsubNews(); unsubFeedback(); };
  }, [user?.id]);

  // Chat Listener
  useEffect(() => {
      if (!user?.id || !activeEvent || activeEvent.phase !== 'discussion') { setEventMessages([]); return; }
      const msgsQuery = query(collection(db, 'events', activeEvent.id, 'chat'), orderBy('timestamp', 'asc'));
      const unsubChat = onSnapshot(msgsQuery, (snapshot) => setEventMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EventMessage))), (e) => console.log(String(e)));
      return () => unsubChat();
  }, [user?.id, activeEvent?.id, activeEvent?.phase]);

  // --- CRUD METHODS ---
  const isAdminEmail = (email: string) => email.toLowerCase().startsWith('andresroblesjimenez');
  const login = async (email: string, pass: string) => { try { await signInWithEmailAndPassword(auth, email, pass); return { success: true, message: "OK" }; } catch (e:any) { return { success: false, message: String(e.message) }; } };
  const logout = async () => { await signOut(auth); setUser(null); setCurrentView(ViewState.LOGIN); };
  const register = async (email: string, name: string, pass: string, avatar?: string) => { 
      try { 
          await createUserWithEmailAndPassword(auth, email, pass); 
          const u: User = { 
              id: auth.currentUser!.uid, 
              email, 
              name, 
              avatarUrl: avatar || `https://ui-avatars.com/api/?name=${name}`, 
              watchedMovies: [], 
              watchlist: [], 
              status: isAdminEmail(email)?'active':'pending', 
              isAdmin: isAdminEmail(email),
              xp: 0,
              level: 1,
              completedMissions: []
          }; 
          await setDoc(doc(db, 'users', u.id), u); 
          return { success: true, message: "OK" }; 
      } catch (e:any) { return { success: false, message: String(e.message) }; } 
  };
  const resetPassword = async (email: string) => { try { await sendPasswordResetEmail(auth, email); return { success: true, message: "Email enviado" }; } catch(e:any) { return { success: false, message: String(e.message) }; } };
  const updateUserProfile = async (name: string, avatarUrl: string) => { 
      if (!user) return; 
      try { 
          await updateDoc(doc(db, 'users', user.id), { name, avatarUrl }); 
          // Trigger gamification check on profile update
          checkAchievements({ ...user, name, avatarUrl });
      } catch (e) { console.error(String(e)); } 
  };
  const approveUser = async (uid: string) => { try { await updateDoc(doc(db, 'users', uid), { status: 'active' }); } catch (e) { console.error(String(e)); } };
  const rejectUser = async (uid: string) => { try { await updateDoc(doc(db, 'users', uid), { status: 'rejected' }); } catch (e) { console.error(String(e)); } };
  const setView = (v: ViewState, mid?: string) => { setCurrentView(v); if (mid) setSelectedMovieId(mid); };
  
  const addMovie = async (movie: Movie) => { try { const r = doc(db, 'movies', movie.id); const s = await getDoc(r); if (!s.exists()) await setDoc(r, movie); } catch (e) { console.error(String(e)); } };
  const setTmdbToken = async (token: string) => { try { await setDoc(doc(db, 'settings', 'tmdb'), { token }); } catch (e) { console.error(String(e)); } };
  
  const rateMovie = async (movieId: string, rating: DetailedRating, comment?: string, spoiler?: string) => { 
      if (!user) return; 
      try { 
          const id = `${user.id}_${movieId}`; 
          const r: UserRating = { movieId, userId: user.id, detailed: rating, rating: rating.average, comment, spoiler, timestamp: Date.now(), likes: [], dislikes: [] }; 
          await setDoc(doc(db, 'ratings', id), r); 
          if (!user.watchedMovies.includes(movieId)) await updateDoc(doc(db, 'users', user.id), { watchedMovies: arrayUnion(movieId), watchlist: arrayRemove(movieId) }); 
          const all = userRatings.filter(x => x.movieId === movieId && x.userId !== user.id).concat(r); 
          const avg = all.reduce((a,b) => a+b.rating, 0)/all.length; 
          await updateDoc(doc(db, 'movies', movieId), { rating: parseFloat(avg.toFixed(1)), totalVotes: all.length }); 
          
          // Trigger gamification
          checkAchievements(user);
      } catch (e) { console.error(String(e)); } 
  };
  
  const unwatchMovie = async (movieId: string) => { if (!user) return; try { await deleteDoc(doc(db, 'ratings', `${user.id}_${movieId}`)); await updateDoc(doc(db, 'users', user.id), { watchedMovies: arrayRemove(movieId) }); } catch (e) { console.error(String(e)); } };
  
  const toggleReviewVote = async (tid: string, mid: string, type: 'like'|'dislike') => { 
      if (!user) return; 
      try { 
          const ref = doc(db, 'ratings', `${tid}_${mid}`); 
          const s = await getDoc(ref); 
          if (!s.exists()) return; 
          const d = s.data() as UserRating; 
          const likes = d.likes||[]; 
          const dislikes = d.dislikes||[]; 
          let u: any = {}; 
          if (type === 'like') { if (likes.includes(user.id)) u['likes'] = arrayRemove(user.id); else { u['likes'] = arrayUnion(user.id); if (dislikes.includes(user.id)) u['dislikes'] = arrayRemove(user.id); } } else { if (dislikes.includes(user.id)) u['dislikes'] = arrayRemove(user.id); else { u['dislikes'] = arrayUnion(user.id); if (likes.includes(user.id)) u['likes'] = arrayRemove(user.id); } } 
          await updateDoc(ref, u); 
          
          // Trigger gamification for the review author (they got a like)
          const author = allUsers.find(u => u.id === tid);
          if (author) checkAchievements(author);

      } catch (e) { console.error(String(e)); } 
  };

  // --- SYNCED WATCHLIST ---
  const toggleWatchlist = async (movieId: string) => {
    if (!user) return;
    try {
        const inWatchlist = user.watchlist.includes(movieId);
        if (user.watchedMovies.includes(movieId)) {
            await unwatchMovie(movieId);
            await updateDoc(doc(db, 'users', user.id), { watchlist: arrayUnion(movieId) });
        } else if (inWatchlist) {
            await updateDoc(doc(db, 'users', user.id), { watchlist: arrayRemove(movieId) });
            if (activeEvent && activeEvent.phase === 'viewing') {
                const winner = activeEvent.candidates.find(c => c.tmdbId === activeEvent.winnerTmdbId);
                const winnerInternalId = movies.find(m => m.tmdbId === winner?.tmdbId)?.id;
                if (winnerInternalId === movieId) {
                    await updateDoc(doc(db, 'events', activeEvent.id), { committedViewers: arrayRemove(user.id) });
                }
            }
        } else {
            await updateDoc(doc(db, 'users', user.id), { watchlist: arrayUnion(movieId) });
        }
    } catch (e) { console.error(String(e)); }
  };

  const createEvent = async (eventData: Partial<CineEvent>) => {
      if (!user?.isAdmin) return;
      try {
          const newEvent: CineEvent = {
              id: Date.now().toString(),
              themeTitle: eventData.themeTitle || 'Evento',
              themeDescription: eventData.themeDescription || '',
              aiReasoning: eventData.aiReasoning || '',
              candidates: eventData.candidates || [],
              phase: 'voting',
              startDate: Date.now(),
              votingDeadline: Date.now() + (7 * 24 * 60 * 60 * 1000), 
              viewingDeadline: Date.now() + (14 * 24 * 60 * 60 * 1000),
              backdropUrl: eventData.backdropUrl,
              committedViewers: [],
              committedDebaters: [],
              timeVotes: {},
              speakerQueue: [],
              currentSpeakerId: null
          };
          await setDoc(doc(db, 'events', newEvent.id), newEvent);
      } catch (e) { console.error(String(e)); }
  };

  const closeEvent = async (eventId: string) => {
      if (!user?.isAdmin) return;
      try { setActiveEvent(null); await updateDoc(doc(db, 'events', eventId), { phase: 'closed' }); } catch (e) { console.error(String(e)); }
  };

  const voteForCandidate = async (eventId: string, tmdbId: number) => {
      if (!user) return;
      try {
          const eventRef = doc(db, 'events', eventId);
          const evtSnap = await getDoc(eventRef);
          if (!evtSnap.exists()) return;
          const evt = evtSnap.data() as CineEvent;
          const updatedCandidates = evt.candidates.map(c => ({ ...c, votes: c.votes.filter(uid => uid !== user.id) }));
          const target = updatedCandidates.find(c => c.tmdbId === tmdbId);
          if (target) target.votes.push(user.id);
          await updateDoc(eventRef, { candidates: updatedCandidates });
      } catch (e) { console.error(String(e)); }
  };

  const toggleEventCommitment = async (eventId: string, type: 'view' | 'debate') => {
      if (!user || !activeEvent) return;
      try {
          const eventRef = doc(db, 'events', eventId);
          const evt = (await getDoc(eventRef)).data() as CineEvent;
          const field = type === 'view' ? 'committedViewers' : 'committedDebaters';
          const list = evt[field] || [];
          
          if (list.includes(user.id)) {
              await updateDoc(eventRef, { [field]: arrayRemove(user.id) });
              if (type === 'view') {
                  const winner = evt.candidates.find(c => c.tmdbId === evt.winnerTmdbId);
                  if (winner) {
                      const movie = movies.find(m => m.tmdbId === winner.tmdbId);
                      if (movie) await updateDoc(doc(db, 'users', user.id), { watchlist: arrayRemove(movie.id) });
                  }
              }
          } else {
              await updateDoc(eventRef, { [field]: arrayUnion(user.id) });
              if (type === 'view') {
                  const winner = evt.candidates.find(c => c.tmdbId === evt.winnerTmdbId);
                  if (winner) {
                      let internalId = movies.find(m => m.tmdbId === winner.tmdbId)?.id;
                      if (!internalId) {
                          // Would need to fetch and add logic here if robust
                      } else {
                          await updateDoc(doc(db, 'users', user.id), { watchlist: arrayUnion(internalId) });
                      }
                  }
              }
          }
      } catch (e) { console.error(String(e)); }
  };

  const toggleTimeVote = async (eventId: string, timeSlot: string) => {
      if (!user) return;
      try {
          const eventRef = doc(db, 'events', eventId);
          const evt = (await getDoc(eventRef)).data() as CineEvent;
          const currentVotes = evt.timeVotes || {};
          const slotVotes = currentVotes[timeSlot] || [];
          let newSlotVotes;
          if (slotVotes.includes(user.id)) newSlotVotes = slotVotes.filter(uid => uid !== user.id);
          else newSlotVotes = [...slotVotes, user.id];
          await updateDoc(eventRef, { [`timeVotes.${timeSlot}`]: newSlotVotes });
      } catch (e) { console.error(String(e)); }
  };

  const transitionEventPhase = async (eventId: string, phase: EventPhase, winnerId?: number) => { try { const u: any = { phase }; if (winnerId) u.winnerTmdbId = winnerId; await updateDoc(doc(db, 'events', eventId), u); } catch (e) { console.error(String(e)); } };
  
  const sendEventMessage = async (eventId: string, text: string, role: 'user' | 'moderator' = 'user', audioBase64?: string) => { 
      if (!user) return; 
      try { 
          const m: Omit<EventMessage, 'id'> = { 
              userId: user.id, 
              userName: role === 'moderator' ? 'IA Moderadora' : user.name, 
              userAvatar: role === 'moderator' ? 'https://ui-avatars.com/api/?name=AI&background=d4af37&color=000' : user.avatarUrl, 
              text, 
              timestamp: Date.now(), 
              role,
              ...(audioBase64 && { audioBase64 }) 
          }; 
          await addDoc(collection(db, 'events', eventId, 'chat'), m); 
          
          // Chatting in Cineforum gives XP (Check mission)
          if (role === 'user') checkAchievements(user);

      } catch (e) { console.error(String(e)); } 
  };

  // --- TURN MANAGEMENT ---
  const raiseHand = async (eventId: string) => {
      if (!user) return;
      try {
          await updateDoc(doc(db, 'events', eventId), { speakerQueue: arrayUnion(user.id) });
      } catch(e) { console.error(String(e)); }
  };

  const grantTurn = async (eventId: string, userId: string) => {
      try {
          await updateDoc(doc(db, 'events', eventId), { 
              currentSpeakerId: userId,
              speakerQueue: arrayRemove(userId)
          });
      } catch(e) { console.error(String(e)); }
  };

  const releaseTurn = async (eventId: string) => {
      try {
          await updateDoc(doc(db, 'events', eventId), { currentSpeakerId: null });
      } catch(e) { console.error(String(e)); }
  };

  const sendFeedback = async (type: 'bug'|'feature', text: string) => { if (!user) return; try { await addDoc(collection(db, 'feedback'), { userId: user.id, userName: user.name, type, text, status: 'pending', timestamp: Date.now() }); } catch (e) { console.error(String(e)); } };
  const deleteFeedback = async (id: string) => { if (!user?.isAdmin) return; try { await deleteDoc(doc(db, 'feedback', id)); } catch (e) { console.error(String(e)); } };
  const resolveFeedback = async (id: string, res?: string) => { if (!user?.isAdmin) return; try { await updateDoc(doc(db, 'feedback', id), { status: 'solved', adminResponse: res || 'Gracias.' }); const f = (await getDoc(doc(db, 'feedback', id))).data() as AppFeedback; await publishNews(f.type === 'bug' ? '🐛 Bug Corregido' : '✨ Mejora', `Solucionado: "${f.text}"`, 'update'); } catch (e) { console.error(String(e)); } };
  const publishNews = async (title: string, content: string, type: 'general'|'update'|'event', img?: string) => { if (!user?.isAdmin) return; try { await addDoc(collection(db, 'news'), { title, content, type, timestamp: Date.now(), ...(img && { imageUrl: img }) }); } catch (e) { console.error(String(e)); } };
  const getMovie = (id: string) => movies.find(m => m.id === id);

  return (
    <DataContext.Provider value={{
      user, allUsers, movies, userRatings, activeEvent, eventMessages, news, feedbackList, currentView, selectedMovieId, tmdbToken,
      topCriticId, getRemainingVoiceSeconds,
      setTmdbToken, login, logout, register, resetPassword, updateUserProfile, approveUser, rejectUser, setView, rateMovie, unwatchMovie, toggleWatchlist, toggleReviewVote, addMovie, getMovie,
      createEvent, closeEvent, voteForCandidate, transitionEventPhase, sendEventMessage, toggleEventCommitment, toggleTimeVote,
      raiseHand, grantTurn, releaseTurn,
      sendFeedback, resolveFeedback, publishNews, deleteFeedback, getEpisodeCount,
      liveSession, startLiveSession, stopLiveSession,
      notification, clearNotification
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) throw new Error('useData must be used within a DataProvider');
  return context;
};
