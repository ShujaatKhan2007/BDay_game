import { useGame, useContent } from '../socket/GameContext.jsx';
import RoundForm, { RoundHeader } from '../components/RoundForms.jsx';

/**
 * What a participant sees during a round:
 *   pending          -> "Get ready" card (Host has not pressed START ROUND)
 *   open, not sent   -> the round's form
 *   already sent     -> "submitted" confirmation
 *   closed, not sent -> the form stays visible but locked (drafts are not lost if the Host re-opens)
 */
export default function PlayerRound({ state }) {
  const { rounds: ROUNDS } = useContent();
  const { resetCount } = useGame();
  const round = state.currentRound;
  const cfg = ROUNDS[round];
  const maxScore = state.marksPerRound?.[round];
  const submitted = state.submittedRounds[round];

  if (state.roundStatus === 'pending') {
    return (
      <section className="card center-text intro-card" key={`intro-${round}`}>
        <RoundHeader round={round} maxScore={maxScore} />
        <p className="waiting">
          Get ready! The Host will start this round soon<span className="dots" aria-hidden="true" />
        </p>
      </section>
    );
  }

  if (submitted) {
    return (
      <section className="card center-text done-card" key={`done-${round}`}>
        <div className="done-emoji" aria-hidden="true">{cfg.icon}</div>
        <h2 className="display">{cfg.doneMessage}</h2>
        <p className="waiting">
          Waiting for the Host to move on<span className="dots" aria-hidden="true" />
        </p>
      </section>
    );
  }

  // key = round + resetCount: a fresh, empty form for every round (and after "play again")
  return (
    <RoundForm
      key={`${round}-${resetCount}`}
      round={round}
      maxScore={maxScore}
      locked={state.roundStatus === 'closed'}
    />
  );
}
