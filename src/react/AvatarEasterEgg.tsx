import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import LetterGlitch from './reactbits/LetterGlitch';
import './AvatarEasterEgg.css';

interface AvatarEasterEggProps {
  avatarSelector?: string;
  soundSrc?: string;
}

const CLOSE_ANIMATION_MS = 220;

export default function AvatarEasterEgg({
  avatarSelector = '.avatar-box',
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

    const hadRole = avatar.hasAttribute('role');
    const hadTabIndex = avatar.hasAttribute('tabindex');

    avatar.classList.add('egg-avatar-trigger');
    avatar.setAttribute('aria-label', 'Open Easter egg');
    if (!hadRole) {
      avatar.setAttribute('role', 'button');
    }
    if (!hadTabIndex) {
      avatar.tabIndex = 0;
    }

    avatar.addEventListener('click', openOverlay);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openOverlay();
      }
    };
    avatar.addEventListener('keydown', onKeyDown);

    return () => {
      avatar.classList.remove('egg-avatar-trigger');
      avatar.removeAttribute('aria-label');
      if (!hadRole) {
        avatar.removeAttribute('role');
      }
      if (!hadTabIndex) {
        avatar.removeAttribute('tabindex');
      }
      avatar.removeEventListener('click', openOverlay);
      avatar.removeEventListener('keydown', onKeyDown);
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
            <div className="egg-glitch-stage">
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
      <audio ref={audioRef} preload="auto" src={soundSrc} />
      {portal}
    </>
  );
}
