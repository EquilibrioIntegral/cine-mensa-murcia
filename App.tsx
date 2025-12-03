
import React from 'react';
import { DataProvider, useData } from './context/DataContext';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Ranking from './pages/Ranking';
import Recommendations from './pages/Recommendations';
import Watchlist from './pages/Watchlist';
import AdminPanel from './pages/AdminPanel';
import MovieDetails from './pages/MovieDetails';
import Events from './pages/Events';
import News from './pages/News';
import Feedback from './pages/Feedback';
import Profile from './pages/Profile';
import Shop from './pages/Shop';
import Arcade from './pages/Arcade';
import CareerMilestoneModal from './components/CareerMilestoneModal';
import PrivateChatModal from './components/PrivateChatModal';
import { ViewState } from './types';
import { Clock, ShieldAlert } from 'lucide-react';

const AppContent: React.FC = () => {
  const { currentView, user, milestoneEvent, closeMilestoneModal, setView, setInitialProfileTab, logout } = useData();

  if (!user) {
    return <Login />;
  }

  // --- BLOCK PENDING USERS (MODAL POPUP) ---
  if (user.status === 'pending') {
      return (
          <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-cine-gray p-8 rounded-2xl border border-gray-700 shadow-[0_0_50px_rgba(0,0,0,0.8)] max-w-sm w-full text-center relative overflow-hidden">
                  {/* Decorative Background */}
                  <div className="absolute top-0 left-0 w-full h-2 bg-yellow-600"></div>
                  
                  <div className="w-16 h-16 bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-yellow-700/30">
                      <ShieldAlert size={32} className="text-yellow-500 animate-pulse" />
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-2">Acceso Pendiente</h3>
                  <p className="text-gray-400 mb-8 text-sm leading-relaxed">
                      El administrador debe autorizar tu acceso antes de que puedas ver el contenido.
                  </p>
                  
                  <button 
                      onClick={logout}
                      className="w-full bg-cine-gold hover:bg-white text-black font-bold py-3 rounded-xl transition-all shadow-lg hover:scale-105 active:scale-95"
                  >
                      Aceptar
                  </button>
              </div>
          </div>
      );
  }

  const handleMilestoneAction = () => {
      closeMilestoneModal();
      setInitialProfileTab('career');
      setView(ViewState.PROFILE);
  };

  return (
    <div className="min-h-screen bg-cine-dark text-gray-100 flex flex-col font-sans">
      <Navbar />
      
      {milestoneEvent && (
          <CareerMilestoneModal 
              event={milestoneEvent}
              userName={user.name}
              onClose={closeMilestoneModal}
              onAction={handleMilestoneAction}
          />
      )}

      {/* PRIVATE CHAT OVERLAY */}
      <PrivateChatModal />

      <main className="flex-grow">
        {currentView === ViewState.NEWS && <News />}
        {currentView === ViewState.DASHBOARD && <Dashboard />}
        {currentView === ViewState.RANKING && <Ranking />}
        {currentView === ViewState.RECOMMENDATIONS && <Recommendations />}
        {currentView === ViewState.WATCHLIST && <Watchlist />}
        {currentView === ViewState.ADMIN_PANEL && <AdminPanel />}
        {currentView === ViewState.MOVIE_DETAILS && <MovieDetails />}
        {currentView === ViewState.EVENTS && <Events />}
        {currentView === ViewState.FEEDBACK && <Feedback />}
        {currentView === ViewState.PROFILE && <Profile />}
        {currentView === ViewState.SHOP && <Shop />}
        {currentView === ViewState.ARCADE && <Arcade />}
      </main>

      <footer className="bg-black py-6 mt-auto border-t border-gray-900">
          <div className="container mx-auto px-4 text-center">
              <p className="text-gray-500 text-sm">
                  Cine Mensa Murcia © {new Date().getFullYear()}
              </p>
              <p className="text-cine-gold text-xs mt-1 font-mono">
                  Programado por: <span className="font-bold">Andrés Robles Jiménez</span>
              </p>
          </div>
      </footer>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
};

export default App;
