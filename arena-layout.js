/** One uniform world-to-screen transform. Portrait rotates the view, never the physics. */
export function arenaLayout(width, height, fieldW = 44, fieldL = 68) {
  const landscape = width > height * 1.12;
  const padding = width < 500 ? 14 : 26;
  const worldW = landscape ? fieldL + 15 : fieldW + 10;
  const worldH = landscape ? fieldW + 10 : fieldL + 15;
  const scale = Math.max(.1, Math.min((width - padding * 2) / worldW, (height - padding * 2) / worldH));
  return { landscape, scale, cx: width / 2, cy: height / 2 };
}
