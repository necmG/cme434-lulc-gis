# Google Earth Engine Script Documentation

**CME434 — Land Use / Land Cover Change Detection & Urban Sprawl Analysis**
Karabük University · Department of Computer Engineering · Istanbul Study Area

---

## Overview

This documentation describes the complete Google Earth Engine (GEE) JavaScript pipeline developed for Phase 1 of the CME434 final project. The pipeline covers multi-temporal Sentinel-2 image acquisition, spectral index computation, topographic and socio-economic feature extraction, training data construction, and export routines for downstream machine learning analysis.

| Parameter | Value |
|---|---|
| Platform | Google Earth Engine (JavaScript API) |
| Study Area | Istanbul Northwest Development Corridor |
| Imagery | Sentinel-2 SR Harmonized (COPERNICUS/S2_SR_HARMONIZED) |
| Time Steps | T1: 2023, T2: 2024, T3: 2025 |
| Coordinate System | EPSG:4326 (WGS84) |
| Output Format | GeoTIFF (raster layers), CSV (tabular data) |

---

## 1. Study Area Definition

### Code

```javascript
var aoi = ee.Geometry.Rectangle([28.30, 40.80, 29.20, 41.35]);
Map.centerObject(aoi, 10);
Map.addLayer(aoi, {color: 'FF0000'}, 'AOI Siniri');
```

### Explanation

The study area (Area of Interest, AOI) is defined as the Istanbul Northwest Development Corridor, encompassing the Başakşehir–Arnavutköy axis within an approximately 50 × 50 km bounding rectangle. This corridor was selected on the basis of its documented status as one of the highest-velocity land cover transformation zones in Turkey, characterised by concurrent mega-infrastructure projects, active urban renewal initiatives, and measurable agricultural land loss. The spatial extent constitutes an analytically optimal modelling domain, balancing spatial coverage against computational tractability within the GEE environment.

---

## 2. Image Preprocessing

### 2.1 Cloud Masking Function

#### Code

```javascript
function maskS2clouds(image) {
  var qa = image.select('QA60');
  var cloudBitMask  = 1 << 10;
  var cirrusBitMask = 1 << 11;
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
               .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  return image.updateMask(mask).divide(10000);
}
```

#### Explanation

To isolate surface reflectance signals from atmospheric contamination, a bitwise cloud masking function is applied to all Sentinel-2 Level-2A imagery prior to analysis. The function interrogates the QA60 quality assurance band at the bit level: Bit 10 encodes opaque cloud presence and Bit 11 encodes cirrus cloud contamination. Pixels flagged by either condition are excluded via a combined Boolean mask. The remaining valid pixels are subsequently normalised by division by 10,000, converting raw digital numbers to dimensionless surface reflectance values in the range [0, 1], thereby ensuring spectral comparability across acquisition dates and atmospheric conditions.

---

### 2.2 Multi-temporal Image Acquisition

#### Code

```javascript
var s2_T1 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(aoi)
  .filterDate('2023-05-01', '2023-09-30')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
  .map(maskS2clouds).median().clip(aoi);

var s2_T2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(aoi)
  .filterDate('2024-05-01', '2024-09-30')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
  .map(maskS2clouds).median().clip(aoi);

var s2_T3 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(aoi)
  .filterDate('2025-03-01', '2025-05-10')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
  .map(maskS2clouds).median().clip(aoi);
```

#### Explanation

Three temporally distinct Sentinel-2 SR Harmonized image collections are acquired to characterise land cover dynamics across a multi-year observation window. Collections are spatially constrained to the AOI and temporally filtered to late spring through early autumn windows, which minimise cloud frequency over the Istanbul region and align with phenologically stable vegetation states. A scene-level cloud cover threshold of 10% is applied prior to pixel-level masking to further reduce atmospheric artefacts. The cloud masking function is mapped across each collection, after which a pixel-wise median composite is computed to produce a single, spectrally representative image per time step. This compositing strategy suppresses residual noise and atmospheric anomalies that survive pixel-level masking, yielding clean, analysis-ready imagery for each period.

