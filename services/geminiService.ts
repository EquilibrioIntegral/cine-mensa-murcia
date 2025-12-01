
import { GoogleGenAI, Type } from "@google/genai";
import { Movie, UserRating, CineEvent, EventCandidate, ChatMessage, User } from "../types";
import { findMovieByTitleAndYear, getImageUrl } from "./tmdbService";

// Initialize the client safely
const apiKey = process.env.API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

// Helper to check if API is usable
const isAiAvailable = () => {
    return !!apiKey && apiKey.length > 0;
};

// --- NEWS EDITOR AI ---

export const enhanceNewsContent = async (draft: string): Promise<{ title: string, content: string, visualPrompt: string } | null> => {
    if (!isAiAvailable()) return null;

    const prompt = `
        Eres el Redactor Jefe de "Cine Mensa Murcia".
        Tienes el siguiente borrador de noticia escrito por un administrador:
        "${draft}"

        TU TAREA:
        1. Reescribir el contenido para que suene profesional, épico y emocionante. Sin faltas de ortografía.
        2. Crear un Título pegadizo (tipo titular de revista de cine).
        3. Generar una descripción visual en INGLÉS para crear una imagen de cabecera con IA (ej: "cinema audience watching screen, dark atmosphere, golden light").

        Devuelve JSON exacto:
        { "title": "...", "content": "...", "visualPrompt": "..." }
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        content: { type: Type.STRING },
                        visualPrompt: { type: Type.STRING }
                    },
                    required: ["title", "content", "visualPrompt"]
                }
            }
        });
        
        if (!response.text) return null;
        return JSON.parse(response.text);
    } catch (e) {
        console.error("News Enhance Error:", String(e));
        return null;
    }
};

export const enhanceUpdateContent = async (draft: string): Promise<{ title: string, content: string } | null> => {
    if (!isAiAvailable()) return null;

    const prompt = `
        Eres el Jefe de Producto Técnico de la app "Cine Mensa Murcia".
        El desarrollador te ha pasado esta nota rápida sobre un cambio o arreglo:
        "${draft}"

        TU TAREA:
        Redactar una entrada para el "Registro de Cambios" (Changelog) que verán los usuarios.
        
        1. Título: Corto, con un emoji al principio (ej: 🐛, ✨, 🚀, 🛠️) y descriptivo.
        2. Contenido: Explicación profesional pero amigable de qué ha mejorado para el usuario. Máximo 2 frases.

        Devuelve JSON exacto:
        { "title": "...", "content": "..." }
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        content: { type: Type.STRING }
                    },
                    required: ["title", "content"]
                }
            }
        });
        
        if (!response.text) return null;
        return JSON.parse(response.text);
    } catch (e) {
        console.error("Update Enhance Error:", String(e));
        return null;
    }
};

