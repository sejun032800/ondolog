import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { installWebFeel } from './platform/webFeel'
import { installKeyboardFocus } from './platform/keyboardFocus'
installWebFeel(document)
installKeyboardFocus(document)
createRoot(document.getElementById('root')!).render(<App />)
