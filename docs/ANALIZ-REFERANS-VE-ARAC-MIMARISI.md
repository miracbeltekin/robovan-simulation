# Robovan Maliyet Simülatörü: Referans Analizi ve Araç Mimarisi (Kodlama yok, onay bekliyor)

Etiketler: **[G]** referans sitede gerçekten gördüm/ölçtüm · **[Y]** benim yorumum veya Robovan'a uyarlamam · **[?]** inceleyemedim.

## 0. Nasıl incelendi, neleri göremedim

- **Site:** `heritage-b.club/lab/robotaxi` (haritalı Robotaxi Fleet Console). Playwright ile masaüstü (1440×900) ve iPhone 13 görünümünde, gerçek tarayıcıda açıldı. Zelostech hesaplayıcısı bu raporun konusu değil.
- **Neleri denedim [G]:** ilk kullanım adımları (3), duraklat, ×1/×3/×6, Menü içindeki Rush/Midday/Night, Top view, Whole area, "Show the intro again", Assumptions modalı, Your numbers (masaüstü ve mobil), haftalık çubuklar (tıklama), "Fix: send idle cars" anahtarı, 5 What-if düğmesi ve Custom kaydırıcıları, panel kaydırma, "See all 24 cars" listesi, bir araca tıklayınca açılan araç paneli, haritada yakınlaştırma/döndürme/kaydırma, 4 "i" açıklaması, mobil alt panel ve Your numbers.
- **Yapamadığım / güvenilir olmayanlar [?]:**
  1. **Hareket akıcılığı:** Bu ortamda yazılım çizimle sayfa 1440×900'da yalnız ~3,4 kare/sn, küçük pencerede ~16 kare/sn çalışıyor. Araçların hızlanma, yavaşlama, durma ve dönüş hareketinin akıcılığını **değerlendiremedim**. Yalnız anlık görüntüler ve sayısal ölçümler var.
  2. **Araç 3D modelinin ayrıntısı:** En yakın yakınlaştırmada araç küçük (yaklaşık 20 px) bir beyaz gövde, halka ve far konisi olarak göründü. Model ayrıntısını (kasa, tekerlek, ışıklar) **seçemedim**.
  3. **Dokunmatik hareketler:** Alt panelin tutacağını fareyle sürüklemek hiçbir şeyi değiştirmedi. Gerçek dokunma (swipe, pinch) denenmedi. Alt panelin sürüklenebilir olup olmadığını **bilmiyorum**.
  4. **Sayı geçiş animasyonu:** Midday'e atlayınca 120 ms aralıkla örneklenen sayı hemen yeni değere geçti (ara değer görmedim). Düşük kare hızı nedeniyle "sayaç animasyonu var/yok" diyemem.
  5. Gece ışıklandırmasının ayrıntısı: yalnız ortalama parlaklığı ölçtüm (aşağıda). Kapsamlı görsel efektleri (ışıklar, parlamalar) tek tek ayırt edemedim.
  6. Takvim değişimi (gece yarısı sonrası), "Book a call" ve e-posta formunun gönderimi: incelenmedi, kapsam dışı.

## 1. Referans sitenin ayrıntılı analizi

### 1.1 Genel yapı [G]
- Tek ekranlık uygulama: üstte 60 px çubuk, altında **harita kartı (x=16, y=60, 1014×824, köşe 18 px)** ve **sağ panel `#side` (x=1043, 382 px, köşe 18 px)**. Boşluk 13 px, dış kenar 15–16 px. Sağ panel kendi içinde kaydırılır (içerik yüksekliği 1644 px, görünen 824 px).
- **Harita Three.js ile kendi çizimi** (`canvas#gl`), OpenStreetMap verisi, "© OpenStreetMap contributors" yazısı. Üstünde HTML etiket katmanı (`#labels`) ve vinyet katmanı var.
- **Yazı tipleri ölçüldü:** arayüz "Inter Tight", logo "Cormorant Garamond" (serif). Renkler: sayfa #000, metin #F3F0E8, harita zemini #0A0B0B, sağ panel #0F1012, hız kapsülü #17181B, ana düğme **#F8EAC8** (krem, tam yuvarlak), çipler şeffaf zemin + `rgba(248,234,200,.22–.3)` kenarlık, durum yeşili ve kırmızısı kart içi. Bu sayılar bizim paletimize çok yakın (bizde #08090B, #111317, #F4EBD8).

