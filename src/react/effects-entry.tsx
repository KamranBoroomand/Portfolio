import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

import FaultyTerminal from './FaultyTerminal';
import AvatarEasterEgg from './AvatarEasterEgg';
import './effects-entry.css';

const EFFECTS_SETTINGS_EVENT = 'kb-effects-settings';

interface EffectsSettings {
  reducedMotion: boolean;
  intensity: number;
}

declare global {
  interface Window {
    __KB_EFFECTS_SETTINGS__?: Partial<EffectsSettings>;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeSettings(raw: Partial<EffectsSettings> | undefined): EffectsSettings {
  const intensity = clamp(Number(raw?.intensity ?? 1) || 1, 0, 1);
  return {
    reducedMotion: Boolean(raw?.reducedMotion),
    intensity
  };
}

function getInitialSettings(): EffectsSettings {
  const fromWindow = normalizeSettings(window.__KB_EFFECTS_SETTINGS__);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return {
    reducedMotion: fromWindow.reducedMotion || prefersReducedMotion,
    intensity: fromWindow.intensity
  };
}

function EffectsLayer() {
  const terminalWrapRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<EffectsSettings>(() => getInitialSettings());

  useEffect(() => {
    const handleSettingsUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<Partial<EffectsSettings>>;
      setSettings(normalizeSettings(customEvent.detail));
    };

    window.addEventListener(EFFECTS_SETTINGS_EVENT, handleSettingsUpdate);
    return () => window.removeEventListener(EFFECTS_SETTINGS_EVENT, handleSettingsUpdate);
  }, []);

  useEffect(() => {
    if (settings.reducedMotion || settings.intensity <= 0) {
      return undefined;
    }

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
  }, [settings.reducedMotion, settings.intensity]);

  const intensity = clamp(settings.intensity, 0, 1);
  const isPaused = settings.reducedMotion || intensity <= 0;

  return (
    <>
      <AvatarEasterEgg reducedMotion={settings.reducedMotion} intensity={intensity} />

      <div
        className="effects-terminal-wrap"
        aria-hidden="true"
        ref={terminalWrapRef}
        style={{ opacity: intensity }}
      >
        <FaultyTerminal
          scale={3}
          gridMul={[2, 1]}
          digitSize={2.1}
          timeScale={isPaused ? 0 : 0.3 + intensity * 0.5}
          pause={isPaused}
          scanlineIntensity={0.12 + intensity * 0.38}
          glitchAmount={0.25 + intensity * 0.75}
          flickerAmount={0.2 + intensity * 0.8}
          noiseAmp={0.2 + intensity * 0.8}
          chromaticAberration={0}
          dither={0}
          curvature={0.1}
          tint="#fffb00"
          mouseReact={!settings.reducedMotion && intensity > 0.15}
          mouseStrength={0.1 + intensity * 0.4}
          pageLoadAnimation={!settings.reducedMotion && intensity > 0.05}
          brightness={0.18 + intensity * 0.42}
        />
      </div>
    </>
  );
}

const rootElement = document.getElementById('effects-root');
if (rootElement) {
  createRoot(rootElement).render(<EffectsLayer />);
}
