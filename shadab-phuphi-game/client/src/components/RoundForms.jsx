import { useRef, useState } from 'react';
import { useGame } from '../socket/GameContext.jsx';
import { ROUNDS } from '../config/gameContent.js';
import DoodleCanvas from './DoodleCanvas.jsx';

/**
 * PARTICIPANT ROUND FORMS
 * -----------------------
 * One form per round. Each form only collects the answers; the shared
 * <FormShell> handles the header, the "round closed" notice, errors and the
 * submit button. The server re-checks everything, so these checks are just
 * for a friendly experience.
 */

/** Sends the answer to the server and tracks "sending" / error state */
function useSubmit(round) {
  const { emit } = useGame();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (payload) => {
    setBusy(true);
    setError('');
    const res = await emit(ROUNDS[round].submitEvent, payload, 20000); // doodles can take a moment on mobile data
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
    } else {
      // The server's next game_state swaps this form for "submitted".
      setTimeout(() => setBusy(false), 4000); // safety net only
    }
    return res;
  };
  return { submit, busy, error };
}

export function RoundHeader({ round, maxScore }) {
  const cfg = ROUNDS[round];
  return (
    <header className="round-head">
      <div className="round-badge">{cfg.icon} ROUND {round}</div>
      <h2 className="display">{cfg.name}</h2>
      {maxScore != null && <div className="chip">Maximum marks: {maxScore}</div>}
    </header>
  );
}

function FormShell({ round, maxScore, locked, canSubmit, busy, error, onSubmit, children }) {
  return (
    <section className="card round-card">
      <RoundHeader round={round} maxScore={maxScore} />
      {children}
      {locked && <div className="notice">⏰ The Host has closed this round. Waiting for the next one…</div>}
      {error && <div className="notice error" role="alert">{error}</div>}
      <button className="btn pink block" onClick={onSubmit} disabled={!canSubmit || busy || locked}>
        {busy ? 'SENDING…' : ROUNDS[round].submitLabel}
      </button>
    </section>
  );
}

/* ---------------- Round 1: Q&A ---------------- */
function QAForm({ locked, maxScore }) {
  const cfg = ROUNDS[1];
  const [answers, setAnswers] = useState(cfg.questions.map(() => ''));
  const { submit, busy, error } = useSubmit(1);
  const set = (i, v) => setAnswers((a) => a.map((x, k) => (k === i ? v : x)));

  return (
    <FormShell
      round={1} maxScore={maxScore} locked={locked} busy={busy} error={error}
      canSubmit={answers.every((a) => a.trim())}
      onSubmit={() => submit({ answers })}
    >
      <div className="stack">
        {cfg.questions.map((q, i) => (
          <label key={i} className="field">
            <span className="field-label">{i + 1}. {q}</span>
            <input
              type="text"
              value={answers[i]}
              maxLength={200}
              disabled={locked}
              placeholder="Your answer"
              enterKeyHint={i === cfg.questions.length - 1 ? 'done' : 'next'}
              onChange={(e) => set(i, e.target.value)}
            />
          </label>
        ))}
      </div>
    </FormShell>
  );
}

/* ---------------- Round 2: Doodle ---------------- */
function DoodleForm({ locked, maxScore }) {
  const canvas = useRef(null);
  const [strokes, setStrokes] = useState(0);
  const { submit, busy, error } = useSubmit(2);

  return (
    <FormShell
      round={2} maxScore={maxScore} locked={locked} busy={busy} error={error}
      canSubmit={strokes > 0}
      onSubmit={() => submit({ image: canvas.current.toDataURL() })}
    >
      <p className="prompt">“{ROUNDS[2].prompt}”</p>
      <DoodleCanvas ref={canvas} locked={locked} onChange={setStrokes} />
    </FormShell>
  );
}

/* ---------------- Round 3: Reactions ---------------- */
function ReactionForm({ locked, maxScore }) {
  const cfg = ROUNDS[3];
  const [reactions, setReactions] = useState(cfg.situations.map(() => ({ emoji: '', text: '' })));
  const { submit, busy, error } = useSubmit(3);
  const update = (i, patch) => setReactions((r) => r.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  return (
    <FormShell
      round={3} maxScore={maxScore} locked={locked} busy={busy} error={error}
      canSubmit={reactions.every((r) => r.emoji || r.text.trim())}
      onSubmit={() => submit({ reactions })}
    >
      <div className="stack big-gap">
        {cfg.situations.map((s, i) => (
          <div key={i} className="situation">
            <div className="field-label">{i + 1}. {s.text}</div>
            <div className="emoji-row" role="group" aria-label="Pick a reaction">
              {s.emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={`emoji-btn ${reactions[i].emoji === emoji ? 'on' : ''}`}
                  aria-pressed={reactions[i].emoji === emoji}
                  disabled={locked}
                  onClick={() => update(i, { emoji: reactions[i].emoji === emoji ? '' : emoji })}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={reactions[i].text}
              maxLength={120}
              disabled={locked}
              placeholder="Custom reaction (optional if you picked an emoji)"
              onChange={(e) => update(i, { text: e.target.value })}
            />
          </div>
        ))}
      </div>
    </FormShell>
  );
}

/* ---------------- Round 4: Dialog ---------------- */
function DialogForm({ locked, maxScore }) {
  const [dialog, setDialog] = useState('');
  const { submit, busy, error } = useSubmit(4);

  return (
    <FormShell
      round={4} maxScore={maxScore} locked={locked} busy={busy} error={error}
      canSubmit={dialog.trim().length > 0}
      onSubmit={() => submit({ dialog })}
    >
      <p className="prompt">“{ROUNDS[4].prompt}”</p>
      <textarea
        value={dialog}
        rows={4}
        maxLength={300}
        disabled={locked}
        placeholder="Type the dialog here…"
        onChange={(e) => setDialog(e.target.value)}
      />
      <div className="counter">{dialog.length}/300</div>
    </FormShell>
  );
}

/* ---------------- Round 5: One word ---------------- */
function WordForm({ locked, maxScore }) {
  const [word, setWord] = useState('');
  const { submit, busy, error } = useSubmit(5);

  return (
    <FormShell
      round={5} maxScore={maxScore} locked={locked} busy={busy} error={error}
      canSubmit={word.length > 0}
      onSubmit={() => submit({ word })}
    >
      <p className="prompt">“{ROUNDS[5].prompt}”</p>
      <input
        type="text"
        className="word-input"
        value={word}
        maxLength={30}
        disabled={locked}
        placeholder="One word…"
        autoCapitalize="words"
        autoComplete="off"
        // Spaces are removed as you type, so the answer is always ONE word.
        onChange={(e) => setWord(e.target.value.replace(/\s/g, ''))}
      />
      <div className="counter">Only one word - no spaces!</div>
    </FormShell>
  );
}

const FORMS = { 1: QAForm, 2: DoodleForm, 3: ReactionForm, 4: DialogForm, 5: WordForm };

export default function RoundForm({ round, ...props }) {
  const Form = FORMS[round];
  return <Form {...props} />;
}
