

import React, { useEffect, useState } from 'react';
import { generateCareerStory } from '../services/geminiService';
import { MilestoneEvent } from '../types';
import { Trophy, Loader2, PlayCircle, Star, Gamepad2, ArrowRight } from 'lucide-react';
import RankBadge from './RankBadge';
import { ViewState } from '../types';
import { useData } from '../context/DataContext';

interface CareerMilestoneModalProps {
    event: MilestoneEvent;
    userName: string;
    onClose: () => void;
    onAction: () => void;
}

const CareerMilestoneModal: React.FC<CareerMilestoneModalProps> = ({ event, userName, onClose, onAction }) => {
    const { setView } = useData();
    const [storyData, setStoryData] = useState<{ story: string, visualPrompt: string } | null>(null);
    const [loading, setLoading] = useState(true);

    // If it's just a "Challenge Ready" notification, we don't need AI story generation necessarily, 
    // but we can generate a "Call to Adventure" text.
    useEffect(() => {
        const fetchStory = async () => {
            setLoading(true);
            try {
                if (event.type === 'challenge_ready') {
                    // Quick mock for challenge ready to avoid AI latency for simple notification
                    setStoryData({
                        story: "Has acumulado la experiencia necesaria. El estudio te observa. Es hora de demostrar que estás listo para el siguiente nivel.",
                        visualPrompt: "cinematic movie poster of a hero facing a challenge gate, golden light, epic atmosphere"
                    });
                } else {
                    const result = await generateCareerStory(
                        userName, 
                        event.rankTitle, 
                        event.type === 'welcome'
                    );
                    setStoryData(result);
                }
            } catch (error) {
                console.error(error);
                // Fallback
                setStoryData({ story: "Tu carrera avanza...", visualPrompt: "cinema" });
            } finally {
                setLoading(false);
            }
        };

        fetchStory();
    }, [event, userName]);

    const imageUrl = storyData 
        ? `https://image.pollinations.ai/prompt/${encodeURIComponent(storyData.visualPrompt)}?nologo=true&width=800&height=600&model=flux`
        : null;

    const handleChallengeAction = () => {
        onClose();
        setView(ViewState.ARCADE);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-fade-in">
            <div className="max-w-2xl w-full bg-cine-dark rounded-2xl border border-cine-gold/50 shadow-[0_0_100px_rgba(212,175,55,0.3)] overflow-hidden relative">
                
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-cine-gold rounded-full filter blur-[100px] opacity-10 pointer-events-none"></div>

                {loading ? (
                    <div className="h-96 flex flex-col items-center justify-center text-cine-gold space-y-4">
                        <Loader2 size={64} className="animate-spin" />
                        <p className="text-xl font-serif italic animate-pulse">
                            {event.type === 'welcome' ? "Escribiendo tu guion inicial..." : "La crítica está deliberando..."}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {/* Image Section */}
                        <div className="relative h-64 w-full overflow-hidden">
                            {imageUrl && (
                                <img 
                                    src={imageUrl} 
                                    alt="Career Milestone" 
                                    className="w-full h-full object-cover animate-scale-in"
                                />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-cine-dark via-transparent to-transparent"></div>
                            
                            <div className="absolute bottom-4 left-6">
                                <h2 className="text-4xl font-black text-white drop-shadow-[0_4px_0_#000] uppercase italic tracking-tighter leading-none">
                                    {event.type === 'welcome' ? '¡Luces, Cámara, Acción!' : 
                                     event.type === 'challenge_ready' ? '¡Ascenso Disponible!' : 
                                     '¡Nuevo Rango Alcanzado!'}
                                </h2>
                            </div>
                        </div>

                        {/* Content Section */}
                        <div className="p-8 text-center relative z-10">
                            <div className="mb-6 flex justify-center">
                                <div className="scale-150 transform">
                                    <RankBadge level={event.level} size="lg" />
                                </div>
                            </div>
                            
                            <div className="bg-black/40 p-6 rounded-xl border border-cine-gold/20 mb-8 backdrop-blur-sm">
                                <p className="text-xl font-serif text-gray-200 leading-relaxed italic">
                                    "{storyData?.story}"
                                </p>
                            </div>

                            {event.type === 'challenge_ready' ? (
                                <button 
                                    onClick={handleChallengeAction}
                                    className="bg-cine-gold hover:bg-white text-black font-black py-4 px-10 rounded-full text-lg shadow-[0_0_30px_rgba(212,175,55,0.4)] hover:scale-105 transition-transform flex items-center gap-3 mx-auto uppercase tracking-wide"
                                >
                                    <Gamepad2 size={24} fill="black"/> Ir a la Zona de Retos <ArrowRight size={24}/>
                                </button>
                            ) : (
                                <button 
                                    onClick={onAction}
                                    className="bg-gradient-to-r from-cine-gold to-yellow-600 text-black font-black py-4 px-10 rounded-full text-lg shadow-[0_0_30px_rgba(212,175,55,0.4)] hover:scale-105 transition-transform flex items-center gap-3 mx-auto"
                                >
                                    {event.type === 'welcome' ? (
                                        <> <PlayCircle size={24} fill="black" className="text-cine-gold"/> Iniciar mi Carrera </>
                                    ) : (
                                        <> <Trophy size={24} fill="black" className="text-cine-gold"/> Ver mis Nuevos Privilegios </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CareerMilestoneModal;