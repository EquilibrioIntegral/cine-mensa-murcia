export interface Movie {
  id: string; // Internal ID
  tmdbId?: number; // TMDB ID
  title: string;
  year: number;
  director: string;
  genre: string[];
  posterUrl: string;
  backdropUrl?: string;
  description: string;
  cast?: string[];
  rating: number; // Global average rating in the club (0-10)
  totalVotes: number;
  recommendationReason?: string; // New field for AI reasoning
}

export type UserStatus = 'active' | 'pending' | 'rejected';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  watchedMovies: string[]; // Array of Movie IDs
  watchlist: string[]; // Array of Movie IDs
  status: UserStatus;
  isAdmin: boolean;
}

export interface DetailedRating {
  script: number;      // Guion
  direction: number;   // Direccion
  photography: number; // Fotografia
  acting: number;      // Actuacion
  soundtrack: number;  // Banda Sonora
  enjoyment: number;   // Disfrute
  average: number;     // Calculated average
}

export interface UserRating {
  movieId: string;
  userId: string;
  detailed: DetailedRating; // Updated from simple number
  rating: number; // Kept for backward compatibility (stores the average)
  comment?: string;
  spoiler?: string; // New field for spoiler content
  timestamp: number;
  likes?: string[]; // Array of User IDs who liked
  dislikes?: string[]; // Array of User IDs who disliked
}

export enum ViewState {
  LOGIN,
  REGISTER, 
  DASHBOARD,
  RANKING,
  WATCHLIST,
  RECOMMENDATIONS,
  ADMIN_PANEL,
  MOVIE_DETAILS,
  EVENTS // New View
}

// --- NEW EVENT TYPES ---

export type EventPhase = 'voting' | 'viewing' | 'discussion' | 'closed';

export interface EventCandidate {
  tmdbId: number;
  title: string;
  year: number;
  posterUrl: string;
  description: string;
  reason: string; // Why AI picked it for the theme
  votes: string[]; // Array of User IDs
}

export interface EventMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  timestamp: number;
  role?: 'user' | 'moderator' | 'system'; // Added role for AI Host
}

export interface CineEvent {
  id: string;
  themeTitle: string;
  themeDescription: string;
  aiReasoning: string;
  backdropUrl?: string; // Aesthetic background
  
  phase: EventPhase;
  startDate: number;
  votingDeadline: number;
  viewingDeadline: number;
  
  candidates: EventCandidate[];
  winnerTmdbId?: number; // Set after voting ends
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  relatedMovies?: Movie[];
}