
import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';
import { X, Send, User, MessageCircle, LogOut, Loader2 } from 'lucide-react';
import RankBadge from './RankBadge';

const PrivateChatModal: React.FC = () => {
  const { activePrivateChat, user, allUsers, closePrivateChat, leavePrivateChat, sendPrivateMessage, setPrivateChatTyping } = useData();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  
  // Close confirmation state
  const [confirmClose, setConfirmClose] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activePrivateChat?.messages, activePrivateChat?.session.typing]);

  if (!activePrivateChat || !user) return null;

  const isCreator = user.id === activePrivateChat.session.creatorId;
  // Determine IDs
  const otherUserId = isCreator ? activePrivateChat.session.targetId : activePrivateChat.session.creatorId;
  const otherUser = allUsers.find(u => u.id === otherUserId);
  const otherUserName = otherUser ? otherUser.name : (isCreator ? activePrivateChat.session.targetName : activePrivateChat.session.creatorName);

  // Check if other user is typing
  const isOtherTyping = activePrivateChat.session.typing?.[otherUserId] || false;

  const handleSend = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim()) return;
      await sendPrivateMessage(input);
      setInput('');
      // Stop typing status immediately on send
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setPrivateChatTyping(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setInput(e.target.value);
      
      // Typing indicator logic
      setPrivateChatTyping(true);
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      typingTimeoutRef.current = window.setTimeout(() => {
          setPrivateChatTyping(false);
      }, 2000);
  };

  const handleClose = (e: React.MouseEvent) => {
      e.stopPropagation();
      
      if (isCreator) {
          if (confirmClose) {
              closePrivateChat();
              setConfirmClose(false);
          } else {
              setConfirmClose(true);
              // Auto reset confirmation after 3s
              setTimeout(() => setConfirmClose(false), 3000);
          }
      } else {
          leavePrivateChat();
      }
  };

  return (
    <div className="fixed bottom-0 right-4 md:right-8 z-[100] w-80 md:w-96 bg-cine-gray border border-cine-gold/50 rounded-t-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] flex flex-col max-h-[500px] animate-slide-up">
      {/* Header */}
      <div className="bg-black/90 p-3 rounded-t-xl border-b border-gray-700 flex justify-between items-center cursor-pointer">
          <div className="flex items-center gap-3">
              <div className="relative">
                  {otherUser ? (
                      <img src={otherUser.avatarUrl} alt={otherUser.name} className="w-10 h-10 rounded-full border border-gray-600" />
                  ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                          <User size={20} className="text-gray-400" />
                      </div>
                  )}
                  <div className="w-2.5 h-2.5 bg-green-500 rounded-full absolute -bottom-0.5 -right-0.5 border-2 border-black animate-pulse"></div>
              </div>
              <div>
                  <h4 className="font-bold text-white text-sm flex items-center gap-2">
                      {otherUserName}
                      {otherUser && <RankBadge level={otherUser.level || 1} size="sm" showTitle={false} />}
                  </h4>
                  <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      {isCreator ? 'Anfitrión' : 'Invitado'} • Sala Privada
                  </span>
              </div>
          </div>
          <button 
            onClick={handleClose}
            className={`transition-all p-2 rounded-full flex items-center justify-center gap-1 ${
                confirmClose 
                ? 'bg-red-600 text-white w-auto px-3 shadow-lg shadow-red-900/50 hover:bg-red-700' 
                : 'text-gray-400 hover:text-red-500 hover:bg-white/10'
            }`}
            title={isCreator ? "Cerrar Sala para todos" : "Salir de la sala"}
          >
              {confirmClose ? (
                  <>
                      <span className="text-[10px] font-bold">¿CERRAR?</span>
                      <X size={16} />
                  </>
              ) : (
                  isCreator ? <X size={20} /> : <LogOut size={20}/>
              )}
          </button>
      </div>

      {/* Messages Area */}
      <div className="flex-grow bg-black/80 p-4 overflow-y-auto custom-scrollbar h-72 space-y-3 relative">
          {activePrivateChat.messages.length === 0 && (
              <div className="text-center text-gray-500 text-xs italic mt-4 opacity-70">
                  <MessageCircle className="mx-auto mb-2 opacity-50" size={24} />
                  <p>Sala privada iniciada.</p>
                  <p>Solo vosotros dos podéis leer esto.</p>
              </div>
          )}
          
          {activePrivateChat.messages.map(msg => {
              // Handle System Messages
              if (msg.type === 'system') {
                  return (
                      <div key={msg.id} className="flex justify-center my-2">
                          <span className="text-[10px] text-gray-500 italic bg-gray-900/50 px-3 py-1 rounded-full border border-gray-800">
                              {msg.text}
                          </span>
                      </div>
                  );
              }

              const isMe = msg.senderId === user.id;
              return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div 
                          className={`max-w-[85%] px-3 py-2 rounded-lg text-sm shadow-md ${
                              isMe 
                                  ? 'bg-cine-gold text-black rounded-tr-none font-medium' 
                                  : 'bg-white text-black border-gray-300 rounded-tl-none'
                          }`}
                      >
                          {msg.text}
                      </div>
                      <span className="text-[9px] text-gray-600 mt-1 px-1">
                          {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                  </div>
              )
          })}
          
          {/* Typing Indicator Bubble */}
          {isOtherTyping && (
              <div className="flex items-center gap-2 text-gray-400 text-xs italic animate-pulse mt-2 ml-2">
                  <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-75"></div>
                      <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-150"></div>
                  </div>
                  <span>{otherUserName} está escribiendo...</span>
              </div>
          )}
          
          <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} className="p-3 bg-gray-900 border-t border-gray-700 flex gap-2">
          <input 
            type="text" 
            value={input}
            onChange={handleInputChange}
            placeholder="Escribe un mensaje..."
            className="flex-grow bg-black border border-gray-700 rounded-full px-4 py-2 text-sm text-white focus:border-cine-gold outline-none transition-colors"
          />
          <button 
            type="submit" 
            disabled={!input.trim()}
            className="bg-cine-gold text-black p-2 rounded-full hover:bg-white transition-colors disabled:opacity-50 shadow-lg"
          >
              <Send size={18} />
          </button>
      </form>
    </div>
  );
};

export default PrivateChatModal;