---

### 2.3 Visualisation

#### Code

```javascript
var rgbVis        = {bands: ['B4','B3','B2'], min: 0, max: 0.3};
var falseColorVis = {bands: ['B8','B4','B3'], min: 0, max: 0.5};

Map.addLayer(s2_T1, rgbVis,        'T1 2023 RGB');
Map.addLayer(s2_T2, rgbVis,        'T2 2024 RGB');
Map.addLayer(s2_T3, rgbVis,        'T3 2025 RGB');
Map.addLayer(s2_T3, falseColorVis, 'T3 2025 FalseColor');
```

#### Explanation

True-colour (RGB: B4, B3, B2) and near-infrared false-colour (NIR-Red-Green: B8, B4, B3) composite visualisations are generated for each time step to facilitate qualitative assessment of image quality and spatial coverage. The false-colour composite is of particular utility in the subsequent manual labelling stage: built-up and impervious surfaces render in grey-to-purple tones, while healthy vegetation appears in distinct red tones, enabling precise visual discrimination of land cover transitions between acquisition periods.

---

## 3. Spectral Indices

### Code

```javascript
var ndvi_T1 = s2_T1.normalizedDifference(['B8','B4']).rename('NDVI_T1');
var ndvi_T2 = s2_T2.normalizedDifference(['B8','B4']).rename('NDVI_T2');
var ndvi_T3 = s2_T3.normalizedDifference(['B8','B4']).rename('NDVI_T3');

var ndbi_T1 = s2_T1.normalizedDifference(['B11','B8']).rename('NDBI_T1');
var ndbi_T3 = s2_T3.normalizedDifference(['B11','B8']).rename('NDBI_T3');

var mndwi = s2_T1.normalizedDifference(['B3','B11']).rename('MNDWI');

var evi = s2_T1.expression(
  '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))',
  {NIR:  s2_T1.select('B8'),
   RED:  s2_T1.select('B4'),
   BLUE: s2_T1.select('B2')}
).rename('EVI');

var dNDVI = ndvi_T3.subtract(ndvi_T1).rename('dNDVI');
Map.addLayer(dNDVI,
  {min: -0.5, max: 0.5, palette: ['red','white','green']},
  'dNDVI T1-T3 Degisim');
```

### Explanation

A feature engineering stage is implemented to maximise the spectral discriminative capacity of the machine learning model. The Normalised Difference Vegetation Index (NDVI; NIR–Red / NIR+Red) is computed for all three time steps to capture temporal trajectories in vegetation density and canopy health. The Normalised Difference Built-up Index (NDBI; SWIR–NIR / SWIR+NIR) directly quantifies the areal extent and intensity of impervious surface development, and is computed for T1 and T3 to enable change-pair analysis. The Modified Normalised Difference Water Index (MNDWI; Green–SWIR / Green+SWIR) ensures reliable discrimination of permanent water bodies, preventing misclassification of aquatic surfaces as built-up areas. The Enhanced Vegetation Index (EVI) supplements NDVI with a formulation that reduces atmospheric aerosol sensitivity and canopy background noise, improving performance in densely vegetated and high-biomass environments. The temporal difference index dNDVI (T3 − T1) provides a direct, spatially explicit signal of vegetation loss, with strongly negative values indicating probable urban conversion, thereby offering the model a pre-computed change magnitude feature that encodes urbanisation dynamics without requiring separate temporal reasoning.

---

## 4. Topographic Features

### Code

```javascript
var dem       = ee.Image('USGS/SRTMGL1_003').clip(aoi);
var elevation = dem.rename('Elevation');
var slope     = ee.Terrain.slope(dem).rename('Slope');
var aspect    = ee.Terrain.aspect(dem).rename('Aspect');

var slopeRad = slope.multiply(Math.PI / 180);
var tanSlope = slopeRad.tan().max(0.001);
var twi      = ee.Image(1).divide(tanSlope).log().rename('TWI');
```

