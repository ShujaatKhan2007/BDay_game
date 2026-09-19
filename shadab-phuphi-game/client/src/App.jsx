import { useGame } from './socket/GameContext.jsx';
import Balloons from './components/Balloons.jsx';
import Toasts from './components/Toasts.jsx';
import Splash from './components/Splash.jsx';
import Landing from './pages/Landing.jsx';
import HostLobby from './pages/HostLobby.jsx';
import HostDashboard from './pages/HostDashboard.jsx';
import PlayerApp from './pages/PlayerApp.jsx';

/**
 * The whole app is a function of two things:
 *   session (who am I?)  and  state (what the server says the game looks like)
 * No page reloads are ever needed - the server pushes every change.
 */
export default function App() {
  const { session, state, booting, connected } = useGame();

  let screen;
  if (booting) screen = <Splash message="Rejoining the party…" />;
  else if (!session) screen = <Landing />;
  else if (!state) screen = <Splash />;
  else if (session.role === 'host') screen = state.stage === 'lobby' ? <HostLobby state={state} /> : <HostDashboard state={state} />;
  else screen = <PlayerApp state={state} />;

  const hostAway = session?.role === 'player' && state && state.hostConnected === false;

  return (
    <>
      <Balloons />
      {!connected && session && state && <div className="banner error" role="alert">📡 Connection lost. Reconnecting…</div>}
      {connected && hostAway && (
        <div className="banner warn" role="status">The Host has temporarily disconnected. Please wait...</div>
      )}
      {screen}
      <Toasts />
    </>
  );
}
