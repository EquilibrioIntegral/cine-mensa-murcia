
import { Movie, UserRating, Rank, Mission, User, ShopItem, LevelChallenge } from "./types";
import { User as UserIcon, Star, Video, MessageSquare, Heart, Skull, Camera, Ticket, Zap, Laugh, BookOpen, Rocket, Crown, Palette, Megaphone, Film, Coffee, Armchair, Users, UserPlus, Clapperboard, PenTool, Briefcase, Globe, Award, Scroll, Glasses, Bug, Search, ListVideo, Sparkles, Trophy, Radar, ThumbsUp, Newspaper, Bot, MessageCircle } from 'lucide-react';

export const MIN_REVIEW_WORDS = 50;

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

export const XP_TABLE = [
    100,    // Lvl 1 -> 2
    232,    // Lvl 2 -> 3
    401,    // Lvl 3 -> 4
    613,    // Lvl 4 -> 5 (Rank Up to Proyeccionista)
    875,    // Lvl 5 -> 6
    1195,   // Lvl 6 -> 7
    1582,   // Lvl 7 -> 8
    2046,   // Lvl 8 -> 9
    2599,   // Lvl 9 -> 10
    3254,   // Lvl 10 -> 11
    4025,   // Lvl 11 -> 12
    4929,   // Lvl 12 -> 13
    5984,   // Lvl 13 -> 14
    7211,   // Lvl 14 -> 15
    8633,   // Lvl 15 -> 16
    10275,  // Lvl 16 -> 17
    12166,  // Lvl 17 -> 18
    14336,  // Lvl 18 -> 19
    16820,  // Lvl 19 -> 20
    19656,  // Lvl 20 -> 21
    22886,  // Lvl 21 -> 22
    26557,  // Lvl 22 -> 23
    30720,  // Lvl 23 -> 24
    35431   // Lvl 24 -> 25
];

// Generar el resto hasta nivel 100
for (let i = 25; i <= 100; i++) {
    const prevTotal = XP_TABLE[XP_TABLE.length - 1];
    const nextLevelCost = Math.floor(100 * Math.pow(i, 1.35)); 
    XP_TABLE.push(prevTotal + nextLevelCost);
}