### Explanation

Topographic conditioning variables are derived from the USGS Shuttle Radar Topography Mission (SRTM) 30-metre Digital Elevation Model to represent the geomorphological constraints governing urban expansion potential. Elevation, slope gradient, and slope aspect are extracted as primary terrain derivatives. Additionally, a Topographic Wetness Index (TWI) is computed as a proxy for local drainage capacity and susceptibility to waterlogging. The TWI derivation converts slope values from degrees to radians prior to trigonometric transformation, and applies a small minimum threshold to the tangent denominator to prevent numerical instability at near-zero slope values. Steep terrain serves as a natural impediment to urbanisation, whereas low-gradient, well-drained surfaces represent areas of elevated conversion risk, providing the model with geomorphologically grounded spatial constraints.

---

## 5. Land Cover and Socio-economic Layers

### Code

```javascript
var worldcover = ee.Image('ESA/WorldCover/v200/2021')
  .clip(aoi).rename('LandCover');

var dynamicWorld = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
  .filterBounds(aoi)
  .filterDate('2025-01-01', '2025-05-10')
  .select('label').mode().clip(aoi)
  .rename('DynamicWorld_2025');

var ghsl = ee.ImageCollection('JRC/GHSL/P2023A/GHS_BUILT_S')
  .select('built_surface')
  .mosaic()
  .clip(aoi)
  .rename('GHSL_Built');

var popDensity = ee.ImageCollection('CIESIN/GPWv411/GPW_Population_Density')
  .filterDate('2020-01-01', '2021-01-01')
  .first().clip(aoi)
  .rename('PopDensity');
```

### Explanation

Global thematic datasets are integrated to provide the model with socio-economic and land cover contextual information. The ESA WorldCover 2021 product at 10-metre spatial resolution furnishes a high-accuracy, globally consistent land cover classification as a baseline reference layer. Google Dynamic World 2025 contributes a near-real-time probabilistic land cover characterisation, with the modal class label extracted across the target date range to represent the dominant contemporary land surface state. The Global Human Settlement Layer (GHSL) Built Surface product from the European Commission Joint Research Centre (JRC) quantifies historical built-up surface density, providing a direct measure of pre-existing urbanisation intensity. The CIESIN Gridded Population of the World (GPWv4) population density dataset introduces a demographic pressure variable, operationalising the well-established relationship between population concentration and urban expansion demand.

---

## 6. Climate and Hydrological Layers

### Code

```javascript
var lst = ee.ImageCollection('MODIS/061/MOD11A1')
  .filterBounds(aoi)
  .filterDate('2025-03-01', '2025-05-10')
  .select('LST_Day_1km').mean()
  .multiply(0.02).subtract(273.15)
  .clip(aoi).rename('LST');

var chirps = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
  .filterBounds(aoi)
  .filterDate('2024-01-01', '2025-01-01')
  .sum().clip(aoi)
  .rename('Precipitation');

var soilMoisture = ee.ImageCollection('NASA/SMAP/SPL4SMGP/007')
  .filterBounds(aoi)
  .filterDate('2025-03-01', '2025-05-10')
  .select('sm_surface').mean()
  .clip(aoi).rename('SoilMoisture');

var hydroRivers = ee.FeatureCollection('WWF/HydroSHEDS/v1/FreeFlowingRivers')
  .filterBounds(aoi);
var riverDist = hydroRivers.distance(50000)
  .clip(aoi).rename('Dist_River');
```

### Explanation

