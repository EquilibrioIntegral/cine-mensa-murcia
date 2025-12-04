
import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { ViewState, NewsItem } from '../types';
import { Newspaper, Bell, CheckCircle, Ticket, ChevronRight, Bug, Calendar, AlertCircle, Eye, MessageCircle, ChevronDown, ChevronUp, Medal, ArrowRight } from 'lucide-react';
import RankBadge from '../components/RankBadge';
import { RANKS } from '../constants';
import OnlineUsersWidget from '../components/OnlineUsersWidget';

const NewsCard: React.FC<{ item: NewsItem }> = ({ item }) => {
    const { triggerAction } = useData();
    const [isExpanded, setIsExpanded] = useState(false);
    // Determine if content is long enough to need expansion
    const contentPreview = item.content.length > 200 && !isExpanded;

    const handleExpand = () => {
        const nextState = !isExpanded;
        setIsExpanded(nextState);
        if (nextState) {
            triggerAction('read_news');
        }
    }

    return (
        <div className="hover:bg-white/5 transition-colors group">
            {item.imageUrl && (
                <div className="w-full aspect-video overflow-hidden relative">
                    <img 
                    src={item.imageUrl} 
                    alt={item.title} 
                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-cine-gray to-transparent opacity-90"></div>
                </div>
            )}
            <div className={`p-6 ${item.imageUrl ? '-mt-24 relative z-10' : ''}`}>
                <div className="flex justify-between items-start mb-3">
                    <h4 className="font-bold text-white text-xl leading-tight drop-shadow-lg">{item.title}</h4>
                    <span className="text-xs text-gray-500 whitespace-nowrap ml-4 bg-black/60 px-2 py-1 rounded backdrop-blur-sm border border-gray-700">
                        {new Date(item.timestamp).toLocaleDateString()}
                    </span>
                </div>
                <div className={`text-gray-300 leading-relaxed whitespace-pre-wrap transition-all duration-300 ${contentPreview ? 'line-clamp-3' : ''}`}>
                    {item.content}
                </div>
                
                {item.content.length > 200 && (
                    <button 
                        onClick={handleExpand}
                        className="mt-3 text-sm text-cine-gold font-bold flex items-center gap-1 hover:text-white transition-colors"
                    >
                        {isExpanded ? (
                            <>Leer menos <ChevronUp size={16}/></>
                        ) : (
                            <>Leer noticia completa <ChevronDown size={16}/></>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
};

const News: React.FC = () => {
  const { news, activeEvent, setView, user, setInitialProfileTab } = useData();
  
  // Separate news by type
  const generalNews = news.filter(n => n.type !== 'update' && n.type !== 'event');
  const updates = news.filter(n => n.type === 'update');

  const goToCareer = () => {
      setInitialProfileTab('career');
      setView(ViewState.PROFILE);
  };

  const currentRank = user ? RANKS.slice().reverse().find(r => (user.level || 1) >= r.minLevel) : RANKS[0];
  const rankImage = currentRank ? `https://image.pollinations.ai/prompt/cinematic%20shot%20of%20a%20${currentRank.title}%20in%20a%20movie%20set%20atmosphere?width=800&height=300&nologo=true&model=flux` : '';

  const hasOnlineTracker = user?.inventory?.includes('item_online_tracker');

  return (
    <div className="container mx-auto px-4 py-8 pb-20 max-w-5xl">
      
      <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-white mb-2">CINE MENSA <span className="text-cine-gold">MURCIA</span></h1>
          <p className="text-gray-400">El punto de encuentro de los cinéfilos exigentes.</p>
      </div>

      {/* IDENTITY CARD (Moved here from Dashboard) */}
      {user && (
          <div className="mb-12 relative overflow-hidden rounded-2xl border border-cine-gold/30 shadow-2xl group cursor-pointer" onClick={goToCareer}>
               {/* AI Generated Background based on Rank */}
               <div className="absolute inset-0">
                   <img src={rankImage} alt="Rank Background" className="w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-700 filter grayscale group-hover:grayscale-0" />
                   <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent"></div>
               </div>

               <div className="relative z-10 p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-6">
                      <div className="relative">
                          <div className="w-24 h-24 rounded-full border-4 border-cine-gold overflow-hidden shadow-[0_0_20px_rgba(212,175,55,0.3)]">
                              <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="absolute -bottom-2 -right-2 bg-black text-white text-xs font-black px-2 py-1 rounded border border-gray-700">
                              LVL {user.level || 1}
                          </div>
                      </div>
                      <div>
                          <h2 className="text-3xl font-bold text-white mb-1">
                              {user.name}
                          </h2>
                          <div className="flex items-center gap-2 mb-2">
                              <RankBadge level={user.level || 1} size="md" />
                              <div className="bg-black/60 px-2 py-0.5 rounded text-xs text-cine-gold font-mono border border-cine-gold/30 flex items-center gap-1">
                                  <Ticket size={10}/> {user.credits || 0} pts
                              </div>
                          </div>
                          <p className="text-gray-300 text-sm max-w-md italic">
                              "Tu historia en el cine está siendo escrita. ¡Completa misiones para ascender!"
                          </p>
                      </div>
                  </div>

                  <div className="flex-shrink-0">
                      <button 
                        onClick={(e) => { e.stopPropagation(); goToCareer(); }}
                        className="bg-cine-gold text-black font-black py-3 px-8 rounded-full hover:bg-white transition-colors flex items-center gap-2 shadow-lg hover:shadow-cine-gold/50"
                      >
                          <Medal size={20}/> VER MI CARRERA <ArrowRight size={20}/>
                      </button>
                  </div>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* LEFT COLUMN: Events & Updates */}
          <div className="md:col-span-2 space-y-8">
              
              {/* Active Event Card - RICH DISPLAY */}
              {activeEvent && activeEvent.phase !== 'closed' ? (
                  <div 
                    onClick={() => setView(ViewState.EVENTS)}
                    className="relative rounded-2xl overflow-hidden cursor-pointer group shadow-[0_0_40px_rgba(212,175,55,0.15)] border border-cine-gold/50 h-80 transition-transform hover:scale-[1.01]"
                  >
                      {/* Background Image (AI Generated) */}
                      <img 
                        src={activeEvent.backdropUrl || "https://via.placeholder.com/800x400"} 
                        alt="Event Backdrop" 
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
                      
                      {/* Floating Status Badge */}
                      <div className="absolute top-4 right-4 bg-cine-gold text-black text-xs font-black px-4 py-2 rounded-full shadow-lg uppercase tracking-wider flex items-center gap-2">
                          <span className="w-2 h-2 bg-black rounded-full animate-pulse"></span>
                          Evento en curso: {activeEvent.phase === 'voting' ? 'VOTACIÓN' : activeEvent.phase === 'viewing' ? 'PROYECCIÓN' : 'DEBATE'}
                      </div>

                      {/* Content Overlay */}
                      <div className="absolute bottom-0 left-0 w-full p-8">
                          <div className="flex items-center gap-2 mb-2 text-cine-gold font-bold text-sm uppercase tracking-widest">
                              <Ticket size={16} /> Cineforum Oficial
                          </div>
                          
                          <h3 className="text-4xl font-black text-white mb-3 uppercase italic leading-none drop-shadow-xl">
                              {activeEvent.themeTitle}
                          </h3>
                          
                          <p className="text-gray-200 text-lg mb-4 line-clamp-2 drop-shadow-md border-l-4 border-cine-gold pl-4 italic">
                              "{activeEvent.themeDescription}"
                          </p>
                          
                          {activeEvent.phase === 'voting' && (
                              <div className="inline-flex items-center gap-2 bg-black/60 text-white px-4 py-2 rounded-lg backdrop-blur-sm border border-gray-600">
                                  <Calendar size={18} className="text-cine-gold"/>
                                  <span className="text-sm font-bold">
                                      Votación abierta: <span className="text-gray-300">Del {new Date(activeEvent.startDate).toLocaleDateString()} al {new Date(activeEvent.votingDeadline).toLocaleDateString()}</span>
                                  </span>
                              </div>
                          )}

                          {activeEvent.phase === 'viewing' && (
                              <div className="inline-flex items-center gap-2 bg-black/60 text-white px-4 py-2 rounded-lg backdrop-blur-sm border border-gray-600">
                                  <Eye size={18} className="text-cine-gold"/>
                                  <span className="text-sm font-bold">
                                      Visualización: <span className="text-gray-300">Hasta el {new Date(activeEvent.viewingDeadline).toLocaleDateString()}</span>
                                  </span>
                              </div>
                          )}
                          
                          {activeEvent.phase === 'discussion' && (
                              <div className="inline-flex items-center gap-2 bg-black/60 text-white px-4 py-2 rounded-lg backdrop-blur-sm border border-gray-600">
                                  <MessageCircle size={18} className="text-cine-gold"/>
                                  <span className="text-sm font-bold">
                                      Debate en curso
                                  </span>
                              </div>
                          )}
                          
                          <div className="mt-4 flex items-center gap-2 text-xs font-bold text-gray-400 group-hover:text-white transition-colors">
                              <span>Pulsa para participar</span> <ChevronRight size={14}/>
                          </div>
                      </div>
                  </div>
              ) : (
                  <div className="bg-cine-gray rounded-xl border border-gray-800 p-8 text-center flex flex-col items-center justify-center h-48">
                      <Ticket size={48} className="text-gray-700 mb-4" />
                      <h3 className="text-xl font-bold text-white">No hay eventos activos</h3>
                      <p className="text-gray-500 mt-2 max-w-sm">
                          El proyector está apagado. Espera a la próxima convocatoria del administrador.
                      </p>
                  </div>
              )}

              {/* General News Section */}
              <div className="bg-cine-gray rounded-xl border border-gray-800 overflow-hidden">
                  <div className="p-4 border-b border-gray-800 flex items-center gap-2">
                      <Newspaper className="text-cine-gold" />
                      <h3 className="font-bold text-white text-lg">Noticias del Club</h3>
                  </div>
                  <div className="divide-y divide-gray-800">
                      {generalNews.length === 0 ? (
                          <div className="p-12 text-center text-gray-500 italic">No hay noticias recientes en el tablón.</div>
                      ) : (
                          generalNews.map(item => (
                              <NewsCard key={item.id} item={item} />
                          ))
                      )}
                  </div>
              </div>
          </div>

          {/* RIGHT COLUMN: Online Radar & Changelog */}
          <div className="space-y-6">
              
              {/* ONLINE USERS WIDGET (PREMIUM FEATURE) - Moved Here */}
              {hasOnlineTracker && <OnlineUsersWidget />}

              <div className="bg-black/40 rounded-xl border border-gray-800 overflow-hidden">
                  <div className="p-4 border-b border-gray-800 flex items-center gap-2 bg-cine-gold/5">
                      <CheckCircle className="text-green-500" size={20} />
                      <h3 className="font-bold text-white">Mejoras Recientes</h3>
                  </div>
                  <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar">
                      {updates.length === 0 ? (
                          <p className="text-gray-500 text-sm text-center py-8 opacity-50">Todo funciona correctamente.</p>
                      ) : (
                          updates.map(item => (
                              <div key={item.id} className="text-sm border-l-2 border-gray-700 pl-3 py-1">
                                  <p className="font-bold text-white mb-1">{item.title}</p>
                                  <p className="text-gray-400 text-xs leading-snug">{item.content}</p>
                                  <p className="text-[10px] text-gray-600 mt-2 text-right">{new Date(item.timestamp).toLocaleDateString()}</p>
                              </div>
                          ))
                      )}
                  </div>
                  <div className="p-3 bg-gray-900 border-t border-gray-800 text-center">
                      <button 
                        onClick={() => setView(ViewState.FEEDBACK)}
                        className="text-xs text-gray-400 hover:text-cine-gold flex items-center justify-center gap-2 w-full transition-colors"
                      >
                          <Bug size={12} /> Reportar nuevo bug o idea
                      </button>
                  </div>
              </div>

              <div className="bg-gradient-to-br from-purple-900/10 to-black p-6 rounded-xl border border-purple-500/20 text-center">
                  <h4 className="text-purple-400 font-bold mb-2 flex items-center justify-center gap-2"><AlertCircle size={16}/> ¿Tienes una idea?</h4>
                  <p className="text-gray-400 text-sm mb-4">Ayúdanos a mejorar la plataforma sugiriendo nuevas funciones para el club.</p>
                  <button 
                    onClick={() => setView(ViewState.FEEDBACK)}
                    className="bg-purple-600/20 text-purple-300 border border-purple-500/50 px-4 py-2 rounded-lg text-sm font-bold hover:bg-purple-600 hover:text-white transition-all w-full"
                  >
                      Enviar Sugerencia
                  </button>
              </div>
          </div>
      </div>
    </div>
  );
};

export default News;