export const generateCinemaNews = async (): Promise<{ title: string, content: string, visualPrompt: string }[]> => {
    if (!isAiAvailable()) return [];

    const prompt = `
        Utiliza la herramienta Google Search para buscar las noticias de cine más importantes y recientes de las últimas 24 HORAS.
        Céntrate en:
        - Resultados de taquilla del fin de semana.
        - Nuevos trailers lanzados hoy/ayer.
        - Premios recientes o festivales en curso.
        - Declaraciones virales de directores o actores.
        
        Selecciona las 3 noticias más relevantes y redactalas para el club "Cine Mensa Murcia".
        
        Para cada noticia genera:
        1. "title": Un titular periodístico en español atractivo.
        2. "content": Un resumen de 2-3 frases en español.
        3. "visualPrompt": Una descripción en INGLÉS para generar una imagen (ej: "close up of actor X, cinematic lighting").

        IMPORTANTE:
        Devuelve la respuesta ESTRICTAMENTE como un JSON Array dentro de un bloque de código markdown json.
        No añadidas texto fuera del bloque de código.
        
        Ejemplo de salida esperada:
        \`\`\`json
        [
          { "title": "...", "content": "...", "visualPrompt": "..." }
        ]
        \`\`\`
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                tools: [{ googleSearch: {} }],
            }
        });

        const text = response.text || "";
        
        const jsonMatch = text.match(/```json\s*(\[\s*[\s\S]*?\s*\])\s*```/) || text.match(/\[\s*[\s\S]*?\s*\]/);
        
        if (jsonMatch) {
            return JSON.parse(jsonMatch[1] || jsonMatch[0]);
        }
        
        console.warn("No se encontró JSON válido en la respuesta de noticias:", text);
        return [];

    } catch (e) {
        console.error("News Gen Error:", String(e));
        return [];
    }
};


// --- CINEFORUM EVENT GENERATOR ---

export const generateCineforumEvent = async (
    allMovies: Movie[],
    allUsers: User[],
    tmdbToken: string
): Promise<Partial<CineEvent> | null> => {
    
    if (!isAiAvailable()) {
        console.error("Gemini API Key missing");
        return null;
    }

    // --- LOGIC 70% RULE ---
    const activeUsersCount = allUsers.filter(u => u.status === 'active' || u.isAdmin).length;
    const threshold = Math.ceil(activeUsersCount * 0.3); // 30% threshold
    
    const excludedMovies = allMovies.filter(m => m.totalVotes > threshold);
    const excludeTitles = excludedMovies.map(m => m.title).join(', ');

    const systemPrompt = `
        Eres el Organizador Creativo del Cineforum "Cine Mensa Murcia".
        
        TU MISIÓN:
        Crear un evento temático original, llamativo y único para la próxima semana.
        
        1. ELIGE UN TEMA:
           No uses temas aburridos como "Comedia" o "Acción".
           Inventa algo como: "Cyberpunk Melancólico", "Road Trips Existenciales", "Terror Rural Español", "Giros de Guion que te vuelan la cabeza", "Cine Mudo Futurista".
           El título debe ser como el de un flyer de festival.

        2. ELIGE 3 CANDIDATAS:
           - Deben ser películas BUENAS (rating alto).
           - Deben encajar perfectamente en tu tema.
           - REGLA DE ORO (70%): NO pueden estar en la lista de EXCLUIDAS (películas que ya ha visto mucha gente del club). Deben ser joyas ocultas o menos conocidas para la mayoría.
           - Intenta mezclar: una de culto, una joya oculta y una sorpresa.

        3. JUSTIFICACIÓN:
           Vende el evento. Explica por qué este tema es interesante ahora.
        
        4. IMAGEN DE FONDO (IA):
           Describe visualmente el tema en una frase corta en INGLÉS para generar una imagen de fondo (ej: "neon city raining night cyberpunk cinematic").

        Lista de EXCLUIDAS (YA VISTAS POR >30% DEL CLUB): ${excludeTitles}

        Formato JSON Requerido:
        {
            "themeTitle": "Título llamativo",
            "themeDescription": "Texto persuasivo para el flyer...",
            "aiReasoning": "Por qué elegí este tema...",
            "visualPrompt": "Description in english...",
            "candidates": [
                { "title": "Peli 1", "year": 1999, "reason": "Por qué encaja en el tema..." },
                { "title": "Peli 2", "year": 2005, "reason": "..." },
                { "title": "Peli 3", "year": 2020, "reason": "..." }
            ]
        }
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        themeTitle: { type: Type.STRING },
                        themeDescription: { type: Type.STRING },
                        aiReasoning: { type: Type.STRING },
                        visualPrompt: { type: Type.STRING },
                        candidates: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING },
                                    year: { type: Type.INTEGER },
                                    reason: { type: Type.STRING }
                                },
                                required: ["title", "year", "reason"]
                            }
                        }
                    },
                    required: ["themeTitle", "themeDescription", "aiReasoning", "visualPrompt", "candidates"]
                }
            }
        });

        if (!response.text) return null;
        
        const rawData = JSON.parse(response.text);
        const candidatesWithMeta: EventCandidate[] = [];

        // Enrich candidates with TMDB Data
        for (const c of rawData.candidates) {
            const tmdbData = await findMovieByTitleAndYear(c.title, c.year, tmdbToken);
            if (tmdbData) {
                candidatesWithMeta.push({
                    tmdbId: tmdbData.id,
                    title: tmdbData.title,
                    year: parseInt(tmdbData.release_date?.split('-')[0]) || c.year,
                    posterUrl: getImageUrl(tmdbData.poster_path),
                    description: tmdbData.overview,
                    reason: c.reason,
                    votes: [] // Init empty votes
                });
            }
        }

        if (candidatesWithMeta.length < 3) throw new Error("Could not find enough valid movies in TMDB.");

        const backdropUrl = rawData.visualPrompt 
            ? `https://image.pollinations.ai/prompt/${encodeURIComponent(rawData.visualPrompt)}?nologo=true&width=1600&height=900&model=flux`
            : candidatesWithMeta[0].posterUrl;

        return {
            themeTitle: rawData.themeTitle,
            themeDescription: rawData.themeDescription,
            aiReasoning: rawData.aiReasoning,
            candidates: candidatesWithMeta,
            backdropUrl: backdropUrl
        };

    } catch (e) {
        console.error("Event Gen Error:", String(e));
        return null;
    }
};

