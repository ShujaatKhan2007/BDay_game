/**
 * The party puppy mascot - a hand-built SVG so it stays sharp on any screen.
 * Use <Puppy wobble /> for a gentle head tilt.
 */
export default function Puppy({ size = 150, wobble = false, className = '' }) {
  const ink = '#1e0f3a';
  return (
    <svg
      className={`puppy ${wobble ? 'wobble' : ''} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="img"
      aria-label="A puppy wearing a party hat"
    >
      {/* floppy ears */}
      <ellipse cx="44" cy="102" rx="25" ry="44" fill="#9a5f33" stroke={ink} strokeWidth="6" transform="rotate(16 44 102)" />
      <ellipse cx="156" cy="102" rx="25" ry="44" fill="#9a5f33" stroke={ink} strokeWidth="6" transform="rotate(-16 156 102)" />
      {/* head */}
      <circle cx="100" cy="112" r="62" fill="#f4c790" stroke={ink} strokeWidth="6" />
      {/* muzzle */}
      <ellipse cx="100" cy="136" rx="33" ry="25" fill="#fff8ea" stroke={ink} strokeWidth="5" />
      {/* cheeks */}
      <circle cx="60" cy="130" r="9" fill="#ff8fb1" opacity=".75" />
      <circle cx="140" cy="130" r="9" fill="#ff8fb1" opacity=".75" />
      {/* eyes */}
      <circle cx="76" cy="106" r="8.5" fill={ink} />
      <circle cx="124" cy="106" r="8.5" fill={ink} />
      <circle cx="79" cy="103" r="2.8" fill="#fff" />
      <circle cx="127" cy="103" r="2.8" fill="#fff" />
      {/* nose + mouth + tongue */}
      <ellipse cx="100" cy="124" rx="12" ry="9" fill={ink} />
      <path d="M100 133 V141 M100 141 Q90 152 79 143 M100 141 Q110 152 121 143" stroke={ink} strokeWidth="4.5" fill="none" strokeLinecap="round" />
      <path d="M92 147 Q100 170 108 147 Z" fill="#ff4f8b" stroke={ink} strokeWidth="4" strokeLinejoin="round" />
      {/* party hat */}
      <path d="M100 4 L136 64 Q100 78 64 64 Z" fill="#ffc82e" stroke={ink} strokeWidth="6" strokeLinejoin="round" />
      <path d="M85 40 L115 46 M77 54 L124 60" stroke="#ff4f8b" strokeWidth="6" strokeLinecap="round" />
      <circle cx="100" cy="8" r="9" fill="#14c8b4" stroke={ink} strokeWidth="5" />
    </svg>
  );
}
