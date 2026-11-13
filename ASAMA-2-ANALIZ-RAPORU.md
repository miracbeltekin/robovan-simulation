# Aşama 2 — Referans Site Analizi ve Arayüz Tasarımı Önerisi

Durum: **Analiz tamamlandı, kodlama yapılmadı. Onay bekleniyor.**

## 0. Ne inceledim, neye erişemedim

| Kaynak | Erişim | Nasıl incelendi |
|---|---|---|
| Zelostech Z5 sayfası (`zelostech.ai/products/z5.html`) | **Evet, gerçek tarayıcıda açıldı** | Masaüstü (1440 px) ve iPhone 13 görünümünde ekran görüntüsü; DOM, hesaplanmış stiller, kaydırıcı sınırları; bölgeyi, elektrik fiyatını ve sürücü maliyetini değiştirip sonuçların nasıl değiştiğini ölçtüm. Kullanıcının gönderdiği ekran görüntüsü de kullanıldı. |
| Referansın hesap formülü | **Kısmen** | Sayfanın JavaScript kaynağını okumadım. Formülü, girdileri değiştirip çıktıları ölçerek **dışarıdan çıkardım** (bölüm 1.4). Sonuçlar ölçülmüş verilere dayanır ama varsayımdır. |
| `Robovan-Maliyet-Simulatoru.html` | **Evet, dosya bende** | Bu dosyayı ben yazdım; içeriğini ve daha önce aldığım ekran görüntüsünü biliyorum. Bağımsız bir dış inceleme değil. |
| Referanstaki harita / rota deneyimi | **Yok** | Referansta harita, rota veya mesafe girişi bulunmuyor (bölüm 1.7). |

İncelemediğim şeyler: Z10, Z20 ve diğer modellere geçince sayıların değişip değişmediği; Avrupa, Kuzey Amerika ve Okyanusya'daki tüm ülke listeleri (yalnız Asya'da Singapur, Japonya, Güney Kore, Hong Kong görüldü); kaydırıcıların klavye erişilebilirliği; animasyon ayrıntıları (yalnız CSS geçiş süreleri okundu).

---

## 1. Referans sitedeki önemli özellikler

### 1.1 Sayfa düzeni ve kullanıcı akışı
Sayfa uzun, tek sütunlu bir ürün sayfası. Her bölüm ekran yüksekliğinde (`min-h-screen`):
1. Sabit üst menü (Products, Applications, Experience Center, News, About Us, Get in touch).
2. Hero ve **teknik özet şeridi**: 230 km menzil · 1800 kg yük · 6,2 m³ hacim · 40,8 kWh batarya.
3. **"Optimize Your Logistics Costs" hesaplayıcısı** (referansımız).
4. Marka bölümü ("Shaping the Future of Autonomous Logistics"), altbilgi, çerez bildirimi.

Hesaplayıcıdaki akış: bölge seç → ülke otomatik gelir → araç modelini seç → iki kaydırıcıyı oynat → sonuçlar anında değişir → "Book a Demo". Kullanıcı hiçbir şey yazmadan, yalnızca varsayılanlarla anlamlı bir sonuç görür.

### 1.2 Masaüstü yerleşimi
- **Sol sütun (~325 px), kontroller:** "Select Region" (2×2 düğme grubu: Asia / Europe / North America / Oceania), ülke açılır listesi, "Vehicle Model" iki açılır liste (seri, model), "Daily Cost" küçük açıklama, "Operating Costs" altında iki kaydırıcı, koyu lacivert "Book a Demo" düğmesi.
- **Sağ sütun, sonuçlar:** üstte üç gösterge (ilk ikisi soluk gri, **yalnız sonuncusu siyah ve kalın**), ince ayırıcı çizgi, ortada araç görseli + **büyük yüzde** ("70% Cost Reduction") + aşağı inen turkuaz ok grafiği (süs, veri değil), altta "Estimated Savings Per RoboVan" başlığıyla iki yatay **gradyanlı çubuk** (Z5: turkuaz, Conventional Van: gri) ve sağında tutarları, en altta silik uyarı notu.

### 1.3 Mobil yerleşim
Sıra tersine döner: **önce sonuç kartı**, sonra kontroller.
- Gri yuvarlak köşeli sonuç kartı; ortasında bilet gibi **kesikli ayırıcı ve yan çentikler**. Üstte araç + yüzde, altında üç satır "etiket ... değer", sonra iki çubuk.
- Bölge ve ülke **tek açılır listede birleşir** ("Asia / Singapore"), seri ve model de ("Z Series / Z5").
- Kaydırıcılar tam genişlikte, düğme tam genişlikte. Yatay kaydırma yok (ölçüldü).

