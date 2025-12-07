import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, PropsWithChildren } from 'react';
import { 
  User, Movie, UserRating, ViewState, CineEvent, EventCandidate, 
  NewsItem, AppFeedback, MailboxMessage, DetailedRating,
  PrivateChatSession, PrivateChatMessage, MilestoneEvent
} from '../types';
import { auth, db } from '../firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  addDoc,
  deleteDoc, 
  serverTimestamp,
  limit,
  arrayUnion,
  arrayRemove,
  writeBatch
} from 'firebase/firestore';
import { STARTER_AVATARS, MISSIONS, XP_TABLE, SHOP_ITEMS } from '../constants';
import { generateCinemaNews } from '../services/geminiService';
import { searchMoviesTMDB, getImageUrl } from '../services/tmdbService';

interface DataContextType {
  user: User | null;
  allUsers: User[];
  movies: Movie[];
  userRatings: UserRating[];
  activeEvent: CineEvent | null;
  eventMessages: any[];
  news: NewsItem[];
  feedbackList: AppFeedback[];
  mailbox: MailboxMessage[];
  currentView: ViewState;
  notification: { type: string, message: string } | null;
  tmdbToken: string;
  liveSession: any;
  topCriticId: string | null;
  activePrivateChat: { session: PrivateChatSession, messages: PrivateChatMessage[] } | null;
  milestoneEvent: MilestoneEvent | null;
  initialProfileTab: 'profile' | 'career';
  automationStatus: any;
  selectedMovieId?: string;
  selectedPersonId?: number;

  setView: (view: ViewState, movieId?: string | number) => void;
  login: (e: string, p: string) => Promise<any>;
  register: (e: string, name: string, p: string) => Promise<any>;
  logout: () => Promise<void>;
  resetPassword: (e: string) => Promise<any>;
  updateUserProfile: (n: string, a: string) => Promise<void>;
  approveUser: (uid: string) => Promise<void>;
  rejectUser: (uid: string, banMs?: number) => Promise<void>;
  deleteUserAccount: (uid: string) => Promise<void>;
  toggleUserAdmin: (uid: string) => Promise<void>;
  sendSystemMessage: (uid: string, title: string, body: string, type?: string, actionMovieId?: string, actionEventId?: string) => Promise<void>;
  
  addMovie: (m: Movie) => Promise<void>;
  rateMovie: (mid: string, r: DetailedRating, c?: string, s?: string) => Promise<void>;
  unwatchMovie: (mid: string) => Promise<void>;
  toggleWatchlist: (mid: string) => Promise<void>;
  toggleReviewVote: (uid: string, mid: string, type: 'like' | 'dislike') => Promise<void>;
  
  setTmdbToken: (t: string) => Promise<void>;
  
  createEvent: (data: any) => Promise<void>;
  closeEvent: (eid: string) => Promise<void>;
  voteForCandidate: (eid: string, tmdbId: number) => Promise<void>;
  transitionEventPhase: (eid: string, phase: string, winnerId?: number) => Promise<void>;
  toggleEventCommitment: (eid: string, type: 'view' | 'debate') => Promise<void>;
  toggleTimeVote: (eid: string, time: string) => Promise<void>;
  sendEventMessage: (eid: string, text: string, role?: string, audio?: string) => Promise<void>;
  raiseHand: (eid: string) => Promise<void>;
  grantTurn: (eid: string, uid: string) => Promise<void>;
  releaseTurn: (eid: string) => Promise<void>;
  getEpisodeCount: () => Promise<number>;
  
  publishNews: (t: string, c: string, type: string, img?: string) => Promise<void>;
  deleteNews: (id: string) => Promise<void>;
  
  sendFeedback: (t: string, txt: string) => Promise<void>;
  resolveFeedback: (id: string) => Promise<void>;
  deleteFeedback: (id: string) => Promise<void>;
  
  startLiveSession: (mode: string) => void;
  stopLiveSession: () => void;
  getRemainingVoiceSeconds: () => number;
  
