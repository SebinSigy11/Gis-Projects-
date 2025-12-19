// 1.import your California shaepfile
var aoi = Table projects/modular-design-474605-j6/assets/California

var aoi = aoi.geometry();    
Map.centerObject(aoi, 6);


var aoiMask = ee.Image.constant(1).clip(aoi);  

// 2. Dates and parameters
var postStart = '2025-01-07';
var postEnd   = '2025-01-31';

var preStart  = '2024-12-07';
var preEnd    = '2025-01-06';

var maxCloud = 30;
var scale = 20;

// 3. Cloud mask
function maskS2clouds(image) {
  var qa = image.select('QA60');
  var cloudBitMask  = 1 << 10;
  var cirrusBitMask = 1 << 11;

  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
               .and(qa.bitwiseAnd(cirrusBitMask).eq(0));

  return image
    .updateMask(mask)
    .divide(10000)
    .copyProperties(image, ['system:time_start']);
}

// 4. Pre and post composites 
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(aoi)
  .filterMetadata('CLOUDY_PIXEL_PERCENTAGE', 'less_than', maxCloud);

var preFire = s2.filterDate(preStart, preEnd).map(maskS2clouds).median()
  .clip(aoi)
  .updateMask(aoiMask);

var postFire = s2.filterDate(postStart, postEnd).map(maskS2clouds).median()
  .clip(aoi)
  .updateMask(aoiMask);

// 5. NBR and dNBR
var preNBR  = preFire.normalizedDifference(['B8', 'B12']).rename('preNBR');
var postNBR = postFire.normalizedDifference(['B8', 'B12']).rename('postNBR');

var dNBR = preNBR.subtract(postNBR)
  .rename('dNBR')
  .updateMask(aoiMask);   
// 6. Burn severity classes + mask
var severity = dNBR.expression(
  "b('dNBR') <= 0.10 ? 0" +
  ": b('dNBR') <= 0.27 ? 1" +
  ": b('dNBR') <= 0.44 ? 2" +
  ": b('dNBR') <= 0.66 ? 3" +
  ": 4"
).rename('severity')
 .updateMask(aoiMask);    
var severityPalette = [
  '00a600', // Unburned
  'a6ff00', // Low
  'ffff00', // Moderate low
  'ff9900', // Moderate high
  'ff0000'  // High
];

// 7. Map layers 
Map.addLayer(aoi, {}, 'California boundary');
Map.addLayer(dNBR,
  {min: -0.5, max: 1.0, palette: ['blue', 'white', 'yellow', 'orange', 'red']},
  'dNBR (CA only)'
);
Map.addLayer(severity,
  {min: 0, max: 4, palette: severityPalette},
  'Burn severity classes (CA only)'
);
// 8.Exporting to google drive 
Export.image.toDrive({
  image: finalImage,        // change this to your image name
  description: 'GEE_Export',
  folder: 'GEE_exports',    // Drive folder name
  fileNamePrefix: 'result',
  region: aoi,              // or aoi.geometry()
  scale: 30,                
  maxPixels: 1e13
});
