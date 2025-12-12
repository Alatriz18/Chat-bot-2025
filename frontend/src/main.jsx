import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'


console.log("URL ACTUAL:", window.location.href);
 alert("¡Alto! Mira la barra de direcciones ahora mismo. ¿Ves el token?");
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
