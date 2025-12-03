
import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { LEVEL_CHALLENGES, XP_TABLE } from '../constants';
import { Gamepad2, Lock, Play, Ticket, HelpCircle, Trophy, Star, ChevronDown, CheckCircle, Skull, X, AlertTriangle, Shield } from 'lucide-react';
import RankBadge from '../components/RankBadge';
import { LevelChallenge, ViewState } from '../types';
import TriviaGame from '../components/TriviaGame';
import TimelineGame from '../components/TimelineGame'; // Import new game

const Arcade: React.FC = () => {
  const { user, completeLevelUpChallenge, setView } = useData();
  const [selectedChallenge, setSelectedChallenge] = useState<LevelChallenge | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  if (!user) return null;

  const currentLevel = user.level || 1;
  const currentXP = user.xp || 0;

  const handleStartGame = () => {
      if (!selectedChallenge) return;

      // Special Check for Timeline Game (Level 3)
      if (selectedChallenge.type === 'timeline') {
          const watchedCount = user.watchedMovies.length;
          // ADMIN BYPASS: Allow admins to play even with 0 movies
          if (watchedCount < 5 && !user.isAdmin) {
              alert(`Necesitas haber visto al menos 5 películas para este reto. Llevas ${watchedCount}.`);
              return;
          }
      }

      setIsPlaying(true);
  };

  const handleGameComplete = (score: number, passed: boolean, action?: 'close' | 'shop') => {
      if (!selectedChallenge) return;
      
      setIsPlaying(false);
      setSelectedChallenge(null);

      if (passed) {
          // Logic: Only award first time completion if user is blocked by level cap
          if (currentLevel < selectedChallenge.level) {
              completeLevelUpChallenge(selectedChallenge.level, selectedChallenge.rewardCredits);
          } else {
              // Replay logic handled visually in Game
          }
      }

      // Handle redirect
      if (action === 'shop') {
          setView(ViewState.SHOP);
      }
  };

  return (
    <div className="container mx-auto px-4 py-8 pb-20">
      
      {/* GAME OVERLAY */}
      {isPlaying && selectedChallenge && (
          selectedChallenge.type === 'timeline' ? (
              <TimelineGame 
                  challenge={selectedChallenge}
                  onComplete={handleGameComplete}
                  onClose={() => setIsPlaying(false)}
              />
          ) : (
              <TriviaGame 
                  challenge={selectedChallenge}
                  onComplete={handleGameComplete}
                  onClose={() => setIsPlaying(false)}
              />
          )
      )}

      <div className="text-center mb-8 md:mb-12">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-2 flex flex-col md:flex-row items-center justify-center gap-2 md:gap-3 uppercase tracking-wider">
              <span className="text-cine-gold text-4xl md:text-5xl">Cartelera</span> de Retos
          </h2>
          <p className="text-gray-400 max-w-lg mx-auto font-serif italic text-sm md:text-lg px-4">
              "Cada nivel es una película donde tú eres el protagonista. <br className="hidden md:block"/>Completa el estreno para ascender."
          </p>
      </div>

      {/* CHALLENGE MODAL (Premiere View) */}
      {selectedChallenge && !isPlaying && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-fade-in overflow-y-auto">
              <div className="max-w-4xl w-full bg-cine-dark rounded-2xl border border-cine-gold/30 shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col md:flex-row relative my-auto">
                  
                  <button 
                    onClick={() => setSelectedChallenge(null)}
                    className="absolute top-3 right-3 z-50 bg-black/50 text-white p-2 rounded-full hover:bg-white hover:text-black transition-colors"
                  >
                      <X size={20}/>
                  </button>

                  {/* LEFT: POSTER */}
                  <div className="w-full md:w-2/5 relative h-48 md:h-auto flex-shrink-0">
                      <img 
                        src={`https://image.pollinations.ai/prompt/${encodeURIComponent(selectedChallenge.imagePrompt)}?nologo=true&width=600&height=900&model=flux`} 
                        alt={selectedChallenge.title}
                        className="w-full h-full object-cover object-center"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-cine-dark via-transparent to-transparent md:bg-gradient-to-r"></div>
                  </div>

                  {/* RIGHT: INFO */}
                  <div className="w-full md:w-3/5 p-5 md:p-8 flex flex-col relative">
                      {/* Background decor */}
                      <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none hidden md:block">
                          <Ticket size={120} className="text-cine-gold" />
                      </div>

                      <div className="mb-1">
                          <span className="text-cine-gold font-bold uppercase tracking-widest text-[10px] md:text-xs">Estreno Exclusivo</span>
                      </div>
                      
                      <h2 className="text-2xl md:text-4xl font-black text-white mb-2 uppercase leading-none font-serif">
                          {selectedChallenge.title}
                      </h2>
                      
                      <div className="flex flex-wrap items-center gap-3 md:gap-4 mb-4 md:mb-6 text-xs md:text-sm text-gray-400">
                          <span className="bg-gray-800 px-2 py-1 rounded text-white font-bold">Nivel {selectedChallenge.level}</span>
                          <span className="flex items-center gap-1"><Star size={14} className="text-cine-gold"/> Mín: <span className="text-white font-bold">{selectedChallenge.passingScore}</span></span>
                          <span className="uppercase bg-black/40 px-2 py-1 rounded border border-gray-700">
                              {selectedChallenge.type === 'timeline' ? 'Juego de Mesa' : selectedChallenge.type === 'boss' ? 'Jefe Final' : 'Trivial'}
                          </span>
                      </div>

                      <div className="mb-6 relative flex-grow">
                          <p className="text-gray-300 italic leading-relaxed text-sm md:text-lg border-l-4 border-cine-gold pl-4">
                              "{selectedChallenge.synopsis}"
                          </p>
                      </div>

                      <div className="mt-auto space-y-3 md:space-y-4">
                          <div className="flex items-center gap-3 md:gap-4 bg-black/40 p-3 md:p-4 rounded-xl border border-gray-800">
                              <div className="p-2 md:p-3 bg-green-900/20 rounded-full text-green-500">
                                  <Ticket size={20} />
                              </div>
                              <div>
                                  <p className="text-[10px] md:text-xs text-gray-500 uppercase font-bold">Recompensa (Solo 1ª Vez)</p>
                                  <p className="text-lg md:text-xl font-bold text-white">{selectedChallenge.rewardCredits} Créditos</p>
                              </div>
                          </div>

                          <button 
                              onClick={handleStartGame}
                              className="w-full bg-cine-gold hover:bg-white text-black font-black text-lg md:text-xl py-3 md:py-4 rounded-xl shadow-[0_0_20px_rgba(212,175,55,0.4)] hover:scale-[1.02] transition-all flex items-center justify-center gap-2 md:gap-3 uppercase tracking-wide"
                          >
                              {user.isAdmin && (selectedChallenge.type === 'timeline' && user.watchedMovies.length < 5) ? (
                                  <><Shield size={20} fill="black" /> FORZAR INICIO (ADMIN)</>
                              ) : (
                                  <><Play size={20} fill="black" /> Comenzar Función</>
                              )}
                          </button>
                          
                          {currentLevel >= selectedChallenge.level && (
                              <p className="text-center text-[10px] md:text-xs text-gray-500 font-bold">
                                  * Ya has completado este nivel. Jugarás en modo repetición.
                              </p>
                          )}
                          
                          {selectedChallenge.type === 'timeline' && user.watchedMovies.length < 5 && !user.isAdmin && (
                              <p className="text-center text-[10px] md:text-xs text-red-500 font-bold flex items-center justify-center gap-1">
                                  <AlertTriangle size={12}/> Requisito: Ver 5 películas (Llevas {user.watchedMovies.length})
                              </p>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* POSTER GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
          {LEVEL_CHALLENGES.map((challenge, index) => {
              const isCompleted = currentLevel >= challenge.level;
              const isNext = currentLevel === challenge.level - 1;
              const isFuture = currentLevel < challenge.level - 1;
              
              // Only show relevant challenges (completed + next + 1 future teaser)
              if (isFuture && index > currentLevel + 2) return null;

              const xpRequired = XP_TABLE[challenge.level - 2] || 0;
              const hasEnoughXP = currentXP >= xpRequired;
              const isLocked = !isCompleted && (!isNext || !hasEnoughXP);

              return (
                  <div 
                    key={challenge.level}
                    className={`relative group rounded-xl overflow-hidden shadow-2xl transition-all duration-500 ${isLocked ? 'grayscale opacity-60' : 'hover:scale-105 cursor-pointer border-2 border-transparent hover:border-cine-gold'}`}
                    onClick={() => (!isLocked || user.isAdmin) && setSelectedChallenge(challenge)}
                  >
                      {/* POSTER IMAGE */}
                      <div className="aspect-[2/3] w-full bg-gray-900 relative overflow-hidden">
                          {/* We load the image even if locked, but maybe blurred */}
                          <img 
                            src={`https://image.pollinations.ai/prompt/${encodeURIComponent(challenge.imagePrompt)}?nologo=true&width=400&height=600&model=flux`} 
                            alt={challenge.title}
                            className={`w-full h-full object-cover transition-transform duration-700 ${isLocked ? 'blur-[2px]' : 'group-hover:scale-110'}`}
                            loading="lazy"
                          />
                          
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>

                          {/* OVERLAY STATUS */}
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-10">
                              {isLocked ? (
                                  <div className="bg-black/80 p-4 rounded-full backdrop-blur-md border border-gray-700">
                                      <Lock size={32} className="text-gray-500" />
                                  </div>
                              ) : isNext ? (
                                  <div className="bg-cine-gold/90 p-4 rounded-full backdrop-blur-md shadow-[0_0_30px_rgba(212,175,55,0.6)] animate-pulse">
                                      <Play size={32} fill="black" className="text-black ml-1" />
                                  </div>
                              ) : (
                                  <div className="bg-green-600/90 p-3 rounded-full backdrop-blur-md border border-green-400">
                                      <CheckCircle size={32} className="text-white" />
                                  </div>
                              )}
                          </div>

                          {/* ADMIN TEST BUTTON OVERLAY */}
                          {user.isAdmin && (
                              <div className="absolute top-2 right-2 z-50">
                                  <div className="bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg border border-blue-400 flex items-center gap-1 hover:bg-blue-500 transition-colors">
                                      <Shield size={10} fill="currentColor"/> TEST
                                  </div>
                              </div>
                          )}

                          {/* Level Badge */}
                          <div className="absolute top-2 left-2 z-20">
                              <div className="bg-black/60 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded border border-gray-700">
                                  NIVEL {challenge.level}
                              </div>
                          </div>

                          {/* XP Lock Warning */}
                          {isNext && !hasEnoughXP && (
                              <div className="absolute top-2 right-2 z-20">
                                  <div className="bg-red-900/80 backdrop-blur-md text-red-200 text-xs font-bold px-3 py-1 rounded border border-red-500 flex items-center gap-1">
                                      <Lock size={12}/> Faltan XP
                                  </div>
                              </div>
                          )}

                          {/* Bottom Info */}
                          <div className="absolute bottom-0 left-0 w-full p-4 z-20">
                              <h3 className="text-xl font-bold text-white leading-tight mb-1 drop-shadow-md font-serif uppercase">
                                  {challenge.title}
                              </h3>
                              <div className="flex items-center justify-between text-xs text-gray-300">
                                  <span className="uppercase tracking-widest">{challenge.type === 'timeline' ? 'Juego de Mesa' : challenge.type === 'boss' ? 'Jefe Final' : 'Trivial'}</span>
                                  {isCompleted && <span className="text-green-400 font-bold">Completado</span>}
                              </div>
                              
                              {/* XP Progress Bar if Next */}
                              {isNext && !isCompleted && (
                                  <div className="mt-3 w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full transition-all duration-1000 ${hasEnoughXP ? 'bg-green-500' : 'bg-cine-gold'}`}
                                        style={{ width: `${Math.min(100, (currentXP / xpRequired) * 100)}%` }}
                                      ></div>
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>
              );
          })}
      </div>
    </div>
  );
};

export default Arcade;