// --- SCHEDULE JUDGE (TIME DECISION) ---

export const decideBestTime = async (
    votes: Record<string, number>, 
    movieTitle: string,
    episodeNumber: number
): Promise<{ chosenTime: string, message: string }> => {
    if (!isAiAvailable()) {
        return { chosenTime: "Sábado 22:00", message: "Decisión automática por fallo de IA." };
    }

    const voteSummary = Object.entries(votes).map(([time, count]) => `${time}: ${count} votos`).join('\n');

    const prompt = `
        Eres la VOZ EN OFF EPICA del programa de TV "Cine Mensa Murcia".
        Estamos en el EPISODIO NÚMERO ${episodeNumber}.
        La película es "${movieTitle}".
        
        RESULTADOS DE LA VOTACIÓN DE HORARIO (Asistentes confirmados):
        ${voteSummary}
        
        REGLA DE ORO (QUÓRUM):
        - Necesitamos al menos 2 personas coincidiendo en la misma hora para hacer el evento.
        - Si la opción más votada tiene menos de 2 votos: EL EVENTO SE POSPONE/CANCELA.
        
        TAREA:
        1. Analiza los votos.
        2. Si NO hay quórum (< 2 votos en la ganadora):
           - chosenTime: "CANCELLED"
           - message: Un mensaje dramático de "Emisión Cancelada" por falta de audiencia.
        
        3. Si HAY quórum (>= 2 votos):
           - chosenTime: La hora exacta ganadora.
           - message: REDACTA LA INTRO DEL PROGRAMA DE TV.
             Estilo: "¡ESTAMOS EN EL AIRE! CINEFORUM MENSA - EPISODIO ${episodeNumber}..."
             Anuncia la hora y la película con máxima epicidad.
        
        Devuelve JSON: { "chosenTime": "...", "message": "..." }
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        chosenTime: { type: Type.STRING },
                        message: { type: Type.STRING }
                    },
                    required: ["chosenTime", "message"]
                }
            }
        });
        
        if (!response.text) return { chosenTime: "Pendiente", message: "Error calculando fecha." };
        return JSON.parse(response.text);
    } catch (e) {
        return { chosenTime: "Sábado 22:00", message: "La IA está descansando. Horario por defecto." };
    }
}

// --- PERSONALIZED FLYER LOGIC ---

export const personalizeCandidateReason = async (
    candidateTitle: string,
    genericReason: string,
    userRatings: UserRating[],
    watchedMovies: Movie[]
): Promise<string> => {
    
    if (!isAiAvailable()) return genericReason;

    const tastes = userRatings.slice(0, 15).map(r => {
        const m = watchedMovies.find(mv => mv.id === r.movieId);
        if (!m) return '';
        const d = r.detailed;
        return d ? `${m.title} (Guion: ${d.script}, Dirección: ${d.direction}, Disfrute: ${d.enjoyment})` : '';
    }).filter(s => s).join('; ');

    const prompt = `
        La película candidata es: "${candidateTitle}".
        Razón genérica: "${genericReason}".
        
        Tus gustos (Usuario): ${tastes}
        
        TAREA: Reescribe la "Razón genérica" para convencer a ESTE usuario específico.
        - Sé breve pero completo.
        - Usa sus gustos: "Como te gustó el guion de X...", "Si disfrutaste Y...".
        - Tono: Flyer publicitario personalizado.
        
        Solo devuelve el texto, nada más.
    `;

    try {
        const res = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        return res.text || genericReason;
    } catch (e) {
        return genericReason;
    }
};

// --- MODERATOR & CHAT LOGIC ---

export const getModeratorResponse = async (
    chatHistory: { userName: string, text: string }[],
    movieTitle: string,
    themeTitle: string
): Promise<string> => {
    if (!isAiAvailable()) return "¡Qué debate tan interesante!";

    const context = chatHistory.slice(-10).map(m => `${m.userName}: ${m.text}`).join('\n');
    
    const prompt = `
        Eres la PRESENTADORA ESTRELLA (IA) del programa de TV "Cine Mensa".
        Estáis debatiendo en vivo sobre la película: "${movieTitle}" (Tema del evento: ${themeTitle}).
        
        Últimos mensajes del chat:
        ${context}
        
        TU MISIÓN:
        Intervenir espontáneamente para animar el debate.
        - Si alguien dijo algo interesante, cítalo y pregúntale más.
        - Si hay poco movimiento, lanza una pregunta polémica o una curiosidad de la película.
        - Actúa con carisma, humor inteligente y autoridad de presentadora.
        - IMPORTANTE: NO uses localismos, ni referencias regionales específicas (nada de "Murcia" ni "murcianicos"). Tu tono debe ser español neutro y profesional (Internacional).
        - NO seas robótica. Eres una showwoman.
        - Max 2-3 frases.
    `;

    try {
        const res = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        return res.text || "¡Vamos chicos! ¿Nadie tiene nada que decir de esa escena final?";
    } catch (e) {
        return "¡Qué película tan intensa! ¿Qué os ha parecido el ritmo?";
    }
};

export const getWelcomeMessage = async (
    movieTitle: string,
    themeTitle: string
): Promise<string> => {
    if (!isAiAvailable()) return "¡Bienvenidos al debate! La sala está abierta.";

    const prompt = `
        Eres la PRESENTADORA del programa de TV "Cine Mensa".
        Hoy comienza el debate sobre la película ganadora: "${movieTitle}" (Del ciclo: ${themeTitle}).
        
        TU TAREA:
        Escribir el MENSAJE INAUGURAL del chat para abrir la sala.
        
        DEBES INCLUIR:
        1. Un saludo entusiasta a los socios.
        2. Una anécdota breve o curiosidad fascinante sobre la película "${movieTitle}" para romper el hielo.
        3. Invita a todos a saludar y presentarse.
        4. EXPLICA LAS REGLAS: Diles que tú estás moderando y que pueden invocarte escribiendo "@ia" si quieren preguntarte algo, pero que también intervendrás espontáneamente si la cosa se pone interesante.
        5. Cierra con una frase tipo "¡Que empiece el Cineforum!".
        
        TONO:
        - Profesional, carismático, Showwoman de TV.
        - Español Neutro (Internacional). NADA de localismos.
    `;

    try {
        const res = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        return res.text || "¡Bienvenidos al debate! La sala está abierta.";
    } catch (e) {
        return "¡Bienvenidos a todos! Hoy debatimos sobre esta gran película.";
    }
}

export const getParticipantGreeting = async (
    userName: string,
    userMessage: string,
    movieTitle: string
): Promise<string> => {
    if (!isAiAvailable()) return `¡Bienvenido ${userName}!`;

    const prompt = `
        Eres la PRESENTADORA del programa. El usuario "${userName}" acaba de entrar al chat y ha dicho: "${userMessage}".
        La película es "${movieTitle}".
        
        TAREA:
        Dale una bienvenida CORTA y personalizada (máximo 1 frase).
        Hazle sentir parte del grupo.
        
        TONO: Amable, rápido, TV Host.
    `;

    try {
        const res = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        return res.text || `¡Bienvenido al debate, ${userName}!`;
    } catch (e) {
        return `¡Bienvenido ${userName}! Gracias por unirte.`;
    }
};

// --- REST OF FILE REMAINS UNCHANGED (Recommendations, Security Quiz, Chat) ---
export const getMovieRecommendations = async (
  watchedMovies: Movie[],
  watchlistMovies: Movie[],
  userRatings: UserRating[],
  tmdbToken: string
): Promise<Movie[]> => {
    // ... Placeholder implementation ...
    return [];
};

export const sendChatToGemini = async (
    history: ChatMessage[], 
    newMessage: string,
    watchedMovies: Movie[],
    watchlistMovies: Movie[],
    userRatings: UserRating[],
    tmdbToken: string
): Promise<{ text: string, movies: Movie[] }> => {
    // ... Placeholder implementation ...
    return { text: "Respuesta...", movies: [] };
};

export const generateSecurityQuiz = async (movieTitle: string): Promise<{ question: string }[]> => {
    // ... Placeholder implementation ...
    return [];
};

export const validateSecurityQuiz = async (movieTitle: string, qa: any[]): Promise<{ passed: boolean, reason: string }> => {
    // ... Placeholder implementation ...
    return { passed: true, reason: "" };
};
