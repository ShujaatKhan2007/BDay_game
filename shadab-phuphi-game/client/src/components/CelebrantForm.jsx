import { useEffect, useState } from 'react';
import { useGame } from '../socket/GameContext.jsx';
import { PRONOUNS, getContent } from '../config/gameContent.js';

const tidy = (s) => s.trim().replace(/\s+/g, ' ');

/**
 * HOST (lobby): "Whose birthday is it?"
 * The Host types any name, an optional short name (used in the Round 3
 * situations) and picks she / he / they. After SAVE, every participant's
 * screen updates and all five rounds use these details.
 *
 * onStatus(true|false) tells the lobby whether what's on screen is saved,
 * so START GAME can be blocked while there are unsaved changes.
 */
export default function CelebrantForm({ celebrant, onStatus }) {
  const { emit } = useGame();
  const [name, setName] = useState(celebrant?.name || '');
  const [short, setShort] = useState(celebrant?.shortName || '');
  const [pronoun, setPronoun] = useState(celebrant?.pronoun || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const saved =
    Boolean(celebrant) &&
    celebrant.name === tidy(name) &&
    (celebrant.shortName || '') === tidy(short) &&
    celebrant.pronoun === pronoun;
  const complete = Boolean(tidy(name)) && Boolean(pronoun);

  useEffect(() => { onStatus?.(saved); }, [saved, onStatus]);

  // A live preview of how the questions will read
  const preview = complete ? getContent({ name: tidy(name), shortName: tidy(short), pronoun }) : null;

  async function save(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const res = await emit('set_celebrant', { name, shortName: short, pronoun });
    setBusy(false);
    if (!res.ok) setError(res.error);
  }

  return (
    <form className="card star-card" onSubmit={save}>
      <h2 className="display small">Whose birthday is it? 🎂</h2>

      <label className="field">
        <span className="field-label">Name</span>
        <input
          type="text"
          name="celebrantName"
          value={name}
          maxLength={40}
          autoComplete="off"
          placeholder="e.g. Shadab Phuphi"
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <label className="field">
        <span className="field-label">Short name <em className="optional">(optional, used in Round 3)</em></span>
        <input
          type="text"
          name="celebrantShort"
          value={short}
          maxLength={24}
          autoComplete="off"
          placeholder="e.g. Phuphi"
          onChange={(e) => setShort(e.target.value)}
        />
      </label>

      <div className="field">
        <span className="field-label">How should the questions refer to them?</span>
        <div className="pronoun-row" role="radiogroup" aria-label="Pronoun">
          {Object.entries(PRONOUNS).map(([key, p]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={pronoun === key}
              className={`pronoun-btn ${pronoun === key ? 'on' : ''}`}
              onClick={() => setPronoun(key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {preview && (
        <div className="preview" aria-label="Preview of the questions">
          <div className="field-label">Preview</div>
          <ul>
            <li>{preview.rounds[1].questions[1]}</li>
            <li>{preview.rounds[3].situations[0].text}</li>
            <li>{preview.rounds[4].name}</li>
          </ul>
        </div>
      )}

      {error && <div className="notice error" role="alert">{error}</div>}

      <button className="btn teal block" type="submit" disabled={busy || !complete || saved}>
        {busy ? 'SAVING…' : saved ? '✅ SAVED' : 'SAVE'}
      </button>
    </form>
  );
}
