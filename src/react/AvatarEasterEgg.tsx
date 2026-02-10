import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import LetterGlitch from './reactbits/LetterGlitch';

interface AvatarEasterEggProps {
  avatarSelector?: string;
  soundSrc?: string;
}

const CLOSE_ANIMATION_MS = 220;

const styles = `
.egg-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(2, 5, 11, 0.64);
  backdrop-filter: blur(4px);
  opacity: 0;
  visibility: hidden;
  transition: opacity 220ms ease, visibility 220ms ease;
  z-index: 999;
}

.egg-overlay.is-open {
  opacity: 1;
  visibility: visible;
}

.egg-modal {
  width: min(920px, 92vw);
  max-height: min(88vh, 820px);
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45);
  transform: translateY(14px) scale(0.97);
  opacity: 0;
  transition: transform 220ms ease, opacity 220ms ease;
  background: #06090f;
  position: relative;
}

.egg-modal.is-open {
  transform: translateY(0) scale(1);
  opacity: 1;
}

.egg-glitch-wrap {
  position: absolute;
  inset: 0;
}

.egg-shell {
  position: relative;
  z-index: 1;
  min-height: 540px;
  max-height: min(88vh, 820px);
  padding: 1.2rem 1.2rem 2.4rem;
  display: flex;
  flex-direction: column;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.22), rgba(0, 0, 0, 0.65));
  overflow-y: auto;
}

.egg-close {
  align-self: end;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  color: #f7f9ff;
  background: rgba(7, 11, 20, 0.54);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.egg-content {
  margin-top: auto;
  padding-top: 1.2rem;
  padding-bottom: 0.2rem;
  color: #f7f9ff;
  max-width: 56ch;
}

.egg-kicker {
  margin: 0;
  font-size: 0.75rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(247, 249, 255, 0.72);
}

.egg-title {
  margin: 0.45rem 0 0;
  font-size: clamp(1.2rem, 2.8vw, 2rem);
  line-height: 1.15;
}

.egg-text {
  margin: 0.55rem 0 0;
  color: rgba(247, 249, 255, 0.86);
  line-height: 1.45;
}

.egg-avatar-trigger {
  cursor: pointer;
}
`;

export default function AvatarEasterEgg({
  avatarSelector = '.avatar-box img',
  soundSrc = '/assets/audio/easter-egg.wav'
}: AvatarEasterEggProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const closeOverlay = useCallback(() => {
    clearCloseTimer();
    setIsOpen(false);
    closeTimerRef.current = window.setTimeout(() => {
      setIsMounted(false);
      closeTimerRef.current = null;
    }, CLOSE_ANIMATION_MS);
  }, [clearCloseTimer]);

  const openOverlay = useCallback(() => {
    clearCloseTimer();
    setIsMounted(true);

    window.requestAnimationFrame(() => {
      setIsOpen(true);
    });

    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        /* autoplay can be blocked depending on browser policies */
      });
    }
  }, [clearCloseTimer]);

  useEffect(() => {
    const avatar = document.querySelector<HTMLElement>(avatarSelector);
    if (!avatar) {
      return undefined;
    }

    avatar.classList.add('egg-avatar-trigger');
    avatar.addEventListener('click', openOverlay);

    return () => {
      avatar.classList.remove('egg-avatar-trigger');
      avatar.removeEventListener('click', openOverlay);
    };
  }, [avatarSelector, openOverlay]);

  useEffect(() => {
    if (!isMounted) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeOverlay();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMounted, closeOverlay]);

  useEffect(() => {
    return () => {
      clearCloseTimer();
    };
  }, [clearCloseTimer]);

  const portal = useMemo(() => {
    if (!isMounted) {
      return null;
    }

    return createPortal(
      <div
        className={`egg-overlay ${isOpen ? 'is-open' : ''}`}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            closeOverlay();
          }
        }}
      >
        <div className={`egg-modal ${isOpen ? 'is-open' : ''}`}>
          <div className="egg-glitch-wrap" aria-hidden="true">
            <div style={{ width: '1080px', height: '1080px', position: 'relative' }}>
              <LetterGlitch
                glitchColors={['#fffb00', '#c0c0c0', '#7a7a7a', '#444444']}
                glitchSpeed={10}
                centerVignette={false}
                outerVignette={false}
                smooth
              />
            </div>
          </div>

          <div className="egg-shell">
            <button className="egg-close" aria-label="Close Easter egg" onClick={closeOverlay}>
              ×
            </button>

            <div className="egg-content">
              <p className="egg-kicker">Easter Egg</p>
              <h3 className="egg-title">You discovered the hidden console dimension.</h3>
              <p className="egg-text">
                Built for curious minds. Press Escape or click outside to exit.
              </p>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }, [isMounted, isOpen, closeOverlay]);

  return (
    <>
      <style>{styles}</style>
      <audio ref={audioRef} preload="auto" src={soundSrc} />
      {portal}
    </>
  );
}
