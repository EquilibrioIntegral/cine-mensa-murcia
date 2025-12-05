
import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Mail, Trash2, CheckCircle, Info, Shield, ShoppingBag, ChevronDown, ChevronUp, AlertCircle, Inbox, ArrowRight, Loader2, Check } from 'lucide-react';
import { MailboxMessage, ViewState } from '../types';

const MessageIcon = ({ type }: { type: MailboxMessage['type'] }) => {
    switch(type) {
        case 'reward': return <ShoppingBag className="text-yellow-500" size={20} />;
        case 'alert': return <AlertCircle className="text-red-500" size={20} />;
        case 'info': return <Info className="text-blue-400" size={20} />;
        default: return <Shield className="text-gray-400" size={20} />;
    }
}

const Mailbox: React.FC = () => {
  const { mailbox, markMessageRead, markAllMessagesRead, deleteMessage, setView } = useData();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleToggle = (msg: MailboxMessage) => {
      // Don't toggle if we are in the middle of deleting this message
      if (deletingId === msg.id) return;

      if (expandedId === msg.id) {
          setExpandedId(null);
      } else {
          setExpandedId(msg.id);
          if (!msg.read) {
              markMessageRead(msg.id);
          }
      }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation(); // Stop expansion
      if (deletingId) return; // Prevent double clicks

      setDeletingId(id);
      try {
          await deleteMessage(id);
          // UI update will happen automatically via Snapshot
          if (expandedId === id) setExpandedId(null);
      } catch (error) {
          console.error(error);
          alert("No se pudo eliminar el mensaje. Inténtalo de nuevo.");
      } finally {
          setDeletingId(null);
      }
  };

  const handleAction = (e: React.MouseEvent, movieId: string) => {
      e.stopPropagation();
      setView(ViewState.MOVIE_DETAILS, movieId);
  };

  const handleMarkAllRead = () => {
      markAllMessagesRead();
  };

  const unreadCount = mailbox.filter((m: MailboxMessage) => !m.read).length;

  return (
    <div className="container mx-auto px-4 py-8 pb-20 max-w-4xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-3">
                <div className="bg-cine-gold p-3 rounded-full text-black shadow-lg shadow-cine-gold/20">
                    <Mail size={24} />
                </div>
                <div>
                    <h2 className="text-3xl font-bold text-white">Buzón Personal</h2>
                    <p className="text-sm text-gray-400">
                        {unreadCount > 0 ? `Tienes ${unreadCount} mensajes sin leer` : 'Estás al día'}
                    </p>
                </div>
            </div>

            {unreadCount > 0 && (
                <button 
                    onClick={handleMarkAllRead}
                    className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm font-bold transition-colors border border-gray-700"
                >
                    <CheckCircle size={16}/> Marcar todo leído
                </button>
            )}
        </div>

        {mailbox.length === 0 ? (
            <div className="bg-cine-gray/50 rounded-2xl border border-gray-800 p-16 text-center flex flex-col items-center animate-fade-in">
                <div className="bg-black/30 p-6 rounded-full mb-6">
                    <Inbox size={48} className="text-gray-600" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Buzón Vacío</h3>
                <p className="text-gray-500 max-w-sm">
                    No tienes mensajes nuevos. Aquí recibirás notificaciones de premios, avisos del sistema y novedades.
                </p>
            </div>
        ) : (
            <div className="space-y-4">
                {mailbox.map((msg: MailboxMessage) => (
                    <div 
                        key={msg.id} 
                        onClick={() => handleToggle(msg)}
                        className={`
                            relative rounded-xl border transition-all cursor-pointer overflow-hidden group
                            ${!msg.read 
                                ? 'bg-gradient-to-r from-gray-800 to-cine-gray border-l-4 border-l-cine-gold border-y-gray-700 border-r-gray-700 shadow-md' 
                                : 'bg-cine-gray border-gray-800 opacity-90 hover:opacity-100 hover:border-gray-600'}
                        `}
                    >
                        {/* Main Row */}
                        <div className="p-4 flex items-center gap-4">
                            {/* Icon */}
                            <div className={`p-2.5 rounded-full border flex-shrink-0 ${!msg.read ? 'bg-black/60 border-gray-600' : 'bg-black/30 border-gray-800 grayscale opacity-70'}`}>
                                <MessageIcon type={msg.type} />
                            </div>

                            {/* Content Preview */}
                            <div className="flex-grow min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                    <h4 className={`text-sm md:text-base truncate pr-2 ${!msg.read ? 'font-bold text-white' : 'font-medium text-gray-400'}`}>
                                        {msg.title}
                                    </h4>
                                    <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0 font-mono">
                                        {new Date(msg.timestamp).toLocaleDateString()}
                                    </span>
                                </div>
                                <p className={`text-xs md:text-sm truncate ${!msg.read ? 'text-gray-300' : 'text-gray-500'}`}>
                                    {msg.body}
                                </p>
                            </div>

                            {/* Expand Icon */}
                            <div className="flex-shrink-0 text-gray-500">
                                {expandedId === msg.id ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                            </div>
                        </div>

                        {/* Expanded Content */}
                        {expandedId === msg.id && (
                            <div className="px-4 pb-4 pt-0 animate-fade-in bg-black/20 border-t border-gray-800/50">
                                <div className="pt-4 pb-6 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap pl-14">
                                    {msg.body}
                                </div>
                                
                                <div className="flex justify-end gap-3 pl-14">
                                    {/* Action Button */}
                                    {msg.actionMovieId && (
                                        <button 
                                            onClick={(e) => handleAction(e, msg.actionMovieId!)}
                                            className="bg-cine-gold hover:bg-white text-black font-bold px-4 py-2 rounded-lg flex items-center gap-2 text-xs transition-colors shadow-lg"
                                        >
                                            Ver Película <ArrowRight size={14}/>
                                        </button>
                                    )}

                                    {/* Delete Button */}
                                    <button 
                                        onClick={(e) => handleDelete(e, msg.id)}
                                        disabled={deletingId === msg.id}
                                        className="bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/30 font-bold px-4 py-2 rounded-lg flex items-center gap-2 text-xs transition-colors disabled:opacity-50"
                                    >
                                        {deletingId === msg.id ? <Loader2 size={14} className="animate-spin"/> : <Trash2 size={14} />}
                                        {deletingId === msg.id ? 'Borrando...' : 'Eliminar'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        )}
    </div>
  );
};

export default Mailbox;
