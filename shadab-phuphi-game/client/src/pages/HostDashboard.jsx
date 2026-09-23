import { useEffect, useState } from 'react';
import { useGame, useContent } from '../socket/GameContext.jsx';
import { ROUND_NUMBERS } from '../config/gameContent.js';
import { copyText } from '../utils/clipboard.js';
import RoundControls from '../components/RoundControls.jsx';
import RoundEvaluation from '../components/RoundEvaluation.jsx';
import Leaderboard from '../components/Leaderboard.jsx';
import TieResolver from '../components/TieResolver.jsx';
import RevealPanel from '../components/RevealPanel.jsx';

/**
 * HOST dashboard (after START GAME):
 *   1. Live round controls + who has submitted
 *   2. Tabs: Round 1..5 (evaluate & score) and 🏆 Leaderboard (ties + winner reveal)
 */
export default function HostDashboard({ state }) {
  const { emit, pushToast } = useGame();
  const { event, rounds: ROUNDS } = useContent();
  const [tab, setTab] = useState(state.stage === 'round' ? state.currentRound : 'board');

  // Follow the live round automatically (you can still click any tab afterwards).
  useEffect(() => {
    setTab(state.stage === 'round' ? state.currentRound : 'board');
  }, [state.stage, state.currentRound]);

  const joinUrl = `${window.location.origin}/join/${state.code}`;
  const offline = state.participants.filter((p) => !p.connected).length;

  async function copyLink() {
    const ok = await copyText(joinUrl);
    pushToast(ok ? 'Link copied 📋' : 'Could not copy the link', ok ? 'success' : 'error');
  }

  async function restart() {
    if (!window.confirm('Play again? Everyone stays in the game, but ALL answers and scores are cleared. You can then choose whose birthday challenge to play next.')) return;
    const res = await emit('reset_game');
    if (!res.ok) pushToast(res.error, 'error');
  }

  const allScored = (r) => state.participants.length > 0 && state.participants.every((p) => p.scores[r] !== null);
  const missingScores = state.participants.reduce(
    (sum, p) => sum + ROUND_NUMBERS.filter((r) => p.scores[r] === null).length, 0);

  return (
    <main className="screen">
      <div className="wrap wide">
        <header className="host-top">
          <div className="host-title">🎂 {event.title} <span className="chip dark">Host</span></div>
          <div className="chips">
            <button className="chip button" onClick={copyLink} title="Copy join link">🔗 {state.code}</button>
            <span className="chip">👥 {state.participants.length}{offline ? ` (${offline} offline)` : ''}</span>
            <button className="chip button" onClick={restart}>🔄 Play again</button>
          </div>
        </header>

        <RoundControls state={state} />

        <nav className="tabs" aria-label="Rounds">
          {ROUND_NUMBERS.map((r) => (
            <button
              key={r}
              className={`tab ${tab === r ? 'on' : ''}`}
              onClick={() => setTab(r)}
              aria-current={tab === r}
            >
              <span>{ROUNDS[r].icon} R{r}</span>
              {state.stage === 'round' && state.currentRound === r && <small className="live-dot">LIVE</small>}
              {allScored(r) && <small className="tick">✅</small>}
            </button>
          ))}
          <button className={`tab board-tab ${tab === 'board' ? 'on' : ''}`} onClick={() => setTab('board')}>
            🏆 Leaderboard
          </button>
        </nav>

        {tab === 'board' ? (
          <div className="stack big-gap">
            <section className="card board-card">
              <div className="board-head">
                <h2 className="display">🏆 FINAL LEADERBOARD</h2>
                <span className="chip dark">🔒 Hidden from participants</span>
              </div>
              {missingScores > 0 && !state.locked && (
                <div className="notice">
                  {missingScores} score{missingScores === 1 ? ' is' : 's are'} still missing. Missing scores count as 0 - use the round tabs to finish scoring.
                </div>
              )}
              <Leaderboard state={state} />
            </section>

            <TieResolver state={state} />
            <RevealPanel state={state} />
          </div>
        ) : (
          <RoundEvaluation round={tab} state={state} />
        )}
      </div>
    </main>
  );
}
