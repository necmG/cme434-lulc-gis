/* ── CME434 – app.js ── */

// ── MAP INIT ──────────────────────────────────────────────────────────────
var map = L.map('map', { zoomControl: true }).setView([41.05, 28.72], 11);

var osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  maxZoom: 19
}).addTo(map);

var satelliteLayer = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { attribution: 'Esri World Imagery', maxZoom: 19 }
);

// ── GEOCODER (koordinat arama) ────────────────────────────────────────────
L.Control.geocoder({
  defaultMarkGeocode: true,
  placeholder: 'Konum ara…',
  collapsed: true,
  position: 'topleft'
}).addTo(map);

// ── COLOR HELPER ─────────────────────────────────────────────────────────
function getColor(p) {
  return p > 0.8 ? '#BD0026' :
         p > 0.6 ? '#FD8D3C' :
         p > 0.4 ? '#FED976' :
         p > 0.2 ? '#4292C6' : '#08306B';
}
function getRiskLabel(p) {
  return p > 0.8 ? 'VERY HIGH' :
         p > 0.6 ? 'HIGH'      :
         p > 0.4 ? 'MEDIUM'    :
         p > 0.2 ? 'LOW'       : 'VERY LOW';
}

// ── STATE ─────────────────────────────────────────────────────────────────
var allFeatures  = [];   // tüm GeoJSON feature listesi
var lulcLayer    = null; // aktif Leaflet GeoJSON katmanı
var filterMin    = 0;
var filterMax    = 1;

// ── LAYER BUILDER ─────────────────────────────────────────────────────────
function buildLayer(features) {
  if (lulcLayer) map.removeLayer(lulcLayer);

  lulcLayer = L.geoJSON({ type: 'FeatureCollection', features: features }, {
    pointToLayer: function(feature, latlng) {
  var zoom = map.getZoom();
  var r = zoom >= 13 ? 3 : zoom >= 11 ? 1.5 : 1;
  return L.circleMarker(latlng, {
    radius: r,
    fillColor: getColor(feature.properties.probability),
    color: 'transparent',
    fillOpacity: 0.7,
    weight: 0
  });
  },
    onEachFeature: function(feature, layer) {
      layer.on('click', function() {
        showInfoCard(feature.properties);
      });
      layer.on('mouseover', function() {
        layer.setStyle({ fillOpacity: 1, radius: 7 });
      });
      layer.on('mouseout', function() {
        layer.setStyle({ fillOpacity: 0.82, radius: 5 });
      });
    }
  });

  if (document.getElementById('chk_change').checked) {
    lulcLayer.addTo(map);
  }
}

// ── INFO CARD ─────────────────────────────────────────────────────────────
function showInfoCard(props) {
  var p    = props.probability;
  var body = document.getElementById('info-body');
  var riskColor = getColor(p);

  body.innerHTML =
    row('Change Probability', '<span style="color:' + riskColor + ';font-size:16px;font-weight:800">' + (p * 100).toFixed(1) + '%</span>') +
    row('Risk Class',       '<span style="color:' + riskColor + '">' + getRiskLabel(p) + '</span>') +
    row('NDVI 2018',         fmt(props.NDVI_2018)) +
    row('NDVI 2025',         fmt(props.NDVI_2025)) +
    row('NDBI 2018',         fmt(props.NDBI_2018)) +
    row('NDBI 2025',         fmt(props.NDBI_2025)) +
    row('Prediction',            props.prediction === 1 ? '<span style="color:#BD0026">Changed</span>' : '<span style="color:#4292C6">Unchanged</span>');

  document.getElementById('info-card').classList.remove('hidden');
}
function row(k, v) {
  return '<div class="info-row"><span class="info-key">' + k + '</span><span class="info-val">' + v + '</span></div>';
}
function fmt(val) {
  return val !== undefined && val !== null ? Number(val).toFixed(4) : 'N/A';
}
document.getElementById('info-close').addEventListener('click', function() {
  document.getElementById('info-card').classList.add('hidden');
});

// ── STATS ─────────────────────────────────────────────────────────────────
function updateStats(features) {
  var total   = features.length;
  var changed = features.filter(function(f) { return f.properties.prediction === 1; }).length;
  var high    = features.filter(function(f) { return f.properties.probability > 0.6; }).length;
  var pct     = total > 0 ? ((changed / total) * 100).toFixed(1) + '%' : '—';

  document.getElementById('stat-total').textContent   = total;
  document.getElementById('stat-changed').textContent = changed;
  document.getElementById('stat-pct').textContent     = pct;
  document.getElementById('stat-high').textContent    = high;

  // Bar chart
  var counts = { vl: 0, l: 0, m: 0, h: 0, vh: 0 };
  features.forEach(function(f) {
    var p = f.properties.probability;
    if      (p <= 0.2) counts.vl++;
    else if (p <= 0.4) counts.l++;
    else if (p <= 0.6) counts.m++;
    else if (p <= 0.8) counts.h++;
    else               counts.vh++;
  });
  var max = Math.max(counts.vl, counts.l, counts.m, counts.h, counts.vh, 1);
  function setBar(id, cntId, val) {
    document.getElementById(id).style.width = ((val / max) * 100) + '%';
    document.getElementById(cntId).textContent = val;
  }
  setBar('bar-vl', 'cnt-vl', counts.vl);
  setBar('bar-l',  'cnt-l',  counts.l);
  setBar('bar-m',  'cnt-m',  counts.m);
  setBar('bar-h',  'cnt-h',  counts.h);
  setBar('bar-vh', 'cnt-vh', counts.vh);
}

// ── FILTER ────────────────────────────────────────────────────────────────
function applyFilter() {
  var filtered = allFeatures.filter(function(f) {
    var p = f.properties.probability;
    return p >= filterMin && p <= filterMax;
  });
  buildLayer(filtered);
  updateStats(filtered);
}

// Risk buttons
document.querySelectorAll('.risk-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.risk-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    filterMin = parseFloat(btn.dataset.min);
    filterMax = parseFloat(btn.dataset.max);
    applyFilter();
  });
});

// ── LAYER TOGGLES ─────────────────────────────────────────────────────────
document.getElementById('chk_change').addEventListener('change', function() {
  if (!lulcLayer) return;
  if (this.checked) lulcLayer.addTo(map);
  else map.removeLayer(lulcLayer);
});

document.getElementById('chk_satellite').addEventListener('change', function() {
  if (this.checked) {
    map.removeLayer(osmLayer);
    satelliteLayer.addTo(map);
  } else {
    map.removeLayer(satelliteLayer);
    osmLayer.addTo(map);
  }
});

// ── LOAD DATA ─────────────────────────────────────────────────────────────
fetch('data/lulc_change.geojson?v=' + Date.now())
  .then(function(r) { return r.json(); })
  .then(function(data) {
    allFeatures = data.features;
    applyFilter();       // initial render (all features)
  })
  .catch(function(err) {
    console.error('GeoJSON yüklenemedi:', err);
    alert('GeoJSON verisi yüklenemedi. Dosya yolunu kontrol edin.');
  });
