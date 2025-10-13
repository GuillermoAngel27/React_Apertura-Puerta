import React, { useState, useEffect } from 'react';
import './DoorAnimation.css';

const DoorAnimation = ({ onComplete, username }) => {
  const [animationPhase, setAnimationPhase] = useState('entering'); // entering, handle-turn, opening, revealing, opened
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const animationSequence = () => {
      // La puerta aparece inmediatamente en el centro sin animación de entrada
      setAnimationPhase('opening');
      setShowWelcome(true);

      // Completar animación después del deslizamiento
      setTimeout(() => {
        onComplete();
      }, 2500);
    };

    animationSequence();
  }, [onComplete]);

  return (
    <div className="door-animation-overlay">
      <div className="door-animation-container">
        {/* Logo y mensaje de bienvenida */}
        {showWelcome && (
          <div className="welcome-message">
            <div className="door-logo">
              <img src="/logotaq02.png" alt="Logo TAQ" className="logo-image" />
            </div>
            <h2>¡Bienvenido, {username}!</h2>
            <p>Accediendo al sistema...</p>
          </div>
        )}

        {/* Puerta */}
        <div className={`door ${animationPhase}`}>
          {/* Marco exterior de la puerta */}
          <div className="door-outer-frame">
            {/* Marco interior de la puerta */}
            <div className="door-inner-frame">
              {/* Marco de la puerta */}
              <div className="door-frame">
                {/* Paneles de la puerta - diseño tradicional */}
                <div className="door-panels">
                  {/* Panel superior grande */}
                  <div className="door-panel door-panel-top"></div>
                  {/* Panel inferior pequeño */}
                  <div className="door-panel door-panel-bottom"></div>
                </div>

                {/* Bisagras */}
                <div className="door-hinges">
                  <div className="hinge hinge-1"></div>
                  <div className="hinge hinge-2"></div>
                  <div className="hinge hinge-3"></div>
                </div>

                {/* Manija y cerradura */}
                <div className={`door-handle ${animationPhase}`}>
                  <div className="handle-lever"></div>
                  <div className="handle-escutcheon">
                    <div className="keyhole"></div>
                  </div>
                </div>

                {/* Efectos de partículas */}
                <div className="particles">
                  <div className="particle particle-1"></div>
                  <div className="particle particle-2"></div>
                  <div className="particle particle-3"></div>
                  <div className="particle particle-4"></div>
                  <div className="particle particle-5"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard preview (se revela al abrir la puerta) */}
        <div className={`dashboard-preview ${animationPhase}`}>
          <div className="preview-content">
            <div className="preview-header">
              <h3>Control de Acceso</h3>
            </div>
            <div className="preview-button">
              <div className="button-glow"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoorAnimation;
