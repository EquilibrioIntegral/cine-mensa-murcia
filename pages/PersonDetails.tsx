import React, { useEffect, useState } from 'react';
import { useData } from '../context/DataContext';
import { getPersonDetails, getImageUrl, TMDBPersonDetails } from '../services/tmdbService';
import { ArrowLeft, MapPin, Calendar, Film, Star, Loader2 } from 'lucide-react';
import { ViewState, Movie } from '../types';
import MovieCard from '../components/MovieCard';

const PersonDetails: React.FC = () => {
  const { selectedPersonId, tmdbToken, setView } = useData();
  const [details, setDetails] = useState<TMDBPersonDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
        if (!selectedPersonId) return;
        setLoading(true);
        try {
            const data = await getPersonDetails(selectedPersonId, tmdbToken);
            setDetails(data);
        } catch(e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    fetchDetails();
  }, [selectedPersonId, tmdbToken]);

  if (loading) return <div className="flex justify-center items-center h-[50vh]"><Loader2 className="animate-spin text-cine-gold" size={48} /></div>;
  if (!details) return <div className="text-center p-10 text-gray-500">Persona no encontrada</div>;

  // Process credits to unique movies, sorted by popularity/vote count (approximated here by order or just map directly)
  // We need to map TMDB movies to our Movie interface for the card
  const castCredits = details.movie_credits.cast || [];
  const crewCredits = details.movie_credits.crew || [];
  
  // Merge and deduplicate by ID
  const allCredits = [...castCredits, ...crewCredits];
  const uniqueMoviesMap = new Map();
  
  allCredits.forEach(c => {
      if (!uniqueMoviesMap.has(c.id)) {
          // Quick conversion to app Movie type for display
          const movieObj: Movie = {
              id: `tmdb-${c.id}`,
              tmdbId: c.id,
              title: c.title,
              year: c.release_date ? parseInt(c.release_date.split('-')[0]) : 0,
              director: 'Desconocido', // Not critical for grid card
              genre: [], // Not critical
              posterUrl: getImageUrl(c.poster_path),
              description: c.overview,
              rating: c.vote_average || 0,
              totalVotes: 0 // Placeholder
          };
          uniqueMoviesMap.set(c.id, movieObj);
      }
  });

  const filmography = Array.from(uniqueMoviesMap.values()).sort((a, b) => b.year - a.year); // Sort by recent

  return (
    <div className="container mx-auto px-4 py-8 pb-20 animate-fade-in">
        <button 
            onClick={() => setView(ViewState.DASHBOARD)} // Or history back if implemented
            className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
            <ArrowLeft size={20} /> Volver
        </button>

        <div className="flex flex-col md:flex-row gap-8 mb-12">
            {/* Left: Image & Personal Info */}
            <div className="flex-shrink-0 w-full md:w-80">
                <div className="rounded-xl overflow-hidden shadow-2xl border-4 border-gray-800 mb-6 bg-black relative group">
                    <img 
                        src={getImageUrl(details.profile_path, 'original')} 
                        alt={details.name} 
                        className="w-full h-auto object-cover"
                    />
                </div>
                
                <div className="bg-cine-gray p-6 rounded-xl border border-gray-800 space-y-4">
                    <h3 className="text-white font-bold text-lg mb-2 border-b border-gray-700 pb-2">Datos Personales</h3>
                    
                    <div>
                        <p className="text-gray-500 text-xs uppercase font-bold mb-1">Conocido por</p>
                        <p className="text-white">{details.known_for_department === 'Acting' ? 'Interpretación' : details.known_for_department}</p>
                    </div>
                    
                    {details.birthday && (
                        <div>
                            <p className="text-gray-500 text-xs uppercase font-bold mb-1">Nacimiento</p>
                            <p className="text-white flex items-center gap-2">
                                <Calendar size={14} className="text-cine-gold"/> {new Date(details.birthday).toLocaleDateString()}
                            </p>
                        </div>
                    )}
                    
                    {details.place_of_birth && (
                        <div>
                            <p className="text-gray-500 text-xs uppercase font-bold mb-1">Lugar</p>
                            <p className="text-white flex items-center gap-2">
                                <MapPin size={14} className="text-cine-gold"/> {details.place_of_birth}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Bio & Filmography */}
            <div className="flex-grow">
                <h1 className="text-4xl md:text-5xl font-black text-white mb-6 uppercase tracking-tight">{details.name}</h1>
                
                {details.biography && (
                    <div className="mb-10">
                        <h3 className="text-xl font-bold text-cine-gold mb-3 flex items-center gap-2">
                            <Star size={20} fill="currentColor"/> Biografía
                        </h3>
                        <div className="text-gray-300 leading-relaxed text-lg whitespace-pre-wrap">
                            {details.biography || "No hay biografía disponible en español."}
                        </div>
                    </div>
                )}

                <div>
                    <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2 border-l-4 border-cine-gold pl-3">
                        <Film size={24}/> Filmografía ({filmography.length})
                    </h3>
                    
                    {filmography.length === 0 ? (
                        <p className="text-gray-500 italic">No se encontraron películas.</p>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {filmography.map(movie => (
                                <MovieCard key={movie.id} movie={movie} showRatingInput={false} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};

export default PersonDetails;