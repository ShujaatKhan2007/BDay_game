import { useEffect, useState } from 'react';
import { useGame, useContent } from '../socket/GameContext.jsx';
import ScorePicker from './ScorePicker.jsx';
import SubmissionView from './SubmissionView.jsx';

/**
 * HOST: evaluate one round.
 * The Host taps a score for each participant, then presses the round's SAVE button.
 * Scores are only ever sent by the Host - the server rejects everybody else.
 */
export default function RoundEvaluation({ round, state }) {
  const { rounds: ROUNDS } = useContent();
  const { emit, pushToast, submissions } = useGame();
  const cfg = ROUNDS[round];
  const max = state.maxScores[round];
  const [draft, setDraft] = useState({}); // unsaved changes: { participantId: score }
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft({}), [round]);

  const valueOf = (p) => (draft[p.id] !== undefined ? draft[p.id] : p.scores[round]);
  const dirtyIds = state.participants.filter((p) => draft[p.id] !== undefined && draft[p.id] !== p.scores[round]).map((p) => p.id);
  const unscored = state.participants.filter((p) => valueOf(p) === null).length;
  const submittedCount = state.participants.filter((p) => p.submitted[round]).length;

  async function save() {
    setSaving(true);
    const scores = Object.fromEntries(dirtyIds.map((id) => [id, draft[id]]));
    const res = await emit('save_scores', { round, scores });
    setSaving(false);
    if (!res.ok) pushToast(res.error, 'error');
    else setDraft({});
  }

  const giveZeroToUnscored = () => {
    const next = { ...draft };
    state.participants.forEach((p) => { if (valueOf(p) === null) next[p.id] = 0; });
    setDraft(next);
  };

  return (
    <section className="eval">
      <div className="eval-head">
        <h3 className="display small">{cfg.icon} Round {round}: {cfg.name}</h3>
        <div className="chips">
          <span className="chip">Max {max} mark{max === 1 ? '' : 's'}</span>
          <span className="chip">{submittedCount}/{state.participants.length} submitted</span>
          <span className={`chip ${unscored ? 'warn' : 'ok'}`}>{unscored ? `${unscored} not scored yet` : 'All scored ✅'}</span>
        </div>
      </div>

      {state.locked && <div className="notice">🔒 The winner reveal has started, so scores are locked.</div>}

      <div className="eval-grid">
        {state.participants.map((p) => {
          const dirty = dirtyIds.includes(p.id);
          return (
            <article key={p.id} className={`card eval-card ${dirty ? 'dirty' : ''}`}>
              <header className="eval-card-head">
                <h4>{p.name}</h4>
                <span className={`status ${p.submitted[round] ? 'sent' : 'not-sent'}`}>
                  {p.submitted[round] ? '🟢 Submitted' : '🟡 Not Submitted'}
                </span>
              </header>

              <div className="eval-body">
                <SubmissionView round={round} submission={submissions[p.id]?.[round]} />
              </div>

              <div className="eval-score">
                <span className="field-label">Score (0–{max})</span>
                <ScorePicker
                  max={max}
                  value={valueOf(p)}
                  disabled={state.locked}
                  onChange={(n) => setDraft((d) => ({ ...d, [p.id]: n }))}
                />
                {valueOf(p) === null && <span className="muted small">Not scored yet</span>}
              </div>
            </article>
          );
        })}
      </div>

      <div className="save-bar">
        {unscored > 0 && !state.locked && (
          <button type="button" className="btn ghost" onClick={giveZeroToUnscored}>Set unscored to 0</button>
        )}
        <button className="btn teal" onClick={save} disabled={saving || state.locked || dirtyIds.length === 0}>
          {saving ? 'SAVING…' : cfg.saveLabel}{dirtyIds.length > 0 ? ` (${dirtyIds.length})` : ''}
        </button>
      </div>
    </section>
  );
}
