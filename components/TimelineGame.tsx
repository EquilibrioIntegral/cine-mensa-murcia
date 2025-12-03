

import React, { useState, useEffect } from 'react';
import { LevelChallenge, Movie } from '../types';
import { useData } from '../context/DataContext';
import { generateTimelineScenes } from '../services/geminiService';
import { getImageUrl } from '../services/tmdbService';
import { Loader2, ArrowUp, ArrowDown, CheckCircle, XCircle, Film, ShoppingBag, ArrowLeft, Trophy } from 'lucide-react';

interface TimelineGameProps {
  challenge: LevelChallenge;
  onComplete: (score: number, passed: boolean, action?: 'close' | 'shop') => void;
  onClose: () => void;
}

// Draggable Item Component
const SceneCard = ({ scene, index, total, moveScene, isChecking, isCorrect }: any) => {
    return (
        <div className="flex items-center gap-4 group">
            {/* Index Indicator (Film Sprocket Style) */}
            <div className="hidden md:flex flex-col gap-1 opacity-30 group-hover:opacity-60 transition-opacity">
                <div className="w-4 h-3 bg-white rounded-sm"></div>
                <div className="w-4 h-3 bg-white rounded-sm"></div>
                <div className="w-4 h-3 bg-white rounded-sm"></div>
            </div>

            {/* The Card */}
            <div className={`flex-grow bg-black/80 backdrop-blur-md border-2 p-4 rounded-xl relative transition-all duration-300 ${isChecking ? (isCorrect ? 'border-green-500 bg-green-900/20' : 'border-red-500 bg-red-900/20') : 'border-gray-700 hover:border-cine-gold cursor-grab active:cursor-grabbing'}`}>
                {/* Visual Connector Line */}
                {index < total - 1 && (
                    <div className="absolute left-1/2 -bottom-6 w-0.5 h-6 bg-gray-600 -ml-0.5 z-0 hidden md:block"></div>
                )}
                
                <div className="flex justify-between items-center relative z-10">
                    <p className="text-gray-200 text-sm md:text-base font-medium leading-tight">
                        {scene.description}
                    </p>
                    
                    {!isChecking && (
                        <div className="flex flex-col gap-1 ml-4">
                            <button 
                                onClick={() => moveScene(index, -1)} 
                                disabled={index === 0}
                                className="p-1 hover:bg-white/20 rounded disabled:opacity-20 transition-colors"
                            >
                                <ArrowUp size={16} />
                            </button>
                            <button 
                                onClick={() => moveScene(index, 1)} 
                                disabled={index === total - 1}
                                className="p-1 hover:bg-white/20 rounded disabled:opacity-20 transition-colors"
                            >
                                <ArrowDown size={16} />
                            </button>
                        </div>
                    )}
                    
                    {isChecking && (
                        <div className="ml-4">
                            {isCorrect ? <CheckCircle className="text-green-500" /> : <XCircle className="text-red-500" />}
                        </div>
                    )}
                </div>
            </div>
            
            <div className="hidden md:flex flex-col gap-1 opacity-30 group-hover:opacity-60 transition-opacity">
                <div className="w-4 h-3 bg-white rounded-sm"></div>
                <div className="w-4 h-3 bg-white rounded-sm"></div>
                <div className="w-4 h-3 bg-white rounded-sm"></div>
            </div>
        </div>
    );
};

