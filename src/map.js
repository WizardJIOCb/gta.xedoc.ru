export const BOUNDS = Object.freeze({minX:-266,maxX:54,minZ:-424,maxZ:170});
export const AVENUES = [-256,-192,-128,-64,0];
export const CROSS_STREETS = [-416,-352,-288,-224,-160,-96,-32,32,96,160];

export function districtName(x,z) {
  if (z < -224) return 'Marina Keys';
  if (x < -132 || z > 96) return 'Little Havana';
  return x < -32 ? 'Downtown' : 'Ocean Drive';
}
