import { useGame } from '../socket/GameContext.jsx';

/** Small pop-up messages at the bottom of the screen */
export default function Toasts() {
  const { toasts } = useGame();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>{t.text}</div>
      ))}
    </div>
  );
}
