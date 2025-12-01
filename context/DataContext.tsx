
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Movie, User, UserRating, ViewState, DetailedRating, CineEvent, EventPhase, EventMessage, AppFeedback, NewsItem, LiveSessionState } from '../types';
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
import { decideBestTime } from '../services/geminiService';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { findMovieByTitleAndYear, getImageUrl, searchPersonTMDB } from '../services/tmdbService';

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
  
  // Live Session Global State
  liveSession: LiveSessionState;
  startLiveSession: () => Promise<void>;
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
  sendEventMessage: (eventId: string, text: string, role?: 'user' | 'moderator') => Promise<void>;
  toggleEventCommitment: (eventId: string, type: 'view' | 'debate') => Promise<void>;
  toggleTimeVote: (eventId: string, timeSlot: string) => Promise<void>;

  sendFeedback: (type: 'bug' | 'feature', text: string) => Promise<void>;
  resolveFeedback: (feedbackId: string, response?: string) => Promise<void>;
  publishNews: (title: string, content: string, type: 'general' | 'update' | 'event', imageUrl?: string) => Promise<void>;
  deleteFeedback: (id: string) => Promise<void>;
  
  getEpisodeCount: () => Promise<number>;
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

  // --- LIVE SESSION METHODS ---
  const stopLiveSession = () => {
      if (liveSessionRef.current) {
          try { liveSessionRef.current.close(); } catch(e) {}
          liveSessionRef.current = null;
      }
      if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
      if (inputSourceRef.current) { inputSourceRef.current.disconnect(); inputSourceRef.current = null; }
      if (currentStreamRef.current) { currentStreamRef.current.getTracks().forEach(track => track.stop()); currentStreamRef.current = null; }
      if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
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

  const startLiveSession = async () => {
      if (!user) return;
      
      try {
          setLiveSession(prev => ({ ...prev, isConnected: true, status: 'Conectando...', visualContent: [] }));

          const watchedTitles = movies.filter(m => user.watchedMovies.includes(m.id)).map(m => m.title).join(", ");
          const systemInstruction = `
            Eres un experto en cine del club "Cine Mensa Murcia". Estás en una llamada de voz en tiempo real con el socio ${user.name}.
            DATOS: Ha visto: ${watchedTitles.slice(0, 500)}...
            OBJETIVO: Conversación natural, fluida y divertida. Respuestas BREVES (1-3 frases).
            
            HERRAMIENTAS VISUALES (PANTALLA COMPARTIDA):
            - Tienes una PANTALLA COMPARTIDA con el usuario. ÚSALA CONSTANTEMENTE.
            - Si mencionas una PELÍCULA -> Ejecuta "show_movie(titulo)".
            - Si mencionas un ACTOR o DIRECTOR -> Ejecuta "show_person(nombre)".
            - ¡Es obligatorio! Muestra el contenido visualmente.
          `;

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
                                  
                                  // Fetch without awaiting to not block audio
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
                  onerror: (e) => { console.error(e); setLiveSession(prev => ({ ...prev, status: 'Error de conexión' })); }
              }
          });
          liveSessionRef.current = await sessionPromise;
      } catch (e) {
          console.error(e);
          setLiveSession(prev => ({ ...prev, isConnected: false, status: 'Error' }));
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
          return snapshot.data().count + 1; // Current episode is count + 1
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
          // Flatten votes to count: { "Friday 22:00": 5, "Sat 22:00": 3 }
          const counts: Record<string, number> = {};
          if (event.timeVotes) {
              Object.entries(event.timeVotes).forEach(([time, voters]) => {
                  counts[time] = voters.length;
              });
          }

          const episodeNum = await getEpisodeCount();
          const result = await decideBestTime(counts, winnerMovieTitle, episodeNum);
          
          await updateDoc(doc(db, 'events', event.id), {
              finalDebateDate: Date.now(), // Just a flag that it's done
              debateDecisionMessage: `${result.chosenTime} | ${result.message}`
          });
      } catch (e) { console.error(String(e)); }
  };

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

  // ... (Login, Register, Reset, etc - same as before) ...
  const isAdminEmail = (email: string) => email.toLowerCase().startsWith('andresroblesjimenez');
  const login = async (email: string, pass: string) => { try { await signInWithEmailAndPassword(auth, email, pass); return { success: true, message: "OK" }; } catch (e:any) { return { success: false, message: String(e.message) }; } };
  const logout = async () => { await signOut(auth); setUser(null); setCurrentView(ViewState.LOGIN); };
  const register = async (email: string, name: string, pass: string, avatar?: string) => { try { await createUserWithEmailAndPassword(auth, email, pass); const u: User = { id: auth.currentUser!.uid, email, name, avatarUrl: avatar || `https://ui-avatars.com/api/?name=${name}`, watchedMovies: [], watchlist: [], status: isAdminEmail(email)?'active':'pending', isAdmin: isAdminEmail(email) }; await setDoc(doc(db, 'users', u.id), u); return { success: true, message: "OK" }; } catch (e:any) { return { success: false, message: String(e.message) }; } };
  const resetPassword = async (email: string) => { try { await sendPasswordResetEmail(auth, email); return { success: true, message: "Email enviado" }; } catch(e:any) { return { success: false, message: String(e.message) }; } };
  const updateUserProfile = async (name: string, avatarUrl: string) => { if (!user) return; try { await updateDoc(doc(db, 'users', user.id), { name, avatarUrl }); } catch (e) { console.error(String(e)); } };
  const approveUser = async (uid: string) => { try { await updateDoc(doc(db, 'users', uid), { status: 'active' }); } catch (e) { console.error(String(e)); } };
  const rejectUser = async (uid: string) => { try { await updateDoc(doc(db, 'users', uid), { status: 'rejected' }); } catch (e) { console.error(String(e)); } };
  const setView = (v: ViewState, mid?: string) => { setCurrentView(v); if (mid) setSelectedMovieId(mid); };
  
  const addMovie = async (movie: Movie) => { try { const r = doc(db, 'movies', movie.id); const s = await getDoc(r); if (!s.exists()) await setDoc(r, movie); } catch (e) { console.error(String(e)); } };
  const setTmdbToken = async (token: string) => { try { await setDoc(doc(db, 'settings', 'tmdb'), { token }); } catch (e) { console.error(String(e)); } };
  const rateMovie = async (movieId: string, rating: DetailedRating, comment?: string, spoiler?: string) => { if (!user) return; try { const id = `${user.id}_${movieId}`; const r: UserRating = { movieId, userId: user.id, detailed: rating, rating: rating.average, comment, spoiler, timestamp: Date.now(), likes: [], dislikes: [] }; await setDoc(doc(db, 'ratings', id), r); if (!user.watchedMovies.includes(movieId)) await updateDoc(doc(db, 'users', user.id), { watchedMovies: arrayUnion(movieId), watchlist: arrayRemove(movieId) }); const all = userRatings.filter(x => x.movieId === movieId && x.userId !== user.id).concat(r); const avg = all.reduce((a,b) => a+b.rating, 0)/all.length; await updateDoc(doc(db, 'movies', movieId), { rating: parseFloat(avg.toFixed(1)), totalVotes: all.length }); } catch (e) { console.error(String(e)); } };
  const unwatchMovie = async (movieId: string) => { if (!user) return; try { await deleteDoc(doc(db, 'ratings', `${user.id}_${movieId}`)); await updateDoc(doc(db, 'users', user.id), { watchedMovies: arrayRemove(movieId) }); } catch (e) { console.error(String(e)); } };
  const toggleReviewVote = async (tid: string, mid: string, type: 'like'|'dislike') => { if (!user) return; try { const ref = doc(db, 'ratings', `${tid}_${mid}`); const s = await getDoc(ref); if (!s.exists()) return; const d = s.data() as UserRating; const likes = d.likes||[]; const dislikes = d.dislikes||[]; let u: any = {}; if (type === 'like') { if (likes.includes(user.id)) u['likes'] = arrayRemove(user.id); else { u['likes'] = arrayUnion(user.id); if (dislikes.includes(user.id)) u['dislikes'] = arrayRemove(user.id); } } else { if (dislikes.includes(user.id)) u['dislikes'] = arrayRemove(user.id); else { u['dislikes'] = arrayUnion(user.id); if (likes.includes(user.id)) u['likes'] = arrayRemove(user.id); } } await updateDoc(ref, u); } catch (e) { console.error(String(e)); } };

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
            // SYNC: If removed from watchlist, remove from event commitment if applicable
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

  // --- EVENT METHODS ---
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
              timeVotes: {}
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
              // SYNC: If uncommitting from view, remove from watchlist
              if (type === 'view') {
                  const winner = evt.candidates.find(c => c.tmdbId === evt.winnerTmdbId);
                  if (winner) {
                      const movie = movies.find(m => m.tmdbId === winner.tmdbId);
                      if (movie) await updateDoc(doc(db, 'users', user.id), { watchlist: arrayRemove(movie.id) });
                  }
              }
          } else {
              await updateDoc(eventRef, { [field]: arrayUnion(user.id) });
              // SYNC: If committing to view, add to watchlist
              if (type === 'view') {
                  const winner = evt.candidates.find(c => c.tmdbId === evt.winnerTmdbId);
                  if (winner) {
                      let internalId = movies.find(m => m.tmdbId === winner.tmdbId)?.id;
                      if (!internalId) {
                          // Would need to fetch and add, simplified here
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
          if (slotVotes.includes(user.id)) {
              newSlotVotes = slotVotes.filter(uid => uid !== user.id);
          } else {
              newSlotVotes = [...slotVotes, user.id];
          }
          
          await updateDoc(eventRef, { [`timeVotes.${timeSlot}`]: newSlotVotes });
      } catch (e) { console.error(String(e)); }
  };

  const transitionEventPhase = async (eventId: string, phase: EventPhase, winnerId?: number) => { try { const u: any = { phase }; if (winnerId) u.winnerTmdbId = winnerId; await updateDoc(doc(db, 'events', eventId), u); } catch (e) { console.error(String(e)); } };
  const sendEventMessage = async (eventId: string, text: string, role: 'user' | 'moderator' = 'user') => { if (!user) return; try { const m: Omit<EventMessage, 'id'> = { userId: user.id, userName: role === 'moderator' ? 'IA Moderadora' : user.name, userAvatar: role === 'moderator' ? 'https://ui-avatars.com/api/?name=AI&background=d4af37&color=000' : user.avatarUrl, text, timestamp: Date.now(), role }; await addDoc(collection(db, 'events', eventId, 'chat'), m); } catch (e) { console.error(String(e)); } };

  // News & Feedback
  const sendFeedback = async (type: 'bug'|'feature', text: string) => { if (!user) return; try { await addDoc(collection(db, 'feedback'), { userId: user.id, userName: user.name, type, text, status: 'pending', timestamp: Date.now() }); } catch (e) { console.error(String(e)); } };
  const deleteFeedback = async (id: string) => { if (!user?.isAdmin) return; try { await deleteDoc(doc(db, 'feedback', id)); } catch (e) { console.error(String(e)); } };
  const resolveFeedback = async (id: string, res?: string) => { if (!user?.isAdmin) return; try { await updateDoc(doc(db, 'feedback', id), { status: 'solved', adminResponse: res || 'Gracias.' }); const f = (await getDoc(doc(db, 'feedback', id))).data() as AppFeedback; await publishNews(f.type === 'bug' ? '🐛 Bug Corregido' : '✨ Mejora', `Solucionado: "${f.text}"`, 'update'); } catch (e) { console.error(String(e)); } };
  const publishNews = async (title: string, content: string, type: 'general'|'update'|'event', img?: string) => { if (!user?.isAdmin) return; try { await addDoc(collection(db, 'news'), { title, content, type, timestamp: Date.now(), ...(img && { imageUrl: img }) }); } catch (e) { console.error(String(e)); } };
  const getMovie = (id: string) => movies.find(m => m.id === id);

  return (
    <DataContext.Provider value={{
      user, allUsers, movies, userRatings, activeEvent, eventMessages, news, feedbackList, currentView, selectedMovieId, tmdbToken,
      setTmdbToken, login, logout, register, resetPassword, updateUserProfile, approveUser, rejectUser, setView, rateMovie, unwatchMovie, toggleWatchlist, toggleReviewVote, addMovie, getMovie,
      createEvent, closeEvent, voteForCandidate, transitionEventPhase, sendEventMessage, toggleEventCommitment, toggleTimeVote,
      sendFeedback, resolveFeedback, publishNews, deleteFeedback, getEpisodeCount,
      liveSession, startLiveSession, stopLiveSession
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
