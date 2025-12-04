
import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Radar, MessageCircle, User as UserIcon } from 'lucide-react';

const OnlineUsersWidget: React.FC = () => {
  const { allUsers, user, startPrivateChat } = useData();

  // Find users active in the last 5 minutes
  const onlineUsers = useMemo(() => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      // Filter active users, exclude self for the list display (or keep to show we are online)
      return allUsers.filter(u => (u.lastSeen || 0) > fiveMinutesAgo && u.id !== user?.id);
  }, [allUsers, user?.id]);

  const canPrivateChat = user?.inventory?.includes('item_private_chat');

  const handleUserClick = (targetUserId: string) => {
      if (canPrivateChat) {
          startPrivateChat(targetUserId);
      }
  };

  return (
    <div className="bg-black/60 border border-green-500/30 rounded-xl p-4 shadow-[0_0_20px_rgba(34,197,94,0.1)] relative overflow-hidden animate-fade-in">
        {/* Radar Effect Background */}
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-green-500/10 rounded-full animate-ping opacity-20"></div>
        
        <div className="flex items-center gap-3 mb-3 border-b border-green-500/20 pb-2 relative z-10">
            <div className="bg-green-900/30 p-2 rounded-full text-green-400 animate-pulse">
                <Radar size={20} />
            </div>
            <div>
                <h4 className="text-green-400 font-bold uppercase tracking-widest text-xs">Radar de Usuarios</h4>
                <p className="text-white text-sm font-bold">
                    {onlineUsers.length > 0 ? `${onlineUsers.length} Otros Usuarios Online` : 'Escaneando Frecuencias...'}
                </p>
                {canPrivateChat && onlineUsers.length > 0 && <p className="text-[10px] text-gray-400">Pulsa en un usuario para chatear</p>}
            </div>
        </div>

        <div className="flex flex-wrap gap-4 relative z-10">
            {/* Show Current User (Self) first to confirm system works */}
            {user && (
                <div className="flex items-center gap-2 bg-black/40 pr-3 rounded-full border border-green-900/30 opacity-70">
                    <div className="relative">
                        <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-full border border-green-900/50 grayscale" />
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-600 border-2 border-black rounded-full"></span>
                    </div>
                    <span className="text-xs text-gray-500 font-medium truncate max-w-[100px]">{user.name} (Tú)</span>
                </div>
            )}

            {onlineUsers.length > 0 ? (
                onlineUsers.map(u => (
                    <div 
                        key={u.id} 
                        onClick={() => handleUserClick(u.id)}
                        className={`flex items-center gap-2 bg-black/40 pr-3 rounded-full border transition-all animate-scale-in ${
                            canPrivateChat
                                ? 'border-green-500 hover:bg-green-900/20 cursor-pointer hover:border-green-400 hover:scale-105' 
                                : 'border-green-900/50 cursor-default'
                        }`}
                        title={canPrivateChat ? "Iniciar chat privado" : "Usuario Online"}
                    >
                        <div className="relative">
                            <img src={u.avatarUrl} alt={u.name} className="w-8 h-8 rounded-full border border-green-700/50" />
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-black rounded-full animate-pulse"></span>
                        </div>
                        <span className="text-xs text-gray-300 font-medium truncate max-w-[100px]">{u.name}</span>
                        {canPrivateChat && <MessageCircle size={10} className="text-green-500"/>}
                    </div>
                ))
            ) : (
                <div className="w-full text-center py-2">
                    <p className="text-xs text-green-500/50 italic animate-pulse flex items-center justify-center gap-2">
                        <Radar size={12}/> Buscando señales de vida...
                    </p>
                </div>
            )}
        </div>
    </div>
  );
};

export default OnlineUsersWidget;
