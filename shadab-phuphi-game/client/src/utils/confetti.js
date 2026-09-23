import confetti from 'canvas-confetti';

const COLORS = ['#ff4f8b', '#ffc82e', '#14c8b4', '#5cc8ff', '#7b4dff', '#ff6b4a'];
const base = { colors: COLORS, disableForReducedMotion: true, zIndex: 9999 };

/** One big pop from the middle of the screen */
export function burst(power = 1) {
  confetti({ ...base, particleCount: Math.round(110 * power), spread: 85, startVelocity: 48, origin: { y: 0.62 } });
  setTimeout(() => confetti({ ...base, particleCount: Math.round(60 * power), spread: 120, startVelocity: 32, scalar: 1.2, origin: { y: 0.6 } }), 220);
}

/** Cannons firing from both sides of the screen for a few seconds (1st place!) */
export function sideCannons(ms = 4500, colors = COLORS) {
  const end = Date.now() + ms;
  (function frame() {
    confetti({ ...base, colors, particleCount: 5, angle: 60, spread: 62, startVelocity: 62, origin: { x: 0, y: 0.78 } });
    confetti({ ...base, colors, particleCount: 5, angle: 120, spread: 62, startVelocity: 62, origin: { x: 1, y: 0.78 } });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

export function stopConfetti() {
  confetti.reset();
}
