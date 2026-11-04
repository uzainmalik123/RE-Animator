// The dot-matrix renderer (R1): the one art primitive every scene draws through.
export { BAYER4, GLYPH_RAMP, ditherLevels, gridSize, levelsToText, luminanceGrid } from './dither';
export {
  drawDots,
  drawGlyphs,
  drawLevelsAsDots,
  drawLevelsAsGlyphs,
  sampleLuminance,
  type Ctx,
  type DotOptions,
  type GlyphOptions,
  type Palette,
} from './draw';
export { DotRenderer } from './renderer';
