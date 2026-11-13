# Harita, rota ve adres arama: sizin yapacağınız hızlı kontrol

Bu ortamdaki tarayıcı OSRM (rota) ve Photon (adres arama) servislerine doğrudan erişemedi; bu yüzden testlerde bu iki servisin YANITLARI önceden alınmış gerçek kayıtlarla beslendi. **Harita karoları (OpenFreeMap) gerçek servisten geldi.** Aşağıdaki kontrolleri kendi bilgisayarınızda yapın. Anahtar veya hesap gerekmez.

1. `index.html` dosyasını tarayıcıda çift tıklayarak açın (internet bağlı olmalı).
2. **Harita:** Koyu, eğimli (3D) harita açılmalı. Sağ üstte zoom/pusula, sağ altta atıf (OpenFreeMap, OpenMapTiles, OpenStreetMap) görünmeli.
3. **Rota (OSRM):** Rota kartında "Gerçek karayolu mesafesi (OSRM, otomobil)" rozeti ve yaklaşık 49 km görünmeli; yeşil rota çizgisi haritada olmalı. Rozet "Tahmin: kuş uçuşu" ise rota servisine erişilememiştir (F12 → Console'da hata yazar); bu durumda hesap tahminle sürer.
4. **Animasyon:** ▶ düğmesi ile Robovan (turkuaz) ve Geleneksel Van (turuncu) aynı anda 06:00'dan itibaren rota üzerinde gitmeli (×1/×3/×6). Haritadaki panelde saat, her aracın km'si, elektrik/dizel tüketimi ve biriken maliyeti artmalı. ↺ saati 06:00'a sıfırlar. "Aracı takip et" kamerayı iki aracı da görecek şekilde izletir.
5. **3D bina:** Haritayı bir şehir merkezine yakınlaştırın (zoom ≥ 15); binalar yükselti kazanır.
6. **Adres arama (Photon):** Rota kartını genişletip "Adres ara" alanına bir adres yazın, **Ara** veya Enter'a basın. Yazarken istek gitmez. Sonuç seçince durak eklenir.
7. **Durak:** "+ Durak ekle" açıkken haritaya tıklayın veya durak işaretçisini sürükleyin; rota yenilenir.
8. **Tek tema:** Yalnızca koyu tema vardır; işletim sisteminin açık/koyu ayarı görünümü değiştirmez.
9. **İnternet kapalıyken:** Harita "açılamadı" der, hesaplama ve grafikler çalışır.

Sorun görürseniz F12 → Console'daki kırmızı hataların ekran görüntüsünü ve hangi adımda olduğunu iletin. Özellikle şuna bakın: tarayıcı `file://` ile açıldığında OSRM veya Photon "CORS" hatası veriyorsa, sayfayı yerel sunucudan açmayı deneyin (`python3 -m http.server` ile `http://localhost:8000`).

10. **Araç ekleme:** Rakamlarım → "+ Robovan modeli ekle" veya "+ Geleneksel van modeli ekle". Yeni model haritada ayrı renkte ayrı bir araç olarak görünür; yukarıdaki iki seçim kutusuyla istediğiniz iki aracı karşılaştırın (en çok 6 araç).
