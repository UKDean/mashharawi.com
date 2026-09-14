import React from 'react';
import { Composition, useVideoConfig, interpolate, useCurrentFrame, AbsoluteFill } from 'remotion';
import { NotePost, notePostSchema, notePostDefaults } from './NotePost';
import { MillBand } from './MillBand';
import { FPS, SIZE, T } from './theme';

/* A standalone loop of the band alone: a 6 second seamless clip, useful as a
   header video or a reply GIF. The sweep runs 0 -> 1 -> 0 so the last frame
   matches the first and the loop has no visible cut. */
const BandLoop: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, width } = useVideoConfig();
  const sweep = interpolate(
    frame,
    [0, durationInFrames / 2, durationInFrames],
    [-0.15, 1.15, -0.15]
  );
  return (
    <AbsoluteFill style={{ background: T.sheet }}>
      <MillBand width={width} height={420} sweep={sweep} count={520} />
    </AbsoluteFill>
  );
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="NotePost"
      component={NotePost}
      durationInFrames={10 * FPS}
      fps={FPS}
      width={SIZE}
      height={SIZE}
      schema={notePostSchema}
      defaultProps={notePostDefaults}
    />
    <Composition
      id="MillBand"
      component={BandLoop}
      durationInFrames={6 * FPS}
      fps={FPS}
      width={1600}
      height={420}
    />
  </>
);
