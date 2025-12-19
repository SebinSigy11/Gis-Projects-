Map.centerObject(roi, 9);

var empty = ee.Image().byte();
var outline = empty.paint({
 featureCollection: roi,
 color: 'black',
 width: 2
});
Map.addLayer(outline, {palette: 'red'}, 'APA');



var startYear = 2010;
var endYear = 2020;

var years = ee.List.sequence(startYear, endYear);

var months = ee.List.sequence(1, 12);

// Define start date and end date
var startDate = ee.Date.fromYMD(startYear, 1, 1);
var endDate = ee.Date.fromYMD(endYear, 12, 31);



var chirps = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
 .select('precipitation')
 .filterDate(startDate, endDate)
 .filterBounds(roi);
print('How many:', chirps.size());


var precYearlyAccumulated = ee.ImageCollection.fromImages(
 years.map(function(year) {
 var annualPrecipitation = chirps.filter(ee.Filter.calendarRange(year, year, 'year'))
 .sum()
 .clip(roi);
 return annualPrecipitation
 .set('year', year)
 .set('system:time_start', ee.Date.fromYMD(year, 1, 1));
 })
);
print('Collection from CHIRPS by year', precYearlyAccumulated);

var monthlyAccumulatedPrecipitation = ee.ImageCollection.fromImages(
years.map(function(y) {
return months.map(function(m) {
var precipitationMonth = chirps.filter(ee.Filter.calendarRange(y, y, 'year'))
.filter(ee.Filter.calendarRange(m, m, 'month'))
.sum()
.clip(roi);
return precipitationMonth.set('year', y)
.set('month', m)
.set('system:time_start', ee.Date.fromYMD(y, m, 1));
});
}).flatten()
);
print('CHIRPS monthly image collection', monthlyAccumulatedPrecipitation);

Map.addLayer(monthlyAccumulatedPrecipitation, {palette:['white','red','yellow','green','blue'], min: 23, max: 104}, 'Average Monthly Data');
Map.addLayer(precYearlyAccumulated, {palette:['white','red','yellow','green','blue'], min: 535, max: 1624}, 'Annual Accumulated Data');

var chartYearlyPrecipitation = ui.Chart.image.seriesByRegion({
imageCollection: precYearlyAccumulated,
regions: roi,
reducer: ee.Reducer.mean(),
band: 'precipitation',
scale: 5000,
xProperty: 'system:time_start',
seriesProperty: 'nome'
})
.setOptions({
title: 'Annual Accumulated Precipitation in Uttrakahand ',
hAxis: {title: 'Time Interval'},
vAxis: {title: 'P (mm)'},
lineWidth: 1,
pointSize: 5,
series: {
0: {color: 'DeepSkyBlue'},
1: {color: 'blue'},
2: {color: 'SteelBlue'},
3: {color: 'Green'}
}
})
.setChartType('ColumnChart');

print(chartYearlyPrecipitation);


var calculateDailyPrecipitation = function(image) {

  var date = ee.Date(image.get('system:time_start'));
  
  var year = date.get('year');
  var month = date.get('month');
  
  var daysInMonth = ee.Date.fromYMD(year, month, 1).advance(1, 'month').difference(ee.Date.fromYMD(year, month, 1), 'day');
  
  var dailyPrecipitation = image.divide(daysInMonth).copyProperties(image, ['system:time_start']);
  
  return dailyPrecipitation;
};


var dailyPrecipitation = monthlyAccumulatedPrecipitation.map(calculateDailyPrecipitation);


var chartDailyPrecipitation = ui.Chart.image.seriesByRegion({
  imageCollection: dailyPrecipitation,
  regions: roi,
  reducer: ee.Reducer.sum(),
  scale: 5000,
  xProperty: 'system:time_start',
  seriesProperty: 'nome'
})
.setOptions({
  title: 'monthly Precipitation in potohar ',
  hAxis: {title: 'Time'},
  vAxis: {title: 'Precipitation (mm)'},
  lineWidth: 1,
  pointSize: 5,
  series: {
    0: {color: 'DeepSkyBlue'},
    1: {color: 'blue'},
    2: {color: 'SteelBlue'},
    3: {color: 'Green'}
  }
})
.setChartType('LineChart');

print(chartDailyPrecipitation);

years.getInfo().forEach(function(year) {
  var annualImage = precYearlyAccumulated.filter(ee.Filter.eq('year', year)).first();
  
  Export.image.toDrive({
    image: annualImage,
    description: 'Annual_Precipitation_' + year,
    folder: 'GEE_Exports',
    fileNamePrefix: 'Annual_Precipitation_' + year,
    region: roi,
    scale: 5000,
    crs: 'EPSG:4326',
    maxPixels: 1e13
  });
});


years.getInfo().forEach(function(year) {
  months.getInfo().forEach(function(month) {
    var monthlyImage = monthlyAccumulatedPrecipitation
      .filter(ee.Filter.eq('year', year))
      .filter(ee.Filter.eq('month', month))
      .first();
    
    Export.image.toDrive({
      image: monthlyImage,
      description: 'Monthly_Precipitation_' + year + '_' + month,
      folder: 'GEE_Exports',
      fileNamePrefix: 'Monthly_Precipitation_' + year + '_' + month,
      region: roi,
      scale: 5000,
      crs: 'EPSG:4326',
      maxPixels: 1e13
    });
  });
});