export const LEVEL_CHALLENGES: LevelChallenge[] = [
    // RETO INICIAL (Para subir a Nivel 2)
    { 
        level: 2, 
        title: "Descubriendo que amo el cine", 
        synopsis: "Consigues trabajo en el Cine Capitol. Mientras cortas entradas y hueles las palomitas, los clientes te ponen a prueba con preguntas sobre clásicos. Si respondes bien, te dejarán propinas (Créditos) que podrás ahorrar para tu futuro.", 
        imagePrompt: "vintage cinema entrance hall, young usher 1980s style holding popcorn bucket, warm cinematic lighting, movie posters on walls, magical atmosphere, hyperrealistic",
        type: 'trivia', 
        rewardCredits: 100,
        passingScore: 16, // 80% of 20 questions
        questions: [
            {
                id: 1,
                text: "Un señor mayor con sombrero te detiene y te dice: 'Joven, quiero ver esa película sobre la familia Corleone. ¿Quién la dirigió?'",
                options: ["Martin Scorsese", "Francis Ford Coppola", "Brian De Palma", "Sergio Leone"],
                correctAnswer: 1,
                tmdbQuery: "The Godfather"
            },
            {
                id: 2,
                text: "Una pareja discute en la cola de las palomitas: '¡Te digo que el tiburón de Spielberg no es digital!' ¿Cómo se llamaba el tiburón mecánico?'",
                options: ["Bruce", "Jaws", "Steven", "Sharky"],
                correctAnswer: 0,
                tmdbQuery: "Jaws"
            },
            {
                id: 3,
                text: "Un niño con gafas redondas te pregunta señalando un poster: '¿En qué año viajó Marty McFly al futuro en la segunda parte?'",
                options: ["2015", "2000", "2020", "1999"],
                correctAnswer: 0,
                tmdbQuery: "Back to the Future Part II"
            },
            {
                id: 4,
                text: "Alguien ha olvidado una claqueta. Lees el nombre del director de 'Pulp Fiction'. ¿Cuál es?'",
                options: ["Quentin Tarantino", "Robert Rodriguez", "Guy Ritchie", "David Fincher"],
                correctAnswer: 0,
                tmdbQuery: "Pulp Fiction"
            },
            {
                id: 5,
                text: "La encargada te examina: 'Si quiero proyectar la película con más Oscars de la historia (11), ¿cuál de estas NO podría poner?'",
                options: ["Titanic", "Ben-Hur", "El Señor de los Anillos: El Retorno del Rey", "Lo que el viento se llevó"],
                correctAnswer: 3, // "Lo que el viento se llevó" tiene menos de 11 (8 + 2 honoríficos)
                tmdbQuery: "Gone with the Wind"
            },
            {
                id: 6,
                text: "Un cliente con gabardina te susurra: 'Siempre nos quedará París...' ¿De qué película es esta frase?'",
                options: ["Casablanca", "Ciudadano Kane", "El Halcón Maltés", "Lo que el viento se llevó"],
                correctAnswer: 0,
                tmdbQuery: "Casablanca"
            },
            {
                id: 7,
                text: "Ves un cartel de 'Psicosis'. Un cliente pregunta: '¿Cómo se llamaba el motel donde ocurre todo?'",
                options: ["Bates Motel", "Overlook Hotel", "Crystal Lake", "Motel Hell"],
                correctAnswer: 0,
                tmdbQuery: "Psycho"
            },
            {
                id: 8,
                text: "Una niña vestida de azul te pregunta: '¿En qué película de Disney sale un genio azul?'",
                options: ["Aladdin", "Hércules", "La Sirenita", "El Rey León"],
                correctAnswer: 0,
                tmdbQuery: "Aladdin"
            },
            {
                id: 9,
                text: "Un fan de la ciencia ficción te pregunta: '¿Cuál es la primera regla del Club de la Lucha?'",
                options: ["No hablar del Club de la Lucha", "Pelear sin camisa", "Solo dos tipos por pelea", "Divertirse"],
                correctAnswer: 0,
                tmdbQuery: "Fight Club"
            },
            {
                id: 10,
                text: "El proyeccionista te grita: '¡Rápido! ¿Quién interpretó al Joker en 'El Caballero Oscuro'?'",
                options: ["Heath Ledger", "Joaquin Phoenix", "Jack Nicholson", "Jared Leto"],
                correctAnswer: 0,
                tmdbQuery: "The Dark Knight"
            },
            {
                id: 11,
                text: "Un grupo de amigos discute sobre 'Star Wars'. '¿Quién es el padre de Luke Skywalker?'",
                options: ["Darth Vader", "Obi-Wan Kenobi", "Yoda", "Palpatine"],
                correctAnswer: 0,
                tmdbQuery: "Star Wars: The Empire Strikes Back"
            },
            {
                id: 12,
                text: "Te preguntan por una película muda en blanco y negro de 2011 que ganó el Oscar. ¿Cuál es?",
                options: ["The Artist", "Hugo", "La La Land", "Roma"],
                correctAnswer: 0,
                tmdbQuery: "The Artist"
            },
            {
                id: 13,
                text: "Alguien tararea la banda sonora de 'El Rey León'. ¿Quién compuso la música instrumental?'",
                options: ["Hans Zimmer", "Elton John", "John Williams", "Alan Menken"],
                correctAnswer: 0,
                tmdbQuery: "The Lion King"
            },
            {
                id: 14,
                text: "Un cliente te pregunta: '¿Qué pastilla toma Neo para salir de Matrix?'",
                options: ["La roja", "La azul", "La verde", "La amarilla"],
                correctAnswer: 0,
                tmdbQuery: "The Matrix"
            },
            {
                id: 15,
                text: "Ves un poster de 'El Resplandor'. ¿Quién escribió la novela original que odió Kubrick?'",
                options: ["Stephen King", "H.P. Lovecraft", "Dean Koontz", "Clive Barker"],
                correctAnswer: 0,
                tmdbQuery: "The Shining"
            },
            {
                id: 16,
                text: "Una señora elegante pregunta: '¿Qué actriz desayunaba frente a Tiffany's?'",
                options: ["Audrey Hepburn", "Marilyn Monroe", "Grace Kelly", "Elizabeth Taylor"],
                correctAnswer: 0,
                tmdbQuery: "Breakfast at Tiffany's"
            },
            {
                id: 17,
                text: "Un chico con látigo y sombrero pregunta por su ídolo. ¿Cómo se llama el arqueólogo?'",
                options: ["Indiana Jones", "Nathan Drake", "Rick O'Connell", "Lara Croft"],
                correctAnswer: 0,
                tmdbQuery: "Raiders of the Lost Ark"
            },
            {
                id: 18,
                text: "Te preguntan por el director español que ganó el Oscar con 'Todo sobre mi madre'.",
                options: ["Pedro Almodóvar", "Alejandro Amenábar", "J.A. Bayona", "Luis Buñuel"],
                correctAnswer: 0,
                tmdbQuery: "Todo sobre mi madre"
            },
            {
                id: 19,
                text: "Alguien menciona 'Rosebud'. ¿De qué película clásica están hablando?",
                options: ["Ciudadano Kane", "Lo que el viento se llevó", "Casablanca", "El Padrino"],
                correctAnswer: 0,
                tmdbQuery: "Citizen Kane"
            },
            {
                id: 20,
                text: "Última pregunta del turno. '¿Qué película de Pixar trata sobre las emociones de una niña?'",
                options: ["Inside Out (Del Revés)", "Soul", "Up", "Coco"],
                correctAnswer: 0,
                tmdbQuery: "Inside Out"
            }
        ]
    },
    
    // RETO NIVEL 3 - NUEVO (TIMELINE)
    { 
        level: 3, 
        title: "Comprar un Proyector", 
        synopsis: "Tras trabajar en el cine, decides montar tu propio 'Cine en Casa'. Vas a ver a un viejo montador que conociste, con la esperanza de comprarle un proyector usado. Su taller es un caos: tiene el suelo lleno de tiras de celuloide desordenadas. Si le ayudas a ordenar las escenas de 3 películas cronológicamente, te regalará el proyector y 100 créditos por el trabajo. (Requisito: Tener al menos 5 películas vistas en tu historial).",
        imagePrompt: "messy film editor room, strips of celluloid film on the floor, vintage film projector on a table, dust motes in light beam, atmospheric clutter, cinematic lighting",
        type: 'timeline', 
        rewardCredits: 100,
        passingScore: 3 // Needs to pass 3 movies
    }
];

