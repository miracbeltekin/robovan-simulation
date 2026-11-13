/* Arayüz verisi: şehir listesi, form şeması, metinler. Hesap formülü içermez. */
(function (root) {
'use strict';
const CITIES = [
['Gebze',40.8028,29.4307],['İzmit (Kocaeli)',40.7654,29.9408],['İstanbul',41.0082,28.9784],['Ankara',39.9334,32.8597],
['İzmir',38.4237,27.1428],['Bursa',40.1885,29.0610],['Antalya',36.8969,30.7133],['Adana',37.0,35.3213],['Konya',37.8746,32.4932],
['Gaziantep',37.0662,37.3833],['Eskişehir',39.7767,30.5206],['Kayseri',38.7312,35.4787],['Samsun',41.2867,36.33],['Trabzon',41.0027,39.7168],
['Mersin',36.8121,34.6415],['Diyarbakır',37.9144,40.2306],['Tekirdağ',40.9833,27.5167],['Sakarya',40.7569,30.3783],['Edirne',41.6771,26.5557],
['Denizli',37.7765,29.0864],['Muğla',37.2153,28.3636],['Berlin',52.52,13.405],['Münih',48.1351,11.582],['Frankfurt',50.1109,8.6821],['Dubai',25.2048,55.2708]
].map((c) => ({ n: c[0], lat: c[1], lon: c[2] }));

/* [anahtar, etiket, birim, adım, araçlar] — birimde "$" para birimi etiketiyle değişir */
const SCHEMA = [
{ g: 'Satın alma ve değer', f: [['price','Araç alış bedeli','$'],['infra','Şarj / altyapı (araç başına)','$'],['residual','Kalıntı değer','%'],['life','Ekonomik ömür','yıl'],['eng','Mühendislik + haritalama (filo toplamı, tek sefer)','$','robovan']] },
{ g: 'Enerji', f: [['l100','Yakıt tüketimi','L/100 km','conventional'],['fuel','Dizel yakıt fiyatı','$/L','conventional'],['kwh100','Elektrik tüketimi','kWh/100 km','robovan'],['elec','Elektrik fiyatı','$/kWh','robovan'],['eff','Şarj verimi','%','robovan'],['chargeKw','Şarj gücü','kW','robovan'],['range','Menzil','km','robovan']] },
{ g: 'Bakım ve sabit giderler', f: [['maint','Bakım','$/km'],['tire','Lastik','$/km'],['ins','Sigorta','$/yıl'],['tax','Vergi, muayene','$/yıl'],['lic','Yazılım + bağlantı lisansı','$/ay','robovan']] },
{ g: 'Personel', f: [['driver','Sürücü maliyeti (işveren)','$/ay','conventional'],['operator','Uzaktan operatör maliyeti','$/ay','robovan'],['ratio','Operatör başına araç','araç','robovan'],['shiftH','Vardiya süresi','saat']] },
{ g: 'Kapasite ve hız', f: [['payload','Azami yük','kg'],['speed','Ortalama hız','km/sa'],['hours','Günlük çalışma süresi','saat/gün']] }
];

/* Rakamlarım > Operasyon (temel) ve Gelişmiş senaryo alanları: [anahtar, etiket, birim] */
const SCENARIO_OPS = [['demand','Günlük toplam sefer (tüm iş)','sefer/gün'],['days','Çalışma günü','gün/yıl'],['stops','Sefer başına durak','adet'],['loadMin','Durak başına yükleme','dk']];
const SCENARIO_ADV = [['loadPct','Ortalama yük doluluğu','%'],['rate','Sermaye (finansman) maliyeti','%/yıl'],['horizon','Değerlendirme süresi','yıl'],['fleet','Robovan sayısını sabitle (0 = otomatik)','adet']];
/* Her kategoride temel alanlar: Robovan — satın alma, elektrik, bakım, operatör; Geleneksel Van — satın alma, dizel, bakım, sürücü. Kalanlar Gelişmiş'tedir. */
const CORE = { robovan: ['price','kwh100','elec','maint','operator'], conventional: ['price','l100','fuel','maint','driver'] };
const DESC = {
  days: 'Yılda kaç gün çalışıldığı.', demand: 'Tüm iş için günlük toplam sefer sayısı. Araç sayısı buna göre hesaplanır.', stops: 'Her seferde yapılan durak sayısı.', loadMin: 'Her durakta yükleme/boşaltma süresi.',
  loadPct: 'Araç kapasitesinin ortalama ne kadarının dolu olduğu.', rate: 'Yatırımın yıllık finansman (sermaye) maliyeti.', horizon: 'Toplam maliyetin hesaplandığı yıl sayısı.', fleet: 'Robovan sayısını elle sabitler; 0 = otomatik.',
  price: 'Aracın satın alma bedeli.', infra: 'Şarj istasyonu ve altyapı; araç başına.', residual: 'Ömür sonunda aracın alış bedelinin kaçta kaçının kaldığı.', life: 'Aracın kullanılacağı yıl sayısı; amortisman bu süreye yayılır.', eng: 'Haritalama ve devreye alma mühendisliği; tüm filo için bir kez.',
  l100: '100 km yolda yakılan dizel miktarı.', fuel: 'Dizelin litre fiyatı.', kwh100: '100 km yolda harcanan elektrik.', elec: 'Elektriğin kWh fiyatı.', eff: 'Şarjda kaybolmayan enerji oranı.', chargeKw: 'Şarj gücü; şarj süresini belirler.', range: 'Tek şarjla gidilebilen mesafe.',
  maint: 'Kilometre başına bakım gideri.', tire: 'Kilometre başına lastik gideri.', ins: 'Yıllık sigorta bedeli.', tax: 'Yıllık vergi ve muayene.', lic: 'Yazılım ve bağlantı lisansı (aylık).',
  driver: 'Sürücünün işverene aylık maliyeti.', operator: 'Uzaktan operatörün aylık maliyeti.', ratio: 'Bir operatörün aynı anda izlediği araç sayısı.', shiftH: 'Bir vardiyanın süresi.',
  payload: 'Aracın taşıyabileceği en fazla yük.', speed: 'Rota üzerindeki ortalama hız.', hours: 'Aracın günde çalışabileceği süre.'
};

/* Ana kaydırıcılar. group: aynı değerin yazıldığı yollar. Doğrusal ölçek (onaylı karar). */
const SLIDERS = [
{ id: 'sl.demand', label: 'Günlük toplam sefer', unit: 'sefer/gün', min: 1, max: 40, step: 1, paths: ['s.demand'] },
{ id: 'sl.elec', label: 'Elektrik fiyatı', unit: '$/kWh', min: 0.01, max: 1.5, step: 0.01, paths: ['p.elec'] },
{ id: 'sl.fuel', label: 'Dizel yakıt fiyatı', unit: '$/L', min: 0.1, max: 5, step: 0.05, paths: ['p.fuel'] },
{ id: 'sl.driver', label: 'Sürücü aylık maliyeti', unit: '$/ay', min: 0, max: 10000, step: 50, paths: ['p.driver'] },
{ id: 'sl.operator', label: 'Operatör aylık maliyeti', unit: '$/ay', min: 0, max: 10000, step: 50, paths: ['p.operator'] }
];

const PRESETS = [['Gebze → İzmit', ['Gebze', 'İzmit (Kocaeli)']], ['İstanbul → Bursa', ['İstanbul', 'Bursa']], ['İstanbul → Ankara', ['İstanbul', 'Ankara']], ['Ankara → Eskişehir', ['Ankara', 'Eskişehir']], ['Gebze → İzmit → Sakarya (3 durak)', ['Gebze', 'İzmit (Kocaeli)', 'Sakarya']]];
const TIPS = [['Rotayı seçin', 'Soldaki rota kartından şehir ekleyin, adres arayın ya da haritaya tıklayarak durak koyun. Mesafe maliyete doğrudan yansır.'], ['Parametreleri oynatın', 'Günlük sefer, elektrik, yakıt ve personel kaydırıcılarını değiştirin. Sonuçlar, grafikler ve canlı karşılaştırma anında güncellenir.'], ['Sonucu okuyun', 'Oynat düğmesiyle günü başlatın: her araç seferlerini yapar, bugünkü maliyet araçların üstünde akar. Büyük rakam seçili iki aracın yıllık farkıdır.']];

const LIVE_NOTE = 'Canlı değerler günün birikimidir (06:00\'dan şimdiye, tüm araçlar; yıllık filo maliyeti değildir). Her araç kendi seferlerini art arda yapar. Enerji ve bakım kat edilen yola, sigorta, personel, amortisman ve finansman geçen süreye göre birikir; gün sonunda toplam, yıllık filo maliyeti ÷ çalışma gününe eşittir. Hız çarpanı (×1, ×3, ×6) yalnızca saatin akış hızını değiştirir, toplam maliyeti değiştirmez.';

const FORMULAS = [
['Araç sayısı', 'Sefer süresi = yol süresi + (durak × yükleme süresi) + elektrikli araçlarda şarj süresi. Bir araç günde çalışma süresi ÷ sefer süresi (aşağı yuvarlanır, en az 1) sefer yapabilir. Gereken araç = günlük toplam sefer ÷ bu sayı (yukarı yuvarlanır). Robovan sayısı sabitlenirse o sayı kullanılır.'],
['Enerji', 'Yıllık km × tüketim × birim fiyat. Elektrikli araçlarda tüketim şarj verimine bölünür.'],
['Personel', 'Sürücülü araçta aylık sürücü maliyeti × 12 × vardiya sayısı. Robovanda aylık operatör maliyeti × 12 × vardiya sayısı ÷ operatör başına araç sayısı. Sürücü maliyeti 12 ay sabittir.'],
['Bakım, lastik, sabit', 'Yıllık km × (bakım + lastik) + sigorta + vergi (+ robovanda lisans × 12).'],
['Sermaye', 'Amortisman = (yatırım − kalıntı değer) ÷ ömür. Finansman = ortalama bağlı sermaye × yıllık oran. Robovan yatırımına mühendislik bedeli (filo toplamı ÷ araç sayısı) dahildir.'],
['Birim maliyet', 'km başına = yıllık toplam ÷ yıllık km. Sefer başına = yıllık toplam ÷ yıllık sefer. Ton-km başına = yıllık toplam ÷ (yıllık km × yük × doluluk).'],
['Tasarruf ve yüzde', 'Yıllık tasarruf = karşılaştırılan ikinci aracın yıllık filo maliyeti − birinci aracın yıllık filo maliyeti. 3 aylık = yıllık ÷ 4. Maliyet düşüşü = tasarruf ÷ tabanın filo maliyeti.'],
['Geri ödeme (başa baş)', 'İlk yatırım farkı ÷ yıllık nakit işletme farkı. Amortisman, finansman ve kalıntı değer dahil değildir.'],
['Başa baş sürücü maliyeti', 'Karşılaştırmadaki sürücülü aracın aylık sürücü maliyeti hangi değerde yıllık filo maliyetini diğer araçla eşitler.'],
['Canlı sefer maliyeti', 'Tek seferin birikimidir: enerji ve bakım kat edilen yola, sigorta/vergi/lisans, personel, amortisman ve finansman geçen süreye göre dağılır. Sefer sonunda yıllık toplam ÷ yıllık sefer sayısına eşittir.'],
['5 yıllık toplam fark', 'Değerlendirme süresi boyunca yatırım + işletme, kalıntı değer düşülmüş toplam maliyet farkı.']
];

root.RobovanUIData = { PRESETS, TIPS, CITIES, SCHEMA, SCENARIO_OPS, SCENARIO_ADV, CORE, DESC, SLIDERS, FORMULAS, LIVE_NOTE };
})(window);
