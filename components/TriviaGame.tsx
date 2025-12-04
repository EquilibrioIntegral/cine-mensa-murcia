

import React, { useState, useEffect, useRef } from 'react';
import { LevelChallenge, TriviaQuestion } from '../types';
import { useData } from '../context/DataContext';
import { searchMoviesTMDB, getImageUrl } from '../services/tmdbService';
import { generateTriviaQuestions } from '../services/geminiService';
import { CheckCircle, XCircle, Trophy, Frown, Loader2, ShoppingBag, ArrowLeft, ZapOff, AlertTriangle, Swords, Clock, Zap, Crown, User as UserIcon } from 'lucide-react';

interface TriviaGameProps {
  challenge: LevelChallenge;
  onComplete: (score: number, passed: boolean, action?: 'close' | 'shop') => void;
  onClose: () => void;
  mode?: 'normal' | 'solo_survival' | 'online_duel';
  opponent?: { id: string, name: string, avatarUrl: string };
}

// 3. PREGUNTAS DE EMERGENCIA (Hardcoded Fallback)
const FALLBACK_QUESTIONS: TriviaQuestion[] = [
    {
        id: 1,
        text: "Hubo un pequeño error de guion con la IA. Pregunta de emergencia: ¿Quién dirigió 'Parque Jurásico'?",
        options: ["Steven Spielberg", "George Lucas", "James Cameron", "Ridley Scott"],
        correctAnswer: 0,
        tmdbQuery: "Jurassic Park"
    },
    {
        id: 2,
        text: "¿En qué año se estrenó el primer 'Star Wars'?",
        options: ["1977", "1980", "1983", "1999"],
        correctAnswer: 0,
        tmdbQuery: "Star Wars"
    },
    {
        id: 3,
        text: "¿Qué actor interpreta a Iron Man en el MCU?",
        options: ["Robert Downey Jr.", "Chris Evans", "Chris Hemsworth", "Mark Ruffalo"],
        correctAnswer: 0,
        tmdbQuery: "Iron Man"
    },
    {
        id: 4,
        text: "¿Cuál es la película más taquillera de la historia (sin ajuste de inflación)?",
        options: ["Avatar", "Avengers: Endgame", "Titanic", "Star Wars: El despertar de la fuerza"],
        correctAnswer: 0,
        tmdbQuery: "Avatar"
    },
    {
        id: 5,
        text: "¿Qué película ganó el Oscar a Mejor Película en 2020 haciendo historia?",
        options: ["Parásitos", "1917", "Joker", "Érase una vez en Hollywood"],
        correctAnswer: 0,
        tmdbQuery: "Parasite"
    }
];

// 1. FILTRO DE CALIDAD (VALIDACIÓN)
const validateQuestions = (qs: any[]): TriviaQuestion[] => {
    if (!Array.isArray(qs)) return [];
    return qs.filter((q) => {
        const hasText = typeof q.text === 'string' && q.text.trim().length > 0;
        const hasOptions = Array.isArray(q.options) && q.options.length >= 2 && q.options.every((o: any) => typeof o === 'string');
        const hasAnswer = typeof q.correctAnswer === 'number' && q.correctAnswer >= 0 && q.correctAnswer < q.options.length;
        return hasText && hasOptions && hasAnswer;
    });
};