### 1.4 Girişler, aralıklar ve hesap davranışı (ölçüldü)
| Giriş | Aralık / seçenekler | Not |
|---|---|---|
| Bölge | Asya, Avrupa, Kuzey Amerika, Okyanusya | Bölge değişince ülke, para birimi ve **iki kaydırıcının varsayılanı** değişiyor |
| Ülke | Asya'da Singapur, Japonya, Güney Kore, Hong Kong; varsayılanlar: Almanya, ABD, Avustralya | |
| Araç modeli | Seri: "Z Series". Model: Z5, Z5 Cold-Chain, Z5 Multi-Locker, Z10, Z10 Cold-Chain, Z20 | Modelin sayıları değiştirip değiştirmediğini test etmedim |
| Elektrik fiyatı | 0,01–1,5 /kWh, adım 0,01 | Yazı ile giriş yok |
| Sürücü aylık maliyeti | 25–80.000, adım 100 | Doğrusal ölçek: tipik değerlerde (3.000–5.000) tutamaç en solda, hassas ayar zor. Ekranda gösterilen tutar (4.269) kaydırıcı konumundan (4.225) farklı |

Çıkarılan formüller (tüm bölgelerde ölçümlerle tutarlı):
- Z5 yıllık maliyet = **günlük maliyet × 360**. Avrupa'da günlük maliyet ≈ 50 sabit + yaklaşık 12,75 kWh × elektrik fiyatı.
- Geleneksel van yıllık maliyet = **sürücü aylık × 12 + bölgeye özgü sabit** (Almanya 9.204, ABD ≈ 12.828, Singapur 19.884, Avustralya ≈ 12.852).
- Yıllık tasarruf = geleneksel − Z5. Mevsimlik = yıllık / 4. "Her 4 saatte" = yıllık / 360 / 3 (varsayılan 12 saatlik gün).
- Maliyet düşüşü % = tasarruf / geleneksel van.

Davranışlar:
- Her değişiklik **anında** yansıyor (yükleme göstergesi yok).
- Elektrik fiyatı sonucu çok az etkiliyor (0,01 → 1,5 €/kWh: yıllık Z5 maliyeti 18.000 → 24.840 €). Asıl etken sürücü maliyeti.
- Sonuç **negatif olabiliyor** ve bozuk biçimde gösteriliyor: "€-8", "-93%". Aşırı sürücü maliyetinde (80.000) %98 çıkıyor, sınırlama yok.
- Para birimi sembolü bölgeye göre (€, $, A$, S$); binlik ayırıcı tarayıcı diline göre.

### 1.5 Görsel dil
- **Yazı tipi:** Poppins. Başlık 48–60 px, ana sayı 30 px (kalın), büyük yüzde 60 px, etiket 14 px orta kalınlık, soluk gri.
- **Renk:** beyaz zemin, siyah metin, gri ikincil metin, **lacivert düğme `#222943`** (köşe 4 px, beyaz yazı), turkuaz gradyan çubuk ve ok. Gölge ve kenarlık çok az.
- **Boşluk:** bol; bölümler arası geniş, kartsız (masaüstünde sonuçlar kartsız, mobilde gri kart).
- **Etkileşim:** renk/arka plan geçişleri 0,15 sn, diğer geçişler 0,5 sn yumuşak eğri. Seçili bölge düğmesi beyaz zeminli, koyu çerçeveli; seçilmeyenler açık gri dolgulu.
- Alt kısımda çerez bildirimi ekranı kaplıyor (yalnız referansın kendi yasal ihtiyacı).

### 1.6 Güçlü ve zayıf yanlar
**Güçlü:** ilk bakışta tek büyük sonuç; yalnızca iki kaydırıcıyla "oyun gibi" keşif; varsayılanlarla dolu ve anlamlı ilk ekran; mobilde sonuç önce; sade tipografi ve görsel hiyerarşi (soluk → vurgulu gösterge sırası).
**Zayıf:** formül ve varsayımlar hiç açıklanmıyor; "Conventional Van" tanımsız; yatırım bedeli, amortisman, finansman, bakım görünmüyor; kaydırıcı hassasiyeti düşük ve yazarak giriş yok; negatif sonuç biçimi bozuk; tek karşılaştırma; rota, mesafe, talep yok.

### 1.7 Harita, rota ve mesafe
**Referansta yok.** Hesap tamamen "günlük maliyet × 360" mantığında, mesafe veya rota girişi bulunmuyor. Bu bölüm tamamen bizim şartnamemizden gelecek.

---

## 2. Referanstan birebir benzer deneyimle uygulanacaklar

