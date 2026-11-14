// ES-module entry: `import TifTerrain, { mount } from './tif-terrain.esm.js'`
// With a bundler that already includes Cesium:  TifTerrain.setLibraries({ Cesium, GeoTIFF })
import './tif-terrain.js';

const TifTerrain = globalThis.TifTerrain;
export default TifTerrain;
export const mount = (...a) => TifTerrain.mount(...a);
export const createTerrainProvider = (...a) => TifTerrain.createTerrainProvider(...a);
export const loadDem = (...a) => TifTerrain.loadDem(...a);
export const loadRain = (...a) => TifTerrain.loadRain(...a);
export const setLibraries = (l) => TifTerrain.setLibraries(l);
