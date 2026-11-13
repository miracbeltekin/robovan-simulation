# Proje notları
- Görünen ürün adı **Robovan** (Robovan Maliyet Simülatörü). "Robotaxi" ismi hiçbir yerde kullanılmaz; yalnızca referans site adıdır.
- Hesap kararları: rota 56,09 km, sürücü maliyeti 12 ay sabit, para birimi yalnız etiket, ülke ön ayarı yok.
- Harita altyapısı: MapLibre GL JS + OpenFreeMap (anahtarsız). Mapbox tamamen kaldırıldı.
- Rota OSRM (yedek FOSSGIS OSRM, otomobil profili); adres arama Photon (yalnız Ara/Enter).


## v0.6.0 — nihai kararlar uygulandı
- Yalnızca iki başlangıç aracı: Robovan ve Geleneksel Van. Elektrikli Van kaldırıldı (eski kayıtlar güvenle taşınır; değiştirilmiş eski Elektrikli Van verisi 'Özel Van (eski kayıt)' olarak korunur).
- Araç ekle / çoğalt / sil / adlandır / karşılaştır; en çok 6 araç.
- 06:00 saatli canlı simülasyon, iki araç aynı anda hareket eder; canlı panel haritada ve sağ panelde.
- 7 günlük grafik yerine araç maliyet çubukları (Canlı sefer / Sefer başına / Yıllık filo).
- Inter Tight yazı tipi (OFL-1.1) gömülü; yalnız 400/500/600.

## v0.7.0 — 3D araç, görünürlük ve UX yenilemesi
- **Araçlar neden görünmüyordu:** Araçlar yalnızca karayolu rota geometrisi hazırsa çiziliyordu (rota yoksa temizleniyordu). Rota servisi (OSRM) yanıt vermezse/geç yanıt verirse araçlar hiç görünmüyordu. Artık araçlar başlangıç noktasında park halinde her zaman görünür; hareket yalnız gerçek (veya DEMO) rota geometrisiyle başlar ve başlamıyorsa nedeni yazılır.
- **DEMO rota:** Yalnız varsayılan Gebze → İzmit rotası için, servis yanıt vermezse, önceden kaydedilmiş gerçek OSRM geometrisi kullanılır; rozet ve uyarıyla "DEMO" olarak belirtilir. Başka rotalarda uydurma hareket yoktur.
- **3D model:** `ui/van3d.js` — fotoğraftaki kabinsiz beyaz Robovan referans alınarak gerçek 3D geometriyle modellendi (yuvarlatılmış gövde, siyah çerçeveli iki yan kapak, menteşe/kilit, siyah şasi, tampon, sensörler, 4 tekerlek). Fotoğrafta görünmeyen yüzeyler TAHMİNİ tamamlanmıştır; üretici CAD verisi değildir. GLB kullanılmadı: tek dosyalık statik yapı korunur.
- **UX:** karar kartı (kim ekonomik, fark, yüzde, km/sefer maliyeti), 5 ana değer, Rakamlarım 4 grup (Operasyon · Robovan · Geleneksel Van · Gelişmiş), Detaylı Analiz 4 sekme (Özet · Maliyet Dağılımı · Yatırım ve Geri Ödeme · Duyarlılık), tek sayfa kaydırma, 8 px aralık sistemi.