1. Kontroller solda, sonuçlar sağda (masaüstü); sonuç önce, kontroller sonra (telefon).
2. Üst gösterge satırı: ilk ikisi soluk, **sonuncu siyah ve kalın** (hiyerarşi).
3. **Büyük yüzde** ("% maliyet düşüşü") + aşağı ok grafiği. Görsel Tripy'ye özgü yeni SVG olacak, referanstaki araç görseli veya ok kullanılmayacak.
4. İki-üç **yatay gradyan çubuk** ile yıllık maliyet karşılaştırması.
5. Seçili/seçilmemiş düğme grubu görünümü (2×2 segment) ve açılır liste biçimi.
6. Mobilde bilet çentikli gri sonuç kartı, birleşik açılır listeler, tam genişlik düğme.
7. Silik uyarı notu ("yalnızca örnek, garanti değildir").
8. Teknik özet şeridi (menzil, yük, hacim, batarya). Bizde rakamlar robovan kartındaki girdilerden canlı gelir.
9. Poppins tipografi, beyaz ağırlıklı sade yüzey, 0,15 sn / 0,5 sn geçişler.
10. İlk açılışta varsayılanlarla dolu, anlamlı sonuç.

## 3. Geliştirilerek uygulanacaklar

| Referans | Bizde |
|---|---|
| 2 kaydırıcı | Her kaydırıcı **yazarak da girilebilen** kutuyla çift. Sürücü maliyeti için **logaritmik** ölçek. Kaydırıcı ve rakam her zaman aynı değeri gösterir. |
| Bölge 2×2 düğme | **Karşılaştırma tabanı** (Dizel van / Elektrikli van) segmenti aynı görünümde. |
| "Conventional Van" belirsiz | Açıkça adlandırılmış iki taban araç, tüm parametreleri düzenlenebilir ("Gelişmiş varsayımlar" açılır bölümü). |
| Tek yüzde | Seçili tabana göre yüzde; üç araçlı çubuklar. |
| "Her 4 saatte" gösterge | **Sefer başına** tasarruf (bizim motor sefer bazlı). Gün uzunluğu varsayımı yerine gerçek sefer süresi. |
| Mevsimlik (yıllık/4) | Korunur ("3 aylık"), hesap yıllık/4. |
| Süs ok grafiği | Aynı görsel dil, ama **gerçek veriyle**: maliyet kalemleri (enerji, personel, sermaye…) çubuğu. |
| Negatif sonuç bozuk | "−%93" ve "−12 $" doğru biçimde, **kırmızı "robovan aleyhine"** etiketi. Aşırı değerlerde uyarı. |
| Tek sabit formül | Formül **açıklanır**: "Nasıl hesaplanıyor" bölümü, her gösterge için ipucu. |
| Düğme "Book a Demo" | Rezervasyon yok. Yerine **"Özeti kopyala"** ve **"Varsayılanlara dön"** (satış kanalı yok, bağımsız araç). |
| Yalnız elektrik + sürücü | Elektrik fiyatı, sürücü maliyeti, yakıt fiyatı ve **operatör maliyeti** ana (görünür) kaydırıcılar; kalan tüm parametreler gelişmiş bölümde. |

## 4. Referansta olmayan, şartnamemizde istenenler

- Üç araç türü: Robovan, dizel van, elektrikli van.
- **Rota ve harita:** durak ekleme (şehir listesi, adres arama, haritaya tıklama), karayolu mesafesi (Mapbox), kuş uçuşu × yol katsayısı, elle mesafe.
- Günlük toplam sefer, durak sayısı, yükleme süresi, yük doluluğu → **gereken araç sayısı** (her aracın çalışma saatine göre).
- Yıllık filo maliyeti, **TCO** (kalıntı değer düşülmüş), **geri ödeme (başa baş)**, **başa baş sürücü maliyeti**.
- km, sefer ve ton-km başına maliyet; ilk yatırım farkı.
- Grafikler: kalem kalem km maliyeti, birikimli maliyet (başa baş işaretli), **talebe duyarlılık**.
- Ayrıntılı karşılaştırma tablosu, uyarılar (mesai aşımı, menzil, kapasite).
- localStorage kaydı, açık/koyu tema, para birimi etiketi, Türkçe doğrulama mesajları.
- Şartname kapsam notu: robovan yalnız trafiğe kapalı, kontrollü alanda çalışır.

## 5. Önerilen sayfa yerleşimi ve kullanıcı akışı

