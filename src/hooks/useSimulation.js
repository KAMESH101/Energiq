import { useEffect, useState } from 'react';
import { nowIdx } from '../lib/campus.js';

/** Live clock: follows the real IST wall clock; `abs` is the current 15-minute interval. Pausing freezes the dashboard. */
export function useSimulation() {
  const [now, setNow] = useState(() => new Date());
  const [playing, setPlaying] = useState(true);
  const [frozen, setFrozen] = useState(null);

  useEffect(() => {
    if (!playing) { setFrozen(f => f || new Date()); return undefined; }
    setFrozen(null);
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [playing]);

  const time = frozen || now;
  const abs = nowIdx(time.getTime());

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('energiq:tick', { detail: { abs } }));
  }, [abs]);

  return { abs, time, playing, setPlaying };
}
