import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import { AppProvider } from './context/AppContext'
import App from './App'
// Self-hosted fonts (no Google Fonts request; files are bundled and cached)
import '@fontsource-variable/nunito'
import '@fontsource/poppins/latin-500.css'
import '@fontsource/poppins/latin-600.css'
import '@fontsource/poppins/latin-700.css'
import '@fontsource/poppins/latin-800.css'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        {/* respect the OS "reduce motion" setting for all Motion animations */}
        <MotionConfig reducedMotion="user">
          <App />
        </MotionConfig>
      </AppProvider>
    </BrowserRouter>
  </StrictMode>,
)