export const RANKS: Rank[] = [
    { id: 'rank_1', title: 'Espectador Novato', minLevel: 1, color: 'text-gray-500', icon: Ticket },
    { id: 'rank_2', title: 'Proyeccionista de Barrio', minLevel: 5, color: 'text-zinc-400', icon: Film },
    { id: 'rank_3', title: 'Meritorio / Ayudante', minLevel: 10, color: 'text-slate-400', icon: Coffee },
    { id: 'rank_4', title: 'Auxiliar de Atrezzo', minLevel: 15, color: 'text-blue-400', icon: Armchair },
    { id: 'rank_5', title: 'Figurante', minLevel: 20, color: 'text-sky-400', icon: Users },
    { id: 'rank_6', title: 'Actor Secundario', minLevel: 25, color: 'text-cyan-400', icon: UserPlus },
    { id: 'rank_7', title: 'Actor Principal', minLevel: 30, color: 'text-cine-gold', icon: Star },
    { id: 'rank_8', title: 'Director Novel', minLevel: 35, color: 'text-emerald-400', icon: Video },
    { id: 'rank_9', title: 'Director Profesional', minLevel: 40, color: 'text-green-500', icon: Clapperboard },
    { id: 'rank_10', title: 'Guionista Consolidado', minLevel: 50, color: 'text-lime-400', icon: PenTool },
    { id: 'rank_11', title: 'Productor Ejecutivo', minLevel: 60, color: 'text-yellow-400', icon: Briefcase },
    { id: 'rank_12', title: 'Showrunner', minLevel: 70, color: 'text-amber-500', icon: Globe },
    { id: 'rank_13', title: 'Director de Prestigio Internacional', minLevel: 80, color: 'text-orange-500', icon: Award },
    { id: 'rank_14', title: 'Maestro del Cine', minLevel: 90, color: 'text-red-500', icon: Scroll },
    { id: 'rank_15', title: 'Icono de Hollywood', minLevel: 95, color: 'text-rose-500 font-black', icon: Glasses },
    { id: 'rank_16', title: 'Leyenda Inmortal del Cine', minLevel: 100, color: 'text-purple-400 shadow-[0_0_15px_purple]', icon: Crown },
];

