import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

import FaultyTerminal from './FaultyTerminal';
import AvatarEasterEgg from './AvatarEasterEgg';
import './effects-entry.css';

function EffectsLayer() {
  const terminalWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const host = terminalWrapRef.current;
      if (!host) return;
      const target = host.querySelector('.faulty-terminal-container');
      if (!target) return;

      target.dispatchEvent(
        new MouseEvent('mousemove', {
          clientX: event.clientX,
          clientY: event.clientY
        })
      );
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <>
      <AvatarEasterEgg />

      <div className="effects-terminal-wrap" aria-hidden="true" ref={terminalWrapRef}>
        <FaultyTerminal
          scale={3}
          gridMul={[2, 1]}
          digitSize={2.1}
          timeScale={0.8}
          pause={false}
          scanlineIntensity={0.5}
          glitchAmount={1}
          flickerAmount={1}
          noiseAmp={1}
          chromaticAberration={0}
          dither={0}
          curvature={0.1}
          tint="#fffb00"
          mouseReact
          mouseStrength={0.5}
          pageLoadAnimation
          brightness={0.6}
        />
      </div>
    </>
  );
}

const rootElement = document.getElementById('effects-root');
if (rootElement) {
  createRoot(rootElement).render(<EffectsLayer />);
}
