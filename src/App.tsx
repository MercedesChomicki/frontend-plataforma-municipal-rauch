import { Navigate, useNavigate } from 'react-router-dom';
import './App.scss';

import AppRouter from './router/AppRouter';
import useClock from './hooks/useClock';
import { useAuth } from './hooks/useAuth';

import { Header } from './layouts/Header/Header';
import Footer from './components/layout/Footer/Footer';
import Home from './pages/Home/Home';
import Login from './pages/Login/Login';

export default function App() {
  const { timeStr, dateStr } = useClock();
  const auth = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <Header timeStr={timeStr} dateStr={dateStr} />

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
        
      />

      <Footer />
    </div>
  );
}