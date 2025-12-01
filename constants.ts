
import { Movie, UserRating } from "./types";

// Base de datos vacía como solicitado
export const INITIAL_MOVIES: Movie[] = [];

// Ratings vacíos
export const INITIAL_RATINGS: UserRating[] = [];

// Avatares seguros para el registro (No dependen de la API Key de TMDB)
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
