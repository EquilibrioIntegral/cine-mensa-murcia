

import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import { searchMoviesTMDB, TMDBMovieResult, getImageUrl } from '../services/tmdbService';
import { ViewState } from '../types';

const MovieSearch: React.FC = () => {
  const { tmdbToken, setView } = useData();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TMDBMovieResult[]>([]);
  const [loading, setLoading] = useState(false);
  const searchTimeout = useRef<number | null>(null);

  useEffect(() => {
    if (!query.trim()) {
        setResults([]);
        return;
    }

    if (searchTimeout.current) window.clearTimeout(searchTimeout.current);

    searchTimeout.current = window.setTimeout(async () => {
        setLoading(true);
        try {
            const data = await searchMoviesTMDB(query, tmdbToken);
            setResults(data.slice(0, 6)); // Limit to 6 results
        } catch (err: any) {
            // Sanitized logging to prevent circular JSON error
            console.error("Error en búsqueda:", String(err));
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, 500); // 500ms debounce

    return () => {
        if (searchTimeout.current) window.clearTimeout(searchTimeout.current);
    };
  }, [query, tmdbToken]);

  const handleSelect = (tmdbId: number) => {
      setView(ViewState.MOVIE_DETAILS, `tmdb-${tmdbId}`);
      setQuery('');
      setResults([]);
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto z-40">
      <div className="relative">
        <input
            type="text"
            placeholder={tmdbToken ? "Buscar película para añadir..." : "Configura el Token TMDB en Admin para buscar"}
            value={query}
            disabled={!tmdbToken}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-cine-gray border border-gray-700 text-white pl-12 pr-4 py-4 rounded-full focus:outline-none focus:border-cine-gold shadow-lg text-lg placeholder-gray-500 disabled:opacity-50"
        />
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={24} />
        {loading && <Loader2 className="absolute right-4 top-1/2 transform -translate-y-1/2 text-cine-gold animate-spin" size={24} />}
      </div>

      {results.length > 0 && (
          <div className="absolute w-full mt-2 bg-cine-gray border border-gray-700 rounded-xl overflow-hidden shadow-2xl z-50">
              {results.map(movie => (
                  <div 
                    key={movie.id}
                    onClick={() => handleSelect(movie.id)}
                    className="flex items-center gap-4 p-3 hover:bg-white/10 cursor-pointer border-b border-gray-800 last:border-0 transition-colors"
                  >
                      <img 
                        src={getImageUrl(movie.poster_path, 'w200')} 
                        alt={movie.title} 
                        className="w-12 h-16 object-cover rounded bg-gray-800"
                      />
                      <div>
                          <h4 className="font-bold text-white text-lg">{movie.title}</h4>
                          <p className="text-sm text-gray-400">{movie.release_date ? movie.release_date.split('-')[0] : 'N/A'}</p>
                      </div>
                  </div>
              ))}
          </div>
      )}
    </div>
  );
};

export default MovieSearch;
