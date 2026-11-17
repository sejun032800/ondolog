import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { installWebFeel } from './platform/webFeel'
import { installKeyboardFocus } from './platform/keyboardFocus'
import { installErrorCapture } from './errorLog/errorLog'
installWebFeel(document)
installKeyboardFocus(document)
installErrorCapture(window)
createRoot(document.getElementById('root')!).render(<App />)
