
import React, { useEffect, useState } from 'react';
import { useData } from '../context/DataContext';
import { getMovieDetailsTMDB, TMDBMovieDetails, getImageUrl, TMDBProvider } from '../services/tmdbService';
import { ArrowLeft, Star, Check, PlayCircle, MonitorPlay, ShoppingBag, Banknote, Bookmark, Eye, BookmarkCheck, EyeOff, AlertTriangle, ExternalLink, ThumbsUp, ThumbsDown, MessageSquare, Lock } from 'lucide-react';
import { ViewState, DetailedRating, UserRating, User } from '../types';
import RatingModal from '../components/RatingModal';
import QuizModal from '../components/QuizModal';

// Subcomponent for individual reviews to handle spoiler toggle state
interface ReviewItemProps {
  review: UserRating;
  reviewer?: User;
  currentUser: User | null;
  isWatched: boolean;
  toggleReviewVote: (targetUserId: string, movieId: string, voteType: 'like' | 'dislike') => void;
}

const ReviewItem: React.FC<ReviewItemProps> = ({ review, reviewer, currentUser, isWatched, toggleReviewVote }) => {
  const [showSpoiler, setShowSpoiler] = useState(false);

  const isLiked = currentUser && review.likes?.includes(currentUser.id);
  const isDisliked = currentUser && review.dislikes?.includes(currentUser.id);
  const isMyReview = currentUser?.id === review.userId;

  return (
    <div className="p-4 border-b border-gray-800 last:border-0 hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-3 mb-2">
            <img src={reviewer?.avatarUrl || 'https://via.placeholder.com/32'} alt="Avatar" className="w-8 h-8 rounded-full border border-gray-700" />
            <div>
                <p className="text-sm font-bold text-white leading-none">{reviewer?.name || 'Usuario desconocido'}</p>
                <p className="text-xs text-gray-500">{new Date(review.timestamp).toLocaleDateString()}</p>
            </div>
            <div className="ml-auto bg-black/40 px-2 py-1 rounded text-cine-gold font-bold text-sm border border-cine-gold/20">
                {review.rating.toFixed(1)}
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

const MovieDetails: React.FC = () => {
  const { selectedMovieId, tmdbToken, addMovie, movies, setView, user, toggleWatchlist, rateMovie, unwatchMovie, userRatings, allUsers, toggleReviewVote } = useData();
  const [details, setDetails] = useState<TMDBMovieDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInDb, setIsInDb] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  
  // States for confirmation modal
  const [showUnwatchConfirm, setShowUnwatchConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<'unwatch' | 'watchlist' | null>(null);

  useEffect(() => {
    const fetchDetails = async () => {
        setLoading(true);
        if (selectedMovieId?.startsWith('tmdb-')) {
            // It's a TMDB ID
            const id = parseInt(selectedMovieId.replace('tmdb-', ''));
            const data = await getMovieDetailsTMDB(id, tmdbToken);
            setDetails(data);
            
            // Check if already in our DB by TMDB ID
            const existing = movies.find(m => m.tmdbId === id);
            if (existing) {
                setIsInDb(true);
            } else {
                setIsInDb(false);
            }
        } else if (selectedMovieId) {
            // Internal ID (navigated from Dashboard/Ranking)
            const existing = movies.find(m => m.id === selectedMovieId);
            if (existing && existing.tmdbId) {
                const data = await getMovieDetailsTMDB(existing.tmdbId, tmdbToken);
                setDetails(data);
                setIsInDb(true);
            } else if (existing) {
                // Should not happen with new structure but fallback
                setIsInDb(true);
            }
        }
        setLoading(false);
    };

    fetchDetails();
  }, [selectedMovieId, tmdbToken, movies]);

  const handleRatingSubmit = (rating: DetailedRating, comment: string, spoiler?: string) => {
      if (!details) return;
      
      let movieId = selectedMovieId || '';
      
      // If NOT in DB, we must add it first
      if (!isInDb) {
          movieId = `m-${details.id}`;
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
          movieId = `m-${details.id}`;
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
      if (isWatched) {
          // Already watched, just open edit modal
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

  if (loading) return <div className="flex justify-center items-center h-[50vh]"><div className="animate-spin text-cine-gold">Cargando...</div></div>;
  if (!details) return <div className="text-center p-10">Película no encontrada</div>;

  const director = details.credits.crew.find(c => c.job === 'Director')?.name;

  // Trailer Logic
  const trailer = details.videos?.results.find(v => v.site === "YouTube" && v.type === "Trailer" && v.iso_639_1 === "es") 
               || details.videos?.results.find(v => v.site === "YouTube" && v.type === "Trailer"); 

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
    <div className="min-h-screen bg-cine-dark pb-20">
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

      {/* Hero Backdrop */}
      <div className="relative h-[60vh] w-full">
          <div className="absolute inset-0 bg-gradient-to-t from-cine-dark via-cine-dark/60 to-transparent z-10"></div>
          <img 
            src={getImageUrl(details.backdrop_path, 'original')} 
            alt={details.title} 
            className="w-full h-full object-cover opacity-60"
          />
          <button 
            onClick={() => setView(ViewState.DASHBOARD)}
            className="absolute top-4 left-4 z-20 bg-black/50 p-2 rounded-full hover:bg-cine-gold hover:text-black transition-colors text-white"
          >
              <ArrowLeft size={24} />
          </button>

          <div className="absolute bottom-0 left-0 w-full p-6 z-20 container mx-auto flex flex-col md:flex-row gap-8 items-end">
              <img 
                src={getImageUrl(details.poster_path)} 
                alt="Poster" 
                className="w-48 rounded-lg shadow-2xl border-2 border-gray-800 hidden md:block"
              />
              <div className="mb-4 w-full">
                  <h1 className="text-4xl md:text-6xl font-bold text-white mb-2 drop-shadow-lg">{details.title}</h1>
                  <div className="flex flex-wrap items-center gap-4 text-gray-300 text-sm md:text-base mb-6">
                      <span className="bg-cine-gold text-black px-2 py-1 rounded font-bold">{details.release_date.split('-')[0]}</span>
                      {isInDb && movies.find(m => m.tmdbId === details.id)?.totalVotes! > 0 && (
                           <span className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded"><Star size={16} className="text-cine-gold" /> Nota Club: {movies.find(m => m.tmdbId === details.id)?.rating.toFixed(1)}</span>
                      )}
                      <span className="flex items-center gap-1"><Star size={16} className="text-gray-500" /> {details.vote_average.toFixed(1)} (TMDB)</span>
                      <span>{details.genres.map(g => g.name).join(', ')}</span>
                  </div>
                  
                  {/* Action Buttons Group */}
                  <div className="flex flex-wrap gap-2 md:gap-4 p-2 bg-black/40 rounded-xl border border-gray-800 backdrop-blur-sm inline-flex">
                      
                      {/* Button 1: NO VISTA (Default if nothing else) */}
                      <button 
                        onClick={handleUnwatchClick}
                        disabled={status === 'unwatched'}
                        className={`
                            flex items-center gap-2 px-4 py-3 rounded-lg font-bold transition-all border
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
                            flex items-center gap-2 px-4 py-3 rounded-lg font-bold transition-all border
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
                            flex items-center gap-2 px-4 py-3 rounded-lg font-bold transition-all border
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
                  <section className="bg-gradient-to-r from-cine-gray to-black border border-gray-800 p-6 rounded-xl animate-fade-in">
                      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                          <Star className="text-cine-gold" fill="currentColor" /> Tu Valoración Detallada
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {Object.entries(userRating.detailed).map(([key, val]) => {
                              if (key === 'average') return null;
                              const labels: any = { script: 'Guion', direction: 'Dirección', photography: 'Fotografía', acting: 'Actuación', soundtrack: 'BSO', enjoyment: 'Disfrute' };
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
                  <p className="text-gray-300 leading-relaxed text-lg">{details.overview}</p>
              </section>

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
               {/* Reviews Section */}
               <div className="bg-cine-gray rounded-xl border border-gray-800 overflow-hidden">
                   <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-black/20">
                       <h3 className="font-bold text-white flex items-center gap-2">
                           <MessageSquare className="text-cine-gold" size={18} /> Reseñas ({sortedReviews.length})
                       </h3>
                   </div>
                   <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
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
                                   />
                               ))}
                           </div>
                       )}
                   </div>
               </div>

               {/* Cast */}
               <div className="bg-cine-gray p-6 rounded-xl border border-gray-800">
                    <h3 className="text-lg font-bold text-white mb-4">Reparto Principal</h3>
                    <div className="flex flex-wrap gap-2">
                        {details.credits.cast.slice(0, 10).map(actor => (
                            <span key={actor.name} className="bg-black/40 px-3 py-1 rounded-full text-sm text-gray-300 border border-gray-700">
                                {actor.name} <span className="text-gray-500 text-xs">({actor.character})</span>
                            </span>
                        ))}
                    </div>
               </div>
          </div>
      </div>
    </div>
  );
};

export default MovieDetails;