Environmental and climatic covariates are incorporated to capture the physical and hydrological determinants of land use change. MODIS MOD11A1 daytime Land Surface Temperature (LST) is retrieved as a mean composite for the study period; raw digital values are converted to surface temperature in degrees Celsius by applying the product-specific scale factor (×0.02) and subtracting the Kelvin offset (−273.15). LST serves as a spatially explicit indicator of the Urban Heat Island (UHI) effect, a well-documented thermal signature of impervious surface expansion. Annual cumulative precipitation is derived from the Climate Hazards Group InfraRed Precipitation with Station data (CHIRPS) daily product, providing a micro-climatic moisture variable that conditions land use suitability. NASA SMAP Level-4 surface soil moisture is integrated as a proxy for agricultural productivity; lower soil moisture values are associated with reduced agricultural viability and correspondingly elevated susceptibility to land abandonment and subsequent urban conversion. The WWF HydroSHEDS free-flowing river network is used to compute Euclidean distance to the nearest riverine feature, representing the hydrographic accessibility factor that has been shown to influence settlement location preferences and urban growth directionality.

---

## 7. Export Pipeline

### Code

```javascript
function exportLayer(image, name) {
  Export.image.toDrive({
    image:       image,
    description: name,
    folder:      'CME434_GIS_Project',
    region:      aoi,
    scale:       30,
    crs:         'EPSG:4326',
    maxPixels:   1e13,
    fileFormat:  'GeoTIFF'
  });
}

Map.addLayer(s2_T1, {bands:['B8','B4','B3'], min:0, max:0.5}, 'T1 2023 FalseColor');
Map.addLayer(s2_T3, {bands:['B8','B4','B3'], min:0, max:0.5}, 'T3 2025 FalseColor');

Map.addLayer(dNDVI,
  {min: -0.5, max: 0.5, palette: ['red','white','green']},
  'dNDVI T1-T3');

Map.addLayer(worldcover,
  {min:10, max:100, palette:['006400','ffbb22','ffff4c','f096ff',
  'fa0000','b4b4b4','f0f0f0','0064c8','0096a0','00cf75','fae6a0']},
  'WorldCover 2021');
```

### Explanation

A reusable export utility function is defined to standardise the transfer of all derived raster products to Google Drive for subsequent offline processing in GIS environments (ArcGIS Pro, QGIS). All outputs are projected to EPSG:4326 (WGS84 geographic coordinate system) in accordance with global interoperability standards, and exported at a native pixel resolution of 30 metres in GeoTIFF format. The `maxPixels` parameter is set to 1×10¹³ to accommodate large-area continuous raster exports without triggering GEE pixel count limits. The companion map visualisation statements render the dNDVI change layer and ESA WorldCover classification as interactive validation overlays, enabling qualitative accuracy assessment and supporting the subsequent manual sample point labelling workflow.

---

## 8. Training Data Construction

### Code

```javascript
var samplepoints = ee.FeatureCollection(
  'projects/fleet-lightning-488618-c6/assets/samplepoints_lulc'
);

print('Toplam nokta sayısı:', samplepoints.size());
print('Örnek nokta:', samplepoints.first());

var featureStack = ee.Image([
  ndvi_T1, ndvi_T2, ndvi_T3,
  ndbi_T1, ndbi_T3,
  mndwi, evi,
  elevation, slope, aspect, twi,
  lst, worldcover,
  ghsl, popDensity,
  chirps, soilMoisture,
  riverDist, dNDVI
]);

var training = featureStack.sampleRegions({
  collection: samplepoints,
  properties: ['Label'],
  scale:       30,
  tileScale:   4
});

print('Training satır sayısı:', training.size());

Export.table.toDrive({
  collection:  training,
  description: 'training_dataset_lulc',
  fileFormat:  'CSV'
});
```

### Explanation

