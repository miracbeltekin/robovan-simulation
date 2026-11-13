/* 3D araçlar: MapLibre özel katmanında Three.js ile çizilir. Modeller kod ile, GERÇEK üç boyutlu geometriyle üretilir
   (fotoğraf panosu / sprite yok; dış model dosyası yok, sayfa tek dosya olarak çalışır).
   'robovan': kullanıcı fotoğrafı referans alınarak modellendi (kabinsiz beyaz lojistik kutu gövde, yuvarlatılmış köşeler, siyah çerçeveli iki büyük yan kapak,
   menteşe/kilit/panel çizgileri, siyah şasi, koyu gri tampon, ön sensör yüzü, tavan sensör modülü, dört tekerlek). Fotoğrafta görünmeyen yüzeyler (sol yan, arka,
   alt) tasarım bütünlüğüyle TAHMİNİ olarak tamamlanmıştır; üreticiye ait CAD geometrisi değildir.
   'conventional': kabinli dizel panelvan/kamyonet. Tam model (ayrıntılı) ve sade model (ışıksız, az parça) vardır; düşük performansta sade modele geçilir. */
(function (root) {
'use strict';
var BRAND = 0xFF671D;

/* Yuvarlatılmış gövde: (Y,Z) profilini X boyunca çıkar; kenarlar eğimlenir. r: [önÜst, arkaÜst, arkaAlt, önAlt] profil köşe yarıçapları */
function roundedBody(THREE, w, l, h, r, bev) {
  var L = l - 2 * bev, H = h - 2 * bev, s = new THREE.Shape(), hl = L / 2;
  var a = Math.min(r[0], L / 2, H / 2), b = Math.min(r[1], L / 2, H / 2), c = Math.min(r[2], L / 2, H / 2), d = Math.min(r[3], L / 2, H / 2);
  s.moveTo(-hl + c, 0); s.lineTo(hl - d, 0); s.quadraticCurveTo(hl, 0, hl, d); s.lineTo(hl, H - a); s.quadraticCurveTo(hl, H, hl - a, H);
  s.lineTo(-hl + b, H); s.quadraticCurveTo(-hl, H, -hl, H - b); s.lineTo(-hl, c); s.quadraticCurveTo(-hl, 0, -hl + c, 0);
  return finish(THREE, s, w, bev, l, h);
}
function finish(THREE, shape, w, bev, l, h) {
  var g = new THREE.ExtrudeGeometry(shape, { depth: w - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 8 });
  /* (sx,sy,sz) -> (X=sz, Y=sx, Z=sy); X ortalanır, Z alt kenarı 0'a oturur */
  var m = new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1);
  g.applyMatrix4(m); g.translate(-(w - 2 * bev) / 2, 0, bev); g.computeVertexNormals(); return g;
}
/* kabin profili: eğimli ön cam ve kaput */
function cabBody(THREE, w, bev) {
  var s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(1.7, 0); s.lineTo(1.7, 0.62); s.quadraticCurveTo(1.7, 0.78, 1.52, 0.86); s.lineTo(0.92, 1.42); s.quadraticCurveTo(0.84, 1.5, 0.7, 1.5);
  s.lineTo(0.06, 1.5); s.lineTo(0, 1.46); s.lineTo(0, 0);
  return finish(THREE, s, w, bev, 1.7, 1.5);
}

function buildVan(THREE, type, color, simple) {
  var g = new THREE.Group(), wheels = [], accent = new THREE.Color(color);
  function mat(c, o) { return simple ? new THREE.MeshBasicMaterial(Object.assign({ color: c }, o || {})) : new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {})); }
  function basic(c, o) { return new THREE.MeshBasicMaterial(Object.assign({ color: c }, o || {})); }
  function add(geo, m, x, y, z) { var o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; }
  function box(w, l, h, x, y, z, m) { return add(new THREE.BoxGeometry(w, l, h), m, x, y, z); }
  var WHITE = mat(0xE6E9EC), BLACK = mat(0x0F1114), DARK = mat(0x2A2D33), GREY = mat(0x6C727C);
  var ROBO = type === 'robovan';
  var W = ROBO ? 2.15 : 2.1;

  if (ROBO) {
    /* gövde: beyaz, yuvarlatılmış kabinsiz kutu */
    var body = add(roundedBody(THREE, W, 5.5, 2.3, [0.42, 0.3, 0.12, 0.12], 0.1), WHITE, 0, 0, 0.8);
    box(1.9, 5.0, 0.42, 0, -0.05, 0.62, BLACK);                              /* siyah alt şasi */
    box(2.0, 0.42, 0.5, 0, 2.62, 0.74, DARK);                                /* koyu gri tampon */
    box(1.5, 0.05, 0.12, 0, 2.86, 0.6, GREY);                                 /* tampon plakası */
    /* renk şeridi (araç ayrımı): şasi kenarında ince çizgi */
    [-1, 1].forEach(function (s) { box(0.03, 4.1, 0.07, s * 1.08, -0.15, 0.88, mat(accent)); });
    /* ön yüz: koyu sensör paneli, farlar */
    box(1.72, 0.06, 0.95, 0, 2.78, 2.0, BLACK);
    box(1.4, 0.04, 0.08, 0, 2.82, 1.62, basic(0x8FE9F2)); box(0.34, 0.04, 0.12, 0.72, 2.82, 1.2, basic(0xFFFFFF)); box(0.34, 0.04, 0.12, -0.72, 2.82, 1.2, basic(0xFFFFFF));
    if (!simple) { box(0.2, 0.05, 0.2, 0.55, 2.84, 2.2, DARK); box(0.2, 0.05, 0.2, -0.55, 2.84, 2.2, DARK); }
    /* arka: kapak çizgisi, stop lambaları */
    box(0.03, 0.04, 1.9, 0, -2.78, 2.0, BLACK); box(0.28, 0.04, 0.1, 0.8, -2.78, 1.2, basic(0xE5322D)); box(0.28, 0.04, 0.1, -0.8, -2.78, 1.2, basic(0xE5322D));
    /* tavan sensörleri (ön sağ üst köşe) */
    box(1.0, 0.5, 0.16, 0, 2.2, 3.16, BLACK);
    if (!simple) {
      [-0.28, 0.28].forEach(function (x) { var c = add(new THREE.CylinderGeometry(0.15, 0.15, 0.2, 14), DARK, x, 2.3, 3.32); c.rotation.x = Math.PI / 2; add(new THREE.CircleGeometry(0.1, 12), basic(0x0B2027), x, 2.41, 3.32).rotation.x = -Math.PI / 2; });
      box(0.5, 0.3, 0.1, 0, -2.2, 3.12, DARK);                                         /* arka tavan anteni */
    }
    /* yan kapaklar: iki büyük, siyah çerçeveli panel (iki yan) */
    [-1, 1].forEach(function (s) {
      var xo = s * (W / 2 + 0.012);
      [-2.3, -0.2].forEach(function (y0, pi) {                                          /* panel arka kenarı */
        var pl = 1.95, pz0 = 1.1, ph = 1.85, t = 0.07, ym = y0 + pl / 2, zm = pz0 + ph / 2;
        box(0.03, pl, t, xo, ym, pz0 + t / 2, BLACK); box(0.03, pl, t, xo, ym, pz0 + ph - t / 2, BLACK);
        box(0.03, t, ph, xo, y0 + t / 2, zm, BLACK); box(0.03, t, ph, xo, y0 + pl - t / 2, zm, BLACK);
        add(new THREE.BoxGeometry(0.02, pl - 2 * t, ph - 2 * t), mat(0xEEF1F3), xo + s * 0.004, ym, zm);
        box(0.02, 0.03, ph - 2 * t, xo + s * 0.006, ym, zm, mat(0xD9DDE1));                  /* panel orta bombe çizgisi */
        if (!simple) { [0.2, 0.9, 1.6].forEach(function (z) { var h = add(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 8), BLACK, xo + s * 0.025, pi === 0 ? y0 + 0.01 : y0 + pl - 0.01, pz0 + z); h.rotation.x = 0; }); }
      });
      box(0.03, 0.05, 1.85, xo, -0.2, 2.03, BLACK);                                      /* iki kapak arası siyah ayrım */
      box(0.04, 0.22, 0.2, xo + s * 0.006, 0.16, 1.9, BLACK);                              /* kilit bloğu */
      if (!simple) { box(0.045, 0.07, 0.07, xo + s * 0.008, 0.16, 1.9, basic(0x8A93A3)); box(0.03, 0.05, 0.3, xo, -0.35, 1.95, DARK); }
      box(0.03, 5.2, 0.03, xo, 0, 3.06, mat(0xD2D7DB));                                   /* çatı hattı çizgisi */
      /* tekerlek yayı gölgesi */
      [1.75, -1.65].forEach(function (y) { var a = add(new THREE.CylinderGeometry(0.66, 0.66, 0.03, simple ? 12 : 24), BLACK, s * (W / 2 + 0.008), y, 0.78); a.rotation.z = Math.PI / 2; });
      if (!simple) { box(0.12, 0.18, 0.14, s * 1.12, 2.5, 2.95, BLACK); add(new THREE.CircleGeometry(0.045, 10), basic(0x0B2027), s * 1.19, 2.5, 2.95).rotation.y = s * Math.PI / 2; }  /* yan kamera */
    });
  } else {
    /* geleneksel van: renkli kargo kutusu + beyaz kabin + cam */
    add(roundedBody(THREE, W, 3.75, 2.25, [0.16, 0.16, 0.1, 0.1], 0.08), mat(accent), 0, -0.78, 0.92);
    box(1.9, 5.3, 0.4, 0, -0.1, 0.62, BLACK);
    var cab = add(cabBody(THREE, 2.0, 0.08), WHITE, 0, 1.12, 0.78);
    box(1.88, 0.06, 0.5, 0, 2.7, 1.55, mat(0x1A2733)); box(1.7, 0.04, 0.4, 0, 2.08, 2.12, mat(0x1A2733));
    var wsh = box(1.8, 0.06, 0.78, 0, 2.18, 2.0, mat(0x24333F)); wsh.rotation.x = -0.9;
    box(2.1, 0.4, 0.46, 0, 2.62, 0.72, DARK); box(1.0, 0.04, 0.3, 0, 2.84, 1.12, BLACK); box(0.3, 0.04, 0.14, 0.78, 2.84, 1.2, basic(0xFFF4C9)); box(0.3, 0.04, 0.14, -0.78, 2.84, 1.2, basic(0xFFF4C9));
    box(2.05, 0.04, 0.05, 0, -2.66, 1.3, DARK); box(0.03, 0.04, 1.8, 0, -2.66, 2.0, BLACK);
    [-1, 1].forEach(function (s) {
      box(0.04, 1.0, 0.5, s * 1.01, 1.74, 1.78, mat(0x24333F));                              /* yan cam */
      box(0.12, 0.18, 0.34, s * 1.14, 2.12, 1.95, BLACK);                                    /* ayna */
      box(0.03, 3.3, 0.04, s * (W / 2 + 0.005), -0.78, 1.5, mat(0xD5D9DD));
      [1.75, -1.65].forEach(function (y) { var a = add(new THREE.CylinderGeometry(0.64, 0.64, 0.03, simple ? 12 : 24), BLACK, s * (W / 2 - 0.01), y, 0.78); a.rotation.z = Math.PI / 2; });
    });
    if (!simple) { box(0.25, 0.25, 0.1, 0, 1.2, 2.32, mat(0xFFB020)); }                      /* kabin üstü sarı lamba */
  }
  /* zemin gölgesi */
  add(new THREE.PlaneGeometry(2.9, 6.4), basic(0x000000, { transparent: true, opacity: 0.38, depthWrite: false }), 0, 0, 0.03);
  /* tekerlekler: eksen X; grup X ekseninde döner (hareketle uyumlu) */
  [[1.0, 1.75], [-1.0, 1.75], [1.0, -1.65], [-1.0, -1.65]].forEach(function (p) {
    var wg = new THREE.Group(); wg.position.set(p[0], p[1], 0.5); g.add(wg);
    var tire = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.34, simple ? 10 : 24), basic(0x131518)); tire.rotation.z = Math.PI / 2; wg.add(tire);
    var rim = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.36, simple ? 8 : 18), basic(0xA6AEBA)); rim.rotation.z = Math.PI / 2; wg.add(rim);
    if (!simple) {
      var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.4, 10), basic(0x4A505A)); hub.rotation.z = Math.PI / 2; wg.add(hub);
      for (var k = 0; k < 5; k++) { var sp = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.07, 0.34), basic(0x3E434B)); sp.rotation.x = k * Math.PI * 2 / 5; sp.position.set(0, 0, 0); wg.add(sp); }
    }
    wheels.push(wg);
  });
  g.userData.wheels = wheels;
  return g;
}

