
import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';
import { X, Send, User, MessageCircle, LogOut, Maximize2, Minimize2, GripHorizontal } from 'lucide-react';
import RankBadge from './RankBadge';

const PrivateChatModal: React.FC = () => {
  const { activePrivateChat, user, allUsers, closePrivateChat, leavePrivateChat, sendPrivateMessage, setPrivateChatTyping } = useData();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  
  // Window State
  const [isMaximized, setIsMaximized] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  
  // Close confirmation state
  const [confirmClose, setConfirmClose] = useState(false);

  // Initialize position to bottom right on mount
  useEffect(() => {
      // Default dimensions approx w-96 (384px) and h-[500px]
      const initialX = window.innerWidth - 400; 
      const initialY = window.innerHeight - 520;
      // Ensure it's on screen
      setPosition({ 
          x: Math.max(0, initialX), 
          y: Math.max(0, initialY) 
      });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activePrivateChat?.messages, activePrivateChat?.session.typing, isMaximized]);

  // DRAG HANDLERS
  const handleMouseDown = (e: React.MouseEvent) => {
      if (isMaximized) return; // Cannot drag when maximized
      setIsDragging(true);
      dragOffset.current = {
          x: e.clientX - position.x,
          y: e.clientY - position.y
      };
  };

  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          if (!isDragging) return;
          
          let newX = e.clientX - dragOffset.current.x;
          let newY = e.clientY - dragOffset.current.y;

          // Optional: Keep somewhat on screen
          // newY = Math.max(0, Math.min(window.innerHeight - 50, newY));
          // newX = Math.max(-300, Math.min(window.innerWidth - 50, newX));

          setPosition({ x: newX, y: newY });
      };

      const handleMouseUp = () => {
          setIsDragging(false);
      };

      if (isDragging) {
          window.addEventListener('mousemove', handleMouseMove);
          window.addEventListener('mouseup', handleMouseUp);
      }

      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [isDragging]);


  if (!activePrivateChat || !user) return null;

  const isCreator = user.id === activePrivateChat.session.creatorId;
  const otherUserId = isCreator ? activePrivateChat.session.targetId : activePrivateChat.session.creatorId;
  const otherUser = allUsers.find(u => u.id === otherUserId);
  const otherUserName = otherUser ? otherUser.name : (isCreator ? activePrivateChat.session.targetName : activePrivateChat.session.creatorName);
  const isOtherTyping = activePrivateChat.session.typing?.[otherUserId] || false;

  const handleSend = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim()) return;
      await sendPrivateMessage(input);
      setInput('');
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setPrivateChatTyping(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setInput(e.target.value);
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
              setTimeout(() => setConfirmClose(false), 3000);
          }
      } else {
          leavePrivateChat();
      }
  };

  const toggleMaximize = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsMaximized(!isMaximized);
  };

  return (
    <div 
        className={`fixed z-[1000] bg-cine-gray border border-cine-gold/50 shadow-[0_0_40px_rgba(0,0,0,0.6)] flex flex-col transition-all duration-200 ${isMaximized ? 'rounded-none' : 'rounded-xl'}`}
        style={{
            top: isMaximized ? 0 : position.y,
            left: isMaximized ? 0 : position.x,
            width: isMaximized ? '100vw' : '384px', // 384px = w-96
            height: isMaximized ? '100vh' : '500px',
        }}
    >
      {/* Header (Draggable) */}
      <div 
        onMouseDown={handleMouseDown}
        className={`bg-black/90 p-3 border-b border-gray-700 flex justify-between items-center select-none ${isMaximized ? '' : 'cursor-move rounded-t-xl'}`}
      >
          <div className="flex items-center gap-3">
              <div className="relative">
                  {otherUser ? (
                      <img src={otherUser.avatarUrl} alt={otherUser.name} className="w-10 h-10 rounded-full border border-gray-600 pointer-events-none" />
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
                      {!isMaximized && <GripHorizontal size={10} className="opacity-50"/>}
                      {isCreator ? 'Anfitrión' : 'Invitado'}
                  </span>
              </div>
          </div>
          
          <div className="flex items-center gap-2">
              <button 
                onClick={toggleMaximize}
                className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                title={isMaximized ? "Restaurar" : "Maximizar"}
              >
                  {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>

              <button 
                onClick={handleClose}
                className={`transition-all p-1.5 rounded-full flex items-center justify-center gap-1 ${
                    confirmClose 
                    ? 'bg-red-600 text-white w-auto px-3 shadow-lg shadow-red-900/50 hover:bg-red-700' 
                    : 'text-gray-400 hover:text-red-500 hover:bg-white/10'
                }`}
                title={isCreator ? "Cerrar Sala" : "Salir"}
              >
                  {confirmClose ? (
                      <span className="text-[10px] font-bold whitespace-nowrap">¿CERRAR?</span>
                  ) : (
                      isCreator ? <X size={18} /> : <LogOut size={18}/>
                  )}
              </button>
          </div>
      </div>

      {/* Messages Area */}
      <div className="flex-grow bg-black/80 p-4 overflow-y-auto custom-scrollbar space-y-3 relative flex flex-col">
          {activePrivateChat.messages.length === 0 && (
              <div className="text-center text-gray-500 text-xs italic mt-10 opacity-70">
                  <MessageCircle className="mx-auto mb-2 opacity-50" size={32} />
                  <p>Sala privada iniciada.</p>
                  <p>Las conversaciones están encriptadas.</p>
              </div>
          )}
          
          {activePrivateChat.messages.map(msg => {
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
                          className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm shadow-md leading-relaxed ${
                              isMe 
                                  ? 'bg-cine-gold text-black rounded-tr-none font-bold' 
                                  : 'bg-zinc-800 text-gray-100 border border-zinc-700 rounded-tl-none'
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
          
          {isOtherTyping && (
              <div className="flex items-center gap-2 text-gray-400 text-xs italic animate-pulse mt-auto pt-2">
                  <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-cine-gold rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-cine-gold rounded-full animate-bounce delay-75"></div>
                      <div className="w-1.5 h-1.5 bg-cine-gold rounded-full animate-bounce delay-150"></div>
                  </div>
                  <span>{otherUserName} está escribiendo...</span>
              </div>
          )}
          
          <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} className="p-3 bg-gray-900 border-t border-gray-700 flex gap-2 rounded-b-xl">
          <input 
            type="text" 
            value={input}
            onChange={handleInputChange}
            placeholder="Escribe un mensaje..."
            className="flex-grow bg-black border border-gray-700 rounded-full px-4 py-3 text-sm text-white focus:border-cine-gold outline-none transition-colors"
            autoFocus
          />
          <button 
            type="submit" 
            disabled={!input.trim()}
            className="bg-cine-gold text-black p-3 rounded-full hover:bg-white transition-colors disabled:opacity-50 shadow-lg hover:scale-105 active:scale-95"
          >
              <Send size={18} />
          </button>
      </form>
    </div>
  );
};

export default PrivateChatModal;
