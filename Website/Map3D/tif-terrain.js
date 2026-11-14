/*!
 * tif-terrain.js — GeoTIFF DEM -> CesiumJS terrain, as a drop-in embeddable module.
 *
 * Port of the raylib/C++ mapRenderer: the quadtree / frustum culling / screen-space-error
 * LOD / skirts that the C++ code did by hand are now done by Cesium's globe; this module
 * supplies the terrain tiles (quantized mesh with per-vertex normals) sampled from the DEM.
 *
 * Usage (any website):
 *
 *   <script src="tif-terrain.js"></script>
 *   <tif-terrain src="dem.tif" style="height:500px"></tif-terrain>
 *
 *   // or programmatically
 *   const map = await TifTerrain.mount(document.getElementById('box'), { src: 'dem.tif' });
 *
 *   // or into a Cesium Viewer the host page already has
 *   viewer.terrainProvider = await TifTerrain.createTerrainProvider('dem.tif');
 *
 * Cesium and geotiff.js are loaded from the CDN on demand when not already on the page
 * (window.Cesium / window.GeoTIFF), or can be injected with TifTerrain.setLibraries().
 */
(function (global) {
  'use strict';

  const VERSION = '1.0.0';
  const CDN = {
    cesiumBase: 'https://cdn.jsdelivr.net/npm/cesium@1.146.0/Build/Cesium/',
    geotiff: 'https://cdn.jsdelivr.net/npm/geotiff@2.1.3/dist-browser/geotiff.js',
  };
  const GRID = 65;                // samples per tile side (64 quads, like Cesium heightmaps)
  const Q = 32767;                // quantized-mesh coordinate range

  let libs = { Cesium: null, GeoTIFF: null };
  const demCache = new Map();

  // ------------------------------------------------------------------ dependency loading
  const scriptPromises = {};
  function loadScript(src) {
    if (!scriptPromises[src]) {
      scriptPromises[src] = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.crossOrigin = 'anonymous';
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Could not load ' + src));
        document.head.appendChild(s);
      });
    }
    return scriptPromises[src];
  }
  function loadCss(href) {
    if ([...document.querySelectorAll('link[rel=stylesheet]')].some((l) => l.href === href)) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.appendChild(l);
  }

  async function ensureLibraries(opts = {}) {
    const base = opts.cesiumBaseUrl || CDN.cesiumBase;
    if (!libs.Cesium) {
      if (!global.Cesium) {
        global.CESIUM_BASE_URL = global.CESIUM_BASE_URL || base;
        await loadScript(base + 'Cesium.js');
      }
      libs.Cesium = global.Cesium;
    }
    if (opts.withWidgets !== false && typeof document !== 'undefined') {
      const cssBase = global.CESIUM_BASE_URL || base;
      loadCss(cssBase.replace(/\/?$/, '/') + 'Widgets/widgets.css');
    }
    if (!libs.GeoTIFF) {
      if (!global.GeoTIFF) await loadScript(opts.geotiffUrl || CDN.geotiff);
      libs.GeoTIFF = global.GeoTIFF;
    }
    return libs;
  }

  // ------------------------------------------------------------------ DEM loading
  async function fetchWithProgress(url, onProgress, signal) {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} while fetching ${url}`);
    const total = Number(res.headers.get('content-length')) || 0;
    if (!res.body || !total || !onProgress) return res.arrayBuffer();
    const reader = res.body.getReader();
    const buf = new Uint8Array(total);
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (got + value.length > buf.length) {           // content-length lied (e.g. gzip)
        const chunks = [buf.subarray(0, got), value];
        const rest = new Uint8Array(await new Response(new Blob(chunks)).arrayBuffer());
        return rest.buffer;
      }
      buf.set(value, got);
      got += value.length;
      onProgress({ phase: 'download', loaded: got, total });
    }
    return buf.buffer.slice(0, got);
  }

  /**
   * Loads a single-band GeoTIFF DEM in geographic coordinates (EPSG:4326 or any lon/lat CRS).
   * Returns a mip pyramid of Float32 grids with NaN for no-data.
   */
  async function openTiff(source, progress, signal) {
    const { GeoTIFF } = libs;
    if (source instanceof ArrayBuffer) return GeoTIFF.fromArrayBuffer(source);
    if (typeof Blob !== 'undefined' && source instanceof Blob) return GeoTIFF.fromBlob(source);
    if (typeof source === 'string' || source instanceof URL) {
      return GeoTIFF.fromArrayBuffer(await fetchWithProgress(String(source), progress, signal));
    }
    throw new Error('Unsupported GeoTIFF source (use a URL, File/Blob or ArrayBuffer)');
  }

  function requireGeographic(keys) {
    const geographic = keys.GTModelTypeGeoKey === 2 || (keys.GeographicTypeGeoKey && !keys.ProjectedCSTypeGeoKey);
    if (!geographic) {
      throw new Error('Only geographic (lon/lat, e.g. EPSG:4326) GeoTIFFs are supported. ' +
        'Reproject first: gdalwarp -t_srs EPSG:4326 in.tif out.tif');
    }
  }

  async function loadDem(source, opts = {}) {
    await ensureLibraries({ ...opts, withWidgets: false });
    const { GeoTIFF } = libs;
    const progress = opts.onProgress || (() => {});

    const tiff = await openTiff(source, progress, opts.signal);
    const image = await tiff.getImage();
    const fullW = image.getWidth();
    const fullH = image.getHeight();
    const keys = image.getGeoKeys() || {};
    requireGeographic(keys);
    const [ox, oy] = image.getOrigin();
    const [rx, ry] = image.getResolution();         // ry is negative for north-up rasters
    // PixelIsPoint (GTRasterTypeGeoKey = 2): tie point is the centre of pixel 0
    const half = keys.GTRasterTypeGeoKey === 2 ? 0 : 0.5;

    // Optional crop: opts.bounds = [west, south, east, north] in degrees. Only that pixel
    // window is decoded; pixels whose area touches the box are kept.
    let win = [0, 0, fullW, fullH];
    const bounds = parseBounds(opts.bounds);
    if (bounds) {
      const [w, s, e, n] = bounds;
      const px = (lon) => (lon - ox) / rx, py = (lat) => (lat - oy) / ry;
      win = [
        Math.max(0, Math.floor(Math.min(px(w), px(e)))), Math.max(0, Math.floor(Math.min(py(n), py(s)))),
        Math.min(fullW, Math.ceil(Math.max(px(w), px(e)))), Math.min(fullH, Math.ceil(Math.max(py(n), py(s)))),
      ];
      if (win[2] - win[0] < 2 || win[3] - win[1] < 2) throw new Error('bounds do not overlap the DEM');
    }
    const width = win[2] - win[0], height = win[3] - win[1];

    progress({ phase: 'decode' });
    let pool = null;
    if (opts.workers !== false && GeoTIFF.Pool && typeof Worker !== 'undefined') {
      try { pool = new GeoTIFF.Pool(); } catch (e) { pool = null; }
    }
    let raster;
    try {
      raster = (await image.readRasters({ samples: [0], window: win, pool }))[0];
    } catch (e) {
      if (!pool) throw e;                              // workers blocked (CSP)? retry inline
      raster = (await image.readRasters({ samples: [0], window: win }))[0];
    } finally {
      if (pool) pool.destroy();
    }

    const noData = opts.noData !== undefined ? opts.noData : image.getGDALNoData();
    const data = raster instanceof Float32Array ? raster : Float32Array.from(raster);
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      if (!Number.isFinite(v) || (noData !== null && noData !== undefined && v === noData) || v < -1e5) {
        data[i] = NaN;
      } else {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (min === Infinity) throw new Error('DEM contains no valid elevation samples');

    progress({ phase: 'pyramid' });
    const levels = [{
      w: width, h: height, data,
      lon0: ox + (win[0] + half) * rx, lat0: oy + (win[1] + half) * ry,    // centre of pixel (0,0) of the window
      dLon: rx, dLat: ry,
    }];
    while (levels[levels.length - 1].w > GRID || levels[levels.length - 1].h > GRID) {
      levels.push(downsample(levels[levels.length - 1]));
    }

    const lons = [levels[0].lon0, levels[0].lon0 + (width - 1) * rx];
    const lats = [levels[0].lat0, levels[0].lat0 + (height - 1) * ry];
    return {
      width, height, min, max, levels,
      // extent of the sample centres, degrees
      west: Math.min(...lons), east: Math.max(...lons),
      south: Math.min(...lats), north: Math.max(...lats),
      resolution: Math.abs(rx),
    };
  }

  // [w,s,e,n] array or "w,s,e,n" string -> numbers, or null
  function parseBounds(b) {
    if (!b) return null;
    const v = (typeof b === 'string' ? b.split(',') : Array.from(b)).map(Number);
    if (v.length !== 4 || !v.every(Number.isFinite) || v[0] >= v[2] || v[1] >= v[3]) {
      throw new Error('bounds must be [west, south, east, north] in degrees');
    }
    return v;
  }

  // 2x2 box filter that ignores NaN
  function downsample(src) {
    const w = Math.ceil(src.w / 2), h = Math.ceil(src.h / 2);
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const y0 = 2 * y, y1 = Math.min(2 * y + 1, src.h - 1);
      for (let x = 0; x < w; x++) {
        const x0 = 2 * x, x1 = Math.min(2 * x + 1, src.w - 1);
        let s = 0, n = 0, v;
        v = src.data[y0 * src.w + x0]; if (v === v) { s += v; n++; }
        v = src.data[y0 * src.w + x1]; if (v === v) { s += v; n++; }
        v = src.data[y1 * src.w + x0]; if (v === v) { s += v; n++; }
        v = src.data[y1 * src.w + x1]; if (v === v) { s += v; n++; }
        out[y * w + x] = n ? s / n : NaN;
      }
    }
    return {
      w, h, data: out,
      lon0: src.lon0 + 0.5 * src.dLon, lat0: src.lat0 + 0.5 * src.dLat,
      dLon: src.dLon * 2, dLat: src.dLat * 2,
    };
  }

  // Bilinear sample (degrees) with NaN-aware weights. Returns NaN outside the raster / on no-data.
  function sampleLevel(L, lon, lat) {
    const fx = (lon - L.lon0) / L.dLon, fy = (lat - L.lat0) / L.dLat;
    if (fx < -0.5 || fy < -0.5 || fx > L.w - 0.5 || fy > L.h - 0.5) return NaN;
    const cx = Math.min(Math.max(fx, 0), L.w - 1), cy = Math.min(Math.max(fy, 0), L.h - 1);
    const x0 = Math.min(Math.floor(cx), L.w - 2 < 0 ? 0 : L.w - 2), y0 = Math.min(Math.floor(cy), L.h - 2 < 0 ? 0 : L.h - 2);
    const x1 = Math.min(x0 + 1, L.w - 1), y1 = Math.min(y0 + 1, L.h - 1);
    const tx = cx - x0, ty = cy - y0;
    const d = L.data, w = L.w;
    const v00 = d[y0 * w + x0], v10 = d[y0 * w + x1], v01 = d[y1 * w + x0], v11 = d[y1 * w + x1];
    const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
    let s = 0, n = 0;
    if (v00 === v00) { s += v00 * w00; n += w00; }
    if (v10 === v10) { s += v10 * w10; n += w10; }
    if (v01 === v01) { s += v01 * w01; n += w01; }
    if (v11 === v11) { s += v11 * w11; n += w11; }
    return n > 1e-6 ? s / n : NaN;
  }

  // ------------------------------------------------------------------ terrain provider
  /**
   * Cesium TerrainProvider backed by an in-memory DEM pyramid. Generates QuantizedMeshTerrainData
   * with oct-encoded vertex normals so terrain lighting / hillshading works.
   */
  class TifTerrainProvider {
    constructor(dem, opts = {}) {
      const C = libs.Cesium;
      this._dem = dem;
      this._fill = opts.fillHeight !== undefined ? opts.fillHeight : 0;
      this._ellipsoid = opts.ellipsoid || C.Ellipsoid.WGS84;
      this._tilingScheme = new C.GeographicTilingScheme({ ellipsoid: this._ellipsoid });
      this._errorEvent = new C.Event();
      this._credit = opts.credit ? new C.Credit(opts.credit) : undefined;
      this._levelZeroError = C.TerrainProvider.getEstimatedLevelZeroGeometricErrorForAHeightmap(
        this._ellipsoid, GRID, this._tilingScheme.getNumberOfXTilesAtLevel(0));
      // deepest level whose sample spacing still adds detail (C++: LOD 0 = full resolution)
      const level0Span = 180 / (GRID - 1);
      this._maxLevel = opts.maximumLevel !== undefined ? opts.maximumLevel
        : Math.max(0, Math.ceil(Math.log2(level0Span / dem.resolution)));
      this._demRect = C.Rectangle.fromDegrees(dem.west, dem.south, dem.east, dem.north);
      this._scratch = {
        carto: new C.Cartographic(), cart: new C.Cartesian3(), oct: new C.Cartesian2(),
      };
    }

    get tilingScheme() { return this._tilingScheme; }
    get errorEvent() { return this._errorEvent; }
    get credit() { return this._credit; }
    get hasWaterMask() { return false; }
    get hasVertexNormals() { return true; }
    get availability() { return undefined; }
    get ready() { return true; }                     // for older Cesium versions
    get readyPromise() { return Promise.resolve(true); }

    /** Extent of the DEM as a Cesium.Rectangle (radians). */
    get rectangle() { return this._demRect; }
    get dem() { return this._dem; }
    get maximumLevel() { return this._maxLevel; }

    getLevelMaximumGeometricError(level) { return this._levelZeroError / (1 << level); }

    getTileDataAvailable(x, y, level) {
      if (level > this._maxLevel) return false;
      if (level <= 2) return true;
      const r = this._tilingScheme.tileXYToRectangle(x, y, level);
      return libs.Cesium.Rectangle.intersection(r, this._demRect) !== undefined;
    }

    loadTileDataAvailability() { return undefined; }

    requestTileGeometry(x, y, level /*, request */) {
      try {
        return Promise.resolve(this._buildTile(x, y, level));
      } catch (e) {
        return Promise.reject(e);
      }
    }

    /** Elevation in metres (no exaggeration) at lon/lat degrees, or undefined outside the DEM. */
    sampleHeight(lonDeg, latDeg) {
      const v = sampleLevel(this._dem.levels[0], lonDeg, latDeg);
      return v === v ? v : undefined;
    }

    _buildTile(x, y, level) {
      const C = libs.Cesium;
      const dem = this._dem;
      const rect = this._tilingScheme.tileXYToRectangle(x, y, level);
      const west = C.Math.toDegrees(rect.west), east = C.Math.toDegrees(rect.east);
      const south = C.Math.toDegrees(rect.south), north = C.Math.toDegrees(rect.north);
      const n = GRID, N = n * n;

      // pick the pyramid level whose pixel spacing matches the tile's sample spacing
      const spacing = (east - west) / (n - 1);
      let li = Math.floor(Math.log2(spacing / dem.resolution));
      li = Math.min(Math.max(li, 0), dem.levels.length - 1);
      const L = dem.levels[li];

      const overlaps = !(east < dem.west - spacing || west > dem.east + spacing ||
                         north < dem.south - spacing || south > dem.north + spacing);
      const heights = new Float64Array(N);
      let minH = Infinity, maxH = -Infinity;
      for (let r = 0; r < n; r++) {
        const lat = north - (r / (n - 1)) * (north - south);
        for (let c = 0; c < n; c++) {
          const lon = west + (c / (n - 1)) * (east - west);
          let h = overlaps ? sampleLevel(L, lon, lat) : NaN;
          if (h !== h) h = this._fill;
          heights[r * n + c] = h;
          if (h < minH) minH = h;
          if (h > maxH) maxH = h;
        }
      }

      // positions (ECEF) for normals / bounding volumes
      const ell = this._ellipsoid;
      const pos = new Float64Array(N * 3);
      const carto = this._scratch.carto, cart = this._scratch.cart;
      const points = new Array(N);
      for (let r = 0; r < n; r++) {
        const lat = rect.north - (r / (n - 1)) * (rect.north - rect.south);
        for (let c = 0; c < n; c++) {
          const i = r * n + c;
          carto.longitude = rect.west + (c / (n - 1)) * (rect.east - rect.west);
          carto.latitude = lat;
          carto.height = heights[i];
          ell.cartographicToCartesian(carto, cart);
          pos[i * 3] = cart.x; pos[i * 3 + 1] = cart.y; pos[i * 3 + 2] = cart.z;
          points[i] = new C.Cartesian3(cart.x, cart.y, cart.z);
        }
      }

      // quantized vertices: u (west->east), v (south->north), h (min->max)
      const qv = new Uint16Array(N * 3);
      const range = maxH - minH;
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const i = r * n + c;
          qv[i] = Math.round((c / (n - 1)) * Q);
          qv[N + i] = Math.round(((n - 1 - r) / (n - 1)) * Q);
          qv[2 * N + i] = range > 0 ? Math.round(((heights[i] - minH) / range) * Q) : 0;
        }
      }

      // indices, counter-clockwise seen from above
      const indices = new Uint16Array((n - 1) * (n - 1) * 6);
      let k = 0;
      for (let r = 0; r < n - 1; r++) {
        for (let c = 0; c < n - 1; c++) {
          const nw = r * n + c, ne = nw + 1, sw = nw + n, se = sw + 1;
          indices[k++] = sw; indices[k++] = se; indices[k++] = ne;
          indices[k++] = sw; indices[k++] = ne; indices[k++] = nw;
        }
      }

      // oct-encoded normals from central differences on the ECEF surface
      const normals = new Uint8Array(N * 2);
      const e = new C.Cartesian3(), s = new C.Cartesian3(), nrm = new C.Cartesian3();
      const oct = this._scratch.oct;
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const i = r * n + c;
          const iw = r * n + Math.max(c - 1, 0), ie = r * n + Math.min(c + 1, n - 1);
          const iN = Math.max(r - 1, 0) * n + c, iS = Math.min(r + 1, n - 1) * n + c;
          e.x = pos[ie * 3] - pos[iw * 3]; e.y = pos[ie * 3 + 1] - pos[iw * 3 + 1]; e.z = pos[ie * 3 + 2] - pos[iw * 3 + 2];
          s.x = pos[iN * 3] - pos[iS * 3]; s.y = pos[iN * 3 + 1] - pos[iS * 3 + 1]; s.z = pos[iN * 3 + 2] - pos[iS * 3 + 2];
          C.Cartesian3.cross(e, s, nrm);              // east x north = up
          if (C.Cartesian3.magnitudeSquared(nrm) < 1e-20) {
            ell.geodeticSurfaceNormal(points[i], nrm);
          } else C.Cartesian3.normalize(nrm, nrm);
          C.AttributeCompression.octEncode(nrm, oct);
          normals[i * 2] = oct.x; normals[i * 2 + 1] = oct.y;
        }
      }

      const west_ = [], south_ = [], east_ = [], north_ = [];
      for (let t = 0; t < n; t++) {
        west_.push((n - 1 - t) * n);                  // south -> north
        east_.push((n - 1 - t) * n + n - 1);
        south_.push((n - 1) * n + t);                 // west -> east
        north_.push(t);
      }

      const boundingSphere = C.BoundingSphere.fromPoints(points);
      const obb = C.OrientedBoundingBox.fromRectangle(rect, minH, maxH, ell);
      const occlusion = horizonOcclusionPoint(C, ell, boundingSphere.center, points);
      const skirt = Math.max(this.getLevelMaximumGeometricError(level) * 5, 5);

      let childTileMask = 0;
      if (level < this._maxLevel) {
        const cx = 2 * x, cy = 2 * y, cl = level + 1;
        if (this.getTileDataAvailable(cx, cy + 1, cl)) childTileMask |= 1;     // SW
        if (this.getTileDataAvailable(cx + 1, cy + 1, cl)) childTileMask |= 2; // SE
        if (this.getTileDataAvailable(cx, cy, cl)) childTileMask |= 4;         // NW
        if (this.getTileDataAvailable(cx + 1, cy, cl)) childTileMask |= 8;     // NE
      }

      return new C.QuantizedMeshTerrainData({
        quantizedVertices: qv,
        indices,
        encodedNormals: normals,
        minimumHeight: minH,
        maximumHeight: maxH,
        boundingSphere,
        orientedBoundingBox: obb,
        horizonOcclusionPoint: occlusion,
        westIndices: west_, southIndices: south_, eastIndices: east_, northIndices: north_,
        westSkirtHeight: skirt, southSkirtHeight: skirt, eastSkirtHeight: skirt, northSkirtHeight: skirt,
        childTileMask,
      });
    }
  }

  // Horizon culling point in ellipsoid-scaled space (same algorithm Cesium's EllipsoidalOccluder uses)
  function horizonOcclusionPoint(C, ell, center, points) {
    const dir = ell.transformPositionToScaledSpace(center, new C.Cartesian3());
    C.Cartesian3.normalize(dir, dir);
    const sp = new C.Cartesian3(), cr = new C.Cartesian3();
    let maxMag = 0;
    for (const p of points) {
      ell.transformPositionToScaledSpace(p, sp);
      let magSq = C.Cartesian3.magnitudeSquared(sp);
      let mag = Math.sqrt(magSq);
      C.Cartesian3.divideByScalar(sp, mag, sp);
      magSq = Math.max(1, magSq);
      mag = Math.max(1, mag);
      const cosA = C.Cartesian3.dot(sp, dir);
      const sinA = C.Cartesian3.magnitude(C.Cartesian3.cross(sp, dir, cr));
      const cosB = 1 / mag, sinB = Math.sqrt(magSq - 1) * cosB;
      const m = 1 / (cosA * cosB - sinA * sinB);
      if (m > maxMag) maxMag = m;
    }
    if (!(maxMag > 0) || !Number.isFinite(maxMag)) return undefined;
    return C.Cartesian3.multiplyByScalar(dir, maxMag, new C.Cartesian3());
  }

  async function createTerrainProvider(source, opts = {}) {
    await ensureLibraries({ ...opts, withWidgets: false });
    let dem;
    if (source && source.levels) dem = source;
    else if (typeof source === 'string' || source instanceof URL) {
      // several viewers on one page share one decoded DEM per URL
      const b = parseBounds(opts.bounds);
      const key = new URL(String(source), typeof location !== 'undefined' ? location.href : undefined).href +
        (b ? '#bounds=' + b.join(',') : '');
      if (!demCache.has(key)) {
        const p = loadDem(source, opts);
        demCache.set(key, p);
        p.catch(() => demCache.delete(key));
      }
      dem = await demCache.get(key);
    } else dem = await loadDem(source, opts);
    return new TifTerrainProvider(dem, opts);
  }

  // ------------------------------------------------------------------ weather: rain map, clouds, rain
  // Port of the C++ Weather class:
  //  * a time-mean precipitation GeoTIFF (NASA Giovanni GPM IMERG mm/hr, MERRA-2 kg m-2 s-1, ... -
  //    units from the GDAL metadata) is converted to mm/year and draped over the terrain as a
  //    colour-ramp imagery layer with isolines;
  //  * thousands of soft cloud puffs drift with the wind; each is shown where the local normalised
  //    rain rate exceeds its random threshold -> rainier = denser, taller, darker clouds;
  //  * scrolling rain shafts below dense clouds, and line rain drops in a box around the camera
  //    when flying underneath rainy clouds.
  // Puffs, shafts and drops are drawn by one custom primitive, sorted back to front like the C++.
  const SECONDS_PER_YEAR = 365.25 * 86400;
  const RAIN_RAMP = [[245, 222, 140], [140, 209, 115], [46, 168, 179], [38, 97, 209], [97, 41, 158]];
  const SKY = [0.62, 0.74, 0.88];
  const WX_FOG = 5e-6;                     // distance haze on clouds (per metre)
  const WEATHER_DEFAULTS = {
    clouds: true, rain: true,
    coverage: 1,                           // multiplies cloud density
    windSpeed: 60,                         // m/s (visually exaggerated)
    windDir: 0.35,                         // radians, 0 = blowing east, + = towards south
    overlay: true, overlayOpacity: 0.55,   // precipitation map
    water: true, waterAmount: 1,           // standing water in flat hollows, x precipitation
    simulation: true,                      // true: water starts empty and fills up after "Start simulation"
    fillSeconds: 40,                       // seconds of simulated rain until the hollows are ~full
  };
  const rainCache = new Map();

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const wrap = (v, m) => { v %= m; return v < 0 ? v + m : v; };

  function hash(x, y, s) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 2246822519)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) & 0xffffff) / 16777216;
  }
  // periodic value noise (period px, py in lattice cells)
  function noise(x, y, px, py, seed) {
    const ix = Math.floor(x), iy = Math.floor(y);
    let fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const x0 = ((ix % px) + px) % px, x1 = (((ix + 1) % px) + px) % px;
    const y0 = ((iy % py) + py) % py, y1 = (((iy + 1) % py) + py) % py;
    const a = hash(x0, y0, seed), b = hash(x1, y0, seed), c = hash(x0, y1, seed), d = hash(x1, y1, seed);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function fbm(x, y, period, seed) {
    let s = 0, amp = 0.5, norm = 0;
    for (let o = 0; o < 5; o++) {
      s += amp * noise(x, y, period, period, seed + o * 17);
      norm += amp;
      x *= 2; y *= 2; period *= 2;
      amp *= 0.5;
    }
    return s / norm;
  }
  const clusterNoise = (bx, bz) => fbm(bx / 26000 + 50, bz / 26000 + 50, 1 << 16, 77);
  // local cloud cover 0..1: the cluster pattern is revealed more the rainier the area is
  function cover(cluster, density) {
    const edge = 0.98 - 0.80 * density;
    return smooth(edge - 0.06, edge + 0.12, cluster);
  }
  function mulberry32(seed) {
    return () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rampColor(t) {
    t = clamp(t, 0, 1) * (RAIN_RAMP.length - 1);
    const i = Math.min(Math.floor(t), RAIN_RAMP.length - 2), f = t - i, a = RAIN_RAMP[i], b = RAIN_RAMP[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }

  // <Item name="...">value</Item> pairs of the GDAL_METADATA tag
  function gdalItems(xml) {
    const out = [], re = /<Item\s+name="([^"]*)"[^>]*>([\s\S]*?)<\/Item>/g;
    let m;
    while ((m = re.exec(xml || ''))) out.push([m[1], m[2].trim()]);
    return out;
  }
  // first item whose name ends in key and does not belong to the lat/lon/time coordinate variables
  function gdalItem(items, key) {
    for (const [name, v] of items) if (name.endsWith(key) && !/^(lat|lon|time)#/.test(name)) return v;
    return '';
  }
  // factor converting the raster's precipitation rate to mm / year
  function toMmPerYear(unitsIn, maxValue) {
    const u = String(unitsIn || '').replace(/\s+/g, '').toLowerCase();
    if (['mm/hr', 'mm/h', 'mmhr-1', 'mmh-1'].includes(u)) return 365.25 * 24;
    if (['kgm-2s-1', 'mm/s', 'kg/m2/s', 'mms-1'].includes(u)) return SECONDS_PER_YEAR;
    if (['mm/day', 'mm/d', 'mmday-1', 'mmd-1'].includes(u)) return 365.25;
    if (['mm/month', 'mmmonth-1'].includes(u)) return 12;
    if (['mm/yr', 'mm/year', 'mm'].includes(u)) return 1;
    // unknown -> guess from the magnitude of a typical rain rate
    if (maxValue < 0.01) return SECONDS_PER_YEAR;
    if (maxValue < 3) return 365.25 * 24;
    if (maxValue < 60) return 365.25;
    return 1;
  }

  /** Loads a time-mean precipitation GeoTIFF (lon/lat). Values are returned in mm / year. */
  async function loadRain(source, opts = {}) {
    await ensureLibraries({ ...opts, withWidgets: false });
    const tiff = await openTiff(source, opts.onProgress || (() => {}), opts.signal);
    const image = await tiff.getImage();
    requireGeographic(image.getGeoKeys() || {});
    const keys = image.getGeoKeys() || {};
    const w = image.getWidth(), h = image.getHeight();
    const [ox, oy] = image.getOrigin();
    const [rx, ry] = image.getResolution();
    if (!(rx > 0) || !(ry < 0)) throw new Error('precipitation raster must be north-up with georeferencing');
    const half = keys.GTRasterTypeGeoKey === 2 ? 0.5 : 0;     // PixelIsPoint -> move origin to the pixel corner
    const raster = (await image.readRasters({ samples: [0] }))[0];
    const data = Float32Array.from(raster);
    const noData = image.getGDALNoData();
    let maxV = -Infinity, sum = 0, n = 0;
    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      if (!Number.isFinite(v) || v === noData || v < -1e3 || v > 1e10) data[i] = NaN;
      else { if (v > maxV) maxV = v; sum += v; n++; }
    }
    if (!n) throw new Error('precipitation raster has no valid samples');
    for (let i = 0; i < data.length; i++) if (data[i] !== data[i]) data[i] = sum / n;

    const fd = image.fileDirectory || {};
    const items = gdalItems(typeof fd.GDAL_METADATA === 'string' ? fd.GDAL_METADATA : '');
    const units = gdalItem(items, '#units') || gdalItem(items, 'units');
    const k = toMmPerYear(units, maxV);
    for (let i = 0; i < data.length; i++) data[i] *= k;
    const prod = gdalItem(items, '#product_short_name'), ver = gdalItem(items, '#product_version');
    const name = typeof source === 'string' ? source.split(/[/\\]/).pop() : (source && source.name) || 'precipitation';
    const t0 = gdalItem(items, 'NC_GLOBAL#start_time'), t1 = gdalItem(items, 'NC_GLOBAL#end_time');
    return {
      w, h, data, units, factor: k,
      originX: ox - half * rx, originY: oy - half * ry, sx: rx, sy: -ry,   // top-left corner, pixel size (deg)
      source: prod ? prod + (ver ? ' v' + ver : '') : name,
      period: t0 && t1 ? t0.slice(0, 10) + '..' + t1.slice(0, 10) : '',
    };
  }

  function getRain(source, opts) {
    if (!(typeof source === 'string' || source instanceof URL)) return loadRain(source, opts);
    const key = new URL(String(source), typeof location !== 'undefined' ? location.href : undefined).href;
    if (!rainCache.has(key)) {
      const p = loadRain(source, opts);
      rainCache.set(key, p);
      p.catch(() => rainCache.delete(key));
    }
    return rainCache.get(key);
  }

  // mm / year at lon/lat, smoothstep-weighted bilinear (no diamond pattern from the very coarse grid),
  // clamped to the edge outside the raster
  function sampleRain(R, lon, lat) {
    const fx = clamp((lon - R.originX) / R.sx - 0.5, 0, R.w - 1);
    const fy = clamp((R.originY - lat) / R.sy - 0.5, 0, R.h - 1);
    const x0 = Math.min(Math.floor(fx), Math.max(R.w - 2, 0)), y0 = Math.min(Math.floor(fy), Math.max(R.h - 2, 0));
    const x1 = Math.min(x0 + 1, R.w - 1), y1 = Math.min(y0 + 1, R.h - 1);
    let tx = fx - x0, ty = fy - y0;
    tx = tx * tx * (3 - 2 * tx);
    ty = ty * ty * (3 - 2 * ty);
    const d = R.data, w = R.w;
    const a = d[y0 * w + x0] + (d[y0 * w + x1] - d[y0 * w + x0]) * tx;
    const b = d[y1 * w + x0] + (d[y1 * w + x1] - d[y1 * w + x0]) * tx;
    return a + (b - a) * ty;
  }

  // range over the rain pixels that touch the terrain (the sea far away doesn't count);
  // colour / cloud scale on robust 5th / 97th percentiles
  function rainStats(R, west, south, east, north) {
    const x0 = clamp(Math.floor((west - R.originX) / R.sx), 0, R.w - 1);
    const x1 = clamp(Math.ceil((east - R.originX) / R.sx) - 1, 0, R.w - 1);
    const y0 = clamp(Math.floor((R.originY - north) / R.sy), 0, R.h - 1);
    const y1 = clamp(Math.ceil((R.originY - south) / R.sy) - 1, 0, R.h - 1);
    const v = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) v.push(R.data[y * R.w + x]);
    v.sort((a, b) => a - b);
    const minMm = v[0], maxMm = v[v.length - 1];
    let lowMm = v[Math.floor(0.05 * (v.length - 1))], highMm = v[Math.floor(0.97 * (v.length - 1))];
    if (!(highMm > lowMm)) { lowMm = minMm; highMm = maxMm > minMm ? maxMm : minMm + 1; }
    return { minMm, maxMm, lowMm, highMm };
  }

  // normalised precipitation as a colour image over [west..east] x [south..north], with thin isolines
  // every 1/8 of the range (same ramp as the C++ terrain shader)
  function makeRainOverlayCanvas(R, west, south, east, north, low, high) {
    const W = 2048, H = clamp(Math.round(W * (north - south) / (east - west)), 64, 2048);
    const r = new Float32Array(W * H);
    for (let j = 0; j < H; j++) {
      const lat = north - ((j + 0.5) / H) * (north - south);
      for (let i = 0; i < W; i++) {
        const lon = west + ((i + 0.5) / W) * (east - west);
        r[j * W + i] = clamp((sampleRain(R, lon, lat) - low) / (high - low), 0, 1);
      }
    }
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(W, H), px = img.data;
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const k = j * W + i, v = r[k], band = v * 8;
        const fw = Math.abs(r[j * W + Math.min(i + 1, W - 1)] * 8 - band) + Math.abs(r[Math.min(j + 1, H - 1) * W + i] * 8 - band);
        const dist = Math.abs(band + 0.5 - Math.floor(band + 0.5) - 0.5);
        const line = fw > 1e-9 ? 1 - smooth(0, 2 * fw, dist) : 0;
        const c = rampColor(v), m = line * 0.45;
        px[k * 4] = c[0] + (20 - c[0]) * m;
        px[k * 4 + 1] = c[1] + (26 - c[1]) * m;
        px[k * 4 + 2] = c[2] + (41 - c[2]) * m;
        px[k * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  // ------------------------------------------------------------------ standing water (ponding)
  // Where the surface gradient is ~0 water can collect. Per DEM cell (on a ~2k pyramid level):
  //  * pit depth: priority-flood depression filling (Barnes et al. 2014) -> closed hollows / basins
  //    on the slopes fill up to their spill height;
  //  * flat hollows: |grad h| ~ 0 AND the cell lies below its neighbourhood mean (benches, saddles,
  //    terraces on mountainsides that hold water instead of draining it);
  // wetness 0..1 is then multiplied by the local precipitation (see makeWaterCanvas).
  const WATER_MAX_GRID = 2600;               // pyramid level used (cells per side, at most)
  const WATER_FLAT_DEG = [0.6, 3.5];         // slope (degrees): fully flat .. no ponding
  const WATER_PIT_M = [0.3, 4];              // depression depth (m): starts .. full wetness
  const WATER_HOLLOW_M = [0.4, 5];           // below neighbourhood mean (m)
  const WATER_HOLLOW_R = 4;                  // neighbourhood radius (cells)
  const WATER_SHELF_DEG = [7, 14];            // mean slope around a cell for it to count as a mountainside
  const WATER_SHELF_R = 5;                   // ... measured over this radius (cells)

  // binary min-heap of cell indices keyed by a Float32 value
  function makeHeap(cap) {
    const id = new Int32Array(cap), key = new Float32Array(cap);
    let n = 0;
    return {
      get size() { return n; },
      push(i, k) {
        let c = n++;
        while (c > 0) {
          const p = (c - 1) >> 1;
          if (key[p] <= k) break;
          id[c] = id[p]; key[c] = key[p]; c = p;
        }
        id[c] = i; key[c] = k;
      },
      pop() {
        const top = id[0], li = id[--n], lk = key[n];
        let c = 0;
        for (;;) {
          let m = 2 * c + 1;
          if (m >= n) break;
          if (m + 1 < n && key[m + 1] < key[m]) m++;
          if (key[m] >= lk) break;
          id[c] = id[m]; key[c] = key[m]; c = m;
        }
        id[c] = li; key[c] = lk;
        return top;
      },
    };
  }

  // box mean of radius r over valid cells (summed-area tables; invalid cells don't count)
  function boxMean(v, valid, W, H, r) {
    const S = new Float64Array((W + 1) * (H + 1)), N = new Float64Array((W + 1) * (H + 1));
    for (let y = 0; y < H; y++) {
      let rs = 0, rn = 0;
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (valid[i]) { rs += v[i]; rn++; }
        const o = (y + 1) * (W + 1) + x + 1;
        S[o] = S[o - W - 1] + rs; N[o] = N[o - W - 1] + rn;
      }
    }
    const out = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      const y0 = Math.max(0, y - r), y1 = Math.min(H, y + r + 1);
      for (let x = 0; x < W; x++) {
        const x0 = Math.max(0, x - r), x1 = Math.min(W, x + r + 1);
        const a = y0 * (W + 1), b = y1 * (W + 1);
        const n = N[b + x1] - N[b + x0] - N[a + x1] + N[a + x0];
        out[y * W + x] = n > 0 ? (S[b + x1] - S[b + x0] - S[a + x1] + S[a + x0]) / n : 0;
      }
    }
    return out;
  }

  /** Terrain-only wetness 0..1 (no rain yet) on a coarse pyramid level of the DEM. */
  function computeWetness(dem) {
    const L = dem.levels.find((l) => l.w <= WATER_MAX_GRID && l.h <= WATER_MAX_GRID) || dem.levels[dem.levels.length - 1];
    const W = L.w, H = L.h, h = L.data, N = W * H;
    const latC = L.lat0 + (H / 2) * L.dLat;
    const dx = Math.abs(L.dLon) * 111320 * Math.cos((latC * Math.PI) / 180), dy = Math.abs(L.dLat) * 110574;
    const land = new Uint8Array(N);
    for (let i = 0; i < N; i++) land[i] = h[i] > 0.5 ? 1 : 0;      // NaN / sea level -> not land

    // 1) priority-flood: water level each cell fills up to before spilling over to the sea / edge
    const filled = new Float32Array(N), closed = new Uint8Array(N), heap = makeHeap(N);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!land[i]) { closed[i] = 1; continue; }
        let edge = x === 0 || y === 0 || x === W - 1 || y === H - 1;
        if (!edge) {
          for (let k = -1; k <= 1 && !edge; k++) for (let j = -1; j <= 1; j++) if (!land[i + k * W + j]) { edge = true; break; }
        }
        if (edge) { closed[i] = 1; filled[i] = h[i]; heap.push(i, h[i]); }
      }
    }
    while (heap.size) {
      const c = heap.pop(), cx = c % W, cy = (c - cx) / W, fc = filled[c];
      for (let k = -1; k <= 1; k++) {
        const ny = cy + k;
        if (ny < 0 || ny >= H) continue;
        for (let j = -1; j <= 1; j++) {
          const nx = cx + j;
          if (nx < 0 || nx >= W) continue;
          const n = ny * W + nx;
          if (closed[n]) continue;
          closed[n] = 1;
          const f = h[n] > fc ? h[n] : fc;
          filled[n] = f;
          heap.push(n, f);
        }
      }
    }

    // 2) slope |grad h| = tan(slope angle), central differences in metres
    const grad = new Float32Array(N);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!land[i]) continue;
        const hl = x > 0 && land[i - 1] ? h[i - 1] : h[i], hr = x < W - 1 && land[i + 1] ? h[i + 1] : h[i];
        const hu = y > 0 && land[i - W] ? h[i - W] : h[i], hd = y < H - 1 && land[i + W] ? h[i + W] : h[i];
        const gx = (hr - hl) / (2 * dx), gy = (hd - hu) / (2 * dy);
        grad[i] = Math.sqrt(gx * gx + gy * gy);
      }
    }
    // 3) wetness = max(filled pit, flat hollow, shelf on a mountainside)
    const mean = boxMean(h, land, W, H, WATER_HOLLOW_R);
    const meanGrad = boxMean(grad, land, W, H, WATER_SHELF_R);
    const wet = new Float32Array(N);
    const tan = (deg) => Math.tan((deg * Math.PI) / 180);
    const tanA = tan(WATER_FLAT_DEG[0]), tanB = tan(WATER_FLAT_DEG[1]);
    const steepA = tan(WATER_SHELF_DEG[0]), steepB = tan(WATER_SHELF_DEG[1]);
    for (let i = 0; i < N; i++) {
      if (!land[i]) continue;
      const g = grad[i];
      const pit = smooth(WATER_PIT_M[0], WATER_PIT_M[1], filled[i] - h[i]);
      const hollow = smooth(WATER_HOLLOW_M[0], WATER_HOLLOW_M[1], mean[i] - h[i]);
      const flat = 1 - smooth(tanA, tanB, g);
      // shelf: a bench / saddle / terrace much flatter than the steep slope around it, not convex
      const steep = smooth(steepA, steepB, meanGrad[i]);
      const bench = 1 - smooth(0.3, 0.6, g / (meanGrad[i] + 1e-6));
      const notRidge = smooth(-4, 2, mean[i] - h[i]);
      const shelf = steep * bench * notRidge * 0.9;
      // a filled pit is flat by definition (the water surface); otherwise flat AND concave
      wet[i] = Math.max(pit, flat * hollow, shelf);
    }
    // 4) break up the pattern a little ("some places"), soften single-cell speckles
    const ox = L.lon0, oy = L.lat0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (wet[i] > 0) wet[i] *= 0.55 + 0.9 * fbm((x * dx) / 3000 + 7, (y * dy) / 3000 + 3, 1 << 16, 77);
      }
    }
    const soft = boxMean(wet, land, W, H, 1);
    for (let i = 0; i < N; i++) soft[i] = land[i] ? Math.min(1, Math.max(wet[i], soft[i]) * 0.5 + soft[i] * 0.5) : 0;
    return {
      W, H, wet: soft,
      west: ox - 0.5 * L.dLon, north: oy - 0.5 * L.dLat,               // corner of pixel (0,0)
      dLon: L.dLon, dLat: L.dLat, cellArea: dx * dy,
    };
  }

  // per-cell wetness x precipitation (relative to the wet end of the map), computed once
  function waterBase(Wt, R, highMm) {
    const { W, H, wet } = Wt, out = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      const lat = Wt.north + (y + 0.5) * Wt.dLat;
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (wet[i] > 0) out[i] = wet[i] * clamp(sampleRain(R, Wt.west + (x + 0.5) * Wt.dLon, lat) / highMm, 0, 1.5);
      }
    }
    return out;
  }

  // water = base x amount -> RGBA image. With a growing amount the deepest / wettest hollows show
  // first and the water then spreads out over the flats, so it looks like the ponds are filling up.
  function makeWaterCanvas(Wt, base, amount) {
    const { W, H } = Wt;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(W, H), px = img.data;
    let area = 0;
    for (let y = 0; y < H && amount > 0; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, bv = base[i];
        if (bv <= 0) continue;
        const water = bv * amount;
        const a = smooth(0.18, 0.55, water);
        if (a <= 0) continue;
        const d = smooth(0.4, 1.2, water);                       // shallow -> deep colour
        const o = i * 4;
        px[o] = 125 + (20 - 125) * d;               // shallow turquoise -> deep blue (stands out on the rain map)
        px[o + 1] = 220 + (115 - 220) * d;
        px[o + 2] = 235 + (195 - 235) * d;
        px[o + 3] = a * 235;
        area += a;
      }
    }
    ctx.putImageData(img, 0, 0);
    return { cv, areaKm2: (area * Wt.cellArea) / 1e6 };
  }

  // 2x2 atlas of cumulus-like puffs (union of soft blobs, flat base, bright top)
  function makePuffAtlas() {
    const C = 128, S = 2 * C;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(S, S), px = img.data;
    const U = mulberry32(1234);
    for (let v = 0; v < 4; v++) {
      const blobs = [];
      for (let i = 0; i < 6 + v; i++) {
        const a = U() * 2 * Math.PI, d = U() * 0.38;
        blobs.push([Math.cos(a) * d, Math.sin(a) * d * 0.6 - 0.05, 0.22 + U() * 0.22]);
      }
      const ox = (v & 1) * C, oy = (v >> 1) * C;
      for (let y = 0; y < C; y++) {
        for (let x = 0; x < C; x++) {
          const u = ((x + 0.5) / C) * 2 - 1, w = ((y + 0.5) / C) * 2 - 1;   // w: -1 top .. 1 bottom
          let dens = 0;
          for (const [bx, by, br] of blobs) {
            const dx = u - bx, dy = w - by;
            dens += Math.exp(-((dx * dx + dy * dy) / (br * br)) * 1.6);
          }
          const n = fbm(u * 3 + 10 + v * 7, w * 3 + 10, 8, 11 + v);
          const n2 = fbm(u * 9 + 3 + v * 5, w * 9 + 7, 32, 41 + v);
          dens *= 0.25 + 1.5 * n * (0.6 + 0.8 * n2);
          dens *= 1 - clamp((w - 0.25) / 0.45, 0, 1) * 0.85;                        // flat base
          dens *= 1 - clamp((Math.sqrt(u * u + w * w) - 0.78) / 0.2, 0, 1);          // stay inside cell
          let a = clamp((dens - 0.35) / 0.6, 0, 1);
          a = a * a * (3 - 2 * a);
          const lit = clamp(0.62 + 0.38 * (0.5 - 0.5 * w) + 0.25 * (n2 - 0.5), 0, 1);   // self-shadow
          const o = ((oy + y) * S + ox + x) * 4, c = lit * 255;
          px[o] = c; px[o + 1] = c; px[o + 2] = Math.min(255, c + 6); px[o + 3] = a * 215;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  // vertically tileable rain streaks
  function makeStreakCanvas() {
    const W = 64, H = 256;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(W, H), px = img.data;
    for (let x = 0; x < W; x++) {
      const colRand = hash(x, 0, 99);
      const streak = colRand > 0.45 ? (colRand - 0.45) / 0.55 : 0;
      const u = (x + 0.5) / W;
      for (let y = 0; y < H; y++) {
        const dash = noise(x * 0.37, y / 32, 1 << 20, H / 32, 5 + x);
        const haze = 0.30 + 0.20 * noise(x / 16, y / 64, W / 16, H / 64, 3);
        let a = haze + streak * clamp((dash - 0.35) / 0.4, 0, 1) * 0.9;
        a *= Math.pow(Math.sin(Math.PI * u), 0.8) * (0.75 + 0.25 * noise(u * 4, y / 128, 4, H / 128, 8));
        const o = (y * W + x) * 4;
        px[o] = 205; px[o + 1] = 212; px[o + 2] = 225; px[o + 3] = clamp(a, 0, 1) * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  const WX_VS = `
