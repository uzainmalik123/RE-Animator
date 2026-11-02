// Backing-store size for a canvas shown at cssWidth x cssHeight, so it stays sharp on high-DPI screens.
export function sizeCanvas(cssWidth: number, cssHeight: number, dpr: number): { width: number; height: number } {
  const scale = Number.isFinite(dpr) && dpr >= 1 ? dpr : 1;
  return { width: Math.round(cssWidth * scale), height: Math.round(cssHeight * scale) };
}
