import Puppy from '../components/Puppy.jsx';
import { useContent } from '../socket/GameContext.jsx';

/** Participant lobby: waiting for the Host to press START GAME */
export default function PlayerLobby({ state }) {
  const { event } = useContent();
  return (
    <section className="card center-text lobby-card">
      <Puppy size={120} wobble />
      <h2 className="display">🎉 YOU'RE IN!</h2>
      <div className="name-plate">{state.name}</div>
      {event.celebrant && (
        <p className="star-line">
          Birthday challenge for <strong>{event.celebrant}</strong> 🎂
        </p>
      )}
      <p className="big-number">
        Players joined: <strong>{state.playerCount}</strong>
      </p>
      <p className="waiting">
        Waiting for the Host to start the game<span className="dots" aria-hidden="true" />
      </p>
    </section>
  );
}
