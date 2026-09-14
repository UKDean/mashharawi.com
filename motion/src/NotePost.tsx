import React from 'react';
import {
  AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig,
} from 'remotion';
import { loadFont as loadArchivo } from '@remotion/google-fonts/Archivo';
import { loadFont as loadMono } from '@remotion/google-fonts/IBMPlexMono';
import { MillBand } from './MillBand';
import { T } from './theme';
import { z } from 'zod';

const { fontFamily: display } = loadArchivo();
const { fontFamily: mono } = loadMono();

/* Props are schema'd so the figures can be edited in Remotion Studio without
   touching code, and so `--props` from the command line is validated rather
   than silently rendering a post with a missing number. */
export const notePostSchema = z.object({
  kicker: z.string(),
  headline: z.string(),
  figures: z.array(z.object({
    value: z.string(),
    unit: z.string(),
    label: z.string(),
  })).max(3),
  footnote: z.string(),
});

export type NotePostProps = z.infer<typeof notePostSchema>;

export const notePostDefaults: NotePostProps = {
  kicker: 'Reinforcing steel',
  headline: 'Weight tolerance is a commercial term, not a technical one.',
  figures: [
    { value: '0.006165', unit: 'x d²', label: 'Nominal kg per metre' },
    { value: '12', unit: 'm', label: 'Stock bar length' },
    { value: '52.8', unit: 'bars', label: 'Per tonne at 16 mm' },
  ],
  footnote: 'Omar Mashharawi  /  mashharawi.com',
};

export const NotePost: React.FC<NotePostProps> = ({ kicker, headline, figures, footnote }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();

  /* The band sweeps once, slowly, across the whole piece: the post is the
     same argument the site makes, compressed into ten seconds. */
  const sweep = interpolate(frame, [0, durationInFrames], [-0.15, 1.15]);

  const rise = (delay: number) =>
    spring({ frame: frame - delay, fps, config: { damping: 200, mass: 0.6 } });

  return (
    <AbsoluteFill style={{ background: T.mill, fontFamily: display }}>
      {/* band across the upper third */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 96, height: 260, borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}`, background: T.sheet }}>
        <MillBand width={width} height={260} sweep={sweep} />
      </div>

      <Sequence from={6}>
        <div style={{ position: 'absolute', left: 72, top: 404, right: 72 }}>
          <div style={{
            fontFamily: mono, fontSize: 20, letterSpacing: '.18em', textTransform: 'uppercase',
            color: T.scale, display: 'flex', alignItems: 'center', gap: 14,
            opacity: rise(0), transform: `translateY(${(1 - rise(0)) * 14}px)`,
          }}>
            <span style={{ width: 34, height: 2, background: T.hot }} />
            {kicker}
          </div>

          <div style={{
            marginTop: 30, fontSize: 68, fontWeight: 600, lineHeight: 1.08,
            letterSpacing: '-.02em', color: T.ink, maxWidth: 880,
            opacity: rise(8), transform: `translateY(${(1 - rise(8)) * 22}px)`,
          }}>
            {headline}
          </div>
        </div>
      </Sequence>

      {/* figures, on the raised surface, divided the way the site divides them */}
      <div style={{
        position: 'absolute', left: 72, right: 72, bottom: 168,
        display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, figures.length)}, 1fr)`,
        background: T.sheet, border: `1px solid ${T.line}`,
      }}>
        {figures.map((f, i) => {
          const s = rise(26 + i * 7);
          return (
            <div key={i} style={{
              padding: '30px 32px',
              borderRight: i < figures.length - 1 ? `1px solid ${T.line}` : 'none',
              opacity: s, transform: `translateY(${(1 - s) * 16}px)`,
            }}>
              <div style={{ fontFamily: mono, fontSize: 16, letterSpacing: '.14em', textTransform: 'uppercase', color: T.scale, marginBottom: 16 }}>
                {f.label}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 52, fontWeight: 600, letterSpacing: '-.02em', color: i === figures.length - 1 ? T.hot : T.ink }}>
                  {f.value}
                </span>
                <span style={{ fontFamily: mono, fontSize: 18, letterSpacing: '.08em', color: T.scale }}>{f.unit}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* footer rule, drawn rather than faded in: it is a machined edge */}
      <div style={{ position: 'absolute', left: 72, right: 72, bottom: 104, height: 1, background: T.ink, transformOrigin: 'left', transform: `scaleX(${rise(44)})` }} />
      <div style={{
        position: 'absolute', left: 72, right: 72, bottom: 60,
        fontFamily: mono, fontSize: 19, letterSpacing: '.12em', textTransform: 'uppercase',
        color: T.scale, opacity: rise(50),
      }}>
        {footnote}
      </div>
    </AbsoluteFill>
  );
};
