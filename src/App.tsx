import { Navigate, useLocation, useNavigate } from "react-router-dom";
import "./App.scss";

import AppRouter from "./router/AppRouter";
import { useAuth } from "./hooks/useAuth";

import Footer from "./components/layout/Footer/Footer";
import Home from "./pages/Home/Home";
import Login from "./pages/Login/Login";
import ControlPanel from "./pages/ControlPanel/ControlPanel";
import Events from "./pages/Events/Events";
import Navbar from "./components/layout/Navbar/Navbar";
import NewEvent from "./pages/NewEvent/NewEvent";
import EventDetail from "./pages/EventDetail/EventDetail";
import EditEvent from "./pages/EditEvent/EditEvent";
import Reports from "./pages/Reports/Reports";
import EventMap from "./pages/EventMap/EventMap";
import NumberingSettings from "./pages/NumberingSettings/NumberingSettings";
import Users from "./pages/Users/Users";
import Settings from "./pages/Settings/Settings";
import Profile from "./pages/Profile/Profile";

export default function App() {
  const auth = useAuth();
  const navigate = useNavigate();

  const { pathname } = useLocation();

  const isAccessPage = pathname === "/" || pathname === "/login";

  const showNavbar =
    !isAccessPage &&
    auth.isAuthenticated &&
    Boolean(auth.user) &&
    Boolean(auth.accessToken);

  const handleLogout = () => {
    auth.logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app-shell">
      {showNavbar && auth.user && (
        <Navbar user={auth.user} onLogout={handleLogout} />
      )}

      <AppRouter
        home={
          <Home
            onAccessClick={() =>
              navigate(auth.isAuthenticated ? "/panel" : "/login")
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
              onNavigate={(section) => navigate(`/${section}`)}
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
            auth.user.permisos.includes("eventos:write") &&
            auth.user.areas_acceso.includes("videoseguridad") ? (
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
            auth.user.permisos.includes("eventos:write") &&
            auth.user.areas_acceso.includes("videoseguridad") ? (
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
        reports={
          auth.isAuthenticated && auth.accessToken && auth.user ? (
            auth.user.permisos.includes("estadisticas:read") &&
            auth.user.permisos.includes("eventos:read") &&
            auth.user.areas_acceso.includes("videoseguridad") ? (
              <Reports accessToken={auth.accessToken} onLogout={handleLogout} />
            ) : (
              <main className="reports-page">
                <div className="reports-page__container">
                  <h1>Reportes</h1>
                  <p>No tenés permiso para consultar los reportes de COM.</p>
                </div>
              </main>
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
        map={
          auth.isAuthenticated && auth.accessToken && auth.user ? (
            auth.user.permisos.includes("eventos:read") &&
            auth.user.areas_acceso.includes("videoseguridad") ? (
              <EventMap
                accessToken={auth.accessToken}
                onLogout={handleLogout}
              />
            ) : (
              <main className="map-page">
                <div className="map-page__container">
                  <h1>Mapa de eventos</h1>
                  <p>No tenés permiso para consultar los eventos de COM.</p>
                </div>
              </main>
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
        numbering={
          auth.isAuthenticated && auth.accessToken && auth.user ? (
            <NumberingSettings
              accessToken={auth.accessToken}
              user={auth.user}
              onLogout={handleLogout}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
        users={
          auth.isAuthenticated && auth.accessToken && auth.user ? (
            <Users
              accessToken={auth.accessToken}
              user={auth.user}
              onLogout={handleLogout}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
        settings={
          auth.isAuthenticated && auth.user ? (
            <Settings user={auth.user} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
        profile={
          auth.isAuthenticated && auth.accessToken && auth.user ? (
            <Profile user={auth.user} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {isAccessPage && <Footer />}
    </div>
  );
}
