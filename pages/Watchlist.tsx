import React from 'react';
import { useData } from '../context/DataContext';
import MovieCard from '../components/MovieCard';
import { ListVideo } from 'lucide-react';

const Watchlist: React.FC = () => {
  const { user, movies } = useData();
  const watchlistMovies = movies.filter(m => user?.watchlist.includes(m.id));
  const watchedMovies = movies.filter(m => user?.watchedMovies.includes(m.id));

  return (
    <div className="container mx-auto px-4 py-8 pb-20">
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-6">
            <ListVideo className="text-cine-gold" size={32} />
            <h2 className="text-3xl font-bold text-white">Mi Lista de Pendientes</h2>
        </div>
        
        {watchlistMovies.length === 0 ? (
            <p className="text-gray-500 italic">No tienes películas pendientes. ¡Explora el catálogo o pide una recomendación!</p>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {watchlistMovies.map(movie => (
                    <MovieCard key={movie.id} movie={movie} showRatingInput={true} />
                ))}
            </div>
        )}
      </div>

      <div className="border-t border-gray-800 pt-8">
        <h3 className="text-2xl font-bold text-gray-400 mb-6">Ya Vistas ({watchedMovies.length})</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 opacity-80 hover:opacity-100 transition-opacity">
            {watchedMovies.map(movie => (
                <MovieCard key={movie.id} movie={movie} showRatingInput={true} />
            ))}
        </div>
      </div>
    </div>
  );
};

export default Watchlist;