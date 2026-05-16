# CME434 – LULC Değişimi & Kentsel Yayılma Web GIS Uygulaması

Karabük Üniversitesi · Bilgisayar Mühendisliği · CME434 Final Projesi

## Özellikler
- Leaflet.js interaktif harita
- 5 risk sınıfına göre renk kodlu LULC değişim katmanı
- Risk filtresi (Tümü / Çok Düşük / Düşük / Orta / Yüksek / Çok Yüksek)
- Nokta tıklama bilgi kartı (olasılık, NDVI, NDBI değerleri)
- İstatistik paneli (toplam, değişmiş, oran, yüksek risk sayısı)
- Risk dağılımı çubuk grafiği
- Koordinat arama kutusu (Geocoder)
- Uydu / OSM katman geçişi

---

## GitHub Pages Yayınlama (Adım Adım)

1. **GitHub hesabı aç** → github.com (yoksa kayıt ol)
2. **New Repository** → isim: `cme434-lulc-gis` → **Public** seç → Create
3. Dosyaları yükle:
   - `index.html`
   - `css/style.css`
   - `js/app.js`
   - `data/lulc_change.geojson`
4. **Settings → Pages → Source: Deploy from a branch → Branch: main / root → Save**
5. 2-3 dakika bekle → URL: `https://KULLANICI_ADI.github.io/cme434-lulc-gis`

---

## Gerçek Veri Entegrasyonu

Ekibinden `lulc_change_map.csv` geldiğinde:

```python
import pandas as pd, json

df = pd.read_csv('lulc_change_map.csv')
# Opsiyonel: boyutu küçültmek için örnekleme
# df = df.sample(n=50000, random_state=42)

features = []
for _, row in df.iterrows():
    features.append({
        'type': 'Feature',
        'geometry': {'type': 'Point', 'coordinates': [row['longitude'], row['latitude']]},
        'properties': {
            'probability': round(float(row['probability']), 4),
            'prediction':  int(row['prediction']),
            'NDVI_2018':   round(float(row.get('NDVI_2018', 0)), 4),
            'NDVI_2025':   round(float(row.get('NDVI_2025', 0)), 4),
            'NDBI_2018':   round(float(row.get('NDBI_2018', 0)), 4),
            'NDBI_2025':   round(float(row.get('NDBI_2025', 0)), 4),
        }
    })

with open('data/lulc_change.geojson', 'w') as f:
    json.dump({'type': 'FeatureCollection', 'features': features}, f)
print(f'{len(features)} piksel yazıldı.')
```

`data/lulc_change.geojson` dosyasını bu çıktıyla değiştir → GitHub'a push et → bitti.

---

## Dosya Yapısı

```
cme434-lulc-gis/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── app.js
├── data/
│   └── lulc_change.geojson   ← mock veri (gerçek veriyle değiştirilecek)
└── README.md
```
