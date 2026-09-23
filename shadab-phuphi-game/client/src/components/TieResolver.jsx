import { useEffect, useState } from 'react';
import { useGame } from '../socket/GameContext.jsx';

/**
 * HOST: when players have the same total, the Host chooses their final order.
 * The chosen order is what the winner reveal will use.
 */
function TieGroup({ tie, nameOf, disabled }) {
  const { emit, pushToast } = useGame();
  const [order, setOrder] = useState(tie.ids);
  const serverKey = tie.ids.join(',');
  useEffect(() => setOrder(tie.ids), [serverKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const move = (index, delta) => {
    const next = [...order];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  };

  const changed = order.join(',') !== serverKey;
  const affectsWinners = tie.startPosition <= 3;

  async function save() {
    const res = await emit('set_tie_order', { total: tie.total, order });
    if (!res.ok) pushToast(res.error, 'error');
    else pushToast('Tie order saved ✅', 'success');
  }

  return (
    <div className={`card tie-card ${tie.resolved ? 'resolved' : 'open'}`}>
      <div className="tie-head">
        <strong>
          {tie.resolved ? '✅ Tie resolved' : '⚠️ TIE DETECTED'} — {tie.ids.length} players on {tie.total} points
        </strong>
        <span className="muted small">
          Positions {tie.startPosition}–{tie.endPosition}
          {affectsWinners ? '' : ' (does not affect the top 3)'}
        </span>
      </div>

      <ol className="tie-list">
        {order.map((id, i) => (
          <li key={id}>
            <span className="tie-pos">#{tie.startPosition + i}</span>
            <span className="tie-name">{nameOf(id)}</span>
            <span className="tie-arrows">
              <button type="button" className="icon-btn" onClick={() => move(i, -1)} disabled={disabled || i === 0} aria-label={`Move ${nameOf(id)} up`}>▲</button>
              <button type="button" className="icon-btn" onClick={() => move(i, 1)} disabled={disabled || i === order.length - 1} aria-label={`Move ${nameOf(id)} down`}>▼</button>
            </span>
          </li>
        ))}
      </ol>

      <button className="btn sun" onClick={save} disabled={disabled || (tie.resolved && !changed)}>
        {tie.resolved ? 'UPDATE ORDER' : 'USE THIS ORDER'}
      </button>
    </div>
  );
}

export default function TieResolver({ state }) {
  if (!state.ties.length) return null;
  const nameOf = (id) => state.participants.find((p) => p.id === id)?.name ?? '?';
  return (
    <div className="stack">
      {state.ties.map((t) => (
        <TieGroup key={t.total} tie={t} nameOf={nameOf} disabled={state.locked} />
      ))}
    </div>
  );
}
