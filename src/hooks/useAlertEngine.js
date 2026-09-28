import { useCallback, useMemo, useRef, useState } from 'react';
import { PER_DAY } from '../lib/campus.js';
import { createEngine, engineStep, engineLive } from '../lib/alerts.js';

/**
 * Runs the alert engine up to the current interval, backfilling the 24 h before launch so the feed isn't
 * empty, then applies the per-second live check. The engine is stepped synchronously during render
 * (guarded by lastAbs) so alerts are never a tick behind.
 */
export function useAlertEngine(model, thresholds, customRules) {
  const cfgRef = useRef(null);
  cfgRef.current = { thresholds, customRules };
  const abs = model.abs;

  const engineRef = useRef(null);
  if (!engineRef.current) {
    const E = createEngine();
    for (let k = abs - PER_DAY; k < abs; k++) engineStep(E, k, cfgRef.current);
    E.lastAbs = abs - 1;
    engineRef.current = E;
  }

  const [version, setVersion] = useState(0);
  const alerts = useMemo(() => {
    const E = engineRef.current;
    while (E.lastAbs < abs) { E.lastAbs++; engineStep(E, E.lastAbs, cfgRef.current); }
    engineLive(E, model, cfgRef.current);
    return E.alerts.slice();
  }, [model, thresholds, customRules, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const acknowledge = useCallback(alert => { alert.status = 'acknowledged'; setVersion(v => v + 1); }, []);
  return { alerts, acknowledge };
}
