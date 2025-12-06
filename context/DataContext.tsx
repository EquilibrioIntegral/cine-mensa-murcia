
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth, db } from '../firebase';
import { 
  collection, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, 
  onSnapshot, query, where, orderBy, arrayUnion, arrayRemove, increment, limit, writeBatch, getDocs
} from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, 
  onAuthStateChanged, sendPasswordResetEmail
} from 'firebase/auth';
import { 
  User, Movie, UserRating, CineEvent, ViewState, NewsItem, AppFeedback, 
  EventPhase, ChatMessage, MailboxMessage, LiveSessionState, PrivateChatSession,
  PrivateChatMessage, TriviaMatch, TriviaQuestion, EventCandidate 
} from '../types';
import { STARTER_AVATARS } from '../constants';
import { getMovieDetailsTMDB, getImageUrl, searchMoviesTMDB, searchPersonTMDB } from '../services/tmdbService';
import { generateCinemaNews } from '../services/geminiService';

const DataContext = createContext<any>(null);

export const useData = () => useContext(DataContext);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // State Definitions
  const [user, setUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [userRatings, setUserRatings] = useState<UserRating[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [feedbackList, setFeedbackList] = useState<AppFeedback[]>([]);
  const [activeEvent, setActiveEvent] = useState<CineEvent | null>(null);
  const [eventMessages, setEventMessages] = useState<any[]>([]);
  const [mailbox, setMailbox] = useState<MailboxMessage[]>([]);
  
  // UI State
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.NEWS);
  const [selectedMovieId, setSelectedMovieId] = useState<string | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const [initialProfileTab, setInitialProfileTab] = useState<'profile' | 'career'>('profile');
  
  // Config
  const [tmdbToken, setTmdbTokenState] = useState('');
  const [notification, setNotification] = useState<{type: string, message: string} | null>(null);
  const [milestoneEvent, setMilestoneEvent] = useState<any>(null);
  
  // Automation State
  const [automationStatus, setAutomationStatus] = useState({ dailyCount: 0, isGenerating: false, lastRun: 0, nextRun: 0 });
  
  // Live & Chat
  const [liveSession, setLiveSession] = useState<LiveSessionState>({
      isConnected: false, status: '', isUserSpeaking: false, isAiSpeaking: false, toolInUse: null, visualContent: []
  });
  const [activePrivateChat, setActivePrivateChat] = useState<{session: PrivateChatSession, messages: PrivateChatMessage[]} | null>(null);
  const [activeTriviaMatch, setActiveTriviaMatch] = useState<TriviaMatch | null>(null);

  const topCriticId = allUsers.length > 0 ? allUsers[0].id : null;

  // View Navigation
  const setView = (view: ViewState, id?: string | number) => {
      setCurrentView(view);
      if (typeof id === 'string') setSelectedMovieId(id);
      if (typeof id === 'number') setSelectedPersonId(id);
      window.scrollTo(0, 0);
  };

  // --- PERSISTENCE: LOAD CONFIG FROM DB ---
  useEffect(() => {
      const fetchConfig = async () => {
          try {
              const docRef = doc(db, 'config', 'general');
              const docSnap = await getDoc(docRef);
              if (docSnap.exists()) {
                  setTmdbTokenState(docSnap.data().tmdbToken || '');
              }
          } catch (e) {
              console.error("Error loading config:", e);
          }
      };
      fetchConfig();
  }, []);

  // --- AUTOMATION ENGINE ---
  // Runs periodically to check if news should be generated
  useEffect(() => {
      // Only run automation if user is admin to prevent client-side race conditions or API spam from regular users
      if (!user?.isAdmin) return;

      const checkNewsAutomation = async () => {
          try {
              const docRef = doc(db, 'config', 'news_automation');
              const docSnap = await getDoc(docRef);
              
              let status = docSnap.exists() ? docSnap.data() : { 
                  dailyCount: 0, 
                  lastRun: 0, 
                  nextRun: 0, 
                  date: new Date().toLocaleDateString() 
              };

              // 1. Daily Reset Check
              const today = new Date().toLocaleDateString();
              if (status.date !== today) {
                  status = { dailyCount: 0, lastRun: 0, nextRun: 0, date: today };
                  await setDoc(docRef, status);
              }

              // Update local state for UI
              setAutomationStatus(prev => ({
                  ...prev,
                  dailyCount: status.dailyCount,
                  lastRun: status.lastRun,
                  nextRun: status.nextRun,
                  isGenerating: prev.isGenerating // Keep local loading state
              }));

              // 2. Trigger Check
              // Conditions: Not currently generating, Count < 10, Time > NextRun
              const now = Date.now();
              if (!automationStatus.isGenerating && status.dailyCount < 10 && now > status.nextRun) {
                  
                  // LOCK START
                  setAutomationStatus(prev => ({ ...prev, isGenerating: true }));
                  console.log("⚡ Auto-News Triggered");

                  // Generate Content (JUST ONE)
                  const existingTitles = news.map(n => n.title);
                  const newArticles = await generateCinemaNews(existingTitles);

                  // STRICTLY PROCESS ONLY 1 ARTICLE (Index 0)
                  if (newArticles.length > 0) {
                      const article = newArticles[0];
                      let imageUrl = '';
                      
                      // 1. Priority: Real Image from TMDB
                      if (article.searchQuery && tmdbToken) {
                          try {
                              // Try Movie Search First
                              const searchRes = await searchMoviesTMDB(article.searchQuery, tmdbToken);
                              const bestMovie = searchRes.find(m => m.backdrop_path) || searchRes.find(m => m.poster_path);
                              
                              if (bestMovie) {
                                  imageUrl = getImageUrl(bestMovie.backdrop_path || bestMovie.poster_path, 'original');
                              } else {
                                  // Fallback: Person Search
                                  const personRes = await searchPersonTMDB(article.searchQuery, tmdbToken);
                                  const bestPerson = personRes.find(p => p.profile_path);
                                  if (bestPerson) {
                                      imageUrl = getImageUrl(bestPerson.profile_path, 'original');
                                  }
                              }
                          } catch (e) {
                              console.warn("Auto-News Image Search Failed:", e);
                          }
                      }

                      // 2. Fallback: AI Generation (Only if TMDB failed)
                      if (!imageUrl && article.visualPrompt) {
                          imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(article.visualPrompt)}?nologo=true&width=800&height=450&model=flux`;
                      }

                      // Publish Single Article
                      await addDoc(collection(db, 'news'), {
                          title: article.title,
                          content: article.content,
                          type: 'general',
                          imageUrl: imageUrl,
                          timestamp: Date.now()
                      });

                      // Update Config
                      // Increase count by 1, Set timer to +2 hours
                      const newCount = status.dailyCount + 1;
                      const nextRun = Date.now() + (2 * 60 * 60 * 1000); // 2 Hours from now

                      await setDoc(docRef, {
                          dailyCount: newCount,
                          lastRun: Date.now(),
                          nextRun: nextRun,
                          date: today
                      });
                      
                      console.log(`✅ Auto-News: Published "${article.title}". Next run in 2h.`);
                  } else {
                      console.log("⚠️ Auto-News: No new articles generated.");
                  }

                  // UNLOCK
                  setAutomationStatus(prev => ({ ...prev, isGenerating: false }));
              }

          } catch (e) {
              console.error("Automation Engine Error:", e);
              setAutomationStatus(prev => ({ ...prev, isGenerating: false }));
          }
      };

      // Run check immediately on mount, then every 60 seconds
      checkNewsAutomation();
      const interval = setInterval(checkNewsAutomation, 60000); 

      return () => clearInterval(interval);
  }, [user?.isAdmin, user?.id, tmdbToken, news.length]); // Dependencies to ensure fresh data

  // Firebase Listeners
  useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          if (firebaseUser) {
              const userRef = doc(db, 'users', firebaseUser.uid);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                  const userData = { id: userSnap.id, ...userSnap.data() } as User;
                  setUser(userData);
                  // Update Last Seen immediately on load
                  updateDoc(userRef, { lastSeen: Date.now() });
              }
          } else {
              setUser(null);
          }
      });
      return () => unsubscribe();
  }, []);

  // --- HEARTBEAT FOR ONLINE STATUS ---
  useEffect(() => {
      if (!user?.id) return;
      
      const interval = setInterval(() => {
          // Update lastSeen every 2 minutes to stay "Online"
          updateDoc(doc(db, 'users', user.id), { lastSeen: Date.now() });
      }, 2 * 60 * 1000); // 2 minutes

      return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
      if (!user?.id) return;
      return onSnapshot(doc(db, 'users', user.id), (doc) => {
          if (doc.exists()) setUser({ id: doc.id, ...doc.data() } as User);
      });
  }, [user?.id]);

  // CORE DATA LISTENERS
  useEffect(() => {
      const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
          setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
      });
      const unsubMovies = onSnapshot(collection(db, 'movies'), (snap) => {
          setMovies(snap.docs.map(d => ({ id: d.id, ...d.data() } as Movie)));
      });
      const unsubRatings = onSnapshot(collection(db, 'ratings'), (snap) => {
          setUserRatings(snap.docs.map(d => d.data() as UserRating));
      });
      const unsubNews = onSnapshot(query(collection(db, 'news'), orderBy('timestamp', 'desc')), (snap) => {
          setNews(snap.docs.map(d => ({ id: d.id, ...d.data() } as NewsItem)));
      });
      const unsubFeedback = onSnapshot(collection(db, 'feedback'), (snap) => {
          setFeedbackList(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppFeedback)));
      });
      
      return () => { unsubUsers(); unsubMovies(); unsubRatings(); unsubNews(); unsubFeedback(); };
  }, []);

  useEffect(() => {
      const unsub = onSnapshot(query(collection(db, 'events'), orderBy('startDate', 'desc'), limit(1)), (snap) => {
          if (!snap.empty) {
              const eventData = { id: snap.docs[0].id, ...snap.docs[0].data() } as CineEvent;
              if (eventData.phase !== 'closed') {
                  setActiveEvent(eventData);
              } else {
                  setActiveEvent(null);
              }
          } else {
              setActiveEvent(null);
          }
      });
      return () => unsub();
  }, []);

  useEffect(() => {
      if (!activeEvent) {
          setEventMessages([]);
          return;
      }
      const q = query(collection(db, `events/${activeEvent.id}/messages`), orderBy('timestamp', 'asc'));
      return onSnapshot(q, (snap) => {
          setEventMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
  }, [activeEvent?.id]);

  useEffect(() => {
      if (!user) return;
      const q = query(collection(db, `users/${user.id}/mailbox`), orderBy('timestamp', 'desc'));
      return onSnapshot(q, (snap) => {
          setMailbox(snap.docs.map(d => ({ id: d.id, ...d.data() } as MailboxMessage)));
      });
  }, [user?.id]);

  // Auth Methods
  const login = async (email: string, pass: string) => {
      try {
          await signInWithEmailAndPassword(auth, email, pass);
          return { success: true, message: 'Bienvenido' };
      } catch (e: any) {
          return { success: false, message: e.message };
      }
  };

  const register = async (email: string, name: string, pass: string) => {
      try {
          const res = await createUserWithEmailAndPassword(auth, email, pass);
          const newUser: User = {
              id: res.user.uid,
              email,
              name,
              avatarUrl: STARTER_AVATARS[Math.floor(Math.random() * STARTER_AVATARS.length)].url,
              watchedMovies: [],
              watchlist: [],
              status: 'pending',
              isAdmin: false,
              xp: 0,
              level: 1,
              credits: 0,
              completedMissions: [],
              gamificationStats: {},
              lastSeen: Date.now()
          };
          await setDoc(doc(db, 'users', res.user.uid), newUser as any);
          return { success: true, message: 'Cuenta creada. Espera aprobación.' };
      } catch (e: any) {
          return { success: false, message: e.message };
      }
  };

  const logout = () => signOut(auth);
  const resetPassword = async (email: string) => {
      try {
          await sendPasswordResetEmail(auth, email);
          return { success: true, message: 'Correo enviado.' };
      } catch (e: any) {
          return { success: false, message: e.message };
      }
  };

  // Data Methods
  const addMovie = async (movie: Movie) => {
      if (!movie.id) return;
      await setDoc(doc(db, 'movies', movie.id), movie);
  };

  const checkMissions = (userId: string) => { /* Placeholder */ };

  // --- HELPER: Recalculate Movie Stats ---
  const recalculateMovieRating = async (movieId: string) => {
      // FIX: Increase delay to ensure Firestore writes have propagated to indices/reads
      await new Promise(resolve => setTimeout(resolve, 1500));

      try {
          // Fetch all ratings for this movie
          const q = query(collection(db, 'ratings'), where('movieId', '==', movieId));
          const querySnapshot = await getDocs(q);
          
          let totalSum = 0;
          let count = 0;
          
          querySnapshot.forEach((doc) => {
              const r = doc.data();
              if (typeof r.rating === 'number' && !isNaN(r.rating)) {
                  totalSum += r.rating;
                  count++;
              }
          });

          const newAverage = count > 0 ? totalSum / count : 0;

          // Update Movie Document with new stats
          await updateDoc(doc(db, 'movies', movieId), {
              rating: newAverage,
              totalVotes: count
          });
          
      } catch (error) {
          console.error("Error recalculating movie stats:", error);
      }
  };

  const rateMovie = async (movieId: string, detailed: any, comment: string, spoiler?: string) => {
      if (!user) return;
      const ratingData: UserRating = {
          movieId,
          userId: user.id,
          detailed,
          rating: detailed.average,
          comment,
          spoiler,
          timestamp: Date.now()
      };
      
      // 1. Save or Update individual rating
      await setDoc(doc(db, 'ratings', `${user.id}_${movieId}`), ratingData);
      
      // 2. Update User lists if needed
      if (!user.watchedMovies.includes(movieId)) {
          await updateDoc(doc(db, 'users', user.id), {
              watchedMovies: arrayUnion(movieId),
              watchlist: arrayRemove(movieId)
          });
      }

      // 3. Trigger recalculation of global average
      await recalculateMovieRating(movieId);

      checkMissions(user.id);
  };

  const unwatchMovie = async (movieId: string) => {
      if (!user) return;
      // 1. Delete rating
      await deleteDoc(doc(db, 'ratings', `${user.id}_${movieId}`));
      // 2. Update user lists
      await updateDoc(doc(db, 'users', user.id), {
          watchedMovies: arrayRemove(movieId)
      });
      // 3. Recalculate global average (will decrease count)
      await recalculateMovieRating(movieId);
  };

  const toggleWatchlist = async (movieId: string) => {
      if (!user) return;
      if (user.watchlist.includes(movieId)) {
          await updateDoc(doc(db, 'users', user.id), { watchlist: arrayRemove(movieId) });
      } else {
          await updateDoc(doc(db, 'users', user.id), { watchlist: arrayUnion(movieId) });
      }
  };

  const toggleReviewVote = (targetUserId: string, movieId: string, voteType: 'like'|'dislike') => {
      // Placeholder logic for likes
      const ratingId = `${targetUserId}_${movieId}`;
      const rating = userRatings.find(r => r.movieId === movieId && r.userId === targetUserId);
      if (!rating || !user) return;

      const userLikes = rating.likes || [];
      const userDislikes = rating.dislikes || [];
      
      let updates = {};

      if (voteType === 'like') {
          if (userLikes.includes(user.id)) {
              updates = { likes: arrayRemove(user.id) };
          } else {
              updates = { likes: arrayUnion(user.id), dislikes: arrayRemove(user.id) };
          }
      } else {
          if (userDislikes.includes(user.id)) {
              updates = { dislikes: arrayRemove(user.id) };
          } else {
              updates = { dislikes: arrayUnion(user.id), likes: arrayRemove(user.id) };
          }
      }
      updateDoc(doc(db, 'ratings', ratingId), updates);
  };

  // Admin Methods
  const approveUser = (uid: string) => updateDoc(doc(db, 'users', uid), { status: 'active' });
  const rejectUser = (uid: string, banTime?: number) => {
      const update: any = { status: 'rejected' };
      if (banTime) update.banExpiresAt = Date.now() + banTime;
      return updateDoc(doc(db, 'users', uid), update);
  };
  const deleteUserAccount = (uid: string) => deleteDoc(doc(db, 'users', uid));
  const toggleUserAdmin = (uid: string) => {
      const u = allUsers.find(u => u.id === uid);
      if (u) updateDoc(doc(db, 'users', uid), { isAdmin: !u.isAdmin });
  };
  
  // Persist Token to DB
  const setTmdbToken = async (token: string) => {
      setTmdbTokenState(token);
      await setDoc(doc(db, 'config', 'general'), { tmdbToken: token }, { merge: true });
  };
  
  // --- MESSAGING SYSTEM (REWRITTEN) ---
  const sendSystemMessage = async (userId: string, title: string, body: string, type = 'info', actionMovieId?: string, actionEventId?: string) => {
      // Firestore does not accept 'undefined' values. We omit them or pass null.
      const messageData = {
          title, 
          body, 
          type, 
          timestamp: Date.now(), 
          read: false,
          ...(actionMovieId ? { actionMovieId } : {}),
          ...(actionEventId ? { actionEventId } : {})
      };
      await addDoc(collection(db, 'users', userId, 'mailbox'), messageData);
  };

  const markMessageRead = async (msgId: string) => {
      if(!user) return;
      try {
          const path = `users/${user.id}/mailbox/${msgId}`;
          await updateDoc(doc(db, path), { read: true });
      } catch(e) {
          console.warn("Could not mark message as read (might be deleted):", e);
      }
  }

  const markAllMessagesRead = async () => {
      if(!user || mailbox.length === 0) return;
      
      const batch = writeBatch(db);
      let count = 0;
      
      mailbox.forEach(msg => {
          if (!msg.read) {
              // Explicit path for robustness
              const path = `users/${user.id}/mailbox/${msg.id}`;
              const ref = doc(db, path);
              batch.update(ref, { read: true });
              count++;
          }
      });

      if (count > 0) {
          await batch.commit();
      }
  };

  const deleteMessage = async (msgId: string) => {
      if(!user) throw new Error("User not authenticated");
      try {
          // Explicit string path to ensure correct deletion and avoid undefined segment issues
          const path = `users/${user.id}/mailbox/${msgId}`;
          console.log("Deleting message at:", path);
          await deleteDoc(doc(db, path));
          return true;
      } catch(e) {
          console.error("Could not delete message:", e);
          throw e;
      }
  }

  // News & Feedback
  const publishNews = (title: string, content: string, type: string, imageUrl?: string) => {
      addDoc(collection(db, 'news'), { title, content, type, imageUrl, timestamp: Date.now() });
  };
  const deleteNews = (id: string) => deleteDoc(doc(db, 'news', id));
  const sendFeedback = (type: string, text: string) => {
      if(user) addDoc(collection(db, 'feedback'), { userId: user.id, userName: user.name, type, text, status: 'pending', timestamp: Date.now() });
  };
  const resolveFeedback = (id: string) => updateDoc(doc(db, 'feedback', id), { status: 'solved' });
  const deleteFeedback = (id: string) => deleteDoc(doc(db, 'feedback', id));

  const resetGamification = async () => {
      allUsers.forEach(u => updateDoc(doc(db, 'users', u.id), { xp: 0, level: 1, credits: 0, completedMissions: [] }));
  };
  
  const resetAutomation = () => {
      // Force reset local state and also update DB to allow immediate run
      setAutomationStatus({ dailyCount: 0, isGenerating: false, lastRun: 0, nextRun: 0 });
      setDoc(doc(db, 'config', 'news_automation'), { 
          dailyCount: 0, 
          lastRun: 0, 
          nextRun: 0, 
          date: new Date().toLocaleDateString() 
      });
  };

  const auditQuality = async () => 0;

  // Events
  const createEvent = async (data: any) => {
      await addDoc(collection(db, 'events'), { ...data, phase: 'voting', startDate: Date.now(), votingDeadline: Date.now() + 86400000 * 3, viewingDeadline: Date.now() + 86400000 * 7 });
  }
  const closeEvent = (id: string) => updateDoc(doc(db, 'events', id), { phase: 'closed' });

  const voteForCandidate = async (eventId: string, tmdbId: number) => {
      if (!user || !activeEvent) return;
      const newCandidates = activeEvent.candidates.map(c => {
          const votes = c.votes.filter(uid => uid !== user.id);
          if (c.tmdbId === tmdbId) votes.push(user.id);
          return { ...c, votes };
      });
      await updateDoc(doc(db, 'events', eventId), { candidates: newCandidates });
      
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, { 
          'gamificationStats.vote_event': true, 
          'gamificationStats.cineforum_participation': true,
          'gamificationStats.cineforumVoteCount': increment(1)
      });
      checkMissions(user.id);
  };

  const transitionEventPhase = async (eventId: string, phase: EventPhase, winnerTmdbId?: number) => {
      const update: any = { phase };
      if (winnerTmdbId) update.winnerTmdbId = winnerTmdbId;
      await updateDoc(doc(db, 'events', eventId), update);
  };

  const toggleEventCommitment = async (eventId: string, type: 'view' | 'debate', specificTmdbId?: number, preference?: { solo: boolean, group: boolean }) => {
      if (!user || !activeEvent) return;
      
      const field = type === 'view' ? 'committedViewers' : 'committedDebaters';
      const list = (activeEvent as any)?.[field] || [];
      const hasCommitted = list.includes(user.id);
      
      const currentPrefs = activeEvent.viewingPreferences || {};
      let newPrefs = { ...currentPrefs };

      if (type === 'view') {
          if (preference) {
              newPrefs[user.id] = preference;
              if (!hasCommitted) {
                  await updateDoc(doc(db, 'events', eventId), {
                      [field]: arrayUnion(user.id),
                      viewingPreferences: newPrefs
                  });
              } else {
                  await updateDoc(doc(db, 'events', eventId), {
                      viewingPreferences: newPrefs
                  });
              }

              if (preference.group) {
                  const interestedUsers = Object.entries(newPrefs)
                      .filter(([uid, pref]) => uid !== user.id && (pref as any).group)
                      .map(([uid]) => uid);
                  
                  if (interestedUsers.length > 0) {
                      const allGroupies = [...interestedUsers, user.id];
                      allGroupies.forEach(uid => {
                          sendSystemMessage(uid, "¡Hay Quórum!", "¡Tienes compañeros para ver la peli! Entra al evento para coordinar lugar y hora.", "info", undefined, eventId);
                      });
                  }
              }
          } else {
              await updateDoc(doc(db, 'events', eventId), {
                  [field]: hasCommitted ? arrayRemove(user.id) : arrayUnion(user.id)
              });
          }
      } else {
          await updateDoc(doc(db, 'events', eventId), {
              [field]: hasCommitted ? arrayRemove(user.id) : arrayUnion(user.id)
          });
      }

      if (!hasCommitted) {
          const userRef = doc(db, 'users', user.id);
          await updateDoc(userRef, { 'gamificationStats.cineforum_participation': true });
          checkMissions(user.id);
      }

      const targetTmdbId = specificTmdbId || activeEvent.winnerTmdbId;
      if (type === 'view' && targetTmdbId) {
          const tmdbId = targetTmdbId;
          let movie = movies.find(m => m.tmdbId === tmdbId);
          let movieId = movie?.id || `tmdb-${tmdbId}`;

          if (!hasCommitted && !movie) {
              try {
                  const details = await getMovieDetailsTMDB(tmdbId, tmdbToken);
                  let newMovie: Movie;
                  if (details) {
                      newMovie = {
                          id: movieId,
                          tmdbId: details.id,
                          title: details.title,
                          year: parseInt(details.release_date?.split('-')[0]) || new Date().getFullYear(),
                          director: details.credits?.crew?.find(c => c.job === 'Director')?.name || 'Unknown',
                          genre: details.genres?.map(g => g.name) || [],
                          posterUrl: getImageUrl(details.poster_path),
                          backdropUrl: getImageUrl(details.backdrop_path, 'original'),
                          description: details.overview,
                          cast: details.credits?.cast?.slice(0, 5).map(c => c.name) || [],
                          rating: 0,
                          totalVotes: 0
                      };
                  } else {
                      const candidate = activeEvent.candidates.find(c => c.tmdbId === tmdbId);
                      if (!candidate) throw new Error("Candidate data missing"); 
                      newMovie = {
                          id: movieId,
                          tmdbId: candidate.tmdbId,
                          title: candidate.title,
                          year: candidate.year,
                          director: 'Ver detalles',
                          genre: [],
                          posterUrl: candidate.posterUrl,
                          backdropUrl: activeEvent.backdropUrl || candidate.posterUrl,
                          description: candidate.description,
                          cast: [],
                          rating: 0,
                          totalVotes: 0
                      };
                  }
                  await addMovie(newMovie);
              } catch (e) {
                  console.error("Error ensuring movie exists for watchlist:", e);
                  return;
              }
          }

          if (movieId) {
              const userRef = doc(db, 'users', user.id);
              if (hasCommitted && !preference) {
                  await updateDoc(userRef, { watchlist: arrayRemove(movieId) });
              } else if (!hasCommitted) {
                  if (!user.watchedMovies.includes(movieId)) {
                      await updateDoc(userRef, { watchlist: arrayUnion(movieId) });
                      await updateDoc(userRef, { 'gamificationStats.watchlist': true });
                  }
              }
          }
      }
  };

  const proposeMeetupLocation = async (eventId: string, location: { name: string, address: string, uri: string }) => {
      if (!user) return;
      const meetupLoc = {
          id: `loc_${Date.now()}`,
          name: location.name,
          address: location.address,
          mapUri: location.uri,
          proposedBy: user.id,
          votes: [user.id]
      };
      
      const eventRef = doc(db, 'events', eventId);
      const eventSnap = await getDoc(eventRef);
      if (!eventSnap.exists()) return;
      const currentLocs = eventSnap.data().meetupProposal?.locations || [];
      
      await updateDoc(eventRef, {
          'meetupProposal.locations': [...currentLocs, meetupLoc]
      });
  };

  const voteMeetupLocation = async (eventId: string, locationId: string) => {
      if (!user) return;
      const eventRef = doc(db, 'events', eventId);
      const eventSnap = await getDoc(eventRef);
      if (!eventSnap.exists()) return;
      
      const currentLocs = eventSnap.data().meetupProposal?.locations || [];
      const newLocs = currentLocs.map((loc: any) => {
          if (loc.id === locationId) {
              const votes = loc.votes || [];
              if (votes.includes(user.id)) {
                  return { ...loc, votes: votes.filter((uid: string) => uid !== user.id) };
              } else {
                  return { ...loc, votes: [...votes, user.id] };
              }
          }
          return loc;
      });

      await updateDoc(eventRef, {
          'meetupProposal.locations': newLocs
      });
  };

  const toggleTimeVote = async (eventId: string, timeKey: string) => {
      if (!user || !activeEvent) return;
      const currentVotes = activeEvent.timeVotes?.[timeKey] || [];
      const hasVoted = currentVotes.includes(user.id);
      const newVotes = hasVoted ? currentVotes.filter(uid => uid !== user.id) : [...currentVotes, user.id];
      await updateDoc(doc(db, 'events', eventId), {
          [`timeVotes.${timeKey}`]: newVotes
      });
  };

  const sendEventMessage = async (eventId: string, text: string, role: 'user'|'moderator'|'system' = 'user', audioBase64?: string) => {
      const msg = {
          userId: user?.id || 'system',
          userName: role === 'moderator' ? 'Cine Mensa IA' : user?.name || 'Sistema',
          userAvatar: role === 'moderator' ? 'https://ui-avatars.com/api/?name=AI&background=d4af37&color=000' : user?.avatarUrl || '',
          text,
          role,
          audioBase64,
          timestamp: Date.now()
      };
      await addDoc(collection(db, `events/${eventId}/messages`), msg);
      if (role === 'user' && user) {
          const userRef = doc(db, 'users', user.id);
          await updateDoc(userRef, { 'gamificationStats.cineforum_participation': true });
          checkMissions(user.id);
      }
  };

  const raiseHand = async (eventId: string) => {
      if (!user) return;
      await updateDoc(doc(db, 'events', eventId), {
          speakerQueue: arrayUnion(user.id)
      });
  };

  const grantTurn = async (eventId: string, userId: string) => {
      await updateDoc(doc(db, 'events', eventId), {
          currentSpeakerId: userId,
          speakerQueue: arrayRemove(userId)
      });
  };

  const releaseTurn = async (eventId: string) => {
      await updateDoc(doc(db, 'events', eventId), {
          currentSpeakerId: null
      });
  };

  const getEpisodeCount = async () => {
      return 5;
  };

  // Live Session
  const startLiveSession = async (mode: string) => {
      if (!process.env.API_KEY) {
          alert("API Key missing");
          return;
      }
      setLiveSession(prev => ({ ...prev, isConnected: true, status: 'Conectando...' }));
      setTimeout(() => {
          setLiveSession(prev => ({ ...prev, status: 'En línea' }));
      }, 1000);
  };

  const stopLiveSession = () => {
      setLiveSession(prev => ({ ...prev, isConnected: false, status: '', visualContent: [] }));
  };

  const getRemainingVoiceSeconds = () => {
      if (!user?.voiceUsageSeconds) return 120;
      return Math.max(0, 120 - user.voiceUsageSeconds);
  };

  // Private Chat
  const startPrivateChat = async (targetUserId: string) => {
      if (!user) return;
      const targetUser = allUsers.find(u => u.id === targetUserId);
      if (!targetUser) return;

      const sessionId = [user.id, targetUserId].sort().join('_');
      const session: PrivateChatSession = {
          id: sessionId,
          creatorId: user.id,
          targetId: targetUserId,
          creatorName: user.name,
          targetName: targetUser.name,
          isActive: true,
          createdAt: Date.now()
      };
      setActivePrivateChat({ session, messages: [] });
  };

  const sendPrivateMessage = async (text: string) => {
      if (!activePrivateChat || !user) return;
      const msg: PrivateChatMessage = {
          id: Date.now().toString(),
          senderId: user.id,
          senderName: user.name,
          text,
          timestamp: Date.now()
      };
      setActivePrivateChat(prev => prev ? { ...prev, messages: [...prev.messages, msg] } : null);
  };

  const closePrivateChat = () => setActivePrivateChat(null);
  const leavePrivateChat = () => setActivePrivateChat(null);
  const setPrivateChatTyping = (isTyping: boolean) => {};

  // Trivia
  const inviteToTrivia = (targetUserId: string) => {
      if (!user) return;
      const targetUser = allUsers.find(u => u.id === targetUserId);
      if (!targetUser) return;

      const matchId = `match_${Date.now()}`;
      const newMatch: TriviaMatch = {
          id: matchId,
          players: {
              [user.id]: { id: user.id, name: user.name, avatarUrl: user.avatarUrl, score: 0, hasAnswered: false },
              [targetUserId]: { id: targetUser.id, name: targetUser.name, avatarUrl: targetUser.avatarUrl, score: 0, hasAnswered: false }
          },
          currentQuestion: null,
          round: 0,
          status: 'waiting',
          createdAt: Date.now()
      };
      
      setActiveTriviaMatch(newMatch);
      sendSystemMessage(targetUserId, "Desafío de Trivial", `${user.name} te ha invitado a un duelo de cine.`, 'info');
  };

  const updateTriviaMatchState = (newState: Partial<TriviaMatch>) => {
      setActiveTriviaMatch(prev => prev ? { ...prev, ...newState } : null);
  }

  const handleTriviaWin = async (winnerId: string) => {
      if (winnerId === user?.id) {
          const userRef = doc(db, 'users', user.id);
          await updateDoc(userRef, { duelWins: increment(1) });
          checkMissions(user.id);
      }
  }

  const saveTriviaHighScore = async (score: number) => {
      if (!user) return;
      const currentHigh = user.triviaHighScore || 0;
      if (score > currentHigh) {
          const userRef = doc(db, 'users', user.id);
          await updateDoc(userRef, { triviaHighScore: score });
      }
  }

  const endTriviaMatchLocal = () => setActiveTriviaMatch(null);

  // User Profile
  const updateUserProfile = async (name: string, avatarUrl: string) => {
      if (!user) return;
      await updateDoc(doc(db, 'users', user.id), { name, avatarUrl });
  };

  const triggerAction = async (actionId: string) => {
      if (!user) return;
      const key = `gamificationStats.${actionId}`;
      if (['use_ai', 'use_ai_chat', 'read_news', 'visit_ranking', 'search', 'update_avatar', 'feedback'].includes(actionId)) {
          await updateDoc(doc(db, 'users', user.id), { [key]: true });
      }
      checkMissions(user.id);
  };

  const spendCredits = async (amount: number, itemId: string) => {
      if (!user || user.credits < amount) return false;
      await updateDoc(doc(db, 'users', user.id), {
          credits: increment(-amount),
          inventory: arrayUnion(itemId)
      });
      setNotification({ type: 'shop', message: '¡Compra realizada con éxito!' });
      return true;
  };

  const toggleInventoryItem = async (itemId: string) => {
      if (!user) return;
      if (user.inventory?.includes(itemId)) {
          await updateDoc(doc(db, 'users', user.id), { inventory: arrayRemove(itemId) });
      } else {
          await updateDoc(doc(db, 'users', user.id), { inventory: arrayUnion(itemId) });
      }
  }

  const completeLevelUpChallenge = async (level: number, reward: number) => {
      if (!user) return;
      await updateDoc(doc(db, 'users', user.id), {
          credits: increment(reward),
          level: Math.max(user.level, level)
      });
      setNotification({ type: 'level', message: `¡Nivel ${level} Alcanzado! +${reward} Créditos` });
  };

  const clearNotification = () => setNotification(null);
  const closeMilestoneModal = () => setMilestoneEvent(null);

  const value: any = {
    user, allUsers, movies, userRatings, news, feedbackList, activeEvent, eventMessages, mailbox,
    currentView, selectedMovieId, selectedPersonId, initialProfileTab,
    tmdbToken, notification, milestoneEvent, automationStatus,
    liveSession, topCriticId, activePrivateChat,
    // Trivia State & Functions
    activeTriviaMatch, inviteToTrivia, updateTriviaMatchState, endTriviaMatchLocal, handleTriviaWin, saveTriviaHighScore,
    
    setView, login, register, logout, resetPassword,
    addMovie, rateMovie, unwatchMovie, toggleWatchlist, toggleReviewVote,
    approveUser, rejectUser, deleteUserAccount, toggleUserAdmin, updateUserProfile,
    setTmdbToken, sendSystemMessage, markMessageRead, markAllMessagesRead, deleteMessage,
    publishNews, deleteNews, sendFeedback, resolveFeedback, deleteFeedback,
    resetGamification, resetAutomation, auditQuality,
    createEvent, closeEvent, voteForCandidate, transitionEventPhase, toggleEventCommitment, toggleTimeVote, proposeMeetupLocation, voteMeetupLocation,
    sendEventMessage, raiseHand, grantTurn, releaseTurn, getEpisodeCount,
    startLiveSession, stopLiveSession, getRemainingVoiceSeconds,
    startPrivateChat, sendPrivateMessage, closePrivateChat, leavePrivateChat, setPrivateChatTyping,
    spendCredits, toggleInventoryItem, completeLevelUpChallenge,
    triggerAction, setInitialProfileTab, clearNotification, closeMilestoneModal
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};
