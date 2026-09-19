import Puppy from '../components/Puppy.jsx';

/** Participant lobby: waiting for the Host to press START GAME */
export default function PlayerLobby({ state }) {
  return (
    <section className="card center-text lobby-card">
      <Puppy size={120} wobble />
      <h2 className="display">🎉 YOU'RE IN!</h2>
      <div className="name-plate">{state.name}</div>
      <p className="big-number">
        Players joined: <strong>{state.playerCount}</strong>
      </p>
      <p className="waiting">
        Waiting for the Host to start the game<span className="dots" aria-hidden="true" />
      </p>
    </section>
  );
}
