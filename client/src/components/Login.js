import React, { useState, useEffect } from 'react';
import './Login.css';

const Login = ({ onLogin }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tokenGenerated, setTokenGenerated] = useState(false);
  const [showTokenActivation, setShowTokenActivation] = useState(false);
  const [tokenToActivate, setTokenToActivate] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // useEffect para verificar cookie después de activación exitosa
  useEffect(() => {
    if (isAuthenticating) {
      console.log('🔍 VERIFICANDO COOKIE DESPUÉS DE ACTIVACIÓN...');
      
      let retryCount = 0;
      const maxRetries = 50; // Máximo 10 segundos (50 * 200ms)
      
      const verifyActivationCookie = async () => {
        try {
          if (retryCount >= maxRetries) {
            console.log('⏰ TIMEOUT - Máximos reintentos alcanzados');
            setIsAuthenticating(false);
            return;
          }
          retryCount++;
          const response = await fetch('http://localhost:5000/api/verify-token', {
            credentials: 'include'
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('✅ COOKIE VERIFICADA - Usuario:', data.user);
            console.log('🍪 COOKIES DISPONIBLES DESPUÉS DE ACTIVACIÓN:');
            console.log('  📄 document.cookie:', document.cookie);
            
            // Verificar cookie específica usando getCookie helper
            const getCookie = (name) => {
              const value = `; ${document.cookie}`;
              const parts = value.split(`; ${name}=`);
              if (parts.length === 2) return parts.pop().split(';').shift();
              return null;
            };
            const cookieToken = getCookie('token');
            console.log('  🔍 Token específico encontrado:', cookieToken ? `SÍ (${cookieToken})` : 'NO');
            
            console.log('🔀 FINALMENTE - TRANSICIÓN AL DASHBOARD');
            onLogin(data.user);
            setIsAuthenticating(false);
          } else {
            // Verificar si es por falta de sesión activa (logout manual)
            const errorData = await response.json();
            console.log('❌ VERIFICACIÓN FALLIDA - Status:', response.status, 'Data:', errorData);
            
            if (response.status === 401 && errorData.sessionClosed) {
              console.log('🚪 SESIÓN CERRADA DETECTADA - Logout manual realizado');
              console.log('🛑 DETENIENDO BUCLE - Usuario debe ingresar credenciales');
              setIsAuthenticating(false);
              return; // Salir del bucle
            }
            
            console.log('❌ Cookie no encontrada aún');
            // Retry en 200ms solo si NO es logout manual
            setTimeout(verifyActivationCookie, 200);
          }
        } catch (error) {
          console.error('💥 Error verificando cookie:', error);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Prevenir submit si ya se está autenticando
    if (loading || isAuthenticating) {
      console.log('⚠️ LOGIN ya en proceso o autenticando, ignorando...');
      return;
    }
    
    setLoading(true);
    setError('');
    setTokenGenerated(false);

    console.log('🚀 INICIANDO LOGIN:', formData);
    console.log('🔍 Estado actual - showTokenActivation:', showTokenActivation);

    try {
      const response = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
        credentials: 'include'
      });

      console.log('📡 RESPONSE STATUS:', response.status);
      
      const data = await response.json();
      console.log('📄 RESPONSE DATA:', data);

      if (response.ok) {
        if (data.tokenGenerated) {
          console.log('✨ TOKEN GENERATED - Token:', data.token);
          setShowTokenActivation(true);
          setError('Token generado. El administrador le compartirá el token para activar su dispositivo.');
          
          // Disparar evento global para refrescar notificaciones
          console.log('🔄 Login: Token generado, disparando evento global');
          window.dispatchEvent(new CustomEvent('tokenGenerated', { 
            detail: { username: formData.username, token: data.token } 
          }));
        } else {
          console.log('✅ LOGIN SUCCESS - User:', data.user);
          onLogin(data.user);
        }
      } else {
        console.log('❌ LOGIN FAILED - Reason:', data.message);
        if (data.hasToken && data.tokenNotActivated) {
          // Usuario tiene token pero no está activado
          setShowTokenActivation(true);
          setError('Token asignado pero no activado. Ingrese el token para activar su dispositivo.');
        } else if (data.hasToken) {
          // Usuario tiene token pero dispositivo no autorizado
          setError(data.message || 'Dispositivo no autorizado. Contacte al administrador.');
        } else {
          // Credenciales inválidas
          setError(data.message || 'Error en el login');
        }
      }
    } catch (error) {
      console.error('💥 LOGIN ERROR:', error);
      setError('Error de conexión. Verifique que el servidor esté ejecutándose.');
    } finally {
      setLoading(false);
    }
  };

  const handleTokenActivation = async (e) => {
    e.preventDefault();
    
    // Prevenir múltiples activaciones
    if (loading) {
      console.log('⚠️ ACTIVACIÓN ya en proceso, ignorando...');
      return;
    }
    
    setLoading(true);
    setError('');

    console.log('🔐 ACTIVANDO TOKEN:', tokenToActivate);
    console.log('👤 USUARIO SOLICITANTE:', formData.username);

    try {
      const response = await fetch('http://localhost:5000/api/activate-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          token: tokenToActivate,
          username: formData.username // Enviar username para validación de seguridad
        }),
        credentials: 'include'
      });

      console.log('📡 TOKEN ACTIVATION STATUS:', response.status);
      
      const data = await response.json();
      console.log('📄 TOKEN ACTIVATION DATA:', data);

      if (response.ok) {
        console.log('✅ TOKEN ACTIVATED - User:', data.user);
        console.log('🎉 ACTIVACIÓN EXITOSA - Redirigiendo al dashboard...');
        
        // Disparar evento global para refrescar notificaciones
        console.log('🔄 Login: Token activado, disparando evento global');
        window.dispatchEvent(new CustomEvent('tokenActivated', { 
          detail: { username: data.user?.username, userId: data.user?.id } 
        }));
        
        // MARCAR como autenticando para prevenir más submits
        setIsAuthenticating(true);
        setLoading(false);
        
        // Limpiar estado
        setShowTokenActivation(false);
        setTokenToActivate('');
        
        // NO llamar onLogin directamente - usar useEffect para verificar cookie
        console.log('🔀 ACTIVACIÓN COMPLETA - Esperando verificación cookie...');
      } else {
        console.log('❌ TOKEN ACTIVATION FAILED:', data.message);
        
        // Manejar errores de seguridad específicamente
        if (data.securityError) {
          setError(`🚨 Este token no corresponde al usuario "${formData.username}". Contacte al administrador para obtener el token correcto.`);
          console.log(`🚨 SEGURIDAD: Token pertenece a ${data.tokenOwner}, pero se intentó activar para ${data.requestedUser}`);
        } else {
          setError(data.message || 'Token inválido o ya activado en otro dispositivo.');
        }
      }
    } catch (error) {
      console.error('💥 TOKEN ACTIVATION ERROR:', error);
      setError('Error de conexión. Verifique que el servidor esté ejecutándose.');
    } finally {
      setLoading(false);
    }
  };

  // Mostrar formulario de activación de token
  if (showTokenActivation) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <button 
              className="back-button top-back-button"
              onClick={() => {
                setShowTokenActivation(false);
                setError('');
                setTokenToActivate('');
              }}
            >
              ← VOLVER
            </button>
            <h1>🔐 Activar Dispositivo</h1>
            <p>Ingrese el token que le compartió el administrador</p>
          </div>

          <form onSubmit={handleTokenActivation} className="login-form">
            <div className="form-group">
              <label htmlFor="token">Token de activación:</label>
              <input
                type="text"
                id="token"
                name="token"
                value={tokenToActivate}
                onChange={(e) => setTokenToActivate(e.target.value)}
                required
                placeholder="Ingrese el token"
                className="token-input"
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button 
              type="submit" 
              className="login-button"
              disabled={loading}
            >
              {loading ? 'Activando...' : 'Activar Dispositivo'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
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
            <div className={`message ${tokenGenerated ? 'success' : 'error'}`}>
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

        {tokenGenerated && (
          <div className="token-info">
            <p>Espere a que el administrador le comparta el token para activar su dispositivo.</p>
          </div>
        )}

        <div className="login-footer">
          <p><strong>Usuarios de prueba:</strong></p>
          <p>Admin: usuario: <code>admin</code>, contraseña: <code>password</code></p>
          <p>Usuario: usuario: <code>usuario</code>, contraseña: <code>password</code></p>
          <p>Jefe: usuario: <code>jefe</code>, contraseña: <code>password</code></p>
        </div>
      </div>
    </div>
  );
};

export default Login;
