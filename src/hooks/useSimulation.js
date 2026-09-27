import { useEffect, useState } from 'react';
import { START_IDX } from '../lib/campus.js';

/** Real-time clock: each tick advances virtual time by 15 min (1x = 2 s, 2x = 1 s, 4x = 0.5 s). */
export function useSimulation() {
  const [abs, setAbs] = useState(START_IDX);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(() => setAbs(a => a + 1), 2000 / speed);
    return () => clearInterval(id);
  }, [playing, speed]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('energiq:tick', { detail: { abs } }));
  }, [abs]);

  return { abs, playing, setPlaying, speed, setSpeed };
}