const TimelineGame: React.FC<TimelineGameProps> = ({ challenge, onComplete, onClose }) => {
    const { movies, user } = useData();
    const [gameState, setGameState] = useState<'intro' | 'loading' | 'playing' | 'checking' | 'success' | 'fail' | 'complete'>('intro');
    const [round, setRound] = useState(1);
    const [moviesToPlay, setMoviesToPlay] = useState<Movie[]>([]);
    const [scenes, setScenes] = useState<{id: number, description: string}[]>([]);
    const [backgroundUrl, setBackgroundUrl] = useState('');
    const [loadingText, setLoadingText] = useState('');

    const TOTAL_ROUNDS = 3;

    // Pick 3 random movies on mount
    useEffect(() => {
        if (!user) return;
        
        let pool = movies.filter(m => user.watchedMovies.includes(m.id));
        
        // ADMIN FALLBACK: If admin doesn't have enough watched movies, use ANY movies from DB
        if (user.isAdmin && pool.length < 3) {
            // Get movies NOT in watched list to fill the gap
            const extras = movies.filter(m => !user.watchedMovies.includes(m.id));
            pool = [...pool, ...extras];
        }

        // If we still don't have enough (database empty?), we can't play
        if (pool.length < 3) {
            // This case handles rare empty DB scenario
            return; 
        }

        // Shuffle and pick 3
        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        setMoviesToPlay(shuffled.slice(0, 3));
    }, []);

    const startRound = async () => {
        setGameState('loading');
        setLoadingText(`Buscando rollos de película... (${round}/${TOTAL_ROUNDS})`);
        
        const currentMovie = moviesToPlay[round - 1];
        if (!currentMovie) {
            onClose();
            return;
        }
        setBackgroundUrl(currentMovie.backdropUrl || '');

        try {
            const generatedScenes = await generateTimelineScenes(currentMovie.title);
            
            if (generatedScenes.length < 5) {
                // Fallback or retry logic could go here, for now just skip/fail gracefully
                throw new Error("Not enough scenes generated");
            }

            // Shuffle scenes for the player
            const shuffledScenes = [...generatedScenes].sort(() => 0.5 - Math.random());
            setScenes(shuffledScenes);
            setGameState('playing');

        } catch (e) {
            console.error("Timeline error", e);
            // In a real app, maybe pick another movie or show error
            onClose(); 
        }
    };

    const moveScene = (index: number, direction: number) => {
        const newScenes = [...scenes];
        const targetIndex = index + direction;
        
        // Swap
        const temp = newScenes[index];
        newScenes[index] = newScenes[targetIndex];
        newScenes[targetIndex] = temp;
        
        setScenes(newScenes);
    };

    const checkOrder = () => {
        setGameState('checking');
        
        // 1. Create the perfect sorted order based on IDs (correct chronological order)
        const sorted = [...scenes].sort((a, b) => a.id - b.id);

        // 2. Count how many items are NOT in their correct sorted position index
        let mistakes = 0;
        scenes.forEach((scene, index) => {
            if (scene.id !== sorted[index].id) {
                mistakes++;
            }
        });

        // 3. Determine Success: Allow up to 2 positional errors.
        // Swapping two adjacent cards creates 2 positional errors (e.g., A is in B's spot, B is in A's spot).
        // So mistakes <= 2 essentially means "One move wrong allowed".
        const passed = mistakes <= 2;

        setTimeout(() => {
            if (passed) {
                if (round < TOTAL_ROUNDS) {
                    setGameState('success');
                } else {
                    setGameState('complete');
                }
            } else {
                setGameState('fail');
            }
        }, 1500);
    };

    const handleNextRound = () => {
        setRound(r => r + 1);
        startRound();
    };

    const handleFinish = (action: 'close' | 'shop') => {
        onComplete(3, true, action); // 3 rounds passed
    };

    // --- VIEWS ---

    if (gameState === 'intro') {
        return (
            <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in text-center">
                <div className="max-w-2xl w-full">
                    <Film size={64} className="text-cine-gold mx-auto mb-6 animate-pulse"/>
                    <h1 className="text-3xl md:text-5xl font-black text-white mb-6 uppercase tracking-wider">
                        {challenge.title}
                    </h1>
                    <p className="text-lg text-gray-300 mb-8 italic font-serif leading-relaxed">
                        "{challenge.synopsis}"
                    </p>
                    <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 mb-8 inline-block text-left">
                        <p className="text-gray-300 font-bold mb-2 text-sm uppercase tracking-wide">Misión:</p>
                        <ul className="text-sm text-gray-400 space-y-2">
                            <li>• Ordena cronológicamente 10 escenas.</li>
                            <li>• Completa 3 películas.</li>
                            <li>• <span className="text-green-400 font-bold">Se permite 1 pequeño fallo por película.</span></li>
                        </ul>
                    </div>
                    <div>
                        <button 
                            onClick={startRound}
                            className="bg-cine-gold hover:bg-white text-black font-black text-lg py-4 px-12 rounded-full shadow-[0_0_30px_rgba(212,175,55,0.6)] hover:scale-105 transition-all uppercase tracking-widest"
                        >
                            Entrar al Taller
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (gameState === 'loading') {
        return (
            <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col items-center justify-center p-4">
                <Loader2 size={48} className="text-cine-gold animate-spin mb-4" />
                <h2 className="text-xl font-bold text-white">{loadingText}</h2>
            </div>
        );
    }

    if (gameState === 'complete') {
        return (
            <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in text-center">
                <div className="max-w-md w-full bg-cine-gray rounded-2xl border border-cine-gold p-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-green-900/20"></div>
                    <div className="relative z-10">
                        <Trophy size={64} className="text-cine-gold mx-auto mb-6 animate-bounce" />
                        <h2 className="text-3xl font-black text-white mb-2 uppercase">¡PROYECTOR CONSEGUIDO!</h2>
                        <p className="text-gray-300 mb-6">Has demostrado tener un ojo clínico para el montaje. Tu amigo te regala el proyector y los créditos prometidos.</p>
                        
                        <div className="bg-black/40 p-4 rounded-lg border border-cine-gold/30 mb-6">
                            <p className="text-gray-400 text-xs font-bold uppercase mb-1">Recompensas</p>
                            <p className="text-2xl font-black text-cine-gold">+{challenge.rewardCredits} Créditos</p>
                            <p className="text-green-400 text-xs font-bold mt-1">¡NIVEL 3 DESBLOQUEADO!</p>
                        </div>

                        <div className="space-y-3">
                            <button onClick={() => handleFinish('shop')} className="w-full bg-cine-gold text-black font-bold py-3 rounded-lg hover:bg-white transition-colors uppercase flex items-center justify-center gap-2 shadow-lg">
                                <ShoppingBag size={18}/> Ir a la Tienda
                            </button>
                            <button onClick={() => handleFinish('close')} className="w-full bg-gray-700 text-white font-bold py-3 rounded-lg hover:bg-gray-600 transition-colors uppercase flex items-center justify-center gap-2">
                                <ArrowLeft size={18}/> Volver al Arcade
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (gameState === 'fail') {
        return (
            <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in text-center">
                <div className="max-w-md w-full bg-cine-gray rounded-2xl border border-red-500 p-8 shadow-2xl">
                    <XCircle size={64} className="text-red-500 mx-auto mb-6" />
                    <h2 className="text-2xl font-black text-white mb-2 uppercase">MONTAJE ERRÓNEO</h2>
                    <p className="text-gray-300 mb-6">"¡Esto no tiene sentido! La historia no encaja." - Tu amigo el montador.</p>
                    <div className="flex gap-4">
                        <button onClick={onClose} className="flex-1 bg-gray-700 text-white font-bold py-3 rounded-lg hover:bg-gray-600 transition-colors">Salir</button>
                        <button onClick={() => { setRound(1); startRound(); }} className="flex-1 bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 transition-colors">Reintentar</button>
                    </div>
                </div>
            </div>
        );
    }

    if (gameState === 'success') {
        return (
            <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in text-center">
                <CheckCircle size={64} className="text-green-500 mx-auto mb-6 animate-pulse" />
                <h2 className="text-2xl font-black text-white mb-2 uppercase">¡ROLLO COMPLETADO!</h2>
                <p className="text-gray-300 mb-6">Película {round} de {TOTAL_ROUNDS} montada correctamente.</p>
                <button 
                    onClick={handleNextRound}
                    className="bg-cine-gold text-black font-bold py-3 px-8 rounded-full hover:bg-white transition-colors uppercase tracking-widest shadow-lg"
                >
                    Siguiente Película
                </button>
            </div>
        );
    }

    // PLAYING STATE
    const currentMovie = moviesToPlay[round - 1];

    // Create a sorted copy to visually check against in the render (for the check circles)
    const sortedForCheck = [...scenes].sort((a, b) => a.id - b.id);

    return (
        <div className="fixed inset-0 z-[70] bg-black flex flex-col overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 z-0">
                {backgroundUrl && (
                    <img src={backgroundUrl} className="w-full h-full object-cover opacity-60 blur-[2px] transition-opacity duration-1000" alt="Background" />
                )}
                {/* Lighter gradient to make image more visible */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black"></div>
            </div>

            <div className="relative z-10 flex-grow flex flex-col p-4 max-w-2xl mx-auto w-full h-full">
                
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-white drop-shadow-md">{currentMovie?.title}</h2>
                        <p className="text-xs text-cine-gold font-mono uppercase">Película {round} / {TOTAL_ROUNDS}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white"><XCircle size={24}/></button>
                </div>

                {/* Timeline Area (Scrollable) */}
                <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 space-y-4 pb-20">
                    <div className="text-center text-xs text-gray-500 mb-2 uppercase tracking-widest font-bold">INICIO DE LA PELÍCULA</div>
                    
                    {scenes.map((scene, idx) => (
                        <SceneCard 
                            key={scene.id} 
                            scene={scene}
                            index={idx}
                            total={scenes.length}
                            moveScene={moveScene}
                            isChecking={gameState === 'checking' || gameState === 'fail' || gameState === 'success'}
                            isCorrect={scene.id === sortedForCheck[idx].id} // Compare against true sorted position
                        />
                    ))}

                    <div className="text-center text-xs text-gray-500 mt-2 uppercase tracking-widest font-bold">FINAL DE LA PELÍCULA</div>
                </div>

                {/* Footer Action */}
                <div className="mt-4 pt-4 border-t border-gray-800 text-center">
                    <button 
                        onClick={checkOrder}
                        disabled={gameState === 'checking'}
                        className="w-full bg-cine-gold hover:bg-white text-black font-black py-4 rounded-xl shadow-lg transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {gameState === 'checking' ? <Loader2 className="animate-spin"/> : <CheckCircle size={20}/>}
                        {gameState === 'checking' ? 'Comprobando montaje...' : 'COMPROBAR MONTAJE'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TimelineGame;