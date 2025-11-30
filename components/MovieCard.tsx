import React from 'react';
import { Movie, ViewState } from '../types';
import StarRating from './StarRating';
import { useData } from '../context/DataContext';
import { Bookmark, BookmarkCheck, PlayCircle, Sparkles } from 'lucide-react';

interface MovieCardProps {
  movie: Movie;
  showRatingInput?: boolean;
}

const MovieCard: React.FC<MovieCardProps> = ({ movie, showRatingInput = false }) => {
  const { user, toggleWatchlist, setView, userRatings } = useData();
  
  const inWatchlist = user?.watchlist.includes(movie.id);
  const userRating = userRatings.find(r => r.movieId === movie.id && r.userId === user?.id);
  const isRecommendation = !!movie.recommendationReason;

  const handleCardClick = () => {
      // Navigate to details via ViewState. 
      // If it's a raw recommendation (tmdb-id), the detail page handles it.
      setView(ViewState.MOVIE_DETAILS, movie.id);
  };

  return (
    <div 
        onClick={handleCardClick}
        className={`bg-cine-gray rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 group flex flex-col h-full cursor-pointer ${isRecommendation ? 'border border-cine-gold shadow-cine-gold/10' : 'border border-gray-800'}`}
    >
      <div className="relative aspect-[2/3] overflow-hidden">
        <img 
          src={movie.posterUrl} 
          alt={movie.title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-cine-dark via-transparent to-transparent opacity-60"></div>
        
        {/* Actions Overlay */}
        <div className="absolute top-2 right-2 flex gap-2">
            <button 
                onClick={(e) => { e.stopPropagation(); toggleWatchlist(movie.id); }}
                className={`p-2 rounded-full backdrop-blur-md ${inWatchlist ? 'bg-cine-gold text-black' : 'bg-black/50 text-white'} hover:bg-cine-gold hover:text-black transition-colors`}
                title={inWatchlist ? "Quitar de lista" : "Añadir a lista"}
            >
                {inWatchlist ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
            </button>
        </div>

        <div className="absolute bottom-0 left-0 p-4 w-full">
            <h3 className="text-xl font-bold text-white leading-tight drop-shadow-md">{movie.title}</h3>
            <p className="text-gray-300 text-sm mt-1">{movie.year} • {movie.director}</p>
        </div>
      </div>

      <div className="p-4 flex flex-col flex-grow justify-between">
        <div>
            <div className="flex flex-wrap gap-2 mb-3">
                {movie.genre.map(g => (
                    <span key={g} className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300 border border-gray-700">
                        {g}
                    </span>
                ))}
            </div>
            
            {/* Show AI Reason if present, else description */}
            {isRecommendation ? (
                <div className="bg-cine-gold/10 p-3 rounded-lg border border-cine-gold/20 mb-3">
                    <p className="text-cine-gold text-xs font-bold mb-1 flex items-center gap-1"><Sparkles size={12}/> Por qué te gustará:</p>
                    <p className="text-gray-300 text-sm italic leading-snug">"{movie.recommendationReason}"</p>
                </div>
            ) : (
                <p className="text-gray-400 text-sm line-clamp-3 mb-4">{movie.description}</p>
            )}
        </div>

        <div className="mt-auto border-t border-gray-800 pt-3">
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Nota Media</span>
                <div className="flex items-center gap-1">
                    <span className="text-cine-gold font-bold text-lg">{movie.rating > 0 ? movie.rating.toFixed(1) : '-'}</span>
                    <span className="text-xs text-gray-500">({movie.totalVotes})</span>
                </div>
            </div>
            
            {showRatingInput && userRating && (
                <div className="flex items-center justify-between bg-black/20 p-2 rounded-lg">
                    <span className="text-xs text-gray-400">Tu nota:</span>
                    <span className="font-bold text-cine-gold">{userRating.rating.toFixed(1)}</span>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default MovieCard;