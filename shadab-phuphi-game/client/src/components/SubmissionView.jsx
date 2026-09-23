import { useState } from 'react';
import { useContent } from '../socket/GameContext.jsx';

/** Shows one participant's submission for a round (Host only) */
export default function SubmissionView({ round, submission }) {
  const { rounds: ROUNDS } = useContent();
  const [zoom, setZoom] = useState(false);

  if (!submission) return <p className="muted">🟡 Nothing submitted yet.</p>;

  switch (round) {
    case 1:
      return (
        <ol className="qa-list">
          {ROUNDS[1].questions.map((q, i) => (
            <li key={i}>
              <div className="qa-q">Question {i + 1}: <span>{q}</span></div>
              <div className="qa-a">Answer: <strong>{submission.answers[i]}</strong></div>
            </li>
          ))}
        </ol>
      );

    case 2:
      return (
        <>
          <button type="button" className="doodle-thumb" onClick={() => setZoom(true)} aria-label="Enlarge doodle">
            <img src={submission.image} alt="Submitted doodle" />
          </button>
          {zoom && (
            <div className="lightbox" onClick={() => setZoom(false)} role="dialog" aria-label="Doodle preview">
              <img src={submission.image} alt="Submitted doodle, large" />
              <span className="lightbox-close">Tap anywhere to close</span>
            </div>
          )}
        </>
      );

    case 3:
      return (
        <ol className="qa-list">
          {ROUNDS[3].situations.map((s, i) => (
            <li key={i}>
              <div className="qa-q">{s.text}</div>
              <div className="qa-a reaction">
                <span className="big-emoji">{submission.reactions[i].emoji || '💬'}</span>
                {submission.reactions[i].text && <strong>{submission.reactions[i].text}</strong>}
              </div>
            </li>
          ))}
        </ol>
      );

    case 4:
      return <blockquote className="dialog-quote">“{submission.dialog}”</blockquote>;

    case 5:
      return <div className="one-word">{submission.word}</div>;

    default:
      return null;
  }
}
