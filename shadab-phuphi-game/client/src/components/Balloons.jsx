/** A few slow balloons drifting up behind everything (pure CSS, hidden for reduced-motion users). */
const BALLOONS = [
  { x: '6%', d: '26s', delay: '-4s', c: 'var(--pink)' },
  { x: '22%', d: '32s', delay: '-18s', c: 'var(--sun)' },
  { x: '48%', d: '38s', delay: '-9s', c: 'var(--teal)' },
  { x: '73%', d: '29s', delay: '-22s', c: 'var(--sky)' },
  { x: '90%', d: '34s', delay: '-13s', c: 'var(--grape)' },
];

export default function Balloons() {
  return (
    <div className="balloons" aria-hidden="true">
      {BALLOONS.map((b, i) => (
        <span key={i} className="balloon" style={{ '--x': b.x, '--d': b.d, '--delay': b.delay, '--c': b.c }} />
      ))}
    </div>
  );
}
