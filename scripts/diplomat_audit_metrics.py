"""Recompute every metric behind the Diplomat Store Audit insight deck from a company export.

    python3 scripts/export-company-data.py --out diplomat-export.xlsx
    python3 scripts/diplomat_audit_metrics.py diplomat-export.xlsx out_dir/

Writes out_dir/metrics.json plus stores_geo.csv, master_geo.csv, audits.csv and shelf.csv.
Needs pandas, numpy, openpyxl and rapidfuzz.
"""
import json, re, math, collections, sys, os
import numpy as np, pandas as pd
from rapidfuzz import fuzz

XLSX, S = sys.argv[1], sys.argv[2]
os.makedirs(S, exist_ok=True)
x = pd.ExcelFile(XLSX)
T = {n: pd.read_excel(x, n) for n in ['visits', 'visit_responses', 'customers', 'users', 'company_existing_customers',
                                       'visit_photos', 'shelf_photo_analysis', 'anomaly_flags']}
M = {}

# ---------- visits ----------
v = T['visits'][T['visits'].visit_type == 'store'].copy()
v['ci'] = pd.to_datetime(v.check_in_time, utc=True).dt.tz_convert('Africa/Johannesburg')
v['co'] = pd.to_datetime(v.check_out_time, utc=True).dt.tz_convert('Africa/Johannesburg')
v['dur'] = (v.co - v.ci).dt.total_seconds() / 60
v = v.merge(T['customers'][['id', 'name', 'latitude', 'longitude']].rename(columns={'id': 'customer_id', 'name': 'store', 'latitude': 'slat', 'longitude': 'slon'}), on='customer_id', how='left')
M['store_audits'] = len(v)
M['date_min'], M['date_max'] = v.visit_date.min(), v.visit_date.max()
by_day = v.groupby('visit_date').size()
M['field_days'] = int((by_day > 2).sum())
M['agents'] = int(v.agent_id.nunique())
M['photos'] = int(len(T['visit_photos']))
M['photos_per_store'] = round(M['photos'] / M['store_audits'], 1)

# ---------- responses / product audit ----------
r = T['visit_responses']
recs = []
for vid, s in zip(r.visit_id, r.responses):
    d = json.loads(s); pra = d.get('product_range_audit')
    if isinstance(pra, str):
        try: pra = json.loads(pra)
        except Exception: continue
    if not isinstance(pra, dict) or len(pra.get('products') or []) != 17: continue
    st = pra.get('store') or {}
    prods = pra['products']
    answered = sum(1 for p in prods if str(p.get('stock', '')).strip())
    recs.append(dict(visit_id=vid, answered=answered, **{k: str(st.get(k, '')).strip() for k in st}, products=prods))
a = pd.DataFrame(recs).merge(v, left_on='visit_id', right_on='id')
# test/training: audits with no stock answer at all
test = a[a.answered == 0]
M['excluded_test'] = int(len(test))
a = a[a.answered > 0].copy()
M['stores_analysed'] = len(a)

SKU = {"CDM ORIGINAL 12G LUP": "CDM Original 12g LUP", "CHAPPIES SPEARMINT 100'S": "Chappies Spearmint", "CHAPPIES WATERMELON 100'S": "Chappies Watermelon",
       "CLORETS FRESH MINT SUGARED 2PC 56X40": "Clorets Fresh Mint 2PC", "CLORETS ORIGINAL SUGARED 2PC 56X40": "Clorets Original 2PC", "ECLAIRS ORIGINAL 230G": "Eclairs Original 230g",
       "HALLS CHERRY 72 X 48": "Halls Cherry", "HALLS FRUIT EXPLOSION POLY BAGS": "Halls Fruit Explosion", "HALLS ICE BLUE 72 X 48": "Halls Ice Blue", "HALLS XTRA STRONG POLYBAG 72PC": "Halls Xtra Strong",
       "MINI LUNCH BAR MINI X 24": "Lunch Bar Mini x24", "MINI PS CARAMILK X 24": "PS Caramilk Mini x24", "OREO ORIGINAL LUP 41.57G": "Oreo Original LUP 41.57g",
       "STIMOROL AR MNTHL SF 2PX50X30": "Stimorol Menthol SF 2P", "STIMOROL INFINITY MINT 50PC": "Stimorol Infinity Mint", "STIMOROL INFINITY TROPICAL 50PC": "Stimorol Infinity Tropical", "STIMOROL W/CHERY SF 2PX50X30": "Stimorol Cherry SF 2P"}
