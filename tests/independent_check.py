"""Bağımsız doğrulama: şartname bölüm 5 formüllerini Python'da sıfırdan uygular ve motor çıktısıyla karşılaştırır.
Kullanım: node tests/dump-engine.js > dump.json && python3 tests/independent_check.py dump.json"""
import json, math, sys
data = json.load(open(sys.argv[1]))

def calc(kind, v, sc, route_km, D, fleet_override):
    trip_km = route_km * (2 if sc['roundTrip'] else 1)
    ev = kind != 'ice'
    t_drive = trip_km / v['speed']
    t_load = sc['stops'] * sc['loadMin'] / 60
    t_charge = (trip_km * v['kwh100'] / 100) / v['chargeKw'] if ev else 0
    t_trip = max(t_drive + t_load + t_charge, 0.01)
    max_trips = max(1, math.floor(v['hours'] / t_trip + 1e-9))
    n = fleet_override if fleet_override > 0 else max(1, math.ceil(D / max_trips - 1e-9))
    tpv = D / n
    used = tpv * t_trip
    shifts = max(1, math.ceil(used / v['shiftH'] - 1e-9))
    kmv = tpv * trip_km * sc['days']
    if ev: energy = kmv * v['kwh100'] / 100 / (v['eff'] / 100) * v['elec']
    else: energy = kmv * v['l100'] / 100 * v['fuel']
    maint = kmv * (v['maint'] + v['tire'])
    fixed = v['ins'] + v['tax'] + (v['lic'] * 12 if kind == 'robo' else 0)
    people = (v['operator'] * 12 * shifts / v['ratio']) if kind == 'robo' else v['driver'] * 12 * shifts
    capex = v['price'] + v['infra'] + (v['eng'] / n if kind == 'robo' else 0)
    res = v['price'] * v['residual'] / 100
    dep = (capex - res) / v['life']
    fin = (capex + res) / 2 * sc['rate'] / 100
    total = energy + maint + fixed + people + dep + fin
    trips = tpv * sc['days']
    tonkm = kmv * v['payload'] * sc['loadPct'] / 100 / 1000
    cash = energy + maint + fixed + people
    H = sc['horizon']
    resH = res + (v['price'] - res) * (1 - min(H, v['life']) / v['life'])
    staff = (shifts * n / v['ratio']) if kind == 'robo' else shifts * n
    eq = (kmv * n * v['kwh100'] / 100 / (v['eff'] / 100)) if ev else kmv * n * v['l100'] / 100
    return dict(n=n, tripH=t_trip, kmv=kmv, energy=energy, maint=maint, fixed=fixed, people=people, dep=dep, fin=fin, total=total,
                fleet=total * n, perKm=total / kmv, perTrip=total / trips, perTonKm=total / tonkm,
                tco=n * (capex + cash * H) - n * resH, cum5=n * (capex + cash * 5), staff=staff, energyQty=eq,
                _capex=n * capex, _cash=n * cash)

KIND = {'robovan': 'robo', 'conventional': 'ice'}
bad = 0; checks = 0; worst = 0.0
for i, o in enumerate(data):
    c = o['cfg']; sc = c['scenario']; km = c['route']['manualKm']
    mine = {v['id']: calc(KIND[v['category']], v['params'], sc, km, sc['demand'], sc['fleet'] if KIND[v['category']] == 'robo' else 0) for v in c['fleet']}
    for k in mine:
        for f, ev in o['res'][k].items():
            mv = mine[k][f]; checks += 1
            err = abs(mv - ev) / max(1e-12, abs(mv))
            worst = max(worst, err)
            if err > 1e-9:
                bad += 1
                if bad < 8: print('FARK', i, k, f, mv, ev)
    # bağımsız canlı defter: sefer sonu = sefer başı maliyet; yarıda mesafe ve zaman payları
    trip_km = km * (2 if sc['roundTrip'] else 1)
    for v in c['fleet']:
        k = v['id']; m = mine[k]; L = o['live'][k]; kind = KIND[v['category']]; vp = v['params']
        trips = m['fleet'] / m['n'] / m['perTrip'] if False else None
        # toplam süre (dk) bağımsız: sürüş + durak + şarj
        stops = int(sc['stops']); tot_min = (trip_km / vp['speed']) * 60 + (stops * sc['loadMin'] if sc['loadMin'] > 0 else 0)
        if kind == 'robo': tot_min += (trip_km * vp['kwh100'] / 100) / vp['chargeKw'] * 60
        checks += 2
        if abs(tot_min - L['endMin']) > 1e-7 * max(1, tot_min): bad += 1; print('FARK süre', i, k, tot_min, L['endMin'])
        if abs(L['endTotal'] - m['perTrip']) > 1e-9 * max(1, m['perTrip']): bad += 1; print('FARK canlı sonu', i, k, L['endTotal'], m['perTrip'])
        # yarıda: zaman payı t/tot, km payı sürüş-segmentlerinden; kısıtlı doğrulama: 0<=km<=tripKm, total<=perTrip
        checks += 1
        if not (-1e-9 <= L['midKm'] <= trip_km + 1e-9 and -1e-9 <= L['midTotal'] <= m['perTrip'] * (1 + 1e-9)): bad += 1; print('FARK canlı aralık', i, k)
        if L['frac'] >= 1:
            checks += 1
            if abs(L['midTotal'] - m['perTrip']) > 1e-9 * max(1, m['perTrip']): bad += 1; print('FARK kırpma', i, k)
    a, b = c['compare']['a'], c['compare']['b']
    saving = mine[b]['fleet'] - mine[a]['fleet']; checks += 1
    if abs(saving - o['kpi']['saving']) > 1e-6 * max(1, abs(saving)): bad += 1; print('FARK tasarruf', i)
    tco = mine[b]['tco'] - mine[a]['tco']; checks += 1
    if abs(tco - o['kpi']['tcoSaving']) > 1e-6 * max(1, abs(tco)): bad += 1; print('FARK tco', i)
    A, B = mine[a], mine[b]
    a0, a1, b0, b1 = A['_capex'], A['_cash'], B['_capex'], B['_cash']
    if a0 <= b0 and a1 <= b1 or (a1 < b1 and a0 <= b0): be = 0
    elif a1 >= b1: be = None
    else: be = (a0 - b0) / (b1 - a1)
    checks += 1
    ev = o['kpi']['be']
    if (be is None) != (ev is None) or (be is not None and abs(be - ev) > 1e-9 * max(1, abs(be))): bad += 1; print('FARK başa baş', i, be, ev)
print(f'{len(data)} rastgele yapılandırma (2–6 araç), {checks} karşılaştırma, uyuşmayan: {bad}, en büyük bağıl fark: {worst:.2e}')
sys.exit(1 if bad else 0)
