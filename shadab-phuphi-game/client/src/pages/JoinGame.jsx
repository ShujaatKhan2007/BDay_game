import { useState } from 'react';
import { useGame } from '../socket/GameContext.jsx';

/** Name + game code form. The code is pre-filled when someone opens a /join/CODE link. */
export default function JoinGame({ initialCode = '', onBack }) {
  const { joinGame, connected } = useGame();
  const [name, setName] = useState('');
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const res = await joinGame(name, code);
    setBusy(false);
    if (!res.ok) setError(res.error);
  }

  return (
    <form className="card form-card" onSubmit={submit}>
      <h2 className="display small">Join the party 🎉</h2>

      <label className="field">
        <span className="field-label">Your name</span>
        <input
          type="text"
          value={name}
          maxLength={24}
          autoComplete="given-name"
          autoFocus={Boolean(initialCode)}
          placeholder="e.g. Rahul"
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <label className="field">
        <span className="field-label">Game code</span>
        <input
          type="text"
          className="code-input"
          value={code}
          maxLength={12}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="PUPPY25"
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        />
      </label>

      {error && <div className="notice error" role="alert">{error}</div>}
      {!connected && <div className="notice">Connecting to the server…</div>}

      <button className="btn teal block" type="submit" disabled={busy || !name.trim() || !code}>
        {busy ? 'JOINING…' : 'JOIN GAME'}
      </button>
      {onBack && (
        <button type="button" className="btn link" onClick={onBack}>← Back</button>
      )}
    </form>
  );
}
