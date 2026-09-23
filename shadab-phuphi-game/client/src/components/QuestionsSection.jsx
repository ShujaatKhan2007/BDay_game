import { useEffect, useState } from 'react';
import { useGame } from '../socket/GameContext.jsx';
import { LIMITS, DEFAULT_EMOJIS, ROUND_NUMBERS, getContent } from '../config/gameContent.js';

/**
 * HOST (lobby): edit the questions for any round, or add your own.
 * Nothing is sent to the server until "SAVE ROUND N QUESTIONS" is pressed;
 * "USE DEFAULT QUESTIONS" clears any custom version for that round.
 * Every participant's screen updates the moment you save.
 */

const emptySituation = () => ({ text: '', emojis: [...DEFAULT_EMOJIS] });

/** Turn what the round is showing right now into the editable shape */
function draftFor(round, roundContent) {
  if (round === 1) return { questions: [...roundContent.questions] };
  if (round === 3) return { situations: roundContent.situations.map((s) => ({ text: s.text, emojis: [...s.emojis] })) };
  return { prompt: roundContent.prompt };
}

function QuestionsEditor({ round, roundContent, isCustom, onSaved }) {
  const { emit, pushToast } = useGame();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => draftFor(round, roundContent));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Reset the editor whenever it's (re)opened, so it always starts from what's live.
  useEffect(() => { if (open) setDraft(draftFor(round, roundContent)); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setError('');
    setBusy(true);
    const res = await emit('set_questions', { round, content: draft });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    onSaved?.(`Round ${round} questions saved ✅`);
    setOpen(false);
  }

  async function useDefault() {
    setBusy(true);
    const res = await emit('set_questions', { round, content: null });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    onSaved?.(`Round ${round} is back to the default questions`);
    setOpen(false);
  }

  return (
    <div className="q-editor">
      <button type="button" className="q-toggle" onClick={() => setOpen((v) => !v)}>
        <span>{roundContent.icon} Round {round}: {roundContent.name}</span>
        <span className="q-toggle-right">
          {isCustom && <span className="chip warn tiny">edited</span>}
          <span aria-hidden="true">{open ? '▲' : '▼'}</span>
        </span>
      </button>

      {open && (
        <div className="q-body">
          {round === 1 && <QAEditor draft={draft} setDraft={setDraft} />}
          {round === 3 && <SituationsEditor draft={draft} setDraft={setDraft} />}
          {(round === 2 || round === 4 || round === 5) && <PromptEditor draft={draft} setDraft={setDraft} />}

          {error && <div className="notice error" role="alert">{error}</div>}

          <div className="q-actions">
            {isCustom && (
              <button type="button" className="btn ghost" onClick={useDefault} disabled={busy}>↩ USE DEFAULT QUESTIONS</button>
            )}
            <button type="button" className="btn teal" onClick={save} disabled={busy}>
              {busy ? 'SAVING…' : `SAVE ROUND ${round} QUESTIONS`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function QAEditor({ draft, setDraft }) {
  const set = (i, v) => setDraft((d) => ({ questions: d.questions.map((q, k) => (k === i ? v : q)) }));
  const add = () => setDraft((d) => ({ questions: [...d.questions, ''] }));
  const remove = (i) => setDraft((d) => ({ questions: d.questions.filter((_, k) => k !== i) }));

  return (
    <div className="stack">
      {draft.questions.map((q, i) => (
        <div key={i} className="q-row">
          <input
            type="text"
            value={q}
            maxLength={LIMITS.question}
            placeholder={`Question ${i + 1}`}
            onChange={(e) => set(i, e.target.value)}
          />
          <button type="button" className="icon-btn danger" onClick={() => remove(i)} disabled={draft.questions.length <= 1} aria-label={`Remove question ${i + 1}`}>✕</button>
        </div>
      ))}
      <button type="button" className="btn ghost" onClick={add} disabled={draft.questions.length >= LIMITS.maxQuestions}>
        + ADD QUESTION
      </button>
    </div>
  );
}

function PromptEditor({ draft, setDraft }) {
  return (
    <textarea
      value={draft.prompt}
      rows={3}
      maxLength={LIMITS.prompt}
      placeholder="Write the prompt participants will see"
      onChange={(e) => setDraft({ prompt: e.target.value })}
    />
  );
}

function SituationsEditor({ draft, setDraft }) {
  const update = (i, patch) => setDraft((d) => ({ situations: d.situations.map((s, k) => (k === i ? { ...s, ...patch } : s)) }));
  const add = () => setDraft((d) => ({ situations: [...d.situations, emptySituation()] }));
  const remove = (i) => setDraft((d) => ({ situations: d.situations.filter((_, k) => k !== i) }));
  const toggleEmoji = (i, emoji) => {
    const cur = draft.situations[i].emojis;
    const next = cur.includes(emoji) ? cur.filter((e) => e !== emoji) : [...cur, emoji];
    update(i, { emojis: next });
  };

  return (
    <div className="stack big-gap">
      {draft.situations.map((s, i) => (
        <div key={i} className="q-situation">
          <div className="q-row">
            <input
              type="text"
              value={s.text}
              maxLength={LIMITS.question}
              placeholder={`Situation ${i + 1}`}
              onChange={(e) => update(i, { text: e.target.value })}
            />
            <button type="button" className="icon-btn danger" onClick={() => remove(i)} disabled={draft.situations.length <= 1} aria-label={`Remove situation ${i + 1}`}>✕</button>
          </div>
          <div className="emoji-edit-row">
            {DEFAULT_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={`emoji-btn small ${s.emojis.includes(emoji) ? 'on' : ''}`}
                onClick={() => toggleEmoji(i, emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
          <p className="muted small">Participants can always type a custom reaction too.</p>
        </div>
      ))}
      <button type="button" className="btn ghost" onClick={add} disabled={draft.situations.length >= LIMITS.maxSituations}>
        + ADD SITUATION
      </button>
    </div>
  );
}

export default function QuestionsSection({ celebrant, customContent }) {
  const { pushToast } = useGame();
  const [expanded, setExpanded] = useState(false);
  const content = getContent(celebrant, customContent);
  const customCount = Object.keys(customContent || {}).length;

  return (
    <section className="card">
      <button type="button" className="q-section-toggle" onClick={() => setExpanded((v) => !v)}>
        <span className="display small">✏️ Edit questions {customCount > 0 && <span className="chip warn tiny">{customCount} edited</span>}</span>
        <span aria-hidden="true">{expanded ? '▲' : '▼'}</span>
      </button>
      {!expanded && (
        <p className="muted small">
          Default questions are used unless you edit a round here. Everyone sees your changes instantly.
        </p>
      )}
      {expanded && (
        <div className="stack">
          <p className="muted small">
            Edit any round below, or add extra questions/situations. Leave a round alone to use the default.
          </p>
          {ROUND_NUMBERS.map((r) => (
            <QuestionsEditor
              key={r}
              round={r}
              roundContent={content.rounds[r]}
              isCustom={Boolean(customContent?.[r])}
              onSaved={(msg) => pushToast(msg, 'success')}
            />
          ))}
        </div>
      )}
    </section>
  );
}
