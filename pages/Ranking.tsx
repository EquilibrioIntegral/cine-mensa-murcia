
import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Trophy, Users, Star, ThumbsUp, Medal } from 'lucide-react';
import { ViewState } from '../types';

const Ranking: React.FC = () => {
  const { movies, allUsers, userRatings, setView } = useData();
  const [activeTab, setActiveTab] = useState<'movies' | 'critics'>('movies');

  // Logic for Movie Ranking
  const sortedMovies = useMemo(() => {
    return [...movies]
        .filter(m => m.totalVotes > 0)
        .sort((a, b) => b.rating - a.rating);
  }, [movies]);

  // Logic for Critics Ranking
  const sortedCritics = useMemo(() => {
    return allUsers
        .filter(u => u.status === 'active' || u.isAdmin)
        .map(user => {
            const myReviews = userRatings.filter(r => r.userId === user.id);
            const reviewCount = myReviews.length;
            
            // Calculate Prestige: Total Likes received - Total Dislikes received
            const totalLikes = myReviews.reduce((acc, r) => acc + (r.likes?.length || 0), 0);
            const totalDislikes = myReviews.reduce((acc, r) => acc + (r.dislikes?.length || 0), 0);
            const prestige = totalLikes - totalDislikes;

            return {
                ...user,
                reviewCount,
                prestige,
                avgGiven: reviewCount > 0 ? (myReviews.reduce((acc, r) => acc + r.rating, 0) / reviewCount).toFixed(1) : '-'
            };
        })
        .filter(u => u.reviewCount > 0) // Only show users who have participated
        .sort((a, b) => {
            // 1. Primary: Prestige (Highest first)
            if (b.prestige !== a.prestige) {
                return b.prestige - a.prestige;
            }
            // 2. Tie-breaker: Review Count (Highest first)
            return b.reviewCount - a.reviewCount;
        });
  }, [allUsers, userRatings]);

  return (
    <div className="container mx-auto px-4 py-8 pb-20 max-w-5xl">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-3">
            <Trophy className="text-cine-gold" size={32} />
            <h2 className="text-3xl font-bold text-white">Salón de la Fama</h2>
        </div>

        {/* Tabs */}
        <div className="bg-cine-gray p-1 rounded-full border border-gray-800 flex">
            <button 
                onClick={() => setActiveTab('movies')}
                className={`px-6 py-2 rounded-full font-bold transition-all flex items-center gap-2 ${activeTab === 'movies' ? 'bg-cine-gold text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
                <Trophy size={16} /> Películas
            </button>
            <button 
                onClick={() => setActiveTab('critics')}
                className={`px-6 py-2 rounded-full font-bold transition-all flex items-center gap-2 ${activeTab === 'critics' ? 'bg-cine-gold text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
                <Users size={16} /> Críticos
            </button>
        </div>
      </div>

      {activeTab === 'movies' && (
          <div className="grid gap-6 animate-fade-in">
            {sortedMovies.map((movie, index) => (
              <div 
                key={movie.id} 
                onClick={() => setView(ViewState.MOVIE_DETAILS, movie.id)}
                className="flex flex-col md:flex-row bg-cine-gray rounded-xl overflow-hidden border border-gray-800 hover:border-cine-gold transition-colors cursor-pointer group"
              >
                {/* Rank Number */}
                <div className="bg-black/30 w-full md:w-24 flex items-center justify-center p-4 border-r border-gray-800 transition-colors group-hover:bg-cine-gold/10 relative">
                    <span className={`text-5xl font-bold ${index === 0 ? 'text-cine-gold' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-700' : 'text-gray-600'}`}>
                        #{index + 1}
                    </span>
                    {index === 0 && <Star className="absolute top-2 right-2 text-cine-gold animate-spin-slow" size={16} fill="currentColor" />}
                </div>

                <div className="w-full md:w-48 h-64 md:h-auto flex-shrink-0">
                    <img src={movie.posterUrl} alt={movie.title} className="w-full h-full object-cover" />
                </div>

                <div className="p-6 flex flex-col justify-center flex-grow">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h3 className="text-2xl font-bold text-white group-hover:text-cine-gold transition-colors">{movie.title}</h3>
                            <p className="text-cine-gold">{movie.director} • {movie.year}</p>
                        </div>
                        <div className="text-right">
                            <div className="text-4xl font-bold text-white">{movie.rating.toFixed(1)}</div>
                            <div className="text-sm text-gray-500">{movie.totalVotes} votos</div>
                        </div>
                    </div>
                    
                    <p className="text-gray-400 mt-2 line-clamp-2">{movie.description}</p>
                    
                    <div className="mt-4 flex gap-2">
                        {movie.genre.map(g => (
                            <span key={g} className="text-xs px-2 py-1 rounded bg-black text-gray-400 border border-gray-800">
                                {g}
                            </span>
                        ))}
                    </div>
                </div>
              </div>
            ))}
            {sortedMovies.length === 0 && (
                <div className="text-center py-20 bg-cine-gray/50 rounded-xl border border-dashed border-gray-800">
                    <p className="text-gray-500 italic text-xl">
                        El ranking está vacío. <br/>
                        ¡Sé el primero en valorar una película del club!
                    </p>
                </div>
            )}
          </div>
      )}

      {activeTab === 'critics' && (
          <div className="grid gap-4 animate-fade-in">
              <div className="bg-cine-gold/10 p-4 rounded-lg border border-cine-gold/30 mb-4 flex items-start gap-3">
                  <Medal className="text-cine-gold shrink-0 mt-1" />
                  <div>
                      <h4 className="text-cine-gold font-bold">¿Cómo subir en el ranking?</h4>
                      <p className="text-sm text-gray-300">
                          Tu "Prestigio" aumenta cuando otros socios le dan <strong>Me Gusta</strong> a tus reseñas. 
                          En caso de empate, ¡gana quien tenga <strong>más reseñas</strong> escritas!
                      </p>
                  </div>
              </div>

              {sortedCritics.map((critic, index) => (
                  <div key={critic.id} className="bg-cine-gray p-4 rounded-xl border border-gray-800 flex items-center justify-between hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 flex items-center justify-center font-bold text-xl rounded-full ${index === 0 ? 'bg-cine-gold text-black shadow-[0_0_15px_rgba(212,175,55,0.5)]' : 'bg-black text-gray-500'}`}>
                              #{index + 1}
                          </div>
                          <img src={critic.avatarUrl} alt={critic.name} className="w-14 h-14 rounded-full border-2 border-gray-700" />
                          <div>
                              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                  {critic.name}
                                  {index === 0 && <Star size={16} className="text-cine-gold" fill="currentColor" />}
                              </h3>
                              <p className="text-sm text-gray-400">{critic.reviewCount} reseñas escritas</p>
                          </div>
                      </div>

                      <div className="flex items-center gap-8 text-right">
                          <div className="hidden md:block">
                              <p className="text-xs text-gray-500 uppercase font-bold">Nota Media Dada</p>
                              <p className="text-lg font-bold text-gray-300">{critic.avgGiven}</p>
                          </div>
                          <div className="bg-black/40 px-6 py-2 rounded-lg border border-gray-700">
                              <p className="text-xs text-cine-gold uppercase font-bold flex items-center justify-end gap-1">
                                  <ThumbsUp size={12} /> Prestigio
                              </p>
                              <p className="text-2xl font-bold text-white">{critic.prestige}</p>
                          </div>
                      </div>
                  </div>
              ))}
              
              {sortedCritics.length === 0 && (
                  <div className="text-center py-20 text-gray-500 italic">
                      Aún no hay críticos activos. ¡Escribe la primera reseña!
                  </div>
              )}
          </div>
      )}
    </div>
  );
};

export default Ranking;
