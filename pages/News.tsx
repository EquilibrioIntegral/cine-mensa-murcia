
import React from 'react';
import { useData } from '../context/DataContext';
import { ViewState } from '../types';
import { Newspaper, Bell, CheckCircle, Ticket, ChevronRight, Bug } from 'lucide-react';

const News: React.FC = () => {
  const { news, activeEvent, setView, user } = useData();
  
  // Separate news by type
  const generalNews = news.filter(n => n.type !== 'update');
  const updates = news.filter(n => n.type === 'update');

  return (
    <div className="container mx-auto px-4 py-8 pb-20 max-w-5xl">
      <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-white mb-2">CINE MENSA <span className="text-cine-gold">MURCIA</span></h1>
          <p className="text-gray-400">El punto de encuentro de los cinéfilos exigentes.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* LEFT COLUMN: Events & Updates */}
          <div className="md:col-span-2 space-y-8">
              
              {/* Active Event Card */}
              {activeEvent && activeEvent.phase !== 'closed' ? (
                  <div 
                    onClick={() => setView(ViewState.EVENTS)}
                    className="bg-gradient-to-r from-cine-gold/20 to-black rounded-xl border border-cine-gold p-6 cursor-pointer hover:scale-[1.01] transition-transform shadow-[0_0_30px_rgba(212,175,55,0.1)] group relative overflow-hidden"
                  >
                      <div className="absolute top-0 right-0 bg-cine-gold text-black text-xs font-bold px-3 py-1 rounded-bl-lg">
                          EN CURSO
                      </div>
                      <div className="flex items-start gap-4 relative z-10">
                          <Ticket size={48} className="text-cine-gold shrink-0" />
                          <div>
                              <h3 className="text-2xl font-bold text-white mb-1 group-hover:text-cine-gold transition-colors">{activeEvent.themeTitle}</h3>
                              <p className="text-gray-300 mb-4 line-clamp-2">"{activeEvent.themeDescription}"</p>
                              
                              <div className="flex items-center gap-2 text-sm font-bold">
                                  <span className={`px-3 py-1 rounded-full ${activeEvent.phase === 'voting' ? 'bg-cine-gold text-black' : 'bg-gray-800 text-gray-500'}`}>Votación</span>
                                  <ChevronRight size={14} className="text-gray-600"/>
                                  <span className={`px-3 py-1 rounded-full ${activeEvent.phase === 'viewing' ? 'bg-cine-gold text-black' : 'bg-gray-800 text-gray-500'}`}>Proyección</span>
                                  <ChevronRight size={14} className="text-gray-600"/>
                                  <span className={`px-3 py-1 rounded-full ${activeEvent.phase === 'discussion' ? 'bg-cine-gold text-black' : 'bg-gray-800 text-gray-500'}`}>Debate</span>
                              </div>
                          </div>
                      </div>
                  </div>
              ) : (
                  <div className="bg-cine-gray rounded-xl border border-gray-800 p-8 text-center">
                      <Ticket size={48} className="text-gray-600 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-white">No hay eventos activos</h3>
                      <p className="text-gray-500 mt-2">Mantente atento a las próximas convocatorias.</p>
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
                          <div className="p-8 text-center text-gray-500 italic">No hay noticias recientes.</div>
                      ) : (
                          generalNews.map(item => (
                              <div key={item.id} className="p-6 hover:bg-white/5 transition-colors">
                                  <div className="flex justify-between items-start mb-2">
                                      <h4 className="font-bold text-white text-lg">{item.title}</h4>
                                      <span className="text-xs text-gray-500">{new Date(item.timestamp).toLocaleDateString()}</span>
                                  </div>
                                  <p className="text-gray-300 leading-relaxed">{item.content}</p>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>

          {/* RIGHT COLUMN: Changelog / Fixes */}
          <div className="space-y-6">
              <div className="bg-black/40 rounded-xl border border-gray-800 overflow-hidden">
                  <div className="p-4 border-b border-gray-800 flex items-center gap-2 bg-cine-gold/5">
                      <CheckCircle className="text-green-500" size={20} />
                      <h3 className="font-bold text-white">Mejoras Recientes</h3>
                  </div>
                  <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar">
                      {updates.length === 0 ? (
                          <p className="text-gray-500 text-sm text-center py-4">Todo funciona correctamente.</p>
                      ) : (
                          updates.map(item => (
                              <div key={item.id} className="text-sm">
                                  <p className="font-bold text-white mb-1">{item.title}</p>
                                  <p className="text-gray-400 text-xs">{item.content}</p>
                                  <p className="text-[10px] text-gray-600 mt-1 text-right">{new Date(item.timestamp).toLocaleDateString()}</p>
                              </div>
                          ))
                      )}
                  </div>
                  <div className="p-3 bg-gray-900 border-t border-gray-800 text-center">
                      <button 
                        onClick={() => setView(ViewState.FEEDBACK)}
                        className="text-xs text-gray-400 hover:text-cine-gold flex items-center justify-center gap-2 w-full"
                      >
                          <Bug size={12} /> Reportar nuevo bug o idea
                      </button>
                  </div>
              </div>

              <div className="bg-gradient-to-br from-purple-900/20 to-black p-6 rounded-xl border border-purple-500/20 text-center">
                  <h4 className="text-purple-400 font-bold mb-2">¿Tienes una idea?</h4>
                  <p className="text-gray-400 text-sm mb-4">Ayúdanos a mejorar la plataforma sugiriendo nuevas funciones.</p>
                  <button 
                    onClick={() => setView(ViewState.FEEDBACK)}
                    className="bg-purple-600/20 text-purple-300 border border-purple-500/50 px-4 py-2 rounded-lg text-sm font-bold hover:bg-purple-600 hover:text-white transition-colors"
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
