# ⚡ EnergiQ — Smart Energy Grid & Consumption Optimization Dashboard

[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Vitest-5.0-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-16%20Passed-brightgreen?style=for-the-badge&logo=checkmarx&logoColor=white)](src/lib/engine.test.js)

> **Predictive energy telemetry, AI load forecasting, anomaly detection, and rupee-quantified savings recommendations for modern smart campuses.**
>
> 🏆 Built for **TeachPulse Hackathon 2026** • Team: **EnergiQ by Void** • **VIT Smart Campus, Chennai**

---

## 📑 Table of Contents

- [Executive Summary](#-executive-summary)
- [System Architecture](#-system-architecture)
- [Key Features](#-key-features)
- [Campus Specifications & Zones](#-campus-specifications--zones)
- [Forecasting Engine & Mathematics](#-forecasting-engine--mathematics)
- [Alert & Anomaly Detection State Machine](#-alert--anomaly-detection-state-machine)
- [Interactive Savings & Cost Optimization](#-interactive-savings--cost-optimization)
- [Multi-Format Enterprise Reporting](#-multi-format-enterprise-reporting)
- [Keyboard Shortcuts & Accessibility](#-keyboard-shortcuts--accessibility)
- [Tech Stack & Engineering Standards](#-tech-stack--engineering-standards)
- [Quick Start & Local Setup](#-quick-start--local-setup)
- [Build Targets (Standard & Single-File Portable)](#-build-targets)
- [Automated Testing Suite](#-automated-testing-suite)
- [Repository Structure](#-repository-structure)
- [Contributors & Credits](#-contributors--credits)

---

## 🌟 Executive Summary

Higher-education institutions and large commercial facilities face compounding energy costs, volatile peak-demand penalties, and strict carbon-reduction mandates (such as **ASHRAE 90.1** and **BEE India Energy Conservation Building Codes**). Traditional building management systems (BMS) are reactive: they inform facility managers *after* expensive demand peaks or component malfunctions have already occurred.

**EnergiQ** is an intelligent, real-time energy telemetry and predictive analytics dashboard engineered specifically for university campuses. Operating on **15-minute smart meter intervals** with continuous **sub-second telemetry interpolation**, EnergiQ anticipates campus electrical loads up to 24 hours in advance, suppresses false alarms via hysteresis-damped anomaly detection, isolates phantom off-hours idle draw, and serves actionable, zone-specific conservation recommendations with quantified monthly rupee impact ($\text{₹}$).

---

## 🏛 System Architecture

The project is built around clean separation of concerns: mathematical models and statistical algorithms reside in pure, zero-dependency ES modules with 100% unit-test coverage, completely decoupled from React presentation components.

```
                    ┌──────────────────────────────────────────────┐
                    │      Deterministic 7-Day Seeded Telemetry     │
                    │   (sin² diurnal curves, AR(1) noise, spikes) │
                    └──────────────────────┬───────────────────────┘
                                           │
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │          15-Minute Base Campus Model         │
                    │   (Aggregations, Tariffs, End-Use Splits)    │
                    └──────────────────────┬───────────────────────┘
                                           │
                 ┌─────────────────────────┴─────────────────────────┐
                 ▼                                                   ▼
┌─────────────────────────────────┐                 ┌─────────────────────────────────┐
│       Forecasting Engine        │                 │    Real-Time Simulation Layer   │
│  - WMA-12 Short-term Momentum   │                 │  - Virtual clock (Play/Pause)   │
│  - 6-Day Seasonal Profile Blend │                 │  - Sinusoidal live jitter glide │
│  - Adaptive Confidence Bands    │                 │  - Continuous kWh & ₹ accrual   │
│  - MAPE (<5%) & R² Validation   │                 │  - Sub-second timestamp sync    │
└────────────────┬────────────────┘                 └────────────────┬────────────────┘
                 │                                                   │
                 └─────────────────────────┬─────────────────────────┘
                                           │
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │       Alert & Anomaly Detection Engine       │
                    │  - Dual-tier hysteresis (Warn @85%, Crit @95%)│
                    │  - Off-hours idle-draw detector (22:00-06:00)│
                    │  - Statistical anomaly spike identification  │
                    │  - Dynamic user-defined runtime rules        │
                    └──────────────────────┬───────────────────────┘
                                           │
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │          Presentation Layer (React 18)       │
                    │  - Overview Dashboard & Capacity Meter       │
                    │  - Zone Explorer & Sub-meter Telemetry       │
                    │  - Predictive Analytics & Peak Shaving       │
                    │  - Actionable Savings (Apply / Revert)       │
                    │  - Enterprise Export (MD, CSV, JSON, PDF)    │
                    └──────────────────────────────────────────────┘
```

---

## 🚀 Key Features

### 1. 📊 Real-Time Campus Energy Overview
- **Campus Capacity Utilization Gauge**: Real-time visualization of current load versus the 1,500 kW campus substation threshold.
- **Key Performance Indicators (KPIs)**: Instant readouts for Live Load (kW), Today's Energy (kWh), Estimated Cost (₹ INR), Peak Load with exact time, and 24-hour baseline comparison.
- **Zone Snapshot Cards**: Mini sparklines, current kW load, capacity %, and end-use breakdowns (HVAC, Lighting, Plug, Server).
- **Sub-Second Live Telemetry**: Live glide interpolation with realistic micro-variations between 15-minute smart meter readings.

### 2. 🏢 Zone-Level Deep Dive
- Individual telemetry across **6 distinct campus zones**: Administration, Academic Block, Central Library, Server Room / Data Center, Main Hostel, and Sports Complex.
- **24-Hour Telemetry Graphs**: Compare actual load against baseline standards and predicted consumption curves.
- **End-Use Categorization**: Detailed breakdowns across HVAC, Lighting, Plug Loads, and Data/Server equipment.
- **Benchmark Indicators**: Area ($m^2$), peak design load, maximum occupancy, and power density ($W/m^2$).

### 3. 🔮 Predictive Load Forecasting
- **Multi-Horizon Forecast**: 24-hour ahead hourly predictions with dynamic confidence intervals ($\pm z \cdot \sigma \cdot \sqrt{h}$).
- **Seasonal Blending**: Combines 12-interval Weighted Moving Average (WMA-12) with a 6-day historical seasonal profile to eliminate overshoot during steep morning ramps and evening drops.
- **Model Evaluation Metrics**: Real-time calculation of **MAPE** (Mean Absolute Percentage Error, strictly verified $< 5\%$) and **$R^2$** goodness-of-fit.
- **Predictive Peak Alerting**: Identifies future demand spikes before they hit the grid and proposes automated load-shedding mitigations.

### 4. 💡 Intelligent Savings Recommendations
- Zone-tailored energy conservation measures (ECMs) such as HVAC setbacks, lighting motion schedules, server aisle containment, and water heating timer controls.
- **Quantified Rupee Impact**: Each recommendation calculates exact estimated monthly kilowatt-hour ($\text{kWh}$) reduction and direct cost savings in Indian Rupees ($\text{₹}$).
- **Interactive Simulation**: Click **Apply** or **Revert** on any recommendation to see the live campus model and projected savings update dynamically with toast feedback.

### 5. 🚨 Anomaly & Idle-Draw Detection
- **Hysteresis State Machine**: Dual-threshold trip points (Warning: 85%, Critical: 95%) with built-in deadbands (5% and 3% respectively) to prevent alert flapping.
- **Off-Hours Phantom Load Isolation**: Automatically flags uncharacteristic idle draw between 22:00 and 06:00 when facilities should be in energy-saving sleep states.
- **Custom Rule Engine**: Facility managers can define custom runtime alerts specifying zone, kW trigger threshold, and severity level.
- **Audit Workflow**: Full alert acknowledgment pipeline with category filtering (Active, Acknowledged, Critical, Warning, Idle, Anomaly).

### 6. 📑 Multi-Format Enterprise Export
- Dedicated export modal supporting **Markdown (`.md`)**, **Spreadsheet (`.csv`)**, **Structured JSON (`.json`)**, and **Print-Ready / Save-as-PDF (`.html`)**.
- Filterable by reporting timeframe (Today, 24 Hours, 7 Days), data sections, and individual zone scopes.

### 7. 🌓 Design System & User Experience
- Built-in **Dark / Light theme** engine with synchronized chart palettes and zero flicker.
- Interactive first-visit onboarding tour guide.
- Complete keyboard shortcut matrix for rapid command-center navigation.

---

## 🏫 Campus Specifications & Zones

The simulation models the **VIT Chennai Smart Campus**, with an aggregate contracted substation capacity of **1,500 kW** and an electricity billing tariff of **₹8.50 / kWh** (TANGEDCO HT Commercial/Institutional Tariff):

| Zone | Short Name | Area ($m^2$) | Max Occ. | Peak Load | Base Profile | Primary End Uses |
|---|---|---|---|---|---|---|
| **Admin Block** | Admin | 12,000 | 450 | 240 kW | Diurnal 08:00–18:00 | HVAC (45%), Lighting (25%), Plug (30%) |
| **Academic Block** | Academic | 28,000 | 1,800 | 420 kW | Class hours 08:30–17:30 | HVAC (50%), Lighting (30%), Plug (20%) |
| **Central Library** | Library | 15,000 | 800 | 180 kW | Extended 08:00–22:00 | HVAC (55%), Lighting (30%), Plug (15%) |
| **Server Room / Data Center** | Server | 1,200 | 15 | 160 kW | Constant 24/7 baseline | Server Racks (60%), CRAC Cooling (35%), UPS/Aux (5%) |
| **Main Hostel** | Hostel | 35,000 | 1,200 | 320 kW | Bimodal (Morning & Evening) | Water Heaters (40%), Lighting (30%), Plug (30%) |
| **Sports Complex** | Sports | 18,000 | 600 | 180 kW | Afternoon & Evening peaks | Floodlights (45%), Gymnasium HVAC (40%), Aux (15%) |

---

## 📐 Forecasting Engine & Mathematics

### 1. Weighted Moving Average (WMA-12) with Linear Momentum

For a sliding window of the last 12 intervals ($K = 12$, spanning 3 hours of 15-minute readings):

$$WMA_t = \frac{\sum_{i=1}^{K} w_i \cdot L_{t - K + i}}{\sum_{i=1}^{K} w_i}, \quad \text{where } w_i = i$$

The short-term rate of change (linear slope $\beta$) is calculated over the recent trend window:

$$\beta = \frac{K \sum (i \cdot L_i) - \left(\sum i\right)\left(\sum L_i\right)}{K \sum i^2 - \left(\sum i\right)^2}$$

### 2. Seasonal Profile Blending

Pure linear extrapolation can overshoot sharply at peak crests and struggle with steep ramp-downs. EnergiQ utilizes an adaptive blending layer combining the WMA-12 projection with a 6-day historical seasonal profile $S(t)$ and residual bias carrier $\Delta_{bias}$:

$$\hat{y}(t + h) = \alpha_h \cdot \left[ WMA_t + h \cdot \beta \right] + (1 - \alpha_h) \cdot \left[ S(t + h) + \Delta_{bias} \right]$$

Where:
- $h$ is the prediction horizon in steps.
- $\alpha_h = 0.10 \times 0.92^h$ ensures that short-term momentum governs immediate steps, while seasonal priors stabilize multi-hour projections.
- Daytime weekday **MAPE** is validated to consistently remain below **$5.0\%$** (typical performance: ~**$2.1\%$**).

### 3. Dynamic Prediction Bounds

Uncertainty spreads monotonically across the forecast horizon:

$$\text{Upper}_h = \hat{y}(t + h) + z \cdot \sigma \cdot \sqrt{h}, \quad \text{Lower}_h = \max\left(0, \; \hat{y}(t + h) - z \cdot \sigma \cdot \sqrt{h}\right)$$

---

## 🚦 Alert & Anomaly Detection State Machine

To eliminate alert fatigue caused by sensor jitter hovering near boundary lines, EnergiQ implements a multi-tier **finite state machine with hysteresis**:

```
                       Load >= 85%
         [ NORMAL ] ────────────────► [ WARNING ]
             ▲                            │
             │ Load < 80% (85% - 5%)      │ Load >= 95%
             └────────────────────────────┼──────────────┐
                                          ▼              ▼
                                     [ CRITICAL ] ◄──────┘
                                          │
                                          │ Load < 92% (95% - 3%)
                                          ▼
                                     [ WARNING ]
```

- **Warning Threshold**: Enters at $85\%$ of zone capacity; resets only when load falls below $80\%$ ($5\%$ deadband).
- **Critical Threshold**: Enters at $95\%$ of zone capacity; downgrades only when load falls below $92\%$ ($3\%$ deadband).
- **Idle Draw Rule**: Fires when off-hours (22:00 to 06:00) power exceeds $40\%$ of peak rated load for non-server zones.
- **Statistical Anomaly Rule**: Flags sudden deviations greater than $3.5\sigma$ from expected seasonal baseline curves.

---

## 💰 Interactive Savings & Cost Optimization

EnergiQ models operational energy conservation measures with tangible financial returns calculated using the institutional tariff rate of **₹8.50 / kWh**:

$$\text{Monthly Financial Savings } (\text{₹}) = \Delta\text{kWh}_{\text{monthly}} \times 8.50$$

Sample automated recommendations:
- **Server Room Cold-Aisle Containment**: Raises CRAC setpoint from 20°C to 24°C, reducing cooling energy by $14,400\text{ kWh/month}$ ($\approx \text{₹}1,22,400/\text{mo}$).
- **Library Variable Air Volume (VAV) Scheduling**: Modulates air handling during off-peak study hours, saving $5,760\text{ kWh/month}$ ($\approx \text{₹}48,960/\text{mo}$).
- **Academic Block Smart Lighting**: Integrates daylight harvesting and PIR occupancy sensors across lecture halls, saving $4,800\text{ kWh/month}$ ($\approx \text{₹}40,800/\text{mo}$).
- **Hostel Geyser Interlock**: Staggers residential water heater circuits during morning rush, avoiding peak-tariff demand charges, saving $6,120\text{ kWh/month}$ ($\approx \text{₹}52,020/\text{mo}$).

---

## ⌨️ Keyboard Shortcuts & Accessibility

Operate the entire operations center directly from the keyboard:

| Key | Action |
|---|---|
| <kbd>1</kbd> | Navigate to **Overview** |
| <kbd>2</kbd> | Navigate to **Zone Monitor** |
| <kbd>3</kbd> | Navigate to **Forecast & Predictions** |
| <kbd>4</kbd> | Navigate to **Savings Recommendations** |
| <kbd>5</kbd> | Navigate to **Alerts & Monitoring** |
| <kbd>Space</kbd> | Pause / Resume real-time simulation |
| <kbd>D</kbd> | Toggle Dark / Light theme |
| <kbd>F</kbd> | Toggle Fullscreen mode |
| <kbd>E</kbd> | Open Report Export Dialog |
| <kbd>?</kbd> | Open Keyboard Shortcuts modal |
| <kbd>Esc</kbd> | Dismiss any active modal or overlay |

---

## 💻 Tech Stack & Engineering Standards

- **Core Framework**: React 18.3 (Functional components, custom hooks, memoized computation trees)
- **Tooling & Bundler**: Vite 8.3 (Ultra-fast HMR and tree-shaking)
- **Styling**: Tailwind CSS 3.4 + Handcrafted Vanilla CSS custom properties (`index.css`)
- **Animation**: Framer Motion 11.18 (Hardware-accelerated layout transitions and toast queues)
- **Data Visualization**: Recharts 2.15 (Responsive SVG charts customized for dynamic themes)
- **Icons**: Lucide React 1.48
- **Typography**: Inter (UI) & JetBrains Mono (Telemetry/Metrics) via `@fontsource`
- **Testing**: Vitest 5.0 (Pure JS engine tests with native ESM)
- **Single-File Bundling**: `vite-plugin-singlefile` (Generates offline, self-contained single `.html` builds)

---

## ⚡ Quick Start & Local Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/KAMESH101/Energiq.git

# Enter the project directory
cd Energiq

# Install dependencies
npm install

# Launch local development server
npm run dev
```

Visit [`http://localhost:5173`](http://localhost:5173) in your browser.

---

## 📦 Build Targets

EnergiQ supports two distinct deployment formats:

### 1. Standard Production Build (Multi-Chunk SPA)
Best suited for deployment to CDNs, Vercel, Netlify, or standard web servers (Nginx/Apache):
```bash
npm run build
npm run preview
```
*Outputs to `dist/`.*

### 2. Single-File Portable Build (Offline Distribution)
Inlines all scripts, stylesheets, fonts, and SVG assets into a **single self-contained `index.html`** file that runs directly off local storage via `file://` protocol without any local web server:
```bash
npm run build:single
```
*Outputs to `dist-single/index.html`.*

---

## 🧪 Automated Testing Suite

EnergiQ includes automated unit tests covering mathematical accuracy, deterministic simulation repeatability, and state machine robustness:

```bash
npm test
```

### Verified Test Suites:
- `data engine`: Determinism with PRNG seeds, physical bounds enforcement, anomaly run injection.
- `prediction engine`: Linear ramp extrapolation, expanding confidence bounds, **weekday-daytime MAPE $< 5\%$ constraint**.
- `alert engine`: Hysteresis deadband state machine, monotonic threshold sensitivity, off-hours idle draw identification, custom user rule triggering, sub-second live alert stamping.
- `model, recommendations & report`: Conservation of energy (campus total equals sum of zones), unique non-overlapping recommendation IDs with positive savings, upcoming peak sorting, markdown/csv/json report generation.

---

## 📁 Repository Structure

```
energiq/
├── .gitignore
├── .gitattributes
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── index.html                   # HTML entry with zero-latency inline bootloader
├── src/
│   ├── main.jsx                 # Application mount
│   ├── App.jsx                  # Top-level state, navigation & keyboard listeners
│   ├── index.css                # CSS variables, typography, custom scrollbars, animations
│   │
│   ├── lib/                     # Pure JS algorithmic engines (0% React, 100% testable)
│   │   ├── campus.js            # Zone constants, tariffs, ASHRAE/BEE benchmarks
│   │   ├── data.js              # Deterministic 7-day seeded telemetry generator
│   │   ├── forecast.js          # WMA-12 + seasonal blending, MAPE, confidence bands
│   │   ├── model.js             # Per-tick derived state, rollups, and aggregations
│   │   ├── live.js              # Sub-second sinusoidal jitter interpolation layer
│   │   ├── alerts.js            # Hysteresis state machine, idle draw, peak predictor
│   │   ├── recommendations.js   # Rule-based ECM savings & rupee impact calculator
│   │   ├── report.js            # Multi-format report builder (MD, CSV, JSON, HTML)
│   │   ├── theme.js             # Theme context & synchronized palette readers
│   │   ├── format.js            # Numeric, currency, and date formatting utilities
│   │   └── engine.test.js       # Comprehensive Vitest test suite (16 tests)
│   │
│   ├── hooks/
│   │   ├── useSimulation.js     # Virtual clock state machine (1x/2x/4x, play/pause)
│   │   └── useAlertEngine.js    # Per-tick and live alert dispatch with backfill
│   │
│   ├── components/
│   │   ├── TopBar.jsx           # Live telemetry header, theme toggle, export trigger
│   │   ├── Nav.jsx              # Responsive desktop sidebar & mobile navigation bar
│   │   ├── ExportDialog.jsx     # Multi-format export configuration modal
│   │   ├── Overlays.jsx         # Guided tour, keyboard shortcuts modal, toasts
│   │   └── ui.jsx               # Reusable primitives (cards, badges, buttons, segmented controls)
│   │
│   └── views/
│       ├── Overview.jsx         # Campus summary, capacity meter, zone sparklines
│       ├── Zones.jsx            # Detailed zone sub-metering & end-use breakdowns
│       ├── Forecast.jsx         # 24-hr predictive forecast & peak mitigation panel
│       ├── Savings.jsx          # Interactive ECM recommendations with rupee impact
│       └── Alerts.jsx           # Hysteresis alert monitor, idle detector, custom rule builder
```

---

## 👥 Contributors & Credits

- **Project**: EnergiQ
- **Event**: TeachPulse Hackathon 2026
- **Team**: Void
- **Institution**: Vellore Institute of Technology (VIT), Chennai

---

## 📄 License

This project is licensed under the **MIT License** — feel free to use, modify, and distribute for academic and commercial smart energy optimization applications.
