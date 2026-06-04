import { Composition } from 'remotion';
import { PrintPageVideo, calculatePrintMetadata } from './PrintPageVideo';

/**
 * Print-only Remotion root.
 * ─────────────────────────
 * This standalone project renders *prints*, not the keynote videos, so the
 * catalog holds a single generic composition: `PrintPage`. The export pipeline
 * (`scripts/export-print.mjs`) bundles this entry, selects `PrintPage`, passes a
 * `PrintDoc` as input props and `renderStill`s one frozen frame at the document's
 * exact pixel size. `calculatePrintMetadata` derives width/height from the doc.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PrintPage"
        component={PrintPageVideo}
        calculateMetadata={calculatePrintMetadata}
        durationInFrames={1}
        fps={1}
        width={2551}
        height={3579}
      />
    </>
  );
};
