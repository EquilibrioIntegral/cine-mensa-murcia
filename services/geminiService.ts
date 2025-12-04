import { GoogleGenAI, Type } from "@google/genai";
import { Movie, UserRating, CineEvent, EventCandidate, ChatMessage, User, TriviaQuestion } from "../types";
import { findMovieByTitleAndYear, getImageUrl, searchPersonTMDB } from "./tmdbService";

// Initialize the client safely
const apiKey = process.env.API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

// Helper to check if API is usable
const isAiAvailable = () => {
    return !!apiKey && apiKey.length > 0;
};

// --- VISUAL TIMELINE GENERATOR (NEW - VISION API) ---
export const generateVisualTimeline = async (
    movieTitle: string, 
    imagesBase64: string[]
): Promise<{ id: number, description: string, originalIndex: number }[]> => {
    if (!isAiAvailable() || imagesBase64.length === 0) return [];

    const prompt = `
        Actúa como un experto Montador de Cine y Analista de Guiones.
        Aquí tienes ${imagesBase64.length} fotogramas (backdrops) de la película "${movieTitle}".
        
        TU MISIÓN:
        1. Identifica qué imágenes corresponden a un "Punto de Giro" o escena narrativa clara del guion.
        2. DESCARTA (ignora) las imágenes que sean:
           - Primeros planos genéricos sin contexto.
           - Paisajes vacíos que no aporten trama.
           - Imágenes promocionales que no parezcan fotogramas de la película.
           - Imágenes duplicadas o muy similares (quédate con la mejor).
        3. Selecciona un MÁXIMO de 5 imágenes (mínimo 3) que cuenten mejor la historia.
        4. Para cada imagen seleccionada, escribe una "description" que explique LA ACCIÓN DEL GUION (Ej: "El villano detona la bomba" en lugar de "Fuego y humo").
        5. Ordénalas cronológicamente.

        FORMATO DE RESPUESTA (JSON Array):
        - "id": Número secuencial del orden cronológico (1, 2, 3...).
        - "description": La acción de la trama (breve, máx 15 palabras).
        - "originalIndex": El índice de la imagen en el array original que te envié (0 a ${imagesBase64.length - 1}).

        IMPORTANTE: Si ninguna imagen sirve o no reconoces la película, devuelve un array vacío [].
    `;

    // Construct parts: Text Prompt + Images
    const parts: any[] = [
        { text: prompt }
    ];

    imagesBase64.forEach(img => {
        parts.push({
            inlineData: {
                mimeType: "image/jpeg",
                data: img
            }
        });
    });

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: 'user', parts: parts }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.INTEGER },
                            description: { type: Type.STRING },
                            originalIndex: { type: Type.INTEGER }
                        },
                        required: ["id", "description", "originalIndex"]
                    }
                }
            }
        });

        if (!response.text) return [];
        return JSON.parse(response.text);
    } catch (e) {
        console.error("Visual Timeline Gen Error:", String(e));
        return [];
    }
};