function create(opts) {
  var THREE = root.THREE, ML = root.maplibregl, simple = !!(opts && opts.simple);
  var list = [], map, renderer, scene, camera, objs = {}, built = null;
  function clear() { Object.keys(objs).forEach(function (k) { scene.remove(objs[k].g); }); objs = {}; }
  function sync() {
    if (!scene) return;
    if (built !== simple) { clear(); built = simple; }
    list.forEach(function (v) {
      var o = objs[v.id], key = v.type + '|' + v.color;
      if (!o || o.key !== key) { if (o) scene.remove(o.g); o = objs[v.id] = { g: buildVan(THREE, v.type, v.color, simple), key: key }; scene.add(o.g); }
    });
    Object.keys(objs).forEach(function (k) { if (!list.some(function (v) { return v.id === k; })) { scene.remove(objs[k].g); delete objs[k]; } });
  }
  var layer = {
    id: 'rv-van', type: 'custom', renderingMode: '3d',
    onAdd: function (m, gl) {
      map = m; camera = new THREE.Camera(); scene = new THREE.Scene();
      var d1 = new THREE.DirectionalLight(0xffffff, 0.95); d1.position.set(0.6, -0.4, 1).normalize(); scene.add(d1);
      var d2 = new THREE.DirectionalLight(0xbcd0ff, 0.35); d2.position.set(-0.7, 0.5, 0.4).normalize(); scene.add(d2);
      scene.add(new THREE.AmbientLight(0xffffff, 0.72));
      renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: false }); renderer.autoClear = false; built = null; objs = {};
      sync();
    },
    render: function (gl, matrix) {
      if (!list.length) return;
      sync();
      renderer.resetState();
      var zoom = map.getZoom(), vis = Math.max(3.4, Math.min(300, Math.pow(2, 17.4 - zoom)));   /* görünür kalsın: yakında 3,4×, uzakta büyür */
      list.forEach(function (v) {
        var o = objs[v.id]; if (!o) return;
        scene.children.forEach(function (c) { if (c.isGroup) c.visible = false; }); o.g.visible = true;
        o.g.userData.wheels.forEach(function (w) { w.rotation.x = v.spin || 0; });
        var mc = ML.MercatorCoordinate.fromLngLat([v.lng, v.lat], 0), s = mc.meterInMercatorCoordinateUnits() * vis;
        var rotZ = new THREE.Matrix4().makeRotationZ(-v.brg * Math.PI / 180);
        var l = new THREE.Matrix4().makeTranslation(mc.x, mc.y, mc.z).scale(new THREE.Vector3(s, -s, s)).multiply(rotZ).multiply(new THREE.Matrix4().makeTranslation(v.off || 0, 0, 0));
        camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix).multiply(l);
        renderer.render(scene, camera);
      });
    },
    onRemove: function () { try { renderer.dispose(); } catch (e) {} }
  };
  return {
    layer: layer,
    /* vs: [{id,type:'robovan'|'conventional',color,lng,lat,brg,off,spin}] */
    setAll: function (vs) { list = vs.map(function (v) { return { id: v.id, type: v.type, color: v.color, lng: v.lng, lat: v.lat, brg: v.brg, off: v.off || 0, spin: v.spin || 0 }; }); if (map) map.triggerRepaint(); },
    hide: function () { list = []; if (map) map.triggerRepaint(); },
    setSimple: function (v) { simple = !!v; if (map) map.triggerRepaint(); },
    isSimple: function () { return simple; },
    state: function () { return { simple: simple, vehicles: list.map(function (v) { return { id: v.id, type: v.type, color: v.color, lng: v.lng, lat: v.lat, brg: v.brg, off: v.off, spin: v.spin }; }) }; }
  };
}

root.RobovanVan3D = { create: create, buildVan: buildVan };
})(window);
