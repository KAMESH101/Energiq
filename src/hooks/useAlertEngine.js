import { useCallback, useMemo, useRef, useState } from 'react';
import { PER_DAY, START_IDX } from '../lib/campus.js';
import { createEngine, engineStep } from '../lib/alerts.js';

/**
 * Runs the alert engine up to `abs`, backfilling the 24 h before launch so the feed isn't empty.
 * The engine is stepped synchronously during render (guarded by lastAbs) so alerts are never a tick behind.
 */
export function useAlertEngine(abs, thresholds, customRules) {
  const cfgRef = useRef(null);
  cfgRef.current = { thresholds, customRules };

  const engineRef = useRef(null);
  if (!engineRef.current) {
    const E = createEngine();
    for (let k = START_IDX - PER_DAY; k < START_IDX; k++) engineStep(E, k, cfgRef.current);
    E.lastAbs = START_IDX - 1;
    engineRef.current = E;
  }

  const [version, setVersion] = useState(0);
  const alerts = useMemo(() => {
    const E = engineRef.current;
    while (E.lastAbs < abs) { E.lastAbs++; engineStep(E, E.lastAbs, cfgRef.current); }
    return E.alerts.slice();
  }, [abs, version]);

  const acknowledge = useCallback(alert => { alert.status = 'acknowledged'; setVersion(v => v + 1); }, []);
  return { alerts, acknowledge };
}
