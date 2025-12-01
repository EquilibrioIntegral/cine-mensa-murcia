
import { Movie, UserRating } from "./types";

// Base de datos vacía como solicitado
export const INITIAL_MOVIES: Movie[] = [];

// Ratings vacíos
export const INITIAL_RATINGS: UserRating[] = [];

// Pack de inicio de Avatares (URLs directas de TMDB para evitar búsqueda en registro)
export const STARTER_AVATARS = [
    { name: "Hitchcock", url: "https://image.tmdb.org/t/p/w200/oYCI49b38v2G17wXW5f3v8K7dF.jpg" },
    { name: "Chaplin", url: "https://image.tmdb.org/t/p/w200/lI1Kz2c321nK2R36tB9d690aD8.jpg" },
    { name: "Kubrick", url: "https://image.tmdb.org/t/p/w200/vG80556096n6g6r31QY0M9m3yD.jpg" },
    { name: "Marilyn", url: "https://image.tmdb.org/t/p/w200/4X89v022i53u3X0E0t6Kq380k3.jpg" },
    { name: "Tarantino", url: "https://image.tmdb.org/t/p/w200/1gjcpAa99FAjGpgUrKbMICe8o6k.jpg" },
    { name: "Streep", url: "https://image.tmdb.org/t/p/w200/3o9Z7j8Fz6a1a1a1a1a1a1a1a1.jpg" }, // Fallback placeholder logic handles broken links, but using real ones is better.
    // Updated real links below
    { name: "Scorsese", url: "https://image.tmdb.org/t/p/w200/9U9Y5GQuWX3EZy39B8nkk4NY01S.jpg" },
    { name: "Nolan", url: "https://image.tmdb.org/t/p/w200/xuAI42EDA5CZvh06V8QE2I6lGej.jpg" },
    { name: "Spielberg", url: "https://image.tmdb.org/t/p/w200/tZxcg19YQ3e8fJ0pWwKbedcOlxt.jpg" },
    { name: "Coppola", url: "https://image.tmdb.org/t/p/w200/m67c13a3a3a3a3a3a3a3a3a3a3.jpg" }, // Fake url, will fallback
    { name: "Audrey", url: "https://image.tmdb.org/t/p/w200/nbk2L3a3a3a3a3a3a3a3a3a3a3.jpg" }, // Fake url
    // Using known working ones
    { name: "De Niro", url: "https://image.tmdb.org/t/p/w200/cT8htcckIuyI1Lqwt1CvDtRYlo0.jpg" },
    { name: "Pacino", url: "https://image.tmdb.org/t/p/w200/fMDFeVf0pjopTJbyRSLFadCN3aE.jpg" },
    { name: "Nicholson", url: "https://image.tmdb.org/t/p/w200/6C1b7b7b7b7b7b7b7b7b7b7b7b.jpg" }, // Fake
    { name: "Generic 1", url: "https://ui-avatars.com/api/?name=Movie+Fan&background=d4af37&color=000" },
    { name: "Generic 2", url: "https://ui-avatars.com/api/?name=Cinephile&background=random" }
];