  spendCredits: (cost: number, itemId: string) => Promise<boolean>;
  toggleInventoryItem: (itemId: string) => Promise<void>;
  triggerAction: (actionName: string) => void;
  completeLevelUpChallenge: (level: number, reward: number) => Promise<void>;
  closeMilestoneModal: () => void;
  
  startPrivateChat: (targetId: string) => Promise<void>;
  sendPrivateMessage: (text: string) => Promise<void>;
  closePrivateChat: () => Promise<void>;
  leavePrivateChat: () => void;
  setPrivateChatTyping: (isTyping: boolean) => void;
  
  refreshUser: () => Promise<void>;
  
  inviteToTrivia: (uid: string) => Promise<void>;
  handleTriviaWin: (winnerId: string) => Promise<void>;
  saveTriviaHighScore: (score: number) => Promise<void>;
  
  markMessageRead: (id: string) => Promise<void>;
  markAllMessagesRead: () => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  
  setInitialProfileTab: (tab: 'profile' | 'career') => void;
  resetGamification: () => Promise<void>;
  resetAutomation: () => Promise<void>;
  auditQuality: () => Promise<number>;
  clearNotification: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: PropsWithChildren) => {
  // --- STATE ---
  const [user, setUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [userRatings, setUserRatings] = useState<UserRating[]>([]);
  const [activeEvent, setActiveEvent] = useState<CineEvent | null>(null);
  const [eventMessages, setEventMessages] = useState<any[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [feedbackList, setFeedbackList] = useState<AppFeedback[]>([]);
  const [mailbox, setMailbox] = useState<MailboxMessage[]>([]);
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.LOGIN);
  const [notification, setNotification] = useState<{ type: string, message: string } | null>(null);
  const [tmdbToken, setTmdbTokenState] = useState('');
  const [selectedMovieId, setSelectedMovieId] = useState<string>();
  const [selectedPersonId, setSelectedPersonId] = useState<number>();
  
  // New Features State
  const [liveSession, setLiveSession] = useState({ isConnected: false, status: 'disconnected', isUserSpeaking: false, isAiSpeaking: false, toolInUse: null, visualContent: [] });
  const [activePrivateChat, setActivePrivateChat] = useState<{ session: PrivateChatSession, messages: PrivateChatMessage[] } | null>(null);
  const [milestoneEvent, setMilestoneEvent] = useState<MilestoneEvent | null>(null);
  const [initialProfileTab, setInitialProfileTabState] = useState<'profile' | 'career'>('profile');
  const [automationStatus, setAutomationStatus] = useState({ lastRun: 0, nextRun: 0, dailyCount: 0, isGenerating: false });
  
  // Refs
  const isGeneratingRef = useRef(false);

  // --- AUTH & USER SYNC ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // 1. Fetch User Data Live
        const userRef = doc(db, 'users', currentUser.uid);
        const unsubUser = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                const userData = { id: docSnap.id, ...docSnap.data() } as User;
                setUser(userData);
                
                // If previously in Login/Register view, move to Dashboard or Pending
                if (currentView === ViewState.LOGIN || currentView === ViewState.REGISTER) {
                    setCurrentView(ViewState.NEWS);
                }
            } else {
                // User exists in Auth but not in Firestore (should not happen if register works)
                console.error("User document missing");
            }
        });

        // 2. Fetch Mailbox Live
        const mailboxRef = collection(db, 'users', currentUser.uid, 'mailbox');
        const qMailbox = query(mailboxRef, orderBy('timestamp', 'desc'));
        const unsubMailbox = onSnapshot(qMailbox, (snapshot) => {
            setMailbox(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MailboxMessage)));
        });

        return () => { unsubUser(); unsubMailbox(); };
      } else {
        setUser(null);
        setMailbox([]);
        setCurrentView(ViewState.LOGIN);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- GLOBAL DATA SYNC (Movies, News, etc.) ---
  useEffect(() => {
      // Users
      const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
          setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
      });

      // Movies
      const unsubMovies = onSnapshot(collection(db, 'movies'), (snap) => {
          setMovies(snap.docs.map(d => ({ id: d.id, ...d.data() } as Movie)));
      });

      // Ratings
      const unsubRatings = onSnapshot(collection(db, 'ratings'), (snap) => {
          setUserRatings(snap.docs.map(d => d.data() as UserRating));
      });

      // News
      const qNews = query(collection(db, 'news'), orderBy('timestamp', 'desc'));
      const unsubNews = onSnapshot(qNews, (snap) => {
          setNews(snap.docs.map(d => ({ id: d.id, ...d.data() } as NewsItem)));
      });

      // Active Event
      const qEvent = query(collection(db, 'events'), where('phase', '!=', 'closed')); // Get any non-closed event
      const unsubEvent = onSnapshot(qEvent, (snap) => {
          if (!snap.empty) {
              const eventData = { id: snap.docs[0].id, ...snap.docs[0].data() } as CineEvent;
              setActiveEvent(eventData);
          } else {
              setActiveEvent(null);
          }
      });

      // Feedback
      const qFeedback = query(collection(db, 'feedback'), orderBy('timestamp', 'desc'));
      const unsubFeedback = onSnapshot(qFeedback, (snap) => {
          setFeedbackList(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppFeedback)));
      });

      // Config (TMDB Token & Automation)
      const unsubConfig = onSnapshot(doc(db, 'config', 'main'), (docSnap) => {
          if (docSnap.exists()) {
              const data = docSnap.data();
              setTmdbTokenState(data.tmdbToken || '');
          }
      });
      
      const unsubAuto = onSnapshot(doc(db, 'config', 'news_automation'), (docSnap) => {
          if (docSnap.exists()) {
              setAutomationStatus(docSnap.data() as any);
          }
      });

      return () => {
          unsubUsers(); unsubMovies(); unsubRatings(); unsubNews(); unsubEvent(); unsubFeedback(); unsubConfig(); unsubAuto();
      };
  }, []);

  // --- EVENT MESSAGES SYNC ---
  useEffect(() => {
      if (activeEvent) {
          const qMsgs = query(collection(db, 'events', activeEvent.id, 'chat'), orderBy('timestamp', 'asc'));
          const unsubMsgs = onSnapshot(qMsgs, (snap) => {
              setEventMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          });
          return () => unsubMsgs();
      } else {
          setEventMessages([]);
      }
  }, [activeEvent?.id]);

  // --- AUTOMATIC PHASE TRANSITION ENGINE ---
  useEffect(() => {
      if (!activeEvent || activeEvent.phase !== 'voting') return;

      const checkEventStatus = async () => {
          const now = Date.now();
          if (now > activeEvent.votingDeadline) {
              console.log("⌛ Fecha límite de votación superada.");
              let winnerTmdbId = 0;
              if (activeEvent.candidates.length > 0) {
                  const winner = activeEvent.candidates.reduce((prev: EventCandidate, current: EventCandidate) => 
                      (prev.votes.length >= current.votes.length) ? prev : current
                  );
                  winnerTmdbId = winner.tmdbId;
              }
              try {
                  const update: any = { phase: 'viewing' };
                  if (winnerTmdbId) update.winnerTmdbId = winnerTmdbId;
                  await updateDoc(doc(db, 'events', activeEvent.id), update);
              } catch (e) { console.error("Auto transition error:", e); }
          }
      };
      
      checkEventStatus();
      const interval = setInterval(checkEventStatus, 60000);
      return () => clearInterval(interval);
  }, [activeEvent?.id, activeEvent?.phase, activeEvent?.votingDeadline]);

  // --- AUTH FUNCTIONS ---

  const login = async (email: string, p: string) => {
      try {
          await signInWithEmailAndPassword(auth, email, p);
          return { success: true };
      } catch (error: any) {
          return { success: false, message: error.message };
      }
  };

  const register = async (email: string, name: string, p: string) => {
      try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, p);
          const newUser: User = {
              id: userCredential.user.uid,
              email: email,
              name: name,
              avatarUrl: STARTER_AVATARS[Math.floor(Math.random() * STARTER_AVATARS.length)].url,
              watchedMovies: [],
              watchlist: [],
              status: 'pending',
              isAdmin: false,
              xp: 0,
              level: 1,
              credits: 0,
              completedMissions: [],
              inventory: [],
              lastSeen: Date.now()
          };
          await setDoc(doc(db, 'users', newUser.id), newUser);
          return { success: true, message: 'Registro completado. Pendiente de aprobación.' };
      } catch (error: any) {
          return { success: false, message: error.message };
      }
  };

  const logout = async () => {
      await signOut(auth);
      setInitialProfileTabState('profile');
  };

  const resetPassword = async (email: string) => {
      try {
          await sendPasswordResetEmail(auth, email);
          return { success: true, message: 'Correo enviado.' };
      } catch (e: any) {
          return { success: false, message: e.message };
      }
  };

  const setView = (view: ViewState, id?: string | number) => {
      setCurrentView(view);
      if (typeof id === 'string') setSelectedMovieId(id);
      if (typeof id === 'number') setSelectedPersonId(id);
  };

  // --- DATA FUNCTIONS ---

  const refreshUser = async () => {
      if (!user) return;
      const snap = await getDoc(doc(db, 'users', user.id));
      if (snap.exists()) setUser({ id: snap.id, ...snap.data() } as User);
  };

  const setTmdbToken = async (t: string) => {
      await setDoc(doc(db, 'config', 'main'), { tmdbToken: t }, { merge: true });
  };

  const sendSystemMessage = async (userId: string, title: string, body: string, type = 'info', actionMovieId?: string, actionEventId?: string) => {
      const msgData: any = { title, body, type, timestamp: Date.now(), read: false };
      if (actionMovieId) msgData.actionMovieId = actionMovieId;
      if (actionEventId) msgData.actionEventId = actionEventId;
      await addDoc(collection(db, 'users', userId, 'mailbox'), msgData);
  };

  const triggerAction = async (actionName: string) => {
      if (!user) return;
      const key = `gamificationStats.${actionName}`;
      await updateDoc(doc(db, 'users', user.id), { [key]: true });
      await checkMissions(user.id);
  };

  const checkMissions = async (userId: string) => {
      // Force fetch fresh user data
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;
      const currentUserData = { id: userSnap.id, ...userSnap.data() } as User;

      // Stats Calculation
      const myRatings = userRatings.filter(r => r.userId === userId);
      const ratingsCount = myRatings.length;
      const reviewsCount = myRatings.filter(r => r.comment && r.comment.length > 0).length;
      const likesReceived = myRatings.reduce((acc, r) => acc + (r.likes?.length || 0), 0);
      let likesGiven = 0;
      userRatings.forEach(r => {
          if (r.likes?.includes(userId)) likesGiven++;
          if (r.dislikes?.includes(userId)) likesGiven++;
      });
      const feedbackCount = feedbackList.filter(f => f.userId === userId).length;
      const stats = { ratingsCount, reviewsCount, likesReceived, likesGiven, feedbackCount };

      const newMissions: string[] = [];
      let xpGainedNow = 0;

      MISSIONS.forEach(mission => {
          if (!currentUserData.completedMissions?.includes(mission.id)) {
              if (mission.condition(currentUserData, stats)) {
                  newMissions.push(mission.id);
                  xpGainedNow += mission.xpReward;
              }
          }
      });

      if (newMissions.length > 0) {
          // Re-calculate total XP from all completed missions to ensure sync
          const allCompleted = [...(currentUserData.completedMissions || []), ...newMissions];
          const uniqueCompleted = Array.from(new Set(allCompleted));
          
          let totalMissionXP = 0;
          uniqueCompleted.forEach(mid => {
              const m = MISSIONS.find(def => def.id === mid);
              if (m) totalMissionXP += m.xpReward;
          });
          
          // Assuming user.xp is mostly mission based. 
          // To be safe, we just ADD the new XP to the server value.
          const newTotalXP = (currentUserData.xp || 0) + xpGainedNow;
          const newLevel = Math.floor(newTotalXP / 100) + 1;

          await updateDoc(userRef, {
              completedMissions: arrayUnion(...newMissions),
              xp: newTotalXP,
              level: newLevel
          });

          if (userId === user?.id) {
              setNotification({ type: 'level', message: `¡+${xpGainedNow} XP! Misión completada.` });
          } else {
              sendSystemMessage(userId, "¡Misión Cumplida!", `Has ganado ${xpGainedNow} XP.`, 'reward');
          }
      }
  };

  const addMovie = async (m: Movie) => {
      await setDoc(doc(db, 'movies', m.id), m);
  };

  const rateMovie = async (movieId: string, detailed: DetailedRating, comment?: string, spoiler?: string) => {
      if (!user) return;
      const ratingData: UserRating = {
          movieId,
          userId: user.id,
          detailed,
          rating: detailed.average,
          comment,
          spoiler,
          timestamp: Date.now(),
          likes: [], dislikes: []
      };
      // Use setDoc with composite ID to allow overwrite (update)
      await setDoc(doc(db, 'ratings', `${user.id}_${movieId}`), ratingData);
      
      // Update User lists
      await updateDoc(doc(db, 'users', user.id), {
          watchedMovies: arrayUnion(movieId),
          watchlist: arrayRemove(movieId)
      });

      // Update Movie Global Rating
      const relevantRatings = userRatings.filter(r => r.movieId === movieId && r.userId !== user.id).concat(ratingData);
      const totalRating = relevantRatings.reduce((acc, r) => acc + r.rating, 0);
      const avg = relevantRatings.length > 0 ? totalRating / relevantRatings.length : 0;
      await updateDoc(doc(db, 'movies', movieId), {
          rating: avg,
          totalVotes: relevantRatings.length
      });

      await checkMissions(user.id);
  };

  const unwatchMovie = async (movieId: string) => {
      if (!user) return;
      await deleteDoc(doc(db, 'ratings', `${user.id}_${movieId}`));
      await updateDoc(doc(db, 'users', user.id), {
          watchedMovies: arrayRemove(movieId)
      });
      // Re-calc average
      const relevantRatings = userRatings.filter(r => r.movieId === movieId && r.userId !== user.id);
      const totalRating = relevantRatings.reduce((acc, r) => acc + r.rating, 0);
      const avg = relevantRatings.length > 0 ? totalRating / relevantRatings.length : 0;
      await updateDoc(doc(db, 'movies', movieId), {
          rating: avg,
          totalVotes: relevantRatings.length
      });
  };

  const toggleWatchlist = async (movieId: string) => {
      if (!user) return;
      const isPresent = user.watchlist.includes(movieId);
      await updateDoc(doc(db, 'users', user.id), {
          watchlist: isPresent ? arrayRemove(movieId) : arrayUnion(movieId)
      });
      if (!isPresent) triggerAction('watchlist');
  };

  const toggleReviewVote = async (targetUserId: string, movieId: string, type: 'like' | 'dislike') => {
      if (!user) return;
      const ratingId = `${targetUserId}_${movieId}`;
      const ratingRef = doc(db, 'ratings', ratingId);
      const ratingDoc = await getDoc(ratingRef);
      if (!ratingDoc.exists()) return;
      const r = ratingDoc.data() as UserRating;

      let likes = r.likes || [];
      let dislikes = r.dislikes || [];

      if (type === 'like') {
          if (likes.includes(user.id)) likes = likes.filter(id => id !== user.id);
          else {
              likes.push(user.id);
              dislikes = dislikes.filter(id => id !== user.id);
          }
      } else {
          if (dislikes.includes(user.id)) dislikes = dislikes.filter(id => id !== user.id);
          else {
              dislikes.push(user.id);
              likes = likes.filter(id => id !== user.id);
          }
      }

      await updateDoc(ratingRef, { likes, dislikes });
      // Check missions for BOTH (Voter and Author)
      await checkMissions(user.id); // Voter (Espiritu de Equipo)
      await checkMissions(targetUserId); // Author (likes received not implemented as mission yet but good for future)
  };

  // --- EVENT FUNCTIONS ---
  const createEvent = async (data: any) => {
      await addDoc(collection(db, 'events'), {
          ...data,
          phase: 'voting',
          startDate: Date.now(),
          votingDeadline: Date.now() + 86400000 * 7, // 7 Days
          viewingDeadline: Date.now() + 86400000 * 14 // 14 Days
      });
  };

  const closeEvent = async (eid: string) => {
      await updateDoc(doc(db, 'events', eid), { phase: 'closed' });
  };

  const voteForCandidate = async (eid: string, tmdbId: number) => {
      if (!user || !activeEvent) return;
      const newCandidates = activeEvent.candidates.map(c => {
          let votes = c.votes || [];
          if (c.tmdbId === tmdbId) {
              if (!votes.includes(user.id)) votes.push(user.id);
          } else {
              votes = votes.filter(id => id !== user.id);
          }
          return { ...c, votes };
      });
      await updateDoc(doc(db, 'events', eid), { candidates: newCandidates });
      triggerAction('cineforumVoteCount');
  };

  const transitionEventPhase = async (eid: string, phase: string, winnerId?: number) => {
      const update: any = { phase };
      if (winnerId) update.winnerTmdbId = winnerId;
      await updateDoc(doc(db, 'events', eid), update);
  };

  const toggleEventCommitment = async (eid: string, type: 'view' | 'debate') => {
      if (!user) return;
      const field = type === 'view' ? 'committedViewers' : 'committedDebaters';
      const list = (activeEvent as any)?.[field] || [];
      const newList = list.includes(user.id) ? list.filter((id: string) => id !== user.id) : [...list, user.id];
      await updateDoc(doc(db, 'events', eid), { [field]: newList });
      if (type === 'debate' && !list.includes(user.id)) triggerAction('cineforum_participation');
  };

  const toggleTimeVote = async (eid: string, time: string) => {
      if (!user || !activeEvent) return;
      const currentVotes = activeEvent.timeVotes?.[time] || [];
      const newVotes = currentVotes.includes(user.id) ? currentVotes.filter(id => id !== user.id) : [...currentVotes, user.id];
      await updateDoc(doc(db, 'events', eid), { [`timeVotes.${time}`]: newVotes });
  };

  const sendEventMessage = async (eid: string, text: string, role = 'user', audio?: string) => {
      if (!user) return;
      await addDoc(collection(db, 'events', eid, 'chat'), {
          userId: user.id,
          userName: user.name,
          userAvatar: user.avatarUrl,
          text,
          role,
          audioBase64: audio || null,
          timestamp: Date.now()
      });
  };

  const raiseHand = async (eid: string) => {
      if (!user) return;
      await updateDoc(doc(db, 'events', eid), { speakerQueue: arrayUnion(user.id) });
  };

  const grantTurn = async (eid: string, uid: string) => {
      await updateDoc(doc(db, 'events', eid), {
          currentSpeakerId: uid,
          speakerQueue: arrayRemove(uid)
      });
  };

  const releaseTurn = async (eid: string) => {
      await updateDoc(doc(db, 'events', eid), { currentSpeakerId: null });
  };

  const getEpisodeCount = async () => {
      const snap = await getDocs(collection(db, 'events')); // Simplified
      return snap.size;
  };

  // --- NEWS & FEEDBACK ---
  const publishNews = async (title: string, content: string, type: string, img?: string) => {
      await addDoc(collection(db, 'news'), {
          title, content, type, imageUrl: img || null, timestamp: Date.now()
      });
  };

  const deleteNews = async (id: string) => {
      await deleteDoc(doc(db, 'news', id));
  };

  const sendFeedback = async (type: string, text: string) => {
      if (!user) return;
      await addDoc(collection(db, 'feedback'), {
          userId: user.id, userName: user.name, type, text, status: 'pending', timestamp: Date.now()
      });
  };

  const resolveFeedback = async (id: string) => {
      await updateDoc(doc(db, 'feedback', id), { status: 'solved' });
  };

  const deleteFeedback = async (id: string) => {
      await deleteDoc(doc(db, 'feedback', id));
  };

  // --- STUBS OR SIMPLE IMPLS ---
  const startLiveSession = (mode: string) => { setLiveSession({ ...liveSession, isConnected: true, status: 'connected' }); };
  const stopLiveSession = () => { setLiveSession({ ...liveSession, isConnected: false, status: 'disconnected' }); };
  const getRemainingVoiceSeconds = () => 600;

  const spendCredits = async (cost: number, itemId: string) => {
      if (!user || user.credits < cost) return false;
      await updateDoc(doc(db, 'users', user.id), {
          credits: user.credits - cost,
          inventory: arrayUnion(itemId)
      });
      setNotification({ type: 'shop', message: `¡Compra realizada! -${cost} créditos` });
      return true;
  };

  const toggleInventoryItem = async (itemId: string) => {
      if (!user) return;
      const has = user.inventory?.includes(itemId);
      await updateDoc(doc(db, 'users', user.id), {
          inventory: has ? arrayRemove(itemId) : arrayUnion(itemId)
      });
  };

  const completeLevelUpChallenge = async (level: number, reward: number) => {
      if (!user) return;
      // Add Reward
      await updateDoc(doc(db, 'users', user.id), {
          credits: (user.credits || 0) + reward,
          // We could add a flag like challengesCompleted: { level2: true }
      });
      
      // If user was capped, unlock level? 
      // Actually levels are XP based. Challenge gives credits mostly.
      // But we can trigger Level Up Event manually if needed.
      setMilestoneEvent({ type: 'levelup', level: level + 1, rankTitle: 'Nuevo Rango' }); // Visual only
  };

  const closeMilestoneModal = () => setMilestoneEvent(null);

  const startPrivateChat = async (targetId: string) => {
      // Mock start
      setActivePrivateChat({
          session: { id: 'chat1', creatorId: user!.id, targetId, creatorName: user!.name, targetName: 'Usuario', isActive: true, createdAt: Date.now() },
          messages: []
      });
  };
  
  const sendPrivateMessage = async (text: string) => {
      if (activePrivateChat) {
          const newMsg = { id: Date.now().toString(), senderId: user!.id, senderName: user!.name, text, timestamp: Date.now() };
          setActivePrivateChat(prev => prev ? ({ ...prev, messages: [...prev.messages, newMsg] }) : null);
      }
  };
  
  const closePrivateChat = async () => { setActivePrivateChat(null); };
  const leavePrivateChat = () => { setActivePrivateChat(null); };
  const setPrivateChatTyping = (t: boolean) => {};

  const inviteToTrivia = async (uid: string) => {};
  const handleTriviaWin = async (wid: string) => {
      if (user?.id === wid) {
          triggerAction('duelWins'); // Mock action
      }
  };
  
  const saveTriviaHighScore = async (score: number) => {
      if (!user) return;
      if (score > (user.triviaHighScore || 0)) {
          await updateDoc(doc(db, 'users', user.id), { triviaHighScore: score });
      }
  };

  const markMessageRead = async (id: string) => {
      if (!user) return;
      await updateDoc(doc(db, 'users', user.id, 'mailbox', id), { read: true });
  };

  const markAllMessagesRead = async () => {
      if (!user) return;
      const batch = writeBatch(db);
      mailbox.forEach(m => {
          if (!m.read) batch.update(doc(db, 'users', user.id, 'mailbox', m.id), { read: true });
      });
      await batch.commit();
  };

  const deleteMessage = async (id: string) => {
      if (!user) return;
      await deleteDoc(doc(db, 'users', user.id, 'mailbox', id));
  };

  const setInitialProfileTab = (t: 'profile' | 'career') => setInitialProfileTabState(t);
  
  const resetGamification = async () => {
      const batch = writeBatch(db);
      allUsers.forEach(u => {
          const ref = doc(db, 'users', u.id);
          batch.update(ref, { xp: 0, level: 1, credits: 0, completedMissions: [], inventory: [] });
      });
      await batch.commit();
  };

  const resetAutomation = async () => {
      await setDoc(doc(db, 'config', 'news_automation'), { isGenerating: false, dailyCount: 0 }, { merge: true });
  };

  const auditQuality = async () => { return 0; };
  const clearNotification = () => setNotification(null);

  // Admin Funcs
  const updateUserProfile = async (n: string, a: string) => {
      if (!user) return;
      await updateDoc(doc(db, 'users', user.id), { name: n, avatarUrl: a });
  };

  const approveUser = async (uid: string) => {
      await updateDoc(doc(db, 'users', uid), { status: 'active' });
      await sendSystemMessage(uid, '¡Bienvenido!', 'Tu cuenta ha sido aprobada.', 'info');
  };

  const rejectUser = async (uid: string, banMs = 0) => {
      const update: any = { status: 'rejected' };
      if (banMs > 0) update.banExpiresAt = Date.now() + banMs;
      await updateDoc(doc(db, 'users', uid), update);
  };

  const deleteUserAccount = async (uid: string) => {
      await deleteDoc(doc(db, 'users', uid));
  };

  const toggleUserAdmin = async (uid: string) => {
      const u = allUsers.find(x => x.id === uid);
      if (u) await updateDoc(doc(db, 'users', uid), { isAdmin: !u.isAdmin });
  };

  const values: DataContextType = {
    user,
    allUsers,
    movies,
    userRatings,
    activeEvent,
    eventMessages,
    news,
    feedbackList,
    mailbox,
    currentView,
    notification,
    tmdbToken,
    liveSession,
    topCriticId: null,
    activePrivateChat,
    milestoneEvent,
    initialProfileTab,
    automationStatus,
    selectedMovieId,
    selectedPersonId,
    setView,
    login,
    register,
    logout,
    resetPassword,
    updateUserProfile,
    approveUser,
    rejectUser,
    deleteUserAccount,
    toggleUserAdmin,
    sendSystemMessage,
    addMovie,
    rateMovie,
    unwatchMovie,
    toggleWatchlist,
    toggleReviewVote,
    setTmdbToken,
    createEvent,
    closeEvent,
    voteForCandidate,
    transitionEventPhase,
    toggleEventCommitment,
    toggleTimeVote,
    sendEventMessage,
    raiseHand,
    grantTurn,
    releaseTurn,
    getEpisodeCount,
    publishNews,
    deleteNews,
    sendFeedback,
    resolveFeedback,
    deleteFeedback,
    startLiveSession,
    stopLiveSession,
    getRemainingVoiceSeconds,
    spendCredits,
    toggleInventoryItem,
    triggerAction,
    completeLevelUpChallenge,
    closeMilestoneModal,
    startPrivateChat,
    sendPrivateMessage,
    closePrivateChat,
    leavePrivateChat,
    setPrivateChatTyping,
    refreshUser,
    inviteToTrivia,
    handleTriviaWin,
    saveTriviaHighScore,
    markMessageRead,
    markAllMessagesRead,
    deleteMessage,
    setInitialProfileTab,
    resetGamification,
    resetAutomation,
    auditQuality,
    clearNotification
  };

  return (
    <DataContext.Provider value={values}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};