
import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Radar, MessageCircle } from 'lucide-react';

const OnlineUsersWidget: React.FC = () => {
  const { allUsers, user, startPrivateChat } = useData();

  // Find users active in the last 5 minutes
  const onlineUsers = useMemo(() => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      return allUsers.filter(u => (u.lastSeen || 0) > fiveMinutesAgo);
  }, [allUsers]);

  if (onlineUsers.length === 0) return null;

  const canPrivateChat = user?.inventory?.includes('item_private_chat');

  const handleUserClick = (targetUserId: string) => {
      if (user?.id === targetUserId) return; // Can't chat with self
      if (canPrivateChat) {
          startPrivateChat(targetUserId);
      }
  };

  return (
    <div className="bg-black/60 border border-green-500/30 rounded-xl p-4 mb-8 shadow-[0_0_20px_rgba(34,197,94,0.1)] relative overflow-hidden animate-fade-in">
        {/* Radar Effect Background */}
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-green-500/10 rounded-full animate-ping opacity-20"></div>
        
        <div className="flex items-center gap-3 mb-3 border-b border-green-500/20 pb-2 relative z-10">
            <div className="bg-green-900/30 p-2 rounded-full text-green-400 animate-pulse">
                <Radar size={20} />
            </div>
            <div>
                <h4 className="text-green-400 font-bold uppercase tracking-widest text-xs">Radar de Usuarios</h4>
                <p className="text-white text-sm font-bold">{onlineUsers.length} Personas Online Ahora</p>
                {canPrivateChat && <p className="text-[10px] text-gray-400">Pulsa en un usuario para chatear</p>}
            </div>
        </div>

        <div className="flex flex-wrap gap-4 relative z-10">
            {onlineUsers.map(u => (
                <div 
                    key={u.id} 
                    onClick={() => handleUserClick(u.id)}
                    className={`flex items-center gap-2 bg-black/40 pr-3 rounded-full border transition-all ${
                        canPrivateChat && u.id !== user?.id
                            ? 'border-green-500 hover:bg-green-900/20 cursor-pointer hover:border-green-400 hover:scale-105' 
                            : 'border-green-900/50 cursor-default'
                    }`}
                    title={canPrivateChat && u.id !== user?.id ? "Iniciar chat privado" : "Usuario Online"}
                >
                    <div className="relative">
                        <img src={u.avatarUrl} alt={u.name} className="w-8 h-8 rounded-full border border-green-700/50" />
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-black rounded-full"></span>
                    </div>
                    <span className="text-xs text-gray-300 font-medium truncate max-w-[100px]">{u.name}</span>
                    {canPrivateChat && u.id !== user?.id && <MessageCircle size={10} className="text-green-500"/>}
                </div>
            ))}
        </div>
    </div>
  );
};

export default OnlineUsersWidget;