// --- TIMELINE GENERATOR (LEGACY - TEXT ONLY) ---
export const generateTimelineScenes = async (movieTitle: string): Promise<{ id: number, description: string }[]> => {
    if (!isAiAvailable()) return [];

    const prompt = `
        Genera 10 momentos o escenas CLAVE de la película "${movieTitle}" en ORDEN CRONOLÓGICO estricto (de principio a fin).
        
        REQUISITOS:
        1. Las descripciones deben ser breves (máx 20 palabras).
        2. No numeres el texto de la descripción.
        3. Deben ser distinguibles y representar el flujo de la historia.
        4. "id" debe ser el número de orden (1 a 10).
        
        Formato JSON array:
        [
            { "id": 1, "description": "El protagonista encuentra el mapa..." },
            ...
            { "id": 10, "description": "Créditos finales..." }
        ]
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.INTEGER },
                            description: { type: Type.STRING }
                        },
                        required: ["id", "description"]
                    }
                }
            }
        });

        if (!response.text) return [];
        return JSON.parse(response.text);
    } catch (e) {
        console.error("Timeline Gen Error:", String(e));
        return [];
    }
};

// --- TRIVIA GENERATOR (NEW) ---

export const generateTriviaQuestions = async (
    topic: string, 
    count: number, 
    difficulty: string = 'medium'
): Promise<TriviaQuestion[]> => {
    if (!isAiAvailable()) return [];

    const prompt = `
        Genera ${count} preguntas de trivial de cine sobre el tema: "${topic}".
        Dificultad: ${difficulty}.
        
        REQUISITOS:
        1. Las preguntas deben ser interesantes, curiosas y variadas.
        2. "tmdbQuery" debe ser el Título de la película o nombre del actor relacionado en INGLÉS o ESPAÑOL (lo más preciso posible) para buscar su imagen de fondo en TMDB.
        3. "correctAnswer" es el índice (0-3) de la respuesta correcta en el array de opciones.
        4. "text" debe incluir una pequeña narrativa o contexto si es posible (ej: "Un cliente pregunta...").
        
        Devuelve un JSON array exacto.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.INTEGER },
                            text: { type: Type.STRING },
                            options: { 
                                type: Type.ARRAY,
                                items: { type: Type.STRING }
                            },
                            correctAnswer: { type: Type.INTEGER },
                            tmdbQuery: { type: Type.STRING }
                        },
                        required: ["id", "text", "options", "correctAnswer", "tmdbQuery"]
                    }
                }
            }
        });

        if (!response.text) return [];
        const rawQuestions = JSON.parse(response.text) as TriviaQuestion[];
        
        // Ensure IDs are unique/sequential just in case
        return rawQuestions.map((q, idx) => ({ ...q, id: idx + 1 }));

    } catch (e) {
        console.error("Trivia Gen Error:", String(e));
        return [];
    }
};

// --- CAREER STORY GENERATOR ---

export const generateCareerStory = async (
    userName: string,
    rankTitle: string,
    isNewUser: boolean,
    level?: number,
    isRankUp?: boolean
): Promise<{ story: string, visualPrompt: string } | null> => {
    if (!isAiAvailable()) return null;

    let prompt = "";

    if (isNewUser) {
        prompt = `
            Eres el Narrador Épico de "Cine Mensa Murcia".
            El usuario "${userName}" acaba de unirse al club.
            Su rango inicial es: "${rankTitle}".
            
            TAREA:
            1. Escribe una historia breve (máx 3 frases) y emocionante dándole la bienvenida al mundo del cine.
               Dile que ahora es un simple espectador, pero que tiene el potencial de convertirse en una Leyenda si completa misiones.
               Usa un tono cinematográfico, mágico y motivador.
            2. Crea un prompt visual en INGLÉS para generar una imagen de su "comienzo" en el cine (ej: persona entrando a un cine antiguo mágico).
            
            JSON: { "story": "...", "visualPrompt": "..." }
          `;
    } else if (isRankUp) {
        prompt = `
            Eres el Narrador Épico de "Cine Mensa Murcia".
            El usuario "${userName}" acaba de ascender al rango: "${rankTitle}" (Nivel ${level}).
            
            TAREA:
            1. Escribe una historia breve (máx 3 frases) felicitándole por su ascenso de RANGO.
               Describe metafóricamente sus nuevas responsabilidades o estatus en el set de rodaje.
            2. Crea un prompt visual en INGLÉS que represente este nuevo rol de cine (ej: silla de director, alfombra roja, claqueta dorada).
            
            JSON: { "story": "...", "visualPrompt": "..." }
          `;
    } else {
        // Just Level Up (Not a Rank Up)
        prompt = `
            Eres el Narrador Épico de "Cine Mensa Murcia".
            El usuario "${userName}" acaba de subir al Nivel ${level}.
            Su rango actual sigue siendo "${rankTitle}".
            
            TAREA:
            1. Escribe una historia breve (máx 3 frases) felicitándole por su progreso, experiencia ganada y constancia.
               Anímalo a seguir completando misiones para alcanzar el siguiente rango profesional.
            2. Crea un prompt visual en INGLÉS que represente progreso, aprendizaje, estudio de guiones o entrenamiento en cine.
            
            JSON: { "story": "...", "visualPrompt": "..." }
        `;
    }

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        story: { type: Type.STRING },
                        visualPrompt: { type: Type.STRING }
                    },
                    required: ["story", "visualPrompt"]
                }
            }
        });
        
        if (!response.text) return null;
        return JSON.parse(response.text);
    } catch (e) {
        console.error("Career Story Gen Error:", String(e));
        return { 
            story: isRankUp 
                ? `¡Felicidades ${userName}! Has alcanzado el rango de ${rankTitle}.` 
                : `¡Buen trabajo ${userName}! Has subido al nivel ${level}.`, 
            visualPrompt: "cinema award trophy celebration cinematic lighting" 
        };
    }
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

