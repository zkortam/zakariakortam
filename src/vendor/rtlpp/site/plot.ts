/**
 * The three view types logicLanes.ts takes, copied verbatim from src/components/Waveforms/plot.ts
 * (zkortam/spiceplusplus). The rest of plot.ts (the analog plot engine) is not needed here.
 */
export interface PlotRect { x: number; y: number; w: number; h: number; }

/** A/B measurement cursors, in DATA space (so pan/zoom never drifts them). */
export interface PlotCursors { a: number | null; b: number | null; }

/** Left/right margins in px. Passed in to force two stacked panels to share a
 *  plot rect to the pixel (the Bode view); omitted, each panel measures its own. */
export interface PlotGutter { left: number; right: number; }
