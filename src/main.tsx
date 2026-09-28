import './services/monacoSetup';
import './styles.css';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/Common/ErrorBoundary';

createRoot(document.getElementById('root') as HTMLElement).render(<ErrorBoundary><App /></ErrorBoundary>);
