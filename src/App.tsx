import { useState, useEffect } from 'react';
import { Login } from './pages/Login';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { CalendarView } from './pages/CalendarView';
import { CallLogsView } from './pages/CallLogsView';
import { NewBookingPage } from './pages/NewBookingPage';
import { AnalyticsView } from './pages/AnalyticsView';
import { SetupView } from './pages/setup/SetupView';
import { SETUP_SECTIONS } from './pages/setup/sections';
import { api } from './services/api';
import { AUTH_EXPIRED_EVENT } from './services/session';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    // Nothing is kept in the browser's storage. If the refresh cookie is still valid the server
    // gives us a new access token and the user; otherwise we show the login page.
    let cancelled = false;
    api
      .restoreSession()
      .then((user) => {
        if (!cancelled) setIsLoggedIn(Boolean(user));
      })
      .catch(() => {
        // Server not reachable: show the login page rather than a blank screen.
        if (!cancelled) setIsLoggedIn(false);
      })
      .finally(() => {
        if (!cancelled) setCheckingAuth(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // The API client raises this when the server rejects the token (expired or user disabled).
    const onExpired = () => setIsLoggedIn(false);
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  const handleLogout = async () => {
    await api.logout();
    setIsLoggedIn(false);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-sky-400"></div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <Layout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onLogout={handleLogout}
    >
      {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} />}
      {activeTab === 'calendar' && <CalendarView />}
      {activeTab === 'logs' && <CallLogsView />}
      {activeTab === 'book-online' && <NewBookingPage />}
      {activeTab === 'analytics' && <AnalyticsView />}
      {SETUP_SECTIONS.filter((s) => s.tab === activeTab).map((s) => (
        <SetupView key={s.tab} section={s.id} />
      ))}
    </Layout>
  );
}

export default App;




