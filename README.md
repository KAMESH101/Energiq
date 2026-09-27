# EnergiQ — Smart Energy Grid & Consumption Optimization Dashboard

Predictive energy monitoring for **VIT Smart Campus** (6 zones, 15-minute metering): real-time load, WMA-12 + trend forecasting, idle-draw and anomaly detection, and zone-specific savings recommendations with rupee impact.

Built for **TeachPulse Hackathon 2026** • EnergiQ by VoidVault • VIT Chennai

## Quick start

```bash
npm install
npm run dev            # http://localhost:5173
```

| Command | Output |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | `dist/` — static multi-file build (host anywhere) |
| `npm run build:single` | `dist-single/index.html` — one self-contained file, works offline from `file://` |
| `npm run preview` | Serve `dist/` locally |
| `npm test` | Engine unit tests (Vitest) |

## Project structure

```
src/
  lib/                      Pure JS engines — no React, fully unit-tested
    campus.js               Zone profiles (ASHRAE / BEE India), tariffs, time helpers
    data.js                 Seeded 7-day data generator (sin² load curves, AR(1) noise, anomaly injection)
    forecast.js             WMA-12 + linear trend, seasonal blend, confidence bands, MAPE / R²
    model.js                Per-tick derived state (KPIs, per-zone stats, campus forecast)
    alerts.js               Threshold state machine (hysteresis), idle draw, spike prediction, custom rules
    recommendations.js      Rule-based savings recommendations
    report.js               Markdown daily report export
    theme.js                Palette context for charts
    engine.test.js          Tests
  hooks/
    useSimulation.js        Virtual clock (1x / 2x / 4x, pause)
    useAlertEngine.js       Steps the alert engine each tick (with 24 h backfill)
  components/               TopBar, Nav (sidebar + mobile bottom bar), Overlays (tour, modal, toasts), ui primitives
  views/                    Overview, Zones, Forecast, Savings, Alerts
  App.jsx                   State, keyboard shortcuts, layout
index.html                  Boot/loading screen (inline so it paints before the bundle)
```

## Keyboard shortcuts

`1`–`5` switch view · `Space` pause/resume · `D` theme · `F` fullscreen · `?` shortcuts panel

## Forecasting notes

The spec's WMA-12 + linear-trend extrapolation lags steep ramps and overshoots at turning points, so the
production forecast blends it (10% weight at t+1) with a 6-day seasonal profile carrying the current
deviation forward. Weekday-daytime MAPE is ~2%; the unit tests enforce < 5%.
