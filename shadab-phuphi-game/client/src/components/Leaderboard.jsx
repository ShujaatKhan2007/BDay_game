import { ROUND_NUMBERS } from '../config/gameContent.js';
import { useContent } from '../socket/GameContext.jsx';

const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };

/** HOST ONLY: the full score table. Participants never receive this data. */
export default function Leaderboard({ state }) {
  const { rounds: ROUNDS } = useContent();
  const maxTotal = Object.values(state.maxScores).reduce((a, b) => a + b, 0);

  if (!state.ranking.length) return <p className="muted">No participants yet.</p>;

  return (
    <div className="table-scroll">
      <table className="board">
        <thead>
          <tr>
            <th>Rank</th>
            <th className="left">Participant</th>
            {ROUND_NUMBERS.map((r) => (
              <th key={r}>{ROUNDS[r].column}<small>/{state.maxScores[r]}</small></th>
            ))}
            <th>Total<small>/{maxTotal}</small></th>
          </tr>
        </thead>
        <tbody>
          {state.ranking.map((row) => (
            <tr key={row.id} className={row.position <= 3 ? `top top-${row.position}` : ''}>
              <td className="rank">{MEDALS[row.position] || row.position}</td>
              <td className="left name">
                {row.name}
                {row.tied && !state.locked && <span className="chip warn tiny">tie</span>}
              </td>
              {ROUND_NUMBERS.map((r) => (
                <td key={r}>{row.scores[r] ?? <span className="dash">–</span>}</td>
              ))}
              <td className="total">{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
