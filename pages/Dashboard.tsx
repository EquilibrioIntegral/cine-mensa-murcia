
import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import MovieCard from '../components/MovieCard';
import MovieSearch from '../components/MovieSearch';
import { Filter, SortAsc, SortDesc, Calendar, Star, Type, Ticket, Medal, ArrowRight } from 'lucide-react';
import RankBadge from '../components/RankBadge';
import { ViewState } from '../types';

type SortOption = 'recent' | 'oldest' | 'rating' | 'alpha';

const Dashboard: React.FC = () => {
  const { movies, user, setView, setInitialProfileTab } = useData();
  const [filterGenre, setFilterGenre] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recent');

  // 1. Get all unique genres from the entire database for the filter dropdown
  const allGenres = useMemo(() => {
    const genres = new Set<string>();
    movies.forEach(m => m.genre.forEach(g => genres.add(g)));
    return Array.from(genres).sort();
  }, [movies]);

  // 2. Filter and Sort Logic
  const processedMovies = useMemo(() => {
      // Step A: Filter by "Has Votes" (Catalog only shows rated movies)
      let result = movies.filter(m => m.totalVotes > 0);

      // Step B: Filter by Genre
      if (filterGenre !== 'all') {
          result = result.filter(m => m.genre.includes(filterGenre));
      }

      // Step C: Sort
      return result.sort((a, b) => {
          switch (sortBy) {
              case 'recent':
                  return b.year - a.year;
              case 'oldest':
                  return a.year - b.year;
              case 'rating':
                  return b.rating - a.rating; // Highest rating first
              case 'alpha':
                  return a.title.localeCompare(b.title);
              default:
                  return 0;
          }
      });
  }, [movies, filterGenre, sortBy]);

  return (
    <div className="container mx-auto px-4 py-8 pb-20">
      
      {/* Header & Search */}
      <div className="flex flex-col items-center mb-10 gap-6">
        <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">Catálogo del Club</h2>
            <p className="text-gray-400">Explora las películas vistas y puntuadas por la comunidad</p>
        </div>
        
        <div className="w-full z-30">
            <MovieSearch />
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-cine-gray p-4 rounded-xl border border-gray-800 mb-8 flex flex-col md:flex-row gap-4 justify-between items-center sticky top-20 z-20 shadow-xl backdrop-blur-md bg-cine-gray/90">
          
          {/* Genre Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter size={18} className="text-cine-gold" />
              <select 
                value={filterGenre}
                onChange={(e) => setFilterGenre(e.target.value)}
                className="bg-black/50 border border-gray-600 text-white text-sm rounded-lg p-2.5 focus:border-cine-gold outline-none w-full md:w-48 cursor-pointer"
              >
                  <option value="all">Todos los géneros</option>
                  {allGenres.map(g => (
                      <option key={g} value={g}>{g}</option>
                  ))}
              </select>
          </div>

          {/* Sort Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 no-scrollbar">
              <span className="text-gray-500 text-sm whitespace-nowrap mr-2 hidden md:inline">Ordenar por:</span>
              
              <button 
                onClick={() => setSortBy('recent')}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${sortBy === 'recent' ? 'bg-cine-gold text-black' : 'bg-black/40 text-gray-400 hover:bg-black/60'}`}
              >
                  <Calendar size={14} /> Recientes
              </button>
              
              <button 
                onClick={() => setSortBy('oldest')}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${sortBy === 'oldest' ? 'bg-cine-gold text-black' : 'bg-black/40 text-gray-400 hover:bg-black/60'}`}
              >
                  <SortAsc size={14} /> Clásicas
              </button>
              
              <button 
                onClick={() => setSortBy('rating')}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${sortBy === 'rating' ? 'bg-cine-gold text-black' : 'bg-black/40 text-gray-400 hover:bg-black/60'}`}
              >
                  <Star size={14} /> Nota
              </button>

              <button 
                onClick={() => setSortBy('alpha')}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${sortBy === 'alpha' ? 'bg-cine-gold text-black' : 'bg-black/40 text-gray-400 hover:bg-black/60'}`}
              >
                  <Type size={14} /> A-Z
              </button>
          </div>
      </div>

      {/* Grid */}
      {processedMovies.length === 0 ? (
          <div className="text-center py-20 bg-cine-gray/30 rounded-xl border border-dashed border-gray-800">
              <p className="text-gray-500 text-lg italic">
                  No hay películas que coincidan con los filtros. <br/>
                  ¡Busca una arriba para añadirla!
              </p>
          </div>
      ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {processedMovies.map(movie => (
                  <MovieCard key={movie.id} movie={movie} showRatingInput={false} />
              ))}
          </div>
      )}
    </div>
  );
};

export default Dashboard;
