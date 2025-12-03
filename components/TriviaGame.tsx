
import React, { useState, useEffect } from 'react';
import { LevelChallenge, TriviaQuestion } from '../types';
import { useData } from '../context/DataContext';
import { searchMoviesTMDB, getImageUrl } from '../services/tmdbService';
import { generateTriviaQuestions } from '../services/geminiService';
import { CheckCircle, XCircle, Trophy, Frown, Loader2, ShoppingBag, ArrowLeft, ZapOff, AlertTriangle } from 'lucide-react';

interface TriviaGameProps {
  challenge: LevelChallenge;
  onComplete: (score: number, passed: boolean, action?: 'close' | 'shop') => void;
  onClose: () => void;
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

const TriviaGame: React.FC<TriviaGameProps> = ({ challenge, onComplete, onClose }) => {
  const { tmdbToken } = useData();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [bgImage, setBgImage] = useState<string>('');
  const [gameState, setGameState] = useState<'intro' | 'loading' | 'playing' | 'feedback' | 'finished' | 'error'>('intro');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [currentTheme, setCurrentTheme] = useState('');
  const [errorType, setErrorType] = useState<'generic' | 'quota'>('generic');
  
  // Dynamic Questions State
  const [questions, setQuestions] = useState<TriviaQuestion[]>(challenge.questions || []);
  
  // Safely get current question with Render Protection
  const currentQuestion = questions && questions.length > 0 ? questions[currentQuestionIndex] : null;
  
  // DYNAMIC PASSING SCORE:
  // If we fell back to 5 questions, we can't require 16.
  // We require 80% of the actual question count.
  const actualPassingScore = Math.ceil(questions.length * 0.8);
  const passed = score >= actualPassingScore;

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

  const handleStart = async () => {
      const generalTheme = "Cultura General de Cine";
      setCurrentTheme(generalTheme);
      setGameState('loading');
      
      let safeQuestions: TriviaQuestion[] = [];

      try {
          const topic = challenge.type === 'boss' 
              ? challenge.title + " (Dificultad: Experto, preguntas técnicas sobre rodajes y dirección)" 
              : "Cine General Variado: Mezcla de todas las épocas, géneros populares, actores famosos, citas icónicas y películas premiadas. Que sea accesible y divertido.";
              
          const count = challenge.questions && challenge.questions.length > 0 ? challenge.questions.length : 10;
          
          // Call AI
          const aiQuestions = await generateTriviaQuestions(topic, count, challenge.type === 'boss' ? 'hard' : 'medium');
          
          // Validate AI output
          const validQuestions = validateQuestions(aiQuestions);

          if (validQuestions.length > 0) {
              safeQuestions = validQuestions;
          } else {
              console.warn("AI returned invalid questions, using fallback");
              safeQuestions = FALLBACK_QUESTIONS;
          }
      } catch (e: any) {
          // CHECK FOR QUOTA ERROR
          const errStr = String(e).toLowerCase();
          if (errStr.includes('429') || errStr.includes('quota') || errStr.includes('exhausted')) {
              setErrorType('quota');
              setGameState('error');
              return; // Stop here, show specific error screen
          }

          console.error("AI Gen Failed, using static/fallback", e);
          safeQuestions = FALLBACK_QUESTIONS;
      }

      // 2. PRECARGA INTELIGENTE (IMAGEN)
      // Check if we have questions and token. Try to load first image BEFORE showing game.
      if (safeQuestions.length > 0 && safeQuestions[0].tmdbQuery && tmdbToken) {
          try {
              const results = await searchMoviesTMDB(safeQuestions[0].tmdbQuery, tmdbToken);
              if (results && results.length > 0 && results[0].backdrop_path) {
                  const url = getImageUrl(results[0].backdrop_path, 'original');
                  
                  // Force browser to download image
                  const imgLoader = new Image();
                  imgLoader.src = url;
                  
                  // Wait for load or timeout (max 1.5s to keep it snappy)
                  await Promise.race([
                      new Promise((resolve) => { imgLoader.onload = resolve; imgLoader.onerror = resolve; }),
                      new Promise((resolve) => setTimeout(resolve, 1500)) 
                  ]);
                  
                  setBgImage(url);
              }
          } catch(e) {
              console.warn("Image preloading failed", e);
          }
      }

      setQuestions(safeQuestions);
      setGameState('playing');
  };

  const handleAnswer = (optionIndex: number) => {
      if (gameState !== 'playing' || !currentQuestion) return;
      
      setSelectedOption(optionIndex);
      const correct = optionIndex === currentQuestion.correctAnswer;
      setIsCorrect(correct);
      
      if (correct) {
          setScore(prev => prev + 1);
      }
      
      setGameState('feedback');

      setTimeout(() => {
          if (currentQuestionIndex < questions.length - 1) {
              setCurrentQuestionIndex(prev => prev + 1);
              setGameState('playing');
              setSelectedOption(null);
          } else {
              setGameState('finished');
          }
      }, 2000); // 2 seconds delay to show feedback
  };

  const handleFinish = (action: 'close' | 'shop') => {
      // Explicitly pass the calculated 'passed' status
      onComplete(score, passed, action);
  };

  // --- VIEW: INTRO ---
  if (gameState === 'intro') {
      return (
          <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in text-center">
              <div className="max-w-2xl w-full">
                  <h1 className="text-4xl md:text-6xl font-black text-cine-gold mb-6 uppercase tracking-wider animate-bounce-slow">
                      {challenge.title}
                  </h1>
                  <p className="text-xl text-white mb-8 italic font-serif leading-relaxed">
                      "{challenge.synopsis}"
                  </p>
                  
                  <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 mb-8 inline-block">
                      <p className="text-gray-300 font-bold mb-2">OBJETIVO DE LA MISIÓN</p>
                      <ul className="text-sm text-gray-400 text-left space-y-2">
                          <li>• Responde correctamente al <span className="text-white font-bold">80%</span> de las preguntas.</li>
                          <li>• Cada pregunta tiene un contexto visual.</li>
                      </ul>
                  </div>

                  <button 
                    onClick={handleStart}
                    className="bg-cine-gold hover:bg-white text-black font-black text-xl py-4 px-12 rounded-full shadow-[0_0_30px_rgba(212,175,55,0.6)] hover:scale-105 transition-all uppercase tracking-widest"
                  >
                      ¡Acción!
                  </button>
              </div>
          </div>
      );
  }

  // --- VIEW: LOADING ---
  if (gameState === 'loading') {
      return (
          <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in text-center">
             <Loader2 size={64} className="text-cine-gold animate-spin mb-4" />
             <h2 className="text-2xl font-bold text-white">El Director está escribiendo el guion...</h2>
             <p className="text-gray-400 mt-2">Generando preguntas únicas con IA sobre: <span className="text-cine-gold font-bold">{currentTheme}</span></p>
             <p className="text-xs text-gray-600 mt-4 animate-pulse">Pre-cargando escenas visuales...</p>
          </div>
      );
  }

  // --- VIEW: ERROR (SPECIFIC MESSAGE) ---
  if (gameState === 'error' && errorType === 'quota') {
      return (
          <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in text-center">
              <div className="bg-gray-900 border border-red-500/50 p-8 rounded-2xl max-w-md shadow-[0_0_50px_rgba(220,38,38,0.3)]">
                  <div className="w-20 h-20 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                      <ZapOff size={40} className="text-red-500" />
                  </div>
                  <h2 className="text-2xl font-black text-white mb-2 uppercase">EL CAMERINO ESTÁ CERRADO</h2>
                  <p className="text-gray-300 mb-6 leading-relaxed">
                      Nuestra IA Guionista ha trabajado demasiado hoy y necesita un descanso para recargar su creatividad.
                  </p>
                  <p className="text-sm text-gray-500 mb-8 italic">
                      Por favor, inténtalo de nuevo en unos minutos.
                  </p>
                  <button 
                    onClick={onClose}
                    className="w-full bg-gray-700 hover:bg-white hover:text-black text-white font-bold py-3 rounded-xl transition-all uppercase tracking-wide"
                  >
                      Entendido, volveré luego
                  </button>
              </div>
          </div>
      );
  }

  // --- VIEW: FINISHED ---
  if (gameState === 'finished') {
      return (
          <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in text-center">
              <div className="max-w-md w-full bg-cine-gray rounded-2xl border border-gray-700 p-8 shadow-2xl relative overflow-hidden">
                  {passed ? (
                      <>
                        <div className="absolute inset-0 bg-green-900/20"></div>
                        <div className="relative z-10">
                            <Trophy size={80} className="text-cine-gold mx-auto mb-6 animate-pulse" />
                            <h2 className="text-3xl font-black text-white mb-2 uppercase">¡MISIÓN CUMPLIDA!</h2>
                            <p className="text-gray-300 mb-6">Has demostrado tu valía, cinéfilo.</p>
                            <div className="text-6xl font-black text-green-500 mb-8">{score} <span className="text-lg text-gray-500">/ {questions.length}</span></div>
                            
                            <div className="bg-black/40 p-4 rounded-lg border border-cine-gold/30 mb-6">
                                <p className="text-gray-400 text-sm font-bold uppercase mb-1">Recompensas Obtenidas</p>
                                <p className="text-2xl font-black text-cine-gold">+{challenge.rewardCredits} Créditos</p>
                                <p className="text-green-400 text-xs font-bold mt-1">¡NIVEL SUBIDO!</p>
                            </div>

                            {/* Relative z-10 ensures buttons are clickable above background overlays */}
                            <div className="space-y-3 relative z-10">
                                <button 
                                    onClick={() => handleFinish('shop')}
                                    className="w-full bg-cine-gold text-black font-bold py-3 rounded-lg hover:bg-white transition-colors uppercase flex items-center justify-center gap-2 shadow-lg shadow-cine-gold/20 cursor-pointer"
                                >
                                    <ShoppingBag size={20}/> Ir a la Tienda
                                </button>
                                <button 
                                    onClick={() => handleFinish('close')}
                                    className="w-full bg-gray-700 text-white font-bold py-3 rounded-lg hover:bg-gray-600 transition-colors uppercase flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    <ArrowLeft size={20}/> Volver al Arcade
                                </button>
                            </div>
                        </div>
                      </>
                  ) : (
                      <>
                        <div className="absolute inset-0 bg-red-900/20"></div>
                        <div className="relative z-10">
                            <Frown size={80} className="text-red-500 mx-auto mb-6" />
                            <h2 className="text-3xl font-black text-white mb-2 uppercase">CORTE... ¡TOMA FALSA!</h2>
                            <p className="text-gray-300 mb-6">No has alcanzado la puntuación necesaria.</p>
                            <div className="text-6xl font-black text-red-500 mb-8">{score} <span className="text-lg text-gray-500">/ {questions.length}</span></div>
                            
                            <div className="relative z-10 flex gap-4">
                                <button 
                                    onClick={onClose}
                                    className="flex-1 bg-gray-700 text-white font-bold py-3 rounded-lg hover:bg-gray-600 transition-colors uppercase cursor-pointer"
                                >
                                    Salir
                                </button>
                                <button 
                                    onClick={() => { setScore(0); setCurrentQuestionIndex(0); handleStart(); }}
                                    className="flex-1 bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 transition-colors uppercase cursor-pointer"
                                >
                                    Reintentar
                                </button>
                            </div>
                        </div>
                      </>
                  )}
              </div>
          </div>
      );
  }

  // --- VIEW: PLAYING (CRASH PREVENTION) ---
  if (gameState === 'playing' && !currentQuestion) {
      return (
          <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in text-center">
              <AlertTriangle size={64} className="text-red-500 mb-4" />
              <h2 className="text-2xl font-bold text-white">Error de Producción</h2>
              <p className="text-gray-400 mb-6">No se pudieron cargar las preguntas (Error Interno).</p>
              <button 
                onClick={onClose}
                className="bg-gray-700 text-white px-6 py-2 rounded-full font-bold"
              >
                  Volver
              </button>
          </div>
      );
  }

  // --- VIEW: PLAYING (NORMAL) ---
  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col">
        {/* Background Layer */}
        <div className="absolute inset-0 z-0">
            {bgImage && (
                <img 
                    src={bgImage} 
                    className="w-full h-full object-cover opacity-80 transition-opacity duration-1000" 
                    alt="Background" 
                />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/60"></div>
        </div>

        {/* Content Layer */}
        <div className="relative z-10 flex-grow flex flex-col items-center justify-center p-4 max-w-4xl mx-auto w-full">
            
            {/* Header Status */}
            <div className="w-full flex justify-between items-center mb-8 bg-black/80 p-4 rounded-full border border-gray-600 backdrop-blur-md shadow-2xl">
                <span className="text-gray-200 font-bold font-mono shadow-black drop-shadow-md">
                    ESCENA {currentQuestionIndex + 1} <span className="text-gray-400">/ {questions.length}</span>
                </span>
                <span className="text-cine-gold font-black text-xl drop-shadow-md">
                    SCORE: {score}
                </span>
            </div>

            {/* Question Card */}
            <div className="w-full mb-8 text-center">
                 <h2 className="text-2xl md:text-4xl font-bold text-white leading-tight drop-shadow-[0_4px_4px_rgba(0,0,0,1)] px-6 py-4 bg-black/60 rounded-xl backdrop-blur-md inline-block border border-gray-700 shadow-xl">
                     "{currentQuestion?.text}"
                 </h2>
            </div>

            {/* Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                {currentQuestion?.options?.map((option, idx) => {
                    let btnClass = "bg-black/70 hover:bg-black/90 border-gray-500 text-white backdrop-blur-md";
                    
                    if (gameState === 'feedback') {
                        if (idx === currentQuestion.correctAnswer) {
                            btnClass = "bg-green-600 border-green-400 text-white shadow-[0_0_30px_rgba(34,197,94,0.8)] scale-105 z-20";
                        } else if (idx === selectedOption) {
                            btnClass = "bg-red-600 border-red-400 text-white opacity-80";
                        } else {
                            btnClass = "bg-black/40 border-gray-700 text-gray-500 opacity-30";
                        }
                    } else if (selectedOption === idx) {
                        btnClass = "bg-cine-gold text-black border-cine-gold";
                    }

                    return (
                        <button
                            key={idx}
                            disabled={gameState === 'feedback'}
                            onClick={() => handleAnswer(idx)}
                            className={`p-6 rounded-xl border-2 text-lg font-bold transition-all duration-200 transform active:scale-95 flex items-center justify-center text-center h-24 shadow-2xl ${btnClass}`}
                        >
                            {option}
                        </button>
                    );
                })}
            </div>

            {/* Feedback Overlay Message */}
            {gameState === 'feedback' && (
                <div className="absolute bottom-10 animate-bounce-slow z-30">
                    {isCorrect ? (
                        <div className="flex items-center gap-2 text-green-500 font-black text-2xl uppercase tracking-widest bg-black/90 px-8 py-3 rounded-full border border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.6)]">
                            <CheckCircle size={32}/> ¡Correcto!
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-red-500 font-black text-2xl uppercase tracking-widest bg-black/90 px-8 py-3 rounded-full border border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)]">
                            <XCircle size={32}/> ¡Corten! (Incorrecto)
                        </div>
                    )}
                </div>
            )}
            
            <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-red-400 p-2 bg-black/50 rounded-full transition-colors z-50">
                <XCircle size={24}/>
            </button>
        </div>
    </div>
  );
};

export default TriviaGame;
