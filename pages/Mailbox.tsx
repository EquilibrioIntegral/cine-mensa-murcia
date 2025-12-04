

import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Mail, Trash2, CheckCircle, Bell, Info, Shield, ShoppingBag, ChevronDown, ChevronUp, AlertCircle, Inbox, ArrowRight } from 'lucide-react';
import { MailboxMessage, ViewState } from '../types';

const MessageIcon = ({ type }: { type: MailboxMessage['type'] }) => {
    switch(type) {
        case 'reward': return <ShoppingBag className="text-yellow-500" />;
        case 'alert': return <AlertCircle className="text-red-500" />;
        case 'info': return <Info className="text-blue-400" />;
        default: return <Shield className="text-gray-400" />;
    }
}

const Mailbox: React.FC = () => {
  const { mailbox, markMessageRead, deleteMessage, setView } = useData();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleToggle = (msg: MailboxMessage) => {
      if (expandedId === msg.id) {
          setExpandedId(null);
      } else {
          setExpandedId(msg.id);
          if (!msg.read) {
              markMessageRead(msg.id);
          }
      }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      deleteMessage(id);
  };

  const handleAction = (e: React.MouseEvent, movieId: string) => {
      e.stopPropagation();
      setView(ViewState.MOVIE_DETAILS, movieId);
  };

  return (
    <div className="container mx-auto px-4 py-8 pb-20 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
            <div className="bg-cine-gold p-3 rounded-full text-black">
                <Mail size={24} />
            </div>
            <h2 className="text-3xl font-bold text-white">Buzón Personal</h2>
        </div>

        {mailbox.length === 0 ? (
            <div className="bg-cine-gray rounded-xl border border-gray-800 p-12 text-center flex flex-col items-center">
                <Inbox size={64} className="text-gray-600 mb-4" />
                <h3 className="text-xl font-bold text-gray-400">No tienes mensajes</h3>
                <p className="text-gray-500">Aquí recibirás notificaciones del sistema y recompensas.</p>
            </div>
        ) : (
            <div className="space-y-4">
                {mailbox.map(msg => (
                    <div 
                        key={msg.id} 
                        onClick={() => handleToggle(msg)}
                        className={`bg-cine-gray rounded-xl border transition-all cursor-pointer overflow-hidden ${!msg.read ? 'border-l-4 border-l-cine-gold border-y-gray-700 border-r-gray-700 bg-white/5' : 'border-gray-800 opacity-80 hover:opacity-100'}`}
                    >
                        <div className="p-4 flex items-center gap-4">
                            <div className="p-2 bg-black/40 rounded-full border border-gray-700">
                                <MessageIcon type={msg.type} />
                            </div>
                            <div className="flex-grow min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                    <h4 className={`text-sm md:text-base truncate pr-2 ${!msg.read ? 'font-bold text-white' : 'font-medium text-gray-300'}`}>
                                        {msg.title}
                                    </h4>
                                    <span className="text-xs text-gray-500 whitespace-nowrap">
                                        {new Date(msg.timestamp).toLocaleDateString()}
                                    </span>
                                </div>
                                <p className="text-xs md:text-sm text-gray-400 truncate">
                                    {msg.body}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {expandedId === msg.id ? <ChevronUp size={20} className="text-gray-500"/> : <ChevronDown size={20} className="text-gray-500"/>}
                            </div>
                        </div>

                        {expandedId === msg.id && (
                            <div className="px-4 pb-4 pt-0 text-sm text-gray-300 animate-fade-in border-t border-gray-800 mt-2 bg-black/20">
                                <div className="pt-4 pb-4 whitespace-pre-wrap leading-relaxed">
                                    {msg.body}
                                </div>
                                
                                {msg.actionMovieId && (
                                    <div className="mb-4">
                                        <button 
                                            onClick={(e) => handleAction(e, msg.actionMovieId!)}
                                            className="bg-cine-gold text-black font-bold px-4 py-2 rounded flex items-center gap-2 hover:bg-white transition-colors"
                                        >
                                            Corregir Reseña <ArrowRight size={16}/>
                                        </button>
                                    </div>
                                )}

                                <div className="flex justify-end pt-2 border-t border-gray-800/50">
                                    <button 
                                        onClick={(e) => handleDelete(e, msg.id)}
                                        className="text-red-400 hover:text-white flex items-center gap-1 text-xs font-bold px-3 py-1 rounded hover:bg-red-900/20 transition-colors"
                                    >
                                        <Trash2 size={14} /> Eliminar
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