export const generateCinemaNews = async (existingNewsTitles: string[] = []): Promise<{ title: string, content: string, visualPrompt: string, searchQuery: string }[]> => {
    if (!isAiAvailable()) return [];

    // Optimize context: Take last 50 titles (including banned ones which are passed in here)
    const recentTitles = existingNewsTitles.slice(0, 50);
    const exclusionList = recentTitles.join(", ");

    const prompt = `
        Utiliza la herramienta Google Search para buscar las noticias de cine más importantes y recientes de las últimas 24 HORAS.
        
        ⛔️ LISTA DE EXCLUSIÓN (TEMAS PROHIBIDOS/YA PUBLICADOS/BORRADOS):
        ${exclusionList}
        
        INSTRUCCIONES DE SEGURIDAD ANTI-DUPLICADOS:
        1. Comprueba la lista de exclusión. Si una noticia trata sobre el mismo tema principal (aunque el título sea diferente), DESCÁRTALA.
        2. Ej: Si "Zootropolis 2" está en la lista, NO generes nada sobre Zootropolis 2.
        3. Si no encuentras ninguna noticia 100% nueva e impactante que no esté en la lista, devuelve un array vacío [].
        4. Es preferible devolver [] a repetir contenido.
        
        Para cada noticia genera:
        1. "title": Un titular periodístico en español atractivo.
        2. "content": Un ARTÍCULO PERIODÍSTICO COMPLETO y EXTENSO (Mínimo 3 párrafos).
        3. "visualPrompt": Una descripción en INGLÉS para generar una imagen IA (solo si falla TMDB).
        4. "searchQuery": EL TÍTULO EXACTO DE LA PELÍCULA O ACTOR. 
           - IMPORTANTE: Solo el nombre. Sin "Trailer", sin "Estreno", sin "Noticia". 
           - Ejemplo MAL: "Trailer de Mufasa". Ejemplo BIEN: "Mufasa: The Lion King".
           - Esto se usará para buscar la foto real en una base de datos. Sé preciso.

        Formato JSON Array PURO (Sin markdown):
        [
          { "title": "...", "content": "...", "visualPrompt": "...", "searchQuery": "..." }
        ]
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                tools: [{ googleSearch: {} }],
            }
        });

        let text = response.text || "";
        
        // CLEANUP: Remove markdown code blocks if present
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        try {
            // Attempt to find the array bracket
            const start = text.indexOf('[');
            const end = text.lastIndexOf(']');
            if (start !== -1 && end !== -1) {
                text = text.substring(start, end + 1);
            }

            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) return parsed;
            if (typeof parsed === 'object') return [parsed];
            return [];
        } catch (e) {
            console.warn("JSON Parse Failed in News Gen. Raw text:", text);
            return [];
        }

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

// --- RECOMMENDATIONS ---

export const getMovieRecommendations = async (
  watchedMovies: Movie[],
  watchlistMovies: Movie[],
  userRatings: UserRating[],
  tmdbToken: string
): Promise<Movie[]> => {
    if (!isAiAvailable()) return [];

    const watchedTitles = watchedMovies.map(m => {
        const rating = userRatings.find(r => r.movieId === m.id);
        const detailed = rating?.detailed;
        const score = detailed ? `(Guion:${detailed.script}, Disfrute:${detailed.enjoyment})` : '';
        return `"${m.title}" ${score}`;
    }).join(", ");

    const pendingTitles = watchlistMovies.map(m => m.title).join(", ");

    const prompt = `
        Eres un experto cinéfilo.
        El usuario ha visto: ${watchedTitles}.
        Tiene pendientes: ${pendingTitles}.
        
        TAREA:
        Recomienda 10 películas NUEVAS (que no estén ni vistas ni pendientes).
        Basate en sus gustos (si valora guion, busca buen guion; si valora disfrute, busca entretenimiento).
        
        Formato JSON:
        [
            { "title": "Peli 1", "year": 1999, "reason": "Te gustará por..." },
            ...
        ]
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
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
            }
        });

        if (!response.text) return [];
        const rawRecs = JSON.parse(response.text);
        
        const recs: Movie[] = [];
        // Carga paralela para velocidad
        const promises = rawRecs.map(async (rec: any) => {
            const tmdbData = await findMovieByTitleAndYear(rec.title, rec.year, tmdbToken);
            if (tmdbData) {
                return {
                    id: `tmdb-${tmdbData.id}`,
                    tmdbId: tmdbData.id,
                    title: tmdbData.title,
                    year: parseInt(tmdbData.release_date?.split('-')[0]) || rec.year,
                    director: "IA",
                    genre: [],
                    posterUrl: getImageUrl(tmdbData.poster_path),
                    description: tmdbData.overview,
                    rating: tmdbData.vote_average,
                    totalVotes: 0,
                    recommendationReason: rec.reason
                } as Movie;
            }
            return null;
        });

        const results = await Promise.all(promises);
        return results.filter(r => r !== null) as Movie[];

    } catch (e) {
        console.error("Recs Error:", String(e));
        return [];
    }
};

