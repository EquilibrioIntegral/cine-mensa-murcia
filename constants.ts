
import { Movie, UserRating, Rank, Mission, User } from "./types";
import { User as UserIcon, Star, Video, MessageSquare, Heart, Skull, Camera, Ticket } from 'lucide-react';

// Base de datos vacía como solicitado
export const INITIAL_MOVIES: Movie[] = [];

// Ratings vacíos
export const INITIAL_RATINGS: UserRating[] = [];

// Avatares seguros
export const STARTER_AVATARS = [
    { name: "Cinéfilo 1", url: "https://ui-avatars.com/api/?name=Cine+Fan&background=d4af37&color=000&size=200" },
    { name: "Cinéfilo 2", url: "https://ui-avatars.com/api/?name=Movie+Lover&background=aa2222&color=fff&size=200" },
    { name: "Director", url: "https://ui-avatars.com/api/?name=Director+Cut&background=0f1014&color=fff&size=200" },
    { name: "Guionista", url: "https://ui-avatars.com/api/?name=Writer&background=1e1f24&color=d4af37&size=200" },
    { name: "Clásico", url: "https://ui-avatars.com/api/?name=Classic&background=random&size=200" },
    { name: "Sci-Fi", url: "https://ui-avatars.com/api/?name=Sci+Fi&background=0000ff&color=fff&size=200" },
    { name: "Terror", url: "https://ui-avatars.com/api/?name=Horror&background=000&color=ff0000&size=200" },
    { name: "Indie", url: "https://ui-avatars.com/api/?name=Indie&background=ffff00&color=000&size=200" }
];

// --- GAMIFICATION CONSTANTS ---

export const RANKS: Rank[] = [
    { id: 'rank_1', title: 'Extra de Fondo', minLevel: 1, color: 'text-gray-500' },
    { id: 'rank_2', title: 'Acomodador', minLevel: 5, color: 'text-blue-400' },
    { id: 'rank_3', title: 'Proyeccionista', minLevel: 10, color: 'text-green-400' },
    { id: 'rank_4', title: 'Actor de Reparto', minLevel: 15, color: 'text-purple-400' },
    { id: 'rank_5', title: 'Estrella de Cine', minLevel: 25, color: 'text-cine-gold' },
    { id: 'rank_6', title: 'Director de Culto', minLevel: 40, color: 'text-red-500' },
    { id: 'rank_7', title: 'Leyenda del Séptimo Arte', minLevel: 60, color: 'text-yellow-200 shadow-[0_0_10px_gold]' },
];

export const XP_PER_LEVEL = 100; // Formula simplified: Level = floor(XP / 100) + 1

export const MISSIONS: Mission[] = [
    {
        id: 'm_avatar',
        title: 'Primer Plano',
        description: 'Personaliza tu avatar con una foto de TMDB.',
        xpReward: 50,
        icon: Camera,
        condition: (user, stats) => !user.avatarUrl.includes('ui-avatars.com')
    },
    {
        id: 'm_first_rate',
        title: 'Ópera Prima',
        description: 'Valora tu primera película.',
        xpReward: 50,
        icon: Star,
        condition: (user, stats) => stats.ratingsCount >= 1
    },
    {
        id: 'm_rate_5',
        title: 'Maratón de Cine',
        description: 'Valora 5 películas.',
        xpReward: 100,
        icon: Video,
        condition: (user, stats) => stats.ratingsCount >= 5,
        maxProgress: 5
    },
    {
        id: 'm_rate_25',
        title: 'Cinéfilo Compulsivo',
        description: 'Valora 25 películas.',
        xpReward: 300,
        icon: Video,
        condition: (user, stats) => stats.ratingsCount >= 25,
        maxProgress: 25
    },
    {
        id: 'm_review_1',
        title: 'La Pluma es Poderosa',
        description: 'Escribe tu primera reseña (con texto).',
        xpReward: 75,
        icon: MessageSquare,
        condition: (user, stats) => stats.reviewsCount >= 1
    },
    {
        id: 'm_likes_5',
        title: 'Influencer',
        description: 'Recibe 5 Likes en tus reseñas.',
        xpReward: 200,
        icon: Heart,
        condition: (user, stats) => stats.likesReceived >= 5,
        maxProgress: 5
    },
    {
        id: 'm_horror_3',
        title: 'Amante del Terror',
        description: 'Ve y valora 3 películas de Terror.',
        xpReward: 150,
        icon: Skull,
        condition: (user, stats) => stats.horrorCount >= 3,
        maxProgress: 3
    }
];
