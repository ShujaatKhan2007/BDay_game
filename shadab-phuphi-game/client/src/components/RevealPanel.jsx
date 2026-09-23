import { useState } from 'react';
import { useGame } from '../socket/GameContext.jsx';

const PLACES = [
  { place: 3, event: 'reveal_3rd', label: '🥉 REVEAL 3RD PLACE', word: '3rd', cls: 'bronze' },
  { place: 2, event: 'reveal_2nd', label: '🥈 REVEAL 2ND PLACE', word: '2nd', cls: 'silver' },
  { place: 1, event: 'reveal_1st', label: '🥇 REVEAL 1ST PLACE', word: '1st', cls: 'gold' },
];

/** HOST: reveal 3rd -> 2nd -> 1st, one tap at a time. Participants only see what is revealed. */
export default function RevealPanel({ state }) {
  const { emit, pushToast } = useGame();
  const [busy, setBusy] = useState(false);
  const n = state.ranking.length;
  const nameAt = (place) => state.ranking[place - 1]?.name;
  const stageReady = state.stage === 'results' || state.stage === 'reveal';

  /** Why is this button disabled (if it is)? */
  function blockReason(place) {
    if (state.revealed[place]) return 'Revealed ✅';
    if (place > n) return `Needs at least ${place} players`;
    if (!stageReady) return 'Press "FINISH ROUNDS" after Round 5 first';
    if (state.revealBlocked && !state.locked) return 'Resolve the tie first';
    for (let p = 3; p > place; p--) {
      if (p <= n && !state.revealed[p]) return `Reveal ${p === 3 ? '3rd' : '2nd'} place first`;
    }
    return '';
  }

  async function act(event) {
    setBusy(true);
    const res = await emit(event);
    setBusy(false);
    if (!res.ok) pushToast(res.error, 'error');
  }

  const showCelebration = () => act('show_celebration');

  return (
    <section className="card reveal-panel">
      <h3 className="display small">🏆 WINNER REVEAL</h3>
      <p className="muted">
        Participants see nothing until you press a button. Reveal in order: 3rd → 2nd → 1st.
      </p>

      <div className="reveal-buttons">
        {PLACES.map(({ place, event, label, cls }) => {
          const reason = blockReason(place);
          return (
            <div key={place} className="reveal-item">
              <button className={`btn xl ${cls}`} disabled={busy || Boolean(reason)} onClick={() => act(event)}>
                {label}
              </button>
              <div className="reveal-note">
                {state.revealed[place]
                  ? <>Shown: <strong>{nameAt(place)}</strong></>
                  : reason
                    ? <span className="muted">{reason}</span>
                    : <span className="muted">Will reveal: <strong>{nameAt(place)}</strong></span>}
              </div>
            </div>
          );
        })}
      </div>

      {state.revealed[1] && state.stage === 'reveal' && (
        <button className="btn pink xl block" onClick={showCelebration} disabled={busy}>
          🎉 SHOW BIRTHDAY CELEBRATION
        </button>
      )}
      {state.stage === 'celebration' && (
        <div className="notice ok">🎉 The celebration screen is live on every phone!</div>
      )}
    </section>
  );
}
