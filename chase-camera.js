/** Keep the chase viewpoint inside the playable rectangle, in front of castle
 * towers. Apply after smoothing and minimum-distance adjustment, so neither can
 * push it back through scenery. The higher near-board view preserves context. */
export function constrainChase(position, halfWidth, halfLength) {
  const nearBoard=Math.abs(position.x)>halfWidth-5 || Math.abs(position.z)>halfLength-5;
  position.x=Math.max(-halfWidth+2,Math.min(halfWidth-2,position.x));
  position.z=Math.max(-halfLength+2,Math.min(halfLength-2,position.z));
  if(nearBoard)position.y=Math.max(12,position.y);
  return position;
}
