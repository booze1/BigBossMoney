import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { money } from '../../engine/format';

/** Small shared primitives used across every screen. */

export function Card({
  children,
  className = '',
  flush = false,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  flush?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`card ${flush ? 'card-flush' : ''} ${className}`} style={style}>
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="section-label">{children}</div>;
}

export function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'pos' | 'neg' | 'warn';
}) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className={`tile-value num ${tone ?? ''}`}>{value}</div>
      {sub !== undefined && <div className="tile-sub">{sub}</div>}
    </div>
  );
}

export function Meter({ value, color = 'var(--brand)' }: { value: number; color?: string }) {
  return (
    <div className="meter">
      <div
        className="meter-fill"
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }}
      />
    </div>
  );
}
/**
 * A tappable list row. Rendered as a real <button> when it has an action, so
 * the primary navigation of the Empire, Markets and Estate screens is
 * reachable by keyboard and announced correctly.
 */
export function ListRow({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  /** Accessible name, since the visible content is a layout of many parts. */
  label?: string;
}) {
  if (!onClick) return <div className="listrow">{children}</div>;
  return (
    <button className="listrow listrow-tap" onClick={onClick} aria-label={label}>
      {children}
    </button>
  );
}

/**
 * A full-height sheet whose body scrolls internally — used for the Boss panel,
 * which embeds a whole screen. Portalled for the same reason as `Modal`.
 */
export function PanelSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-panel-head">
          <span className="modal-title" style={{ margin: 0 }}>{title}</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  dismissible?: boolean;
}) {
  // Escape closes any dismissible sheet — expected on desktop, and the only
  // way out for a keyboard user.
  useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismissible, onClose]);

  if (!open) return null;

  // Rendered into document.body rather than in place. Screens are themselves
  // scroll containers (`.screen { overflow-y: auto }`) inside `.app
  // { overflow: hidden }`, and a nested scroller in that chain does not
  // respond to touch scrolling — wheel events hit-test visually and worked,
  // but a finger swipe did nothing, so sheet content below the fold was
  // unreachable on a phone.
  return createPortal(
    <div className="modal-backdrop" onClick={dismissible ? onClose : undefined}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        {dismissible && <div className="modal-grabber" />}
        {title && <h2 className="modal-title">{title}</h2>}
        {children}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Compact SVG sparkline. Drawn by hand rather than pulled from a chart library
 * so the whole app stays dependency-free and the line matches the type scale.
 */
export function Sparkline({
  data,
  width = 92,
  height = 30,
  color,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  const { path, area, up } = useMemo(() => {
    if (data.length < 2) return { path: '', area: '', up: true };
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || Math.abs(max) || 1;
    const stepX = width / (data.length - 1);

    const points = data.map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / span) * (height - 2) - 1;
      return [x, y] as const;
    });

    const d = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const a = `${d} L${width},${height} L0,${height} Z`;
    return { path: d, area: a, up: data[data.length - 1] >= data[0] };
  }, [data, width, height]);

  const stroke = color ?? (up ? 'var(--pos)' : 'var(--neg)');
  const gradId = useRef(`g${Math.random().toString(36).slice(2, 8)}`).current;

  if (!path) return <svg className="spark" width={width} height={height} />;

  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** A larger price chart with a baseline, used on asset detail views. */
export function PriceChart({ data, height = 130 }: { data: number[]; height?: number }) {
  const width = 320;
  if (data.length < 2) return <div className="empty">Not enough price history yet.</div>;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || Math.abs(max) || 1;
  const stepX = width / (data.length - 1);
  const up = data[data.length - 1] >= data[0];
  const stroke = up ? 'var(--pos)' : 'var(--neg)';

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / span) * (height - 12) - 6;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const first = data[0];
  const baselineY = height - ((first - min) / span) * (height - 12) - 6;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ display: 'block' }}
    >
      <line
        x1="0"
        x2={width}
        y1={baselineY}
        y2={baselineY}
        stroke="var(--border-strong)"
        strokeWidth="1"
        strokeDasharray="3 4"
      />
      <path d={points.join(' ')} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * A number that eases toward its target instead of snapping, so the big
 * headline figures read as "counting up" rather than flickering.
 */
export function AnimatedMoney({ value, className = '' }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const raf = useRef(0);
  const current = useRef(value);

  useEffect(() => {
    const animate = () => {
      const diff = value - current.current;
      if (Math.abs(diff) < Math.max(1, Math.abs(value) * 0.0004)) {
        current.current = value;
        setDisplay(value);
        return;
      }
      current.current += diff * 0.22;
      setDisplay(current.current);
      raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);

  return <span className={`num ${className}`}>{money(display)}</span>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Chip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: 'pos' | 'neg' | 'warn';
}) {
  return <span className={`chip ${tone ? `chip-${tone}` : ''}`}>{children}</span>;
}

/** Percentage-of-cash slider used by the market and debt screens. */
export function AmountSlider({
  max,
  value,
  onChange,
  label,
}: {
  max: number;
  value: number;
  onChange: (v: number) => void;
  label?: string;
}) {
  const pctValue = max > 0 ? value / max : 0;
  return (
    <div>
      <div className="row" style={{ marginBottom: 4 }}>
        <span className="dim" style={{ fontSize: 12 }}>{label ?? 'Amount'}</span>
        <span className="num" style={{ fontSize: 13 }}>{money(value)}</span>
      </div>
      <input
        className="slider"
        type="range"
        min={0}
        max={1000}
        value={Math.round(pctValue * 1000)}
        onChange={(e) => onChange((Number(e.target.value) / 1000) * max)}
      />
      <div className="btn-group">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <button key={f} className="btn btn-sm btn-ghost" onClick={() => onChange(max * f)}>
            {f === 1 ? 'Max' : `${f * 100}%`}
          </button>
        ))}
      </div>
    </div>
  );
}
