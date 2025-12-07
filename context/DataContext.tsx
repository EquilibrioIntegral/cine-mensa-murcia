
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { auth, db } from '../firebase';
import { 
  collection, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, 
  onSnapshot, query, where, orderBy, arrayUnion, arrayRemove, increment, limit, writeBatch, getDocs, runTransaction
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
import { STARTER_AVATARS, MISSIONS, XP_TABLE } from '../constants';
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
  const isGeneratingRef = useRef(false); // Ref for lock to prevent race conditions across renders
  
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
  useEffect(() => {
      if (!user?.isAdmin) return;

      const checkNewsAutomation = async () => {
          // Double lock: Ref + SessionStorage to prevent multi-tab race
          if (isGeneratingRef.current || sessionStorage.getItem('generating_news') === 'true') return;

          try {
              const docRef = doc(db, 'config', 'news_automation');
              let shouldRun = false;

              // Use Transaction to prevent race conditions between tabs/clients
              await runTransaction(db, async (transaction) => {
                  const docSnap = await transaction.get(docRef);
                  let status = docSnap.exists() ? docSnap.data() : { 
                      dailyCount: 0, 
                      lastRun: 0, 
                      nextRun: 0, 
                      date: new Date().toLocaleDateString() 
                  };

                  const today = new Date().toLocaleDateString();
                  // Reset if new day
                  if (status.date !== today) {
                      status = { dailyCount: 0, lastRun: 0, nextRun: 0, date: today };
                  }

                  // Update local state for UI visibility
                  setAutomationStatus(prev => ({
                      ...prev,
                      dailyCount: status.dailyCount,
                      lastRun: status.lastRun,
                      nextRun: status.nextRun
                  }));

                  // Check Trigger Condition
                  const now = Date.now();
                  if (status.dailyCount < 10 && now > status.nextRun) {
                      shouldRun = true;
                      
                      // Reserve slot immediately in DB
                      const newCount = status.dailyCount + 1;
                      const nextRun = Date.now() + (2 * 60 * 60 * 1000); // 2 Hours
                      
                      transaction.set(docRef, {
                          dailyCount: newCount,
                          lastRun: Date.now(),
                          nextRun: nextRun,
                          date: today
                      });
                  }
              });

              if (shouldRun) {
                  // LOCK LOCAL
                  isGeneratingRef.current = true;
                  sessionStorage.setItem('generating_news', 'true');
                  setAutomationStatus(prev => ({ ...prev, isGenerating: true }));
                  console.log("⚡ Auto-News Triggered via Transaction");

                  // Generate Content
                  const existingTitles = news.map(n => n.title);
                  const newArticles = await generateCinemaNews(existingTitles);

                  if (newArticles.length > 0) {
                      const article = newArticles[0];
                      let imageUrl = '';
                      
                      // Image Search Logic - Prioritize TMDB
                      if (tmdbToken) {
                          // Try search queries in order: Specific -> Title
                          const queriesToTry = [article.searchQuery, article.title].filter(q => q);
                          
                          for (const query of queriesToTry) {
                              if (imageUrl) break;
                              try {
                                  const searchRes = await searchMoviesTMDB(query, tmdbToken);
                                  const bestMovie = searchRes.find(m => m.backdrop_path) || searchRes.find(m => m.poster_path);
                                  if (bestMovie) {
                                      imageUrl = getImageUrl(bestMovie.backdrop_path || bestMovie.poster_path, 'original');
                                  } else {
                                      const personRes = await searchPersonTMDB(query, tmdbToken);
                                      const bestPerson = personRes.find(p => p.profile_path);
                                      if (bestPerson) imageUrl = getImageUrl(bestPerson.profile_path, 'original');
                                  }
                              } catch (e) { console.warn("Image search err:", e); }
                          }
                      }

                      // Fallback AI Image if no TMDB image found
                      if (!imageUrl && article.visualPrompt) {
                          imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(article.visualPrompt)}?nologo=true&width=800&height=450&model=flux`;
                      }

                      // Double check duplicate title before adding
                      const freshNewsSnap = await getDocs(query(collection(db, 'news'), where('title', '==', article.title)));
                      if (freshNewsSnap.empty) {
                          await addDoc(collection(db, 'news'), {
                              title: article.title,
                              content: article.content,
                              type: 'general',
                              imageUrl: imageUrl,
                              timestamp: Date.now()
                          });
                          console.log(`✅ Auto-News Published: ${article.title}`);
                      }
                  }
              }

          } catch (e) {
              console.error("Automation Engine Error:", e);
          } finally {
              // UNLOCK
              isGeneratingRef.current = false;
              sessionStorage.removeItem('generating_news');
              setAutomationStatus(prev => ({ ...prev, isGenerating: false }));
          }
      };

      checkNewsAutomation();
      const interval = setInterval(checkNewsAutomation, 60000); 
      return () => clearInterval(interval);
  }, [user?.isAdmin, user?.id, tmdbToken, news.length]);

  // Firebase Listeners
  useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          if (firebaseUser) {
              const userRef = doc(db, 'users', firebaseUser.uid);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                  const userData = { id: userSnap.id, ...userSnap.data() } as User;
                  setUser(userData);
                  updateDoc(userRef, { lastSeen: Date.now() });
              }
          } else {
              setUser(null);
          }
      });
      return () => unsubscribe();
  }, []);

  useEffect(() => {
      if (!user?.id) return;
      
      const interval = setInterval(() => {
          updateDoc(doc(db, 'users', user.id), { lastSeen: Date.now() });
      }, 2 * 60 * 1000);

      return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
      if (!user?.id) return;
      return onSnapshot(doc(db, 'users', user.id), (doc) => {
          if (doc.exists()) setUser({ id: doc.id, ...doc.data() } as User);
      });
  }, [user?.id]);

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

  // --- MANUAL REFRESH USER (FORCE DB SYNC) ---
  const refreshUser = async () => {
      if (!user?.id) return;
      try {
          const userRef = doc(db, 'users', user.id);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
              setUser({ id: userSnap.id, ...userSnap.data() } as User);
          }
      } catch(e) {
          console.error("Error refreshing user data:", e);
      }
  };

  // --- MESSAGING SYSTEM ---
  const sendSystemMessage = async (userId: string, title: string, body: string, type = 'info', actionMovieId?: string, actionEventId?: string) => {
      const messageData: any = {
          title, 
          body, 
          type, 
          timestamp: Date.now(), 
          read: false
      };
      
      // Explicitly check for truthy string values to avoid undefined error in Firestore
      if (actionMovieId) messageData.actionMovieId = actionMovieId;
      if (actionEventId) messageData.actionEventId = actionEventId;

      try {
          await addDoc(collection(db, 'users', userId, 'mailbox'), messageData);
      } catch (e) {
          console.error("Failed to send system message:", e);
      }
  };

  const markMessageRead = async (msgId: string) => {
      if(!user) return;
      try {
          await updateDoc(doc(db, `users/${user.id}/mailbox/${msgId}`), { read: true });
      } catch(e) { console.warn(e); }
  }

  const markAllMessagesRead = async () => {
      if(!user || mailbox.length === 0) return;
      const batch = writeBatch(db);
      let count = 0;
      mailbox.forEach(msg => {
          if (!msg.read) {
              const ref = doc(db, `users/${user.id}/mailbox/${msg.id}`);
              batch.update(ref, { read: true });
              count++;
          }
      });
      if (count > 0) await batch.commit();
  };

  const deleteMessage = async (msgId: string) => {
      if(!user) throw new Error("User not authenticated");
      try {
          await deleteDoc(doc(db, `users/${user.id}/mailbox/${msgId}`));
          return true;
      } catch(e) { console.error(e); throw e; }
  }

  // --- GAMIFICATION & MISSIONS ---
  const checkMissions = async (userId: string) => {
      const userRef = doc(db, 'users', userId);
      
      // FORCE DB FETCH to prevent XP drift (e.g. 170 in DB vs 180 in UI)
      let currentUserData: User | null = null;
      try {
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
              currentUserData = { id: userSnap.id, ...userSnap.data() } as User;
          }
      } catch (e) {
          console.error("Failed to fetch user data for missions:", e);
          return;
      }

      if (!currentUserData) return;

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

      let xpGainedNow = 0;
      const newMissions: string[] = [];

      MISSIONS.forEach(mission => {
          if (!currentUserData!.completedMissions?.includes(mission.id)) {
              if (mission.condition(currentUserData!, stats)) {
                  newMissions.push(mission.id);
                  xpGainedNow += mission.xpReward;
              }
          }
      });

      if (newMissions.length > 0) {
          // Calculate new XP based on FRESH server data
          const newXP = (currentUserData.xp || 0) + xpGainedNow;
          const newLevel = Math.floor(newXP / 100) + 1;

          await updateDoc(userRef, {
              completedMissions: arrayUnion(...newMissions),
              xp: newXP,
              level: newLevel
          });

          if (userId === user?.id) {
              setNotification({ type: 'level', message: `¡+${xpGainedNow} XP! Nueva misión completada.` });
              // Trigger a local refresh to update the UI instantly
              await refreshUser();
          } else {
              sendSystemMessage(userId, "¡Misión Cumplida!", `Has completado ${newMissions.length} misiones y ganado ${xpGainedNow} XP.`, 'reward');
          }
      }
  };

  const addMovie = async (movie: Movie) => {
      if (!movie.id) return;
      await setDoc(doc(db, 'movies', movie.id), movie);
  };

  const recalculateMovieRating = async (movieId: string) => {
      await new Promise(resolve => setTimeout(resolve, 1500));
      try {
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
          await updateDoc(doc(db, 'movies', movieId), {
              rating: newAverage,
              totalVotes: count
          });
      } catch (error) { console.error("Error recalculating movie stats:", error); }
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
      await setDoc(doc(db, 'ratings', `${user.id}_${movieId}`), ratingData);
      if (!user.watchedMovies.includes(movieId)) {
          await updateDoc(doc(db, 'users', user.id), {
              watchedMovies: arrayUnion(movieId),
              watchlist: arrayRemove(movieId)
          });
      }
      await recalculateMovieRating(movieId);
      checkMissions(user.id);
  };

  const unwatchMovie = async (movieId: string) => {
      if (!user) return;
      await deleteDoc(doc(db, 'ratings', `${user.id}_${movieId}`));
      await updateDoc(doc(db, 'users', user.id), {
          watchedMovies: arrayRemove(movieId)
      });
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

  const toggleReviewVote = async (targetUserId: string, movieId: string, voteType: 'like'|'dislike') => {
      const ratingId = `${targetUserId}_${movieId}`;
      const rating = userRatings.find(r => r.movieId === movieId && r.userId === targetUserId);
      if (!rating || !user) return;

      const userLikes = rating.likes || [];
      const userDislikes = rating.dislikes || [];
      let updates = {};

      if (voteType === 'like') {
          if (userLikes.includes(user.id)) updates = { likes: arrayRemove(user.id) };
          else updates = { likes: arrayUnion(user.id), dislikes: arrayRemove(user.id) };
      } else {
          if (userDislikes.includes(user.id)) updates = { dislikes: arrayRemove(user.id) };
          else updates = { dislikes: arrayUnion(user.id), likes: arrayRemove(user.id) };
      }
      await updateDoc(doc(db, 'ratings', ratingId), updates);
      
      setTimeout(() => {
          checkMissions(user.id);
          checkMissions(targetUserId);
      }, 1500);
  };

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
  
  const setTmdbToken = async (token: string) => {
      setTmdbTokenState(token);
      await setDoc(doc(db, 'config', 'general'), { tmdbToken: token }, { merge: true });
  };

  const publishNews = (title: string, content: string, type: string, imageUrl?: string) => {
      addDoc(collection(db, 'news'), { title, content, type, imageUrl, timestamp: Date.now() });
  };
  const deleteNews = (id: string) => deleteDoc(doc(db, 'news', id));
  const sendFeedback = (type: string, text: string) => {
      if(user) {
          addDoc(collection(db, 'feedback'), { userId: user.id, userName: user.name, type, text, status: 'pending', timestamp: Date.now() });
          checkMissions(user.id);
      }
  };
  const resolveFeedback = (id: string) => updateDoc(doc(db, 'feedback', id), { status: 'solved' });
  const deleteFeedback = (id: string) => deleteDoc(doc(db, 'feedback', id));

  const resetGamification = async () => {
      allUsers.forEach(u => updateDoc(doc(db, 'users', u.id), { xp: 0, level: 1, credits: 0, completedMissions: [] }));
  };
  
  const resetAutomation = () => {
      setAutomationStatus({ dailyCount: 0, isGenerating: false, lastRun: 0, nextRun: 0 });
      setDoc(doc(db, 'config', 'news_automation'), { 
          dailyCount: 0, 
          lastRun: 0, 
          nextRun: 0, 
          date: new Date().toLocaleDateString() 
      });
  };

  const auditQuality = async () => 0;

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
                  await updateDoc(doc(db, 'events', eventId), { [field]: arrayUnion(user.id), viewingPreferences: newPrefs });
              } else {
                  await updateDoc(doc(db, 'events', eventId), { viewingPreferences: newPrefs });
              }
              if (preference.group) {
                  const interestedUsers = Object.entries(newPrefs).filter(([uid, pref]) => uid !== user.id && (pref as any).group).map(([uid]) => uid);
                  if (interestedUsers.length > 0) {
                      [...interestedUsers, user.id].forEach(uid => {
                          sendSystemMessage(uid, "¡Hay Quórum!", "¡Tienes compañeros para ver la peli! Entra al evento para coordinar lugar y hora.", "info", undefined, eventId);
                      });
                  }
              }
          } else {
              await updateDoc(doc(db, 'events', eventId), { [field]: hasCommitted ? arrayRemove(user.id) : arrayUnion(user.id) });
          }
      } else {
          await updateDoc(doc(db, 'events', eventId), { [field]: hasCommitted ? arrayRemove(user.id) : arrayUnion(user.id) });
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
                          id: movieId, tmdbId: details.id, title: details.title, year: parseInt(details.release_date?.split('-')[0]) || new Date().getFullYear(),
                          director: details.credits?.crew?.find(c => c.job === 'Director')?.name || 'Unknown', genre: details.genres?.map(g => g.name) || [],
                          posterUrl: getImageUrl(details.poster_path), backdropUrl: getImageUrl(details.backdrop_path, 'original'), description: details.overview,
                          cast: details.credits?.cast?.slice(0, 5).map(c => c.name) || [], rating: 0, totalVotes: 0
                      };
                  } else {
                      const candidate = activeEvent.candidates.find(c => c.tmdbId === tmdbId);
                      if (!candidate) throw new Error("Candidate data missing"); 
                      newMovie = {
                          id: movieId, tmdbId: candidate.tmdbId, title: candidate.title, year: candidate.year,
                          director: 'Ver detalles', genre: [], posterUrl: candidate.posterUrl, backdropUrl: activeEvent.backdropUrl || candidate.posterUrl,
                          description: candidate.description, cast: [], rating: 0, totalVotes: 0
                      };
                  }
                  await addMovie(newMovie);
              } catch (e) { console.error("Error ensuring movie exists for watchlist:", e); return; }
          }

          if (movieId) {
              const userRef = doc(db, 'users', user.id);
              if (hasCommitted && !preference) await updateDoc(userRef, { watchlist: arrayRemove(movieId) });
              else if (!hasCommitted) {
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
          id: `loc_${Date.now()}`, name: location.name, address: location.address, mapUri: location.uri, proposedBy: user.id, votes: [user.id]
      };
      const eventRef = doc(db, 'events', eventId);
      const eventSnap = await getDoc(eventRef);
      if (!eventSnap.exists()) return;
      const currentLocs = eventSnap.data().meetupProposal?.locations || [];
      await updateDoc(eventRef, { 'meetupProposal.locations': [...currentLocs, meetupLoc] });
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
              return votes.includes(user.id) ? { ...loc, votes: votes.filter((uid: string) => uid !== user.id) } : { ...loc, votes: [...votes, user.id] };
          }
          return loc;
      });
      await updateDoc(eventRef, { 'meetupProposal.locations': newLocs });
  };

  const toggleTimeVote = async (eventId: string, timeKey: string) => {
      if (!user || !activeEvent) return;
      const currentVotes = activeEvent.timeVotes?.[timeKey] || [];
      const hasVoted = currentVotes.includes(user.id);
      const newVotes = hasVoted ? currentVotes.filter(uid => uid !== user.id) : [...currentVotes, user.id];
      await updateDoc(doc(db, 'events', eventId), { [`timeVotes.${timeKey}`]: newVotes });
  };

  const sendEventMessage = async (eventId: string, text: string, role: 'user'|'moderator'|'system' = 'user', audioBase64?: string) => {
      const msg = {
          userId: user?.id || 'system',
          userName: role === 'moderator' ? 'Cine Mensa IA' : user?.name || 'Sistema',
          userAvatar: role === 'moderator' ? 'https://ui-avatars.com/api/?name=AI&background=d4af37&color=000' : user?.avatarUrl || '',
          text, role, audioBase64, timestamp: Date.now()
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
      await updateDoc(doc(db, 'events', eventId), { speakerQueue: arrayUnion(user.id) });
  };

  const grantTurn = async (eventId: string, userId: string) => {
      await updateDoc(doc(db, 'events', eventId), { currentSpeakerId: userId, speakerQueue: arrayRemove(userId) });
  };

  const releaseTurn = async (eventId: string) => {
      await updateDoc(doc(db, 'events', eventId), { currentSpeakerId: null });
  };

  const getEpisodeCount = async () => 5;

  const startLiveSession = async (mode: string) => {
      if (!process.env.API_KEY) { alert("API Key missing"); return; }
      setLiveSession(prev => ({ ...prev, isConnected: true, status: 'Conectando...' }));
      setTimeout(() => { setLiveSession(prev => ({ ...prev, status: 'En línea' })); }, 1000);
  };

  const stopLiveSession = () => {
      setLiveSession(prev => ({ ...prev, isConnected: false, status: '', visualContent: [] }));
  };

  const getRemainingVoiceSeconds = () => {
      if (!user?.voiceUsageSeconds) return 120;
      return Math.max(0, 120 - user.voiceUsageSeconds);
  };

  const startPrivateChat = async (targetUserId: string) => {
      if (!user) return;
      const targetUser = allUsers.find(u => u.id === targetUserId);
      if (!targetUser) return;
      const sessionId = [user.id, targetUserId].sort().join('_');
      const session: PrivateChatSession = {
          id: sessionId, creatorId: user.id, targetId: targetUserId, creatorName: user.name, targetName: targetUser.name, isActive: true, createdAt: Date.now()
      };
      setActivePrivateChat({ session, messages: [] });
  };

  const sendPrivateMessage = async (text: string) => {
      if (!activePrivateChat || !user) return;
      const msg: PrivateChatMessage = { id: Date.now().toString(), senderId: user.id, senderName: user.name, text, timestamp: Date.now() };
      setActivePrivateChat(prev => prev ? { ...prev, messages: [...prev.messages, msg] } : null);
  };

  const closePrivateChat = () => setActivePrivateChat(null);
  const leavePrivateChat = () => setActivePrivateChat(null);
  const setPrivateChatTyping = (isTyping: boolean) => {};

  const inviteToTrivia = (targetUserId: string) => {
      if (!user) return;
      const targetUser = allUsers.find(u => u.id === targetUserId);
      if (!targetUser) return;
      const matchId = `match_${Date.now()}`;
      const newMatch: TriviaMatch = {
          id: matchId,
          players: { [user.id]: { id: user.id, name: user.name, avatarUrl: user.avatarUrl, score: 0, hasAnswered: false }, [targetUserId]: { id: targetUser.id, name: targetUser.name, avatarUrl: targetUser.avatarUrl, score: 0, hasAnswered: false } },
          currentQuestion: null, round: 0, status: 'waiting', createdAt: Date.now()
      };
      setActiveTriviaMatch(newMatch);
      sendSystemMessage(targetUserId, "Desafío de Trivial", `${user.name} te ha invitado a un duelo de cine.`, 'info');
  };

  const updateTriviaMatchState = (newState: Partial<TriviaMatch>) => setActiveTriviaMatch(prev => prev ? { ...prev, ...newState } : null);
  
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
      await updateDoc(doc(db, 'users', user.id), { credits: increment(-amount), inventory: arrayUnion(itemId) });
      setNotification({ type: 'shop', message: '¡Compra realizada con éxito!' });
      return true;
  };

  const toggleInventoryItem = async (itemId: string) => {
      if (!user) return;
      if (user.inventory?.includes(itemId)) await updateDoc(doc(db, 'users', user.id), { inventory: arrayRemove(itemId) });
      else await updateDoc(doc(db, 'users', user.id), { inventory: arrayUnion(itemId) });
  }

  const completeLevelUpChallenge = async (level: number, reward: number) => {
      if (!user) return;
      await updateDoc(doc(db, 'users', user.id), { credits: increment(reward), level: Math.max(user.level, level) });
      setNotification({ type: 'level', message: `¡Nivel ${level} Alcanzado! +${reward} Créditos` });
  };

  const clearNotification = () => setNotification(null);
  const closeMilestoneModal = () => setMilestoneEvent(null);

  const value: any = {
    user, allUsers, movies, userRatings, news, feedbackList, activeEvent, eventMessages, mailbox,
    currentView, selectedMovieId, selectedPersonId, initialProfileTab,
    tmdbToken, notification, milestoneEvent, automationStatus,
    liveSession, topCriticId, activePrivateChat,
    activeTriviaMatch, inviteToTrivia, updateTriviaMatchState, endTriviaMatchLocal, handleTriviaWin, saveTriviaHighScore,
    setView, login, register, logout, resetPassword, refreshUser,
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
