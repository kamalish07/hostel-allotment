import { Component, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { ToastProvider } from './components/ui.jsx';
import { resetDemo } from './lib/store.js';
import './styles.css';

// If a page crashes, show what happened and a way out instead of a blank screen.
class Safety extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error(error); }
  render() {
    if (!this.state.error) return this.props.children;
    const restart = (reset) => { if (reset) resetDemo(); window.location.hash = ''; this.setState({ error: null }); };
    return (
      <div className="crash">
        <h1>Something went wrong on this page</h1>
        <p className="muted">{String(this.state.error.message || this.state.error)}</p>
        <div className="row gap-s wrap">
          <button type="button" className="btn primary" onClick={() => restart(false)}>Back to sign-in</button>
          <button type="button" className="btn light" onClick={() => restart(true)}>Reset demo data</button>
        </div>
      </div>
    );
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <Safety>
        <App />
      </Safety>
    </ToastProvider>
  </StrictMode>,
);
