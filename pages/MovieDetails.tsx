
import React, { useEffect, useState } from 'react';
import { useData } from '../context/DataContext';
import { getMovieDetailsTMDB, TMDBMovieDetails, getImageUrl, TMDBProvider } from '../services/tmdbService';
import { ArrowLeft, Star, Check, PlayCircle, MonitorPlay, ShoppingBag, Banknote, Bookmark, Eye, BookmarkCheck, EyeOff, AlertTriangle, ExternalLink, ThumbsUp, ThumbsDown, MessageSquare, Lock, Clapperboard, Phone, Pencil, PlusCircle, Users } from 'lucide-react';
import { ViewState, DetailedRating, UserRating, User } from '../types';
import RatingModal from '../components/RatingModal';
import QuizModal from '../components/QuizModal';
import RankBadge from '../components/RankBadge';

// Subcomponent for individual reviews to handle spoiler toggle state
interface ReviewItemProps {
  review: UserRating;
  reviewer?: User;
  currentUser: User | null;
  isWatched: boolean;
  toggleReviewVote: (targetUserId: string, movieId: string, voteType: 'like' | 'dislike') => void;
  onEdit?: () => void;
}

const ReviewItem: React.FC<ReviewItemProps> = ({ review, reviewer, currentUser, isWatched, toggleReviewVote, onEdit }) => {
  const [showSpoiler, setShowSpoiler] = useState(false);

  const isLiked = currentUser && review.likes?.includes(currentUser.id);
  const isDisliked = currentUser && review.dislikes?.includes(currentUser.id);
  const isMyReview = currentUser?.id === review.userId;

  return (
    <div className="p-4 border-b border-gray-800 last:border-0 hover:bg-white/5 transition-colors group">
        <div className="flex items-center gap-3 mb-2">
            <img src={reviewer?.avatarUrl || 'https://via.placeholder.com/32'} alt="Avatar" className="w-10 h-10 rounded-full border border-gray-700" />
            <div className="flex-grow">
                <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white leading-none">{reviewer?.name || 'Usuario desconocido'}</p>
                    {reviewer && <RankBadge level={reviewer.level || 1} size="sm" />}
                    
                    {isMyReview && (
                        <span className="ml-2 text-[10px] bg-cine-gold/20 text-cine-gold px-2 py-0.5 rounded font-bold uppercase">Yo</span>
                    )}
                </div>
                <p className="text-xs text-gray-500 mt-1">{new Date(review.timestamp).toLocaleDateString()}</p>
            </div>
            
            <div className="flex items-center gap-3">
                {isMyReview && onEdit && (
                    <button 
                        onClick={onEdit}
                        className="text-gray-400 hover:text-cine-gold p-1.5 rounded-full hover:bg-white/10 transition-colors"
                        title="Editar mi reseña y puntuación"
                    >
                        <Pencil size={14} />
                    </button>
                )}
                <div className="bg-black/40 px-2 py-1 rounded text-cine-gold font-bold text-sm border border-cine-gold/20">
                    {review.rating.toFixed(1)}
                </div>
            </div>
        </div>
        
        {/* Normal Comment */}
        {review.comment && (
            <p className="text-gray-300 text-sm mb-3 leading-relaxed">"{review.comment}"</p>
        )}

        {/* Spoiler Section */}
        {review.spoiler && (
            <div className="mb-3">
                {!isWatched ? (
                    <div className="bg-black/50 border border-gray-700 p-2 rounded flex items-center gap-2 text-gray-500 select-none cursor-not-allowed filter blur-[0.5px]">
                        <Lock size={14} /> 
                        <span className="text-xs">Spoiler protegido. Marca la película como vista para leerlo.</span>
                    </div>
                ) : (
                    <>
                        {!showSpoiler ? (
                            <button 
                                onClick={() => setShowSpoiler(true)}
                                className="w-full py-2 bg-red-900/20 border border-red-900/50 rounded flex items-center justify-center gap-2 text-red-400 hover:bg-red-900/30 transition-colors text-xs font-bold uppercase tracking-wide"
                            >
                                <EyeOff size={14} /> Esta reseña contiene spoilers. Pulsa para ver.
                            </button>
                        ) : (
                            <div className="bg-red-900/10 border border-red-900/30 p-3 rounded text-sm text-red-200 animate-fade-in">
                                <div className="flex justify-between items-center mb-2 border-b border-red-900/30 pb-1">
                                    <p className="font-bold text-red-500 text-xs uppercase flex items-center gap-1"><EyeOff size={12}/> Zona de Spoilers</p>
                                    <button onClick={() => setShowSpoiler(false)} className="text-red-400 hover:text-white text-xs underline">Ocultar</button>
                                </div>
                                <p className="leading-relaxed whitespace-pre-wrap">{review.spoiler}</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        )}
        
        {/* Likes/Dislikes */}
        <div className="flex items-center gap-4">
            <button 
                onClick={() => toggleReviewVote(review.userId, review.movieId, 'like')}
                disabled={isMyReview}
                className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${
                    isMyReview 
                        ? 'opacity-30 cursor-not-allowed text-gray-500' 
                        : isLiked ? 'text-green-500' : 'text-gray-500 hover:text-green-400'
                }`}
                title={isMyReview ? "No puedes votar tu propia reseña" : "Me gusta"}
            >
                <ThumbsUp size={14} fill={isLiked ? "currentColor" : "none"} />
                {review.likes?.length || 0}
            </button>
            <button 
                onClick={() => toggleReviewVote(review.userId, review.movieId, 'dislike')}
                disabled={isMyReview}
                className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${
                    isMyReview 
                        ? 'opacity-30 cursor-not-allowed text-gray-500' 
                        : isDisliked ? 'text-red-500' : 'text-gray-500 hover:text-red-400'
                }`}
                title={isMyReview ? "No puedes votar tu propia reseña" : "No me gusta"}
            >
                <ThumbsDown size={14} fill={isDisliked ? "currentColor" : "none"} />
                {review.dislikes?.length || 0}
            </button>
        </div>
    </div>
  );
};

// --- HELPER COMPONENT FOR CREW MEMBERS ---
interface CrewMemberProps {
    person: { name: string, profile_path: string | null, id: number };
    role: string;
    onClick: () => void;
}

const CrewMember: React.FC<CrewMemberProps> = ({ person, role, onClick }) => (
    <div 
        className="flex items-center gap-3 mb-2 cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-colors group"
        onClick={onClick}
    >
        <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 overflow-hidden flex-shrink-0 group-hover:border-cine-gold transition-colors">
            {person.profile_path ? (
                <img src={getImageUrl(person.profile_path, 'w200')} alt={person.name} className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 text-[10px] font-bold">
                    {person.name.charAt(0)}
                </div>
            )}
        </div>
        <div>
            <p className="text-sm font-bold text-gray-200 leading-none group-hover:text-cine-gold transition-colors">{person.name}</p>
            <p className="text-[10px] text-gray-500 uppercase">{role}</p>
        </div>
    </div>
);

const MovieDetails: React.FC = () => {
  const { selectedMovieId, tmdbToken, addMovie, movies, setView, user, toggleWatchlist, rateMovie, unwatchMovie, userRatings, allUsers, toggleReviewVote, liveSession } = useData();
  const [details, setDetails] = useState<TMDBMovieDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInDb, setIsInDb] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  
  // States for confirmation modal
  const [showUnwatchConfirm, setShowUnwatchConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<'unwatch' | 'watchlist' | null>(null);

  // Helper to convert internal Movie type to TMDBMovieDetails type for display
  const mapInternalMovieToDetails = (movie: any): TMDBMovieDetails => {
      return {
          id: movie.tmdbId || 0,
          title: movie.title,
          release_date: movie.year ? `${movie.year}-01-01` : 'N/A',
          poster_path: movie.posterUrl,
          backdrop_path: movie.backdropUrl || movie.posterUrl,
          overview: movie.description,
          genres: movie.genre?.map((g: string) => ({ id: 0, name: g })) || [],
          credits: {
              crew: movie.director ? [{ job: 'Director', name: movie.director, profile_path: null, id: 0 }] : [],
              cast: movie.cast?.map((name: string) => ({ name: name, character: '', profile_path: null, id: 0 })) || []
          },
          videos: { results: [] },
          vote_average: movie.rating || 0,
          images: { backdrops: [], posters: [] }
      };
  }

  useEffect(() => {
    const fetchDetails = async () => {
        if (!selectedMovieId) return;
        setLoading(true);
        let fetchedDetails: TMDBMovieDetails | null = null;
        let isLocal = false;

        // 1. Try to fetch from TMDB if it looks like a TMDB ID
        if (selectedMovieId.startsWith('tmdb-')) {
            const id = parseInt(selectedMovieId.replace('tmdb-', ''));
            // Check if already in our DB first to save API calls or for offline consistency
            const existing = movies.find(m => m.tmdbId === id);
            
            // Try to fetch fresh data from TMDB
            const freshDetails = await getMovieDetailsTMDB(id, tmdbToken);
            
            if (freshDetails) {
                fetchedDetails = freshDetails;
                isLocal = !!existing;
            } else if (existing) {
                // FALLBACK TO INTERNAL DATA IF TMDB FAILS
                fetchedDetails = mapInternalMovieToDetails(existing);
                isLocal = true;
            }
        } else {
            // It's an internal ID (legacy or just internal UUID)
            const existing = movies.find(m => m.id === selectedMovieId);
            if (existing) {
                if (existing.tmdbId) {
                    fetchedDetails = await getMovieDetailsTMDB(existing.tmdbId, tmdbToken);
                }
                // If TMDB fetch failed or no tmdbId, construct from internal data
                if (!fetchedDetails) {
                    fetchedDetails = mapInternalMovieToDetails(existing);
                }
                isLocal = true;
            }
        }

        setDetails(fetchedDetails);
        setIsInDb(isLocal);
        setLoading(false);
    };

    fetchDetails();
  }, [selectedMovieId, tmdbToken, movies]);

  const handleRatingSubmit = (rating: DetailedRating, comment: string, spoiler?: string) => {
      if (!details) return;
      
      let movieId = selectedMovieId || '';
      
      // If NOT in DB, we must add it first
      if (!isInDb) {
          movieId = `tmdb-${details.id}`; // Standardized ID
          const newMovie = {
              id: movieId, // Create internal ID
              tmdbId: details.id,
              title: details.title,
              year: parseInt(details.release_date.split('-')[0]) || 0,
              director: details.credits.crew.find(c => c.job === 'Director')?.name || 'Unknown',
              genre: details.genres.map(g => g.name),
              posterUrl: getImageUrl(details.poster_path),
              backdropUrl: getImageUrl(details.backdrop_path, 'original'),
              description: details.overview,
              cast: details.credits.cast.slice(0, 5).map(c => c.name),
              rating: 0, 
              totalVotes: 0
          };
          addMovie(newMovie);
          setIsInDb(true);
      } else {
          // If in DB, find the internal ID if selectedMovieId was tmdb-xxx
          if (selectedMovieId?.startsWith('tmdb-')) {
              const existing = movies.find(m => m.tmdbId === details.id);
              if (existing) movieId = existing.id;
          }
      }

      // Now rate
      rateMovie(movieId, rating, comment, spoiler);
  };

  const executeUnwatchLogic = () => {
    if (!isInDb) return;
    let movieId = selectedMovieId || '';
    if (selectedMovieId?.startsWith('tmdb-')) {
        const existing = movies.find(m => m.tmdbId === details?.id);
        if (existing) movieId = existing.id;
    }
    
    // 1. Remove rating/watched status
    unwatchMovie(movieId);

    // 2. If the pending action was adding to watchlist, do it now
    if (pendingAction === 'watchlist') {
        toggleWatchlist(movieId);
    }

    // Reset UI state
    setShowUnwatchConfirm(false);
    setPendingAction(null);
  };

  const handleUnwatchClick = () => {
      if (isWatched) {
         setPendingAction('unwatch');
         setShowUnwatchConfirm(true);
      } else if (isWatchlisted) {
         handleToggleWatchlistDirect();
      } else {
         // Already unwatched, do nothing
      }
  };

  const handleWatchlistClick = () => {
      if (!details) return;

      // Resolve ID logic
      let movieId = selectedMovieId || '';
      if (!isInDb) {
           handleToggleWatchlistDirect(); 
           return;
      } else if (selectedMovieId?.startsWith('tmdb-')) {
           const existing = movies.find(m => m.tmdbId === details.id);
           if (existing) movieId = existing.id;
      }

      const isWatched = user?.watchedMovies.includes(movieId);

      if (isWatched) {
          setPendingAction('watchlist');
          setShowUnwatchConfirm(true);
      } else {
          handleToggleWatchlistDirect();
      }
  };

  const handleToggleWatchlistDirect = () => {
      if (!details) return;
      
      let movieId = selectedMovieId || '';
      if (!isInDb) {
          movieId = `tmdb-${details.id}`; // Standardized ID
          const newMovie = {
              id: movieId,
              tmdbId: details.id,
              title: details.title,
              year: parseInt(details.release_date.split('-')[0]) || 0,
              director: details.credits.crew.find(c => c.job === 'Director')?.name || 'Unknown',
              genre: details.genres.map(g => g.name),
              posterUrl: getImageUrl(details.poster_path),
              backdropUrl: getImageUrl(details.backdrop_path, 'original'),
              description: details.overview,
              cast: details.credits.cast.slice(0, 5).map(c => c.name),
              rating: 0, 
              totalVotes: 0
          };
          addMovie(newMovie);
          setIsInDb(true);
      } else if (selectedMovieId?.startsWith('tmdb-')) {
           const existing = movies.find(m => m.tmdbId === details.id);
           if (existing) movieId = existing.id;
      }
      
      toggleWatchlist(movieId);
  };

  const handleWatchedClick = () => {
      // Whether first time or editing, we open the rating modal.
      // If it's the first time, we might trigger the quiz if configured, but for editing we skip to modal.
      if (isWatched) {
          setShowRatingModal(true);
      } else {
          // First time watching -> SECURITY QUIZ
          setShowQuizModal(true);
      }
  };

  const handleQuizPassed = () => {
      setShowQuizModal(false);
      setShowRatingModal(true);
  };

  const handlePersonClick = (id: number) => {
      if (id && id > 0) setView(ViewState.PERSON_DETAILS, id);
  }

  if (loading) return <div className="flex justify-center items-center h-[50vh]"><div className="animate-spin text-cine-gold">Cargando...</div></div>;
  if (!details) return <div className="text-center p-10">Película no encontrada</div>;

  // Extract Technical Crew (Objects instead of strings for profile_path)
  const directors = details.credits?.crew?.filter(c => c.job === 'Director') || [];
  const writers = details.credits?.crew?.filter(c => ['Screenplay', 'Writer', 'Story', 'Screenstory'].includes(c.job)).slice(0, 2) || []; 
  const music = details.credits?.crew?.filter(c => ['Original Music Composer', 'Music'].includes(c.job)).slice(0, 1) || [];
  const photography = details.credits?.crew?.filter(c => ['Director of Photography', 'Cinematography'].includes(c.job)).slice(0, 1) || [];

  // Filter unique crew members
  const uniqueWriters = Array.from(new Map(writers.map(item => [item.name, item])).values()) as typeof writers;

  // Trailer Logic
  const trailer = details.videos?.results?.find(v => v.site === "YouTube" && v.type === "Trailer" && v.iso_639_1 === "es") 
               || details.videos?.results?.find(v => v.site === "YouTube" && v.type === "Trailer"); 

  const providers = details['watch/providers']?.results?.ES;

  // Resolve current status
  const currentInternalId = isInDb ? movies.find(m => m.tmdbId === details.id)?.id : null;
  const isWatchlisted = currentInternalId ? user?.watchlist.includes(currentInternalId) : false;
  const isWatched = currentInternalId ? user?.watchedMovies.includes(currentInternalId) : false;
  const userRating = currentInternalId ? userRatings.find(r => r.movieId === currentInternalId && r.userId === user?.id) : null;
  
  // Get all reviews for this movie that have content OR spoilers
  const movieReviews = currentInternalId ? userRatings.filter(r => r.movieId === currentInternalId && ( (r.comment && r.comment.length > 0) || (r.spoiler && r.spoiler.length > 0) )) : [];
  
  // SORT REVIEWS BY NET LIKES (Gamification requirement)
  const sortedReviews = [...movieReviews].sort((a, b) => {
      const scoreA = (a.likes?.length || 0) - (a.dislikes?.length || 0);
      const scoreB = (b.likes?.length || 0) - (b.dislikes?.length || 0);
      return scoreB - scoreA; // Descending
  });
  
  // Status Logic: 3 mutually exclusive states visualy
  const status = isWatched ? 'watched' : isWatchlisted ? 'watchlist' : 'unwatched';

  const ProviderList = ({ title, items, icon: Icon }: { title: string, items?: TMDBProvider[], icon: any }) => {
    if (!items || items.length === 0) return null;
    return (
        <div className="mb-4">
            <h4 className="text-sm font-bold text-gray-400 mb-2 flex items-center gap-2"><Icon size={14}/> {title}</h4>
            <div className="flex flex-wrap gap-3">
                {items.map(p => (
                    <div key={p.provider_id} title={p.provider_name} className="bg-white p-1 rounded-lg w-12 h-12 flex items-center justify-center overflow-hidden">
                        <img src={getImageUrl(p.logo_path, 'w200')} alt={p.provider_name} className="w-full h-full object-contain" />
                    </div>
                ))}
            </div>
        </div>
    );
  };

  return (
    <div className="min-h-screen bg-cine-dark pb-20 relative">
      {/* FLOATING RETURN TO CALL BUTTON */}
      {liveSession.isConnected && (
          <button 
            onClick={() => setView(ViewState.RECOMMENDATIONS)}
            className="fixed bottom-24 right-6 z-[60] bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-full shadow-[0_0_20px_rgba(22,163,74,0.5)] flex items-center gap-2 animate-bounce transition-all"
          >
              <Phone size={20} className="animate-pulse"/> 
              En llamada...
          </button>
      )}

      <RatingModal 
        isOpen={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        movieTitle={details.title}
        onSubmit={handleRatingSubmit}
        initialRating={userRating?.detailed}
        initialComment={userRating?.comment}
        initialSpoiler={userRating?.spoiler}
      />

      <QuizModal
        isOpen={showQuizModal}
        onClose={() => setShowQuizModal(false)}
        movieTitle={details.title}
        onSuccess={handleQuizPassed}
      />

      {/* Confirmation Modal */}
      {showUnwatchConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-cine-gray max-w-md w-full rounded-xl border border-red-900 shadow-2xl p-6">
                <div className="flex items-center gap-3 text-red-500 mb-4">
                    <AlertTriangle size={32} />
                    <h3 className="text-xl font-bold">¿Estás seguro?</h3>
                </div>
                <p className="text-gray-300 mb-6">
                    Si marcas esta película como "No vista" o "Pendiente", <strong>se eliminará tu valoración ({userRating?.rating}) y tu reseña</strong> permanentemente.
                </p>
                <div className="flex gap-4 justify-end">
                    <button 
                        onClick={() => setShowUnwatchConfirm(false)}
                        className="px-4 py-2 rounded text-gray-400 hover:text-white font-bold"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={executeUnwatchLogic}
                        className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded font-bold transition-colors"
                    >
                        Sí, eliminar valoración
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Hero Backdrop - Mobile Optimized */}
      <div className="relative h-auto min-h-[60vh] md:h-[60vh] w-full flex flex-col justify-end">
          <div className="absolute inset-0 bg-gradient-to-t from-cine-dark via-cine-dark/60 to-transparent z-10"></div>
          <img 
            src={getImageUrl(details.backdrop_path, 'original')} 
            alt={details.title} 
            className="absolute inset-0 w-full h-full object-cover opacity-60 z-0"
          />
          <button 
            onClick={() => setView(ViewState.DASHBOARD)}
            className="absolute top-4 left-4 z-30 bg-black/50 p-2 rounded-full hover:bg-cine-gold hover:text-black transition-colors text-white"
          >
              <ArrowLeft size={24} />
          </button>

          <div className="relative z-20 container mx-auto p-4 md:p-6 flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-end mt-20 md:mt-0">
              {/* Poster: Visible on mobile now, properly sized */}
              <img 
                src={getImageUrl(details.poster_path)} 
                alt="Poster" 
                className="w-40 md:w-48 rounded-lg shadow-2xl border-2 border-gray-800 self-center md:self-auto"
              />
              
              <div className="w-full text-center md:text-left mb-4">
                  <h1 className="text-3xl md:text-6xl font-bold text-white mb-2 drop-shadow-lg leading-tight">{details.title}</h1>
                  
                  {/* Metadata: Centered on mobile, left on desktop */}
                  <div className="flex flex-wrap justify-center md:justify-start items-center gap-3 text-gray-300 text-sm md:text-base mb-6">
                      <span className="bg-cine-gold text-black px-2 py-1 rounded font-bold">{details.release_date.split('-')[0]}</span>
                      {isInDb && movies.find(m => m.tmdbId === details.id)?.totalVotes! > 0 && (
                           <span className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded"><Star size={16} className="text-cine-gold" /> Club: {movies.find(m => m.tmdbId === details.id)?.rating.toFixed(1)}</span>
                      )}
                      {details.vote_average > 0 && (
                          <span className="flex items-center gap-1"><Star size={16} className="text-gray-500" /> {details.vote_average.toFixed(1)} (TMDB)</span>
                      )}
                      <span>{details.genres.slice(0, 3).map(g => g.name).join(', ')}</span>
                  </div>
                  
                  {/* Action Buttons Group - Stacked on mobile */}
                  <div className="flex flex-col sm:flex-row flex-wrap gap-2 md:gap-4 p-2 bg-black/40 rounded-xl border border-gray-800 backdrop-blur-sm w-full md:w-auto md:inline-flex">
                      
                      {/* Button 1: NO VISTA (Default if nothing else) */}
                      <button 
                        onClick={handleUnwatchClick}
                        disabled={status === 'unwatched'}
                        className={`
                            flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold transition-all border w-full sm:w-auto
                            ${status === 'unwatched' 
                                ? 'bg-cine-gray text-white border-red-900/50 shadow-[0_0_15px_rgba(153,27,27,0.3)]' 
                                : 'bg-transparent text-gray-400 border-transparent hover:bg-white/5'}
                        `}
                      >
                         <EyeOff size={18} className={status === 'unwatched' ? 'text-red-500' : ''} />
                         No vista
                      </button>

                      {/* Button 2: PENDIENTE (Watchlist) */}
                      <button 
                        onClick={handleWatchlistClick}
                        className={`
                            flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold transition-all border w-full sm:w-auto
                            ${status === 'watchlist' 
                                ? 'bg-cine-gray text-white border-cine-gold shadow-[0_0_15px_rgba(212,175,55,0.3)]' 
                                : 'bg-transparent text-gray-400 border-transparent hover:bg-white/5'}
                        `}
                      >
                         {status === 'watchlist' ? <BookmarkCheck size={18} className="text-cine-gold"/> : <Bookmark size={18} />}
                         Quiero verla
                      </button>

                      {/* Button 3: VISTA (Watched) */}
                      <button 
                        onClick={handleWatchedClick}
                        className={`
                            flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold transition-all border w-full sm:w-auto
                            ${status === 'watched' 
                                ? 'bg-green-900/30 text-white border-green-600 shadow-[0_0_15px_rgba(22,163,74,0.3)]' 
                                : 'bg-transparent text-gray-400 border-transparent hover:bg-white/5'}
                        `}
                      >
                          {status === 'watched' ? <Check size={18} className="text-green-500"/> : <Eye size={18} />}
                          {status === 'watched' ? `Vista (Nota: ${userRating?.rating.toFixed(1)})` : 'Ya la he visto'}
                      </button>

                  </div>
              </div>
          </div>
      </div>

      <div className="container mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="md:col-span-2 space-y-8">
              
              {/* Detailed Rating Visualization if User Rated */}
              {userRating && userRating.detailed && (
                  <section className="bg-gradient-to-r from-cine-gray to-black border border-gray-800 p-6 rounded-xl animate-fade-in relative group">
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                            onClick={() => setShowRatingModal(true)}
                            className="text-gray-400 hover:text-cine-gold flex items-center gap-1 text-sm bg-black/50 px-2 py-1 rounded"
                         >
                            <Pencil size={12}/> Editar mis notas
                         </button>
                      </div>
                      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                          <Star className="text-cine-gold" fill="currentColor" /> Tu Valoración Detallada
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {Object.entries(userRating.detailed).map(([key, val]) => {
                              if (key === 'average') return null;
                              const labels: any = { script: 'Guion', direction: 'Dirección', photography: 'Fotografía', acting: 'Actuación', soundtrack: 'Banda Sonora', enjoyment: 'Disfrute' };
                              const numericVal = val as number;
                              return (
                                  <div key={key} className="bg-black/30 p-3 rounded border border-gray-800">
                                      <p className="text-gray-400 text-xs uppercase font-bold">{labels[key]}</p>
                                      <p className={`text-xl font-bold ${numericVal >= 8 ? 'text-cine-gold' : 'text-white'}`}>{numericVal}</p>
                                  </div>
                              )
                          })}
                      </div>
                  </section>
              )}

              <section>
                  <h3 className="text-2xl font-bold text-white mb-4 border-l-4 border-cine-gold pl-3">Sinopsis</h3>
                  <p className="text-gray-300 leading-relaxed text-lg">{details.overview || "No hay sinopsis disponible."}</p>
              </section>

              {/* CAST SECTION (VISUAL) */}
              {details.credits?.cast?.length > 0 && (
                  <section>
                      <h3 className="text-2xl font-bold text-white mb-4 border-l-4 border-cine-gold pl-3 flex items-center gap-2">
                          <Users size={24}/> Reparto Principal
                      </h3>
                      <div className="flex overflow-x-auto pb-6 gap-4 custom-scrollbar">
                          {details.credits.cast.slice(0, 12).map(actor => (
                              <div 
                                key={actor.id} 
                                onClick={() => handlePersonClick(actor.id)}
                                className="flex-shrink-0 w-32 group cursor-pointer"
                              >
                                  <div className="w-32 h-44 rounded-lg overflow-hidden border border-gray-800 bg-gray-900 shadow-md relative group-hover:border-cine-gold transition-colors">
                                      {actor.profile_path ? (
                                          <img 
                                            src={getImageUrl(actor.profile_path, 'w200')} 
                                            alt={actor.name} 
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                                          />
                                      ) : (
                                          <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 bg-gray-800">
                                              <Users size={32}/>
                                          </div>
                                      )}
                                  </div>
                                  <p className="text-white font-bold text-sm mt-2 leading-tight group-hover:text-cine-gold transition-colors">{actor.name}</p>
                                  <p className="text-gray-500 text-xs italic">{actor.character}</p>
                              </div>
                          ))}
                      </div>
                  </section>
              )}

              {/* Watch Providers */}
              {providers && (
                  <section>
                      <h3 className="text-2xl font-bold text-white mb-4 border-l-4 border-cine-gold pl-3">Dónde ver</h3>
                      <div className="bg-cine-gray p-4 rounded-xl border border-gray-800">
                          <ProviderList title="Streaming" items={providers.flatrate} icon={MonitorPlay} />
                          <ProviderList title="Alquiler" items={providers.rent} icon={ShoppingBag} />
                          <ProviderList title="Compra" items={providers.buy} icon={Banknote} />
                          {!providers.flatrate && !providers.rent && !providers.buy && (
                              <p className="text-gray-500 text-sm">No hay información de streaming en España disponible en este momento.</p>
                          )}
                          <div className="mt-2 text-xs text-gray-600 flex justify-end">
                              Datos de JustWatch
                          </div>
                      </div>
                  </section>
              )}

              {/* Trailer Button Only */}
              {trailer && (
                  <section>
                       <h3 className="text-2xl font-bold text-white mb-4 border-l-4 border-cine-gold pl-3">Tráiler</h3>
                       <a 
                          href={`https://www.youtube.com/watch?v=${trailer.key}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="w-full bg-red-700 hover:bg-red-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-colors shadow-lg group"
                       >
                           <PlayCircle size={32} className="group-hover:scale-110 transition-transform" />
                           Ver Tráiler Oficial en YouTube
                           <ExternalLink size={16} className="opacity-50" />
                       </a>
                  </section>
              )}
          </div>

          {/* Sidebar / Extra Info */}
          <div className="space-y-8">
               
               {/* Technical Team (Visual Sidebar) */}
               <div className="bg-cine-gray p-6 rounded-xl border border-gray-800">
                   <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                       <Clapperboard size={18} className="text-cine-gold"/> Ficha Técnica
                   </h3>
                   <div className="space-y-4">
                        {directors.length > 0 && (
                            <div>
                                <span className="block text-xs text-gray-500 uppercase font-bold mb-2">Dirección</span>
                                {directors.map(d => <CrewMember key={d.name} person={d} role="Director" onClick={() => handlePersonClick(d.id)} />)}
                            </div>
                        )}
                        
                        {uniqueWriters.length > 0 && (
                            <div>
                                <span className="block text-xs text-gray-500 uppercase font-bold mb-2">Guion</span>
                                {uniqueWriters.map(w => <CrewMember key={w.name} person={w} role="Guionista" onClick={() => handlePersonClick(w.id)} />)}
                            </div>
                        )}

                        {music.length > 0 && (
                            <div>
                                <span className="block text-xs text-gray-500 uppercase font-bold mb-2">Música</span>
                                {music.map(m => <CrewMember key={m.name} person={m} role="Compositor" onClick={() => handlePersonClick(m.id)} />)}
                            </div>
                        )}

                        {photography.length > 0 && (
                            <div>
                                <span className="block text-xs text-gray-500 uppercase font-bold mb-2">Fotografía</span>
                                {photography.map(p => <CrewMember key={p.name} person={p} role="Director de Fotografía" onClick={() => handlePersonClick(p.id)} />)}
                            </div>
                        )}
                   </div>
               </div>

               {/* Reviews Section */}
               <div className="bg-cine-gray rounded-xl border border-gray-800 overflow-hidden">
                   <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-black/20">
                       <h3 className="font-bold text-white flex items-center gap-2">
                           <MessageSquare className="text-cine-gold" size={18} /> Reseñas ({sortedReviews.length})
                       </h3>
                   </div>
                   <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                       
                       {/* MISSING REVIEW CTA - Specific request: If I rated but have no review */}
                       {userRating && (!userRating.comment && !userRating.spoiler) && (
                           <div className="p-4 bg-cine-gold/10 border-b border-cine-gold/20 flex flex-col items-center text-center">
                               <p className="text-sm font-bold text-white mb-2">¡Has votado pero no has opinado!</p>
                               <p className="text-xs text-gray-400 mb-3">Tu nota está guardada, pero la comunidad quiere leer tu reseña (o tus spoilers).</p>
                               <button 
                                   onClick={() => setShowRatingModal(true)}
                                   className="bg-cine-gold text-black px-4 py-2 rounded-lg font-bold text-sm hover:bg-white transition-colors flex items-center gap-2 w-full justify-center shadow-lg"
                               >
                                   <PlusCircle size={16}/> Añadir Reseña / Spoiler
                               </button>
                           </div>
                       )}

                       {sortedReviews.length === 0 ? (
                           <div className="p-8 text-center text-gray-500">
                               <p className="italic">Sé el primero en dejar una reseña escrita.</p>
                           </div>
                       ) : (
                           <div>
                               {sortedReviews.map(review => (
                                   <ReviewItem 
                                      key={review.userId}
                                      review={review}
                                      reviewer={allUsers.find(u => u.id === review.userId)}
                                      currentUser={user}
                                      isWatched={isWatched}
                                      toggleReviewVote={toggleReviewVote}
                                      onEdit={review.userId === user?.id ? () => setShowRatingModal(true) : undefined}
                                   />
                               ))}
                           </div>
                       )}
                   </div>
               </div>
          </div>
      </div>
    </div>
  );
};

export default MovieDetails;
