import { useEffect, useState } from 'react';
import Puppy from '../components/Puppy.jsx';
import { burst, sideCannons, stopConfetti } from '../utils/confetti.js';
import { EVENT } from '../config/gameContent.js';

/** After Round 5: leaderboard stays hidden until the Host starts the reveal */
export function ResultsWaiting() {
  return (
    <section className="card center-text lobby-card">
      <Puppy size={120} wobble />
      <h2 className="display">🎉 ALL ROUNDS ARE COMPLETE!</h2>
      <p className="waiting">
        The Host is preparing the final results<span className="dots" aria-hidden="true" />
      </p>
      <div className="drumroll" aria-hidden="true">🥁</div>
    </section>
  );
}

const PLACES = {
  3: { emoji: '🥉', title: 'THIRD PLACE', cls: 'bronze', wait: 1900 },
  2: { emoji: '🥈', title: 'SECOND PLACE', cls: 'silver', wait: 1900 },
  1: { emoji: '🥇', title: 'FIRST PLACE', cls: 'gold', wait: 4000 },
};
const GOLD = ['#ffc82e', '#ffe27a', '#ff4f8b', '#ffffff', '#14c8b4'];

/**
 * One reveal screen (3rd, 2nd or 1st). It is keyed by place in <RevealScreen>,
 * so a fresh animation plays every time the Host reveals the next place:
 *   title appears -> short suspense (a 3-2-1 countdown for 1st place) -> name pops + confetti
 */
function PlaceReveal({ entry, me, maxTotal }) {
  const cfg = PLACES[entry.place];
  const [showName, setShowName] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timers = [];
    if (entry.place === 1) {
      timers.push(setTimeout(() => setCount(3), 900));
      timers.push(setTimeout(() => setCount(2), 1900));
      timers.push(setTimeout(() => setCount(1), 2900));
    }
    timers.push(
      setTimeout(() => {
        setCount(0);
        setShowName(true);
        if (entry.place === 1) sideCannons(5000, GOLD);
        else burst(1);
      }, cfg.wait),
    );
    return () => { timers.forEach(clearTimeout); stopConfetti(); };
  }, [entry.place, cfg.wait]);

  const isMe = entry.name === me;

  return (
    <section className={`card reveal-card ${cfg.cls} ${entry.place === 1 ? 'grand' : ''}`}>
      {entry.place === 1 && <div className="party-row" aria-hidden="true">🎊🎊🎊</div>}
      <div className="medal" aria-hidden="true">{cfg.emoji}</div>
      <h2 className="display reveal-title">{entry.place === 1 ? `${cfg.emoji} ${cfg.title}` : cfg.title}</h2>

      {!showName && (
        <div className="suspense" aria-live="polite">
          {entry.place === 1 && count > 0 ? <span className="countdown" key={count}>{count}</span> : <span className="drumroll">🥁</span>}
          <p className="waiting">And the winner is<span className="dots" aria-hidden="true" /></p>
        </div>
      )}

      {showName && (
        <div className="winner-reveal">
          <div className="winner-name">{entry.name}</div>
          <div className="winner-score">{entry.total} / {maxTotal} points</div>
          {isMe && <div className="that-is-you">That's YOU! 🎉</div>}
        </div>
      )}
    </section>
  );
}

/** Shows the most recently revealed place, plus the earlier ones underneath */
export function RevealScreen({ state }) {
  const shown = state.reveal.shown; // in reveal order: 3rd, then 2nd, then 1st
  if (!shown.length) return <ResultsWaiting />;
  const latest = shown[shown.length - 1];
  const earlier = shown.slice(0, -1);
  const maxTotal = Object.values(state.marksPerRound || {}).reduce((a, b) => a + b, 0);

  return (
    <>
      <PlaceReveal key={latest.place} entry={latest} me={state.name} maxTotal={maxTotal} />
      {earlier.length > 0 && (
        <div className="earlier">
          {earlier.map((e) => (
            <span key={e.place} className="chip">{PLACES[e.place].emoji} {e.name}</span>
          ))}
        </div>
      )}
    </>
  );
}

/** Final celebration: podium + party */
export function Celebration({ state }) {
  const byPlace = Object.fromEntries(state.reveal.shown.map((e) => [e.place, e]));

  useEffect(() => {
    burst(1.2);
    const id = setInterval(() => burst(0.7), 3200);
    return () => { clearInterval(id); stopConfetti(); };
  }, []);

  return (
    <section className="card celebration">
      <Puppy size={150} wobble />
      <h2 className="display big">HAPPY BIRTHDAY!</h2>
      <div className="celebrant">{EVENT.celebrant} 🎂❤️</div>

      <div className="podium" aria-label="Final podium">
        {[2, 1, 3].map((place) =>
          byPlace[place] ? (
            <div key={place} className={`podium-step p${place}`}>
              <div className="podium-name">{byPlace[place].name}</div>
              <div className="podium-block">{PLACES[place].emoji}</div>
            </div>
          ) : null,
        )}
      </div>

      <p className="muted">Thank you for playing! 🥳</p>
    </section>
  );
}