export const sendChatToGemini = async (
    history: ChatMessage[], 
    newMessage: string,
    watchedMovies: Movie[],
    watchlistMovies: Movie[],
    userRatings: UserRating[],
    tmdbToken: string
): Promise<{ text: string, movies: Movie[], people: any[] }> => {
    if (!isAiAvailable()) return { text: "No puedo conectar con la IA.", movies: [], people: [] };

    const watchedContext = watchedMovies.slice(0, 30).map(m => m.title).join(", ");
    
    const systemPrompt = `
        Eres un experto en cine del club "Cine Mensa Murcia".
        Usuario ha visto: ${watchedContext}.
        
        Responde a la pregunta del usuario sobre cine.
        
        IMPORTANTE: Si mencionas películas o personas (actores/directores) específicos, DEBES incluir un bloque JSON oculto al final de tu respuesta con sus datos para que la interfaz pueda mostrar sus imágenes.
        
        Formato de respuesta:
        Texto normal de la respuesta con tu opinión, datos, etc.
        
        \`\`\`json
        {
          "movies": [ { "title": "Peli A", "year": 2000 }, ... ],
          "people": [ { "name": "Brad Pitt" }, { "name": "Christopher Nolan" }, ... ]
        }
        \`\`\`
    `;

    const chatHistory = history.map(h => ({ role: h.role, parts: [{ text: h.text }] }));
    chatHistory.push({ role: 'user', parts: [{ text: newMessage }] });

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: 'user', parts: [{ text: systemPrompt }] }, ...chatHistory],
        });

        const text = response.text || "";
        
        // Extract JSON
        let movies: Movie[] = [];
        let people: any[] = [];
        
        const jsonMatch = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
        
        let cleanText = text;
        
        if (jsonMatch) {
            cleanText = text.replace(jsonMatch[0], '').trim();
            try {
                const rawData = JSON.parse(jsonMatch[1]);
                
                // Process Movies
                if (rawData.movies && Array.isArray(rawData.movies)) {
                    const promises = rawData.movies.map(async (m: any) => {
                        const tmdb = await findMovieByTitleAndYear(m.title, m.year, tmdbToken);
                        if (tmdb) {
                            return {
                                id: `tmdb-${tmdb.id}`,
                                tmdbId: tmdb.id,
                                title: tmdb.title,
                                year: parseInt(tmdb.release_date?.split('-')[0]) || 0,
                                posterUrl: getImageUrl(tmdb.poster_path),
                                rating: tmdb.vote_average,
                                description: tmdb.overview,
                                genre: [],
                                director: "IA",
                                totalVotes: 0
                            } as Movie;
                        }
                        return null;
                    });
                    const results = await Promise.all(promises);
                    movies = results.filter(m => m !== null) as Movie[];
                }

                // Process People
                if (rawData.people && Array.isArray(rawData.people)) {
                    const promises = rawData.people.map(async (p: any) => {
                        const results = await searchPersonTMDB(p.name, tmdbToken);
                        // Take first result with image
                        const person = results.find(r => r.profile_path) || results[0];
                        return person || null;
                    });
                    const results = await Promise.all(promises);
                    people = results.filter(p => p !== null);
                }

            } catch (e) {
                console.error("Chat JSON Error:", String(e));
            }
        }

        return { text: cleanText, movies, people };

    } catch (e) {
        console.error("Chat Error:", String(e));
        return { text: "Error al procesar tu mensaje.", movies: [], people: [] };
    }
};

