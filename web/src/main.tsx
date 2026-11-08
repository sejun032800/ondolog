import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { installWebFeel } from './platform/webFeel'
installWebFeel(document)
createRoot(document.getElementById('root')!).render(<App />)