rows = []
for _, row in a.iterrows():
    for p in row.products:
        rows.append(dict(visit_id=row.visit_id, sku=SKU.get(p['product'], p['product']), instock=str(p.get('stock', '')).strip().lower() == 'yes', why=str(p.get('why_not', '')).strip()))
sk = pd.DataFrame(rows)
M['sku_checks'] = len(sk)
M['range_on_shelf_pct'] = round(100 * sk.instock.mean(), 1)
M['gaps'] = int((~sk.instock).sum())
inst = sk.groupby('sku').instock.mean().mul(100).round(1).sort_values(ascending=False)
M['sku_instock'] = inst.to_dict()
M['sku_missing'] = sk[~sk.instock].groupby('sku').size().sort_values(ascending=False).to_dict()
depth = sk.groupby('visit_id').instock.sum()
a['depth'] = a.visit_id.map(depth)
M['depth_hist'] = {int(k): int(val) for k, val in depth.value_counts().sort_index().items()}
M['full_range'] = int((depth == 17).sum()); M['full_range_pct'] = round(100 * M['full_range'] / len(a))
M['avg_depth'] = round(depth.mean(), 1)
M['short_1_5'] = int(((depth >= 12) & (depth <= 16)).sum()); M['short_1'] = int((depth == 16).sum())
M['below_12'] = int((depth < 12).sum()); M['below_12_pct'] = round(100 * M['below_12'] / len(a))

# ---------- reasons ----------
def reason_cat(t):
    t = t.lower().strip()
    if not t or t == 'test': return None
    if re.search(r"out of (stock|product)|stock ?out|out stock|sold out|ran out|run out|finished|waiting (for )?(stock|delivery)|restock|re-stock|not delivered yet|still coming|not in stock|no stock at", t): return 'Out of stock'
    if re.search(r"slow|not (selling|moving|in demand)|low demand|less demand|no demand|don'?t sell well|doesn'?t sell|customers don'?t|not popular|nobody buys|no one buys|people don'?t|don'?t buy", t): return 'Slow moving / low demand'
    if re.search(r"expensive|price|pricing|cash|money|afford|budget|cost|capital|funding|startup|start-up", t): return 'Price / cash flow'
    if re.search(r"food|liquor|tavern|shisa|restu?arant|kitchen|bar\b|butcher|salon|cook|fast food|take ?away|bottle store|pub|kota|car wash|hair|spaza kitchen", t): return 'Outlet format (food / liquor)'
    if re.search(r"supplier|supply|availab|wholesale|can'?t find|cannot find|hard to find|not (getting|get)|no delivery|delivery", t): return 'Supply / availability'
    if re.search(r"don'?t want|not interested|no interest|not needed|owner (does|doesn)|not keen|refuse|prefer|don'?t like|not willing|target market|not in line", t): return 'Not wanted by owner'
    if re.search(r"know|aware|heard|unfamiliar|seen", t): return 'Product not known'
    if re.search(r"not list|never|don'?t (sell|stock|have|get|order|keep|take)|do not|no stock|not stock|not sell|not (yet )?(ranged|supplied|introduced|offered)|haven'?t|didn'?t|not been|new|only|n/?a|none|no\b|would love|want to", t): return 'Not listed / never ranged'
    return 'Other'
