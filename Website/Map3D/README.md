# tif-terrain — GeoTIFF DEM → CesiumJS (gömülebilir modül)

C++/raylib `mapRenderer`'ın CesiumJS sürümü. Tek bir `tif-terrain.js` dosyası; herhangi bir siteye
eklenince kendi bağımlılıklarını (CesiumJS 1.146, geotiff.js 2.1.3) CDN'den yükler.

| C++ sürümü | CesiumJS sürümü |
|---|---|
| Quadtree + frustum culling + SSE LOD + skirt'ler (elle) | Cesium globe'un kendi quadtree/LOD sistemi |
| Heightmap GPU'da, vertex shader ile displacement | DEM bellekte mip-piramit; her Cesium tile'ı için 65×65 quantized-mesh (+normal) üretilir |
| `+/-` yükseklik çarpanı | `scene.verticalExaggeration` (panel slider / `+` `-`) |
| `[ ]` LOD piksel hatası | `globe.maximumScreenSpaceError` (slider) |
| `F/G` sis | `scene.fog.density` (slider) |
| F1 wireframe, F2 freeze, F5 kutular | Panelde **Inspector** (Wireframe, Suspend LOD update, Tile bounding volumes) |
| WASD/QE, Shift, R | Aynı tuşlar (harita odaktayken) |
| `Weather`: yağış haritası, bulutlar, yağmur sütunları, damlalar | Aynısı (`rain` seçeneği); harita bir imagery katmanı, bulut/yağmur özel bir Cesium primitive'i |
| `P`, `9/0`, `C`, `V`, `,/.`, `N/M` | Aynı tuşlar + panelde **Weather** bölümü |

## Kullanım

```html
<script src="https://SİZİN-SUNUCU/tif-terrain.js"></script>

<!-- 1) Bildirimsel -->
<tif-terrain src="https://SİZİN-SUNUCU/dem.tif" exaggeration="1.5" style="height:500px"></tif-terrain>

<!-- 2) JS ile -->
<div id="harita" style="height:500px"></div>
<script>
  TifTerrain.mount('#harita', { src: 'dem.tif', imagery: 'osm' }).then((map) => {
    map.setExaggeration(2);
    map.flyHome();
    console.log(map.sampleHeight(32.86, 34.93)); // metre
  });
</script>
```

Sitede zaten bir Cesium Viewer varsa sadece arazi sağlayıcısını kullanın:

```js
viewer.terrainProvider = await TifTerrain.createTerrainProvider('dem.tif');
```

Bundler (Vite/Webpack) ile: `import TifTerrain from './tif-terrain.esm.js'` ve Cesium zaten
paketteyse `TifTerrain.setLibraries({ Cesium, GeoTIFF })` — CDN'e hiç gidilmez.

### Seçenekler (`mount`) / öznitelikler (`<tif-terrain>`)

| mount seçeneği | element özniteliği | varsayılan | açıklama |
|---|---|---|---|
| `src` | `src` | – | URL, `File`/`Blob` veya `ArrayBuffer` |
| `rain` | `rain` | – | Zaman ortalamalı yağış GeoTIFF'i (GPM IMERG mm/hr, MERRA-2 kg m⁻² s⁻¹ …; birim GDAL metadata'dan okunur). Sonradan: `map.setRain(url)` |
| `weather` | `weather="false"` | açık | `false` ya da başlangıç ayarları `{ clouds, rain, coverage, windSpeed, windDir, overlay, overlayOpacity, water, waterAmount }`. Sonradan: `map.setWeather({...})` |
| `bounds` | `bounds` | – | DEM'i `[batı, güney, doğu, kuzey]` (derece) kutusuna kırpar; öznitelikte `"32.15,34.42,34.73,35.78"`. Sonradan: `map.setBounds(...)` |
| `clip` | `clip="false"` | `true` | Yalnızca DEM alanını (`bounds` verildiyse o kutuyu) çizer; küre, yıldızlar gizlenir, kamera bölgeye bağlanır. Sonradan: `map.setClip(false)` |
| `maxZoomPixels` | `max-zoom-pixels` | `8` | En fazla yakınlaşmada bir DEM pikseli ekranda ~bu kadar piksel kaplar; verinin ayrıntısı bittiği yerden daha yakına (tekerlek, sürükleme, WASD/QE) inilemez |
| `minZoomDistance` | `min-zoom-distance` | otomatik | Araziye minimum mesafe (m); verilirse yukarıdaki hesabın yerine geçer |
| `imagery` | `imagery` | `esri` | `esri` (uydu), `osm`, `none` veya bir Cesium ImageryProvider |
| `exaggeration` | `exaggeration` | `1` | dikey abartma |
| `maximumScreenSpaceError` | `pixel-error` | `2` | LOD piksel hatası |
| `controls` | `controls="false"` | `true` | kontrol paneli |
| `collapsed` | `collapsed` | dar kapta `true` | panel kapalı başlasın |
| `keyboard` | `keyboard="false"` | `true` | WASD uçuş (yalnızca harita odaktayken) |
| `allowDrop` | `allow-drop="false"` | `true` | .tif sürükle-bırak |
| `lighting` | `lighting="false"` | `true` | güneş ışığı / gölgelendirme |
| `ionToken` | `ion-token` | – | Cesium ion token (gerekmez) |
| `cesiumBaseUrl` | `cesium-base` | jsDelivr | Cesium'u kendi sunucunuzdan vermek için |
| `fillHeight`, `noData`, `maximumLevel`, `viewerOptions`, `onProgress`, `onReady` | – | | ileri düzey |