in vec3 position;
in vec2 st;
in vec4 color;
in float kind;
out vec2 v_st;
out vec4 v_color;
out float v_kind;
void main() {
  v_st = st;
  v_color = color;
  v_kind = kind;
  gl_Position = czm_modelViewProjection * vec4(position, 1.0);
}`;
  const WX_FS = `
uniform sampler2D u_puff;
uniform sampler2D u_streak;
uniform float u_scroll;
in vec2 v_st;
in vec4 v_color;
in float v_kind;
void main() {
  vec4 t = vec4(1.0);
  if (v_kind < 0.5) t = texture(u_puff, v_st);
  else if (v_kind < 1.5) t = texture(u_streak, vec2(v_st.x, v_st.y + u_scroll));
  vec4 c = t * v_color;
  if (c.a < 0.004) discard;
  out_FragColor = c;
}`;
  const WX_FLOATS = 10;                    // position 3, st 2, color 4, kind 1
  const WX_STRIDE = WX_FLOATS * 4;
  const MAX_DROPS = 9000;

  /**
   * Cloud / rain layer for one terrain provider. It is a Cesium primitive (added to scene.primitives);
   * simulation and vertex generation run in update(), right before drawing.
   */
  class Weather {
    constructor(C, viewer, provider, rain, settings) {
      this.C = C;
      this.viewer = viewer;
      this.scene = viewer.scene;
      this.provider = provider;
      this.rain = rain;
      this.settings = Object.assign({}, WEATHER_DEFAULTS, settings);
      this.ellipsoid = viewer.scene.globe.ellipsoid;
      this.stats = { puffs: 0, shafts: 0, drops: 0 };
      this.show = true;

      // local metric frame over the DEM, like the C++ world XZ: x east of the west edge, z south of
      // the north edge (metres), y = height above the ellipsoid
      const dem = provider.dem, L = dem.levels[0];
      const hx = Math.abs(L.dLon) / 2, hy = Math.abs(L.dLat) / 2;
      this.west = dem.west - hx; this.east = dem.east + hx;
      this.south = dem.south - hy; this.north = dem.north + hy;
      this.mLon = 111320 * Math.cos(C.Math.toRadians((this.south + this.north) / 2));
      this.mLat = 110574;
      this.worldW = (this.east - this.west) * this.mLon;
      this.worldD = (this.north - this.south) * this.mLat;
      Object.assign(this, rainStats(rain, this.west, this.south, this.east, this.north));

      // ---- precipitation map draped over the terrain
      const cv = makeRainOverlayCanvas(rain, this.west, this.south, this.east, this.north, this.lowMm, this.highMm);
      this.layer = viewer.imageryLayers.addImageryProvider(new C.SingleTileImageryProvider({
        url: cv.toDataURL('image/png'),
        rectangle: C.Rectangle.fromDegrees(this.west, this.south, this.east, this.north),
        tileWidth: cv.width, tileHeight: cv.height,
        credit: rain.source,
      }));
      this.layer.alpha = this.settings.overlayOpacity;
      this.layer.show = this.settings.overlay;

      // ---- standing water (terrain wetness x precipitation), drawn above the rain map
      this.wetness = computeWetness(dem);
      this.waterBase = waterBase(this.wetness, rain, this.highMm);
      this.waterLayer = null;
      this.waterKm2 = 0;
      // ---- simulation: "Start" lets it rain and the standing water fills up slowly (fill 0 -> 1)
      this.simRunning = false;
      this.simTime = 0;                                  // seconds of simulated rain so far
      this.fill = this.settings.simulation ? 0 : 1;
      if (this.settings.simulation) this.settings.rain = false;   // no rain before the simulation starts
      this.onSimulation = null;                          // callback(state) for the UI
      this._simLast = undefined;
      this._lastFillBuild = -1;
      this._removePreRender = this.scene.preRender.addEventListener(() => this._tickSimulation());
      this._buildWater();

      // ---- cloud puffs on a jittered grid covering the terrain
      const U = mulberry32(42), spacing = 2500;
      const nx = Math.max(1, Math.floor(this.worldW / spacing)), nz = Math.max(1, Math.floor(this.worldD / spacing));
      this.puffs = [];
      for (let j = 0; j < nz; j++) {
        for (let i = 0; i < nx; i++) {
          for (let k = 0; k < 1; k++) {  // 1 puff per cell (was 2): half the cloud frequency
            const p = {
              bx: ((i + U()) * this.worldW) / nx, bz: ((j + U()) * this.worldD) / nz,
              y01: U(), size: 1600 + 2600 * U(), thresh: 0.04 + 0.94 * U(),
              shaftRand: U(), shade: 0.86 + 0.14 * U(), variant: Math.floor(U() * 4) & 3,
            };
            p.cluster = clusterNoise(p.bx, p.bz);
            this.puffs.push(p);
          }
        }
      }
      const N = this.puffs.length;
      this.pPos = new Float64Array(N * 3);       // per frame: ECEF centre, local x/z, density, cover
      this.pX = new Float64Array(N); this.pZ = new Float64Array(N);
      this.pD = new Float32Array(N); this.pCov = new Float32Array(N);
      this.items = [];
      this.maxQuads = Math.min(N * 2, 65535);
      this.quadData = new Float32Array(this.maxQuads * 4 * WX_FLOATS);
      this.lineData = new Float32Array(MAX_DROPS * 2 * WX_FLOATS);
      this.drops = new Float64Array(MAX_DROPS * 3);
      this.alive = new Uint8Array(MAX_DROPS);
      this.dropRadius = 300;
      this.windX = 0; this.windZ = 0; this.time = 0; this.scroll = 0;
      this._last = undefined;

      this.center = this.toEcef(this.worldW / 2, 2000, this.worldD / 2, new C.Cartesian3());
      this.modelMatrix = C.Matrix4.fromTranslation(this.center);
      this.boundingSphere = new C.BoundingSphere(this.center, Math.hypot(this.worldW, this.worldD) / 2 + 25000);
      this._puffCanvas = makePuffAtlas();
      this._streakCanvas = makeStreakCanvas();
      this._s = {
        a: new C.Cartesian3(), b: new C.Cartesian3(), c: new C.Cartesian3(), up: new C.Cartesian3(),
        r: new C.Cartesian3(), carto: new C.Cartographic(),
      };
      this.scene.primitives.add(this);
    }

    // ---- data access
    lonLat(x, z) { return [this.west + x / this.mLon, this.north - z / this.mLat]; }
    toEcef(x, y, z, out) {
      return this.C.Cartesian3.fromDegrees(this.west + x / this.mLon, this.north - z / this.mLat, y, this.ellipsoid, out);
    }
    /** Mean precipitation in mm / year at lon/lat (degrees). */
    rainAt(lon, lat) { return sampleRain(this.rain, lon, lat); }
    density(x, z) {
      const t = clamp((sampleRain(this.rain, this.west + x / this.mLon, this.north - z / this.mLat) - this.lowMm) /
        (this.highMm - this.lowMm), 0, 1);
      return clamp(t * this.settings.coverage, 0, 1);
    }
    groundAt(x, z, ex) {
      const h = this.provider.sampleHeight(this.west + x / this.mLon, this.north - z / this.mLat);
      return (h === undefined ? 0 : h) * ex;
    }
    clusterAt(x, z) { return clusterNoise(wrap(x - this.windX, this.worldW), wrap(z - this.windZ, this.worldD)); }
    cloudBase(ex) { return Math.max(1600, this.provider.dem.max * ex + 250); }
    cloudTop(ex) { return this.cloudBase(ex) + 2600; }

    setOverlay(on) { this.settings.overlay = !!on; this.layer.show = !!on; this.scene.requestRender(); }
    setWater(on) {
      this.settings.water = !!on;
      if (this.waterLayer) this.waterLayer.show = !!on;
      this.scene.requestRender();
    }
    setWaterAmount(v) {
      v = clamp(v, 0, 4);
      if (v === this.settings.waterAmount && this.waterLayer) return;
      this.settings.waterAmount = v;
      this._buildWater();
    }
    /** Rebuilds the water layer for waterAmount x fill. The new image is decoded before it replaces the
     *  old layer (no flicker while the water is filling); calls during a build are merged into one. */
    _buildWater() {
      if (this._waterBusy) { this._waterAgain = true; return; }
      this._waterBusy = true;
      const C = this.C, Wt = this.wetness;
      const { cv, areaKm2 } = makeWaterCanvas(Wt, this.waterBase, this.settings.waterAmount * this.fill);
      this.waterKm2 = areaKm2;
      this._lastFillBuild = this.fill;
      const done = () => {
        this._waterBusy = false;
        if (this._waterAgain) { this._waterAgain = false; this._buildWater(); }
      };
      cv.toBlob(async (blob) => {
        if (this._disposed || this.viewer.isDestroyed() || !blob) { done(); return; }
        const url = URL.createObjectURL(blob);
        try {
          const img = new Image();
          img.src = url;
          await img.decode();
        } catch (e) { /* layer still loads it */ }
        if (this._disposed || this.viewer.isDestroyed()) { URL.revokeObjectURL(url); done(); return; }
        const layers = this.viewer.imageryLayers;
        const old = this.waterLayer, oldUrl = this._waterUrl;
        const oi = old ? layers.indexOf(old) : -1;
        this.waterLayer = layers.addImageryProvider(new C.SingleTileImageryProvider({
          url,
          rectangle: C.Rectangle.fromDegrees(Wt.west, Wt.north + Wt.H * Wt.dLat, Wt.west + Wt.W * Wt.dLon, Wt.north),
          tileWidth: cv.width, tileHeight: cv.height,
        }), oi >= 0 ? oi + 1 : undefined);
        this.waterLayer.show = this.settings.water;
        this._waterUrl = url;
        this.scene.requestRender();
        // keep the old layer a moment, until the new one has its tiles on the terrain
        setTimeout(() => {
          if (old && !this.viewer.isDestroyed()) layers.remove(old, true);
          if (oldUrl) URL.revokeObjectURL(oldUrl);
          this.scene.requestRender();
          done();
        }, old ? 250 : 0);
      }, 'image/png');
    }

    // ---- simulation (button): rain on + water level rising
    get simulationState() {
      return { running: this.simRunning, fill: this.fill, time: this.simTime, waterKm2: this.waterKm2 };
    }
    _emitSimulation() { if (this.onSimulation) this.onSimulation(this.simulationState); }
    startSimulation() {
      if (this.fill >= 0.999) this.resetSimulation();     // finished -> start again from dry ground
      this.simRunning = true;
      this.settings.rain = true;
      this.settings.clouds = true;
      this._simLast = undefined;
      this._emitSimulation();
    }
    pauseSimulation() {
      this.simRunning = false;
      this.settings.rain = false;
      this._buildWater();
      this._emitSimulation();
    }
    resetSimulation() {
      this.simRunning = false;
      this.settings.rain = false;
      this.simTime = 0;
      this.fill = 0;
      this._buildWater();
      this._emitSimulation();
    }
    _tickSimulation() {
      if (!this.simRunning) return;
      const now = performance.now();
      const dt = this._simLast === undefined ? 0 : Math.min((now - this._simLast) / 1000, 0.25);
      this._simLast = now;
      this.simTime += dt;
      // ease-out: fills fast at first, then slower as the hollows run full (~95% at fillSeconds)
      const T = Math.max(1, this.settings.fillSeconds);
      this.fill = Math.min(1, (1 - Math.exp((-3 * this.simTime) / T)) / 0.95);
      if (this.fill - this._lastFillBuild > 0.02 || (this.fill >= 1 && this._lastFillBuild < 1)) this._buildWater();
      if (this.fill >= 1) {
        this.simRunning = false;   // full: the rain stops, the water stays
        this.settings.rain = false;
      }
      if (!this._lastEmit || now - this._lastEmit > 200 || !this.simRunning) { this._lastEmit = now; this._emitSimulation(); }
    }
    setOverlayOpacity(v) {
      this.settings.overlayOpacity = clamp(v, 0.05, 1);
      this.layer.alpha = this.settings.overlayOpacity;
      this.scene.requestRender();
    }

    // ---- simulation (C++ Weather::Update)
    _stepDrops(dt, camX, camY, camZ, ex, wx, wz) {
      const s = this.settings, D = this.drops, A = this.alive;
      if (!s.rain) { A.fill(0); return; }
      const alt = Math.max(camY - this.groundAt(camX, camZ, ex), 1);
      const R = (this.dropRadius = clamp(alt * 0.7, 60, 900));
      const base = this.cloudBase(ex);
      const fall = Math.max(9, R * 0.9);          // scale fall speed so drops read at any altitude
      // nothing can spawn when the camera is far above the clouds or the area around it is dry
      const canSpawn = camY - R < base && this.density(camX, camZ) > 0.3;
      let tries = 2500;
      for (let i = 0; i < MAX_DROPS; i++) {
        const o = i * 3;
        if (A[i]) {
          D[o + 1] -= fall * dt;
          D[o] += wx * 0.3 * dt;
          D[o + 2] += wz * 0.3 * dt;
          if (D[o + 1] < this.groundAt(D[o], D[o + 2], ex) || Math.abs(D[o] - camX) > R || Math.abs(D[o + 2] - camZ) > R ||
              D[o + 1] < camY - 1.5 * R) A[i] = 0;
          continue;
        }
        if (!canSpawn || tries-- <= 0) continue;
        // respawn: accept with probability = local rain intensity
        const x = camX + (Math.random() * 2 - 1) * R, z = camZ + (Math.random() * 2 - 1) * R;
        if (x < 0 || z < 0 || x > this.worldW || z > this.worldD) continue;
        const dens = this.density(x, z);
        if (dens < 0.4) continue;
        const intensity = smooth(0.4, 0.95, dens) * smooth(0.4, 0.8, cover(this.clusterAt(x, z), dens));
        if (Math.random() > intensity) continue;
        const lo = Math.max(this.groundAt(x, z, ex), camY - R), hi = Math.min(base, camY + R);
        if (hi <= lo) continue;
        D[o] = x; D[o + 1] = lo + Math.random() * (hi - lo); D[o + 2] = z;
        A[i] = 1;
      }
    }

    // ---- rendering (C++ Weather::Draw) -> fills quadData / lineData, returns counts
    _build(frameState) {
      const C = this.C, s = this.settings, cam = frameState.camera, sc = this._s;
      const now = performance.now();
      const dt = this._last === undefined ? 0 : Math.min((now - this._last) / 1000, 0.1);
      this._last = now;
      this.time += dt;
      this.scroll = (this.time * 2.2) % 1;
      const wx = Math.cos(s.windDir) * s.windSpeed, wz = Math.sin(s.windDir) * s.windSpeed;
      this.windX += wx * dt;
      this.windZ += wz * dt;

      const ex = this.scene.verticalExaggeration || 1;
      const base = this.cloudBase(ex), thick = this.cloudTop(ex) - base;
      const camPos = cam.positionWC, dir = cam.directionWC, right = cam.rightWC, up = cam.upWC;
      const cc = this.ellipsoid.cartesianToCartographic(camPos, sc.carto);
      const camX = (C.Math.toDegrees(cc.longitude) - this.west) * this.mLon;
      const camZ = (this.north - C.Math.toDegrees(cc.latitude)) * this.mLat;
      const camY = cc.height;
      this._stepDrops(dt, camX, camY, camZ, ex, wx, wz);

      const W = this.worldW, Dd = this.worldD, ctr = this.center;
      const fog = (dist, r, g, b, alpha, out) => {
        const f = 1 - Math.exp(-dist * WX_FOG);
        out[0] = r + (SKY[0] - r) * f; out[1] = g + (SKY[1] - g) * f; out[2] = b + (SKY[2] - b) * f;
        out[3] = clamp(alpha * (1 - 0.85 * f), 0, 1);
        return out;
      };

      // ---- collect visible puffs / shafts, sort back to front
      let ni = 0;
      const items = this.items;
      const push = (dist, idx, shaft) => {
        let it = items[ni];
        if (!it) it = items[ni] = { dist: 0, idx: 0, shaft: false };
        it.dist = dist; it.idx = idx; it.shaft = shaft;
        ni++;
      };
      if (s.clouds) {
        for (let i = 0; i < this.puffs.length; i++) {
          const p = this.puffs[i];
          const x = wrap(p.bx + this.windX, W), z = wrap(p.bz + this.windZ, Dd);
          const d = this.density(x, z);
          const cv = cover(p.cluster, d);
          if (cv < p.thresh - 0.08) continue;
          const size = p.size * (0.6 + 0.6 * d);
          const y = base + p.y01 * thick * (0.35 + 0.65 * d);
          const P = this.toEcef(x, y, z, sc.a);
          const tx = P.x - camPos.x, ty = P.y - camPos.y, tz = P.z - camPos.z;
          if (tx * dir.x + ty * dir.y + tz * dir.z < -size) continue;        // behind the camera
          const o = i * 3;
          this.pPos[o] = P.x; this.pPos[o + 1] = P.y; this.pPos[o + 2] = P.z;
          this.pX[i] = x; this.pZ[i] = z; this.pD[i] = d; this.pCov[i] = cv;
          push(Math.sqrt(tx * tx + ty * ty + tz * tz), i, false);
          if (s.rain && d > 0.42 && cv > 0.5 && p.shaftRand < (d - 0.42) * 0.5 && p.y01 < 0.5) {
            const M = this.toEcef(x, (base + this.groundAt(x, z, ex)) * 0.5, z, sc.b);
            push(C.Cartesian3.distance(M, camPos), i, true);
          }
        }
      }
      items.length = Math.max(items.length, ni);
      const list = ni === items.length ? items : items.slice(0, ni);
      list.sort((a, b) => b.dist - a.dist);

      // ---- quads
      const q = this.quadData;
      let nq = 0;
      const col = [0, 0, 0, 0], col2 = [0, 0, 0, 0];
      const vtx = (o, X, Y, Z, u, v, c, kind) => {
        q[o] = X - ctr.x; q[o + 1] = Y - ctr.y; q[o + 2] = Z - ctr.z;
        q[o + 3] = u; q[o + 4] = v;
        q[o + 5] = c[0]; q[o + 6] = c[1]; q[o + 7] = c[2]; q[o + 8] = c[3];
        q[o + 9] = kind;
      };
      let puffsDrawn = 0, shaftsDrawn = 0;
      for (let k = 0; k < ni && nq < this.maxQuads; k++) {
        const it = list[k], i = it.idx, p = this.puffs[i];
        const x = this.pX[i], z = this.pZ[i], d = this.pD[i];
        const vis = smooth(p.thresh - 0.08, p.thresh + 0.08, this.pCov[i]);
        const edge = smooth(0, 6000, Math.min(x, W - x, z, Dd - z));
        let size = p.size * (0.6 + 0.6 * d);
        const o = nq * 4 * WX_FLOATS;
        if (!it.shaft) {
          size *= 1 + 0.9 * smooth(15000, 90000, it.dist);
          const near = smooth(size * 0.2, size * 0.9, it.dist);       // don't fill the screen when inside
          const alpha = vis * edge * near * 0.9;
          if (alpha < 0.01) continue;
          // rainy clouds are darker, especially their lower parts
          const shade = p.shade * (1 - 0.38 * d * (1 - 0.8 * p.y01));
          fog(it.dist, shade, shade, Math.min(1, shade * 262 / 255), alpha, col);
          const hw = size * 0.5, hh = size * 0.35;
          const px = this.pPos[i * 3], py = this.pPos[i * 3 + 1], pz = this.pPos[i * 3 + 2];
          const rx = right.x * hw, ry = right.y * hw, rz = right.z * hw;
          const ux = up.x * hh, uy = up.y * hh, uz = up.z * hh;
          const u0 = (p.variant & 1) * 0.5, tTop = 1 - (p.variant >> 1) * 0.5, tBot = tTop - 0.5;
          vtx(o, px - rx - ux, py - ry - uy, pz - rz - uz, u0, tBot, col, 0);
          vtx(o + WX_FLOATS, px + rx - ux, py + ry - uy, pz + rz - uz, u0 + 0.5, tBot, col, 0);
          vtx(o + 2 * WX_FLOATS, px + rx + ux, py + ry + uy, pz + rz + uz, u0 + 0.5, tTop, col, 0);
          vtx(o + 3 * WX_FLOATS, px - rx + ux, py - ry + uy, pz - rz + uz, u0, tTop, col, 0);
          nq++;
          puffsDrawn++;
        } else {
          const strength = smooth(0.42, 0.85, d) * vis * edge;
          if (strength < 0.02) continue;
          const top = base + 150;
          const bottom = Math.min(this.groundAt(x, z, ex), top - 50);
          const w = size * 0.55;
          const Pb = this.toEcef(x, bottom, z, sc.a), Pt = this.toEcef(x, top, z, sc.b);
          // vertical quad turned towards the camera around the local vertical
          const nUp = this.ellipsoid.geodeticSurfaceNormal(Pb, sc.up);
          const to = C.Cartesian3.subtract(Pb, camPos, sc.c);
          const r = C.Cartesian3.cross(to, nUp, sc.r);
          const rl = C.Cartesian3.magnitude(r);
          if (rl > 1e-3) C.Cartesian3.multiplyByScalar(r, (w * 0.5) / rl, r);
          else C.Cartesian3.multiplyByScalar(right, w * 0.5, r);
          const near = smooth(w * 0.3, w * 1.2, it.dist);
          // seen from straight above the quad is edge-on (as in the C++) -> fade it out
          const tl = C.Cartesian3.magnitude(to) || 1;
          const steep = 1 - smooth(0.8, 0.97, Math.abs(C.Cartesian3.dot(to, nUp)) / tl);
          const a = strength * near * steep;
          if (a < 0.01) continue;
          fog(it.dist, 150 / 255, 158 / 255, 172 / 255, 0.35 * a, col);
          fog(it.dist, 150 / 255, 158 / 255, 172 / 255, 0.95 * a, col2);
          const vBot = bottom / 420, vTop = top / 420;
          vtx(o, Pb.x - r.x, Pb.y - r.y, Pb.z - r.z, 0, vBot, col, 1);
          vtx(o + WX_FLOATS, Pb.x + r.x, Pb.y + r.y, Pb.z + r.z, 1, vBot, col, 1);
          vtx(o + 2 * WX_FLOATS, Pt.x + r.x, Pt.y + r.y, Pt.z + r.z, 1, vTop, col2, 1);
          vtx(o + 3 * WX_FLOATS, Pt.x - r.x, Pt.y - r.y, Pt.z - r.z, 0, vTop, col2, 1);
          nq++;
          shaftsDrawn++;
        }
      }

      // ---- rain drops near the camera (short streaks)
      let nl = 0;
      if (s.rain) {
        const L = this.lineData, R = this.dropRadius;
        const len = Math.max(9, R * 0.9) * 0.045;
        const nUp = this.ellipsoid.geodeticSurfaceNormal(camPos, sc.up);
        for (let i = 0; i < MAX_DROPS; i++) {
          if (!this.alive[i]) continue;
          const P = this.toEcef(this.drops[i * 3], this.drops[i * 3 + 1], this.drops[i * 3 + 2], sc.a);
          const dist = C.Cartesian3.distance(P, camPos);
          const a = 0.55 * (1 - smooth(R * 0.5, R * 1.2, dist));
          if (a < 0.02) continue;
          const o = nl * 2 * WX_FLOATS;
          L[o] = P.x + nUp.x * len - ctr.x; L[o + 1] = P.y + nUp.y * len - ctr.y; L[o + 2] = P.z + nUp.z * len - ctr.z;
          L[o + 3] = 0; L[o + 4] = 0;
          L[o + 5] = 200 / 255; L[o + 6] = 208 / 255; L[o + 7] = 222 / 255; L[o + 8] = a; L[o + 9] = 2;
          const o2 = o + WX_FLOATS;
          L[o2] = P.x - ctr.x; L[o2 + 1] = P.y - ctr.y; L[o2 + 2] = P.z - ctr.z;
          L[o2 + 3] = 0; L[o2 + 4] = 0;
          L[o2 + 5] = 200 / 255; L[o2 + 6] = 208 / 255; L[o2 + 7] = 222 / 255; L[o2 + 8] = a / 3; L[o2 + 9] = 2;
          nl++;
        }
      }
      this.stats.puffs = puffsDrawn;
      this.stats.shafts = shaftsDrawn;
      this.stats.drops = nl;
      return { nq, nl };
    }

    _createResources(context) {
      const C = this.C;
      const attributeLocations = { position: 0, st: 1, color: 2, kind: 3 };
      this._sp = C.ShaderProgram.fromCache({ context, vertexShaderSource: WX_VS, fragmentShaderSource: WX_FS, attributeLocations });
      this._rs = C.RenderState.fromCache({
        depthTest: { enabled: true }, depthMask: false, blending: C.BlendingState.ALPHA_BLEND, cull: { enabled: false },
      });
      const F = C.ComponentDatatype.FLOAT;
      const makeVa = (maxVerts, indexBuffer) => {
        const vb = C.Buffer.createVertexBuffer({ context, sizeInBytes: maxVerts * WX_STRIDE, usage: C.BufferUsage.STREAM_DRAW });
        const attr = (index, n, off) => ({ index, vertexBuffer: vb, componentsPerAttribute: n, componentDatatype: F, offsetInBytes: off, strideInBytes: WX_STRIDE });
        const va = new C.VertexArray({ context, indexBuffer, attributes: [attr(0, 3, 0), attr(1, 2, 12), attr(2, 4, 20), attr(3, 1, 36)] });
        return { vb, va };
      };
      if (!context.elementIndexUint) this.maxQuads = Math.min(this.maxQuads, 16383);
      const idx = this.maxQuads * 4 > 65535 ? new Uint32Array(this.maxQuads * 6) : new Uint16Array(this.maxQuads * 6);
      for (let i = 0; i < this.maxQuads; i++) {
        const v = i * 4, o = i * 6;
        idx[o] = v; idx[o + 1] = v + 1; idx[o + 2] = v + 2; idx[o + 3] = v; idx[o + 4] = v + 2; idx[o + 5] = v + 3;
      }
      const ib = C.Buffer.createIndexBuffer({
        context, typedArray: idx, usage: C.BufferUsage.STATIC_DRAW,
        indexDatatype: idx instanceof Uint32Array ? C.IndexDatatype.UNSIGNED_INT : C.IndexDatatype.UNSIGNED_SHORT,
      });
      this._quads = makeVa(this.maxQuads * 4, ib);
      this._lines = makeVa(MAX_DROPS * 2);
      this._puffTex = new C.Texture({
        context, source: this._puffCanvas,
        sampler: new C.Sampler({
          wrapS: C.TextureWrap.CLAMP_TO_EDGE, wrapT: C.TextureWrap.CLAMP_TO_EDGE,
          minificationFilter: C.TextureMinificationFilter.LINEAR_MIPMAP_LINEAR,
          magnificationFilter: C.TextureMagnificationFilter.LINEAR,
        }),
      });
      this._puffTex.generateMipmap();
      this._streakTex = new C.Texture({
        context, source: this._streakCanvas,
        sampler: new C.Sampler({
          wrapS: C.TextureWrap.CLAMP_TO_EDGE, wrapT: C.TextureWrap.REPEAT,
          minificationFilter: C.TextureMinificationFilter.LINEAR,
          magnificationFilter: C.TextureMagnificationFilter.LINEAR,
        }),
      });
      const uniformMap = {
        u_puff: () => this._puffTex, u_streak: () => this._streakTex, u_scroll: () => this.scroll,
      };
      const cmd = (va, primitiveType) => new C.DrawCommand({
        vertexArray: va, shaderProgram: this._sp, renderState: this._rs, uniformMap, primitiveType,
        pass: C.Pass.OPAQUE,          // after the globe; blended + sorted here, like the C++ renderer
        modelMatrix: this.modelMatrix, boundingVolume: this.boundingSphere, owner: this,
      });
      this._quadCmd = cmd(this._quads.va, C.PrimitiveType.TRIANGLES);
      this._lineCmd = cmd(this._lines.va, C.PrimitiveType.LINES);
    }

    update(frameState) {
      if (!this.show || !frameState.passes.render) return;
      if (!this._sp) this._createResources(frameState.context);
      const { nq, nl } = this._build(frameState);
      if (nq) {
        this._quads.vb.copyFromArrayView(this.quadData.subarray(0, nq * 4 * WX_FLOATS));
        this._quadCmd.count = nq * 6;
        frameState.commandList.push(this._quadCmd);
      }
      if (nl) {
        this._lines.vb.copyFromArrayView(this.lineData.subarray(0, nl * 2 * WX_FLOATS));
        this._lineCmd.count = nl * 2;
        frameState.commandList.push(this._lineCmd);
      }
    }

    isDestroyed() { return false; }
    destroy() {
      // called by scene.primitives.remove(this)
      if (this._quads) this._quads.va.destroy();
      if (this._lines) this._lines.va.destroy();
      if (this._sp) this._sp.destroy();
      if (this._puffTex) this._puffTex.destroy();
      if (this._streakTex) this._streakTex.destroy();
      this.isDestroyed = () => true;
    }
    /** Removes the clouds and the precipitation map from the viewer. */
    dispose() {
      this._disposed = true;
      if (this._removePreRender) this._removePreRender();
      if (this._waterUrl) URL.revokeObjectURL(this._waterUrl);
      if (this.layer && !this.viewer.isDestroyed()) this.viewer.imageryLayers.remove(this.layer, true);
      if (this.waterLayer && !this.viewer.isDestroyed()) this.viewer.imageryLayers.remove(this.waterLayer, true);
      this.layer = null;
      this.waterLayer = null;
      if (!this.isDestroyed() && !this.viewer.isDestroyed()) this.scene.primitives.remove(this);
    }
  }

  // ------------------------------------------------------------------ embeddable viewer
  const CSS = `
