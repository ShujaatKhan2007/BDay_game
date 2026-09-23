import { useGame } from '../socket/GameContext.jsx';
import Puppy from './Puppy.jsx';

/** Shown while the app connects to the server / rejoins a game */
export default function Splash({ message = 'Getting the party ready…' }) {
  const { connected } = useGame();
  return (
    <main className="screen center">
      <div className="wrap narrow center-text">
        <Puppy size={120} wobble />
        <h2 className="display small">{message}</h2>
        {!connected && (
          <p className="muted-light">
            Connecting to the party server… Free servers can take up to a minute to wake up, please wait.
          </p>
        )}
      </div>
    </main>
  );
}
