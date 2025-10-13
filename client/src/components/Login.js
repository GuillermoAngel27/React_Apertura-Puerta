import React, { useState, useEffect } from 'react';
import DoorAnimation from './DoorAnimation';
import './Login.css';

const Login = ({ onLogin }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  // Estados para la animación de puerta
  const [showDoorAnimation, setShowDoorAnimation] = useState(false);
  const [loginUser, setLoginUser] = useState(null);

  // useEffect para verificar cookie después de activación exitosa
  useEffect(() => {
    if (isAuthenticating) {
      
      let retryCount = 0;
      const maxRetries = 50; // Máximo 10 segundos (50 * 200ms)
      
      const verifyActivationCookie = async () => {
        try {
          if (retryCount >= maxRetries) {
            setIsAuthenticating(false);
            return;
          }
          retryCount++;
          const response = await fetch('http://localhost:5000/api/verify-token', {
            credentials: 'include'
          });
          
          if (response.ok) {
            const data = await response.json();
   
            
            // Verificar cookie específica usando getCookie helper
            const getCookie = (name) => {
              const value = `; ${document.cookie}`;
              const parts = value.split(`; ${name}=`);
              if (parts.length === 2) return parts.pop().split(';').shift();
              return null;
            };
            const cookieToken = getCookie('token');
            
            onLogin(data.user);
            setIsAuthenticating(false);
          } else {
            // Verificar si es por falta de sesión activa (logout manual)
            const errorData = await response.json();
            
            if (response.status === 401 && errorData.sessionClosed) {
              setIsAuthenticating(false);
              return; // Salir del bucle
            }
            
            // Retry en 200ms solo si NO es logout manual
            setTimeout(verifyActivationCookie, 200);
          }
        } catch (error) {
          setIsAuthenticating(false);
        }
      };
      
      verifyActivationCookie();
    }
  }, [isAuthenticating]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Función para manejar la finalización de la animación de puerta
  const handleDoorAnimationComplete = () => {
    setShowDoorAnimation(false);
    setLoginUser(null);
    onLogin(loginUser);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Prevenir submit si ya se está autenticando
    if (loading || isAuthenticating) {
      return;
    }
    
    setLoading(true);
    setError('');


    try {
      const response = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
        credentials: 'include'
      });

      
      const data = await response.json();

      if (response.ok) {
        if (data.autoActivated) {
          // Disparar evento global para refrescar notificaciones
          window.dispatchEvent(new CustomEvent('deviceAutoActivated', { 
            detail: { username: data.user.username, userId: data.user.id } 
          }));
          // Mostrar animación de puerta y ir al dashboard
          setLoginUser(data.user);
          setShowDoorAnimation(true);
        } else {
          // Mostrar animación de puerta en lugar de ir directamente al dashboard
          setLoginUser(data.user);
          setShowDoorAnimation(true);
        }
      } else {
        if (data.hasToken) {
          // Usuario tiene token pero dispositivo no autorizado
          setError(data.message || '🚫 Contacta a administración para volver a activar el token.');
        } else {
          // Credenciales inválidas
          setError(data.message || '🔐 Credenciales inválidas. Verifique usuario y contraseña.');
        }
      }
    } catch (error) {
      setError('🌐 Error de conexión. Verifique que el servidor esté ejecutándose.');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <img src="/logotaq02.png" alt="Logo TAQ" className="logo-image" />
          </div>
          <h1>🔐 Sistema de Apertura de Puerta</h1>
          <p>Inicie sesión para acceder al sistema</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Usuario:</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              placeholder="Ingrese su usuario"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña:</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Ingrese su contraseña"
            />
          </div>

          {error && (
            <div className={`message ${error.includes('Token asignado pero no activado') ? 'warning' : 'error'}`}>
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>

      </div>

      {/* Animación de puerta abriendo */}
      {showDoorAnimation && loginUser && (
        <DoorAnimation 
          onComplete={handleDoorAnimationComplete}
          username={loginUser.username}
        />
      )}
    </div>
  );
};

export default Login;