export const MISSIONS: Mission[] = [
    // --- RANK 1: Espectador Novato (Level 1-4) ---
    // Total XP disponible: ~100
    {
        id: 'm_avatar',
        rankId: 'rank_1',
        title: 'Nueva Identidad (Subir a Nivel 2)',
        description: 'Cambia tu avatar por defecto por uno de actor o actriz.',
        xpReward: 10,
        icon: Camera,
        condition: (user) => (!!user.gamificationStats?.['update_avatar'])
    },
    {
        id: 'm_feedback',
        rankId: 'rank_1',
        title: 'Crítico Constructivo (Subir a Nivel 2)',
        description: 'Envía una sugerencia o reporte de bug en la sección de Feedback.',
        xpReward: 10,
        icon: Bug,
        condition: (user) => !!user.gamificationStats?.['feedback']
    },
    {
        id: 'm_search',
        rankId: 'rank_1',
        title: 'Buscador de Tesoros (Subir a Nivel 2)',
        description: 'Usa el buscador para encontrar una película en la base de datos.',
        xpReward: 10,
        icon: Search,
        condition: (user) => !!user.gamificationStats?.['search']
    },
    {
        id: 'm_rate',
        rankId: 'rank_1',
        title: 'Primera Claqueta (Subir a Nivel 2)',
        description: 'Marca una película como vista y dale una puntuación.',
        xpReward: 15,
        icon: Star,
        condition: (user, stats) => stats.ratingsCount >= 1
    },
    {
        id: 'm_watchlist',
        rankId: 'rank_1',
        title: 'Futuros Proyectos (Subir a Nivel 2)',
        description: 'Añade una película a tu lista de pendientes.',
        xpReward: 10,
        icon: ListVideo,
        condition: (user) => !!user.gamificationStats?.['watchlist']
    },
    {
        id: 'm_events',
        rankId: 'rank_1',
        title: 'Vida Social (Subir a Nivel 2)',
        description: 'Visita la sección de Eventos/Cineforum.',
        xpReward: 10,
        icon: Ticket,
        condition: (user) => !!user.gamificationStats?.['visit_events']
    },
    {
        id: 'm_ranking',
        rankId: 'rank_1',
        title: 'Estudiando a los Grandes (Subir a Nivel 2)',
        description: 'Visita el Ranking de películas y críticos.',
        xpReward: 10,
        icon: Trophy,
        condition: (user) => !!user.gamificationStats?.['visit_ranking']
    },
    {
        id: 'm_review',
        rankId: 'rank_1',
        title: 'Pluma Afilada (Subir a Nivel 2)',
        description: 'Escribe tu primera reseña escrita.',
        xpReward: 15,
        icon: MessageSquare,
        condition: (user, stats) => stats.reviewsCount >= 1
    },
    {
        id: 'm_ai',
        rankId: 'rank_1',
        title: 'Consultando al Oráculo (Subir a Nivel 2)',
        description: 'Pide una recomendación de película a la IA.',
        xpReward: 10,
        icon: Sparkles,
        condition: (user) => !!user.gamificationStats?.['use_ai']
    },

    // --- LEVEL 2 TASKS (Now part of Rank 1 because Rank 2 starts at Level 5) ---
    {
        id: 'm_lvl2_rate_5',
        rankId: 'rank_1', 
        title: 'Crítico en Ciernes (Subir a Nivel 3)',
        description: 'Valora 5 películas NUEVAS desde que subiste a nivel 2.',
        xpReward: 25,
        icon: Star,
        minLevel: 2,
        condition: (user, stats) => (user.level || 1) >= 2 && stats.ratingsCount >= 5
    },
    {
        id: 'm_lvl2_review_5',
        rankId: 'rank_1',
        title: 'Columnista (Subir a Nivel 3)',
        description: 'Escribe reseñas para 5 películas nuevas.',
        xpReward: 30,
        icon: PenTool,
        minLevel: 2,
        condition: (user, stats) => (user.level || 1) >= 2 && stats.reviewsCount >= 5
    },
    {
        id: 'm_lvl2_news',
        rankId: 'rank_1',
        title: 'Bien Informado (Subir a Nivel 3)',
        description: 'Lee una noticia completa (expandir leer más).',
        xpReward: 10,
        icon: Newspaper,
        minLevel: 2,
        condition: (user) => (user.level || 1) >= 2 && !!user.gamificationStats?.['read_news']
    },
    {
        id: 'm_lvl2_ai_chat',
        rankId: 'rank_1',
        title: 'Futuro Digital (Subir a Nivel 3)',
        description: 'Usa el chat avanzado o de voz con la IA.',
        xpReward: 15,
        icon: Bot,
        minLevel: 2,
        condition: (user) => (user.level || 1) >= 2 && !!user.gamificationStats?.['use_ai_chat']
    },
    {
        id: 'm_lvl2_social',
        rankId: 'rank_1',
        title: 'Espíritu de Equipo (Subir a Nivel 3)',
        description: 'Da Like o Dislike a 5 reseñas de otros usuarios.',
        xpReward: 20,
        icon: ThumbsUp,
        minLevel: 2,
        condition: (user) => (user.level || 1) >= 2 && (user.gamificationStats?.['social_interactions'] || 0) >= 5
    },
    {
        id: 'm_lvl2_vote',
        rankId: 'rank_1',
        title: 'Voto Democrático (Subir a Nivel 3)',
        description: 'Vota por una película candidata en el Cineforum.',
        xpReward: 15,
        icon: Ticket,
        minLevel: 2,
        condition: (user) => (user.level || 1) >= 2 && !!user.gamificationStats?.['vote_event']
    },
    {
        id: 'm_lvl2_feedback_5',
        rankId: 'rank_1',
        title: 'Beta Tester (Subir a Nivel 3)',
        description: 'Envía 5 reportes de bug o ideas de mejora.',
        xpReward: 25,
        icon: Bug,
        minLevel: 2,
        condition: (user) => (user.level || 1) >= 2 && (user.gamificationStats?.['feedback_count'] || 0) >= 5
    },
    {
        id: 'm_lvl2_watchlist_5',
        rankId: 'rank_1',
        title: 'Agenda Llena (Subir a Nivel 3)',
        description: 'Ten al menos 5 películas en tu lista de pendientes.',
        xpReward: 10,
        icon: ListVideo,
        minLevel: 2,
        condition: (user) => (user.level || 1) >= 2 && user.watchlist.length >= 5
    }
];

export const SHOP_ITEMS: ShopItem[] = [
    {
        id: 'item_online_tracker',
        title: 'Radar de Usuarios Online',
        description: 'Añade un widget a tu pantalla de inicio que te muestra en tiempo real quién está conectado en la web.',
        cost: 100,
        minLevel: 1,
        icon: Radar,
        type: 'feature'
    },
    {
        id: 'item_private_chat',
        title: 'Chat en Solitario',
        description: 'Permite abrir salas de chat privadas con usuarios conectados desde el Radar.',
        cost: 100,
        minLevel: 1,
        icon: MessageCircle,
        type: 'feature',
        prerequisiteId: 'item_online_tracker'
    }
];
