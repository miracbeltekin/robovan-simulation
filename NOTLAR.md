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

## v0.7.1 — 3D araç görünürlüğü
- 3D araçların ekran boyutu artık yakınlaştırmaya göre ayarlanır (`ui/van3d.js`): tüm rota/üstten görünümde yaklaşık 46 px, yakında gerçek boyutun en az 3 katı; aynı model tüm kamera modlarında çizilir (3D, Üstten, Tüm rota, Aracı takip et).
- Kameranın kalıcı boşluğu (`ui/map.js` `pad()`): araçlar canlı panel, rota kartı ve düğmelerin altında kalmaz.
- Etiketler büyüyen araç gövdesinin üstünde durur.
- Yeni test: `tests/mode-check.js` (gerçek tarayıcıda araç gizle/göster piksel farkı, her mod, masaüstü + mobil, yakın görünüm detayı).

## v0.8.0 — referans mantığına yaklaşma (tüm gün, filo; araç etiketinde canlı maliyet)
Referans site (heritage-b.club/lab/robotaxi) kaynak koduyla yeniden incelendi. Farklar ve yapılanlar:
- **Etiket:** Referansta her aracın üstünde "bugünkü net + durum" vardır ve her olayda zıplar. Bizde de her aracın üstünde canlı maliyet ($) ve durum var; tutar artarken sefer bitince etiket zıplar; ucuz olan tür yeşil, pahalı olan kırmızı. Uzak görünümde etiketler kompakt (renk + tutar), yakında ad + tutar + durum.
- **Tüm gün, filo:** Tek sefer yerine 06:00'dan günün sonuna kadar her araç kendi seferlerini art arda yapar (araç sayısı kadar araç). Gün sonunda tür bazında toplam = motorun günlük filo maliyeti (yıllık ÷ çalışma günü); bağımsız Python doğrulaması bunu da kontrol eder (`src/live.js` `buildDay`).
- **Sefer sonu bildirimi:** Biten seferin maliyeti ve karşı türün aynı sefer maliyeti haritanın üstünde görünür.
- **Araç kartı:** Araç etiketine dokunun: bugünkü maliyet, yol, tüketim, km maliyeti, 5 maliyet kalemi.
- **Neden bu sonuç?** kartı: km başına farkın hangi kalemden geldiği, tür sıralaması.
- **Ya olursa?** çipleri: Dizel +%20, Sürücü +%30, Operatör başına 10 araç, Robovan fiyatı −%10; girdiğiniz değerler değişmez, ana senaryo ile karşılaştırma ve geri ödeme görünür.
- Referansta olup bizde olmayanlar (bilinçli): gelir/kâr (bizde yalnız maliyet var), Three.js özel sahnesi (biz MapLibre kullanıyoruz), 7 günlük geçmiş grafiği, e-posta formu.

## v0.8.1 — araç sayısı kolay düzenleme
- Ana ekrandaki karar kartında her aracın başlığında [−] sayı [+]. Varsayılan "otomatik" (günlük sefere göre hesaplanır); [+]/[−] elle moda alır, "otomatiğe dön (N)" otomatiğe geri getirir.
- Her model kendi sayısına sahiptir (`vehicle.count`, 0 = otomatik). Eski "Robovan sayısını sabitle" alanı kaldırıldı; eski kayıttaki değer Robovan araç sayısına taşınır.
- Sayı talebi karşılamıyorsa kartta ve uyarılarda "yetmiyor, gereken N" görünür; hesap sürer. 1 ile 200 arası (motor 1000'e kadar).
- Haritada her türden en çok 8 araç gösterilir; hesap, gün defteri ve HUD tüm araçları kapsar.

## v0.9.0 — sadeleştirme turu (kullanıcı kararlarıyla)
- **Ana ekran (orta yol):** panelde yalnızca Karar kartı (verdict, yıllık fark, araç sayısı, km/sefer/yıllık), Yıllık maliyet çubuğu, "Neyi değiştirebilirim?" (5 değer + "Ya olursa?" çipleri) ve katlı "Neden bu sonuç?". İpucu kartı kaldırıldı.
- **Çubuk sekmeleri 3 → 1:** ana ekranda yalnızca yıllık filo çubuğu; "Canlı sefer / Sefer başına / Yıllık filo" seçenekleri Detaylı Analiz > Özet'e taşındı.
- **Karşılaştırma seçici gizli:** iki modelde Robovan ↔ Geleneksel Van sabittir; seçici üçüncü model eklenince görünür.
- **Mobil:** harita ekranın ~%80'i; sonuçlar açılır-kapanır alt panelde (kapalıyken yalnız "Robovan %51 daha ekonomik · $81.118/yıl" özet çubuğu); harita görünüm düğmeleri ⋯ arkasında.
- Yeni test: `tests/ui-check8.js`.