A balanced set of 1,000 reference points (500 Class 1: Changed; 500 Class 0: Unchanged) produced via supervised digitisation in GIS software is ingested from the GEE Asset repository. All 19 derived feature layers are combined into a single multi-band image stack (`featureStack`), with band ordering preserved identically to the subsequent prediction stack to ensure dimensional consistency during model inference. The `sampleRegions` function performs pixel-level feature extraction at each labelled point location, sampling the 19-channel feature stack at 30-metre resolution. The `tileScale: 4` parameter is employed to partition the computation into smaller tiles, mitigating memory overflow errors that commonly arise in large-area, high-dimensional sampling operations. The extracted feature matrix, including the binary class label, is exported as a CSV file to Google Drive for direct ingestion by the machine learning training pipeline in the Google Colab environment.

---

## 9. Prediction Stack Construction

### Code

```javascript
var predictionStack = ee.Image([
  ndvi_T1, ndvi_T2, ndvi_T3,
  ndbi_T1, ndbi_T3,
  mndwi, evi,
  elevation, slope, aspect, twi,
  lst, worldcover,
  ghsl, popDensity,
  chirps, soilMoisture,
  riverDist, dNDVI
]);

var pixelPoints = predictionStack.sample({
  region:    aoi,
  scale:     100,
  numPixels: 500000,
  geometries: true,
  seed:      42
});

print('Piksel sayısı:', pixelPoints.size());

Export.table.toDrive({
  collection:  pixelPoints,
  description: 'all_pixels_prediction',
  fileFormat:  'CSV'
});
```

### Explanation

To enable spatially exhaustive urban sprawl probability mapping across the entire AOI, a full-coverage prediction matrix (`predictionStack`) is constructed using an identical 19-band feature stack to that used during training, with band ordering strictly preserved to guarantee dimensional consistency during model inference. The `sample` function generates a spatially distributed point sample across the AOI at 100-metre resolution, with a maximum of 500,000 pixels retained to balance spatial coverage against computational and file size constraints. Pixel geometries are preserved (`geometries: true`) to enable subsequent spatial join and GeoJSON conversion for web-based visualisation in the Leaflet.js application. The `seed: 42` parameter ensures deterministic, reproducible spatial sampling, a requirement for scientific reproducibility and result verification. The resulting tabular dataset is exported to Google Drive for downstream probability inference and LULC change map generation in the machine learning pipeline.

---

## Feature Stack Summary

| # | Feature Name | Source | Resolution | Type |
|---|---|---|---|---|
| 1 | NDVI_T1 | Sentinel-2 2023 | 10 m | Spectral index |
| 2 | NDVI_T2 | Sentinel-2 2024 | 10 m | Spectral index |
| 3 | NDVI_T3 | Sentinel-2 2025 | 10 m | Spectral index |
| 4 | NDBI_T1 | Sentinel-2 2023 | 20 m | Spectral index |
| 5 | NDBI_T3 | Sentinel-2 2025 | 20 m | Spectral index |
| 6 | MNDWI | Sentinel-2 2023 | 20 m | Spectral index |
| 7 | EVI | Sentinel-2 2023 | 10 m | Spectral index |
| 8 | Elevation | SRTM DEM | 30 m | Topographic |
| 9 | Slope | SRTM DEM | 30 m | Topographic |
| 10 | Aspect | SRTM DEM | 30 m | Topographic |
| 11 | TWI | SRTM DEM | 30 m | Topographic |
| 12 | LST | MODIS MOD11A1 | 1 km | Thermal |
| 13 | LandCover | ESA WorldCover 2021 | 10 m | Categorical |
| 14 | GHSL_Built | JRC GHSL P2023A | 100 m | Socio-economic |
| 15 | PopDensity | CIESIN GPWv4 | ~1 km | Socio-economic |
| 16 | Precipitation | CHIRPS Daily | 5 km | Climatic |
| 17 | SoilMoisture | NASA SMAP SPL4 | 9 km | Climatic |
| 18 | Dist_River | WWF HydroSHEDS | 30 m | Hydrological |
| 19 | dNDVI | Sentinel-2 T3−T1 | 10 m | Change index |

---

*CME434 · Karabük University · Department of Computer Engineering*
