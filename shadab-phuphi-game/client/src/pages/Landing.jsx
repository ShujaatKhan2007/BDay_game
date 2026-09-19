import { useState } from 'react';
import { useGame } from '../socket/GameContext.jsx';
import { EVENT } from '../config/gameContent.js';
import Puppy from '../components/Puppy.jsx';
import JoinGame from './JoinGame.jsx';

/** If the page was opened as /join/PUPPY25 return "PUPPY25" */
function codeFromUrl() {
  const m = window.location.pathname.match(/^\/join\/([A-Za-z0-9]+)/);
  return m ? m[1].toUpperCase() : '';
}

export default function Landing() {
  const { createGame, resumeHost, lastHost, connected, pushToast } = useGame();
  const urlCode = codeFromUrl();
  const [view, setView] = useState(urlCode ? 'join' : 'home');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    setBusy(true);
    setError('');
    const res = await createGame();
    setBusy(false);
    if (!res.ok) setError(res.error);
  }

  async function handleResume() {
    setBusy(true);
    const res = await resumeHost();
    setBusy(false);
    if (!res.ok) pushToast(res.error || 'That game is no longer available.', 'error');
  }

  return (
    <main className="screen center">
      <div className="wrap narrow">
        <section className="marquee hero">
          <Puppy size={150} wobble />
          <h1 className="hero-title">
            <span>🎂 {EVENT.title.split(' ')[0]}</span>
            <span>{EVENT.title.split(' ')[1]}</span>
          </h1>
          <div className="ribbon">{EVENT.subtitle}</div>
        </section>

        {view === 'home' && (
          <div className="stack big-gap">
            <button className="btn pink xl block" onClick={handleCreate} disabled={busy}>
              🎤 CREATE GAME
            </button>
            <button className="btn teal xl block" onClick={() => setView('join')} disabled={busy}>
              🎮 JOIN GAME
            </button>
            {error && <div className="notice error" role="alert">{error}</div>}
            {!connected && <div className="notice light">Connecting to the server…</div>}

            {lastHost && (
              <button className="btn ghost-light block" onClick={handleResume} disabled={busy}>
                ↩ Resume hosting game {lastHost.code}
              </button>
            )}
          </div>
        )}

        {view === 'join' && (
          <JoinGame initialCode={urlCode} onBack={urlCode ? null : () => setView('home')} />
        )}
      </div>
    </main>
  );
}
