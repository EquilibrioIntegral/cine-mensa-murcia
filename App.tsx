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
import { ViewState } from './types';

const AppContent: React.FC = () => {
  const { currentView, user } = useData();

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-cine-dark text-gray-100">
      <Navbar />
      <main>
        {currentView === ViewState.DASHBOARD && <Dashboard />}
        {currentView === ViewState.RANKING && <Ranking />}
        {currentView === ViewState.RECOMMENDATIONS && <Recommendations />}
        {currentView === ViewState.WATCHLIST && <Watchlist />}
        {currentView === ViewState.ADMIN_PANEL && <AdminPanel />}
        {currentView === ViewState.MOVIE_DETAILS && <MovieDetails />}
        {currentView === ViewState.EVENTS && <Events />}
      </main>
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