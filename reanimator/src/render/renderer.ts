// A stateful dot renderer for animated scenes (THEME §3 "Performance", KI-R3): it keeps the last
// frame's levels and repaints only the cells whose level changed.
import { ditherLevels, gridSize } from './dither';
import { drawLevelsAsDots, fillBackground, paintDot, resolveDotOptions, sampleLuminance, type Ctx, type DotOptions, type ResolvedDotOptions } from './draw';

export class DotRenderer {
  private readonly ctx: Ctx;
  private readonly o: ResolvedDotOptions;
  private prev: Uint8Array | null = null;
  private cols = 0;
  private rows = 0;

  constructor(ctx: Ctx, options: DotOptions) {
    this.ctx = ctx;
    this.o = resolveDotOptions(options);
  }

  // Draw one frame of per-cell luminance. Returns how many cells were repainted: every lit cell on
  // a fresh frame (first, after reset, or a new grid size), otherwise only the changed ones.
  renderLuminance(lum: Float32Array, cols: number, rows: number): number {
    const levels = ditherLevels(lum, cols, rows, this.o.steps);
    const prev = this.prev;
    this.prev = levels;
    if (!prev || cols !== this.cols || rows !== this.rows) {
      this.cols = cols;
      this.rows = rows;
      return drawLevelsAsDots(this.ctx, levels, cols, rows, this.o);
    }
    const cell = this.o.pitch * this.o.scale;
    let changed = 0;
    for (let i = 0; i < levels.length; i++) {
      if (levels[i] === prev[i]) continue;
      const col = i % cols;
      const row = Math.floor(i / cols);
      fillBackground(this.ctx, col * cell, row * cell, cell, cell, this.o.palette);
      if (levels[i]! > 0) {
        this.ctx.fillStyle = this.o.palette.ink;
        paintDot(this.ctx, col, row, levels[i]!, this.o);
      }
      changed++;
    }
    return changed;
  }

  // Sample an image across the whole canvas and draw it.
  render(image: CanvasImageSource): number {
    const { cols, rows } = gridSize(this.ctx.canvas.width, this.ctx.canvas.height, this.o.pitch * this.o.scale);
    return this.renderLuminance(sampleLuminance(image, cols, rows), cols, rows);
  }

  // Forget the last frame, so the next one repaints everything (after a resize or a scene change).
  reset(): void {
    this.prev = null;
  }
}
