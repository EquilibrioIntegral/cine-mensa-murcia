
import React, { useState, useEffect, useRef } from 'react';
import { LevelChallenge, Movie } from '../types';
import { useData } from '../context/DataContext';
import { generateTimelineScenes } from '../services/geminiService';
import { Loader2, ArrowDown, CheckCircle, XCircle, Film, ShoppingBag, ArrowLeft, Trophy, AlertTriangle, Plus, Heart } from 'lucide-react';

interface TimelineGameProps {
  challenge: LevelChallenge;
  onComplete: (score: number, passed: boolean, action?: 'close' | 'shop') => void;
  onClose: () => void;
}

// --- HELPER: Image URL Generator ---
const getSceneImageUrl = (movieTitle: string, description: string) => {
    const visualPrompt = `cinematic movie shot from ${movieTitle}: ${description}, photorealistic, 4k, movie scene`;
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(visualPrompt)}?width=400&height=225&model=flux-realism&nologo=true`;
};

// --- SUBCOMPONENT: Placed Card (Timeline Item) ---
const TimelineCard = ({ scene, movieTitle }: { scene: any, movieTitle: string }) => {
    // We assume image is already cached by browser from the "Draw" phase
    const imageUrl = getSceneImageUrl(movieTitle, scene.description);

    return (
        <div className="flex flex-col items-center animate-scale-in w-32 md:w-44 flex-shrink-0 group select-none mx-1">
            <div className="w-full bg-gray-900 rounded-lg border-2 border-gray-600 overflow-hidden shadow-lg group-hover:border-cine-gold transition-all flex flex-col h-full">
                <div className="w-full h-20 md:h-28 relative flex-shrink-0">
                    <img 
                        src={imageUrl} 
                        alt="Scene" 
                        className="w-full h-full object-cover"
                    />
                </div>
                <div className="bg-black p-2 border-t border-gray-700 flex-grow flex items-center justify-center min-h-[4rem]">
                    <p className="text-[10px] md:text-xs text-gray-300 leading-tight text-center font-medium">
                        {scene.description}
                    </p>
                </div>
            </div>
            {/* Visual connector line for timeline */}
            <div className="w-full h-1 bg-gray-700 mt-2 rounded-full relative">
                <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-gray-500 rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
            </div>
        </div>
    );
};

// --- SUBCOMPONENT: Drop Zone ---
const DropZone = ({ onClick, disabled }: { onClick: () => void, disabled: boolean }) => {
    return (
        <button 
            onClick={onClick}
            disabled={disabled}
            className="group flex flex-col items-center justify-center w-8 md:w-12 mx-1 md:mx-2 transition-all flex-shrink-0 h-40 md:h-52 opacity-70 hover:opacity-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
            <div className="w-8 h-8 rounded-full bg-gray-800 border-2 border-gray-600 flex items-center justify-center group-hover:bg-cine-gold group-hover:border-cine-gold group-hover:scale-125 transition-all shadow-lg z-10">
                <Plus size={16} className="text-gray-400 group-hover:text-black" />
            </div>
            <div className="h-full w-0.5 bg-gray-700 group-hover:bg-cine-gold/50 mt-2 transition-colors rounded-full"></div>
        </button>
    );
};

const TimelineGame: React.FC<TimelineGameProps> = ({ challenge, onComplete, onClose }) => {
    const { movies, user } = useData();
    
    // Game Flow States
    const [gameState, setGameState] = useState<'intro' | 'setup' | 'playing' | 'result' | 'error'>('intro');
    const [loadingText, setLoadingText] = useState('');
    
    // Logic Data
    const [moviesToPlay, setMoviesToPlay] = useState<Movie[]>([]);
    const [currentMovieIndex, setCurrentMovieIndex] = useState(0);
    const [scenesDeck, setScenesDeck] = useState<any[]>([]);
    const [timeline, setTimeline] = useState<any[]>([]);
    const [currentCard, setCurrentCard] = useState<any>(null);
    const [cardImageLoading, setCardImageLoading] = useState(false);
    
    // Score & Feedback
    const [lives, setLives] = useState(3);
    const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
    const [streak, setStreak] = useState(0); // Completed movies without failing

    const TOTAL_MOVIES = 3;

    // --- INIT ---
    useEffect(() => {
        if (!user) return;
        
        let pool = movies.filter(m => user.watchedMovies.includes(m.id));
        // Admin fallback
        if (user.isAdmin && pool.length < 3) {
            const extras = movies.filter(m => !user.watchedMovies.includes(m.id));
            pool = [...pool, ...extras];
        }

        if (pool.length < 3) {
            // Not enough movies logic handled in parent usually, but safe guard here
            return; 
        }

        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        setMoviesToPlay(shuffled.slice(0, TOTAL_MOVIES));
    }, []);

    // --- GAME LOGIC ---

    const startMovie = async () => {
        setGameState('setup');
        setLoadingText(`Revisando guion de "${moviesToPlay[currentMovieIndex].title}"...`);
        setTimeline([]);
        setScenesDeck([]);
        setCurrentCard(null);
        setFeedback(null);

        try {
            const movie = moviesToPlay[currentMovieIndex];
            const rawScenes = await generateTimelineScenes(movie.title);
            
            if (!rawScenes || rawScenes.length < 5) throw new Error("Not enough scenes");

            // 1. Shuffle deck
            const deck = [...rawScenes].sort(() => 0.5 - Math.random());
            
            // 2. Take first card and place it on timeline immediately (Starter card)
            const starter = deck.pop();
            
            // Preload starter image
            const starterImg = new Image();
            starterImg.src = getSceneImageUrl(movie.title, starter.description);
            
            setTimeline([starter]);
            setScenesDeck(deck);
            
            // Start drawing
            setGameState('playing');
            drawNextCard(deck);

        } catch (e) {
            console.error(e);
            setGameState('error');
        }
    };

    const drawNextCard = (currentDeck: any[]) => {
        if (currentDeck.length === 0) {
            handleMovieComplete();
            return;
        }

        const next = currentDeck.pop();
        setScenesDeck([...currentDeck]); // Update deck state
        setCurrentCard(next);
        
        // Load Image
        setCardImageLoading(true);
        const img = new Image();
        img.src = getSceneImageUrl(moviesToPlay[currentMovieIndex].title, next.description);
        img.onload = () => setCardImageLoading(false);
        img.onerror = () => setCardImageLoading(false);
    };

    const handlePlaceCard = (insertIndex: number) => {
        if (feedback) return; // Prevent double clicks during anim

        // VALIDATION LOGIC
        // Card is correct if:
        // 1. Previous card (if exists) has ID < current.ID
        // 2. Next card (if exists) has ID > current.ID
        
        const prevCard = insertIndex > 0 ? timeline[insertIndex - 1] : null;
        const nextCard = insertIndex < timeline.length ? timeline[insertIndex] : null;
        
        const isAfterPrev = prevCard ? prevCard.id < currentCard.id : true;
        const isBeforeNext = nextCard ? nextCard.id > currentCard.id : true;
        
        const isCorrect = isAfterPrev && isBeforeNext;

        if (isCorrect) {
            setFeedback('correct');
            // Add to timeline visually
            const newTimeline = [...timeline];
            newTimeline.splice(insertIndex, 0, currentCard);
            setTimeline(newTimeline);
            
            setTimeout(() => {
                setFeedback(null);
                drawNextCard([...scenesDeck]);
            }, 1000);
        } else {
            setFeedback('wrong');
            setLives(l => l - 1);
            
            if (lives <= 1) {
                setTimeout(() => setGameState('result'), 1500); // Game Over
            } else {
                // Auto-place it correctly or discard?
                // Mechanics choice: Timeline usually discards. But to learn, let's place it correctly but lose a life.
                // Find correct spot
                const correctIndex = timeline.findIndex(c => c.id > currentCard.id);
                const finalIndex = correctIndex === -1 ? timeline.length : correctIndex;
                
                const newTimeline = [...timeline];
                newTimeline.splice(finalIndex, 0, currentCard);
                setTimeline(newTimeline);

                setTimeout(() => {
                    setFeedback(null);
                    drawNextCard([...scenesDeck]);
                }, 1500);
            }
        }
    };

    const handleMovieComplete = () => {
        if (currentMovieIndex < TOTAL_MOVIES - 1) {
            setStreak(s => s + 1);
            setCurrentMovieIndex(idx => idx + 1);
            setTimeout(startMovie, 1000);
        } else {
            setStreak(s => s + 1);
            setGameState('result'); // Win
        }
    };

    // --- RENDERS ---

    if (gameState === 'intro') {
        return (
            <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in text-center">
                <Film size={64} className="text-cine-gold mb-6 animate-pulse"/>
                <h1 className="text-4xl font-black text-white mb-4 uppercase tracking-widest">{challenge.title}</h1>
                <p className="text-gray-300 max-w-md mx-auto mb-8 leading-relaxed italic">"{challenge.synopsis}"</p>
                
                <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 mb-8 text-left max-w-sm mx-auto">
                    <h4 className="text-cine-gold font-bold mb-3 text-sm uppercase">Instrucciones:</h4>
                    <ul className="text-sm text-gray-300 space-y-2">
                        <li className="flex items-center gap-2"><ArrowDown size={14}/> Saca una carta de escena.</li>
                        <li className="flex items-center gap-2"><ArrowDown size={14}/> Colócala en el orden cronológico correcto.</li>
                        <li className="flex items-center gap-2"><Heart size={14} className="text-red-500"/> Tienes {lives} vidas para completar 3 películas.</li>
                    </ul>
                </div>

                <button onClick={startMovie} className="bg-cine-gold hover:bg-white text-black font-black text-lg py-4 px-12 rounded-full shadow-[0_0_30px_rgba(212,175,55,0.6)] hover:scale-105 transition-all uppercase tracking-widest">
                    ¡Acción!
                </button>
            </div>
        );
    }

    if (gameState === 'setup') {
        return (
            <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col items-center justify-center p-4">
                <Loader2 size={48} className="text-cine-gold animate-spin mb-4" />
                <h2 className="text-xl font-bold text-white">{loadingText}</h2>
            </div>
        );
    }

    if (gameState === 'result') {
        const passed = lives > 0;
        return (
            <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in text-center">
                <div className="max-w-md w-full bg-cine-gray rounded-2xl border border-gray-700 p-8 shadow-2xl relative overflow-hidden">
                    <div className={`absolute inset-0 ${passed ? 'bg-green-900/20' : 'bg-red-900/20'}`}></div>
                    <div className="relative z-10">
                        {passed ? <Trophy size={64} className="text-cine-gold mx-auto mb-6 animate-bounce" /> : <AlertTriangle size={64} className="text-red-500 mx-auto mb-6" />}
                        <h2 className="text-3xl font-black text-white mb-2 uppercase">{passed ? '¡CORTE FINAL!' : '¡PRODUCCIÓN CANCELADA!'}</h2>
                        <p className="text-gray-300 mb-6">{passed ? 'Has montado la trilogía perfectamente.' : 'Demasiados errores de continuidad. El director está furioso.'}</p>
                        
                        {passed && (
                            <div className="bg-black/40 p-4 rounded-lg border border-cine-gold/30 mb-6">
                                <p className="text-gray-400 text-xs font-bold uppercase mb-1">Recompensa</p>
                                <p className="text-2xl font-black text-cine-gold">+{challenge.rewardCredits} Créditos</p>
                            </div>
                        )}

                        <div className="flex gap-4 justify-center">
                            {passed ? (
                                <button onClick={() => onComplete(3, true, 'shop')} className="bg-cine-gold text-black font-bold py-3 px-6 rounded-lg uppercase flex items-center gap-2 shadow-lg hover:bg-white transition-colors">
                                    <ShoppingBag size={18}/> Tienda
                                </button>
                            ) : (
                                <button onClick={onClose} className="bg-gray-700 text-white font-bold py-3 px-6 rounded-lg uppercase hover:bg-gray-600 transition-colors">
                                    Salir
                                </button>
                            )}
                            {passed && <button onClick={() => onComplete(3, true, 'close')} className="bg-gray-700 text-white font-bold py-3 px-6 rounded-lg uppercase hover:bg-gray-600 transition-colors">Volver</button>}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // PLAYING STATE
    const currentMovie = moviesToPlay[currentMovieIndex];
    const imageUrl = currentCard ? getSceneImageUrl(currentMovie.title, currentCard.description) : '';

    return (
        <div className="fixed inset-0 z-[70] bg-black flex flex-col">
            {/* Top Bar */}
            <div className="bg-black/80 p-4 border-b border-gray-800 flex justify-between items-center z-20">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><ArrowLeft size={24}/></button>
                    <div>
                        <h3 className="font-bold text-white text-sm md:text-lg flex items-center gap-2"><Film size={16} className="text-cine-gold"/> {currentMovie.title}</h3>
                        <p className="text-xs text-gray-500 uppercase">Película {currentMovieIndex + 1} / {TOTAL_MOVIES}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {[...Array(3)].map((_, i) => (
                        <Heart key={i} size={20} fill={i < lives ? "#ef4444" : "none"} className={i < lives ? "text-red-500" : "text-gray-800"} />
                    ))}
                </div>
            </div>

            {/* Main Area: Card to Play */}
            <div className="flex-grow flex flex-col items-center justify-center p-4 relative overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
                
                {/* Current Card Stage */}
                <div className={`transition-all duration-500 transform ${feedback ? 'scale-90 opacity-50' : 'scale-100 opacity-100'} z-10 flex flex-col items-center`}>
                    <p className="text-cine-gold font-bold uppercase tracking-widest text-xs mb-4 animate-pulse">
                        {cardImageLoading ? 'REVELANDO FOTOGRAMA...' : 'SIGUIENTE ESCENA'}
                    </p>
                    
                    <div className="w-64 md:w-80 bg-gray-900 rounded-xl border-4 border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden relative group">
                        {cardImageLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-20">
                                <Loader2 size={48} className="text-cine-gold animate-spin" />
                            </div>
                        )}
                        <div className="w-full h-48 md:h-60 relative">
                            <img src={imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="Card" />
                        </div>
                        <div className="bg-black/90 p-4 border-t border-gray-700 min-h-[4rem] flex items-center justify-center">
                            <p className="text-white font-medium text-center text-sm md:text-base leading-snug">"{currentCard?.description}"</p>
                        </div>
                        
                        {/* Feedback Overlay */}
                        {feedback && (
                            <div className={`absolute inset-0 flex items-center justify-center backdrop-blur-sm z-30 ${feedback === 'correct' ? 'bg-green-900/40' : 'bg-red-900/40'}`}>
                                {feedback === 'correct' ? <CheckCircle size={80} className="text-green-500 animate-bounce" /> : <XCircle size={80} className="text-red-500 animate-shake" />}
                            </div>
                        )}
                    </div>
                    
                    <p className="text-gray-400 text-xs mt-4 animate-fade-in opacity-80">Selecciona el hueco correcto en la línea de tiempo abajo 👇</p>
                </div>
            </div>

            {/* Bottom Timeline (Horizontal Scroll) */}
            <div className="h-64 bg-gray-900/95 border-t border-gray-700 backdrop-blur-md overflow-x-auto flex items-center px-4 md:px-8 gap-0 relative z-20 custom-scrollbar">
                {/* Start Drop Zone */}
                <DropZone onClick={() => handlePlaceCard(0)} disabled={!!feedback || cardImageLoading} />

                {timeline.map((scene, idx) => (
                    <React.Fragment key={scene.id}>
                        <TimelineCard scene={scene} movieTitle={currentMovie.title} />
                        <DropZone onClick={() => handlePlaceCard(idx + 1)} disabled={!!feedback || cardImageLoading} />
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};

export default TimelineGame;