// --- SECURITY QUIZ LOGIC ---

export const generateSecurityQuiz = async (movieTitle: string): Promise<{ question: string }[]> => {
    if (!isAiAvailable()) return [];

    const prompt = `
        Genera 5 preguntas cortas y concretas sobre la trama de la película "${movieTitle}" para verificar si alguien la ha visto.
        
        REGLAS:
        - Pregunta sobre el final, el destino del protagonista, o giros clave de la trama.
        - NO preguntes detalles triviales imposibles de recordar (colores de ropa, matrículas, fechas exactas).
        - Deben ser hechos memorables que cualquier espectador atento recordaría.
        
        Formato JSON array:
        [ { "question": "¿Qué descubre el protagonista en el sótano?" }, ... ]
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            question: { type: Type.STRING }
                        },
                        required: ["question"]
                    }
                }
            }
        });

        if (!response.text) return [];
        return JSON.parse(response.text);
    } catch (e: any) {
        // DETECT QUOTA ERROR
        const errStr = String(e);
        const errJson = JSON.stringify(e);
        const isQuota = errStr.includes("429") || errStr.includes("quota") || errStr.includes("exhausted") || errJson.includes("429") || (e.status === 429);

        if (isQuota) {
            console.warn("Gemini Quota Exceeded (Quiz Gen)");
            throw new Error("API_QUOTA_EXCEEDED");
        }

        console.error("Quiz Gen Error:", errStr);
        // Fallback for OTHER errors (network, generic)
        return [
            { question: "¿Cómo termina la película? Describe la escena final." },
            { question: "¿Cuál es el conflicto principal que enfrenta el protagonista?" },
            { question: "Menciona una escena memorable que te haya impactado." },
            { question: "¿Quién es el personaje antagonista o villano?" },
            { question: "¿Qué actor o actriz realiza la mejor interpretación?" }
        ];
    }
};

export const validateSecurityQuiz = async (movieTitle: string, qa: any[]): Promise<{ passed: boolean, reason: string }> => {
    if (!isAiAvailable()) return { passed: true, reason: "IA no disponible, aprobado por defecto." };

    const prompt = `
        Actúa como un profesor de cine estricto pero justo.
        Estamos verificando si un usuario ha visto la película "${movieTitle}".
        
        Aquí están las preguntas y sus respuestas:
        ${JSON.stringify(qa)}
        
        TAREA:
        Evalúa si las respuestas demuestran conocimiento real de la trama.
        - Sé flexible con faltas de ortografía o nombres inexactos si se entiende la idea.
        - Si responde "no sé" a la mayoría, déjalo en blanco o inventa cosas claramente falsas, SUSPENDE.
        - Se necesitan al menos 3 respuestas razonablemente correctas para aprobar.
        
        Devuelve JSON:
        { "passed": boolean, "reason": "Breve explicación del veredicto para el usuario" }
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
                        passed: { type: Type.BOOLEAN },
                        reason: { type: Type.STRING }
                    },
                    required: ["passed", "reason"]
                }
            }
        });

        if (!response.text) return { passed: true, reason: "Error de IA, aprobado." };
        return JSON.parse(response.text);
    } catch (e: any) {
        // DETECT QUOTA ERROR
        const errStr = String(e);
        const errJson = JSON.stringify(e);
        const isQuota = errStr.includes("429") || errStr.includes("quota") || errStr.includes("exhausted") || errJson.includes("429") || (e.status === 429);

        if (isQuota) {
            console.warn("Gemini Quota Exceeded (Quiz Validate)");
            throw new Error("API_QUOTA_EXCEEDED");
        }

        console.error("Quiz Validate Error:", errStr);
        return { passed: true, reason: "Error técnico, aprobado." };
    }
};