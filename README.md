# Robovan Maliyet Simülatörü

Robovan (elektrikli, L4 otonom) ile Geleneksel Van'ı (dizel, sürücülü) aynı rotada canlı karşılaştıran maliyet simülatörü. İki araç 06:00'dan başlayarak haritada aynı anda hareket eder; canlı sefer maliyeti, yıllık filo maliyeti ve geri ödeme motordan beslenir. Aynı iki kategoride farklı marka/model eklenip karşılaştırılabilir (en çok 6 araç).
**Nihai çıktı tek dosyadır: `dist/index.html`** (kopyası `index.html`, ≈1,9 MB; Inter Tight yazı tipi, OFL-1.1, dosyaya gömülüdür). Sunucu, hesap, anahtar veya veritabanı yoktur.
Harita kütüphanesi (MapLibre GL JS 4.7.1, BSD-3) ve 3D araç için Three.js (r152, MIT) dosyanın içine gömülüdür.
Görünen ürün adı **Robovan**'dır. Yalnızca koyu tema vardır.

## Kullanım
`index.html` dosyasını tarayıcıda açın (doğrudan dosya olarak veya localhost'tan). Hesaplama ve grafikler internetsiz çalışır.
Harita, rota ve adres arama için internet gerekir; anahtar gerekmez.

## Dış servisler (ücretsiz, anahtarsız, kredi kartsız)
| Servis | Ne için | Sınırlama |
|---|---|---|
| tiles.openfreemap.org | Harita karoları ve stil (OpenStreetMap verisi) | gönüllü/bağış destekli |
| router.project-osrm.org, yedek routing.openstreetmap.de | OSRM karayolu rotası, otomobil profili | adil kullanım; kamyonet kısıtları yok |
| photon.komoot.io | Adres arama (yalnız Ara/Enter) | adil kullanım |

İstekler: tek hat, en az 1,1 sn aralık, önceki istek iptal, rota önbelleği (14 gün, en çok 12 rota). Servisler çalışmazsa hesap tahminle sürer.

## Dosya yapısı
```
src/            hesap motoru (saf fonksiyonlar): defaults (iki kategori, en çok 6 araç), geo, validate, engine, live (canlı sefer defteri), migrate (v2→v3 kayıt taşıma), index
ui/             arayüz: index.template.html, styles.css, data.js, map.js (MapLibre + servisler), van3d.js (fotoğraf referanslı Robovan + Geleneksel Van, çoklu Three.js araç), demoRoute.js (kayıtlı örnek rota), charts.js, app.js
vendor/         maplibre-gl.js/css, three.min.js ve lisansları (build sırasında dosyaya gömülür)
tools/          build.js (motor paketi), build-ui.js (tek dosya index.html üretir)
tests/          run.js (136 motor testi), independent_check.py (34.854 bağımsız karşılaştırma), ui-check*.js (araç/saat/eşzamanlı hareket, 3D piksel kanıtı, 7 genişlik responsive dahil), shots4.js, fixtures/ (OSRM/Photon kayıtları)
docs/           şartname, analiz raporu, harita test rehberi
dist/           derleme çıktısı
```

## Komutlar (Node 18+, Python 3)
```
npm run build            # dist/index.html üretir
npm test                 # 136 motor testi
npm run test:independent # bağımsız Python hesabı (400 senaryo, 2–6 araç, canlı defter dahil)
npm run test:ui          # arayüz testleri (ui-check, 2, 3, 4) (Playwright; internet gerekir: gerçek OpenFreeMap karoları)
npm run test:render      # ekran görüntüleri (shots/)
```

## Canlı simülasyon
- Saat 06:00'da başlar. ×1 = 1 simülasyon dakikası / gerçek saniye, ×3 = 3, ×6 = 6. Oynat, duraklat, devam, sıfırla çalışır.
- Hız çarpanı yalnızca zamanın akışını değiştirir; aynı operasyonun toplam maliyeti değişmez.
- Her aracın kendi hızı, durak beklemesi ve tüketim/maliyet parametresi vardır. Konum, km, elektrik/dizel tüketimi ve biriken maliyet `src/live.js` defterinden gelir.
- Canlı değerler TEK SEFERİN birikimidir (yıllık filo maliyeti değildir). Sefer sonunda toplam, motorun "sefer başına maliyet" değerine eşittir.
- Birikim kuralı: enerji ve bakım/lastik kat edilen yola; sigorta, vergi, lisans, personel, amortisman ve finansman geçen süreye orantılı.

## Hesap kararları (değişmez)
Rota 56,09 km (Gebze→İzmit, kuş uçuşu × 1,3), sürücü maliyeti 12 ay sabit, para birimi yalnız etiket, ülke ön ayarı yok.
Tüm tutarlar örnek varsayımdır; gerçek teklif değildir.

## Lisans notu
MapLibre GL JS (BSD-3-Clause) ve Three.js (MIT) lisans metinleri `vendor/` altındadır. Harita verisi © OpenStreetMap katkıcıları (ODbL), © OpenMapTiles.