.tft-root{position:relative;overflow:hidden;background:#0b1220;font:13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;outline:none}
.tft-root .tft-cesium{position:absolute;inset:0}
.tft-root .cesium-viewer-bottom{max-width:60%}
.tft-panel{position:absolute;top:8px;left:8px;z-index:3;width:250px;max-width:calc(100% - 16px);box-sizing:border-box;
  background:rgba(14,20,32,.86);color:#e8edf5;border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:10px 12px;
  backdrop-filter:blur(6px);max-height:calc(100% - 16px);overflow:auto}
.tft-sep{margin:10px 0 4px;padding-top:8px;border-top:1px solid rgba(255,255,255,.1);font-weight:600}
.tft-wx[hidden],.tft-legend[hidden],.tft-panel[hidden],.tft-terrain[hidden],.tft-help[hidden]{display:none}
.tft-legend{position:absolute;right:8px;bottom:44px;z-index:3;width:260px;max-width:calc(100% - 16px);box-sizing:border-box;
  background:rgba(14,20,32,.8);color:#e8edf5;border-radius:8px;padding:8px 12px;pointer-events:none}
.tft-legend b{display:block;font-weight:600;margin-bottom:5px}
.tft-legend i{display:block;height:12px;border-radius:3px;border:1px solid rgba(255,255,255,.4)}
.tft-legend div{display:flex;justify-content:space-between;margin-top:3px;color:#c4cfdf;font-variant-numeric:tabular-nums}
.tft-panel h4{margin:0 0 6px;font-size:13px;font-weight:600;display:flex;justify-content:space-between;align-items:center;gap:8px}
.tft-panel button{font:inherit;color:inherit;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);
  border-radius:5px;padding:3px 8px;cursor:pointer}
.tft-panel button:hover{background:rgba(255,255,255,.16)}
.tft-panel .tft-x{padding:0 6px;line-height:18px}
.tft-panel.tft-collapsed .tft-body{display:none}
.tft-row{display:grid;grid-template-columns:1fr auto;gap:2px 8px;align-items:center;margin:6px 0}
.tft-row input[type=range]{grid-column:1/3;width:100%;margin:0;accent-color:#5fb0ff}
.tft-row span{color:#9fb0c8;font-variant-numeric:tabular-nums}
.tft-checks{display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;margin:6px 0}
.tft-checks label{display:flex;gap:5px;align-items:center;cursor:pointer;white-space:nowrap}
.tft-stats{color:#9fb0c8;font-variant-numeric:tabular-nums;margin:6px 0;white-space:pre-line}
.tft-help{color:#7f8ea6;font-size:11.5px;margin-top:6px;border-top:1px solid rgba(255,255,255,.1);padding-top:6px}
.tft-btns{display:flex;gap:6px;flex-wrap:wrap}
.tft-overlay{position:absolute;inset:0;z-index:4;display:flex;align-items:center;justify-content:center;flex-direction:column;
  gap:10px;color:#e8edf5;background:rgba(11,18,32,.82);text-align:center;padding:16px}
.tft-overlay[hidden]{display:none}
.tft-bar{width:min(320px,80%);height:6px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden}
.tft-bar i{display:block;height:100%;width:0;background:#5fb0ff;transition:width .15s}
.tft-overlay.tft-error{color:#ffb4b4}
.tft-drop{outline:2px dashed #5fb0ff;outline-offset:-8px}
.tft-sim{position:absolute;left:50%;bottom:44px;transform:translateX(-50%);z-index:4;display:flex;align-items:center;gap:10px;
  max-width:calc(100% - 16px);box-sizing:border-box;background:rgba(14,20,32,.86);color:#e8edf5;border:1px solid rgba(255,255,255,.14);
  border-radius:999px;padding:6px 8px 6px 6px;backdrop-filter:blur(6px)}
.tft-sim[hidden]{display:none}
.tft-sim button{font:600 14px/1 system-ui,-apple-system,"Segoe UI",sans-serif;color:#fff;border:0;border-radius:999px;cursor:pointer;
  padding:9px 16px;background:#1f7ae0;white-space:nowrap}
.tft-sim button:hover{background:#2b8af5}
.tft-sim button.tft-simrun{background:#c7472f}
.tft-sim button.tft-simrun:hover{background:#dc5a41}
.tft-sim button.tft-simreset{background:rgba(255,255,255,.1);font-weight:500;padding:9px 12px}
.tft-sim button.tft-simreset:hover{background:rgba(255,255,255,.2)}
.tft-sim button:focus-visible{outline:2px solid #5fb0ff;outline-offset:2px}
.tft-simwater{display:flex;flex-direction:column;gap:4px;min-width:120px;font-size:12px;font-variant-numeric:tabular-nums;color:#c4cfdf}
.tft-simbar{height:6px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden}
.tft-simbar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#7ddcec,#1473c3)}
`;
  function injectCss() {
    if (document.getElementById('tft-style')) return;
    const st = document.createElement('style');
    st.id = 'tft-style';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function makeImagery(C, kind) {
    if (kind && typeof kind === 'object') return kind;   // a Cesium ImageryProvider
    if (kind === 'osm') {
      return new C.OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/' });
    }
    if (kind === 'none') return undefined;
    return new C.UrlTemplateImageryProvider({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      maximumLevel: 19,
      credit: new C.Credit('Imagery © Esri, Maxar, Earthstar Geographics'),
    });
  }

  function el(tag, attrs, html) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  /**
   * Mounts a complete terrain viewer into `container` (element or selector).
   * Options: src (URL | File | ArrayBuffer), rain (precipitation GeoTIFF: URL | File | ArrayBuffer),
   *          weather (false | initial settings { clouds, rain, coverage, windSpeed, windDir, overlay, overlayOpacity, water, waterAmount }),
   *          imagery ('esri'|'osm'|'none'|ImageryProvider),
   *          exaggeration, maximumScreenSpaceError, controls (bool), keyboard (bool),
   *          allowDrop (bool), ionToken, cesiumBaseUrl, viewerOptions, onProgress, onReady.
   * Resolves to a controller { viewer, provider, weather, flyHome(), setSource(), setRain(), setWeather(),
   *   rainAt(lon, lat), setExaggeration(), destroy() }.
   */
  async function mount(container, opts = {}) {
    if (typeof container === 'string') container = document.querySelector(container);
    if (!container) throw new Error('TifTerrain.mount: container not found');
    opts = Object.assign({}, opts);                  // setBounds() edits it
    injectCss();

    const root = el('div', { class: 'tft-root', tabindex: '0' });
    root.style.width = '100%';
    root.style.height = '100%';
    const cesiumBox = el('div', { class: 'tft-cesium' });
    const overlay = el('div', { class: 'tft-overlay' },
      '<div class="tft-msg">Loading CesiumJS…</div><div class="tft-bar"><i></i></div>');
    root.append(cesiumBox, overlay);
    if (getComputedStyle(container).position === 'static' && container !== document.body) {
      container.style.position = 'relative';
    }
    if (!container.style.height && container.clientHeight < 50) container.style.height = '480px';
    container.appendChild(root);

    const msg = overlay.querySelector('.tft-msg');
    const bar = overlay.querySelector('.tft-bar i');
    const setStatus = (text, frac) => {
      overlay.hidden = false;
      overlay.classList.remove('tft-error');
      msg.textContent = text;
      bar.parentElement.style.display = frac === undefined ? 'none' : '';
      if (frac !== undefined) bar.style.width = Math.round(frac * 100) + '%';
    };
    const setError = (err) => {
      overlay.hidden = false;
      overlay.classList.add('tft-error');
      bar.parentElement.style.display = 'none';
      msg.textContent = '⚠ ' + (err && err.message ? err.message : err);
    };

    const ctl = { viewer: null, provider: null, root, destroyed: false };
    const cleanups = [];

    try {
      const { Cesium: C } = await ensureLibraries(opts);
      if (opts.ionToken) C.Ion.defaultAccessToken = opts.ionToken;

      const viewer = new C.Viewer(cesiumBox, Object.assign({
        baseLayer: opts.imagery === 'none' ? false : new C.ImageryLayer(makeImagery(C, opts.imagery)),
        baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false,
        navigationHelpButton: false, animation: false, timeline: false, fullscreenButton: true,
        infoBox: false, selectionIndicator: false, scene3DOnly: true,
        fullscreenElement: root,
        terrainProvider: new C.EllipsoidTerrainProvider(),
      }, opts.viewerOptions || {}));
      ctl.viewer = viewer;

      const scene = viewer.scene, globe = scene.globe;
      globe.enableLighting = opts.lighting !== false;
      globe.maximumScreenSpaceError = opts.maximumScreenSpaceError || 2;
      globe.depthTestAgainstTerrain = true;
      globe.showGroundAtmosphere = true;
      scene.verticalExaggeration = opts.exaggeration || 1;
      viewer.clock.shouldAnimate = false;

      // ---------------- weather (precipitation map + clouds + rain), needs a DEM to sit on
      let rainSrc = opts.rain;
      let wxSettings = Object.assign({}, opts.weather && typeof opts.weather === 'object' ? opts.weather : {});
      let weatherUi = () => {};
      let simUi = () => {};
      const startRain = () => (rainSrc && opts.weather !== false ? getRain(rainSrc, opts) : null);
      let rainPromise = null;
      const attachWeather = async () => {
        if (ctl.weather) { wxSettings = ctl.weather.settings; ctl.weather.dispose(); ctl.weather = null; }
        ctl.weatherError = undefined;
        if (rainPromise && ctl.provider) {
          try {
            const rain = await rainPromise;
            if (ctl.destroyed) return;
            if (ctl.weather) ctl.weather.dispose();
            ctl.weather = new Weather(C, viewer, ctl.provider, rain, wxSettings);
            let wasRunning = false;
            ctl.weather.onSimulation = (st) => {
              simUi(st);
              if (st.running !== wasRunning) { wasRunning = st.running; weatherUi(); }
              root.dispatchEvent(new CustomEvent('tif-terrain-simulation', { bubbles: true, detail: st }));
            };
          } catch (e) {
            console.warn('[tif-terrain] weather disabled:', e);
            ctl.weatherError = e;
          }
        }
        weatherUi();
        simUi(ctl.weather ? ctl.weather.simulationState : null);
        scene.requestRender();
      };
      ctl.setRain = (src) => {
        rainSrc = src;
        rainPromise = startRain();
        return attachWeather();
      };
      ctl.setWeather = (o) => {
        const w = ctl.weather;
        Object.assign(w ? w.settings : wxSettings, o);
        if (w && 'overlay' in o) w.setOverlay(o.overlay);
        if (w && 'overlayOpacity' in o) w.setOverlayOpacity(o.overlayOpacity);
        if (w && 'water' in o) w.setWater(o.water);
        if (w && 'waterAmount' in o) w.setWaterAmount(o.waterAmount);
        weatherUi();
      };
      ctl.rainAt = (lon, lat) => (ctl.weather ? ctl.weather.rainAt(lon, lat) : undefined);
      // simulation: rain starts and the standing water fills up slowly
      ctl.startSimulation = () => { if (ctl.weather) ctl.weather.startSimulation(); };
      ctl.pauseSimulation = () => { if (ctl.weather) ctl.weather.pauseSimulation(); };
      ctl.resetSimulation = () => { if (ctl.weather) ctl.weather.resetSimulation(); };
      ctl.toggleSimulation = () => {
        const w = ctl.weather;
        if (w) (w.simRunning ? w.pauseSimulation() : w.startSimulation());
      };
      Object.defineProperty(ctl, 'simulation', { get: () => (ctl.weather ? ctl.weather.simulationState : null) });

      let currentSrc = opts.src;
      const setSource = async (src) => {
        currentSrc = src;
        setStatus('Downloading DEM…', 0);
        if (!rainPromise) rainPromise = startRain();      // in parallel with the DEM
        const provider = await createTerrainProvider(src, Object.assign({}, opts, {
          onProgress: (p) => {
            if (opts.onProgress) opts.onProgress(p);
            if (p.phase === 'download') setStatus(`Downloading DEM… ${(p.loaded / 1048576).toFixed(1)} / ${(p.total / 1048576).toFixed(1)} MB`, p.loaded / p.total);
            else if (p.phase === 'decode') setStatus('Decoding GeoTIFF…');
            else if (p.phase === 'pyramid') setStatus('Building LOD pyramid…');
          },
        }));
        if (ctl.destroyed) return;
        ctl.provider = provider;
        viewer.terrainProvider = provider;
        applyClip();
        if (rainPromise) setStatus('Loading precipitation map…');
        await attachWeather();
        if (ctl.destroyed) return;
        // sun high over the DEM (late morning local solar time, summer) for good relief shading
        const lonC = (provider.dem.west + provider.dem.east) / 2;
        const utcHour = 12 - lonC / 15 - 2;
        viewer.clock.currentTime = C.JulianDate.fromDate(new Date(Date.UTC(2026, 5, 21) + utcHour * 3600e3));
        overlay.hidden = true;
        updateInfo();
        ctl.flyHome(0);
        if (opts.onReady) opts.onReady(ctl);
        root.dispatchEvent(new CustomEvent('tif-terrain-ready', { bubbles: true, detail: ctl }));
        return provider;
      };

      ctl.flyHome = (duration = 1.5) => {
        const d = ctl.provider && ctl.provider.dem;
        if (!d) return;
        // view like the C++ ResetCamera: from the south, looking north and down
        const lonC = (d.west + d.east) / 2;
        const spanLat = d.north - d.south, spanLon = d.east - d.west;
        const spanM = Math.max(spanLat * 111320, spanLon * 111320 * Math.cos(C.Math.toRadians((d.north + d.south) / 2)));
        viewer.camera.flyTo({
          destination: C.Cartesian3.fromDegrees(lonC, d.south - spanLat * 0.55, d.max * scene.verticalExaggeration + spanM * 0.32),
          orientation: { heading: 0, pitch: C.Math.toRadians(-32), roll: 0 },
          duration,
        });
      };
      ctl.setSource = (src) => setSource(src).catch((e) => { setError(e); throw e; });
      ctl.setBounds = (b) => { opts.bounds = b || undefined; return ctl.setSource(currentSrc); };
      // ---------------- clip: draw only the DEM rectangle instead of the whole globe
      ctl.clip = opts.clip !== false;
      const sceneDefaults = {
        skyBox: scene.skyBox && scene.skyBox.show,
        sun: scene.sun && scene.sun.show,
        moon: scene.moon && scene.moon.show,
        bg: scene.backgroundColor.clone(),
      };
      let clipRect = null;
      const applyClip = () => {
        const d = ctl.provider && ctl.provider.dem;
        const on = ctl.clip && !!d;
        const ssc = scene.screenSpaceCameraController;
        if (on) {
          clipRect = C.Rectangle.fromDegrees(d.west, d.south, d.east, d.north);
          globe.cartographicLimitRectangle = clipRect;
          const spanM = Math.max((d.north - d.south) * 111320,
            (d.east - d.west) * 111320 * Math.cos(C.Math.toRadians((d.north + d.south) / 2)));
          ssc.maximumZoomDistance = d.max * 20 + spanM * 2.5;   // can't zoom out to see the planet
        } else {
          clipRect = null;
          globe.cartographicLimitRectangle = C.Rectangle.MAX_VALUE;
          ssc.maximumZoomDistance = Number.POSITIVE_INFINITY;
        }
        // stars/sun/moon would show through the empty space around the clipped area
        if (scene.skyBox) scene.skyBox.show = on ? false : sceneDefaults.skyBox;
        if (scene.sun) scene.sun.show = on ? false : sceneDefaults.sun;
        if (scene.moon) scene.moon.show = on ? false : sceneDefaults.moon;
        scene.backgroundColor = on ? C.Color.fromCssColorString('#0b1220') : sceneDefaults.bg;
        scene.requestRender();
      };
      // ---------------- zoom-in limit: stop where the DEM has no finer detail left.
      // At the closest allowed distance one DEM pixel covers ~maxZoomPixels screen pixels;
      // closer than that the terrain is just interpolated (blocky) facets.
      ctl.maxZoomPixels = opts.maxZoomPixels || 8;
      ctl.minZoomDistance = () => {
        const d = ctl.provider && ctl.provider.dem;
        if (!d) return 1;
        if (opts.minZoomDistance !== undefined) return opts.minZoomDistance;
        const latC = C.Math.toRadians((d.north + d.south) / 2);
        const pixM = d.resolution * 111320 * Math.sqrt(Math.max(Math.cos(latC), 1e-3)); // mean DEM pixel size, m
        const fovy = viewer.camera.frustum.fovy || C.Math.toRadians(60);
        const screenH = Math.max(scene.canvas.clientHeight, 100);
        return Math.max(1, pixM * screenH / (2 * Math.tan(fovy / 2) * ctl.maxZoomPixels));
      };
      cleanups.push(scene.preRender.addEventListener(() => {
        const minD = ctl.minZoomDistance();
        const ssc = scene.screenSpaceCameraController;
        if (ssc.minimumZoomDistance !== minD) ssc.minimumZoomDistance = minD;
        if (!ctl.provider) return;
        // wheel/drag zoom is limited by Cesium; also catch keyboard flight and flyTo
        const cam = viewer.camera, c = cam.positionCartographic;
        const ground = (globe.getHeight(c) || 0) * scene.verticalExaggeration;
        if (c.height - ground >= minD - 0.5) return;
        cam.setView({
          destination: C.Cartesian3.fromRadians(c.longitude, c.latitude, ground + minD),
          orientation: { heading: cam.heading, pitch: cam.pitch, roll: cam.roll },
        });
      }));

      // keep the camera above (or just around) the clipped area
      cleanups.push(scene.preRender.addEventListener(() => {
        if (!clipRect) return;
        const cam = viewer.camera, c = cam.positionCartographic;
        const mLon = (clipRect.east - clipRect.west) * 0.8, mLat = (clipRect.north - clipRect.south) * 0.8;
        const lon = C.Math.clamp(c.longitude, clipRect.west - mLon, clipRect.east + mLon);
        const lat = C.Math.clamp(c.latitude, clipRect.south - mLat, clipRect.north + mLat);
        if (lon === c.longitude && lat === c.latitude) return;
        cam.setView({
          destination: C.Cartesian3.fromRadians(lon, lat, c.height),
          orientation: { heading: cam.heading, pitch: cam.pitch, roll: cam.roll },
        });
      }));
      ctl.setClip = (on) => { ctl.clip = !!on; applyClip(); syncUi(); };

      ctl.setExaggeration = (v) => { scene.verticalExaggeration = v; syncUi(); };
      ctl.sampleHeight = (lon, lat) => ctl.provider && ctl.provider.sampleHeight(lon, lat);

      // ---------------- precipitation colour legend (same ramp as the draped map)
      const legend = el('div', { class: 'tft-legend', hidden: '' },
        '<b>Mean precipitation (mm / year)</b><i></i><div><span></span><span></span><span></span></div>');
      legend.querySelector('i').style.background = 'linear-gradient(90deg,' +
        RAIN_RAMP.map((c) => `rgb(${c.join(',')})`).join(',') + ')';
      root.appendChild(legend);

      // ---------------- simulation button (start / pause / reset + water level)
      if (opts.simulationButton !== false) {
        const sim = el('div', { class: 'tft-sim', hidden: '' }, `
  <button type="button" class="tft-simgo" title="Start / pause the rain simulation (Space)">▶ Start simulation</button>
  <div class="tft-simwater"><span>Standing water: 0%</span><div class="tft-simbar"><i></i></div></div>
  <button type="button" class="tft-simreset" title="Dry ground again">↺ Reset</button>`);
        root.appendChild(sim);
        const go = sim.querySelector('.tft-simgo'), txt = sim.querySelector('.tft-simwater span');
        const bar = sim.querySelector('.tft-simbar i'), reset = sim.querySelector('.tft-simreset');
        go.onclick = () => ctl.toggleSimulation();
        reset.onclick = () => ctl.resetSimulation();
        simUi = (st) => {
          sim.hidden = !st || !ctl.weather || !ctl.weather.settings.simulation;
          if (sim.hidden) return;
          const pct = Math.round(st.fill * 100);
          go.textContent = st.running ? '⏸ Pause' : st.fill >= 0.999 ? '▶ Run again' : st.fill > 0 ? '▶ Resume' : '▶ Start simulation';
          go.classList.toggle('tft-simrun', st.running);
          reset.hidden = st.fill <= 0 && !st.running;
          txt.textContent = `Standing water: ${pct}% · ${st.waterKm2.toFixed(1)} km²`;
          bar.style.width = pct + '%';
        };
      }

      const legendUi = () => {
        const w = ctl.weather;
        legend.hidden = !(w && w.settings.overlay);
        if (!w) return;
        const [a, m, b] = legend.querySelectorAll('span');
        a.textContent = '≤' + w.lowMm.toFixed(0);
        m.textContent = (0.5 * (w.lowMm + w.highMm)).toFixed(0);
        b.textContent = '≥' + w.highMm.toFixed(0);
      };
      weatherUi = legendUi;
      cleanups.push(() => { if (ctl.weather) ctl.weather.dispose(); ctl.weather = null; });

      // ---------------- controls panel
      let syncUi = () => {};
      let updateInfo = () => {};
      if (opts.controls !== false) {
        const panel = el('div', { class: 'tft-panel' }, `
<h4><span>Weather</span><button class="tft-x" title="Collapse">–</button></h4>
<div class="tft-body">
  <div class="tft-terrain" hidden>
  <div class="tft-stats" data-k="info">—</div>
  <div class="tft-row"><label>Height exaggeration</label><span data-v="ex"></span><input type="range" data-k="ex" min="0.25" max="10" step="0.05"></div>
  <div class="tft-row"><label>LOD pixel error</label><span data-v="sse"></span><input type="range" data-k="sse" min="0.5" max="16" step="0.25"></div>
  <div class="tft-row"><label>Fog</label><span data-v="fog"></span><input type="range" data-k="fog" min="0" max="1" step="0.01"></div>
  <div class="tft-checks">
    <label><input type="checkbox" data-k="light"> Lighting</label>
    <label><input type="checkbox" data-k="fps"> FPS</label>
    <label><input type="checkbox" data-k="atm"> Atmosphere</label>
    <label><input type="checkbox" data-k="insp"> Inspector</label>
    <label><input type="checkbox" data-k="clip"> Only DEM area</label>
  </div>
  <div class="tft-stats" data-k="tiles"></div>
  </div>
  <div class="tft-wx" hidden>
    <div class="tft-stats" data-k="rainInfo"></div>
    <div class="tft-checks">
      <label><input type="checkbox" data-k="ov"> Rain map</label>
      <label><input type="checkbox" data-k="clouds"> Clouds</label>
      <label><input type="checkbox" data-k="rain"> Rain</label>
      <label><input type="checkbox" data-k="water"> Standing water</label>
    </div>
    <div class="tft-row"><label>Rain map opacity</label><span data-v="ovop"></span><input type="range" data-k="ovop" min="0.05" max="1" step="0.01"></div>
    <div class="tft-row"><label>Water amount</label><span data-v="wamt"></span><input type="range" data-k="wamt" min="0" max="4" step="0.05"></div>
    <div class="tft-row"><label>Cloud coverage</label><span data-v="cov"></span><input type="range" data-k="cov" min="0.05" max="3" step="0.05"></div>
    <div class="tft-row"><label>Wind</label><span data-v="wind"></span><input type="range" data-k="wind" min="0" max="500" step="5"></div>
    <div class="tft-stats" data-k="wxStats"></div>
  </div>
  <div class="tft-terrain" hidden>
  <div class="tft-btns"><button data-k="home">Reset view (R)</button></div>
  </div>
  <div class="tft-help" hidden>Drag: rotate · Right-drag / wheel: zoom · Ctrl-drag: tilt<br>
  Click map, then WASD move · Q/E down/up · Shift fast · +/- height<span class="tft-wxhelp"><br>
  Space start/pause simulation · P rain map · 9/0 opacity · C clouds · V rain · H water · , . coverage · N/M wind</span>${opts.allowDrop !== false ? '<br>Drop a .tif here to load it' : ''}</div>
</div>`);
        root.appendChild(panel);
        panel.hidden = true;   // shown once weather is loaded
        const q = (s) => panel.querySelector(s);
        q('.tft-x').onclick = () => {
          panel.classList.toggle('tft-collapsed');
          q('.tft-x').textContent = panel.classList.contains('tft-collapsed') ? '+' : '–';
        };
        if (opts.collapsed || (opts.collapsed === undefined && root.clientWidth < 640)) q('.tft-x').onclick();
        const fogFromSlider = (t) => t * t * 3e-3;
        const sliderFromFog = (d) => Math.min(1, Math.sqrt(d / 3e-3));
        let inspector = null;
        syncUi = () => {
          q('[data-k=ex]').value = scene.verticalExaggeration;
          q('[data-v=ex]').textContent = '×' + scene.verticalExaggeration.toFixed(2);
          q('[data-k=sse]').value = globe.maximumScreenSpaceError;
          q('[data-v=sse]').textContent = globe.maximumScreenSpaceError.toFixed(2) + ' px';
          q('[data-k=fog]').value = scene.fog.enabled ? sliderFromFog(scene.fog.density) : 0;
          q('[data-v=fog]').textContent = scene.fog.enabled ? scene.fog.density.toExponential(1) : 'off';
          q('[data-k=light]').checked = globe.enableLighting;
          q('[data-k=fps]').checked = scene.debugShowFramesPerSecond;
          q('[data-k=atm]').checked = globe.showGroundAtmosphere;
          q('[data-k=insp]').checked = !!inspector;
          q('[data-k=clip]').checked = ctl.clip;
        };
        updateInfo = () => {
          const d = ctl.provider && ctl.provider.dem;
          q('[data-k=info]').textContent = d
            ? `${d.width} × ${d.height} px · ${(d.resolution * 3600).toFixed(2)}″\n${d.min.toFixed(0)} … ${d.max.toFixed(0)} m · max LOD ${ctl.provider.maximumLevel}`
            : 'No DEM loaded';
        };
        q('[data-k=ex]').oninput = (e) => { scene.verticalExaggeration = +e.target.value; syncUi(); };
        q('[data-k=sse]').oninput = (e) => { globe.maximumScreenSpaceError = +e.target.value; syncUi(); };
        q('[data-k=fog]').oninput = (e) => {
          const t = +e.target.value;
          scene.fog.enabled = t > 0;
          if (t > 0) scene.fog.density = fogFromSlider(t);
          syncUi();
        };
        q('[data-k=light]').onchange = (e) => { globe.enableLighting = e.target.checked; };
        q('[data-k=clip]').onchange = (e) => ctl.setClip(e.target.checked);
        q('[data-k=fps]').onchange = (e) => { scene.debugShowFramesPerSecond = e.target.checked; };
        q('[data-k=atm]').onchange = (e) => {
          globe.showGroundAtmosphere = e.target.checked;
          if (scene.skyAtmosphere) scene.skyAtmosphere.show = e.target.checked;
        };
        // Cesium Inspector = the C++ debug keys: wireframe, suspend LOD (freeze), tile bounds, frustums
        q('[data-k=insp]').onchange = (e) => {
          if (e.target.checked && !inspector) {
            const box = el('div');
            box.style.cssText = 'position:absolute;top:8px;right:8px;z-index:3;max-height:calc(100% - 60px);overflow:auto';
            root.appendChild(box);
            inspector = { w: new C.CesiumInspector(box, scene), box };
          } else if (!e.target.checked && inspector) {
            inspector.w.destroy();
            inspector.box.remove();
            inspector = null;
          }
        };
        q('[data-k=home]').onclick = () => ctl.flyHome();
        cleanups.push(() => { if (inspector) inspector.w.destroy(); });

        // weather section
        const wxBox = q('.tft-wx'), wxHelp = q('.tft-wxhelp');
        const syncWeather = () => {
          const w = ctl.weather;
          wxBox.hidden = !w;
          panel.hidden = !w;
          wxHelp.hidden = !w;
          if (!w) return;
          const s = w.settings;
          q('[data-k=ov]').checked = s.overlay;
          q('[data-k=clouds]').checked = s.clouds;
          q('[data-k=rain]').checked = s.rain;
          q('[data-k=water]').checked = s.water;
          q('[data-k=wamt]').value = s.waterAmount;
          q('[data-v=wamt]').textContent = '×' + s.waterAmount.toFixed(2) + ' · ' + w.waterKm2.toFixed(1) + ' km²';
          q('[data-k=ovop]').value = s.overlayOpacity;
          q('[data-v=ovop]').textContent = Math.round(s.overlayOpacity * 100) + '%';
          q('[data-k=cov]').value = s.coverage;
          q('[data-v=cov]').textContent = '×' + s.coverage.toFixed(2);
          q('[data-k=wind]').value = s.windSpeed;
          q('[data-v=wind]').textContent = s.windSpeed.toFixed(0) + ' m/s';
        };
        const wxSet = (k, v) => ctl.setWeather({ [k]: v });
        q('[data-k=ov]').onchange = (e) => wxSet('overlay', e.target.checked);
        q('[data-k=clouds]').onchange = (e) => wxSet('clouds', e.target.checked);
        q('[data-k=rain]').onchange = (e) => wxSet('rain', e.target.checked);
        q('[data-k=water]').onchange = (e) => wxSet('water', e.target.checked);
        q('[data-k=wamt]').oninput = (e) => { q('[data-v=wamt]').textContent = '×' + (+e.target.value).toFixed(2); };
        q('[data-k=wamt]').onchange = (e) => wxSet('waterAmount', +e.target.value);   // rebuild on release
        q('[data-k=ovop]').oninput = (e) => wxSet('overlayOpacity', +e.target.value);
        q('[data-k=cov]').oninput = (e) => wxSet('coverage', +e.target.value);
        q('[data-k=wind]').oninput = (e) => wxSet('windSpeed', +e.target.value);
        const rainInfo = q('[data-k=rainInfo]'), wxStats = q('[data-k=wxStats]');
        let lastInfo = 0;
        cleanups.push(scene.postRender.addEventListener(() => {
          const w = ctl.weather, now = performance.now();
          if (!w || now - lastInfo < 250) return;
          lastInfo = now;
          const c = viewer.camera.positionCartographic;
          const here = w.rainAt(C.Math.toDegrees(c.longitude), C.Math.toDegrees(c.latitude));
          rainInfo.textContent = `Rain here: ${here.toFixed(0)} mm/yr\n(${w.minMm.toFixed(0)} … ${w.maxMm.toFixed(0)} over the map)\n` +
            `${w.rain.source}${w.rain.period ? ' mean ' + w.rain.period : ''}`;
          const st = w.stats;
          wxStats.textContent = `${st.puffs} puffs · ${st.shafts} shafts · ${st.drops} drops`;
        }));
        weatherUi = () => { syncWeather(); legendUi(); };

        const tilesEl = q('[data-k=tiles]');
        const remove = globe.tileLoadProgressEvent.addEventListener((n) => {
          tilesEl.textContent = n ? `Loading tiles: ${n}` : '';
        });
        cleanups.push(remove);
        syncUi();
        updateInfo();
      }

      // ---------------- keyboard fly (only while the viewer has focus -> host page keys untouched)
      if (opts.keyboard !== false) {
        const keys = new Set();
        const kd = (e) => {
          if (e.target.closest && e.target.closest('input,textarea,select')) return;
          const k = e.key.toLowerCase();
          if ('wasdqe'.includes(k) && k.length === 1) { keys.add(k); e.preventDefault(); }
          if (e.key === 'Shift') keys.add('shift');
          if (k === 'r') ctl.flyHome();
          const w = ctl.weather;
          if (w && e.key === ' ' && !e.repeat && !e.target.closest('button')) { e.preventDefault(); ctl.toggleSimulation(); }
          if (w && !e.repeat) {
            if (k === 'p') ctl.setWeather({ overlay: !w.settings.overlay });
            if (k === 'c') ctl.setWeather({ clouds: !w.settings.clouds });
            if (k === 'v') ctl.setWeather({ rain: !w.settings.rain });
            if (k === 'h') ctl.setWeather({ water: !w.settings.water });
          }
          if (w && k.length === 1 && ',.nm90'.includes(k)) { keys.add(k); e.preventDefault(); }
          if (k === '+' || k === '=') ctl.setExaggeration(Math.min(scene.verticalExaggeration * 1.1, 20));
          if (k === '-') ctl.setExaggeration(Math.max(scene.verticalExaggeration / 1.1, 0.1));
        };
        const ku = (e) => { keys.delete(e.key === 'Shift' ? 'shift' : e.key.toLowerCase()); };
        const blur = () => keys.clear();
        root.addEventListener('keydown', kd);
        root.addEventListener('keyup', ku);
        root.addEventListener('blur', blur);
        // canvas clicks focus the root so keys work after interacting with the map
        root.addEventListener('pointerdown', (e) => {
          if (!e.target.closest('.tft-panel, .cesium-cesiumInspector')) root.focus({ preventScroll: true });
        });
        let last = performance.now();
        const tick = () => {
          const now = performance.now();
          const dt = Math.min((now - last) / 1000, 0.1);
          last = now;
          if (!keys.size) return;
          const w = ctl.weather;
          if (w && [',', '.', 'n', 'm', '9', '0'].some((k) => keys.has(k))) {
            const s = w.settings;
            if (keys.has('.')) s.coverage = Math.min(s.coverage * (1 + dt), 3);
            if (keys.has(',')) s.coverage = Math.max(s.coverage * (1 - dt), 0.05);
            if (keys.has('m')) s.windSpeed = Math.min(s.windSpeed * (1 + dt) + dt, 2000);
            if (keys.has('n')) s.windSpeed = Math.max(s.windSpeed * (1 - dt), 0);
            if (keys.has('0')) w.setOverlayOpacity(s.overlayOpacity + dt * 0.6);
            if (keys.has('9')) w.setOverlayOpacity(s.overlayOpacity - dt * 0.6);
            weatherUi();
          }
          const cam = viewer.camera;
          const carto = cam.positionCartographic;
          const ground = globe.getHeight(carto) || 0;
          const alt = Math.max(carto.height - ground * scene.verticalExaggeration, 1);
          const speed = Math.max(30, alt * 0.8) * (keys.has('shift') ? 5 : 1) * dt;
          if (keys.has('w')) cam.moveForward(speed);
          if (keys.has('s')) cam.moveBackward(speed);
          if (keys.has('d')) cam.moveRight(speed);
          if (keys.has('a')) cam.moveLeft(speed);
          if (keys.has('e')) cam.moveUp(speed);
          if (keys.has('q')) cam.moveDown(speed);
          scene.requestRender();
        };
        cleanups.push(scene.preRender.addEventListener(tick));
      }

      // ---------------- drag & drop a .tif
      if (opts.allowDrop !== false) {
        const over = (e) => { e.preventDefault(); root.classList.add('tft-drop'); };
        const leave = () => root.classList.remove('tft-drop');
        root.addEventListener('dragover', over);
        root.addEventListener('dragleave', leave);
        root.addEventListener('drop', (e) => {
          e.preventDefault();
          leave();
          const f = e.dataTransfer.files && e.dataTransfer.files[0];
          if (f) ctl.setSource(f).catch(() => {});
        });
      }

      ctl.destroy = () => {
        ctl.destroyed = true;
        cleanups.forEach((f) => { try { f(); } catch (e) { /* ignore */ } });
        if (!viewer.isDestroyed()) viewer.destroy();
        root.remove();
      };

      if (opts.src) await setSource(opts.src);
      else setStatus(opts.allowDrop !== false ? 'Drop a GeoTIFF DEM (.tif) here' : 'No DEM source given');
    } catch (e) {
      console.error('[tif-terrain]', e);
      setError(e);
      if (!ctl.destroy) ctl.destroy = () => { ctl.destroyed = true; if (ctl.viewer && !ctl.viewer.isDestroyed()) ctl.viewer.destroy(); root.remove(); };
      ctl.error = e;
    }
    return ctl;
  }

  // ------------------------------------------------------------------ <tif-terrain> custom element
  if (typeof customElements !== 'undefined' && !customElements.get('tif-terrain')) {
    class TifTerrainElement extends HTMLElement {
      static get observedAttributes() { return ['src', 'exaggeration', 'bounds', 'rain']; }
      connectedCallback() {
        if (this._ctl) return;
        if (!this.style.display) this.style.display = 'block';
        if (!this.style.height && this.clientHeight < 50) this.style.height = '480px';
        const a = (n) => this.getAttribute(n);
        const bool = (n, d) => (this.hasAttribute(n) ? a(n) !== 'false' : d);
        this._ctlPromise = mount(this, {
          src: a('src') || undefined,
          bounds: a('bounds') || undefined,
          rain: a('rain') || undefined,
          weather: bool('weather', true) ? undefined : false,
          imagery: a('imagery') || undefined,
          exaggeration: a('exaggeration') ? +a('exaggeration') : undefined,
          maximumScreenSpaceError: a('pixel-error') ? +a('pixel-error') : undefined,
          ionToken: a('ion-token') || undefined,
          cesiumBaseUrl: a('cesium-base') || undefined,
          controls: bool('controls', true),
          collapsed: this.hasAttribute('collapsed') ? a('collapsed') !== 'false' : undefined,
          keyboard: bool('keyboard', true),
          allowDrop: bool('allow-drop', true),
          lighting: bool('lighting', true),
          clip: bool('clip', true),
          maxZoomPixels: a('max-zoom-pixels') ? +a('max-zoom-pixels') : undefined,
          minZoomDistance: a('min-zoom-distance') ? +a('min-zoom-distance') : undefined,
        }).then((ctl) => { this._ctl = ctl; return ctl; });
      }
      disconnectedCallback() {
        const p = this._ctlPromise;
        this._ctl = null;
        this._ctlPromise = null;
        if (p) p.then((c) => c.destroy && c.destroy());
      }
      attributeChangedCallback(name, oldV, newV) {
        if (!this._ctlPromise || oldV === newV || !newV) return;
        // may arrive while Cesium is still loading -> apply once the viewer exists
        this._ctlPromise.then((c) => {
          if (c.error || c.destroyed) return;
          if (name === 'src') c.setSource(newV).catch(() => {});
          if (name === 'bounds') { c.setBounds(newV).catch(() => {}); }
          if (name === 'exaggeration') c.setExaggeration(+newV);
          if (name === 'rain') c.setRain(newV).catch(() => {});
        });
      }
      /** Resolves to the controller ({ viewer, provider, flyHome, ... }). */
      get ready() { return this._ctlPromise; }
      get viewer() { return this._ctl && this._ctl.viewer; }
    }
    customElements.define('tif-terrain', TifTerrainElement);
  }

  const api = {
    VERSION,
    mount,
    createTerrainProvider,
    loadDem,
    loadRain,
    ensureLibraries,
    setLibraries(l) { libs = Object.assign({}, libs, l); },
    get TifTerrainProvider() { return TifTerrainProvider; },
    get Weather() { return Weather; },
  };
  global.TifTerrain = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
