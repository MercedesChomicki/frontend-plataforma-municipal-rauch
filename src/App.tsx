import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import './App.scss';

import AppRouter from './router/AppRouter';
import useClock from './hooks/useClock';
import { useAuth } from './hooks/useAuth';

import { Header } from './layouts/Header/Header';
import Footer from './components/layout/Footer/Footer';
import Home from './pages/Home/Home';
import Login from './pages/Login/Login';
import ControlPanel from './pages/ControlPanel/ControlPanel';
import Events from './pages/Events/Events';
import Navbar from './components/layout/Navbar/Navbar';
import NewEvent from './pages/NewEvent/NewEvent';
import EventDetail from './pages/EventDetail/EventDetail';
import EditEvent from './pages/EditEvent/EditEvent';

export default function App() {
  const { timeStr, dateStr } = useClock();
  const auth = useAuth();
  const navigate = useNavigate();

  const { pathname } = useLocation();

  const isAccessPage = pathname === '/' || pathname === '/login';

  const showNavbar = 
    !isAccessPage && 
    auth.isAuthenticated && 
    Boolean(auth.user) && 
    Boolean(auth.accessToken);

  const handleLogout = () => {
    auth.logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      {isAccessPage && (
        <Header timeStr={timeStr} dateStr={dateStr} />
      )}

      {showNavbar && auth.user && (
        <Navbar
          user={auth.user}
          onLogout={handleLogout}
        />
      )}

      <AppRouter
        home={
          <Home
            onAccessClick={() =>
              navigate(auth.isAuthenticated ? '/panel' : '/login')
            }
          />
        }
        login={
          auth.isAuthenticated ? (
            <Navigate to="/panel" replace />
          ) : (
            <Login
              onLogin={auth.login}
              isLoading={auth.isLoading}
              error={auth.error}
            />
          )
        }
        panel={
          auth.isAuthenticated && auth.user && auth.accessToken ? (
            <ControlPanel
              user={auth.user}
              accessToken={auth.accessToken}
              onLogout={handleLogout}
              onNavigate={section => navigate(`/${section}`)}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
        events={
          auth.isAuthenticated && auth.accessToken && auth.user ? (
            <Events
              accessToken={auth.accessToken}
              user={auth.user}
              onLogout={handleLogout}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
        newEvent={
          auth.isAuthenticated && auth.accessToken && auth.user ? (
            auth.user.permisos.includes('eventos:write') &&
            auth.user.areas_acceso.includes('videoseguridad') ? (
              <NewEvent
                accessToken={auth.accessToken}
                onLogout={handleLogout}
              />
            ) : (
              <Navigate to="/eventos" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
        eventDetail={
          auth.isAuthenticated && auth.accessToken && auth.user ? (
            <EventDetail
              accessToken={auth.accessToken}
              user={auth.user}
              onLogout={handleLogout}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
        editEvent={
          auth.isAuthenticated && auth.accessToken && auth.user ? (
            auth.user.permisos.includes('eventos:write') &&
            auth.user.areas_acceso.includes('videoseguridad') ? (
              <EditEvent
                key={pathname}
                accessToken={auth.accessToken}
                user={auth.user}
                onLogout={handleLogout}
              />
            ) : (
              <Navigate to="/eventos" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
        
      />

      {isAccessPage && <Footer />}
    </div>
  );
}