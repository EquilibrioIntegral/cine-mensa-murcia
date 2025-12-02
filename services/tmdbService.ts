

// Service to interact with TMDB API

const BASE_URL = 'https://api.themoviedb.org/3';

// Helper to determine auth method
const getAuthHeadersAndUrl = (endpoint: string, token: string, queryParams: Record<string, string> = {}) => {
  const cleanToken = token.trim().replace(/^Bearer\s+/i, '');
  
  // Heuristic: v3 API keys are usually 32 chars hex. v4 Tokens are very long JWTs.
  // If length > 50, treat as Bearer Token. Otherwise, treat as API Key.
  const isBearerToken = cleanToken.length > 50;

  const headers: HeadersInit = {
    accept: 'application/json',
  };

  if (isBearerToken) {
    headers['Authorization'] = `Bearer ${cleanToken}`;
  }

  // Build URL with query params
  const url = new URL(`${BASE_URL}${endpoint}`);
  
  // Add API Key if it's not a Bearer token
  if (!isBearerToken) {
    url.searchParams.append('api_key', cleanToken);
  }

  // Add other params
  Object.keys(queryParams).forEach(key => {
    url.searchParams.append(key, queryParams[key]);
  });

  return { url: url.toString(), headers };
};

export interface TMDBMovieResult {
  id: number;
  title: string;
  release_date: string;
  poster_path: string;
  backdrop_path?: string;
  overview: string;
}

export interface TMDBPersonResult {
    id: number;
    name: string;
    profile_path: string | null;
    known_for_department: string;
}

export interface TMDBVideo {
  id: string;
  iso_639_1: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
}

export interface TMDBProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

export interface TMDBWatchProviders {
  results: Record<string, {
      link: string;
      flatrate?: TMDBProvider[];
      rent?: TMDBProvider[];
      buy?: TMDBProvider[];
  }>;
}

export interface TMDBMovieDetails extends TMDBMovieResult {
  backdrop_path: string;
  genres: { id: number; name: string }[];
  credits: {
    crew: { job: string; name: string }[];
    cast: { name: string; character: string }[];
  };
  videos: {
    results: TMDBVideo[];
  };
  'watch/providers'?: TMDBWatchProviders;
  vote_average: number;
}

export const searchMoviesTMDB = async (query: string, token: string): Promise<TMDBMovieResult[]> => {
  if (!query || !token || token === "TU_API_KEY_DE_TMDB_AQUI") return [];
  
  try {
    const { url, headers } = getAuthHeadersAndUrl('/search/movie', token, {
        query: query,
        language: 'es-ES',
        page: '1',
        include_adult: 'false'
    });
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
        console.error(`TMDB Search Error: ${response.status}`);
        return [];
    }
    
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("TMDB Search Exception:", String(error));
    return [];
  }
};

export const searchPersonTMDB = async (query: string, token: string): Promise<TMDBPersonResult[]> => {
    if (!query || !token) return [];

    try {
        const { url, headers } = getAuthHeadersAndUrl('/search/person', token, {
            query: query,
            language: 'es-ES',
            page: '1',
            include_adult: 'false'
        });

        const response = await fetch(url, { headers });
        if (!response.ok) return [];

        const data = await response.json();
        return data.results || [];
    } catch (e) {
        console.error("TMDB Person Search Error:", String(e));
        return [];
    }
};

// New helper for AI Enrichment
export const findMovieByTitleAndYear = async (title: string, year: number | undefined, token: string): Promise<TMDBMovieDetails | null> => {
    if (!token) return null;
    
    try {
        const queryParams: Record<string, string> = {
            query: title,
            language: 'es-ES',
            page: '1'
        };
        if (year) queryParams['year'] = year.toString();

        const { url, headers } = getAuthHeadersAndUrl('/search/movie', token, queryParams);
        
        const response = await fetch(url, { headers });
        if (!response.ok) return null;

        const data = await response.json();
        const results = data.results as TMDBMovieResult[];

        if (results && results.length > 0) {
            // Get full details for the first match to get credits/director
            return await getMovieDetailsTMDB(results[0].id, token);
        }
        return null;

    } catch (e) {
        console.error("Error finding movie for AI:", String(e));
        return null;
    }
}

export const getMovieDetailsTMDB = async (id: number, token: string): Promise<TMDBMovieDetails | null> => {
  if (!id || !token) return null;

  try {
    const { url, headers } = getAuthHeadersAndUrl(`/movie/${id}`, token, {
        append_to_response: 'credits,videos,watch/providers', // Request videos and providers
        language: 'es-ES',
        include_video_language: 'es,en' // Get Spanish first, fallback to English if needed
    });

    const response = await fetch(url, { headers });

    if (!response.ok) {
        console.error(`TMDB Details Error: ${response.status}`);
        return null;
    }

    return await response.json();
  } catch (error) {
    console.error("TMDB Details Exception:", String(error));
    return null;
  }
};

export const getImageUrl = (path: string | null, size: 'w200' | 'w500' | 'original' = 'w500') => {
  if (!path) return 'https://via.placeholder.com/500x750?text=No+Image';
  return `https://image.tmdb.org/t/p/${size}${path}`;
};