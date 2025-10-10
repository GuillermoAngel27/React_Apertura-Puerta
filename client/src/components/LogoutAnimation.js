import React, { useState, useEffect } from 'react';
import './LogoutAnimation.css';

const LogoutAnimation = ({ onComplete, userName }) => {
  const [animationPhase, setAnimationPhase] = useState('entering');
  const [showGoodbye, setShowGoodbye] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setAnimationPhase('fading');
      setShowGoodbye(true);
    }, 500);

    const timer2 = setTimeout(() => {
      setAnimationPhase('disappearing');
    }, 2000);

    const timer3 = setTimeout(() => {
      setAnimationPhase('completed');
      onComplete();
    }, 3000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onComplete]);

  return (
    <div className="logout-animation-overlay">
      <div className="logout-animation-container">
        {/* Partículas de desvanecido */}
        <div className="particles-container">
          {[...Array(30)].map((_, i) => (
            <div key={i} className="particle" style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 2}s`
            }} />
          ))}
        </div>

        {/* Mensaje de despedida */}
        {showGoodbye && (
          <div className="goodbye-message">
            <div className="goodbye-icon">👋</div>
            <h2 className="goodbye-title">¡Hasta pronto!</h2>
            <p className="goodbye-text">
              {userName ? `${userName}` : 'Gracias por usar el sistema'}
            </p>
            <div className="goodbye-subtitle">Cerrando sesión...</div>
          </div>
        )}

        {/* Efecto de desvanecido */}
        <div className="fade-effect"></div>
      </div>
    </div>
  );
};

export default LogoutAnimation;
