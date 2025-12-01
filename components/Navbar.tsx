
import React from 'react';
import { useData } from '../context/DataContext';
import { ViewState } from '../types';
import { Film, Trophy, Sparkles, LogOut, ListVideo, Shield, Ticket, Search, Home, Bug } from 'lucide-react';

const Navbar: React.FC = () => {
  const { user, setView, currentView, logout } = useData();

  const NavItem = ({ view, icon: Icon, label }: { view: ViewState, icon: any, label: string }) => (
    <button
      onClick={() => setView(view)}
      className={`flex items-center gap-2 px-3 py-2 rounded-full transition-all text-sm md:text-base ${
        currentView === view 
          ? 'bg-cine-gold text-cine-dark font-bold' 
          : 'text-gray-400 hover:text-white hover:bg-white/10'
      }`}
    >
      <Icon size={18} />
      <span className="hidden lg:inline">{label}</span>
    </button>
  );

  return (
    <nav className="sticky top-0 z-50 bg-cine-dark/95 backdrop-blur-md border-b border-gray-800">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div 
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setView(ViewState.NEWS)}
        >
          <Film className="text-cine-gold" size={28} />
          <h1 className="text-xl font-bold tracking-wider text-white hidden md:block">CINE MENSA<span className="text-cine-gold">MURCIA</span></h1>
          <h1 className="text-xl font-bold tracking-wider text-white md:hidden">CM<span className="text-cine-gold">M</span></h1>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <NavItem view={ViewState.NEWS} icon={Home} label="Noticias" />
            <NavItem view={ViewState.DASHBOARD} icon={Film} label="Catálogo" />
            <NavItem view={ViewState.EVENTS} icon={Ticket} label="Eventos" />
            <NavItem view={ViewState.RANKING} icon={Trophy} label="Ranking" />
            <NavItem view={ViewState.WATCHLIST} icon={ListVideo} label="Lista" />
            <NavItem view={ViewState.RECOMMENDATIONS} icon={Sparkles} label="IA" />
            {user?.isAdmin && (
               <button
                  onClick={() => setView(ViewState.ADMIN_PANEL)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-full transition-all ${
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

        <div className="flex items-center gap-4">
            <button 
                onClick={() => setView(ViewState.FEEDBACK)}
                className="p-2 text-gray-400 hover:text-cine-gold transition-colors"
                title="Reportar Bug o Mejora"
            >
                <Bug size={20} />
            </button>

            <button 
                onClick={() => setView(ViewState.DASHBOARD)}
                className="p-2 text-gray-400 hover:text-cine-gold transition-colors"
                title="Buscar película"
            >
                <Search size={22} />
            </button>

            <div className="hidden md:flex items-center gap-3 cursor-pointer group" onClick={() => setView(ViewState.PROFILE)}>
                <span className="text-sm font-medium text-gray-300 max-w-[100px] truncate group-hover:text-cine-gold transition-colors">{user?.name}</span>
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
  );
};

export default Navbar;
