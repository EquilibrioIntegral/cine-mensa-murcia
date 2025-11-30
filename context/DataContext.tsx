import React, { createContext, useContext, useState, useEffect } from 'react';
import { Movie, User, UserRating, ViewState, DetailedRating, CineEvent, EventPhase, EventMessage } from '../types';
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
  addDoc
} from "firebase/firestore";

interface DataContextType {
  user: User | null;
  allUsers: User[]; 
  movies: Movie[];
  userRatings: UserRating[];
  activeEvent: CineEvent | null;
  eventMessages: EventMessage[];
  currentView: ViewState;
  selectedMovieId: string | null;
  tmdbToken: string;
  setTmdbToken: (token: string) => Promise<void>;
  login: (email: string, name: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  register: (email: string, name: string, password: string) => Promise<{ success: boolean; message: string }>;
  approveUser: (userId: string) => void;
  rejectUser: (userId: string) => void;
  setView: (view: ViewState, movieId?: string) => void;
  rateMovie: (movieId: string, rating: DetailedRating, comment?: string, spoiler?: string) => void;
  unwatchMovie: (movieId: string) => Promise<void>;
  toggleWatchlist: (movieId: string) => void;
  toggleReviewVote: (targetUserId: string, movieId: string, voteType: 'like' | 'dislike') => void;
  addMovie: (movie: Movie) => void;
  getMovie: (id: string) => Movie | undefined;
  
  // Event Methods
  createEvent: (eventData: Partial<CineEvent>) => Promise<void>;
  closeEvent: (eventId: string) => Promise<void>;
  voteForCandidate: (eventId: string, tmdbId: number) => Promise<void>;
  transitionEventPhase: (eventId: string, phase: EventPhase, winnerId?: number) => Promise<void>;
  sendEventMessage: (eventId: string, text: string, role?: 'user' | 'moderator') => Promise<void>;
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
                setCurrentView(ViewState.DASHBOARD);
              } else {
                setUser(null);
                setCurrentView(ViewState.LOGIN);
              }
            } else {
                // User created in Auth but not yet in Firestore (race condition in registration) or deleted
                setUser(null);
            }
        } catch (e: any) {
            // Sanitized log
            console.error("Error fetching user profile:", e?.message || "Unknown error");
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
      const usersList = snapshot.docs.map(doc => doc.data() as User);
      setAllUsers(usersList);
      
      if (auth.currentUser) {
          const me = usersList.find(u => u.id === auth.currentUser?.uid);
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

    // Events (Only active one needed usually, but lets fetch latest)
    // We assume there is only one "active" event document or we query for it
    const eventsQuery = query(collection(db, 'events'), orderBy('startDate', 'desc'));
    const unsubEvents = onSnapshot(eventsQuery, (snapshot) => {
        if (!snapshot.empty) {
            // Pick the most recent
            const evt = snapshot.docs[0].data() as CineEvent;
            // Only set if it's not closed
            if (evt.phase !== 'closed') {
                setActiveEvent(evt);
            } else {
                // If the most recent event is closed, ensure UI reflects null
                setActiveEvent(null);
            }
        } else {
            setActiveEvent(null);
        }
    }, safeSnapshotError);

    return () => {
      unsubUsers();
      unsubMovies();
      unsubRatings();
      unsubConfig();
      unsubEvents();
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
        
        // Auto-healing: If auth exists but DB doc missing
        if (!userDoc.exists()) {
             const isAdmin = isAdminEmail(email);
             const newUser: User = {
                id: uid,
                email,
                name: email.split('@')[0], // Fallback name
                avatarUrl: `https://picsum.photos/seed/${email}/100/100`,
                watchedMovies: [],
                watchlist: [],
                status: isAdmin ? 'active' : 'pending',
                isAdmin: isAdmin
             };
             await setDoc(doc(db, 'users', uid), newUser);
             return { success: true, message: "Cuenta restaurada. Bienvenido." };
        }

        const userData = userDoc.data() as User;
        if (userData.status === 'pending') {
            return { success: false, message: "Tu cuenta está pendiente de aprobación por el administrador." };
        }
        if (userData.status === 'rejected') {
            return { success: false, message: "Tu solicitud de acceso ha sido denegada." };
        }
        return { success: true, message: "Bienvenido" };

    } catch (error: any) {
        console.log("Login error code:", String(error.code || error.message));
        
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
             return { success: false, message: "Contraseña incorrecta o usuario no encontrado." };
        }
        if (error.code === 'permission-denied') {
             return { success: false, message: "Error de permisos. Contacta al admin para revisar las reglas de Firebase." };
        }
        return { success: false, message: error.message || "Error desconocido" };
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setCurrentView(ViewState.LOGIN);
  };

  const register = async (email: string, name: string, passwordInput: string) => {
    try {
      const isAdmin = isAdminEmail(email);
      const userCredential = await createUserWithEmailAndPassword(auth, email, passwordInput);
      const newUser: User = {
        id: userCredential.user.uid,
        email,
        name,
        avatarUrl: `https://picsum.photos/seed/${email}/100/100`,
        watchedMovies: [],
        watchlist: [],
        status: isAdmin ? 'active' : 'pending',
        isAdmin: isAdmin
      };

      await setDoc(doc(db, 'users', newUser.id), newUser);
      
      if (isAdmin) {
          return { success: true, message: "¡Bienvenido Administrador!" };
      }
      return { success: true, message: "Registro exitoso. Espera a que el administrador apruebe tu cuenta." };

    } catch (error: any) {
      console.log("Register error:", String(error));
      if (error.code === 'auth/email-already-in-use') {
          return { success: false, message: "Este email ya está registrado. Intenta iniciar sesión." };
      }
      return { success: false, message: error.message || "Error desconocido" };
    }
  };

  const approveUser = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { status: 'active' });
    } catch (e) {
      console.error("Error approving user:", String(e));
    }
  };

  const rejectUser = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { status: 'rejected' });
    } catch (e) {
      console.error("Error rejecting user:", String(e));
    }
  };

  const setView = (view: ViewState, movieId?: string) => {
    setCurrentView(view);
    if (movieId) setSelectedMovieId(movieId);
  };

  const rateMovie = async (movieId: string, rating: DetailedRating, comment?: string, spoiler?: string) => {
    if (!user) return;
    
    try {
        const ratingId = `${user.id}_${movieId}`;
        const ratingRef = doc(db, 'ratings', ratingId);
        
        const existingDoc = await getDoc(ratingRef);
        let currentLikes: string[] = [];
        let currentDislikes: string[] = [];
        
        if (existingDoc.exists()) {
            const data = existingDoc.data() as UserRating;
            currentLikes = data.likes || [];
            currentDislikes = data.dislikes || [];
        }

        const newRating: UserRating = {
          movieId,
          userId: user.id,
          detailed: rating,
          rating: rating.average,
          comment,
          spoiler, 
          timestamp: Date.now(),
          likes: currentLikes,
          dislikes: currentDislikes
        };

        await setDoc(ratingRef, newRating);

        if (!user.watchedMovies.includes(movieId)) {
          await updateDoc(doc(db, 'users', user.id), {
              watchedMovies: arrayUnion(movieId),
              watchlist: arrayRemove(movieId) 
          });
        }

        const allRatingsForMovie = userRatings.filter(r => r.movieId === movieId && r.userId !== user.id).concat(newRating);
        const avg = allRatingsForMovie.reduce((acc, r) => acc + r.rating, 0) / allRatingsForMovie.length;
        
        await updateDoc(doc(db, 'movies', movieId), {
            rating: parseFloat(avg.toFixed(1)),
            totalVotes: allRatingsForMovie.length
        });
    } catch (e) {
        console.error("Error rating movie:", String(e));
    }
  };

  const unwatchMovie = async (movieId: string) => {
      if (!user) return;
      
      try {
          const ratingId = `${user.id}_${movieId}`;
          await deleteDoc(doc(db, 'ratings', ratingId));

          await updateDoc(doc(db, 'users', user.id), {
              watchedMovies: arrayRemove(movieId)
          });

          const remainingRatings = userRatings.filter(r => r.movieId === movieId && r.userId !== user.id);
          const avg = remainingRatings.length > 0 
              ? remainingRatings.reduce((acc, r) => acc + r.rating, 0) / remainingRatings.length
              : 0;
          
          await updateDoc(doc(db, 'movies', movieId), {
              rating: parseFloat(avg.toFixed(1)),
              totalVotes: remainingRatings.length
          });
      } catch (e) {
          console.error("Error unwatching movie:", String(e));
      }
  };

  const toggleWatchlist = async (movieId: string) => {
    if (!user) return;
    
    try {
        if (user.watchedMovies.includes(movieId)) {
            await unwatchMovie(movieId);
            await updateDoc(doc(db, 'users', user.id), {
                watchlist: arrayUnion(movieId)
            });
            return;
        }

        if (user.watchlist.includes(movieId)) {
            await updateDoc(doc(db, 'users', user.id), {
                watchlist: arrayRemove(movieId)
            });
        } else {
            await updateDoc(doc(db, 'users', user.id), {
                watchlist: arrayUnion(movieId)
            });
        }
    } catch (e) {
        console.error("Error toggling watchlist:", String(e));
    }
  };

  const toggleReviewVote = async (targetUserId: string, movieId: string, voteType: 'like' | 'dislike') => {
    if (!user) return;
    if (targetUserId === user.id) return;

    try {
        const ratingId = `${targetUserId}_${movieId}`;
        const ratingRef = doc(db, 'ratings', ratingId);
        
        const docSnap = await getDoc(ratingRef);
        if (!docSnap.exists()) return;

        const data = docSnap.data() as UserRating;
        const likes = data.likes || [];
        const dislikes = data.dislikes || [];
        
        const hasLiked = likes.includes(user.id);
        const hasDisliked = dislikes.includes(user.id);

        let updates: any = {};

        if (voteType === 'like') {
            if (hasLiked) {
                updates['likes'] = arrayRemove(user.id); 
            } else {
                updates['likes'] = arrayUnion(user.id);
                if (hasDisliked) updates['dislikes'] = arrayRemove(user.id); 
            }
        } else {
            if (hasDisliked) {
                updates['dislikes'] = arrayRemove(user.id); 
            } else {
                updates['dislikes'] = arrayUnion(user.id);
                if (hasLiked) updates['likes'] = arrayRemove(user.id); 
            }
        }

        await updateDoc(ratingRef, updates);
    } catch (e) {
        console.error("Error toggling vote:", String(e));
    }
  };

  const addMovie = async (movie: Movie) => {
      try {
          const docRef = doc(db, 'movies', movie.id);
          const docSnap = await getDoc(docRef);
          if (!docSnap.exists()) {
              await setDoc(docRef, movie);
          }
      } catch (e) {
          console.error("Error adding movie:", String(e));
      }
  };

  const setTmdbToken = async (token: string) => {
      try {
          await setDoc(doc(db, 'settings', 'tmdb'), { token });
      } catch (e) {
          console.error("Error saving token:", String(e));
          throw e; 
      }
  };

  // --- EVENT METHODS ---
  const createEvent = async (eventData: Partial<CineEvent>) => {
      if (!user?.isAdmin) return;
      try {
          // Close any previous event first (cleanup)
          // For now, we assume one active.
          
          const newEvent: CineEvent = {
              id: Date.now().toString(),
              themeTitle: eventData.themeTitle || 'Evento',
              themeDescription: eventData.themeDescription || '',
              aiReasoning: eventData.aiReasoning || '',
              candidates: eventData.candidates || [],
              phase: 'voting',
              startDate: Date.now(),
              votingDeadline: Date.now() + (7 * 24 * 60 * 60 * 1000), // 1 week
              viewingDeadline: Date.now() + (14 * 24 * 60 * 60 * 1000), // 2 weeks
              backdropUrl: eventData.backdropUrl
          };

          await setDoc(doc(db, 'events', newEvent.id), newEvent);
      } catch (e) {
          console.error("Create event error:", String(e));
      }
  };

  const closeEvent = async (eventId: string) => {
      if (!user?.isAdmin) return;
      try {
          // Immediately hide it locally to give feedback (Optimistic Update)
          setActiveEvent(null);
          await updateDoc(doc(db, 'events', eventId), { phase: 'closed' });
      } catch (e) {
          console.error("Close event error:", String(e));
      }
  };

  const voteForCandidate = async (eventId: string, tmdbId: number) => {
      if (!user) return;
      try {
          const eventRef = doc(db, 'events', eventId);
          const evtSnap = await getDoc(eventRef);
          if (!evtSnap.exists()) return;
          
          const evt = evtSnap.data() as CineEvent;
          
          // Remove user from any previous vote
          const updatedCandidates = evt.candidates.map(c => ({
              ...c,
              votes: c.votes.filter(uid => uid !== user.id)
          }));
          
          // Add to new
          const target = updatedCandidates.find(c => c.tmdbId === tmdbId);
          if (target) {
              target.votes.push(user.id);
          }
          
          await updateDoc(eventRef, { candidates: updatedCandidates });

      } catch (e) {
          console.error("Vote error:", String(e));
      }
  };

  const transitionEventPhase = async (eventId: string, phase: EventPhase, winnerId?: number) => {
      if (!user?.isAdmin) return;
      try {
          const updates: any = { phase };
          if (winnerId) updates.winnerTmdbId = winnerId;
          await updateDoc(doc(db, 'events', eventId), updates);
      } catch (e) {
          console.error("Transition error:", String(e));
      }
  };

  const sendEventMessage = async (eventId: string, text: string, role: 'user' | 'moderator' = 'user') => {
      if (!user) return;
      try {
          const msg: Omit<EventMessage, 'id'> = {
              userId: user.id,
              userName: role === 'moderator' ? 'IA Moderadora' : user.name,
              userAvatar: role === 'moderator' ? 'https://ui-avatars.com/api/?name=AI&background=d4af37&color=000' : user.avatarUrl,
              text,
              timestamp: Date.now(),
              role: role
          };
          await addDoc(collection(db, 'events', eventId, 'chat'), msg);
      } catch (e) {
          console.error("Chat send error:", String(e));
      }
  };

  const getMovie = (id: string) => movies.find(m => m.id === id);

  return (
    <DataContext.Provider value={{
      user,
      allUsers,
      movies,
      userRatings,
      activeEvent,
      eventMessages,
      currentView,
      selectedMovieId,
      tmdbToken,
      setTmdbToken,
      login,
      logout,
      register,
      approveUser,
      rejectUser,
      setView,
      rateMovie,
      unwatchMovie,
      toggleWatchlist,
      toggleReviewVote,
      addMovie,
      getMovie,
      createEvent,
      closeEvent,
      voteForCandidate,
      transitionEventPhase,
      sendEventMessage
    }}>
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