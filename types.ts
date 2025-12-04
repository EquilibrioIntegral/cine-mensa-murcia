

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
  // Usage tracking for Voice Limits
  voiceUsageDate?: number; // Timestamp of last usage day
  voiceUsageSeconds?: number; // Seconds used today
  
  // GAMIFICATION
  xp: number;
  level: number;
  credits: number; // "Visiones de Taquilla" / Currency
  completedMissions: string[]; // IDs of completed missions
  inventory?: string[]; // IDs of items owned
  hasSeenWelcome?: boolean; // Flag for the Career Intro Modal
  gamificationStats?: Record<string, any>; // Tracks actions (booleans or counters)
  lastGamificationReset?: number; // Admin hard reset timestamp
  lastLevelUpTimestamp?: number; // Timestamp of when the current level was reached
  lastSeen?: number; // Timestamp for online status
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
  warningSentAt?: number; // Timestamp when a quality warning was sent
}

export enum ViewState {
  LOGIN,
  REGISTER, 
  NEWS, // New Home
  DASHBOARD, // Catalog
  RANKING,
  WATCHLIST,
  RECOMMENDATIONS,
  ADMIN_PANEL,
  MOVIE_DETAILS,
  PERSON_DETAILS, // New: Details of Actor/Director
  EVENTS,
  FEEDBACK,
  PROFILE,
  SHOP,    // New: Tienda de Premios
  ARCADE,   // New: Zona de Minijuegos/Misiones
  MAILBOX  // New: Personal System Mailbox
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
  audioBase64?: string; // New field for Real Human Voice
  timestamp: number;
  role?: 'user' | 'moderator' | 'system'; 
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
  
  // Social Commitment
  committedViewers?: string[]; // IDs of users who promise to watch
  committedDebaters?: string[]; // IDs of users who promise to attend debate
  
  // Time Voting (Doodle)
  timeVotes?: Record<string, string[]>; // Key: "Friday_22", Value: Array of UserIDs
  finalDebateDate?: number; // Timestamp of the chosen date
  debateDecisionMessage?: string; // AI explanation of the time choice

  // Debate Turn Management
  speakerQueue?: string[]; // UserIDs waiting to speak
  currentSpeakerId?: string | null; // UserID currently holding the mic
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  relatedMovies?: Movie[];
  relatedPeople?: any[]; // TMDBPersonResult[]
}

// --- NEWS & FEEDBACK TYPES ---

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  type: 'general' | 'update' | 'event';
  timestamp: number;
  imageUrl?: string; // Added support for news images
}

export interface AppFeedback {
  id: string;
  userId: string;
  userName: string;
  type: 'bug' | 'feature';
  text: string;
  status: 'pending' | 'solved';
  timestamp: number;
  adminResponse?: string;
}

// --- LIVE SESSION STATE ---
export interface LiveSessionState {
  isConnected: boolean;
  status: string;
  isUserSpeaking: boolean;
  isAiSpeaking: boolean;
  toolInUse: string | null;
  visualContent: {
    type: 'movie' | 'person';
    data: any; // Movie or TMDBPersonResult
  }[];
}

// --- GAMIFICATION TYPES ---
export interface Rank {
  id: string;
  title: string;
  minLevel: number;
  color: string; // Tailwind color class or hex
  icon: any;
}

export interface TriviaQuestion {
    id: number;
    text: string;
    options: string[];
    correctAnswer: number; // Index 0-3
    tmdbQuery?: string; // To fetch background image
}

export interface LevelChallenge {
    level: number; // The level you are TRYING to reach (e.g., 2)
    title: string;
    synopsis: string; // Narrative description
    imagePrompt: string; // For AI generation of the poster
    type: 'trivia' | 'boss' | 'timeline'; // Logic type
    rewardCredits: number;
    passingScore: number; // e.g., 16 out of 20
    questions?: TriviaQuestion[];
}

export interface Mission {
  id: string;
  rankId: string; // Links mission to a specific Rank
  title: string;
  description: string;
  xpReward: number;
  icon: any; // Lucide Icon component name or similar
  minLevel?: number; // Optional: Only unlocks at this level within the rank
  condition: (user: User, stats: { 
    ratingsCount: number, 
    reviewsCount: number, 
    likesReceived: number, 
    horrorCount: number,
    actionCount: number,
    comedyCount: number,
    dramaCount: number,
    scifiCount: number
  }) => boolean;
  maxProgress?: number; // For progress bars (e.g., 5/10)
}

export interface ShopItem {
  id: string;
  title: string;
  description: string;
  cost: number;
  minLevel: number;
  icon: any;
  type: 'cosmetic' | 'feature' | 'badge';
  prerequisiteId?: string; // NEW: Dependency on another item
}

export interface MilestoneEvent {
    type: 'welcome' | 'levelup' | 'challenge_ready';
    rankTitle: string;
    level: number;
}

// --- PRIVATE CHAT TYPES ---
export interface PrivateChatMessage {
    id: string;
    senderId: string;
    senderName: string;
    text: string;
    timestamp: number;
    type?: 'text' | 'system'; // New field for system messages
}

export interface PrivateChatSession {
    id: string;
    creatorId: string;
    targetId: string;
    creatorName: string;
    targetName: string;
    isActive: boolean;
    createdAt: number;
    typing?: Record<string, boolean>; // Map of userId -> isTyping
}

// --- MAILBOX TYPES ---
export interface MailboxMessage {
  id: string;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  type: 'system' | 'reward' | 'alert' | 'info';
  actionMovieId?: string; // Optional: ID of movie to redirect to for edits
}