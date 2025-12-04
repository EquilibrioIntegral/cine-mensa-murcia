import React, { useEffect } from 'react';
import { useData } from '../context/DataContext';
import { ViewState } from '../types';
import { Film, Trophy, Sparkles, LogOut, ListVideo, Shield, Ticket, Home, Bug, ShoppingBag, Gamepad2, Mail } from 'lucide-react';
import RankBadge from './RankBadge';

const Navbar: React.FC = () => {
  const { user, setView, currentView, logout, notification, clearNotification, mailbox } = useData();

  const unreadCount = mailbox ? mailbox.filter(m => !m.read).length : 0;

  const NavItem = ({ view, icon: Icon, label }: { view: ViewState, icon: any, label: string }) => (
    <button
      onClick={() => setView(view)}
      className={`flex items-center gap-2 px-3 py-2 rounded-full transition-all text-sm md:text-base whitespace-nowrap flex-shrink-0 ${
        currentView === view 
          ? 'bg-cine-gold text-cine-dark font-bold' 
          : 'text-gray-400 hover:text-white hover:bg-white/10'
      }`}
    >
      <Icon size={18} />
      <span className="hidden lg:inline">{label}</span>
    </button>
  );

  // Auto-clear notification
  useEffect(() => {
      if (notification) {
          const t = setTimeout(clearNotification, 5000);
          return () => clearTimeout(t);
      }
  }, [notification]);

  return (
    <>
        <nav className="sticky top-0 z-50 bg-cine-dark/95 backdrop-blur-md border-b border-gray-800">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div 
                className="flex items-center gap-2 cursor-pointer flex-shrink-0"
                onClick={() => setView(ViewState.NEWS)}
            >
            <Film className="text-cine-gold" size={28} />
            <h1 className="text-xl font-bold tracking-wider text-white hidden md:block">CINE MENSA<span className="text-cine-gold">MURCIA</span></h1>
            <h1 className="text-xl font-bold tracking-wider text-white md:hidden">CM<span className="text-cine-gold">M</span></h1>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar mx-2 md:mx-4 pb-2 md:pb-0 pt-2 md:pt-0 mask-image-scroll">
                <NavItem view={ViewState.NEWS} icon={Home} label="Noticias" />
                <NavItem view={ViewState.DASHBOARD} icon={Film} label="Catálogo" />
                <NavItem view={ViewState.RANKING} icon={Trophy} label="Ranking" />
                <NavItem view={ViewState.WATCHLIST} icon={ListVideo} label="Mi Lista" />
                <NavItem view={ViewState.EVENTS} icon={Ticket} label="Eventos" />
                <NavItem view={ViewState.ARCADE} icon={Gamepad2} label="Retos" />
                <NavItem view={ViewState.SHOP} icon={ShoppingBag} label="Taquilla" />
                <NavItem view={ViewState.RECOMMENDATIONS} icon={Sparkles} label="IA" />
                <NavItem view={ViewState.FEEDBACK} icon={Bug} label="Reportar" />
                {user?.isAdmin && (
                <button
                    onClick={() => setView(ViewState.ADMIN_PANEL)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full transition-all flex-shrink-0 ${
                        currentView === ViewState.ADMIN_PANEL
                        ? 'bg-red-900 text-white font-bold' 
                        : 'text-red-400 hover:text-red-300 hover:bg-white/10'
                    }`}
                    title="Panel Admin"
                    >
                    <Shield size={18} />
                    </button>
                )}
            </div>

            <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                
                {/* User Credits Display */}
                {user && (
                    <div className="hidden md:flex items-center gap-1 bg-black/40 px-3 py-1 rounded-full border border-cine-gold/30">
                        <Ticket size={14} className="text-cine-gold" />
                        <span className="text-white font-bold text-sm">{user.credits || 0}</span>
                    </div>
                )}

                {/* Mailbox Icon */}
                <button 
                    onClick={() => setView(ViewState.MAILBOX)}
                    className={`relative p-2 rounded-full transition-colors ${currentView === ViewState.MAILBOX ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
                    title="Buzón de Mensajes"
                >
                    <Mail size={20} />
                    {unreadCount > 0 && (
                        <span className="absolute top-0 right-0 w-4 h-4 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                            {unreadCount}
                        </span>
                    )}
                </button>

                <div className="hidden md:flex items-center gap-3 cursor-pointer group" onClick={() => setView(ViewState.PROFILE)}>
                    <div className="flex flex-col items-end">
                        <span className="text-sm font-medium text-gray-300 max-w-[100px] truncate group-hover:text-cine-gold transition-colors">{user?.name}</span>
                        {user && <span className="text-[10px] text-cine-gold font-black">LVL {user.level || 1}</span>}
                    </div>
                    <img src={user?.avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full border border-gray-700 group-hover:border-cine-gold transition-colors object-cover" />
                </div>
                <button 
                    onClick={logout} 
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    title="Cerrar sesión"
                >
                    <LogOut size={20} />
                </button>
            </div>
        </div>
        </nav>

        {/* NOTIFICATION TOAST */}
        {notification && (
            <div className="fixed top-20 right-4 z-[100] animate-slide-in-right">
                <div className={`p-4 rounded-xl border shadow-2xl flex items-center gap-3 ${notification.type === 'level' ? 'bg-gradient-to-r from-cine-gold to-yellow-600 text-black border-yellow-400' : notification.type === 'shop' ? 'bg-black text-cine-gold border-cine-gold' : 'bg-gray-800 text-white border-cine-gold'}`}>
                    <div className={`p-2 rounded-full ${notification.type === 'level' ? 'bg-black/20 text-white' : 'bg-cine-gold/20 text-cine-gold'}`}>
                        {notification.type === 'level' ? <Trophy size={20} /> : notification.type === 'shop' ? <ShoppingBag size={20}/> : <Ticket size={20}/>}
                    </div>
                    <div>
                        <p className="font-bold text-sm">{notification.message}</p>
                    </div>
                </div>
            </div>
        )}
    </>
  );
};

export default Navbar;