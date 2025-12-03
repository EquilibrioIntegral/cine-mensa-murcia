

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
import { ViewState } from './types';
import { Clock, LogOut } from 'lucide-react';

const AppContent: React.FC = () => {
  const { currentView, user, milestoneEvent, closeMilestoneModal, setView, setInitialProfileTab, logout } = useData();

  if (!user) {
    return <Login />;
  }

  // --- NEW: BLOCK PENDING USERS ---
  if (user.status === 'pending') {
      return (
          <div className="min-h-screen bg-cine-dark flex items-center justify-center p-4">
              <div className="bg-cine-gray p-8 rounded-2xl border border-gray-700 shadow-2xl max-w-md text-center">
                  <div className="w-20 h-20 bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Clock size={48} className="text-yellow-500 animate-pulse" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Solicitud en Revisión</h2>
                  <p className="text-gray-400 mb-8 leading-relaxed">
                      Gracias por registrarte, <span className="text-cine-gold font-bold">{user.name}</span>. 
                      <br/><br/>
                      Tu solicitud está siendo revisada por la administración del club. 
                      Recibirás acceso completo una vez aprobada.
                  </p>
                  <button 
                      onClick={logout}
                      className="bg-red-900/50 hover:bg-red-900 text-red-200 px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 mx-auto transition-colors"
                  >
                      <LogOut size={18}/> Cerrar Sesión
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