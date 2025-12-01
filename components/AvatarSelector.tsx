
import React, { useState } from 'react';
import { searchPersonTMDB, getImageUrl } from '../services/tmdbService';
import { Search, Loader2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import { STARTER_AVATARS } from '../constants';

interface AvatarSelectorProps {
  currentAvatar?: string;
  onSelect: (url: string) => void;
}

const AvatarSelector: React.FC<AvatarSelectorProps> = ({ currentAvatar, onSelect }) => {
  const { tmdbToken } = useData();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !tmdbToken) return;
    
    setSearching(true);
    try {
        const results = await searchPersonTMDB(searchQuery, tmdbToken);
        setSearchResults(results.filter(p => p.profile_path)); // Only show people with images
    } catch (e) {
        console.error(String(e));
    } finally {
        setSearching(false);
    }
  };

  return (
    <div className="w-full">
        <div className="bg-black/20 p-4 rounded-xl border border-gray-700 min-h-[200px] max-h-[300px] overflow-y-auto custom-scrollbar">
            
            {/* Buscador: Solo activo si hay token (Usuario logueado) */}
            <form onSubmit={handleSearch} className="flex gap-2 mb-4 sticky top-0 z-10">
                <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={tmdbToken ? "Buscar actor/director..." : "Elige un avatar inicial"}
                    disabled={!tmdbToken}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-cine-gold outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button type="submit" disabled={searching || !tmdbToken} className="bg-cine-gold text-black p-2 rounded-lg disabled:opacity-50">
                    {searching ? <Loader2 className="animate-spin" size={16}/> : <Search size={16}/>}
                </button>
            </form>

            {/* Resultados de búsqueda (Prioridad) */}
            {searchResults.length > 0 ? (
                <div className="grid grid-cols-4 gap-3">
                    {searchResults.map((person) => (
                        <div 
                            key={person.id}
                            onClick={() => onSelect(getImageUrl(person.profile_path, 'w200'))}
                            className={`cursor-pointer rounded-full overflow-hidden aspect-square border-2 transition-all hover:scale-110 ${currentAvatar === getImageUrl(person.profile_path, 'w200') ? 'border-cine-gold shadow-[0_0_10px_rgba(212,175,55,0.5)]' : 'border-transparent hover:border-cine-gold'}`}
                            title={person.name}
                        >
                            <img src={getImageUrl(person.profile_path, 'w200')} alt={person.name} className="w-full h-full object-cover" />
                        </div>
                    ))}
                </div>
            ) : (
                /* Fallback: Avatares iniciales (Siempre visibles si no hay búsqueda activa) */
                <div className="grid grid-cols-4 gap-3">
                    {STARTER_AVATARS.map((avatar, idx) => (
                        <div 
                            key={idx}
                            onClick={() => onSelect(avatar.url)}
                            className={`cursor-pointer rounded-full overflow-hidden aspect-square border-2 transition-all hover:scale-110 ${currentAvatar === avatar.url ? 'border-cine-gold shadow-[0_0_10px_rgba(212,175,55,0.5)]' : 'border-transparent hover:border-cine-gold'}`}
                            title={avatar.name}
                        >
                            <img src={avatar.url} alt={avatar.name} className="w-full h-full object-cover" />
                        </div>
                    ))}
                </div>
            )}
            
            {!tmdbToken && (
                <p className="text-center text-xs text-gray-500 mt-4 italic">
                    *Podrás buscar una foto personalizada en tu perfil una vez te registres.
                </p>
            )}
        </div>
    </div>
  );
};

export default AvatarSelector;
