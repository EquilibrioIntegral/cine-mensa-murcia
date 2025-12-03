

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Movie, User, UserRating, ViewState, DetailedRating, CineEvent, EventPhase, EventMessage, AppFeedback, NewsItem, LiveSessionState, Mission, ShopItem, MilestoneEvent } from '../types';
import { auth, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
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
  getCountFromServer,
  writeBatch,
  getDocs,
  deleteField,
  increment
} from "firebase/firestore";
import { decideBestTime, generateCinemaNews } from '../services/geminiService';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { findMovieByTitleAndYear, getImageUrl, searchPersonTMDB, searchMoviesTMDB } from '../services/tmdbService';
import { MISSIONS, XP_TABLE, RANKS } from '../constants';

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
  login: (email: string, name: string) => Promise<{ success: boolean; message: string }>; // name unused in login but kept for sig match
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
  notification: { message: string, type: 'level' | 'mission' | 'shop' } | null;
  clearNotification: () => void;

  // Economy
  earnCredits: (amount: number, reason: string) => Promise<void>;
  spendCredits: (amount: number, itemId: string) => Promise<boolean>;

  // Career Milestone Modal State
  milestoneEvent: MilestoneEvent | null;
  closeMilestoneModal: () => void;
  initialProfileTab: 'profile' | 'career'; // To control Profile tab on navigation
  setInitialProfileTab: (tab: 'profile' | 'career') => void;

  // Admin Tools
  resetGamification: () => Promise<void>;
  
  // Trigger Action (for new missions)
  triggerAction: (action: string) => Promise<void>;

  // Manual Level Up Logic
  completeLevelUpChallenge: (nextLevel: number, rewardCredits: number) => Promise<void>;
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
  
  const [notification, setNotification] = useState<{ message: string, type: 'level' | 'mission' | 'shop' } | null>(null);
  const [milestoneEvent, setMilestoneEvent] = useState<MilestoneEvent | null>(null);
  const [initialProfileTab, setInitialProfileTab] = useState<'profile' | 'career'>('profile');

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

  // AUTH LISTENER
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch User Data
        const userRef = doc(db, 'users', firebaseUser.uid);
        const unsubscribeUser = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                const userData = docSnap.data() as User;
                setUser(userData);
            }
        });
        return () => unsubscribeUser();
      } else {
        setUser(null);
        setCurrentView(ViewState.LOGIN);
      }
    });
    return () => unsubscribe();
  }, []);

  // SAFE REDIRECT EFFECT
  useEffect(() => {
      if (user && currentView === ViewState.LOGIN) {
          setCurrentView(ViewState.NEWS);
      }
  }, [user, currentView]);

  // DATA SUBSCRIPTIONS
  useEffect(() => {
      const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
          setAllUsers(snap.docs.map(d => d.data() as User));
      });
      const unsubMovies = onSnapshot(collection(db, 'movies'), (snap) => {
          setMovies(snap.docs.map(d => d.data() as Movie));
      });
      const unsubRatings = onSnapshot(collection(db, 'ratings'), (snap) => {
          setUserRatings(snap.docs.map(d => d.data() as UserRating));
      });
      // CRITICAL FIX: Ensure ID is included in News and Feedback items from addDoc
      const unsubNews = onSnapshot(query(collection(db, 'news'), orderBy('timestamp', 'desc')), (snap) => {
          setNews(snap.docs.map(d => ({ ...d.data(), id: d.id } as NewsItem)));
      });
      const unsubFeedback = onSnapshot(collection(db, 'feedback'), (snap) => {
          setFeedbackList(snap.docs.map(d => ({ ...d.data(), id: d.id } as AppFeedback)));
      });
      
      // Active Event
      const qEvent = query(collection(db, 'events'), where('phase', '!=', 'closed'));
      const unsubEvent = onSnapshot(qEvent, (snap) => {
          if (!snap.empty) {
              const event = snap.docs[0].data() as CineEvent;
              setActiveEvent(event);
          } else {
              setActiveEvent(null);
          }
      });
      
      // TMDB Token
      const unsubConfig = onSnapshot(doc(db, 'config', 'tmdb'), (docSnap) => {
         if (docSnap.exists()) {
             setTmdbTokenState(docSnap.data().token);
         }
      });

      return () => {
          unsubUsers(); unsubMovies(); unsubRatings(); unsubNews(); unsubFeedback(); unsubEvent(); unsubConfig();
      };
  }, []);

  // PRESENCE SYSTEM
  useEffect(() => {
      if (user && user.id) {
          updateDoc(doc(db, 'users', user.id), { lastSeen: Date.now() });
          const interval = setInterval(() => {
              if (auth.currentUser) {
                  updateDoc(doc(db, 'users', user.id), { lastSeen: Date.now() });
              }
          }, 60000);
          return () => clearInterval(interval);
      }
  }, [user?.id]);

  // Event Messages
  useEffect(() => {
      if (activeEvent) {
          const qMessages = query(collection(db, `events/${activeEvent.id}/messages`), orderBy('timestamp', 'asc'));
          const unsub = onSnapshot(qMessages, (snap) => {
              setEventMessages(snap.docs.map(d => d.data() as EventMessage));
          });
          return () => unsub();
      } else {
          setEventMessages([]);
      }
  }, [activeEvent?.id]);

  // --- WELCOME MODAL LOGIC ---
  useEffect(() => {
      if (user && user.status === 'active' && !user.hasSeenWelcome) {
          const rank1Title = RANKS.find(r => r.minLevel === 1)?.title || 'Espectador Novato';
          setMilestoneEvent({
              type: 'welcome',
              rankTitle: rank1Title,
              level: 1
          });
      }
  }, [user?.status, user?.hasSeenWelcome]);


  const closeMilestoneModal = async () => {
      if (!user) return;
      setMilestoneEvent(null);
      if (!user.hasSeenWelcome) {
          await updateDoc(doc(db, 'users', user.id), { hasSeenWelcome: true });
      }
  };

  // --- ECONOMY ENGINE ---
  const earnCredits = async (amount: number, reason: string) => {
      if (!user) return;
      try {
          const newCredits = (user.credits || 0) + amount;
          await updateDoc(doc(db, 'users', user.id), { credits: newCredits });
          setNotification({ message: `+${amount} Créditos: ${reason}`, type: 'shop' });
      } catch (e) { console.error("Error earning credits", e); }
  };

  const spendCredits = async (amount: number, itemId: string): Promise<boolean> => {
      if (!user) return false;
      const canAfford = (user.credits || 0) >= amount;
      if (!canAfford && !user.isAdmin) {
          alert("No tienes suficientes créditos.");
          return false;
      }
      try {
          const costToDeduct = user.isAdmin ? 0 : amount;
          const newCredits = (user.credits || 0) - costToDeduct;
          await updateDoc(doc(db, 'users', user.id), {
              credits: newCredits,
              inventory: arrayUnion(itemId)
          });
          setNotification({ 
              message: user.isAdmin ? `¡Artículo activado (Admin)!` : `¡Artículo comprado!`, 
              type: 'shop' 
          });
          return true;
      } catch (e) { console.error("Error spending credits", e); return false; }
  };

  // --- GAMIFICATION ENGINE ---
  // Updated: Filter actions by lastLevelUpTimestamp for relative progression
  const checkAchievements = async (currentUser: User) => {
      if (!currentUser) return;
      
      const adminResetDate = currentUser.lastGamificationReset || 0;
      // KEY CHANGE: Use level timestamp to filter new actions
      const levelStartTime = currentUser.lastLevelUpTimestamp || 0;
      
      // Use the LATEST of the two reset markers for consistent stats within the current level
      const filterTimestamp = Math.max(adminResetDate, levelStartTime);

      // Filter ratings/reviews that happened AFTER the last level up
      const myRatingsRelative = userRatings.filter(r => r.userId === currentUser.id && r.timestamp > filterTimestamp);
      
      const stats = {
          ratingsCount: myRatingsRelative.length,
          reviewsCount: myRatingsRelative.filter(r => r.comment && r.comment.length > 5).length,
          likesReceived: myRatingsRelative.reduce((acc, r) => acc + (r.likes?.length || 0), 0),
          horrorCount: myRatingsRelative.filter(r => {
              const m = movies.find(mov => mov.id === r.movieId);
              return m && m.genre.some(g => g.toLowerCase().includes('terror') || g.toLowerCase().includes('horror'));
          }).length,
          actionCount: myRatingsRelative.filter(r => {
              const m = movies.find(mov => mov.id === r.movieId);
              return m && m.genre.some(g => { const gl = g.toLowerCase(); return gl.includes('acción') || gl.includes('action') || gl.includes('aventura'); });
          }).length,
          comedyCount: myRatingsRelative.filter(r => {
              const m = movies.find(mov => mov.id === r.movieId);
              return m && m.genre.some(g => g.toLowerCase().includes('comedia') || g.toLowerCase().includes('comedy'));
          }).length,
          dramaCount: myRatingsRelative.filter(r => {
              const m = movies.find(mov => mov.id === r.movieId);
              return m && m.genre.some(g => g.toLowerCase().includes('drama'));
          }).length,
          scifiCount: myRatingsRelative.filter(r => {
              const m = movies.find(mov => mov.id === r.movieId);
              return m && m.genre.some(g => g.toLowerCase().includes('ciencia ficción') || g.toLowerCase().includes('sci-fi'));
          }).length
      };

      let newXp = 0; 
      let newCompletedMissions = [...(currentUser.completedMissions || [])]; 
      let missionsCompletedNow: Mission[] = [];

      MISSIONS.forEach(mission => {
          if (newCompletedMissions.includes(mission.id)) {
               newXp += mission.xpReward;
          } else {
              const rank = RANKS.find(r => r.id === mission.rankId);
              // Missions are visible if user level >= rank min level
              // Special case: Rank 1 missions can have specific level requirements internally
              const currentLevel = currentUser.level || 1;

              if (rank && (currentLevel >= rank.minLevel)) {
                  if (mission.condition(currentUser, stats)) {
                      newXp += mission.xpReward;
                      newCompletedMissions.push(mission.id);
                      missionsCompletedNow.push(mission);
                  }
              }
          }
      });
      
      if (newXp !== currentUser.xp || newCompletedMissions.length !== (currentUser.completedMissions || []).length) {
          try {
              await updateDoc(doc(db, 'users', currentUser.id), {
                  xp: newXp,
                  completedMissions: newCompletedMissions
              });
              
              if (missionsCompletedNow.length > 0) {
                  setNotification({ message: `¡Misión Completada: ${missionsCompletedNow[0].title}! (+${missionsCompletedNow[0].xpReward} XP)`, type: 'mission' });
              }
          } catch(e) { console.error("Gamification update error", e); }
      }
  };

  // --- CHECK FOR LEVEL UP READINESS ---
  useEffect(() => {
      if (!user) return;
      const currentLevel = user.level || 1;
      const nextLevelThreshold = XP_TABLE[currentLevel - 1]; 
      
      if (user.xp >= nextLevelThreshold && !milestoneEvent) {
           const nextRank = RANKS.find(r => r.minLevel === currentLevel + 1);
           const t = setTimeout(() => {
               setMilestoneEvent({
                   type: 'challenge_ready',
                   rankTitle: nextRank ? nextRank.title : `Nivel ${currentLevel + 1}`,
                   level: currentLevel + 1
               });
           }, 2000);
           return () => clearTimeout(t);
      }
  }, [user?.xp, user?.level]);


  // --- MANUAL LEVEL UP EXECUTION ---
  const completeLevelUpChallenge = async (nextLevel: number, rewardCredits: number) => {
      if (!user) return;
      const oldLevel = user.level || 1;
      
      if (nextLevel > oldLevel) {
          try {
              const batch = writeBatch(db);
              const userRef = doc(db, 'users', user.id);
              
              // KEY CHANGE: Update timestamp and clear stats to start fresh for new level missions
              batch.update(userRef, {
                  level: nextLevel,
                  lastLevelUpTimestamp: Date.now(),
                  gamificationStats: {}, // Reset counters for next level
                  credits: (user.credits || 0) + rewardCredits
              });
              
              await batch.commit();
              
              setNotification({ message: `+${rewardCredits} Créditos: Reto de Ascenso Completado`, type: 'shop' });
              
              const newRank = RANKS.find(r => r.minLevel === nextLevel) || RANKS.slice().reverse().find(r => nextLevel >= r.minLevel);
              setMilestoneEvent({
                  type: 'levelup',
                  rankTitle: newRank ? newRank.title : `Nivel ${nextLevel}`,
                  level: nextLevel
              });
              
          } catch(e) { console.error("Error completing level up", e); }
      }
  };


  const triggerAction = async (action: string) => {
      if (!user) return;
      
      // We update the local state first for immediate UI feedback if needed, but Firestore is source of truth
      const currentStats = user.gamificationStats || {};
      
      // If it's a boolean flag and already true, skip
      if (typeof currentStats[action] === 'boolean' && currentStats[action]) return;

      try {
        await updateDoc(doc(db, 'users', user.id), {
            [`gamificationStats.${action}`]: true
        });
        // Optimistic update
        const updatedUser = { 
            ...user, 
            gamificationStats: { ...currentStats, [action]: true } 
        };
        setUser(updatedUser);
        checkAchievements(updatedUser);
      } catch (e) { console.error("Error triggering action", e); }
  };

  // ADMIN: Reset
  const resetGamification = async () => {
      const usersSnap = await getDocs(collection(db, 'users'));
      if (usersSnap.empty) { alert("No hay usuarios."); return; }
      const allFreshUsers = usersSnap.docs.map(d => d.data() as User);
      const chunkSize = 400; const chunks = [];
      for (let i = 0; i < allFreshUsers.length; i += chunkSize) chunks.push(allFreshUsers.slice(i, i + chunkSize));
      const resetTimestamp = Date.now();

      try {
          for (const chunk of chunks) {
              const batch = writeBatch(db);
              chunk.forEach(u => {
                  const ref = doc(db, 'users', u.id);
                  batch.update(ref, {
                      xp: 0, level: 1, completedMissions: [], credits: 0, inventory: [],
                      hasSeenWelcome: false, 
                      gamificationStats: deleteField(),
                      lastGamificationReset: resetTimestamp,
                      lastLevelUpTimestamp: resetTimestamp
                  });
              });
              await batch.commit();
          }
          alert("¡RESET COMPLETADO!");
          setTimeout(() => window.location.reload(), 1000);
      } catch (e) { alert("Error: " + String(e)); }
  };

  useEffect(() => {
      if (user) { checkAchievements(user); }
  }, [user?.id, user?.lastGamificationReset, user?.lastLevelUpTimestamp, userRatings]); 

  const clearNotification = () => setNotification(null);

  // --- TOP CRITIC ---
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
                if (b.prestige !== a.prestige) return b.prestige - a.prestige;
                return b.reviewCount - a.reviewCount;
            });
          if (stats.length > 0) setTopCriticId(stats[0].id);
      }
  }, [allUsers, userRatings]);

  const getRemainingVoiceSeconds = (): number => {
      if (!user) return 0;
      const today = new Date().setHours(0,0,0,0);
      const lastUsageDate = user.voiceUsageDate || 0;
      const usedToday = lastUsageDate === today ? (user.voiceUsageSeconds || 0) : 0;
      return Math.max(0, DAILY_VOICE_LIMIT_SECONDS - usedToday);
  };

  const startUsageTracking = () => {
      if (usageIntervalRef.current) clearInterval(usageIntervalRef.current);
      usageIntervalRef.current = window.setInterval(async () => {
          if (!auth.currentUser) return;
          const today = new Date().setHours(0,0,0,0);
          const userRef = doc(db, 'users', auth.currentUser.uid);
          try {
              const snap = await getDoc(userRef);
              if (snap.exists()) {
                  const data = snap.data() as User;
                  const lastDate = data.voiceUsageDate || 0;
                  let currentSeconds = data.voiceUsageSeconds || 0;
                  if (lastDate !== today) currentSeconds = 0; 
                  const newSeconds = currentSeconds + 1;
                  if (newSeconds >= DAILY_VOICE_LIMIT_SECONDS) {
                      stopLiveSession(); 
                      alert("Límite diario de voz alcanzado.");
                  }
                  await updateDoc(userRef, { voiceUsageDate: today, voiceUsageSeconds: newSeconds });
              }
          } catch(e) { console.error(e); }
      }, 1000);
  };

  const stopUsageTracking = () => {
      if (usageIntervalRef.current) { clearInterval(usageIntervalRef.current); usageIntervalRef.current = null; }
  };

  // --- LIVE SESSION ---
  const stopLiveSession = () => {
      stopUsageTracking();
      if (liveSessionRef.current) { try { liveSessionRef.current.close(); } catch(e) {} liveSessionRef.current = null; }
      if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
      if (inputSourceRef.current) { inputSourceRef.current.disconnect(); inputSourceRef.current = null; }
      if (currentStreamRef.current) { currentStreamRef.current.getTracks().forEach(track => track.stop()); currentStreamRef.current = null; }
      if (audioContextRef.current) { try { audioContextRef.current.close(); } catch(e) {} audioContextRef.current = null; }
      audioQueueRef.current.forEach(source => { try { source.stop(); } catch(e) {} });
      audioQueueRef.current = [];
      setLiveSession({ isConnected: false, status: 'Desconectado', isUserSpeaking: false, isAiSpeaking: false, toolInUse: null, visualContent: [] });
  };

  const startLiveSession = async (mode: 'general' | 'debate', contextData?: any) => {
      if (!user) return;
      const isTopCritic = user.id === topCriticId;
      if (!user.isAdmin && !isTopCritic) {
          alert("Acceso denegado: Solo el Administrador y el Crítico #1 del ranking pueden usar la voz en vivo.");
          return;
      }
      const remaining = getRemainingVoiceSeconds();
      if (remaining <= 0 && !user.isAdmin) { alert("Has consumido tus 5 minutos diarios de voz."); return; }
      
      try {
          setLiveSession(prev => ({ ...prev, isConnected: true, status: 'Conectando...', visualContent: [] }));
          let systemInstruction = '';
          if (mode === 'general') {
              const watchedTitles = movies.filter(m => user.watchedMovies.includes(m.id)).map(m => m.title).join(", ");
              systemInstruction = `Expert movie buff. User watched: ${watchedTitles.slice(0, 500)}. Use tools to show images.`;
          } else if (mode === 'debate') {
              const { movieTitle, themeTitle } = contextData || { movieTitle: 'Peli', themeTitle: 'General' };
              systemInstruction = `TV Show Host for "Cine Mensa". Discussing "${movieTitle}" (Theme: ${themeTitle}). Charismatic, Spanish neutral.`;
          }

          const tools = [{ functionDeclarations: [{ name: "show_movie", description: "Show movie info", parameters: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, year: { type: Type.NUMBER } }, required: ["title"] } }, { name: "show_person", description: "Show person photo", parameters: { type: Type.OBJECT, properties: { name: { type: Type.STRING } }, required: ["name"] } }] }];

          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const ctx = new AudioContextClass({ sampleRate: 16000 });
          audioContextRef.current = ctx;
          nextStartTimeRef.current = ctx.currentTime;

          const client = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
          const sessionPromise = client.live.connect({
              model: 'gemini-2.5-flash-native-audio-preview-09-2025',
              config: { responseModalities: [Modality.AUDIO], systemInstruction: systemInstruction, tools: tools, speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } },
              callbacks: {
                  onopen: async () => {
                      setLiveSession(prev => ({ ...prev, status: 'Conectado - Escuchando...' }));
                      if (!user.isAdmin) startUsageTracking();
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
                          source.connect(processor); processor.connect(ctx.destination);
                      } catch (err) { console.error("Mic Error:", err); stopLiveSession(); }
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
                              source.onended = () => { audioQueueRef.current = audioQueueRef.current.filter(s => s !== source); if (audioQueueRef.current.length === 0) setLiveSession(prev => ({ ...prev, isAiSpeaking: false })); };
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
                                  const movieDetails = await findMovieByTitleAndYear(title, year, tmdbToken);
                                  if (movieDetails) {
                                      const mappedMovie: Movie = { id: `tmdb-${movieDetails.id}`, tmdbId: movieDetails.id, title: movieDetails.title, year: parseInt(movieDetails.release_date?.split('-')[0]) || 0, posterUrl: getImageUrl(movieDetails.poster_path), director: 'Desconocido', genre: [], description: movieDetails.overview, rating: movieDetails.vote_average, totalVotes: 0 };
                                      setLiveSession(prev => ({ ...prev, toolInUse: null, visualContent: [...prev.visualContent, { type: 'movie', data: mappedMovie }] }));
                                  } else { setLiveSession(prev => ({ ...prev, toolInUse: null })); }
                                  functionResponses.push({ id: fc.id, name: fc.name, response: { result: 'ok' } });
                              } else if (fc.name === 'show_person') {
                                  const { name } = fc.args as any;
                                  setLiveSession(prev => ({ ...prev, toolInUse: `Buscando: ${name}` }));
                                  const people = await searchPersonTMDB(name, tmdbToken);
                                  if (people.length > 0) { setLiveSession(prev => ({ ...prev, toolInUse: null, visualContent: [...prev.visualContent, { type: 'person', data: people[0] }] })); } else { setLiveSession(prev => ({ ...prev, toolInUse: null })); }
                                  functionResponses.push({ id: fc.id, name: fc.name, response: { result: 'ok' } });
                              }
                          }
                          if (functionResponses.length > 0) { sessionPromise.then(session => { session.sendToolResponse({ functionResponses: functionResponses }); }); }
                      }
                  },
                  onerror: (e) => { console.error("Live Session Error:", e); stopLiveSession(); },
                  onclose: () => { setLiveSession(prev => ({ ...prev, isConnected: false, status: 'Desconectado' })); }
              }
          });
          liveSessionRef.current = await sessionPromise;
      } catch (e) { console.error("Connection failed", e); stopLiveSession(); alert("Error al conectar con Gemini Live API."); }
  };

  // --- ACTIONS ---
  const setTmdbToken = async (token: string) => { await setDoc(doc(db, 'config', 'tmdb'), { token }); setTmdbTokenState(token); };
  const login = async (email: string, name: string) => { try { await signInWithEmailAndPassword(auth, email, name); return { success: true, message: 'Bienvenido' }; } catch (e: any) { return { success: false, message: e.message }; } };
  const logout = async () => { await signOut(auth); };
  const register = async (email: string, name: string, password: string) => {
      try {
          const cred = await createUserWithEmailAndPassword(auth, email, password);
          const newUser: User = { id: cred.user.uid, email: email, name: name, avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`, watchedMovies: [], watchlist: [], status: 'pending', isAdmin: false, xp: 0, level: 1, credits: 0, completedMissions: [], inventory: [], lastLevelUpTimestamp: Date.now() }; // Initialize timestamp
          await setDoc(doc(db, 'users', cred.user.uid), newUser);
          return { success: true, message: 'Registro exitoso. Espera aprobación.' };
      } catch (e: any) { return { success: false, message: e.message }; }
  };
  const resetPassword = async (email: string) => { try { await sendPasswordResetEmail(auth, email); return { success: true, message: 'Correo enviado.' }; } catch (e: any) { return { success: false, message: e.message }; } };
  const updateUserProfile = async (name: string, avatarUrl: string) => { if (!user) return; await updateDoc(doc(db, 'users', user.id), { name, avatarUrl }); const updatedUser = { ...user, name, avatarUrl }; checkAchievements(updatedUser); };
  const approveUser = async (userId: string) => { await updateDoc(doc(db, 'users', userId), { status: 'active' }); };
  const rejectUser = async (userId: string) => { await updateDoc(doc(db, 'users', userId), { status: 'rejected' }); };
  const setView = (view: ViewState, movieId?: string) => { setCurrentView(view); if (movieId) setSelectedMovieId(movieId); };
  const addMovie = async (movie: Movie) => { const existingRef = doc(db, 'movies', movie.id); await setDoc(existingRef, movie); };
  const getMovie = (id: string) => movies.find(m => m.id === id);
  const rateMovie = async (movieId: string, rating: DetailedRating, comment?: string, spoiler?: string) => {
      if (!user) return;
      const ratingDocId = `${user.id}_${movieId}`;
      const ratingData: UserRating = { userId: user.id, movieId: movieId, rating: rating.average, detailed: rating, comment: comment, spoiler: spoiler, timestamp: Date.now(), likes: [], dislikes: [] };
      await setDoc(doc(db, 'ratings', ratingDocId), ratingData);
      if (!user.watchedMovies.includes(movieId)) { await updateDoc(doc(db, 'users', user.id), { watchedMovies: arrayUnion(movieId), watchlist: arrayRemove(movieId) }); }
      const movieRatings = userRatings.filter(r => r.movieId === movieId && r.userId !== user.id).concat(ratingData);
      const avg = movieRatings.reduce((acc, r) => acc + r.rating, 0) / movieRatings.length;
      await updateDoc(doc(db, 'movies', movieId), { rating: avg, totalVotes: movieRatings.length });
      const updatedUser = { ...user };
      if (!updatedUser.watchedMovies.includes(movieId)) updatedUser.watchedMovies.push(movieId);
      checkAchievements(updatedUser);
  };
  const unwatchMovie = async (movieId: string) => { if (!user) return; const ratingDocId = `${user.id}_${movieId}`; await deleteDoc(doc(db, 'ratings', ratingDocId)); await updateDoc(doc(db, 'users', user.id), { watchedMovies: arrayRemove(movieId) }); const movieRatings = userRatings.filter(r => r.movieId === movieId && r.userId !== user.id); const avg = movieRatings.length > 0 ? movieRatings.reduce((acc, r) => acc + r.rating, 0) / movieRatings.length : 0; await updateDoc(doc(db, 'movies', movieId), { rating: avg, totalVotes: movieRatings.length }); };
  const toggleWatchlist = async (movieId: string) => { if (!user) return; if (user.watchlist.includes(movieId)) { await updateDoc(doc(db, 'users', user.id), { watchlist: arrayRemove(movieId) }); } else { await updateDoc(doc(db, 'users', user.id), { watchlist: arrayUnion(movieId) }); triggerAction('watchlist'); } };
  
  const toggleReviewVote = async (targetUserId: string, movieId: string, voteType: 'like' | 'dislike') => {
      if (!user) return;
      const ratingId = `${targetUserId}_${movieId}`;
      const ratingRef = doc(db, 'ratings', ratingId);
      const ratingDoc = await getDoc(ratingRef);
      if (!ratingDoc.exists()) return;
      const data = ratingDoc.data() as UserRating;
      const likes = data.likes || [];
      const dislikes = data.dislikes || [];
      if (voteType === 'like') {
          if (likes.includes(user.id)) { await updateDoc(ratingRef, { likes: arrayRemove(user.id) }); } else { await updateDoc(ratingRef, { likes: arrayUnion(user.id), dislikes: arrayRemove(user.id) }); }
      } else {
          if (dislikes.includes(user.id)) { await updateDoc(ratingRef, { dislikes: arrayRemove(user.id) }); } else { await updateDoc(ratingRef, { dislikes: arrayUnion(user.id), likes: arrayRemove(user.id) }); }
      }
      
      // Increment Social Interaction Counter for missions
      await updateDoc(doc(db, 'users', user.id), {
          'gamificationStats.social_interactions': increment(1)
      });
      // Check immediately
      const u = { ...user, gamificationStats: { ...user.gamificationStats, social_interactions: (user.gamificationStats?.social_interactions || 0) + 1 } };
      checkAchievements(u);
  };

  const createEvent = async (eventData: Partial<CineEvent>) => { if (activeEvent) { await closeEvent(activeEvent.id); } const newEvent: CineEvent = { id: `evt_${Date.now()}`, themeTitle: eventData.themeTitle || 'Evento', themeDescription: eventData.themeDescription || '', aiReasoning: eventData.aiReasoning || '', backdropUrl: eventData.backdropUrl, phase: 'voting', startDate: Date.now(), votingDeadline: Date.now() + 7 * 24 * 60 * 60 * 1000, viewingDeadline: Date.now() + 14 * 24 * 60 * 60 * 1000, candidates: eventData.candidates || [], committedViewers: [], committedDebaters: [] }; await setDoc(doc(db, 'events', newEvent.id), newEvent); setActiveEvent(newEvent); };
  const closeEvent = async (eventId: string) => { await updateDoc(doc(db, 'events', eventId), { phase: 'closed' }); setActiveEvent(null); };
  const voteForCandidate = async (eventId: string, tmdbId: number) => { 
      if (!user || !activeEvent) return; 
      const updatedCandidates = activeEvent.candidates.map(c => { const newVotes = c.votes.filter(uid => uid !== user.id); if (c.tmdbId === tmdbId) { newVotes.push(user.id); } return { ...c, votes: newVotes }; }); await updateDoc(doc(db, 'events', eventId), { candidates: updatedCandidates }); 
      triggerAction('vote_event');
  };
  const transitionEventPhase = async (eventId: string, phase: EventPhase, winnerId?: number) => { const updateData: any = { phase }; if (winnerId) updateData.winnerTmdbId = winnerId; await updateDoc(doc(db, 'events', eventId), updateData); };
  const sendEventMessage = async (eventId: string, text: string, role: 'user' | 'moderator' = 'user', audioBase64?: string) => { if (!user && role === 'user') return; const msg: EventMessage = { id: `msg_${Date.now()}_${Math.random()}`, userId: role === 'user' ? user!.id : 'system', userName: role === 'user' ? user!.name : 'Presentadora IA', userAvatar: role === 'user' ? user!.avatarUrl : 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png', text, timestamp: Date.now(), role, audioBase64 }; await addDoc(collection(db, `events/${eventId}/messages`), msg); };
  const toggleEventCommitment = async (eventId: string, type: 'view' | 'debate') => { if (!user) return; const field = type === 'view' ? 'committedViewers' : 'committedDebaters'; const list = activeEvent?.[field] || []; if (list.includes(user.id)) { await updateDoc(doc(db, 'events', eventId), { [field]: arrayRemove(user.id) }); } else { await updateDoc(doc(db, 'events', eventId), { [field]: arrayUnion(user.id) }); } };
  const toggleTimeVote = async (eventId: string, timeSlot: string) => { if (!user || !activeEvent) return; const currentVotes = activeEvent.timeVotes || {}; const slotVotes = currentVotes[timeSlot] || []; let newSlotVotes; if (slotVotes.includes(user.id)) { newSlotVotes = slotVotes.filter(uid => uid !== user.id); } else { newSlotVotes = [...slotVotes, user.id]; } const newVotes = { ...currentVotes, [timeSlot]: newSlotVotes }; await updateDoc(doc(db, 'events', eventId), { timeVotes: newVotes }); };
  const raiseHand = async (eventId: string) => { if (!user) return; await updateDoc(doc(db, 'events', eventId), { speakerQueue: arrayUnion(user.id) }); };
  const grantTurn = async (eventId: string, userId: string) => { await updateDoc(doc(db, 'events', eventId), { currentSpeakerId: userId, speakerQueue: arrayRemove(userId) }); };
  const releaseTurn = async (eventId: string) => { await updateDoc(doc(db, 'events', eventId), { currentSpeakerId: null }); };
  
  const sendFeedback = async (type: 'bug' | 'feature', text: string) => {
      if (!user) return;
      await addDoc(collection(db, 'feedback'), { userId: user.id, userName: user.name, type, text, status: 'pending', timestamp: Date.now() });
      
      // Increment Feedback Counter for missions
      await updateDoc(doc(db, 'users', user.id), {
          'gamificationStats.feedback_count': increment(1)
      });
      // Check
      const u = { ...user, gamificationStats: { ...user.gamificationStats, feedback_count: (user.gamificationStats?.feedback_count || 0) + 1 } };
      checkAchievements(u);
  };
  
  const resolveFeedback = async (feedbackId: string, response?: string) => { await updateDoc(doc(db, 'feedback', feedbackId), { status: 'solved', adminResponse: response }); const fb = feedbackList.find(f => f.id === feedbackId); if (fb) { await publishNews(fb.type === 'bug' ? '🐛 Bug Exterminado' : '✨ Nueva Funcionalidad', `Gracias al reporte de ${fb.userName}, hemos solucionado: "${fb.text}".`, 'update'); } };
  const deleteFeedback = async (id: string) => { await deleteDoc(doc(db, 'feedback', id)); };
  const publishNews = async (title: string, content: string, type: 'general' | 'update' | 'event', imageUrl?: string) => { await addDoc(collection(db, 'news'), { title, content, type, imageUrl, timestamp: Date.now() }); };
  const getEpisodeCount = async (): Promise<number> => { const coll = collection(db, 'events'); const snap = await getCountFromServer(coll); return snap.data().count + 1; };

  const value: DataContextType = {
    user, allUsers, movies, userRatings, activeEvent, eventMessages, news, feedbackList, currentView, selectedMovieId, tmdbToken, topCriticId, getRemainingVoiceSeconds, liveSession, startLiveSession, stopLiveSession, setTmdbToken, login, logout, register, resetPassword, updateUserProfile, approveUser, rejectUser, setView, rateMovie, unwatchMovie, toggleWatchlist, toggleReviewVote, addMovie, getMovie, createEvent, closeEvent, voteForCandidate, transitionEventPhase, sendEventMessage, toggleEventCommitment, toggleTimeVote, raiseHand, grantTurn, releaseTurn, sendFeedback, resolveFeedback, publishNews, deleteFeedback, getEpisodeCount, notification, clearNotification, earnCredits, spendCredits, milestoneEvent, closeMilestoneModal, initialProfileTab, setInitialProfileTab, resetGamification, triggerAction, completeLevelUpChallenge
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};