### 1.2 Üst çubuk [G]
Solda logo + "CONCEPT" etiketi. Ortada "Austin, TX · Thu 22 Oct" gün etiketi, büyük saat (24 px, "08:10"), hız kapsülü: **⏸ / ×1 / ×3 / ×6** (seçili olan krem dolgulu). Sağda "⋯" (Menü) ve "Book a call" düğmesi. Mobilde gün etiketi gizli: logo, saat, ⋯.

### 1.3 Menü (⋯ açılır kutu) [G]
- "Time of day": **Rush / Midday / Night** (segment). Basınca saat anında **08:10 / 12:40 / 22:40**'a atlıyor ve tüm sayılar o saate göre değişiyor.
- Top view, Whole area, Show the intro again, Assumptions and sources.

### 1.3b Zaman ve hız ölçümü [G, düşük kare hızında ölçüldü]
- Saat HH:MM gösteriyor. 16 kare/sn'de ×6 ≈ 6 simüle sn / gerçek sn (20 sn'de 2 dk), ×3 ≈ 3, ×1 ≈ 1. **Yani ×1 gerçek zaman, ×3 ve ×6 onun katları.** Hız yalnız zaman akışını hızlandırıyor.
- Duraklat düğmesi çalışıyor (saat sabit).
- **Gün zamanına göre sayılar [G]:** 08:10 → Fares $1,776 · Costs $1,615 · "$161 today" · "~$3,121 by midnight"; 12:40 → Fares $3,971 · Costs $2,944 · "$1,027 today"; 22:40 → Fares $9,127 · Costs $6,154 · "$2,973 today". Yani **maliyet kümülatif, zamanla sürekli artıyor** (~$12/saat/araç); gelir (fares) tamamlanan yolculuklarla basamak basamak artıyor.
- **Gün zamanı ışığı [G, ölçüldü]:** harita ortalama parlaklığı Rush 20,4 → Midday 14,3 → Night 9,1 (gece belirgin koyulaşıyor).

### 1.4 Harita ve araçlar [G]
- **Varsayılan görünüm:** tek bir araca (RX-04) odaklı yakın kadraj; araç **halka + far konisi + altın renkli izlenen yol** ile gösteriliyor. Yol ağı çok sönük, altın-siyah ton, sis/vinyet.
- Araç etiketi: "RX-04 +$28 today" + durum hapı ("Picking up") + pil göstergesi (%42).
- **Whole area:** tüm şehir, hizmet alanı sınırı (altın dış çizgi), 24 araç, her birinde **küçük yeşil/kırmızı +$/−$ hapı**, altın/yeşil ısı lekeleri (talep bölgeleri), yol etiketleri.
- **Top view:** seçili araca tepeden kamera.
- **Etkileşim:** tekerlekle yakınlaştırma, sol sürükleme = kaydırma, sağ sürükleme = döndürme/eğme çalışıyor (görüntülerle doğrulandı). Araç etiketine tıklayınca araç seçiliyor ve kamera o araca geçiyor.
- **Durum sözlüğü [G]:** Picking up, Riding, Busy, Empty miles, Few empty miles, Steady, Charging, Deliveries, Low battery, Long trips, Remote help. Yolculuk bitince araç üstünde "RIDE COMPLETE" etiketi beliriyor.
- **Masaüstünde** haritada yüzen kontrol düğmesi yok: tüm kontroller üst çubukta ve Menü'de (mobilde hız kapsülü haritanın üstünde yüzer). İlk kullanımda haritada "Tap RX-04 to see what it made today" ipucu hapı var.

