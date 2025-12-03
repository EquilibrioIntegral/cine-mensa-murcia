
import React, { useState, useEffect } from 'react';
import { LevelChallenge, TriviaQuestion } from '../types';
import { useData } from '../context/DataContext';
import { searchMoviesTMDB, getImageUrl } from '../services/tmdbService';
import { generateTriviaQuestions } from '../services/geminiService';
import { CheckCircle, XCircle, Trophy, Frown, Loader2, ShoppingBag, ArrowLeft, AlertTriangle } from 'lucide-react';

interface TriviaGameProps {
  challenge: LevelChallenge;
  onComplete: (score: number, passed: boolean, action?: 'close' | 'shop') => void;
  onClose: () => void;
}

// Fallback questions in case everything fails to prevent crash
const FALLBACK_QUESTIONS: TriviaQuestion[] = [
    {
        id: 1,
        text: "Hubo un error de conexión con la IA. Pregunta de emergencia: ¿Quién dirigió 'Parque Jurásico'?",
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
        text: "¿Qué actor interpreta a Iron Man?",
        options: ["Robert Downey Jr.", "Chris Evans", "Chris Hemsworth", "Mark Ruffalo"],
        correctAnswer: 0,
        tmdbQuery: "Iron Man"
    }
];

const TriviaGame: React.FC<TriviaGameProps> = ({ challenge, onComplete, onClose }) => {
  const { tmdbToken } = useData();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [bgImage, setBgImage] = useState<string>('');
  const [gameState, setGameState] = useState<'intro' | 'loading' | 'playing' | 'feedback' | 'finished'>('intro');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [currentTheme, setCurrentTheme] = useState('');
  
  // Dynamic Questions State
  const [questions, setQuestions] = useState<TriviaQuestion[]>(challenge.questions || []);
  
  // Safely get current question
  const currentQuestion = questions && questions.length > 0 ? questions[currentQuestionIndex] : null;
  const passed = score >= challenge.passingScore;

  // Fetch background image based on TMDB Query
  useEffect(() => {
    if (gameState === 'playing' && currentQuestion?.tmdbQuery && tmdbToken) {
      const fetchBg = async () => {
        try {
          const results = await searchMoviesTMDB(currentQuestion.tmdbQuery!, tmdbToken);
          if (results.length > 0 && results[0].backdrop_path) {
            setBgImage(getImageUrl(results[0].backdrop_path, 'original'));
          }
        } catch (e) {
          console.error(e);
        }
      };
      fetchBg();
    } else {
        setBgImage(''); // Reset or default
    }
  }, [currentQuestionIndex, gameState, tmdbToken, currentQuestion]);

  const handleStart = async () => {
      // SETTING TOPIC TO GENERAL CINEMA (As requested)
      const generalTheme = "Cultura General de Cine";
      setCurrentTheme(generalTheme);
      
      setGameState('loading');
      
      try {
          // Define a broad, varied topic for the AI
          const topic = challenge.type === 'boss' 
              ? challenge.title + " (Dificultad: Experto, preguntas técnicas sobre rodajes y dirección)" 
              : "Cine General Variado: Mezcla de todas las épocas, géneros populares, actores famosos, citas icónicas y películas premiadas. Que sea accesible y divertido.";
              
          const count = challenge.questions && challenge.questions.length > 0 ? challenge.questions.length : 20;
          
          // Call AI Service
          const aiQuestions = await generateTriviaQuestions(topic, count, challenge.type === 'boss' ? 'hard' : 'medium');
          
          if (aiQuestions && aiQuestions.length > 0) {
              setQuestions(aiQuestions);
          } else {
              // Fallback to static if AI fails
              console.warn("AI didn't return questions, using fallback/static");
              const staticQuestions = challenge.questions && challenge.questions.length > 0 ? challenge.questions : FALLBACK_QUESTIONS;
              setQuestions(staticQuestions);
          }
      } catch (e) {
          console.error("AI Gen Failed, using static/fallback", e);
          const staticQuestions = challenge.questions && challenge.questions.length > 0 ? challenge.questions : FALLBACK_QUESTIONS;
          setQuestions(staticQuestions);
      } finally {
          setGameState('playing');
      }
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
      onComplete(score, passed, action);
  };

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
                          <li>• Responde correctamente a <span className="text-white font-bold">{challenge.passingScore}</span> de <span className="text-white font-bold">{challenge.questions?.length || 20}</span> preguntas.</li>
                          <li>• Cada pregunta tiene un contexto visual.</li>
                          <li>• Las preguntas son de cine general variado.</li>
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

  if (gameState === 'loading') {
      return (
          <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in text-center">
             <Loader2 size={64} className="text-cine-gold animate-spin mb-4" />
             <h2 className="text-2xl font-bold text-white">El Director está escribiendo el guion...</h2>
             <p className="text-gray-400 mt-2">Generando preguntas nuevas con IA sobre: <span className="text-cine-gold font-bold">{currentTheme}</span></p>
          </div>
      );
  }

  if (gameState === 'finished') {
      return (
          <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in text-center">
              <div className="max-w-md w-full bg-cine-gray rounded-2xl border border-gray-700 p-8 shadow-2xl relative overflow-hidden">
                  {passed ? (
                      <>
                        <div className="absolute inset-0 bg-green-900/20"></div>
                        <Trophy size={80} className="text-cine-gold mx-auto mb-6 animate-pulse" />
                        <h2 className="text-3xl font-black text-white mb-2 uppercase">¡MISIÓN CUMPLIDA!</h2>
                        <p className="text-gray-300 mb-6">Has demostrado tu valía, cinéfilo.</p>
                        <div className="text-6xl font-black text-green-500 mb-8">{score} <span className="text-lg text-gray-500">/ {questions.length}</span></div>
                        
                        {/* REWARDS CALCULATION DISPLAY */}
                        <div className="bg-black/40 p-4 rounded-lg border border-cine-gold/30 mb-6">
                            <p className="text-gray-400 text-sm font-bold uppercase mb-1">Recompensas Obtenidas</p>
                            <p className="text-2xl font-black text-cine-gold">+{challenge.rewardCredits} Créditos</p>
                            <p className="text-green-400 text-xs font-bold mt-1">¡NIVEL SUBIDO!</p>
                        </div>

                        <div className="space-y-3">
                            <button 
                                onClick={() => handleFinish('shop')}
                                className="w-full bg-cine-gold text-black font-bold py-3 rounded-lg hover:bg-white transition-colors uppercase flex items-center justify-center gap-2 shadow-lg shadow-cine-gold/20"
                            >
                                <ShoppingBag size={20}/> Ir a la Tienda
                            </button>
                            <button 
                                onClick={() => handleFinish('close')}
                                className="w-full bg-gray-700 text-white font-bold py-3 rounded-lg hover:bg-gray-600 transition-colors uppercase flex items-center justify-center gap-2"
                            >
                                <ArrowLeft size={20}/> Volver al Arcade
                            </button>
                        </div>
                      </>
                  ) : (
                      <>
                        <div className="absolute inset-0 bg-red-900/20"></div>
                        <Frown size={80} className="text-red-500 mx-auto mb-6" />
                        <h2 className="text-3xl font-black text-white mb-2 uppercase">CORTE... ¡TOMA FALSA!</h2>
                        <p className="text-gray-300 mb-6">No has alcanzado la puntuación necesaria.</p>
                        <div className="text-6xl font-black text-red-500 mb-8">{score} <span className="text-lg text-gray-500">/ {questions.length}</span></div>
                        <div className="flex gap-4">
                            <button 
                                onClick={onClose}
                                className="flex-1 bg-gray-700 text-white font-bold py-3 rounded-lg hover:bg-gray-600 transition-colors uppercase"
                            >
                                Salir
                            </button>
                            <button 
                                onClick={() => { setScore(0); setCurrentQuestionIndex(0); handleStart(); }}
                                className="flex-1 bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 transition-colors uppercase"
                            >
                                Reintentar
                            </button>
                        </div>
                      </>
                  )}
              </div>
          </div>
      );
  }

  // --- CRASH PREVENTION ---
  // If we are in playing state but no question is found (index out of bounds or empty array), show error instead of crashing
  if (gameState === 'playing' && !currentQuestion) {
      return (
          <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in text-center">
              <AlertTriangle size={64} className="text-red-500 mb-4" />
              <h2 className="text-2xl font-bold text-white">Error de Producción</h2>
              <p className="text-gray-400 mb-6">No se pudieron cargar las preguntas. Inténtalo de nuevo.</p>
              <button 
                onClick={onClose}
                className="bg-gray-700 text-white px-6 py-2 rounded-full font-bold"
              >
                  Volver
              </button>
          </div>
      );
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col">
        {/* Background Layer - Increased opacity and better gradient for visibility */}
        <div className="absolute inset-0 z-0">
            {bgImage && (
                <img 
                    src={bgImage} 
                    className="w-full h-full object-cover opacity-80 transition-opacity duration-1000" 
                    alt="Background" 
                />
            )}
            {/* Lighter gradient to show more image details */}
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