Element `tif-terrain-ready` olayı yayar; `el.ready` controller'a çözülen bir Promise'tir.

## Hava durumu katmanı (C++ `Weather` portu)

- Yağış raster'ı mm/yıl'a çevrilir; DEM alanındaki değerlerin %5–%97 yüzdelikleri renk ölçeğini belirler
  (sağ altta lejant). Harita, eş-yağış çizgileriyle birlikte araziye serilir (`P`, opaklık `9`/`0`).
- Bulutlar rüzgârla sürüklenir; yağışlı bölgelerde daha yoğun, daha yüksek ve daha koyu olurlar (`C`, örtü `,`/`.`, rüzgâr `N`/`M`).
- Yoğun bulutların altında akan yağmur sütunları, kamera yağmurlu bulutların altındayken çevresinde damlalar görünür (`V`).
- **Su birikintileri** (`H`, panelde *Standing water* + *Water amount*): yüzey eğimi ~0 olan yerlerde su
  birikir. DEM'in ~2k'lık piramit seviyesinde (1) çukur doldurma (priority-flood) ile kapalı çanaklar,
  (2) eğimi < ~1–3.5° ve çevresinin ortalamasından alçak düzlükler, (3) dik dağ yamaçlarında çevresinden
  çok daha düz olan setler/teraslar/eyerler bulunur. Bu ıslaklık × (yerel yağış / %97 yağış) × miktar
  çarpanı eşiği geçince yarı saydam mavi bir katman olarak çizilir. Eşikler `WATER_*` sabitlerinde.
  Ayarlar: `weather: { water: true, waterAmount: 1 }` (0–4).
- **Simülasyon butonu** (haritanın altında ortada, ya da `Space`): *Start simulation* yağmuru başlatır ve su
  birikintileri boştan başlayıp yavaş yavaş dolar (önce en derin/en yağışlı çukurlar, sonra düzlükler;
  `fillSeconds` saniyede ~%95). *Pause* yağmuru durdurur, su kalır; *Reset* zemini kurutur. Dolunca yağmur durur.
  API: `map.startSimulation()`, `pauseSimulation()`, `resetSimulation()`, `toggleSimulation()`, `map.simulation`
  → `{ running, fill, time, waterKm2 }`; kökten `tif-terrain-simulation` olayı. Eski davranış (su hemen dolu,
  buton yok): `weather: { simulation: false }`. Butonu gizlemek için `simulationButton: false`.
- `map.rainAt(lon, lat)` → mm/yıl. `TifTerrain.loadRain(url)` raster'ı tek başına yükler.
- Not: damlalar yalnızca kamera bulut tabanının altındayken görünür. Varsayılan yakınlaşma sınırı
  (`maxZoomPixels: 8`) kamerayı bu DEM'de yerden ~3–4 km yukarıda tutar; damlaları görmek için
  `max-zoom-pixels="40"` gibi daha büyük bir değer ya da `min-zoom-distance="100"` verin.

## Demo

```bash
cd mapRenderer          # output_hh.tif burada
python3 -m http.server 8000
# http://localhost:8000/web/index.html          (tam ekran; ?rain=none hava katmanını kapatır)
# http://localhost:8000/web/embed-example.html  (başka bir siteye gömülmüş hali)
```

## Notlar

- **CORS:** .tif başka bir alan adından verilecekse sunucusu `Access-Control-Allow-Origin` göndermeli.
- **CRS:** Coğrafi (EPSG:4326) GeoTIFF gerekir. Projeksiyonlu dosyalar için: `gdalwarp -t_srs EPSG:4326 in.tif out.tif`.
- **Yükseklikler** elipsoit yüksekliği olarak yorumlanır (bu dosya zaten "ellipsoidal height (WGS 84)").
- **Bellek:** DEM tamamen çözülüp tutulur (9433×4561 float ≈ 170 MB + piramit). Aynı URL'yi kullanan
  birden çok harita aynı veriyi paylaşır. Çok daha büyük DEM'ler için ileride COG/range-request
  tabanlı akış eklenebilir.
- Çözümleme geotiff.js Web Worker havuzunda yapılır; sitenin CSP'si `blob:` worker'larını engelliyorsa
  otomatik olarak ana iş parçacığında yapılır.
