
import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import AvatarSelector from '../components/AvatarSelector';
import { User, Film, Star, MessageSquare, ThumbsUp } from 'lucide-react';

const Profile: React.FC = () => {
  const { user, userRatings, updateUserProfile } = useData();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatarUrl || '');
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const myReviews = userRatings.filter(r => r.userId === user.id);
  const totalReviews = myReviews.length;
  const totalLikes = myReviews.reduce((acc, r) => acc + (r.likes?.length || 0), 0);
  const avgGiven = totalReviews > 0 
    ? (myReviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1) 
    : '0';

  const handleSave = async () => {
      setSaving(true);
      await updateUserProfile(name, avatar);
      setSaving(false);
      setIsEditing(false);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl pb-20">
        <h2 className="text-3xl font-bold text-white mb-8 flex items-center gap-3">
            <User size={32} className="text-cine-gold" /> Perfil de Socio
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Left: Card Profile */}
            <div className="bg-cine-gray rounded-xl border border-gray-700 overflow-hidden shadow-2xl h-fit">
                <div className="h-32 bg-gradient-to-br from-cine-gold to-yellow-800"></div>
                <div className="px-6 relative pb-6 text-center">
                    <div className="w-32 h-32 rounded-full border-4 border-cine-dark overflow-hidden mx-auto -mt-16 bg-black">
                        <img src={isEditing ? avatar : user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                    </div>
                    
                    {!isEditing ? (
                        <div className="mt-4">
                            <h3 className="text-2xl font-bold text-white">{user.name}</h3>
                            <p className="text-gray-400 text-sm">{user.email}</p>
                            <div className="mt-4 inline-block bg-cine-gold/20 text-cine-gold px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                                {user.isAdmin ? 'Administrador' : 'Socio VIP'}
                            </div>
                            <button 
                                onClick={() => setIsEditing(true)}
                                className="mt-6 w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 rounded-lg transition-colors border border-gray-600"
                            >
                                Editar Perfil
                            </button>
                        </div>
                    ) : (
                        <div className="mt-4 space-y-4">
                            <input 
                                type="text" 
                                value={name} 
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-black/40 border border-gray-600 rounded p-2 text-center text-white font-bold"
                            />
                            <div className="text-left">
                                <label className="text-xs text-gray-500 font-bold uppercase mb-2 block text-center">Cambiar Avatar</label>
                                <AvatarSelector currentAvatar={avatar} onSelect={setAvatar} />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setIsEditing(false)} className="flex-1 bg-red-900/50 text-red-200 py-2 rounded">Cancelar</button>
                                <button onClick={handleSave} disabled={saving} className="flex-1 bg-green-700 text-white py-2 rounded font-bold">
                                    {saving ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Stats */}
            <div className="md:col-span-2 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black/40 p-6 rounded-xl border border-gray-800 flex items-center gap-4">
                        <div className="p-3 bg-blue-900/30 rounded-full text-blue-400"><Film size={24}/></div>
                        <div>
                            <p className="text-2xl font-bold text-white">{user.watchedMovies.length}</p>
                            <p className="text-sm text-gray-500">Películas Vistas</p>
                        </div>
                    </div>
                    <div className="bg-black/40 p-6 rounded-xl border border-gray-800 flex items-center gap-4">
                        <div className="p-3 bg-purple-900/30 rounded-full text-purple-400"><MessageSquare size={24}/></div>
                        <div>
                            <p className="text-2xl font-bold text-white">{totalReviews}</p>
                            <p className="text-sm text-gray-500">Reseñas</p>
                        </div>
                    </div>
                    <div className="bg-black/40 p-6 rounded-xl border border-gray-800 flex items-center gap-4">
                        <div className="p-3 bg-yellow-900/30 rounded-full text-yellow-400"><Star size={24}/></div>
                        <div>
                            <p className="text-2xl font-bold text-white">{avgGiven}</p>
                            <p className="text-sm text-gray-500">Nota Media Dada</p>
                        </div>
                    </div>
                    <div className="bg-black/40 p-6 rounded-xl border border-gray-800 flex items-center gap-4">
                        <div className="p-3 bg-green-900/30 rounded-full text-green-400"><ThumbsUp size={24}/></div>
                        <div>
                            <p className="text-2xl font-bold text-white">{totalLikes}</p>
                            <p className="text-sm text-gray-500">Likes Recibidos</p>
                        </div>
                    </div>
                </div>

                <div className="bg-cine-gray p-6 rounded-xl border border-gray-800">
                    <h3 className="font-bold text-white mb-4">Últimas Reseñas</h3>
                    {myReviews.length === 0 ? (
                        <p className="text-gray-500 italic">No has escrito reseñas aún.</p>
                    ) : (
                        <div className="space-y-4">
                            {myReviews.slice(0, 3).map((r, idx) => (
                                <div key={idx} className="border-b border-gray-800 pb-3 last:border-0">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-cine-gold font-bold">{r.rating.toFixed(1)} <span className="text-xs text-gray-500">/ 10</span></span>
                                        <span className="text-xs text-gray-500">{new Date(r.timestamp).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-gray-300 text-sm line-clamp-2">"{r.comment}"</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};

export default Profile;