**Masaüstü (yukarıdan aşağıya):**
1. **Başlık şeridi:** "Robovan Maliyet Simülatörü", tek cümle açıklama, "Örnek varsayımlar" notu, tema/para birimi seçici.
2. **Teknik özet şeridi:** menzil · yük · hacim · batarya (robovan girdilerinden canlı).
3. **Ana hesaplayıcı (referansın düzeni):**
   - *Sol sütun:* Karşılaştırma tabanı (2 düğme) → **Rota özeti** (ör. "Gebze → İzmit, 56 km, gidiş-dönüş", "Rotayı düzenle") → Günlük sefer → **Operasyon maliyetleri** (elektrik fiyatı, yakıt fiyatı, sürücü maliyeti, operatör maliyeti; kaydırıcı + yazı kutusu) → "Gelişmiş varsayımlar" (açılır: üç araç kartı) → "Özeti kopyala", "Varsayılanlara dön".
   - *Sağ sütun:* üç gösterge (sefer başına · 3 aylık · **yıllık tasarruf**, sonuncu vurgulu) → büyük **% maliyet düşüşü** + Tripy'ye özgü grafik → **3 gradyan çubuk** (robovan, dizel, elektrikli yıllık maliyet) → uyarılar → ikinci satırda: gereken araç sayısı, geri ödeme, başa baş sürücü maliyeti.
4. **Rota ve harita bölümü** (Aşama 4): harita, durak listesi, adres arama.
5. **Grafikler** (Aşama 3): kalem kalem km maliyeti, birikimli maliyet, talebe duyarlılık.
6. **Ayrıntılı tablo** ve **Nasıl hesaplanıyor**.

**Telefon:** sonuç kartı en üstte (bilet çentikli), altında birleşik açılır listeler ("Taban: Dizel van", "Rota: Gebze → İzmit"), kaydırıcılar, gelişmiş varsayımlar (kapalı açılır), tam genişlik düğmeler, sonra grafikler ve tablo (yatay kaydırmalı).

**Akış:** açılışta tam dolu sonuç → kullanıcı iki üç kaydırıcıyı oynar → rotayı değiştirir → gelişmiş varsayımları açar → grafiklere ve tabloya iner → özeti kopyalar.

**Kimlik:** Tripy'ye özgü; beyaz zemin, koyu charcoal birincil düğme, robovan için turkuaz seri rengi, dizel için turuncu-kahve, elektrikli için mavi; küçük turuncu vurgu. Poppins. Logo, araç görseli ve ok grafiği referanstan kopyalanmaz.

**Aşama 2 teslimi (onaydan sonra):** yalnız arayüz iskeleti (bölüm 5'teki 1–3 ve 6) hesap motoruna bağlı, grafiksiz ve harita yok; grafikler Aşama 3, harita Aşama 4.

---

## 6. Sorular (onay için)

### Aşama 1'den kalan sorular
1. **Şartname düzeltmesi:** km maliyeti testindeki "±%1" ifadesi tutmuyor (gerçek 0,3359, %1,2 sapma). Şartnameyi "2 hanede 0,34" olarak ve rota mesafesini "≈56 km" olarak düzeltmeyi öneriyorum. **Uygun mu?**
2. **Sürücü maliyeti:** şu an 12 ay sabit, çalışma günü yalnız km'yi etkiliyor. **12 ay mı kalsın, yoksa çalışma gününe göre mi ölçeklensin?** (Öneri: 12 ay kalsın; maaş işveren maliyeti olarak yıl boyu ödenir, referansın da yaptığı budur.)
3. **Aşama sırası** (2 arayüz iskeleti, 3 grafikler, 4 Mapbox + tek dosya, 5 cilalama) **uygun mu?**

### Aşama 2 için yeni sorular
4. **Bölge/ülke ön ayarı** (referansta var): elektrik, yakıt ve sürücü maliyetini ülkeye göre dolduran bir seçici ekleyelim mi? Doğrulanmış veri gerekir; önerim yalnız **Türkiye** ön ayarını örnek değerlerle (kullanıcı düzenler) başlatmak. Şartnamede yok, onaysız eklemem.
5. **Sürücü maliyeti kaydırıcısı:** referansın doğrusal ölçeği yerine **logaritmik ölçek + yazı kutusu** kullanalım mı? (Öneri: evet.)
6. **"Book a Demo" yerine** "Özeti kopyala" yeterli mi, yoksa ek bir düğme (ör. senaryoyu bağlantı olarak paylaş) ister misiniz?
7. **Başlık dili:** arayüz tamamen Türkçe olacak ("Maliyetinizi Optimize Edin" tarzı başlık yerine "Robovan Maliyet Simülatörü"). Uygun mu?
8. **Yazı tipi:** referans Poppins kullanıyor. Aynı yazı tipini (açık lisanslı Google Fonts) kullanalım mı, yoksa farklı bir yazı tipi mi tercih edersiniz? (Öneri: Poppins, "yakından takip et" talimatınız gereği.)

**Onay gelmeden kodlamaya geçmiyorum.**
