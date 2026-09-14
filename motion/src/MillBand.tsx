import React, { useMemo } from 'react';
import { random, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { T } from './theme';

/* The same idea as assets/mill.js, rebuilt for a deterministic renderer.
   Nothing here reads the clock or Math.random: every particle's position is
   a pure function of the frame number, which is what lets Remotion render
   frames out of order and in parallel and still get an identical video. */

type Props = {
  width: number;
  height: number;
  count?: number;
  /** 0 = all steel, 1 = all lattice. Drive this from the parent to sweep. */
  sweep: number;
};

const RIB_TILT = Math.tan((12 * Math.PI) / 180);
const FEATHER = 0.2;

function smoother(e0: number, e1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function mix(a: number[], b: number[], t: number) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}
const C_SCALE = [104, 114, 122];
const C_HOT = [216, 96, 15];
const C_INK = [16, 20, 24];

export const MillBand: React.FC<Props> = ({ width, height, count = 380, sweep }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /* Homes are computed once. Only the morph between them depends on frame. */
  const particles = useMemo(() => {
    const steel: [number, number][] = [];
    const ribs = Math.ceil((width + height * RIB_TILT) / 15) + 2;
    const perRib = Math.max(3, Math.round(height / 13));
    for (let k = 0; k < ribs; k++) {
      const x0 = k * 15 - height * RIB_TILT * 0.5;
      for (let j = 0; j < perRib; j++) {
        const yy = ((j + 0.5) / perRib) * height;
        steel.push([x0 + (yy / height - 0.5) * height * RIB_TILT, yy]);
      }
    }
    const along = Math.max(8, Math.round(width / 7));
    for (let s = 0; s < 2; s++) {
      const ly = height * (s ? 0.66 : 0.34);
      for (let i = 0; i < along; i++) steel.push([((i + 0.5) / along) * width, ly]);
    }
    steel.sort((a, b) => a[0] - b[0]);

    const n = Math.min(count, steel.length);
    const cols = Math.max(2, Math.round(Math.sqrt(n * (width / height))));
    const rows = Math.max(2, Math.round(n / cols));
    const lattice: [number, number][] = [];
    for (let c = 0; c < cols; c++)
      for (let r = 0; r < rows; r++)
        lattice.push([((c + 0.5) / cols) * width, ((r + 0.5) / rows) * height]);
    lattice.sort((a, b) => a[0] - b[0]);

    const m = Math.min(n, lattice.length);
    return Array.from({ length: m }, (_, q) => {
      const sp = steel[Math.floor(q * (steel.length / m))];
      const lp = lattice[Math.floor(q * (lattice.length / m))];
      return {
        sx: sp[0], sy: sp[1],
        lx: lp[0], ly: lp[1],
        ax: sp[0] / width,
        ph: random(`p${q}`) * Math.PI * 2,
      };
    });
  }, [width, height, count]);

  const t = frame / fps;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* the two longitudinal ribs, kept as a faint memory of the still pattern */}
      <div style={{ position: 'absolute', left: 0, top: height * 0.34, width, height: 1, background: 'rgba(104,114,122,.20)' }} />
      <div style={{ position: 'absolute', left: 0, top: height * 0.66, width, height: 1, background: 'rgba(104,114,122,.20)' }} />

      {particles.map((p, i) => {
        const m = smoother(sweep - FEATHER, sweep + FEATHER, p.ax);
        const e = m * m * (3 - 2 * m);
        const air = Math.sin(Math.PI * m);
        const x = p.sx + (p.lx - p.sx) * e + Math.sin(t * 1.1 + p.ph) * 5.5 * air;
        const y = p.sy + (p.ly - p.sy) * e + Math.cos(t * 0.9 + p.ph * 1.7) * 4.2 * air;

        const col = mix(mix(C_SCALE, C_INK, e), C_HOT, Math.min(1, air * 1.25));
        const size = 2 + 2.4 * air + 1 * e;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x - size / 2,
              top: y - size / 2,
              width: size,
              height: size,
              background: `rgba(${col[0]},${col[1]},${col[2]},${(0.42 + 0.5 * air + 0.1 * (1 - e)).toFixed(3)})`,
            }}
          />
        );
      })}

      {/* the transition itself, the only thing on screen that is truly hot */}
      <div
        style={{
          position: 'absolute',
          left: sweep * width - 34,
          top: 0,
          width: 68,
          height,
          background: `linear-gradient(90deg, rgba(216,96,15,0), rgba(216,96,15,.42), rgba(216,96,15,0))`,
          opacity: interpolate(sweep, [-0.1, 0, 1, 1.1], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        }}
      />

      <Axis side="left" label="HOT ROLLED" color={T.scale} />
      <Axis side="right" label="DATA" color={T.hot} />
    </div>
  );
};

const Axis: React.FC<{ side: 'left' | 'right'; label: string; color: string }> = ({ side, label, color }) => (
  <div
    style={{
      position: 'absolute',
      bottom: 12,
      [side]: 16,
      fontFamily: 'monospace',
      fontSize: 15,
      letterSpacing: '.2em',
      color,
      opacity: 0.85,
    } as React.CSSProperties}
  >
    {label}
  </div>
);
