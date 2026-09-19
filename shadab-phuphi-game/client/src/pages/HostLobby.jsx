import { useState } from 'react';
import { useGame } from '../socket/GameContext.jsx';
import { EVENT } from '../config/gameContent.js';
import { copyText } from '../utils/clipboard.js';
import Puppy from '../components/Puppy.jsx';

/** HOST lobby: game code, share link, live list of participants, START GAME */
export default function HostLobby({ state }) {
  const { emit, pushToast, leaveGame } = useGame();
  const [busy, setBusy] = useState(false);

  // The link works on whatever address this app is hosted at.
  const joinUrl = `${window.location.origin}/join/${state.code}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(
    `🎂 Join the ${EVENT.title} ${EVENT.subtitle}!\nGame code: ${state.code}\n${joinUrl}`,
  )}`;

  async function copyLink() {
    const ok = await copyText(joinUrl);
    pushToast(ok ? 'Link copied! Paste it in WhatsApp 📋' : 'Could not copy. Long-press the link to copy it.', ok ? 'success' : 'error');
  }

  async function start() {
    setBusy(true);
    const res = await emit('start_game');
    setBusy(false);
    if (!res.ok) pushToast(res.error, 'error');
  }

  return (
    <main className="screen">
      <div className="wrap">
        <section className="marquee hero compact">
          <Puppy size={96} wobble />
          <h1 className="hero-title small">🎂 {EVENT.title} {EVENT.subtitle}</h1>
        </section>

        <div className="lobby-grid">
          <section className="card share-card">
            <div className="field-label">GAME CODE</div>
            <div className="code-plate" aria-label={`Game code ${state.code}`}>{state.code}</div>

            <div className="field-label">JOIN LINK</div>
            <div className="link-box">{joinUrl}</div>
            <div className="share-buttons">
              <button className="btn sun" onClick={copyLink}>📋 COPY LINK</button>
              <a className="btn teal" href={whatsapp} target="_blank" rel="noreferrer">💬 WHATSAPP</a>
            </div>
            <p className="muted small">
              Friends can also open the site, tap “Join game” and type the code.
            </p>
          </section>

          <section className="card people-card">
            <div className="people-head">
              <h2 className="display small">Participants: {state.participants.length}</h2>
            </div>

            {state.participants.length === 0 ? (
              <p className="waiting">Waiting for people to join<span className="dots" aria-hidden="true" /></p>
            ) : (
              <ul className="people-list">
                {state.participants.map((p) => (
                  <li key={p.id} className="person">
                    <span aria-hidden="true">{p.connected ? '🟢' : '⚪'}</span> {p.name}
                    {!p.connected && <em className="offline"> (offline)</em>}
                  </li>
                ))}
              </ul>
            )}

            <button className="btn pink xl block" onClick={start} disabled={busy || state.participants.length === 0}>
              START GAME 🚀
            </button>
          </section>
        </div>

        <button className="btn link light" onClick={leaveGame}>Leave this screen (you can resume from the start page)</button>
      </div>
    </main>
  );
}
