import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './styles.css'
import './workspace.css'
import '@fontsource-variable/inter'
import '@fontsource-variable/dm-sans'
import { TooltipProvider } from './components/primitives/tooltip'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TooltipProvider>
      <App />
    </TooltipProvider>
  </React.StrictMode>,
)
