
import { GoogleGenAI, Type } from "@google/genai";
import { Movie, UserRating, CineEvent, EventCandidate, ChatMessage } from "../types";
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
                // Nota: responseSchema/responseMimeType no están permitidos con tools en esta versión del SDK,
                // por lo que solicitamos JSON en el prompt y parseamos el texto.
            }
        });

        const text = response.text || "";
        
        // Extraer JSON del bloque de código markdown si existe
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
    watchedMovies: Movie[],
    tmdbToken: string
): Promise<Partial<CineEvent> | null> => {
    
    if (!isAiAvailable()) {
        console.error("Gemini API Key missing");
        return null;
    }

    // Create a list of watched titles to exclude
    const excludeList = watchedMovies.map(m => m.title).join(', ');

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
           - NO pueden estar en la lista de EXCLUIDAS (ya vistas por el club).
           - Intenta mezclar: una famosa, una de culto y una joya oculta.

        3. JUSTIFICACIÓN:
           Vende el evento. Explica por qué este tema es interesante ahora.
        
        4. IMAGEN DE FONDO (IA):
           Describe visualmente el tema en una frase corta en INGLÉS para generar una imagen de fondo (ej: "neon city raining night cyberpunk cinematic").

        Lista de EXCLUIDAS (NO ELEGIR): ${excludeList}

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

        // Generate AI Background Image URL using Pollinations.ai (Free AI Image Gen)
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

// --- PERSONALIZED FLYER LOGIC ---

export const personalizeCandidateReason = async (
    candidateTitle: string,
    genericReason: string,
    userRatings: UserRating[],
    watchedMovies: Movie[]
): Promise<string> => {
    
    if (!isAiAvailable()) return genericReason;

    // Create context string from user ratings
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

// --- MODERATOR (TV HOST) LOGIC ---

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
        return res.text || "¡Bienvenidos al debate! La sala está abierta. ¿Qué os ha parecido la película?";
    } catch (e) {
        return "¡Bienvenidos a todos! Hoy debatimos sobre esta gran película. ¡Que empiece el espectáculo!";
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
        Ejemplo: "¡Bienvenido Andrés! Muy interesante lo que dices sobre la fotografía."
        
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


// --- SIMPLE RECOMMENDATION LOGIC ---

export const getMovieRecommendations = async (
  watchedMovies: Movie[],
  watchlistMovies: Movie[],
  userRatings: UserRating[],
  tmdbToken: string
): Promise<Movie[]> => {
  
  if (!isAiAvailable()) {
      throw new Error("API Key de IA no configurada");
  }

  if (watchedMovies.length === 0 && userRatings.length === 0) {
    return [];
  }

  // 1. Prepare Data for Prompt
  // We prioritize high rated movies for the prompt context
  const relevantRatings = userRatings.sort((a, b) => b.rating - a.rating).slice(0, 30);

  const userMoviesForPrompt = relevantRatings.map(r => {
      const movie = watchedMovies.find(m => m.id === r.movieId);
      if (!movie) return '';
      
      const title = `${movie.title} (${movie.year})`;
      const detailed = r.detailed;
      
      if (!detailed) return `${title}: nota global ${r.rating}/10`;

      return `${title}: Global ${detailed.average}/10, Guion ${detailed.script}/10, Dirección ${detailed.direction}/10, Actuación ${detailed.acting}/10, BSO ${detailed.soundtrack}/10, Disfrute ${detailed.enjoyment}/10`;
  }).filter(s => s !== '').join('\n');

  const excludeList = [
      ...watchlistMovies.map(m => m.title),
      ...watchedMovies.map(m => m.title)
  ];
  const uniqueExcludeList = [...new Set(excludeList)].map(t => `- ${t}`).join('\n');

  const systemPrompt = `
    Eres un experto Sommelier de Cine para el club "Cine Mensa Murcia".
    
    TU OBJETIVO:
    Generar una lista de **10 recomendaciones de películas** perfectas para este usuario.

    REGLAS ESTRICTAS DE EXCLUSIÓN:
    - JAMÁS recomiendes una película que esté en la lista de "EXCLUIR" (ya vistas por el club o pendientes).
    - Si recomiendas algo que ya ha visto, fallas en tu misión.

    REGLAS DE RAZONAMIENTO (Campo 'reason'):
    - La explicación debe ser persuasiva, de 3-5 frases.
    - DEBES cruzar referencias. No te limites a decir "porque te gusta el terror".
    - Usa este formato de pensamiento: "Como le diste un 9 al guion de [Peli A] y un 8 a la BSO de [Peli B], esta le gustará porque..."
    - Menciona explícitamente títulos que el usuario haya valorado alto.
    - Analiza sus notas detalladas: si valora mucho la fotografía, recomiéndale algo visualmente impactante.

    Devuelve un JSON con este formato exacto:
    [
      { "title": "Titulo exacto", "year": 1999, "reason": "Explicación personalizada..." }
    ]
  `;

  const userPrompt = `
    HISTORIAL DE VALORACIONES (Qué le gusta y por qué):
    ${userMoviesForPrompt}

    LISTA DE EXCLUIR (NO RECOMENDAR):
    ${uniqueExcludeList}

    Dame las 10 mejores recomendaciones.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
          { role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }
      ],
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

    const recommendationsRaw = JSON.parse(response.text) as { title: string, year: number, reason: string }[];

    // Fetch in parallel for speed
    const moviePromises = recommendationsRaw.map(async (rec) => {
        const tmdbData = await findMovieByTitleAndYear(rec.title, rec.year, tmdbToken);
        if (tmdbData) {
            return {
                id: `tmdb-${tmdbData.id}`,
                tmdbId: tmdbData.id,
                title: tmdbData.title,
                year: parseInt(tmdbData.release_date?.split('-')[0]) || rec.year,
                director: tmdbData.credits?.crew?.find(c => c.job === 'Director')?.name || 'Desconocido',
                genre: tmdbData.genres?.map(g => g.name) || [],
                posterUrl: getImageUrl(tmdbData.poster_path),
                backdropUrl: getImageUrl(tmdbData.backdrop_path, 'original'),
                description: tmdbData.overview,
                cast: tmdbData.credits?.cast?.slice(0, 3).map(c => c.name) || [],
                rating: 0, 
                totalVotes: 0,
                recommendationReason: rec.reason
            } as Movie;
        }
        return null;
    });

    const results = await Promise.all(moviePromises);
    return results.filter((m): m is Movie => m !== null);

  } catch (error: any) {
    // Sanitize error log to prevent circular structure issues
    console.error("Error fetching recommendations:", String(error));
    throw new Error("Failed to get recommendations from Gemini");
  }
};

// --- ADVANCED CHAT LOGIC ---

export const sendChatToGemini = async (
    history: ChatMessage[], 
    newMessage: string,
    watchedMovies: Movie[],
    watchlistMovies: Movie[],
    userRatings: UserRating[],
    tmdbToken: string
): Promise<{ text: string, movies: Movie[] }> => {
    
    if (!isAiAvailable()) {
        return { text: "El sistema de IA está offline (Falta API Key).", movies: [] };
    }

    // 1. Build Context string
    const ratingsContext = userRatings.map(r => {
        const movie = watchedMovies.find(m => m.id === r.movieId);
        if (!movie) return '';
        const d = r.detailed;
        if (!d) return `${movie.title}: Nota ${r.rating}`;
        return `${movie.title}: Media ${d.average} (Guion: ${d.script}, Dirección: ${d.direction}, BSO: ${d.soundtrack}, Disfrute: ${d.enjoyment})`;
    }).join('\n');

    const watchlistContext = watchlistMovies.map(m => m.title).join(', ');

    const systemInstruction = `
        Eres la IA OFICIAL del club de cine "Cine Mensa Murcia". Eres un experto cinéfilo, académico y crítico, pero con un tono accesible y apasionado.
        
        TU CONOCIMIENTO SOBRE EL USUARIO:
        - Ha visto y valorado estas películas (con notas detalladas):
        ${ratingsContext}
        
        - Tiene estas películas pendientes de ver (NO se las recomiendes como si no las conociera):
        ${watchlistContext}

        TUS REGLAS:
        1. SOLO HABLAS DE CINE.
        2. PERSONALIZA usando las valoraciones previas.
        3. Si recomiendas una película específica, menciona su Título y Año.
        4. IMPORTANTE: Si mencionas una o varias películas recomendadas, DEBES incluir al final de tu respuesta un bloque oculto con formato JSON para que el sistema pueda mostrar las carátulas.
           El formato del bloque oculto es:
           [[JSON_MOVIES]]
           [{"title": "Pulp Fiction", "year": 1994}, {"title": "The Matrix", "year": 1999}]
           [[/JSON_MOVIES]]
        5. No incluyas ese bloque JSON si solo estás charlando o dando datos generales. Solo cuando recomiendes algo concreto para que el usuario haga clic.

        El usuario está hablando contigo ahora.
    `;

    try {
        const chat = ai.chats.create({
            model: "gemini-2.5-flash",
            config: {
                systemInstruction: systemInstruction,
            },
            history: history.map(h => ({
                role: h.role,
                parts: [{ text: h.text }] // We only send text history to model, ignoring attached movies
            }))
        });

        const result = await chat.sendMessage({ message: newMessage });
        const fullText = result.text;

        // Extract JSON block if present
        let displayText = fullText;
        let foundMovies: Movie[] = [];

        const jsonRegex = /\[\[JSON_MOVIES\]\]([\s\S]*?)\[\[\/JSON_MOVIES\]\]/;
        const match = fullText.match(jsonRegex);

        if (match && match[1]) {
            // Remove the block from the text shown to user
            displayText = fullText.replace(match[0], '').trim();
            
            try {
                const moviesRaw = JSON.parse(match[1]) as { title: string, year: number }[];
                
                // Fetch details for each
                for (const m of moviesRaw) {
                    const tmdbData = await findMovieByTitleAndYear(m.title, m.year, tmdbToken);
                    if (tmdbData) {
                        foundMovies.push({
                            id: `tmdb-${tmdbData.id}`,
                            tmdbId: tmdbData.id,
                            title: tmdbData.title,
                            year: parseInt(tmdbData.release_date?.split('-')[0]) || m.year,
                            director: tmdbData.credits?.crew?.find(c => c.job === 'Director')?.name || 'Desconocido',
                            genre: tmdbData.genres?.map(g => g.name) || [],
                            posterUrl: getImageUrl(tmdbData.poster_path),
                            backdropUrl: getImageUrl(tmdbData.backdrop_path, 'original'),
                            description: tmdbData.overview,
                            cast: tmdbData.credits?.cast?.slice(0, 3).map(c => c.name) || [],
                            rating: 0, 
                            totalVotes: 0
                        });
                    }
                }
            } catch (e) {
                console.error("Error parsing hidden movie JSON:", String(e));
            }
        }

        return { text: displayText, movies: foundMovies };

    } catch (error: any) {
        console.error("Chat Error:", String(error));
        return { text: "Lo siento, hubo un error de conexión con el proyector (API Error). Inténtalo de nuevo.", movies: [] };
    }
};

// --- SECURITY QUIZ ---

export const generateSecurityQuiz = async (
    movieTitle: string
): Promise<{ question: string }[]> => {
    
    if (!isAiAvailable()) {
        // Fallback static quiz if AI is offline
        return [
            { question: "¿Cómo termina la película?" },
            { question: "¿Cuál es el conflicto principal?" },
            { question: "Nombra un personaje memorable." },
            { question: "¿Cuál es la escena más impactante?" },
            { question: "Resume la trama brevemente." }
        ];
    }

    const prompt = `
        Genera un examen de seguridad para verificar si un usuario ha visto la película: "${movieTitle}".
        
        REQUISITOS:
        - 5 Preguntas.
        - NIVEL: FÁCIL para quien la vio, IMPOSIBLE para quien no.
        - Pregunta sobre: El final, el destino del protagonista, el conflicto principal o la escena más famosa.
        - PROHIBIDO: Preguntar nombres de actores, años, colores de ropa, matrículas o detalles triviales que se olvidan.
        - Tienen que ser cosas que se te quedan grabadas al verla.
        
        Devuelve un JSON array de objetos: [{"question": "..."}]
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json"
            }
        });
        
        if (!response.text) throw new Error("No response");
        return JSON.parse(response.text);
    } catch (e) {
        console.error("Quiz Gen Error:", String(e));
        // Fallback
        return [
            { question: "¿Cómo termina la película?" },
            { question: "¿Cuál es el conflicto principal?" },
            { question: "Nombra un personaje memorable aparte del protagonista." },
            { question: "¿Cuál es la escena más impactante para ti?" },
            { question: "Resume el giro final si lo hay." }
        ];
    }
}

