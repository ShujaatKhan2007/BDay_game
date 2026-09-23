/** Tap-to-score buttons: 0 .. max */
export default function ScorePicker({ max, value, onChange, disabled }) {
  return (
    <div className="score-picker" role="radiogroup" aria-label="Score">
      {Array.from({ length: max + 1 }, (_, n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          className={`score-btn ${value === n ? 'on' : ''}`}
          onClick={() => onChange(n)}
          disabled={disabled}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
