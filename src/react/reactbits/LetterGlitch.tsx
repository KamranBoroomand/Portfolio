import React, { useEffect, useRef } from 'react';

interface LetterCell {
  char: string;
  color: string;
  targetColor: string;
  colorProgress: number;
}

interface LetterGlitchProps {
  glitchColors?: string[];
  glitchSpeed?: number;
  centerVignette?: boolean;
  outerVignette?: boolean;
  smooth?: boolean;
  characters?: string;
  className?: string;
}

const hexToRgb = (hex: string): [number, number, number] => {
  if (hex.startsWith('rgb')) {
    const values = hex.match(/\d+/g);
    if (values && values.length >= 3) {
      return [Number(values[0]), Number(values[1]), Number(values[2])];
    }
  }

  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const normalized = hex.replace(shorthandRegex, (_m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized);

  if (!result) {
    return [255, 255, 255];
  }

  return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
};

const interpolateColor = (start: string, end: string, factor: number): string => {
  const a = hexToRgb(start);
  const b = hexToRgb(end);
  const result = a.map((value, index) => Math.round(value + factor * (b[index] - value)));
  return `rgb(${result[0]}, ${result[1]}, ${result[2]})`;
};

const LetterGlitch: React.FC<LetterGlitchProps> = ({
  glitchColors = ['#2b4539', '#61dca3', '#61b3dc'],
  glitchSpeed = 50,
  centerVignette = false,
  outerVignette = true,
  smooth = true,
  characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$&*()-_+=/[]{};:<>',
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const lettersRef = useRef<LetterCell[]>([]);
  const gridRef = useRef({ columns: 0, rows: 0 });
  const lastGlitchTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const setCanvasSize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const width = parent.offsetWidth;
      const height = parent.offsetHeight;
      canvas.width = width;
      canvas.height = height;

      const columns = Math.ceil(width / 20);
      const rows = Math.ceil(height / 20);
      gridRef.current = { columns, rows };

      lettersRef.current = Array.from({ length: columns * rows }, () => ({
        char: characters[Math.floor(Math.random() * characters.length)],
        color: glitchColors[Math.floor(Math.random() * glitchColors.length)],
        targetColor: glitchColors[Math.floor(Math.random() * glitchColors.length)],
        colorProgress: 1
      }));
    };

    const render = () => {
      const now = Date.now();
      const elapsed = now - lastGlitchTimeRef.current;

      if (elapsed >= glitchSpeed) {
        lettersRef.current.forEach((letter) => {
          if (Math.random() < 0.03) {
            letter.char = characters[Math.floor(Math.random() * characters.length)];
            letter.targetColor = glitchColors[Math.floor(Math.random() * glitchColors.length)];

            if (!smooth) {
              letter.color = letter.targetColor;
              letter.colorProgress = 1;
            } else {
              letter.colorProgress = 0;
            }
          }
        });

        lastGlitchTimeRef.current = now;
      }

      if (smooth) {
        lettersRef.current.forEach((letter) => {
          if (letter.colorProgress < 1) {
            letter.colorProgress += 0.05;
            if (letter.colorProgress > 1) letter.colorProgress = 1;
            letter.color = interpolateColor(letter.color, letter.targetColor, letter.colorProgress);
          }
        });
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = '16px monospace';
      ctx.textBaseline = 'top';

      const { columns, rows } = gridRef.current;
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < columns; x += 1) {
          const index = y * columns + x;
          const letter = lettersRef.current[index];
          if (!letter) continue;
          ctx.fillStyle = letter.color;
          ctx.fillText(letter.char, x * 20, y * 20);
        }
      }

      let gradient: CanvasGradient;

      if (outerVignette) {
        gradient = ctx.createRadialGradient(
          canvas.width / 2,
          canvas.height / 2,
          0,
          canvas.width / 2,
          canvas.height / 2,
          Math.sqrt(canvas.width * canvas.width + canvas.height * canvas.height) / 2
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 1)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      if (centerVignette) {
        gradient = ctx.createRadialGradient(
          canvas.width / 2,
          canvas.height / 2,
          0,
          canvas.width / 2,
          canvas.height / 2,
          Math.sqrt(canvas.width * canvas.width + canvas.height * canvas.height) / 5
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      animationRef.current = window.requestAnimationFrame(render);
    };

    window.addEventListener('resize', setCanvasSize);
    setCanvasSize();
    render();

    return () => {
      window.removeEventListener('resize', setCanvasSize);
      if (animationRef.current) {
        window.cancelAnimationFrame(animationRef.current);
      }
    };
  }, [characters, glitchColors, glitchSpeed, smooth, centerVignette, outerVignette]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  );
};

export default LetterGlitch;