export const validateSecurityQuiz = async (
    movieTitle: string,
    qa: { question: string, answer: string }[]
): Promise<{ passed: boolean, reason: string }> => {
    
    if (!isAiAvailable()) {
        return { passed: true, reason: "Sistema IA offline. Validación automática." };
    }

    const context = qa.map(i => `P: ${i.question}\nR: ${i.answer}`).join('\n\n');

    const prompt = `
        Eres un profesor de cine estricto. Estás evaluando si un alumno ha visto realmente la película "${movieTitle}".
        
        Aquí están sus respuestas al test:
        ${context}
        
        TAREA:
        Evalúa si las respuestas demuestran que ha visto la película.
        - Sé flexible con faltas de ortografía o nombres inexactos.
        - Sé ESTRICTO con los hechos de la trama. Si inventa cosas, suspende.
        - Si las respuestas son muy vagas ("es buena", "me gustó", "el final es triste"), SUSPENDE. Tienen que demostrar conocimiento.
        
        Devuelve JSON: { "passed": boolean, "reason": "Breve explicación en una frase" }
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });
        
        if (!response.text) return { passed: false, reason: "Error de validación" };
        return JSON.parse(response.text);
    } catch (e) {
        return { passed: true, reason: "Sistema de validación offline, aprobado por defecto." };
    }
}