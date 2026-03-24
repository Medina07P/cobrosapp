import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// --- INYECCIÓN DE ESTILOS GLOBALES ---
const style = document.createElement('style');
style.innerHTML = `
  :root {
    /* Color por defecto inicial (Indigo) */
    --color-primario: #4f46e5; 
    --color-primario-glow: rgba(79, 70, 229, 0.2);
  }

  /* Clases de utilidad para usar en tus vistas */
  .bg-brand { background-color: var(--color-primario) !important; }
  .text-brand { color: var(--color-primario) !important; }
  .border-brand { border-color: var(--color-primario) !important; }
  
  /* Efecto hover suave usando la variable */
  .hover-brand:hover { 
    filter: brightness(1.1);
    box-shadow: 0 4px 12px var(--color-primario-glow);
  }
`;
document.head.appendChild(style);
// -------------------------------------

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)