import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

/**
 * DOODLE CANVAS
 * -------------
 * Works with mouse, touchscreens, phones and trackpads by using Pointer Events
 * (one API for all of them). `touch-action: none` (in styles.css) stops the page
 * from scrolling while a finger is drawing.
 *
 * We remember every stroke as a list of points. That makes UNDO easy:
 * remove the last stroke and repaint the rest.
 *
 * The parent gets the drawing with ref.current.toDataURL()  -> "data:image/png;base64,..."
 */

const W = 640; // drawing resolution (the canvas is scaled to fit the screen with CSS)
const H = 480;
const COLORS = ['#1e0f3a', '#ff4f8b', '#ff6b4a', '#ffc82e', '#14c8b4', '#5cc8ff', '#7b4dff', '#9a5f33'];
const SIZES = [{ label: 'Thin', px: 4 }, { label: 'Medium', px: 9 }, { label: 'Thick', px: 18 }];

function drawStroke(ctx, stroke) {
  const pts = stroke.points;
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (pts.length === 1) {
    // a single tap makes a dot
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, stroke.size / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}

const DoodleCanvas = forwardRef(function DoodleCanvas({ locked = false, onChange }, ref) {
  const canvasRef = useRef(null);
  const strokes = useRef([]); // finished strokes
  const current = useRef(null); // stroke being drawn right now
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1].px);
  const [count, setCount] = useState(0);

  const redraw = useCallback(() => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    strokes.current.forEach((s) => drawStroke(ctx, s));
  }, []);

  useEffect(() => { redraw(); }, [redraw]);
  useEffect(() => { onChange?.(count); }, [count, onChange]);

  useImperativeHandle(ref, () => ({
    toDataURL: () => canvasRef.current.toDataURL('image/png'),
  }));

  /** Convert a pointer position on screen to a position on the canvas */
  const toCanvas = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) * W) / rect.width, y: ((e.clientY - rect.top) * H) / rect.height };
  };

  const onPointerDown = (e) => {
    if (locked || !e.isPrimary) return;
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    current.current = { color, size, points: [toCanvas(e)] };
    drawStroke(canvasRef.current.getContext('2d'), current.current);
  };

  const onPointerMove = (e) => {
    const stroke = current.current;
    if (!stroke) return;
    const ctx = canvasRef.current.getContext('2d');
    // Coalesced events = every tiny movement between frames (smoother lines)
    const events = e.nativeEvent.getCoalescedEvents?.() || [];
    const list = events.length ? events : [e.nativeEvent];
    for (const ev of list) {
      const p = toCanvas(ev);
      const last = stroke.points[stroke.points.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) < 1) continue;
      stroke.points.push(p);
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  };

  const endStroke = () => {
    if (!current.current) return;
    strokes.current.push(current.current);
    current.current = null;
    setCount(strokes.current.length);
  };

  const undo = () => {
    strokes.current.pop();
    setCount(strokes.current.length);
    redraw();
  };

  const clear = () => {
    strokes.current = [];
    setCount(0);
    redraw();
  };

  return (
    <div className="doodle">
      <div className={`canvas-frame ${locked ? 'locked' : ''}`}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="doodle-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Drawing area"
        />
        {count === 0 && !locked && <div className="canvas-hint">Draw here ✏️</div>}
      </div>

      <div className="doodle-tools">
        <div className="swatches" role="radiogroup" aria-label="Colour">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={`Colour ${c}`}
              className={`swatch ${color === c ? 'on' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              disabled={locked}
            />
          ))}
        </div>
        <div className="sizes" role="radiogroup" aria-label="Brush size">
          {SIZES.map((s) => (
            <button
              key={s.px}
              type="button"
              role="radio"
              aria-checked={size === s.px}
              aria-label={`${s.label} brush`}
              className={`size-btn ${size === s.px ? 'on' : ''}`}
              onClick={() => setSize(s.px)}
              disabled={locked}
            >
              <span style={{ width: Math.max(6, s.px), height: Math.max(6, s.px) }} />
            </button>
          ))}
        </div>
      </div>

      <div className="doodle-actions">
        <button type="button" className="btn ghost" onClick={undo} disabled={locked || count === 0}>↩ UNDO</button>
        <button type="button" className="btn ghost" onClick={clear} disabled={locked || count === 0}>🗑 CLEAR</button>
      </div>
    </div>
  );
});

export default DoodleCanvas;
