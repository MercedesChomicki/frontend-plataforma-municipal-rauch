import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import municipalLogo from '../../assets/images/logo-letras-blancas.svg';
import './Login.scss';

interface LoginProps {
  onLogin: (
    username: string, 
    password: string
  ) => Promise<boolean>;
  isLoading: boolean;
  error?: string | null;
}

export default function Login({ onLogin, isLoading, error }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'Ingresar | Municipalidad de Rauch';
    return () => {
      document.title = 'Gestión Municipal de Eventos';
    };
  }, []);

  useEffect(() => {
    if (error && !isLoading) errorRef.current?.focus();
  }, [error, isLoading]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading || !username.trim() || !password) return;
    // El hook debe gestionar el error y su estado de carga.
    void onLogin(username.trim(), password);
  };

  return (
    <main className="login-page" aria-labelledby="login-title">
      <div className="login-page__content">
        <Link className="login-page__back" to="/">
          <ArrowLeft aria-hidden="true" />
          Volver al inicio
        </Link>

        <img
          className="login-page__logo"
          src={municipalLogo}
          alt="Municipalidad de Rauch"
        />

        <section className="login-card" aria-labelledby="login-title">
          <div className="login-card__heading">
            <h1 id="login-title">Ingresar al sistema</h1>
            <p>Acceso para personal municipal</p>
          </div>

          {error && (
            <div
              ref={errorRef}
              className="login-card__error"
              id="login-error"
              role="alert"
              tabIndex={-1}
            >
              <AlertCircle aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form
            className="login-card__form"
            onSubmit={handleSubmit}
            aria-busy={isLoading}
            aria-describedby={error ? 'login-error' : undefined}
          >
            <div className="login-card__field">
              <label htmlFor="login-username">Usuario o correo electrónico</label>
              <div className="login-card__input-wrap">
                <UserRound className="login-card__input-icon" aria-hidden="true" />
                <input
                  id="login-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="Ingresá tu usuario o correo"
                  value={username}
                  onChange={event => setUsername(event.target.value)}
                  required
                  readOnly={isLoading}
                />
              </div>
            </div>

            <div className="login-card__field">
              <label htmlFor="login-password">Contraseña</label>
              <div className="login-card__input-wrap login-card__input-wrap--password">
                <LockKeyhole className="login-card__input-icon" aria-hidden="true" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Ingresá tu contraseña"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  required
                  readOnly={isLoading}
                />
                <button
                  className="login-card__visibility"
                  type="button"
                  onClick={() => setShowPassword(value => !value)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-controls="login-password"
                >
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>
            </div>

            <button className="login-card__submit" type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className="login-card__spinner" aria-hidden="true" />
                  <span>Ingresando...</span>
                </>
              ) : (
                <>
                  <span>Ingresar</span>
                  <ArrowRight aria-hidden="true" />
                </>
              )}
            </button>
            <span className="login-page__sr-only" role="status">
              {isLoading ? 'Verificando tus credenciales.' : ''}
            </span>
          </form>

          <p className="login-card__help">
            ¿No podés ingresar? Contactá al administrador del sistema.
          </p>
        </section>

        <div className="secure-note login-page__secure">
          <ShieldCheck aria-hidden="true" />
          <span>Acceso seguro · Plataforma oficial</span>
        </div>
      </div>
    </main>
  );
}