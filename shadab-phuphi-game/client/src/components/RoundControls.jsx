import { useState } from 'react';
import { useGame } from '../socket/GameContext.jsx';
import { ROUNDS } from '../config/gameContent.js';

/**
 * HOST: control the LIVE round (what participants are looking at right now)
 * and see who has submitted.
 */
export default function RoundControls({ state }) {
  const { emit, pushToast } = useGame();
  const [busy, setBusy] = useState(false);
  const { stage, currentRound, roundStatus, participants } = state;

  async function act(event, payload = {}) {
    setBusy(true);
    const res = await emit(event, payload);
    setBusy(false);
    if (!res.ok) pushToast(res.error, 'error');
  }

  /* --- after the rounds: nothing to control except going back --- */
  if (stage !== 'round') {
    const text = {
      results: '🏁 All five rounds are finished. Participants see "The Host is preparing the final results…". Open the 🏆 Leaderboard tab to check scores and start the reveal.',
      reveal: '🏆 The winner reveal is in progress. Rounds are locked.',
      celebration: '🎉 The final celebration is on everybody\'s screen!',
    }[stage];
    return (
      <section className="card controls">
        <p>{text}</p>
        {stage === 'results' && (
          <div className="control-buttons">
            <button className="btn ghost" onClick={() => act('change_round', { direction: 'prev' })} disabled={busy}>◀ PREVIOUS ROUND</button>
          </div>
        )}
      </section>
    );
  }

  const cfg = ROUNDS[currentRound];
  const status = roundStatus[currentRound];
  const sent = participants.filter((p) => p.submitted[currentRound]).length;
  const pct = participants.length ? Math.round((sent / participants.length) * 100) : 0;

  return (
    <section className="card controls">
      <div className="controls-top">
        <div>
          <div className="field-label">CURRENT ROUND</div>
          <h2 className="display small">Round {currentRound} — {cfg.name} {cfg.icon}</h2>
        </div>
        <span className={`live-pill ${status}`}>
          {status === 'pending' && '⏳ Waiting to start'}
          {status === 'open' && '🟢 OPEN'}
          {status === 'closed' && '🔒 CLOSED'}
        </span>
      </div>

      <div className="control-buttons">
        <button className="btn ghost" onClick={() => act('change_round', { direction: 'prev' })} disabled={busy || currentRound === 1}>
          ◀ PREVIOUS ROUND
        </button>

        {status === 'open' ? (
          <button className="btn sun" onClick={() => act('close_round')} disabled={busy}>⏹ CLOSE ROUND</button>
        ) : (
          <button className="btn pink" onClick={() => act('start_round')} disabled={busy}>
            {status === 'closed' ? '🔓 REOPEN ROUND' : '▶ START ROUND'}
          </button>
        )}

        <button className="btn teal" onClick={() => act('change_round', { direction: 'next' })} disabled={busy}>
          {currentRound === 5 ? 'FINISH ROUNDS 🏁' : 'NEXT ROUND ▶'}
        </button>
      </div>

      <div className="progress" aria-label={`${sent} of ${participants.length} submitted`}>
        <div className="progress-bar" style={{ width: `${pct}%` }} />
        <span>{sent} / {participants.length} submitted</span>
      </div>

      <ul className="status-list">
        {participants.map((p) => (
          <li key={p.id} className={p.submitted[currentRound] ? 'sent' : 'not-sent'}>
            <span>{p.name}{!p.connected && <em className="offline"> (offline)</em>}</span>
            <span>{p.submitted[currentRound] ? '🟢 Submitted' : '🟡 Not Submitted'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