const TriviaGame: React.FC<TriviaGameProps> = ({ challenge, onComplete, onClose, mode = 'normal', opponent }) => {
  const { tmdbToken, user, handleTriviaWin, allUsers, saveTriviaHighScore } = useData();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [bgImage, setBgImage] = useState<string>('');
  const [gameState, setGameState] = useState<'intro' | 'loading' | 'playing' | 'feedback' | 'finished' | 'error' | 'waiting_opponent'>('intro');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [currentTheme, setCurrentTheme] = useState('');
  const [errorType, setErrorType] = useState<'generic' | 'quota'>('generic');
  
  // Dynamic Questions State
  const [questions, setQuestions] = useState<TriviaQuestion[]>(challenge.questions || []);
  
  // Timer State (New)
  const [timeLeft, setTimeLeft] = useState(15);
  const timerRef = useRef<number | null>(null);

  // Online Duel State (Mocked)
  const [opponentScore, setOpponentScore] = useState(0);
  const [opponentAnswered, setOpponentAnswered] = useState(false);
  const [opponentCorrect, setOpponentCorrect] = useState(false);
  const [isRoundLocked, setIsRoundLocked] = useState(false); // Locked if someone answers first correctly

  const isSurvival = mode === 'solo_survival';
  const isDuel = mode === 'online_duel';
  
  // Safely get current question with Render Protection
  const currentQuestion = questions && questions.length > 0 ? questions[currentQuestionIndex] : null;
  
  // DYNAMIC PASSING SCORE:
  // If we fell back to 5 questions, we can't require 16.
  // We require 80% of the actual question count.
  const actualPassingScore = Math.ceil(questions.length * 0.8);
  const passed = isDuel ? score > opponentScore : score >= actualPassingScore;

  // --- TIMER LOGIC ---
  useEffect(() => {
      if (gameState === 'playing' && timeLeft > 0) {
          timerRef.current = window.setInterval(() => {
              setTimeLeft((prev) => prev - 1);
          }, 1000);
      } else if (timeLeft === 0 && gameState === 'playing') {
          // Time out logic
          handleTimeOut();
      }

      return () => {
          if (timerRef.current) clearInterval(timerRef.current);
      };
  }, [gameState, timeLeft]);

  const handleTimeOut = () => {
      if (isSurvival) {
          setGameState('finished'); // Game Over immediately
          saveTriviaHighScore(score);
      } else if (isDuel) {
          // In Duel, if timer runs out:
          // If opponent answered correctly, they won the point already (logic elsewhere).
          // If neither answered or both timed out:
          if (!opponentAnswered) {
              // Tie round - No points. Proceed.
              nextRoundLogic();
          } else {
              // Opponent answered but maybe wrong? If opponent answered, isRoundLocked would handle it or logic below.
              nextRoundLogic();
          }
      } else {
          // Normal mode: count as wrong, move next
          handleAnswer(-1); // -1 indicates timeout/wrong
      }
  };

  // --- OPPONENT SIMULATION (MOCK) ---
  useEffect(() => {
      if (isDuel && gameState === 'playing' && !isRoundLocked) {
          // Difficulty scaler for opponent: Harder rounds = slower/less accurate? Or maybe smarter?
          // Let's make opponent decent.
          const roundDifficulty = currentQuestionIndex < 3 ? 'easy' : currentQuestionIndex < 6 ? 'medium' : 'hard';
          
          let answerDelay = 0;
          let accuracy = 0;

          if (roundDifficulty === 'easy') {
              answerDelay = Math.random() * 5000 + 3000; // 3-8s
              accuracy = 0.8;
          } else if (roundDifficulty === 'medium') {
              answerDelay = Math.random() * 6000 + 4000; // 4-10s
              accuracy = 0.6;
          } else {
              answerDelay = Math.random() * 8000 + 5000; // 5-13s
              accuracy = 0.4;
          }

          const willBeCorrect = Math.random() < accuracy; 

          const opponentTimer = setTimeout(() => {
              if (gameState !== 'playing' || isRoundLocked || selectedOption !== null) return;
              
              setOpponentAnswered(true);
              
              if (willBeCorrect) {
                  setOpponentCorrect(true);
                  // First to answer rule: If I haven't answered yet, I lose the point opportunity
                  if (selectedOption === null) {
                      setIsRoundLocked(true);
                      setOpponentScore(s => s + 1);
                      // Show opponent win message briefly then next
                      setTimeout(() => {
                          nextRoundLogic();
                      }, 2000);
                  }
              } else {
                  setOpponentCorrect(false);
                  // Opponent failed, I still have chance if time remains
              }
          }, answerDelay);

          return () => clearTimeout(opponentTimer);
      }
  }, [gameState, currentQuestionIndex, isDuel, isRoundLocked, selectedOption]);


  // Fetch background image based on TMDB Query (For Q2 onwards or fallback)
  useEffect(() => {
    // Skip this effect for the first question if we are just starting (handled by preload in handleStart)
    // But allow it for subsequent navigation
    if (gameState === 'playing' && currentQuestion?.tmdbQuery && tmdbToken) {
      const fetchBg = async () => {
        try {
          const results = await searchMoviesTMDB(currentQuestion.tmdbQuery!, tmdbToken);
          if (results.length > 0 && results[0].backdrop_path) {
            setBgImage(getImageUrl(results[0].backdrop_path, 'original'));
          }
        } catch (e) {
          console.error("BG fetch error", e);
        }
      };
      
      // Delay slightly to prevent flashing if preload worked, mostly for Q2+
      const t = setTimeout(fetchBg, 100);
      return () => clearTimeout(t);
    } 
  }, [currentQuestionIndex, gameState, tmdbToken, currentQuestion]);

  const generateQuestions = async (round = 0) => {
      let safeQuestions: TriviaQuestion[] = [];
      const difficulty = round < 2 ? 'easy' : round < 5 ? 'medium' : 'hard';
      const count = (isSurvival || isDuel) ? 5 : (challenge.questions?.length || 10);

      try {
          const topic = challenge.type === 'boss' 
              ? challenge.title + " (Dificultad: Experto)" 
              : "Cine General Variado. Dificultad: " + difficulty;
              
          // Call AI
          const aiQuestions = await generateTriviaQuestions(topic, count, difficulty);
          
          // Validate AI output
          const validQuestions = validateQuestions(aiQuestions);

          if (validQuestions.length > 0) {
              safeQuestions = validQuestions;
          } else {
              safeQuestions = FALLBACK_QUESTIONS;
          }
      } catch (e: any) {
          const errStr = String(e).toLowerCase();
          // Detect quota errors explicitly
          if (errStr.includes('429') || errStr.includes('quota') || errStr.includes('exhausted')) {
              setErrorType('quota');
              setGameState('error');
              return [];
          }
          safeQuestions = FALLBACK_QUESTIONS;
      }
      return safeQuestions;
  }

  const handleStart = async () => {
      const generalTheme = "Cultura General de Cine";
      setCurrentTheme(generalTheme);
      setGameState('loading');
      
      // Initial Load
      const initQs = await generateQuestions(0);
      
      // Handle quota error case early
      if (initQs.length === 0 && errorType === 'quota') return;

      // 2. PRECARGA INTELIGENTE (IMAGEN)
      if (initQs.length > 0 && initQs[0].tmdbQuery && tmdbToken) {
          try {
              const results = await searchMoviesTMDB(initQs[0].tmdbQuery, tmdbToken);
              if (results && results.length > 0 && results[0].backdrop_path) {
                  const url = getImageUrl(results[0].backdrop_path, 'original');
                  const imgLoader = new Image();
                  imgLoader.src = url;
                  await Promise.race([
                      new Promise((resolve) => { imgLoader.onload = resolve; imgLoader.onerror = resolve; }),
                      new Promise((resolve) => setTimeout(resolve, 1500)) 
                  ]);
                  setBgImage(url);
              }
          } catch(e) { console.warn("Image preloading failed", e); }
      }

      setQuestions(initQs);
      setScore(0);
      setOpponentScore(0);
      setCurrentQuestionIndex(0);
      setTimeLeft(15);
      setGameState('playing');
  };

  const handleAnswer = (optionIndex: number) => {
      if (gameState !== 'playing' || !currentQuestion || isRoundLocked) return;
      
      setSelectedOption(optionIndex);
      const correct = optionIndex === currentQuestion.correctAnswer;
      setIsCorrect(correct);
      
      if (isDuel) {
          if (correct) {
              // I answered first correctly!
              setScore(prev => prev + 1);
              setIsRoundLocked(true); // Lock opponent
              setTimeout(nextRoundLogic, 2000);
          } else {
              // I answered wrong.
              // If opponent already failed, round ends with no points (or game over for round)
              if (opponentAnswered && !opponentCorrect) {
                  // Both failed. Logic: "Cuando ambos fallen gana el que mas puntos haya obtenido".
                  // This usually implies game ends.
                  setGameState('finished');
                  if (score > opponentScore) handleTriviaWin(user?.id || '');
              }
              // If opponent hasn't answered, wait for them/timer. I am locked out.
          }
      } else {
          // Normal / Survival
          if (correct) {
              setScore(prev => prev + 1);
              setTimeout(nextRoundLogic, 2000);
          } else {
              if (isSurvival) {
                  saveTriviaHighScore(score);
                  setGameState('finished'); // Game Over immediately
              } else {
                  setTimeout(nextRoundLogic, 2000);
              }
          }
      }
      
      if (!isDuel) setGameState('feedback');
  };

  const nextRoundLogic = async () => {
      setGameState('loading');
      setBgImage(''); 
      setSelectedOption(null);
      setIsRoundLocked(false);
      setOpponentAnswered(false);
      setOpponentCorrect(false);
      setTimeLeft(15);

      if (isSurvival || isDuel) {
          // Infinite Generation logic for survival / extended duel
          if (currentQuestionIndex >= questions.length - 1) {
              // Generate more!
              const newQs = await generateQuestions(questions.length / 5); // Increase round difficulty
              setQuestions(prev => [...prev, ...newQs]);
          }
          setCurrentQuestionIndex(prev => prev + 1);
          setGameState('playing');
      } else {
          // Fixed Length Normal Mode
          if (currentQuestionIndex < questions.length - 1) {
              setCurrentQuestionIndex(prev => prev + 1);
              setGameState('playing');
          } else {
              setGameState('finished');
          }
      }
  };

  const handleFinish = (action: 'close' | 'shop') => {
      onComplete(score, passed, action);
  };

  // --- VIEW: INTRO ---
  if (gameState === 'intro') {
      return (
          <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in text-center overflow-y-auto">
              <div className="max-w-2xl w-full my-auto">
                  <h1 className="text-3xl md:text-6xl font-black text-cine-gold mb-4 md:mb-6 uppercase tracking-wider animate-bounce-slow leading-tight">
                      {mode === 'solo_survival' ? 'SOLO SURVIVAL' : mode === 'online_duel' ? 'DUELO 1 VS 1' : challenge.title}
                  </h1>
                  <p className="text-sm md:text-xl text-white mb-6 md:mb-8 italic font-serif leading-relaxed px-4">
                      "{isSurvival ? "Resiste tanto como puedas. Un fallo y estás fuera." : isDuel ? "Sé más rápido que tu rival. El primero en acertar gana el punto." : challenge.synopsis}"
                  </p>
                  
                  {/* Opponent Display for Duel */}
                  {isDuel && opponent && (
                      <div className="flex items-center justify-center gap-8 mb-8 animate-slide-up">
                          <div className="flex flex-col items-center">
                              <img src={user?.avatarUrl} className="w-16 h-16 rounded-full border-2 border-cine-gold" />
                              <p className="text-white font-bold mt-2">{user?.name}</p>
                          </div>
                          <Swords size={32} className="text-red-500 animate-pulse" />
                          <div className="flex flex-col items-center">
                              <img src={opponent.avatarUrl} className="w-16 h-16 rounded-full border-2 border-red-500" />
                              <p className="text-white font-bold mt-2">{opponent.name}</p>
                          </div>
                      </div>
                  )}

                  <div className="bg-gray-800/50 p-4 md:p-6 rounded-xl border border-gray-700 mb-6 md:mb-8 inline-block text-left">
                      <p className="text-gray-300 font-bold mb-2 text-xs md:text-sm">REGLAS</p>
                      <ul className="text-xs md:text-sm text-gray-400 space-y-2">
                          {isSurvival && <li>• Dificultad progresiva. Fallo = Fin.</li>}
                          {isDuel && <li>• Gana quien responde <span className="text-green-400 font-bold">primero y bien</span>.</li>}
                          {isDuel && <li>• Si ambos falláis, gana quien tenga más puntos.</li>}
                          <li>• Tienes <span className="text-white font-bold">15 segundos</span> por pregunta.</li>
                      </ul>
                  </div>

                  <div>
                    <button 
                        onClick={handleStart}
                        className="bg-cine-gold hover:bg-white text-black font-black text-lg md:text-xl py-3 md:py-4 px-10 md:px-12 rounded-full shadow-[0_0_30px_rgba(212,175,55,0.6)] hover:scale-105 transition-all uppercase tracking-widest"
                    >
                        {isDuel ? <Swords size={24} className="inline mr-2"/> : <Zap size={24} className="inline mr-2"/>} ¡Acción!
                    </button>
                  </div>
              </div>
          </div>
      );
  }

  // --- VIEW: LOADING ---
  if (gameState === 'loading') {
      return (
          <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in text-center">
             <Loader2 size={48} className="text-cine-gold animate-spin mb-4" />
             <h2 className="text-xl md:text-2xl font-bold text-white">Preparando el Set...</h2>
             <p className="text-sm text-gray-400 mt-2">
                 {isSurvival ? `Ronda ${currentQuestionIndex + 1} - Buscando preguntas...` : 'La IA está eligiendo el desafío...'}
             </p>
          </div>
      );
  }

  // --- VIEW: FINISHED ---
  if (gameState === 'finished') {
      const isWinner = isDuel ? score > opponentScore : passed;
      const topScores = allUsers ? [...allUsers]
          .filter(u => u.triviaHighScore)
          .sort((a, b) => (b.triviaHighScore || 0) - (a.triviaHighScore || 0))
          .slice(0, 3) : [];

      return (
          <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in text-center">
              <div className="max-w-md w-full bg-cine-gray rounded-2xl border border-gray-700 p-6 md:p-8 shadow-2xl relative overflow-hidden">
                  {isWinner ? (
                      <>
                        <div className="absolute inset-0 bg-green-900/20"></div>
                        <div className="relative z-10">
                            <Trophy size={60} className="text-cine-gold mx-auto mb-4 md:mb-6 animate-bounce" />
                            <h2 className="text-2xl md:text-3xl font-black text-white mb-2 uppercase">{isDuel ? '¡VICTORIA!' : '¡MISIÓN CUMPLIDA!'}</h2>
                            <p className="text-sm md:text-base text-gray-300 mb-6">{isDuel ? `Has vencido ${score} a ${opponentScore}` : 'Has demostrado tu valía.'}</p>
                            
                            {isDuel && (
                                <div className="bg-black/40 p-4 rounded-lg border border-cine-gold/30 mb-6">
                                    <p className="text-green-400 font-bold uppercase mb-1">XP Ganada</p>
                                    <p className="text-2xl font-black text-cine-gold">+50 XP</p>
                                </div>
                            )}

                            <div className="space-y-3 relative z-10">
                                <button onClick={() => handleFinish('close')} className="w-full bg-gray-700 text-white font-bold py-3 rounded-lg hover:bg-gray-600 transition-colors uppercase flex items-center justify-center gap-2 cursor-pointer">
                                    <ArrowLeft size={18}/> Volver
                                </button>
                            </div>
                        </div>
                      </>
                  ) : (
                      <>
                        <div className="absolute inset-0 bg-red-900/20"></div>
                        <div className="relative z-10">
                            <Frown size={60} className="text-red-500 mx-auto mb-4 md:mb-6" />
                            <h2 className="text-2xl md:text-3xl font-black text-white mb-2 uppercase">GAME OVER</h2>
                            <p className="text-sm md:text-base text-gray-300 mb-6">{isDuel ? `Perdiste ${score} - ${opponentScore}` : `Puntuación final: ${score}`}</p>
                            
                            {isSurvival && (
                                <div className="mb-6 bg-black/40 p-4 rounded-xl border border-gray-700">
                                    <h4 className="text-cine-gold font-bold mb-3 flex items-center justify-center gap-2"><Crown size={16}/> Ranking Survival</h4>
                                    {topScores.map((u, i) => (
                                        <div key={i} className="flex justify-between items-center text-sm py-1 border-b border-gray-800 last:border-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-bold ${i===0?'text-yellow-400':i===1?'text-gray-400':'text-amber-700'}`}>#{i+1}</span>
                                                <img src={u.avatarUrl} className="w-6 h-6 rounded-full" />
                                                <span className="text-white truncate max-w-[100px]">{u.name}</span>
                                            </div>
                                            <span className="text-cine-gold font-bold">{u.triviaHighScore} pts</span>
                                        </div>
                                    ))}
                                    {/* My Score */}
                                    <div className="mt-3 pt-2 border-t border-gray-700 flex justify-between items-center text-sm bg-white/5 p-2 rounded">
                                        <span className="text-gray-400">Tu Puntuación:</span>
                                        <span className="text-white font-bold">{score} pts</span>
                                    </div>
                                </div>
                            )}

                            <div className="relative z-10 flex gap-4">
                                <button onClick={onClose} className="flex-1 bg-gray-700 text-white font-bold py-3 rounded-lg hover:bg-gray-600 transition-colors uppercase cursor-pointer">Salir</button>
                                <button onClick={() => { setScore(0); setCurrentQuestionIndex(0); handleStart(); }} className="flex-1 bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 transition-colors uppercase cursor-pointer">Reintentar</button>
                            </div>
                        </div>
                      </>
                  )}
              </div>
          </div>
      );
  }

  // --- VIEW: ERROR (Quota Exceeded or Generic) ---
  if (gameState === 'error') {
      return (
          <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col items-center justify-center p-4">
              <AlertTriangle size={48} className="text-red-500 mb-4" />
              <h2 className="text-xl font-bold text-white">Corte de Producción</h2>
              <p className="text-gray-400 text-center max-w-md mt-2">
                  {errorType === 'quota' 
                      ? "La IA de Google ha alcanzado su límite de cuota gratuito." 
                      : "Error técnico inesperado al generar las preguntas."}
              </p>
              
              <div className="flex gap-4 mt-6">
                  <button 
                      onClick={() => {
                          setQuestions(FALLBACK_QUESTIONS);
                          setScore(0);
                          setOpponentScore(0);
                          setCurrentQuestionIndex(0);
                          setTimeLeft(15);
                          setGameState('playing');
                      }} 
                      className="bg-cine-gold text-black px-6 py-2 rounded-full font-bold"
                  >
                      Usar Preguntas de Emergencia (Offline)
                  </button>
                  <button onClick={onClose} className="bg-gray-700 text-white px-6 py-2 rounded-full font-bold">Salir</button>
              </div>
          </div>
      );
  }

  // --- VIEW: PLAYING ---
  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col overflow-hidden">
        {/* Background Layer */}
        <div className="absolute inset-0 z-0">
            {bgImage && (
                <img 
                    src={bgImage} 
                    className="w-full h-full object-cover opacity-40 transition-opacity duration-1000" 
                    alt="Background" 
                />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/80"></div>
        </div>

        {/* Content Layer (Flex container to handle height nicely) */}
        <div className="relative z-10 flex-grow flex flex-col p-4 max-w-4xl mx-auto w-full h-full justify-center">
            
            {/* Header Status */}
            <div className="flex-shrink-0 w-full flex justify-between items-center mb-4 md:mb-8 bg-black/80 px-4 py-2 md:p-4 rounded-full border border-gray-600 backdrop-blur-md shadow-2xl relative overflow-hidden">
                <div className="absolute bottom-0 left-0 h-1 bg-cine-gold transition-all duration-1000 ease-linear" style={{ width: `${(timeLeft / 15) * 100}%` }}></div>
                
                <span className="text-gray-200 font-bold font-mono text-xs md:text-base flex items-center gap-2">
                    <Clock size={16} className={timeLeft < 5 ? 'text-red-500 animate-pulse' : 'text-gray-400'}/> {timeLeft}s
                </span>
                
                {isDuel ? (
                    <div className="flex gap-4 font-black text-xl items-center">
                        <div className="flex items-center gap-2">
                            <span className="text-green-500">{score}</span>
                            <span className="text-[10px] text-green-500/50 uppercase">Tú</span>
                        </div>
                        <span className="text-gray-500 text-sm">VS</span>
                        <div className="flex items-center gap-2">
                            <span className="text-red-500">{opponentScore}</span>
                            <span className="text-[10px] text-red-500/50 uppercase">Rival</span>
                        </div>
                    </div>
                ) : (
                    <span className="text-cine-gold font-black text-sm md:text-xl drop-shadow-md">
                        SCORE: {score}
                    </span>
                )}
            </div>

            {/* Duel Status */}
            {isDuel && (
                <div className="flex justify-center mb-4 min-h-[30px]">
                    {isRoundLocked ? (
                        <span className="bg-red-600 text-white px-4 py-1 rounded-full font-bold animate-pulse shadow-lg text-sm">¡Punto Asignado!</span>
                    ) : opponentAnswered ? (
                        <span className="bg-blue-600 text-white px-4 py-1 rounded-full font-bold shadow-lg text-sm flex items-center gap-2"><Swords size={14}/> Rival ha respondido...</span>
                    ) : (
                        <div className="flex items-center gap-2 text-gray-400 text-xs bg-black/40 px-3 py-1 rounded-full border border-gray-700">
                            {opponent && <img src={opponent.avatarUrl} className="w-4 h-4 rounded-full"/>}
                            <span>Rival pensando...</span>
                        </div>
                    )}
                </div>
            )}

            {/* Question Card - Flexible Height */}
            <div className="flex-grow-0 w-full mb-6 md:mb-10 text-center flex items-center justify-center min-h-[80px]">
                 <h2 className="text-lg md:text-4xl font-bold text-white leading-tight drop-shadow-[0_4px_4px_rgba(0,0,0,1)] px-4 py-4 md:px-6 md:py-6 bg-black/60 rounded-xl backdrop-blur-md border border-gray-700 shadow-xl max-h-[30vh] overflow-y-auto">
                     "{currentQuestion?.text}"
                 </h2>
            </div>

            {/* Options Grid - Dynamic Heights */}
            <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 w-full mb-8 md:mb-0">
                {currentQuestion?.options?.map((option, idx) => {
                    let btnClass = "bg-black/70 hover:bg-black/90 border-gray-500 text-white backdrop-blur-md";
                    
                    if (gameState === 'feedback' && !isDuel) { // Only show feedback in normal/survival immediately
                        if (idx === currentQuestion.correctAnswer) {
                            btnClass = "bg-green-600 border-green-400 text-white shadow-[0_0_30px_rgba(34,197,94,0.8)] scale-105 z-20";
                        } else if (idx === selectedOption) {
                            btnClass = "bg-red-600 border-red-400 text-white opacity-80";
                        } else {
                            btnClass = "bg-black/40 border-gray-700 text-gray-500 opacity-30";
                        }
                    } else if (selectedOption === idx) {
                        // In Duel, selection marks it yellow until round lock resolves
                        btnClass = "bg-cine-gold text-black border-cine-gold scale-105 shadow-[0_0_20px_rgba(212,175,55,0.5)]";
                    }

                    return (
                        <button
                            key={idx}
                            disabled={gameState === 'feedback' || isRoundLocked || (isDuel && selectedOption !== null)}
                            onClick={() => handleAnswer(idx)}
                            className={`p-4 md:p-6 rounded-xl border-2 text-sm md:text-lg font-bold transition-all duration-200 transform active:scale-95 flex items-center justify-center text-center shadow-2xl min-h-[4rem] md:min-h-[6rem] ${btnClass}`}
                        >
                            {option}
                        </button>
                    );
                })}
            </div>
            
            <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-red-400 p-2 bg-black/50 rounded-full transition-colors z-50">
                <XCircle size={24}/>
            </button>
        </div>
    </div>
  );
};

export default TriviaGame;