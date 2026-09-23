import PlayerLobby from './PlayerLobby.jsx';
import PlayerRound from './PlayerRound.jsx';
import { ResultsWaiting, RevealScreen, Celebration } from './PlayerFinale.jsx';
import { useContent } from '../socket/GameContext.jsx';

/** Picks the participant screen from the game stage the server reports */
export default function PlayerApp({ state }) {
  const { event } = useContent();
  let screen;
  switch (state.stage) {
    case 'lobby': screen = <PlayerLobby state={state} />; break;
    case 'round': screen = <PlayerRound state={state} />; break;
    case 'results': screen = <ResultsWaiting />; break;
    case 'reveal': screen = <RevealScreen state={state} />; break;
    case 'celebration': screen = <Celebration state={state} />; break;
    default: screen = null;
  }

  return (
    <main className="screen">
      <div className="wrap narrow">
        <div className="player-bar">
          <span>🎂 {event.title}</span>
          <span className="chip dark">{state.name}</span>
        </div>
        {screen}
      </div>
    </main>
  );
}
