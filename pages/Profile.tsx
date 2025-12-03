

import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import AvatarSelector from '../components/AvatarSelector';
import { User, Film, Star, MessageSquare, ThumbsUp, Medal, Trophy, CheckCircle, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import RankBadge from '../components/RankBadge';
import { MISSIONS, RANKS, XP_TABLE } from '../constants';

const Profile: React.FC = () => {
  const { user, userRatings, updateUserProfile, initialProfileTab, setInitialProfileTab } = useData();
  const [activeTab, setActiveTab] = useState<'profile' | 'career'>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatarUrl || '');
  const [saving, setSaving] = useState(false);
  
  // State for Career Accordions (defaults to current rank open)
  const [expandedRank, setExpandedRank] = useState<string | null>(null);

  // Sync tab with context (if user came from the modal)
  useEffect(() => {
      setActiveTab(initialProfileTab);
      // Auto-expand current rank
      if (user) {
          const currentRank = RANKS.slice().reverse().find(r => (user.level || 1) >= r.minLevel);
          if (currentRank) setExpandedRank(currentRank.id);
      }
      // Reset context so normal navigation works
      return () => setInitialProfileTab('profile');
  }, []); // Only on mount

  if (!user) return null;

  const myReviews = userRatings.filter(r => r.userId === user.id);
  const totalReviews = myReviews.length;
  const totalLikes = myReviews.reduce((acc, r) => acc + (r.likes?.length || 0), 0);
  const avgGiven = totalReviews > 0 
    ? (myReviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1) 
    : '0';

  // --- XP PROGRESS CALCULATION ---
  const currentLevel = user.level || 1;
  const xp = user.xp || 0;
  
  let prevThreshold = 0;
  let nextThreshold = XP_TABLE[0]; // Default for Lvl 1

  if (currentLevel > 1) {
      prevThreshold = XP_TABLE[currentLevel - 2];
      nextThreshold = XP_TABLE[currentLevel - 1] || (prevThreshold * 1.5); // Fallback
  }

  const xpProgressInLevel = Math.max(0, xp - prevThreshold);
  const xpNeededForLevel = nextThreshold - prevThreshold;
  const levelProgress = Math.min(100, (xpProgressInLevel / xpNeededForLevel) * 100);
  const xpRemaining = nextThreshold - xp;


  const handleSave = async () => {
      setSaving(true);
      await updateUserProfile(name, avatar);
      setSaving(false);
      setIsEditing(false);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl pb-20">
        <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                <User size={32} className="text-cine-gold" /> Mi Perfil
            </h2>
            <div className="bg-cine-gray p-1 rounded-full border border-gray-800 flex">
                <button 
                    onClick={() => setActiveTab('profile')}
                    className={`px-4 py-2 rounded-full font-bold transition-all text-sm ${activeTab === 'profile' ? 'bg-cine-gold text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                    Datos
                </button>
                <button 
                    onClick={() => setActiveTab('career')}
                    className={`px-4 py-2 rounded-full font-bold transition-all text-sm flex items-center gap-2 ${activeTab === 'career' ? 'bg-cine-gold text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                    <Medal size={14}/> Carrera
                </button>
            </div>
        </div>

        {activeTab === 'profile' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fade-in">
                
                {/* Left: Card Profile */}
                <div className="bg-cine-gray rounded-xl border border-gray-700 overflow-hidden shadow-2xl h-fit">
                    <div className="h-32 bg-gradient-to-br from-cine-gold to-yellow-800"></div>
                    <div className="px-6 relative pb-6 text-center">
                        <div className="w-32 h-32 rounded-full border-4 border-cine-dark overflow-hidden mx-auto -mt-16 bg-black relative group">
                            <img src={isEditing ? avatar : user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                        </div>
                        
                        {!isEditing ? (
                            <div className="mt-4">
                                <h3 className="text-2xl font-bold text-white">{user.name}</h3>
                                <div className="mt-2 mb-4">
                                    <RankBadge level={user.level || 1} size="md" />
                                </div>
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
                                            <span className="text-xs text-gray-500">{new Date(r.timestamp).toLocaleDateString()}</p>
                                        </div>
                                        <p className="text-gray-300 text-sm line-clamp-2">"{r.comment}"</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'career' && (
            <div className="animate-fade-in space-y-8">
                {/* Level Progress */}
                <div className="bg-gradient-to-r from-gray-900 to-black p-8 rounded-xl border border-gray-700 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Trophy size={128} className="text-cine-gold" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-end mb-4">
                            <div>
                                <h3 className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-1">Nivel Actual</h3>
                                <RankBadge level={user.level || 1} size="lg" />
                            </div>
                            <div className="text-right">
                                <p className="text-3xl font-black text-white">{user.xp || 0} <span className="text-sm text-cine-gold font-bold">XP</span></p>
                                <p className="text-xs text-gray-500">Faltan {xpRemaining} XP para subir</p>
                            </div>
                        </div>
                        <div className="w-full h-4 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                            <div 
                                className="h-full bg-gradient-to-r from-yellow-600 to-cine-gold transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(212,175,55,0.5)]"
                                style={{ width: `${levelProgress}%` }}
                            ></div>
                        </div>
                    </div>
                </div>

                {/* ROADMAP SECTION */}
                <h3 className="text-2xl font-bold text-white flex items-center gap-2 mb-6 border-b border-gray-800 pb-2">
                    <Film className="text-cine-gold" size={24}/> Tu Camino al Estrellato
                </h3>
                
                <div className="space-y-4">
                    {RANKS.map((rank, idx) => {
                        const isUnlocked = currentLevel >= rank.minLevel;
                        const isNext = !isUnlocked && (idx === 0 || currentLevel >= RANKS[idx - 1].minLevel);
                        const isExpanded = expandedRank === rank.id;
                        
                        // Find missions for this rank
                        const rankMissions = MISSIONS.filter(m => m.rankId === rank.id);
                        const completedCount = rankMissions.filter(m => user.completedMissions?.includes(m.id)).length;
                        const totalCount = rankMissions.length;
                        
                        // Determine Rank Status
                        let statusColor = "text-gray-500";
                        let borderColor = "border-gray-800";
                        let bgColor = "bg-black/40";
                        
                        if (isUnlocked) {
                             statusColor = rank.color;
                             borderColor = "border-cine-gold/50";
                             bgColor = "bg-cine-gold/5";
                        } else if (isNext) {
                             borderColor = "border-gray-600";
                        }

                        return (
                            <div key={rank.id} className={`rounded-xl border transition-all overflow-hidden ${borderColor} ${bgColor} ${!isUnlocked && !isNext ? 'opacity-50 grayscale' : ''}`}>
                                <div 
                                    onClick={() => (isUnlocked || isNext) && setExpandedRank(isExpanded ? null : rank.id)}
                                    className={`p-4 flex items-center justify-between cursor-pointer ${isUnlocked ? 'hover:bg-cine-gold/10' : ''}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-full ${isUnlocked ? 'bg-black border border-cine-gold' : 'bg-gray-800'}`}>
                                            {isUnlocked ? <rank.icon size={24} className={rank.color} /> : <Lock size={24} className="text-gray-500"/>}
                                        </div>
                                        <div>
                                            <h4 className={`text-lg font-bold ${isUnlocked ? 'text-white' : 'text-gray-400'}`}>{rank.title}</h4>
                                            <p className="text-xs text-gray-500 font-mono">Nivel {rank.minLevel}+</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        {rankMissions.length > 0 && (
                                            <div className="text-right hidden sm:block">
                                                <p className="text-xs text-gray-500 uppercase font-bold">Misiones</p>
                                                <p className={`font-bold ${completedCount === totalCount ? 'text-green-500' : 'text-white'}`}>
                                                    {completedCount} / {totalCount}
                                                </p>
                                            </div>
                                        )}
                                        {isExpanded ? <ChevronUp size={20} className="text-gray-500"/> : <ChevronDown size={20} className="text-gray-500"/>}
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="border-t border-gray-800 p-4 bg-black/20">
                                        {rankMissions.length === 0 ? (
                                            <p className="text-gray-500 italic text-sm text-center">No hay misiones específicas para este rango aún.</p>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {rankMissions.map(mission => {
                                                    const isCompleted = user.completedMissions?.includes(mission.id);
                                                    // New Logic: Locked if user level is lower than mission requirement, even if rank is unlocked
                                                    const isLevelLocked = mission.minLevel && currentLevel < mission.minLevel;
                                                    const Icon = mission.icon;
                                                    
                                                    // Locked Visuals
                                                    if (isLevelLocked) {
                                                        return (
                                                            <div key={mission.id} className="p-3 rounded-lg border border-gray-800 bg-black/20 flex items-center gap-3 opacity-60 grayscale relative overflow-hidden group">
                                                                <div className="p-2 rounded-full bg-black/50 text-gray-600">
                                                                    <Lock size={18} />
                                                                </div>
                                                                <div className="flex-grow">
                                                                    <h5 className="text-sm font-bold text-gray-500">{mission.title}</h5>
                                                                    <p className="text-xs text-gray-600">Desbloquea en Nivel {mission.minLevel}</p>
                                                                </div>
                                                                {/* Tooltip on Hover */}
                                                                <div className="absolute inset-0 bg-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <span className="text-xs font-bold text-cine-gold">Necesitas Nivel {mission.minLevel}</span>
                                                                </div>
                                                            </div>
                                                        )
                                                    }

                                                    return (
                                                        <div 
                                                            key={mission.id} 
                                                            className={`p-3 rounded-lg border flex items-center gap-3 transition-all ${
                                                                isCompleted 
                                                                    ? 'bg-green-900/10 border-green-900/50' 
                                                                    : 'bg-black/40 border-gray-800'
                                                            }`}
                                                        >
                                                            <div className={`p-2 rounded-full ${isCompleted ? 'bg-green-900/20 text-green-500' : 'bg-gray-800 text-gray-500'}`}>
                                                                {isCompleted ? <CheckCircle size={18} /> : <Icon size={18} />}
                                                            </div>
                                                            <div className="flex-grow">
                                                                <h5 className={`text-sm font-bold ${isCompleted ? 'text-white' : 'text-gray-300'}`}>{mission.title}</h5>
                                                                <p className="text-xs text-gray-500">{mission.description}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className={`text-[10px] font-bold px-2 py-1 rounded ${isCompleted ? 'bg-cine-gold text-black' : 'bg-gray-800 text-gray-500'}`}>
                                                                    +{mission.xpReward} XP
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        )}
    </div>
  );
};

export default Profile;