### 1.5 Sağ panel (yukarıdan aşağıya) [G]
1. İlk kullanım kartı (Adım 1/3, 2/3, 3/3; İleri/Atla; son adımda Book a call/Done).
2. **Ana kart:** "24 cars made" + büyük yeşil **"$161 today"** + "Fares $1,776 · Costs $1,615" + **"Your numbers"** çipi + sarı rozet "$161" ve "~$3,121 by midnight" + **7 günlük çubuk grafiği** (Fri…Today; sert dolgu = kâr, taralı = maliyet; bugünkü çubuk gün ilerledikçe doluyor) + "SIMULATED · This week $20,251 · +1% vs last week" + ⓘ.
3. **"Which cars made money today":** 1/2/3 altın-gümüş-bronz rozetli ilk üç araç (ad, neden, tutar).
4. **"LOST MONEY TODAY · 4"** kırmızı kartı (en kötü 4 araç + nedeni); gece "NO CAR LOST MONEY YET · EARNED LEAST" olarak değişiyor.
5. **"Fix: send idle cars on deliveries · +$69 today"** anahtarı (CONCEPT etiketi, ⓘ).
6. "Same P&L for your vans and trucks" tanıtım kartı (satış; bizde yok).
7. **"What if"**: Cheaper car ($35k), Fare +20%, 1 operator per 30 cars, Own app, Custom. **Seçimler birikiyor** ve altta "Pays back in 10 months · A $50,000 car" cümlesi her seçimde değişiyor ("was 7.9" gibi eski değer gösteriliyor).
8. "See all 24 cars" → tüm araçların sıralı listesi (Busy/Empty miles… + tutar).
9. E-posta formu (satış; bizde yok).

### 1.6 Araç detay paneli (araç seçilince) [G, bu çok önemli]
Sağ panel **seçili aracın hesabına** dönüşüyor: "← All cars", durum hapı, **"RX-01 · +$8 today"**, **Fares · 5 trips $75 / Costs $67 / Profit $8**, **ACTIONS** ("Give it deliveries +$21 today", "Move to downtown at 17:00"), kendi haftalık çubukları, ardından **"Every cost today"** kalem kalem canlı döküm:
Fares riders paid · Ride-hail app fee (25%) · **Energy, paid miles · 6.9 kWh** · Maintenance and tyres · 27.8 mi · Depreciation, paid miles · $0.150/mi · Empty miles, to pickups and chargers · 5.7 mi · Cleaning per trip → **"Left after trip costs $46"** → Remote help · 28 min · Vehicle cover · Depot and parking · Software and teleops · Loan interest · Cleaning, daily · Depreciation, age.
Yani döküm hem **mesafe/enerji/süre** bazlı kalemleri hem **günlük sabit** kalemleri ayrı gösteriyor ve zamanla artıyor. Aynı aracın ayrıntısı haritadaki seçimle birlikte canlı güncelleniyor.

### 1.7 Haftalık çubuk, ⓘ ve varsayımlar [G]
- Çubuğa tıklama: o günün özeti "Fri 16 Oct · Fares $10,496 · Costs $6,899 · Profit +$3,597" balonu, çubuk seçili görünür.
- 4 ⓘ açıklaması: kâr tanımı ve maliyet kalemleri; sıralama kuralı ("18 made money, 4 lost"); teslimat varsayımı; geri ödeme formülü ("$50,000 ÷ $4,908 a month = 10 months").
- **Assumptions modalı:** "Item / Value now / Based on" tablosu; her varsayımın güncel değeri ve **kaynak bağlantıları** (örn. ücret tablosu, enerji tüketimi, elektrik fiyatı, bakım) var. "What if" ve Custom değerleri tabloda güncelleniyor.

### 1.8 Your numbers (Rakamlarım) [G]
- **Masaüstü:** sağ panelin üstüne binen ~400 px'lik açılır kart: Cars (1–10000), Average fare ($, adım 0,5), Trips per car (/gün), Cost per car ($ + "a day/a mile" seçici), Price per car ($). **Canlı özet kutusu:** "Each car makes $150 a day · Fares $400 − costs $250 = $150 a car a day · Fares = $16 × 25 trips · 30 cars: +$4,500 a day · About 4% of cars likely lose money (1 of 30) · Pays back in 11 months ($50,000 ÷ $4,560 a month)". Düğmeler: **Apply**, **Default values**; altta açıklama ("Nothing is sent anywhere", "Before tax"). Yazarken özet canlı güncelleniyor, **Apply** basınca harita simülasyonu ve ana kart yeni değerlerle çalışıyor.
- **Custom (What-if):** 3 kaydırıcı: Vehicle price ($20.000–200.000), Fleet size (10–50), Fare per mile.
- **Mobil:** ekranın büyük kısmını kaplayan alt sayfa; üstte hız kapsülü ve saat görünür kalıyor.

