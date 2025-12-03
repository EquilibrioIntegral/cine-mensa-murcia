
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

const AppContent: React.FC = () => {
  const { currentView, user, milestoneEvent, closeMilestoneModal, setView, setInitialProfileTab } = useData();

  if (!user) {
    return <Login />;
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