# test/training audits: every why-not answer is the literal "Test"
test_visits = set(sk[sk.why.str.strip().str.lower() == 'test'].visit_id)
M['excluded_test'] = len(test_visits)
a = a[~a.visit_id.isin(test_visits)].copy(); sk = sk[~sk.visit_id.isin(test_visits)].copy()
M['stores_analysed'] = len(a); M['sku_checks'] = len(sk); M['range_on_shelf_pct'] = round(100 * sk.instock.mean(), 1); M['gaps'] = int((~sk.instock).sum())
inst = sk.groupby('sku').instock.mean().mul(100).round(1).sort_values(ascending=False)
M['sku_instock'] = inst.to_dict(); M['sku_missing'] = sk[~sk.instock].groupby('sku').size().sort_values(ascending=False).to_dict()
depth = sk.groupby('visit_id').instock.sum(); a['depth'] = a.visit_id.map(depth)
M['depth_hist'] = {int(k): int(val) for k, val in depth.value_counts().sort_index().items()}
M['full_range'] = int((depth == 17).sum()); M['full_range_pct'] = round(100 * M['full_range'] / len(a)); M['avg_depth'] = round(depth.mean(), 1)
M['short_1_5'] = int(((depth >= 12) & (depth <= 16)).sum()); M['short_1'] = int((depth == 16).sum())
M['below_12'] = int((depth < 12).sum()); M['below_12_pct'] = round(100 * M['below_12'] / len(a))
miss = sk[~sk.instock].copy()
miss['cat'] = miss.why.map(reason_cat)
M['reason_blank'] = int(miss.cat.isna().sum())
rc = miss.cat.value_counts()
M['reasons_n'] = int(rc.sum()); M['reasons'] = rc.to_dict()
M['reasons_pct'] = (rc / rc.sum() * 100).round(1).to_dict()
M['never_listed_top'] = miss[miss.cat == 'Not listed / never ranged'].groupby('sku').size().sort_values(ascending=False).head(5).to_dict()
M['oos_top'] = miss[miss.cat == 'Out of stock'].groupby('sku').size().sort_values(ascending=False).head(8).to_dict()
M['oos_stimorol'] = int(sum(n for s, n in miss[miss.cat == 'Out of stock'].groupby('sku').size().items() if s.startswith('Stimorol')))
M['other_text_sample'] = miss[miss.cat == 'Other'].why.value_counts().head(25).to_dict()

# ---------- rep effect ----------
a['rep'] = a.rep_visits.str.lower() == 'yes'
sk['rep'] = sk.visit_id.map(a.set_index('visit_id').rep)
M['rep_pct'] = round(100 * a.rep.mean()); M['rep_n'] = int(a.rep.sum()); M['norep_n'] = int((~a.rep).sum())
M['full_rep'] = round(100 * (a[a.rep].depth == 17).mean()); M['full_norep'] = round(100 * (a[~a.rep].depth == 17).mean())
M['depth_rep'] = round(a[a.rep].depth.mean(), 1); M['depth_norep'] = round(a[~a.rep].depth.mean(), 1)
M['extra_listings'] = int(round((a[a.rep].depth.mean() - a[~a.rep].depth.mean()) * M['norep_n']))
rep_sku = sk.groupby(['sku', 'rep']).instock.mean().mul(100).round().unstack()
M['rep_sku'] = {s: {'norep': rep_sku.loc[s, False], 'rep': rep_sku.loc[s, True]} for s in ['Halls Cherry', 'Clorets Original 2PC', 'Stimorol Cherry SF 2P', 'Stimorol Infinity Mint', 'Eclairs Original 230g', 'CDM Original 12g LUP', 'Oreo Original LUP 41.57g']}

