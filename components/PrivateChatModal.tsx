
import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';
import { X, Send, User, MessageCircle, LogOut } from 'lucide-react';

const PrivateChatModal: React.FC = () => {
  const { activePrivateChat, user, closePrivateChat, leavePrivateChat, sendPrivateMessage } = useData();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activePrivateChat?.messages]);

  if (!activePrivateChat || !user) return null;

  const isCreator = user.id === activePrivateChat.session.creatorId;
  const otherName = isCreator ? activePrivateChat.session.targetName : activePrivateChat.session.creatorName;

  const handleSend = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim()) return;
      await sendPrivateMessage(input);
      setInput('');
  };

  const handleClose = () => {
      if (isCreator) {
          if (window.confirm("¿Cerrar la sala? Se desconectará al otro usuario.")) {
              closePrivateChat();
          }
      } else {
          leavePrivateChat();
      }
  };

  return (
    <div className="fixed bottom-0 right-4 md:right-8 z-[100] w-80 md:w-96 bg-cine-gray border border-cine-gold/50 rounded-t-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] flex flex-col max-h-[500px] animate-slide-up">
      {/* Header */}
      <div className="bg-black/90 p-3 rounded-t-xl border-b border-gray-700 flex justify-between items-center cursor-pointer">
          <div className="flex items-center gap-2">
              <div className="relative">
                  <div className="w-2 h-2 bg-green-500 rounded-full absolute -top-0.5 -right-0.5 animate-pulse"></div>
                  <MessageCircle size={18} className="text-cine-gold" />
              </div>
              <div>
                  <h4 className="font-bold text-white text-sm">Chat con {otherName}</h4>
                  <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      {isCreator ? 'Eres el Anfitrión (Sala en Solitario)' : 'Invitado a Sala Privada'}
                  </span>
              </div>
          </div>
          <button 
            onClick={handleClose}
            className="text-gray-400 hover:text-red-500 transition-colors p-1"
            title={isCreator ? "Cerrar Sala" : "Salir"}
          >
              {isCreator ? <X size={18} /> : <LogOut size={18}/>}
          </button>
      </div>

      {/* Messages Area */}
      <div className="flex-grow bg-black/80 p-4 overflow-y-auto custom-scrollbar h-64 space-y-3">
          {activePrivateChat.messages.length === 0 && (
              <p className="text-center text-gray-500 text-xs italic mt-4">
                  Sala privada iniciada. <br/>Solo vosotros dos podéis leer esto.
              </p>
          )}
          
          {activePrivateChat.messages.map(msg => {
              const isMe = msg.senderId === user.id;
              return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${isMe ? 'bg-cine-gold text-black rounded-tr-none' : 'bg-gray-800 text-white border border-gray-700 rounded-tl-none'}`}>
                          {msg.text}
                      </div>
                      <span className="text-[10px] text-gray-600 mt-1">
                          {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                  </div>
              )
          })}
          <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} className="p-3 bg-gray-900 border-t border-gray-700 flex gap-2">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe un mensaje..."
            className="flex-grow bg-black border border-gray-700 rounded-full px-4 py-2 text-sm text-white focus:border-cine-gold outline-none"
          />
          <button 
            type="submit" 
            disabled={!input.trim()}
            className="bg-cine-gold text-black p-2 rounded-full hover:bg-white transition-colors disabled:opacity-50"
          >
              <Send size={16} />
          </button>
      </form>
    </div>
  );
};

export default PrivateChatModal;