### 1.9 Mobil [G]
- iPhone 13 (390×664): üst çubuk 52 px; harita üstte **tam genişlik, ~263 px yükseklik**; hız kapsülü haritanın **sol üstünde yüzer**; altta **yuvarlak köşeli alt sayfa** (tutaçlı) yaklaşık 367 px yüksekliğinde, içerik kaydırılır; yatay taşma yok. İlk kullanımda alt sayfa 407 px (kart dahil).
- Araç etiketi mobilde yalnız "+$28" hapı.

## 2. Referans ve mevcut sitemizin özellik karşılaştırması

Durum: **Var** (birebir yakın), **Kısmen**, **Yok**. "Yapılacak": önerim (onayınıza bağlı).

| # | Özellik | Referansta var | Bizde var | Durum | Yapılacak |
|---|---|---|---|---|---|
| 1 | Harita merkezli tek ekran, harita 1014×824 + sağ panel 382 px | Evet | Evet (1015×825 / 382) | Var | Oran korunur; köşe 18 px |
| 2 | Yazı tipi (Inter Tight + serif logo) | Evet | Poppins'e yakın sistem yazı tipi, logo görsel | Kısmen | Inter Tight'ı dosyaya gömmek (onay gerekir) |
| 3 | Koyu palet (#000, #0F1012, krem #F8EAC8) | Evet | Çok yakın (#08090B, #111317, #F4EBD8) | Var | Küçük renk ayarı |
| 4 | Üst çubuk: saat + ⏸/×1/×3/×6 | Evet | Evet | Var | Saat gösterimi canlı maliyetle bağlanır |
| 5 | Hızın yalnız zaman akışını değiştirmesi | Evet | Evet (animasyonda) | Var | Canlı maliyette de doğrulanacak |
| 6 | Menü ⋯ (zaman, görünüm, intro, varsayımlar) | Evet | Yok (düğmeler harita üstünde) | Yok | Menü + gün zamanı + varsayımlar modalı |
| 7 | Gün zamanı (Rush/Midday/Night) ve ışık değişimi | Evet | Yok | Yok | Sabah/Öğle/Akşam kısayolu, saat atlaması, harita ışığı |
| 8 | Whole area / Top view | Evet | "Tüm rota", "Üstten" | Kısmen | Aynı davranış, iki araç etiketiyle |
| 9 | Araç + halka + far konisi + altın yol izi | Evet | 3D kutu araç + halka; iz yok | Kısmen | Parlak iz, far konisi, yol stili sadeleştirme |
| 10 | Araç etiketi: ad, +$ canlı, durum, pil | Evet | "Robovan · 40 km/sa" | Kısmen | Canlı maliyet ve durum etiketi |
| 11 | Durumlar (Picking up, Charging, Remote help…) | Evet | Yok | Yok | Robovan: Yolda, Yükleme, Şarj, Uzaktan operatör |
| 12 | Araç seçince araç paneli (canlı döküm) | Evet | Yok | **Yok (en büyük eksik)** | Her araç için canlı maliyet dökümü |
| 13 | Canlı sayaç (kümülatif maliyet zamanla artar) | Evet | Yok (yalnız yıllık sonuç) | **Yok** | Bölüm 6 |
| 14 | Ana kart: büyük tutar + Fares/Costs + sarı rozet + tahmin | Evet | Yıllık tasarruf kartı | Kısmen | Canlı "bugün" ve yıllık ayrı gösterilir |
| 15 | Haftalık çubuklar | Evet (simüle geçmiş) | Yok | Yok (uyarlanamaz) | Yerine "Bugün / Hafta / Yıl" ya da araç başına çubuk (öneri) |
| 16 | Sıralama kartı (1/2/3 madalya) | Evet | "Hangi araç daha ucuz?" | Var | Canlı maliyetle bağlanır |
| 17 | "Kaybeden" kırmızı kart | Evet | Yok | Yok | Robovan'da "daha pahalı kalem" kartı (yorum) |
| 18 | What-if çipleri (birikir, "was 7.9") | Evet | Yok | Yok | "Ya şöyle olsa": ucuz robovan, operatör oranı, yakıt +%20 |
| 19 | Custom kaydırıcılar | Evet | Parametre kaydırıcıları | Kısmen | Aynı kartta |
| 20 | Rakamlarım (alanlar, canlı özet, Apply/Default) | Evet | Çekmece, canlı özet yok | Kısmen | Canlı özet + Uygula/Varsayılan |
| 21 | Assumptions modalı + kaynak bağlantıları | Evet | "Nasıl hesaplanıyor" | Kısmen | Değer ve kaynak tablosu |
| 22 | ⓘ açıklamaları | Evet | Yok | Yok | 4 ⓘ |
| 23 | İlk kullanım 3 adım + haritada ipucu hapı | Evet | 3 adım kartı | Kısmen | Haritada ipucu, "Intro'yu tekrar göster" |
| 24 | "See all cars" listesi | Evet | Yok | Yok | "Tüm araçlar" tablosu |
| 25 | Mobil: harita üstte, hız kapsülü haritada, alt sayfa | Evet | Evet | Var | Alt sayfa yüksekliği ve tutaç ayarı |
| 26 | Mobil alt sayfa sürükleme | **[?]** | Yok | [?] | Önce gerçek dokunma testi |
| 27 | Rota seçimi, adres arama, durak ekleme | Hayır | Evet | Bizde fazla | Korunur |
| 28 | 3D bina | Hayır (yok) | Evet | Bizde fazla | Korunur |
| 29 | Dinamik araç ekleme/çoklu karşılaştırma | Hayır | Yok | Yok | Bölüm 4–5 |
| 30 | Tek koyu tema | Evet | Evet | Var | Korunur |
| 31 | "Book a call", e-posta formu, tanıtım kartı | Evet | Yok | Satış öğesi | **Yapılmayacak** |

## 3. Görsel ve etkileşim eksikleri (öncelik sırasıyla)

1. **Canlı maliyet simülasyonu ve araç dökümü** (satır 12–13): referansın çekirdeği.
2. **Gün zamanı**, saat atlaması ve haritada ışık değişimi (7).
3. **Menü**, Assumptions modalı, ⓘ açıklamaları, haritada ipucu (6, 21–23).
4. **Harita stili:** referansın sönük altın-siyah yol ağı, vinyet, altın iz, far konisi. Bizdeki yollar daha parlak mavi-gri.
5. **Ana kartın dili:** "bugün" canlı tutar + sarı rozet + tahmin ("gün sonu") + sıralama + "daha pahalı kalem" kartı.
6. **Whole area** görünümünde araç başına +$/−$ hapı.
7. Rakamlarım: canlı özet ve Uygula/Varsayılan.
8. Mobil ince ayar: harita yüksekliği, alt sayfa köşesi ve tutacı.

## 4. İki araçlı başlangıç yapısı

**Varsayılan iki araç (örnek değerler, gerçek teklif değil):**

| | Robovan | Dizel Van |
|---|---|---|
| Enerji | Elektrik (kWh/100 km, elektrik fiyatı, şarj verimi/gücü, menzil) | Dizel (L/100 km, yakıt fiyatı) |
| Kullanım | L4 otonom, sürücüsüz | Sürücülü |
| Personel | Uzaktan operatör (maaş, operatör başına araç) | Sürücü maaşı |
| Yatırım | Alış, altyapı/şarj, tek seferlik mühendislik, kalıntı değer, ömür | Alış, kalıntı değer, ömür |
| Diğer | Yazılım/bağlantı lisansı, bakım+lastik, sigorta, vergi | Bakım+lastik, sigorta, vergi |

- **"Elektrikli Van" varsayılan araç olmaz.** Robovan zaten elektrikli.
- **Veri geçişi (yerel kayıt v2 → v3):** Eski kayıttaki `vehicles.robo` → "Robovan", `vehicles.ice` → "Dizel Van". Eski `vehicles.ev` kullanıcı tarafından **değiştirilmişse** "Elektrikli Van (eski kayıt)" adıyla üçüncü bir kullanıcı aracı olarak korunur, **değiştirilmemişse** (varsayılan değerlerle aynıysa) listeye eklenmez. Eski `base` ("ice"/"ev") → karşılaştırma çifti. Geçişten önce eski kayıt `robovan-sim-ui-v2.bak` anahtarına kopyalanır (geri dönüş). Sürüm numarası kayda yazılır.
- Test güvencesi: mevcut "robo/ice/ev" regresyon sayıları (2/4/8 araç, 0,34/0,62/0,97 $/km, 90.437/167.923/260.954 $) aynı değerlerle **üç aracı da içeren sabit test senaryosunda** korunur; böylece formül değişmediği kanıtlanır.

## 5. Dinamik araç ekleme ve çoklu karşılaştırma mimarisi

**Veri modeli** (örnek):
`fleet: [ { id, name, model, energy: 'electric' | 'diesel' | 'petrol' | 'hybrid-yok(ilk sürümde yok)', mode: 'autonomous' | 'driver', color, params: { price, infra, residual, life, payload, speed, hours, maint, tire, ins, tax, [kwh100, elec, eff, chargeKw, range] | [l100, fuel], [driver] | [operator, ratio, lic, eng], shiftH } } ]`
`compare: { a: id, b: id, selected: [id,…] }`.
Enerji türü hangi alanların görüneceğini, kullanım türü personel alanlarını belirler (elektrik → kWh alanları, dizel/benzin → yakıt alanları; otonom → operatör/lisans/mühendislik, sürücülü → sürücü).

**Motor (formüller değişmez):** `calcVehicle` şu anda araç türünü ad ile ("robo", "ice", "ev") ayırıyor. Bunu **özelliğe göre** ayıracak şekilde genelleştiririm (`isElectric`, `isAutonomous`). Aynı formüller, aynı sonuçlar. `analyze` bir araç listesi alır, **her araç için ayrı hesap** yapar. Karşılaştırma (tasarruf, başa baş, 5 yıllık fark) **seçili iki araç (A ve B)** arasında hesaplanır; "başa baş sürücü maliyeti" yalnız taban araç sürücülüyse anlamlıdır (aksi halde gösterilmez).

**Arayüz:**
- Rakamlarım çekmecesinde **"Araçlar"** listesi: kart başına Ekle, **Çoğalt**, Yeniden adlandır, Sil (en az iki araç kalır), Karşılaştırmaya al onay kutusu. Yeni araç formu: ad, model, enerji türü, kullanım türü, alış bedeli, tüketim, personel/operatör, bakım/sigorta/diğer, yük, hız, çalışma süresi. Form alanları şemadan üretilir.
- **Ana görünüm iki araçla sade:** A ve B seçicisi (varsayılan Robovan ve Dizel Van), referanstaki gibi büyük tutar + sıralama.
- **3 ve daha fazla araç seçilince:** karşılaştırma tablosu ve grafikler N araç gösterir (yeni sütun/çizgi/çubuk). Renkler: Robovan turkuaz, Dizel kahverengi-turuncu sabit; yeni araçlara paletten renk atanır.
- Araç verileri yerel kayıtta saklanır (`fleet` dizisi); silinen araç geri alma için 1 oturum süresi tutulabilir (öneri).
- Üst sınır: 6 araç (öneri; grafik okunabilirliği).

## 6. Haritada canlı maliyet simülasyonunun teknik kurgusu

**İlke:** Canlı göstergeler **motorun mevcut yıllık bileşenlerinden** türetilir; yeni formül yok, rastgele sayı yok.

**Bir simülasyon günü:** Her araç, motorun hesapladığı sefer sayısını (araç başına sefer/gün) ve sefer süresini (yol + durak yükleme + şarj) art arda yapar. Zaman çizelgesi zaten var (hız parametresi, durak bekleme, gidiş-dönüş). Gün, çalışma süresi parametresine ve bir başlangıç saatine (öneri 06:00) bağlıdır.

**Canlı kalemler (araç başına, simüle zaman t anında):**
- **Mesafe tabanlı:** `km(t)` = animasyondaki kat edilen mesafe. Enerji/yakıt = `km(t) × (yıllık enerji ÷ yıllık km)`; bakım + lastik = `km(t) × (bakım+lastik)`. Miktar da gösterilir (kWh veya L).
- **Süre tabanlı:** personel/operatör, sigorta+vergi+lisans, amortisman, finansman: **hizmette geçen saat** başına `yıllık bileşen ÷ (çalışma günü × aracın kullandığı saat)`. Böylece bir tam günün toplamı = motorun yıllık bileşeni ÷ çalışma günü.
- **Gün toplamı doğrulaması (test):** `canlı toplam(gün sonu) × çalışma günü = motorun araç başına yıllık toplamı` (her araç, ≤1e-9).

**Gösterge ayrımı (kullanıcıya karışmaması için):**
1. **Canlı (bugün, simüle):** geçen süre, kat edilen km, enerji/yakıt miktarı ve tutarı, biriken işletme maliyeti, araçlar arası fark. Etiket "Simüle gün".
2. **Yıllık / amortisman / TCO:** ayrı kartta, canlı sayaçtan bağımsız ve etiketli ("Yıllık", "5 yıllık toplam sahip olma maliyeti"). Amortisman canlı dökümde süre tabanlı kalem olarak görünür; TCO ve geri ödeme yalnız statik kartlarda.

**Hız kuralı:** ×1/×3/×6 yalnızca **simüle zamanın gerçek zamana oranını** değiştirir. Maliyet `km` ve `saat` fonksiyonudur, gerçek saniyeye bağlı değildir; aynı mesafe için hangi hızda olursa olsun aynı maliyet çıkar (test: ×1, ×3, ×6 ile aynı konuma kadar ilerletip değerleri karşılaştırmak). Önerim: ×1 = 1 simüle dakika / gerçek saniye (referansta ×1 gerçek zamandır, ama bizim seferlerimiz saatler sürdüğü için bu uyarlama gerekir [Y]).

**Saat atlaması (gün zamanı):** Hesap zamanın deterministik fonksiyonu olduğundan "Sabah/Öğle/Akşam" düğmesi animasyonu oynatmadan o saatin değerlerini hesaplar ve haritada araçları o konuma koyar.

**İki aracın yarışı [Y]:** Robovan ve Dizel Van aynı rotada, kendi hızlarıyla aynı anda hareket eder (renkli iz). Harita etiketleri araç adı, "+/− fark" ve durum içerir. Fark iki biçimde gösterilir: **aynı zamanda** ve **aynı mesafede** (daha adil olan; km maliyeti).

**Araç paneli (seçince):** referanstaki gibi "← Tüm araçlar", durum hapı, kalem kalem canlı döküm (enerji kWh/L, bakım, operatör/sürücü saati, amortisman, finansman, sigorta/vergi/lisans) ve "Yol başına / km başına" özet.

**Durumlar [Y]:** Yolda, Yükleme, Şarj (elektrikli), Uzaktan operatör (robovan), Beklemede. Hepsi sefer zaman çizelgesinden türer.

**Doğrulama testleri (yeni):** gün toplamı = yıllık/gün; hız bağımsızlığı; mesafe 0'da canlı maliyet yalnız süre tabanlı kalemler; iki araç farkı = canlı toplamların farkı; saat atlaması = animasyonla aynı değer.

## 7. Değişmesi gereken dosyalar ve modüller

| Dosya | Değişiklik |
|---|---|
| `src/defaults.js` | Üç sabit araç yerine `fleet` şeması ve iki varsayılan araç; araç şablonları (elektrikli/dizel × otonom/sürücülü) |
| `src/validate.js` | Alan kuralları özelliğe göre (enerji türü, kullanım türü); araç sayısı, benzersiz ad |
| `src/engine.js` | `calcVehicle` özellik tabanlı; `analyze` araç listesi + A/B; `breakEven`, `compare` N araç; **yeni** `liveCost` (zaman çizelgesi, kalem oranları) |
| `src/live.js` (yeni) | Canlı maliyet saf fonksiyonları; test edilebilir |
| `ui/data.js` | Şema alanları araç özelliklerine göre; durum ve açıklama metinleri; varsayımlar tablosu |
| `ui/app.js` | `fleet` durumu, A/B seçimi, araç yönetimi, v2→v3 göç, canlı maliyet bağlantısı, menü, modal |
| `ui/map.js` | Çoklu araç (iki renkli iz), canlı etiket, araç seçimi, kamera (Whole area/Top view), gün ışığı |
| `ui/van3d.js` | İkinci araç modeli (dizel van), renk ve sade/tam model |
| `ui/charts.js` | N seri; canlı çizgi (km'ye göre birikimli maliyet) |
| `ui/index.template.html`, `ui/styles.css` | Menü, araç paneli, ana kartın yeni dili, referans oranları (köşe 18 px), mobil alt sayfa |
| `tests/*` | Aşağıda |

**Mevcut 105 motor testi:** Şartname bölüm 9 (sayısal değerler), geometri, doğrulama, hesap kimlikleri, operasyon göstergeleri ve rastgele test **hâlâ geçerli**, ancak araç anahtarları `robo/ice/ev` yerine araç kimlikleri ile çağrılacak şekilde güncellenecek. **Değişecek:** `defaultConfig` ve `analyze` sözleşmesi (iki araç), taban/KPI testleri (A/B). **Yeni:** araç ekleme/çoğaltma/silme, çoklu araç karşılaştırma, göç, canlı maliyet. Bağımsız Python doğrulaması genelleştirilir ve N araçlı rastgele senaryolara genişletilir.

## 8. Aşamalı geliştirme planı (her aşama sonunda onay)

| Aşama | İçerik | Çıktı |
|---|---|---|
| **A. Araç modeli** | `fleet` veri modeli, iki varsayılan araç, motor genelleştirme, v2→v3 göç, testler | Eski sonuçlar birebir korunur; Elektrikli Van varsayılan olmaktan çıkar |
| **B. Araç yönetimi ve çoklu karşılaştırma** | Ekle/çoğalt/ad/sil, form şeması, A/B seçimi, tablo ve grafiklerde N araç | Ana ekran iki araç, ek araçlar tablo/grafikte |
| **C. Canlı maliyet çekirdeği** | `live.js`, zaman çizelgesi, gün toplamı testi, hız bağımsızlığı testi, gün zamanı atlaması | Saf, testli canlı maliyet |
| **D. Harita–canlı maliyet entegrasyonu** | İki araç yarışı, canlı etiket, araç paneli, ana kart "bugün" + yıllık ayrımı, sıralama canlı | Referanstaki canlı deneyimin Robovan uyarlaması |
| **E. Referans cilası** | Menü, gün zamanı ışığı, Assumptions modalı, ⓘ, ipucu hapı, Whole area etiketleri, harita yol/iz/far stili, Rakamlarım canlı özet, mobil alt sayfa, Inter Tight (onayla) | Görsel/işlevsel yakınlık |

Önerdiğim sıra gerekçesi: önceliğiniz referansa yakınlık, ancak canlı maliyet ve araç paneli doğru araç modeline dayandığı için önce A–B, sonra C–D, en sonda E. İsterseniz E'nin görsel parçalarını (renk, köşe, harita stili) A–B ile paralel yaparım.

## 9. Onayınızı beklediğim kararlar

1. Eski "Elektrikli Van" kaydı: değiştirilmişse korunsun, değiştirilmemişse silinsin mi? (öneri evet)
2. Simüle gün başlangıcı 06:00 ve ×1 = 1 simüle dakika/gerçek saniye uygun mu?
3. Araç sınırı 6 uygun mu?
4. Haftalık çubuklar referansta var ama bizde karşılığı yok. Yerine "Bugün / Hafta / Yıl" mı, araç başına maliyet çubukları mı?
5. Inter Tight yazı tipini dosyaya gömmek (≈ +200–300 KB) onaylanıyor mu, yoksa mevcut yazı tipi mi kalsın?
6. İki aracın aynı anda harita yarışı: iki araç aynı rotada mı (öneri), yoksa seçilen tek araç mı canlı hareket etsin?

---
## Uygulama durumu (v0.6.0)
Bu belgedeki mimari, nihai kararlara göre uygulandı: iki başlangıç aracı, aynı kategoride en çok 6 araç, 06:00 saatli canlı simülasyon (`src/live.js`), araç başına maliyet çubukları, Inter Tight (gömülü), yalnız koyu tema, eski kayıtların güvenle taşınması (`src/migrate.js`). Referansta bulunmayan hiçbir özellik "var" diye sunulmaz; referansın görsel/etkileşim dili (harita merkezli yerleşim, sağda canlı ekonomik panel, saat ve hız denetimleri, mobilde harita + alt panel) uyarlandı, marka/logo/varlıklar kopyalanmadı.
