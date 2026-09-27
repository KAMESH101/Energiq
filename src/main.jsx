import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-800.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-600.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import './index.css';
import App from './App.jsx';

if (import.meta.env.DEV) {
  // Console access to the engines while developing
  Promise.all([import('./lib/data.js'), import('./lib/forecast.js'), import('./lib/model.js'), import('./lib/campus.js')])
    .then(([data, forecast, model, campus]) => { window.EnergiQ = { ...campus, ...data, ...forecast, ...model }; });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