# ---------- geography ----------
e = T['company_existing_customers']
eg = e.dropna(subset=['latitude', 'longitude']).copy()
eg['area'] = eg.address.fillna('').str.split(',').str[-1].str.strip().str.title()
M['master_total'] = int(len(e)); M['master_geo'] = int(len(eg))
def hav(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(np.radians, (lat1, lon1, lat2, lon2))
    d = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    return 6371000 * 2 * np.arcsin(np.sqrt(d))
stores = v.dropna(subset=['slat', 'slon']).drop_duplicates('customer_id')[['customer_id', 'store', 'slat', 'slon', 'visit_id' if 'visit_id' in v else 'id']].copy()
SL = stores[['slat', 'slon']].to_numpy(); EL = eg[['latitude', 'longitude']].to_numpy()
# nearest master customer for each store (chunked)
near_idx = np.empty(len(SL), dtype=int); near_d = np.empty(len(SL))
for i in range(0, len(SL), 200):
    d = hav(SL[i:i + 200, 0:1], SL[i:i + 200, 1:2], EL[:, 0][None, :], EL[:, 1][None, :])
    near_idx[i:i + 200] = d.argmin(1); near_d[i:i + 200] = d.min(1)
stores['near_master'] = eg.index.to_numpy()[near_idx]; stores['near_d'] = near_d
AREA_FIX = {'Midriveand': 'Midrand / Ivory Park', 'Midrand': 'Midrand / Ivory Park', 'Ivory Park': 'Midrand / Ivory Park', 'Thembisa': 'Tembisa', 'Dhlamini': 'Dlamini'}
eg['area'] = eg.area.replace(AREA_FIX)
stores['area'] = eg.loc[stores.near_master, 'area'].to_numpy()
M['suburbs'] = int(stores.area.nunique())
M['area_within_200m_pct'] = round(100 * (stores.near_d <= 200).mean())
# master -> nearest store
min_d_master = np.full(len(EL), np.inf)
for i in range(0, len(EL), 500):
    d = hav(EL[i:i + 500, 0:1], EL[i:i + 500, 1:2], SL[:, 0][None, :], SL[:, 1][None, :])
    min_d_master[i:i + 500] = d.min(1)
eg['min_d'] = min_d_master
M['master_within_300m'] = int((eg.min_d <= 300).sum())
M['master_beyond_1km'] = int((eg.min_d > 1000).sum()); M['master_beyond_1km_pct'] = round(100 * M['master_beyond_1km'] / len(eg))
M['coverage_pct'] = round(100 * (eg.min_d <= 1000).mean())
M['next_areas'] = eg[eg.min_d > 1000].area.value_counts().head(12).to_dict()
# name matching: >=80% similarity within 300 m
GEN = re.compile(r"\b(tuck ?shop|tuckshop|shop|spaza|store|supermarket|general dealer|trading|cash and carry|the|and|&|cc|pty|ltd|enterprise|enterprises|wholesale|wholesalers|mini market|minimarket|market)\b")
def norm(s): return re.sub(r'\s+', ' ', GEN.sub(' ', re.sub(r'[^a-z0-9 ]', ' ', str(s).lower()))).strip()
eg['nn'] = eg.customer_name.map(norm)
matched = np.zeros(len(stores), dtype=bool)
for i in range(0, len(SL), 200):
    d = hav(SL[i:i + 200, 0:1], SL[i:i + 200, 1:2], EL[:, 0][None, :], EL[:, 1][None, :])
    for j in range(d.shape[0]):
        sn = norm(stores.store.iloc[i + j])
        if not sn: continue
        cands = np.where(d[j] <= 300)[0]
        for c in cands:
            if fuzz.token_set_ratio(sn, eg.nn.iloc[c]) >= 80: matched[i + j] = True; break
stores['matched'] = matched
M['stores_geo'] = int(len(stores)); M['stores_matched'] = int(matched.sum()); M['stores_matched_pct'] = round(100 * matched.mean())
M['stores_new'] = int((~matched).sum())
# hubs
SOWETO = {'Soweto', 'Jabavu', 'Mofolo', 'Orlando', 'Moletsane', 'Zola', 'Diepkloof', 'Dobsonville', 'Meadowlands', 'Pimville', 'Protea Glen', 'Protea', 'Chiawelo', 'Naledi', 'Emdeni', 'Zondi', 'Dube', 'Klipspruit', 'Senaoane', 'Phiri', 'Mapetla', 'Tladi', 'Molapo', 'Moroka', 'Jabulani', 'Dlamini', 'Noordgesig', 'Braamfischerville', 'Doornkop', 'Orlando East', 'Orlando West', 'Mofolo North', 'Mofolo South', 'Mofolo Central', 'Diepkloof Zone 1', 'Protea North', 'Protea South', 'Power Park', 'Slovoville', 'Tshepisong', 'Thulani', 'Snake Park', 'Bram Fischerville'}
HUB_C = {'Tembisa': (-26.00, 28.22), 'Alexandra + Setswetla': (-26.10, 28.09), 'Greater Soweto': (-26.26, 27.88), 'Midrand / Ivory Park': (-25.99, 28.13), 'Johannesburg CBD': (-26.20, 28.045)}
def hub(area, lat, lon):
    if area in ('Tembisa',) or area.endswith(' Section') or area in ('Kaalfontein', 'Ecaleni', 'Phomolong'): return 'Tembisa'
    if area in ('Alexandra', 'Setswetla', 'Alexandra Township', 'Kew'): return 'Alexandra + Setswetla'
    if area in SOWETO or 'Soweto' in area or 'Orlando' in area or 'Diepkloof' in area or 'Protea' in area or 'Mofolo' in area or area in ('Kliptown', 'Devland', 'Dlamini', 'Freedom Park', 'Phumula'): return 'Greater Soweto'
    if area in ('Midrand / Ivory Park',): return 'Midrand / Ivory Park'
    if area in ('Johannesburg', 'Johannesburg Cbd', 'Jhb', 'Braamfontein', 'Hillbrow', 'Berea', 'Doornfontein', 'Jeppestown', 'Yeoville'): return 'Johannesburg CBD'
    best = min(HUB_C, key=lambda h: hav(lat, lon, *HUB_C[h]))
    return best if hav(lat, lon, *HUB_C[best]) <= 5000 else 'Other'
stores['hub'] = [hub(ar, la, lo) for ar, la, lo in zip(stores.area, stores.slat, stores.slon)]
# master customers per hub: nearest audited store's hub when within 1 km
near_store = np.empty(len(EL), dtype=int)
for i in range(0, len(EL), 500):
    d = hav(EL[i:i + 500, 0:1], EL[i:i + 500, 1:2], SL[:, 0][None, :], SL[:, 1][None, :])
    near_store[i:i + 500] = d.argmin(1)
eg['near_store_hub'] = stores.hub.to_numpy()[near_store]
eg['hub'] = np.where(eg.min_d <= 1000, eg.near_store_hub, 'Beyond footprint')
eg['within300'] = eg.min_d <= 300
M['hubs'] = stores.hub.value_counts().to_dict()
hd = stores.groupby('hub').agg(stores=('customer_id', 'size'), matched=('matched', 'sum'))
hd['new'] = hd.stores - hd.matched
hd['master_within_1km'] = eg.groupby('hub').size().reindex(hd.index).fillna(0).astype(int)
hd['master_within_300m'] = eg[eg.within300].groupby('hub').size().reindex(hd.index).fillna(0).astype(int)
M['hub_detail'] = hd.to_dict('index')
M['master_by_hub'] = eg.hub.value_counts().to_dict()
M['area_counts_top'] = stores.area.value_counts().head(30).to_dict()
M['area_other_list'] = stores[stores.hub == 'Other'].area.value_counts().head(20).to_dict()

# ---------- area lens ----------
a = a.merge(stores[['customer_id', 'area', 'hub', 'matched']], on='customer_id', how='left')
al = a.groupby('area').agg(stores=('visit_id', 'size'), range_pct=('depth', lambda s: round(100 * s.sum() / (17 * len(s)), 1)), full_pct=('depth', lambda s: round(100 * (s == 17).mean())), rep_pct=('rep', lambda s: round(100 * s.mean()))).sort_values('stores', ascending=False)
M['area_lens'] = al[al.stores >= 40].reset_index().to_dict('records')
tm = a[a.area.isin(['Tembisa', 'Midrand / Ivory Park'])]
M['tm_stores'] = int(len(tm)); M['tm_rep_pct'] = round(100 * tm.rep.mean()); M['tm_gaps'] = int((17 * len(tm) - tm.depth.sum()))
M['tm_gaps_pct'] = round(100 * M['tm_gaps'] / M['gaps']); M['tm_stores_pct'] = round(100 * len(tm) / len(a))
M['tm_full_pct'] = round(100 * (tm.depth == 17).mean()); M['other_full_pct'] = round(100 * (a[~a.area.isin(['Tembisa', 'Midrand / Ivory Park'])].depth == 17).mean())
M['tm_agents_lowrep'] = int((tm.groupby('agent_id').rep.mean() < 0.1).sum())

# ---------- route to market ----------
M['deliveries_pct'] = round(100 * (a.deliveries.str.lower() == 'yes').mean())
selfst = a[a.deliveries.str.lower() != 'yes']
M['self_stockers'] = int(len(selfst)); M['wholesaler_n'] = int(selfst.delivery_method.str.contains('whole', case=False).sum())
M['wholesaler_pct'] = round(100 * M['wholesaler_n'] / max(1, len(selfst)))
BR = {'Halls': r'halls?\b', 'Coca-Cola': r'coke|coca|cola', 'Albany': r'albany', 'Bread': r'bread', 'Clover': r'clover', 'Sasko': r'sasko', 'Stimorol': r'stimorol|stimurol|stimoral', 'Pepsi': r'pepsi', 'Chappies': r'chappies|chapies|chappy', 'Oreo': r'oreo', 'Cadbury': r'cadbury|cdm|lunch ?bar|caramilk'}
dp = a.delivered_products.str.lower()
M['brand_mentions'] = {b: int(dp.str.contains(p, regex=True).sum()) for b, p in BR.items()}

# ---------- challenges ----------
def chal(t):
    t = t.lower()
    if re.search(r'compet|coke|simba|clover|too many shops|other shops', t): return 'Competition'
    if re.search(r'space|room', t): return 'Shelf space'
    if re.search(r'suppl|deliver|stock', t): return 'Supply / delivery'
    if re.search(r'cash|money|capital|finance|fund', t): return 'Cash flow'
    if re.search(r'pric|expensive|cost', t): return 'Pricing'
    if re.search(r'customer|traffic|slow|sales|quiet|demand', t): return 'Low foot traffic'
    if re.search(r'electric|power|load ?shed', t): return 'Electricity'
    if re.search(r'none|no challenge|nothing|n/?a|^no$|no problem|^$', t): return 'No major challenge'
    return 'Other'
a['chal'] = a.biggest_challenge.map(chal)
cc = a.chal.value_counts(); M['challenges'] = cc.to_dict(); M['no_challenge_pct'] = round(100 * cc.get('No major challenge', 0) / len(a))
M['chal_other_sample'] = a[a.chal == 'Other'].biggest_challenge.value_counts().head(15).to_dict()

# ---------- shelf visibility ----------
sp = T['shelf_photo_analysis']; sp = sp[sp.status == 'complete'].dropna(subset=['visibility_score'])
sp = sp[sp.visit_id.isin(v.id)]
M['vis_photos'] = int(len(sp)); M['vis_avg'] = round(sp.visibility_score.mean(), 2)
M['vis_7plus_pct'] = round(100 * (sp.visibility_score >= 7).mean()); M['vis_le4_pct'] = round(100 * (sp.visibility_score <= 4).mean())
M['vis_hist'] = {int(k): int(sp.visibility_score.value_counts().get(k, 0)) for k in range(1, 11)}
obs = sp.obstructions.fillna('[]').map(lambda s: json.loads(s) if s.startswith('[') else [])
M['vis_obstructed_pct'] = round(100 * obs.map(len).gt(0).mean())
def obs_cat(items):
    cats = set()
    for o in items:
        o = o.lower()
        if re.search(r'grate|grill|bar|mesh|cage|wire|fence|window|glass|burglar', o): cats.add('Security grilles')
        elif re.search(r'sign|poster|promo|price|label|tag|banner|sticker|advert', o): cats.add('Promo signage')
        elif re.search(r'product|item|stock|pack|bottle|box|can|snack|goods|chip|sweet|bag', o): cats.add('Other products')
        else: cats.add('Stands & clutter')
    return cats
oc = collections.Counter(c for items in obs for c in obs_cat(items))
M['vis_obstructions'] = dict(oc)
M['shelf_level'] = sp.shelf_level.value_counts().to_dict()
sp2 = sp.merge(v[['id', 'customer_id']], left_on='visit_id', right_on='id').merge(stores[['customer_id', 'hub']], on='customer_id', how='left')
M['vis_by_hub'] = sp2.groupby('hub').agg(photos=('id_x', 'size'), avg=('visibility_score', 'mean'), p7=('visibility_score', lambda s: 100 * (s >= 7).mean())).round(2).to_dict('index')
M['facings_avg'] = round(sp.estimated_facings.mean(), 1); M['facings_hist'] = {int(k): int(n) for k, n in sp.estimated_facings.dropna().astype(int).clip(upper=8).value_counts().sort_index().items()}

# ---------- field execution ----------
ad = v.groupby(['agent_id', 'visit_date']).size()
ad = ad[ad > 2]
per_agent = ad.groupby('agent_id').mean().sort_values(ascending=False).round(1)
M['agent_rates'] = per_agent.tolist(); M['agents_rated'] = len(per_agent)
M['stores_per_agent_day'] = round(ad.mean(), 1); M['median_rate'] = round(per_agent.median(), 1)
M['median_dur'] = round(v.dur.median(), 1); M['under10_pct'] = round(100 * (v.dur < 10).mean())
M['peak_9_12_pct'] = round(100 * v.ci.dt.hour.between(9, 11).mean())
below = per_agent[per_agent < per_agent.median()]
M['below_median_agents'] = int(len(below)); M['headroom'] = int(round((per_agent.median() - below).sum()))
M['top_quartile_cut'] = round(per_agent.quantile(0.75), 1)
M['by_day'] = {k: int(n) for k, n in by_day.items() if n > 2}
M['peak_day'] = by_day.idxmax(); M['peak_n'] = int(by_day.max()); M['peak_agents'] = int(v[v.visit_date == by_day.idxmax()].agent_id.nunique())
wk = v.copy(); wk['week'] = pd.to_datetime(wk.visit_date).dt.to_period('W').astype(str)
wk = wk[wk.visit_date.map(by_day) > 2]
wd = wk.groupby('week').agg(n=('id', 'size'), days=('visit_date', 'nunique'))
M['weeks'] = {k: dict(n=int(r_.n), days=int(r_.days), per_day=round(r_.n / r_.days)) for k, r_ in wd.iterrows()}
M['avg_per_day'] = round(M['store_audits'] / M['field_days'])
M['by_day'] = {k: int(n) for k, n in by_day.items() if n >= 10}
M['weak_gps'] = int(len(T['anomaly_flags'])); M['weak_gps_pct'] = round(100 * M['weak_gps'] / M['store_audits'])

# ---------- opportunity numbers ----------
M['oreo_missing'] = M['sku_missing'].get('Oreo Original LUP 41.57g'); M['oreo_never'] = M['never_listed_top'].get('Oreo Original LUP 41.57g'); M['oreo_oos'] = M['oos_top'].get('Oreo Original LUP 41.57g')
top3 = ['Oreo Original LUP 41.57g', 'CDM Original 12g LUP', 'Eclairs Original 230g']
M['top3_missing'] = {s: M['sku_missing'][s] for s in top3}; M['top3_sum'] = sum(M['top3_missing'].values()); M['top3_pct'] = round(100 * M['top3_sum'] / M['gaps'])
M['fixable_pct'] = round(M['reasons_pct'].get('Not listed / never ranged', 0) + M['reasons_pct'].get('Out of stock', 0))
M['reject_pct'] = round(M['reasons_pct'].get('Slow moving / low demand', 0) + M['reasons_pct'].get('Price / cash flow', 0))
M['stimorol_short'] = int(round(np.mean([M['sku_missing'][s] for s in M['sku_missing'] if s.startswith('Stimorol')])))

# ---------- brand level (from the stock check) ----------
BRAND = {'Halls': 'Halls', 'Chappies': 'Chappies', 'Clorets': 'Clorets', 'Stimorol': 'Stimorol', 'Cadbury minis (PS, Lunch Bar)': ('PS ', 'Lunch Bar'), 'CDM 12g LUP': 'CDM', 'Eclairs': 'Eclairs', 'Oreo': 'Oreo'}
sk['brand'] = sk.sku.map(lambda s: next((b for b, p in BRAND.items() if (s.startswith(p) if isinstance(p, str) else any(s.startswith(q) for q in p))), 'Other'))
bs = sk.groupby(['visit_id', 'brand']).instock.agg(['sum', 'size']).reset_index()
M['brand_any_pct'] = bs.assign(any=bs['sum'] > 0).groupby('brand')['any'].mean().mul(100).round().to_dict()
M['brand_all_pct'] = bs.assign(all=bs['sum'] == bs['size']).groupby('brand')['all'].mean().mul(100).round().to_dict()
M['last10_per_day'] = round(sum(wd.n.iloc[-2:]) / sum(wd.days.iloc[-2:]))
M['full_days'] = int((by_day >= 10).sum()); M['avg_full_day'] = round(by_day[by_day >= 10].sum() / M['full_days'])
rs = M['rep_sku']; M['rep_delta'] = {k: int(v_['rep'] - v_['norep']) for k, v_ in rs.items()}
json.dump(M, open(f'{S}/metrics.json', 'w'), indent=1, default=str)
stores.to_csv(f'{S}/stores_geo.csv', index=False); eg.to_csv(f'{S}/master_geo.csv', index=False); a.drop(columns=['products']).to_csv(f'{S}/audits.csv', index=False)
sp2.to_csv(f'{S}/shelf.csv', index=False)
for k, val in M.items():
    print(k, '=', val if not isinstance(val, (dict, list)) or len(str(val)) < 400 else str(val)[:400] + '…')
