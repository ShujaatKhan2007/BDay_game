import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { socket } from './socket';
import { getContent } from '../config/gameContent.js';

/**
 * GAME CONTEXT
 * ------------
 * One place that owns the socket connection state for the whole app:
 *
 *   session      who am I?  { role:'host', code, hostToken }  or
 *                           { role:'player', code, participantId, token, name }
 *   state        the latest "game_state" the server sent me (host or player view)
 *   submissions  (Host only) what participants submitted, incl. doodles
 *
 * Sessions are kept in sessionStorage (one per browser TAB), so you can test
 * many participants in many tabs of the same browser. After a refresh or a
 * dropped connection the tab silently rejoins the game using its secret token.
 */

const GameContext = createContext(null);
export const useGame = () => useContext(GameContext);

/**
 * The questions/titles for whichever birthday star the Host selected.
 * (Before a game exists it falls back to the first person.)
 */
export const useContent = () => {
  const { state } = useGame();
  return getContent(state?.celebrant, state?.customContent);
};

const SESSION_KEY = 'spbc_session'; // per tab
const LAST_HOST_KEY = 'spbc_last_host'; // remembered so a Host who closed the tab can resume

const readJSON = (storage, key) => {
  try { return JSON.parse(storage.getItem(key)); } catch { return null; }
};
const writeJSON = (storage, key, value) => {
  try {
    if (value == null) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(value));
  } catch { /* storage can be blocked in private mode - the game still works */ }
};

export function GameProvider({ children }) {
  const [session, setSession] = useState(() => readJSON(sessionStorage, SESSION_KEY));
  const sessionRef = useRef(session);
  const [connected, setConnected] = useState(socket.connected);
  const [booting, setBooting] = useState(Boolean(session)); // true while we try to rejoin
  const [state, setState] = useState(null);
  const [submissions, setSubmissions] = useState({});
  const [resetCount, setResetCount] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [lastHost, setLastHost] = useState(() => readJSON(localStorage, LAST_HOST_KEY));

  const applySession = useCallback((s) => {
    sessionRef.current = s;
    setSession(s);
    writeJSON(sessionStorage, SESSION_KEY, s);
  }, []);

  const pushToast = useCallback((text, type = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-2), { id, text, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  /** Send an event and wait for the server's answer: resolves to { ok, error?, ... } */
  const emit = useCallback(
    (event, payload = {}, timeoutMs = 10000) =>
      new Promise((resolve) => {
        socket.timeout(timeoutMs).emit(event, payload, (err, res) => {
          resolve(err ? { ok: false, error: 'No response from the server. Check your internet and try again.' } : res);
        });
      }),
    [],
  );

  const forgetGame = useCallback(() => {
    if (sessionRef.current?.role === 'host') {
      writeJSON(localStorage, LAST_HOST_KEY, null);
      setLastHost(null);
    }
    applySession(null);
    setState(null);
    setSubmissions({});
  }, [applySession]);

  /* ---------- socket listeners (set up once) ---------- */
  useEffect(() => {
    // Every time we (re)connect, prove who we are again so the server restores our seat.
    async function rejoin() {
      const s = sessionRef.current;
      if (!s) { setBooting(false); return; }
      const res =
        s.role === 'host'
          ? await emit('rejoin_host', { code: s.code, hostToken: s.hostToken })
          : await emit('rejoin_participant', { code: s.code, participantId: s.participantId, token: s.token });
      if (!res.ok && res.fatal) {
        // The game is gone (server restarted?) or our token is invalid.
        forgetGame();
        pushToast(res.error, 'error');
      }
      setBooting(false);
    }

    const onConnect = () => { setConnected(true); rejoin(); };
    const onDisconnect = () => setConnected(false);
    const onState = (s) => setState(s);
    const onHostSubmissions = (all) => setSubmissions(all || {});
    const onSubmission = ({ participantId, round, submission }) =>
      setSubmissions((prev) => ({ ...prev, [participantId]: { ...(prev[participantId] || {}), [round]: submission } }));
    const onJoined = ({ name, reclaimed }) => {
      if (sessionRef.current?.role === 'host') pushToast(reclaimed ? `${name} is back 👋` : `${name} joined 🎉`, 'success');
    };
    const onScoreUpdated = ({ round }) => pushToast(`Round ${round} scores saved ✅`, 'success');
    const onReset = () => {
      setResetCount((c) => c + 1);
      setSubmissions({});
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('game_state', onState);
    socket.on('host_submissions', onHostSubmissions);
    socket.on('submission_received', onSubmission);
    socket.on('participant_joined', onJoined);
    socket.on('score_updated', onScoreUpdated);
    socket.on('game_reset', onReset);
    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('game_state', onState);
      socket.off('host_submissions', onHostSubmissions);
      socket.off('submission_received', onSubmission);
      socket.off('participant_joined', onJoined);
      socket.off('score_updated', onScoreUpdated);
      socket.off('game_reset', onReset);
    };
  }, [emit, forgetGame, pushToast]);

  /* ---------- actions used by the pages ---------- */

  const createGame = useCallback(async () => {
    const res = await emit('create_game');
    if (res.ok) {
      const s = { role: 'host', code: res.code, hostToken: res.hostToken };
      writeJSON(localStorage, LAST_HOST_KEY, s);
      setLastHost(s);
      applySession(s);
    }
    return res;
  }, [emit, applySession]);

  const joinGame = useCallback(
    async (name, code) => {
      const res = await emit('join_game', { name, code });
      if (res.ok) {
        applySession({ role: 'player', code: res.code, participantId: res.participantId, token: res.token, name: res.name });
      }
      return res;
    },
    [emit, applySession],
  );

  /** Host closed the tab earlier? This picks the game back up. */
  const resumeHost = useCallback(async () => {
    const s = readJSON(localStorage, LAST_HOST_KEY);
    if (!s) return { ok: false, error: 'Nothing to resume.' };
    const res = await emit('rejoin_host', { code: s.code, hostToken: s.hostToken });
    if (res.ok) applySession(s);
    else {
      writeJSON(localStorage, LAST_HOST_KEY, null);
      setLastHost(null);
    }
    return res;
  }, [emit, applySession]);

  /** Go back to the start screen (the Host can resume later from there). */
  const leaveGame = useCallback(() => {
    if (sessionRef.current?.role === 'player') socket.emit('leave_game', {});
    applySession(null);
    setState(null);
    setSubmissions({});
    window.history.replaceState(null, '', '/');
  }, [applySession]);

  const value = useMemo(
    () => ({
      connected, booting, session, state, submissions, resetCount, toasts, lastHost,
      emit, pushToast, createGame, joinGame, resumeHost, leaveGame,
    }),
    [connected, booting, session, state, submissions, resetCount, toasts, lastHost, emit, pushToast, createGame, joinGame, resumeHost, leaveGame],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
