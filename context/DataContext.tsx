
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Movie, User, UserRating, ViewState, DetailedRating, CineEvent, EventPhase, EventMessage, AppFeedback, NewsItem } from '../types';
import { auth, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
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
  limit
} from "firebase/firestore";

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
  setTmdbToken: (token: string) => Promise<void>;
  login: (email: string, name: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  register: (email: string, name: string, password: string, avatarUrl?: string) => Promise<{ success: boolean; message: string }>;
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
  
  // Event Methods
  createEvent: (eventData: Partial<CineEvent>) => Promise<void>;
  closeEvent: (eventId: string) => Promise<void>;
  voteForCandidate: (eventId: string, tmdbId: number) => Promise<void>;
  transitionEventPhase: (eventId: string, phase: EventPhase, winnerId?: number) => Promise<void>;
  sendEventMessage: (eventId: string, text: string, role?: 'user' | 'moderator') => Promise<void>;

  // News & Feedback
  sendFeedback: (type: 'bug' | 'feature', text: string) => Promise<void>;
  resolveFeedback: (feedbackId: string, response?: string) => Promise<void>;
  publishNews: (title: string, content: string, type: 'general' | 'update' | 'event', imageUrl?: string) => Promise<void>;
  deleteFeedback: (id: string) => Promise<void>;
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
  
  // Event State
  const [activeEvent, setActiveEvent] = useState<CineEvent | null>(null);
  const [eventMessages, setEventMessages] = useState<EventMessage[]>([]);

  // News & Feedback
  const [news, setNews] = useState<NewsItem[]>([]);
  const [feedbackList, setFeedbackList] = useState<AppFeedback[]>([]);

  // 1. Listen for Auth Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch user details from Firestore
        try {
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists()) {
              const userData = userDoc.data() as User;
              
              if (userData.status === 'active' || userData.isAdmin) {
                setUser(userData);
                // Default view is now NEWS
                setCurrentView(ViewState.NEWS);
              } else {
                setUser(null);
                setCurrentView(ViewState.LOGIN);
              }
            } else {
                setUser(null);
            }
        } catch (e: any) {
            console.error("Error fetching user profile:", String(e));
            setUser(null);
        }
      } else {
        setUser(null);
        setCurrentView(ViewState.LOGIN);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Listen for Collections (Realtime Updates)
  useEffect(() => {
    if (!user?.id) return;

    const safeSnapshotError = (err: any) => console.log("Snapshot error:", String(err));

    // Users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setAllUsers(snapshot.docs.map(doc => doc.data() as User));
      
      if (auth.currentUser) {
          const me = snapshot.docs.find(d => d.id === auth.currentUser?.uid)?.data() as User;
          if (me && (me.status === 'active' || me.isAdmin)) {
              setUser(me);
          }
      }
    }, safeSnapshotError);

    // Movies
    const unsubMovies = onSnapshot(collection(db, 'movies'), (snapshot) => {
      setMovies(snapshot.docs.map(doc => doc.data() as Movie));
    }, safeSnapshotError);

    // Ratings
    const unsubRatings = onSnapshot(collection(db, 'ratings'), (snapshot) => {
      setUserRatings(snapshot.docs.map(doc => doc.data() as UserRating));
    }, safeSnapshotError);

    // Config (TMDB Token)
    const unsubConfig = onSnapshot(doc(db, 'settings', 'tmdb'), (doc) => {
      if (doc.exists()) {
        setTmdbTokenState(doc.data().token || '');
      }
    }, safeSnapshotError);

    // Events
    const eventsQuery = query(collection(db, 'events'), orderBy('startDate', 'desc'));
    const unsubEvents = onSnapshot(eventsQuery, (snapshot) => {
        if (!snapshot.empty) {
            const evt = snapshot.docs[0].data() as CineEvent;
            if (evt.phase !== 'closed') {
                setActiveEvent(evt);
            } else {
                setActiveEvent(null);
            }
        } else {
            setActiveEvent(null);
        }
    }, safeSnapshotError);

    // News
    const newsQuery = query(collection(db, 'news'), orderBy('timestamp', 'desc'), limit(20));
    const unsubNews = onSnapshot(newsQuery, (snapshot) => {
        setNews(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NewsItem)));
    }, safeSnapshotError);

    // Feedback (Only active needed for users, all for admin)
    const feedbackQuery = query(collection(db, 'feedback'), orderBy('timestamp', 'desc'));
    const unsubFeedback = onSnapshot(feedbackQuery, (snapshot) => {
        setFeedbackList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppFeedback)));
    }, safeSnapshotError);

    return () => {
      unsubUsers();
      unsubMovies();
      unsubRatings();
      unsubConfig();
      unsubEvents();
      unsubNews();
      unsubFeedback();
    };
  }, [user?.id]);

  // 3. Listen for Event Chat (Subcollection)
  useEffect(() => {
      if (!user?.id || !activeEvent || activeEvent.phase !== 'discussion') {
          setEventMessages([]);
          return;
      }

      const msgsQuery = query(collection(db, 'events', activeEvent.id, 'chat'), orderBy('timestamp', 'asc'));
      const unsubChat = onSnapshot(msgsQuery, (snapshot) => {
          setEventMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EventMessage)));
      }, (e) => console.log("Chat error", String(e)));

      return () => unsubChat();

  }, [user?.id, activeEvent?.id, activeEvent?.phase]);


  const isAdminEmail = (email: string) => {
    return email.toLowerCase().startsWith('andresroblesjimenez');
  };

  const login = async (email: string, passwordInput: string) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, passwordInput);
        const uid = userCredential.user.uid;
        const userDoc = await getDoc(doc(db, 'users', uid));
        
        if (!userDoc.exists()) {
             const isAdmin = isAdminEmail(email);
             const newUser: User = {
                id: uid,
                email,
                name: email.split('@')[0],
                avatarUrl: `https://picsum.photos/seed/${email}/100/100`,
                watchedMovies: [],
                watchlist: [],
                status: isAdmin ? 'active' : 'pending',
                isAdmin: isAdmin
             };
             await setDoc(doc(db, 'users', uid), newUser);
             return { success: true, message: "Cuenta restaurada." };
        }

        const userData = userDoc.data() as User;
        if (userData.status === 'pending') {
            return { success: false, message: "Tu cuenta está pendiente de aprobación." };
        }
        if (userData.status === 'rejected') {
            return { success: false, message: "Acceso denegado." };
        }
        return { success: true, message: "Bienvenido" };

    } catch (error: any) {
        if (error.code === 'auth/invalid-credential') return { success: false, message: "Credenciales incorrectas." };
        return { success: false, message: String(error.message) };
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setCurrentView(ViewState.LOGIN);
  };

  const register = async (email: string, name: string, passwordInput: string, avatarUrl?: string) => {
    try {
      const isAdmin = isAdminEmail(email);
      const userCredential = await createUserWithEmailAndPassword(auth, email, passwordInput);
      const newUser: User = {
        id: userCredential.user.uid,
        email,
        name,
        avatarUrl: avatarUrl || `https://ui-avatars.com/api/?name=${name}&background=d4af37&color=000`,
        watchedMovies: [],
        watchlist: [],
        status: isAdmin ? 'active' : 'pending',
        isAdmin: isAdmin
      };

      await setDoc(doc(db, 'users', newUser.id), newUser);
      return { success: true, message: isAdmin ? "Bienvenido Admin" : "Registro exitoso. Espera aprobación." };

    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') return { success: false, message: "Email ya registrado." };
      return { success: false, message: String(error.message) };
    }
  };

  const updateUserProfile = async (name: string, avatarUrl: string) => {
      if (!user) return;
      try {
          await updateDoc(doc(db, 'users', user.id), { name, avatarUrl });
      } catch (e) { console.error(String(e)); }
  };

  const approveUser = async (userId: string) => {
    try { await updateDoc(doc(db, 'users', userId), { status: 'active' }); } catch (e) { console.error(String(e)); }
  };

  const rejectUser = async (userId: string) => {
    try { await updateDoc(doc(db, 'users', userId), { status: 'rejected' }); } catch (e) { console.error(String(e)); }
  };

  const setView = (view: ViewState, movieId?: string) => {
    setCurrentView(view);
    if (movieId) setSelectedMovieId(movieId);
  };

  const rateMovie = async (movieId: string, rating: DetailedRating, comment?: string, spoiler?: string) => {
    if (!user) return;
    try {
        const ratingId = `${user.id}_${movieId}`;
        const newRating: UserRating = {
          movieId, userId: user.id, detailed: rating, rating: rating.average,
          comment, spoiler, timestamp: Date.now(),
          likes: [], dislikes: []
        };
        await setDoc(doc(db, 'ratings', ratingId), newRating);

        if (!user.watchedMovies.includes(movieId)) {
          await updateDoc(doc(db, 'users', user.id), {
              watchedMovies: arrayUnion(movieId),
              watchlist: arrayRemove(movieId) 
          });
        }
        // Update average
        const allRatings = userRatings.filter(r => r.movieId === movieId && r.userId !== user.id).concat(newRating);
        const avg = allRatings.reduce((acc, r) => acc + r.rating, 0) / allRatings.length;
        await updateDoc(doc(db, 'movies', movieId), { rating: parseFloat(avg.toFixed(1)), totalVotes: allRatings.length });
    } catch (e) { console.error(String(e)); }
  };

  const unwatchMovie = async (movieId: string) => {
      if (!user) return;
      try {
          const ratingId = `${user.id}_${movieId}`;
          await deleteDoc(doc(db, 'ratings', ratingId));
          await updateDoc(doc(db, 'users', user.id), { watchedMovies: arrayRemove(movieId) });
          // Recalc average
          const remaining = userRatings.filter(r => r.movieId === movieId && r.userId !== user.id);
          const avg = remaining.length > 0 ? remaining.reduce((acc, r) => acc + r.rating, 0) / remaining.length : 0;
          await updateDoc(doc(db, 'movies', movieId), { rating: parseFloat(avg.toFixed(1)), totalVotes: remaining.length });
      } catch (e) { console.error(String(e)); }
  };

  const toggleWatchlist = async (movieId: string) => {
    if (!user) return;
    try {
        if (user.watchedMovies.includes(movieId)) {
            await unwatchMovie(movieId);
            await updateDoc(doc(db, 'users', user.id), { watchlist: arrayUnion(movieId) });
            return;
        }
        if (user.watchlist.includes(movieId)) {
            await updateDoc(doc(db, 'users', user.id), { watchlist: arrayRemove(movieId) });
        } else {
            await updateDoc(doc(db, 'users', user.id), { watchlist: arrayUnion(movieId) });
        }
    } catch (e) { console.error(String(e)); }
  };

  const toggleReviewVote = async (targetUserId: string, movieId: string, voteType: 'like' | 'dislike') => {
    if (!user || targetUserId === user.id) return;
    try {
        const ratingId = `${targetUserId}_${movieId}`;
        const ratingRef = doc(db, 'ratings', ratingId);
        const snap = await getDoc(ratingRef);
        if (!snap.exists()) return;
        
        const data = snap.data() as UserRating;
        const likes = data.likes || [];
        const dislikes = data.dislikes || [];
        const hasLiked = likes.includes(user.id);
        const hasDisliked = dislikes.includes(user.id);
        
        let updates: any = {};
        if (voteType === 'like') {
            if (hasLiked) updates['likes'] = arrayRemove(user.id);
            else { updates['likes'] = arrayUnion(user.id); if (hasDisliked) updates['dislikes'] = arrayRemove(user.id); }
        } else {
            if (hasDisliked) updates['dislikes'] = arrayRemove(user.id);
            else { updates['dislikes'] = arrayUnion(user.id); if (hasLiked) updates['likes'] = arrayRemove(user.id); }
        }
        await updateDoc(ratingRef, updates);
    } catch (e) { console.error(String(e)); }
  };

  const addMovie = async (movie: Movie) => {
      try {
          const docRef = doc(db, 'movies', movie.id);
          const docSnap = await getDoc(docRef);
          if (!docSnap.exists()) {
              await setDoc(docRef, movie);
          }
      } catch (e) { console.error(String(e)); }
  };

  const setTmdbToken = async (token: string) => {
      try { await setDoc(doc(db, 'settings', 'tmdb'), { token }); } catch (e) { console.error(String(e)); }
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
              votingDeadline: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days from now
              viewingDeadline: Date.now() + (14 * 24 * 60 * 60 * 1000), // 14 days from now
              backdropUrl: eventData.backdropUrl
          };
          await setDoc(doc(db, 'events', newEvent.id), newEvent);
          
      } catch (e) { console.error(String(e)); }
  };

  const closeEvent = async (eventId: string) => {
      if (!user?.isAdmin) return;
      try {
          setActiveEvent(null); // Optimistic UI update
          await updateDoc(doc(db, 'events', eventId), { phase: 'closed' });
      } catch (e) { console.error(String(e)); }
  };

  const voteForCandidate = async (eventId: string, tmdbId: number) => {
      if (!user) return;
      try {
          const eventRef = doc(db, 'events', eventId);
          const evtSnap = await getDoc(eventRef);
          if (!evtSnap.exists()) return;
          const evt = evtSnap.data() as CineEvent;
          
          const updatedCandidates = evt.candidates.map(c => ({
              ...c, votes: c.votes.filter(uid => uid !== user.id)
          }));
          const target = updatedCandidates.find(c => c.tmdbId === tmdbId);
          if (target) target.votes.push(user.id);
          
          await updateDoc(eventRef, { candidates: updatedCandidates });
      } catch (e) { console.error(String(e)); }
  };

  const transitionEventPhase = async (eventId: string, phase: EventPhase, winnerId?: number) => {
      if (!user?.isAdmin) return;
      try {
          const updates: any = { phase };
          if (winnerId) updates.winnerTmdbId = winnerId;
          await updateDoc(doc(db, 'events', eventId), updates);
      } catch (e) { console.error(String(e)); }
  };

  const sendEventMessage = async (eventId: string, text: string, role: 'user' | 'moderator' = 'user') => {
      if (!user) return;
      try {
          const msg: Omit<EventMessage, 'id'> = {
              userId: user.id,
              userName: role === 'moderator' ? 'IA Moderadora' : user.name,
              userAvatar: role === 'moderator' ? 'https://ui-avatars.com/api/?name=AI&background=d4af37&color=000' : user.avatarUrl,
              text, timestamp: Date.now(), role
          };
          await addDoc(collection(db, 'events', eventId, 'chat'), msg);
      } catch (e) { console.error(String(e)); }
  };

  // --- NEWS & FEEDBACK ---
  const sendFeedback = async (type: 'bug' | 'feature', text: string) => {
      if (!user) return;
      try {
          const fb: Omit<AppFeedback, 'id'> = {
              userId: user.id, userName: user.name, type, text, status: 'pending', timestamp: Date.now()
          };
          await addDoc(collection(db, 'feedback'), fb);
      } catch (e) { console.error(String(e)); }
  };

  const deleteFeedback = async (id: string) => {
      if (!user?.isAdmin) return;
      try { await deleteDoc(doc(db, 'feedback', id)); } catch (e) { console.error(String(e)); }
  };

  const resolveFeedback = async (feedbackId: string, response?: string) => {
      if (!user?.isAdmin) return;
      try {
          const fbRef = doc(db, 'feedback', feedbackId);
          await updateDoc(fbRef, { status: 'solved', adminResponse: response || 'Gracias por tu aporte.' });
          
          // Auto publish news
          const fbDoc = await getDoc(fbRef);
          const fbData = fbDoc.data() as AppFeedback;
          const title = fbData.type === 'bug' ? '🐛 Bug Corregido' : '✨ Nueva Mejora';
          await publishNews(title, `Se ha solucionado: "${fbData.text}". ¡Gracias ${fbData.userName}!`, 'update');
      } catch (e) { console.error(String(e)); }
  };

  const publishNews = async (title: string, content: string, type: 'general' | 'update' | 'event', imageUrl?: string) => {
      if (!user?.isAdmin) return;
      try {
          const newsItem: Omit<NewsItem, 'id'> = { 
            title, 
            content, 
            type, 
            timestamp: Date.now(),
            ...(imageUrl && { imageUrl }) 
          };
          await addDoc(collection(db, 'news'), newsItem);
      } catch (e) { console.error(String(e)); }
  };

  const getMovie = (id: string) => movies.find(m => m.id === id);

  return (
    <DataContext.Provider value={{
      user, allUsers, movies, userRatings, activeEvent, eventMessages, news, feedbackList, currentView, selectedMovieId, tmdbToken,
      setTmdbToken, login, logout, register, updateUserProfile, approveUser, rejectUser, setView, rateMovie, unwatchMovie, toggleWatchlist, toggleReviewVote, addMovie, getMovie,
      createEvent, closeEvent, voteForCandidate, transitionEventPhase, sendEventMessage,
      sendFeedback, resolveFeedback, publishNews, deleteFeedback
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
