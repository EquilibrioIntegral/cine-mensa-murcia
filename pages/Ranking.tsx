import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Trophy, Users, Star, ThumbsUp, Medal, Zap, Skull, TrendingDown, ThumbsDown } from 'lucide-react';
import { ViewState } from '../types';
import RankBadge from '../components/RankBadge';

const Ranking: React.FC = () => {
  const { movies, allUsers, userRatings, setView, triggerAction } = useData();
  const [activeTab, setActiveTab] = useState<'movies' | 'critics' | 'levels' | 'villains'>('movies');

  // Trigger gamification
  useEffect(() => {
      triggerAction('visit_ranking');
  }, []);

  // Logic for Movie Ranking
  const sortedMovies = useMemo(() => {
    return [...movies]
        .filter(m => m.totalVotes > 0)
        .sort((a, b) => b.rating - a.rating);
  }, [movies]);

  // Logic for Critics Ranking (Prestige)
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

  // Logic for Level Ranking (XP)
  const sortedByLevel = useMemo(() => {
      return [...allUsers]
        .filter(u => u.status === 'active' || u.isAdmin)
        .sort((a, b) => {
            // 1. Level
            const levelA = a.level || 1;
            const levelB = b.level || 1;
            if (levelB !== levelA) return levelB - levelA;
            // 2. XP
            return (b.xp || 0) - (a.xp || 0);
        });
  }, [allUsers]);

  // Logic for "Villains" Ranking (Dislikes)
  const sortedVillains = useMemo(() => {
      return allUsers
        .filter(u => u.status === 'active' || u.isAdmin)
        .map(user => {
            const myReviews = userRatings.filter(r => r.userId === user.id);
            const totalDislikes = myReviews.reduce((acc, r) => acc + (r.dislikes?.length || 0), 0);
            return { ...user, totalDislikes, reviewCount: myReviews.length };
        })
        .filter(u => u.totalDislikes > 0)
        .sort((a, b) => b.totalDislikes - a.totalDislikes);
  }, [allUsers, userRatings]);

  const TabButton = ({ id, label, icon: Icon, colorClass }: { id: typeof activeTab, label: string, icon: any, colorClass?: string }) => (
      <button 
        onClick={() => setActiveTab(id)}
        className={`flex-1 md:flex-none px-4 py-2 rounded-full font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap text-sm md:text-base ${activeTab === id ? 'bg-cine-gold text-black shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
      >
          <Icon size={16} className={activeTab === id ? 'text-black' : colorClass} /> {label}
      </button>
  );

  return (
    <div className="container mx-auto px-4 py-8 pb-20 max-w-5xl">
      <div className="flex flex-col items-center mb-8 gap-4">
        <div className="flex items-center gap-3">
            <Trophy className="text-cine-gold" size={32} />
            <h2 className="text-3xl font-bold text-white">Salón de la Fama</h2>
        </div>

        {/* Scrollable Tabs */}
        <div className="w-full overflow-x-auto no-scrollbar pb-2">
            <div className="bg-cine-gray p-1 rounded-full border border-gray-800 flex min-w-max mx-auto">
                <TabButton id="movies" label="Películas" icon={Trophy} colorClass="text-yellow-500" />
                <TabButton id="critics" label="Críticos" icon={Users} colorClass="text-blue-400" />
                <TabButton id="levels" label="Nivel & XP" icon={Zap} colorClass="text-purple-400" />
                <TabButton id="villains" label="Los Villanos" icon={Skull} colorClass="text-red-500" />
            </div>
        </div>
      </div>

      {/* --- MOVIES TAB --- */}
      {activeTab === 'movies' && (
          <div className="grid gap-4 md:gap-6 animate-fade-in">
            {sortedMovies.map((movie, index) => (
              <div 
                key={movie.id} 
                onClick={() => setView(ViewState.MOVIE_DETAILS, movie.id)}
                className="flex flex-col md:flex-row bg-cine-gray rounded-xl overflow-hidden border border-gray-800 hover:border-cine-gold transition-colors cursor-pointer group relative shadow-md"
              >
                {/* Rank Number - Mobile Floating */}
                <div className="absolute top-2 left-2 z-20 md:hidden">
                    <div className={`w-10 h-10 flex items-center justify-center font-bold text-lg rounded-full shadow-lg border-2 border-gray-800 ${index === 0 ? 'bg-cine-gold text-black' : index === 1 ? 'bg-gray-300 text-black' : index === 2 ? 'bg-amber-700 text-white' : 'bg-black/90 text-white'}`}>
                        #{index + 1}
                    </div>
                </div>

                {/* Rank Number - Desktop Sidebar */}
                <div className="hidden md:flex bg-black/30 w-24 flex-shrink-0 items-center justify-center p-4 border-r border-gray-800 transition-colors group-hover:bg-cine-gold/10 relative">
                    <span className={`text-5xl font-bold ${index === 0 ? 'text-cine-gold' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-700' : 'text-gray-600'}`}>
                        #{index + 1}
                    </span>
                    {index === 0 && <Star className="absolute top-2 right-2 text-cine-gold animate-spin-slow" size={16} fill="currentColor" />}
                </div>

                <div className="w-full md:w-48 h-40 md:h-auto flex-shrink-0 relative">
                    <img src={movie.posterUrl} alt={movie.title} className="w-full h-full object-cover object-top" />
                    <div className="absolute inset-0 bg-gradient-to-t from-cine-gray via-transparent to-transparent md:hidden"></div>
                </div>

                <div className="p-4 md:p-6 flex flex-col justify-center flex-grow -mt-10 md:mt-0 relative z-10">
                    <div className="flex justify-between items-start mb-2">
                        <div className="pr-4">
                            <h3 className="text-xl md:text-2xl font-bold text-white group-hover:text-cine-gold transition-colors leading-tight">{movie.title}</h3>
                            <p className="text-cine-gold text-sm md:text-base">{movie.director} • {movie.year}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                            <div className="text-3xl md:text-4xl font-bold text-white">{movie.rating.toFixed(1)}</div>
                            <div className="text-xs md:text-sm text-gray-500">{movie.totalVotes} votos</div>
                        </div>
                    </div>
                    
                    <p className="text-gray-400 mt-2 line-clamp-2 text-sm md:text-base">{movie.description}</p>
                    
                    <div className="mt-4 flex flex-wrap gap-2">
                        {movie.genre.map(g => (
                            <span key={g} className="text-[10px] md:text-xs px-2 py-1 rounded bg-black text-gray-400 border border-gray-800">
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

      {/* --- CRITICS TAB --- */}
      {activeTab === 'critics' && (
          <div className="grid gap-4 animate-fade-in">
              <div className="bg-blue-900/10 p-4 rounded-lg border border-blue-500/30 mb-4 flex items-start gap-3">
                  <Medal className="text-blue-400 shrink-0 mt-1" />
                  <div>
                      <h4 className="text-blue-400 font-bold">Ranking de Prestigio</h4>
                      <p className="text-sm text-gray-300">
                          Se basa en la calidad. Tu "Prestigio" aumenta con los <strong>Likes</strong> y disminuye con los Dislikes en tus reseñas.
                      </p>
                  </div>
              </div>

              {sortedCritics.map((critic, index) => (
                  <div key={critic.id} className="bg-cine-gray p-4 rounded-xl border border-gray-800 flex items-center justify-between hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-3 md:gap-4">
                          <div className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center font-bold text-lg md:text-xl rounded-full flex-shrink-0 ${index === 0 ? 'bg-cine-gold text-black shadow-[0_0_15px_rgba(212,175,55,0.5)]' : 'bg-black text-gray-500'}`}>
                              #{index + 1}
                          </div>
                          <img src={critic.avatarUrl} alt={critic.name} className="w-12 h-12 md:w-14 md:h-14 rounded-full border-2 border-gray-700 flex-shrink-0" />
                          <div className="min-w-0">
                              <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2 truncate">
                                  {critic.name}
                                  {index === 0 && <Star size={16} className="text-cine-gold flex-shrink-0" fill="currentColor" />}
                              </h3>
                              <p className="text-xs md:text-sm text-gray-400">{critic.reviewCount} reseñas</p>
                          </div>
                      </div>

                      <div className="flex flex-col md:flex-row items-end md:items-center gap-2 md:gap-8 text-right">
                          <div className="hidden md:block">
                              <p className="text-xs text-gray-500 uppercase font-bold">Nota Media</p>
                              <p className="text-lg font-bold text-gray-300">{critic.avgGiven}</p>
                          </div>
                          <div className="bg-black/40 px-4 md:px-6 py-2 rounded-lg border border-gray-700 flex flex-col items-end">
                              <p className="text-[10px] md:text-xs text-cine-gold uppercase font-bold flex items-center justify-end gap-1">
                                  <ThumbsUp size={10} /> Prestigio
                              </p>
                              <p className="text-xl md:text-2xl font-bold text-white">{critic.prestige}</p>
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

      {/* --- LEVEL & XP TAB --- */}
      {activeTab === 'levels' && (
          <div className="grid gap-4 animate-fade-in">
              <div className="bg-purple-900/10 p-4 rounded-lg border border-purple-500/30 mb-4 flex items-start gap-3">
                  <Zap className="text-purple-400 shrink-0 mt-1" />
                  <div>
                      <h4 className="text-purple-400 font-bold">Ranking de Experiencia</h4>
                      <p className="text-sm text-gray-300">
                          Premia la constancia. Sube de nivel completando misiones, retos arcade y participando en eventos.
                      </p>
                  </div>
              </div>

              {sortedByLevel.map((u, index) => (
                  <div key={u.id} className="bg-cine-gray p-4 rounded-xl border border-gray-800 flex items-center justify-between relative overflow-hidden group">
                      {index === 0 && <div className="absolute top-0 right-0 p-10 bg-purple-600/10 rounded-full blur-2xl"></div>}
                      
                      <div className="flex items-center gap-4 relative z-10">
                          <div className={`w-8 h-8 flex items-center justify-center font-bold text-sm rounded-full ${index < 3 ? 'text-white' : 'text-gray-600'}`}>
                              #{index + 1}
                          </div>
                          <div className="relative">
                              <img src={u.avatarUrl} className="w-14 h-14 rounded-full border-2 border-gray-700" />
                              <div className="absolute -bottom-1 -right-1 bg-black text-white text-[10px] px-1.5 rounded font-bold border border-gray-600">
                                  L{u.level || 1}
                              </div>
                          </div>
                          <div>
                              <h3 className="text-lg font-bold text-white leading-tight">{u.name}</h3>
                              <div className="mt-1">
                                  <RankBadge level={u.level || 1} size="sm" />
                              </div>
                          </div>
                      </div>

                      <div className="text-right relative z-10">
                          <p className="text-xs text-gray-500 uppercase font-bold">Experiencia Total</p>
                          <p className="text-2xl font-black text-purple-400">{u.xp || 0} XP</p>
                      </div>
                  </div>
              ))}
          </div>
      )}

      {/* --- VILLAINS TAB --- */}
      {activeTab === 'villains' && (
          <div className="grid gap-4 animate-fade-in">
              <div className="bg-red-900/10 p-4 rounded-lg border border-red-500/30 mb-4 flex items-start gap-3">
                  <Skull className="text-red-500 shrink-0 mt-1" />
                  <div>
                      <h4 className="text-red-500 font-bold">Los Villanos del Cine</h4>
                      <p className="text-sm text-gray-300">
                          Usuarios con las opiniones más polémicas. Ranking ordenado por número total de <strong>Dislikes</strong> recibidos.
                      </p>
                  </div>
              </div>

              {sortedVillains.length === 0 ? (
                  <div className="text-center py-20 bg-cine-gray/30 rounded-xl border border-dashed border-gray-800">
                      <ThumbsUp size={48} className="text-gray-600 mx-auto mb-4"/>
                      <p className="text-gray-500 italic text-xl">
                          ¡Increíble! Nadie tiene votos negativos todavía. <br/>
                          Reina la paz en el club... por ahora.
                      </p>
                  </div>
              ) : (
                  sortedVillains.map((u, index) => (
                      <div key={u.id} className="bg-black/40 p-4 rounded-xl border border-red-900/30 flex items-center justify-between hover:bg-red-900/10 transition-colors group">
                          <div className="flex items-center gap-4">
                              <span className="text-2xl font-black text-red-800 w-8 text-center">#{index + 1}</span>
                              <div className="grayscale group-hover:grayscale-0 transition-all">
                                  <img src={u.avatarUrl} className="w-12 h-12 rounded-full border border-red-900" />
                              </div>
                              <div>
                                  <h3 className="text-white font-bold">{u.name}</h3>
                                  <p className="text-xs text-red-400">{u.reviewCount} reseñas publicadas</p>
                              </div>
                          </div>

                          <div className="text-right">
                              <p className="text-xs text-gray-500 uppercase font-bold mb-1">Polémica</p>
                              <div className="flex items-center justify-end gap-2 text-red-500">
                                  <ThumbsDown size={20} fill="currentColor" />
                                  <span className="text-2xl font-black">{u.totalDislikes}</span>
                              </div>
                          </div>
                      </div>
                  ))
              )}
          </div>
      )}
    </div>
  );
};

export default Ranking;