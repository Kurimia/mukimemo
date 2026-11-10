/* 保存（IndexedDB）と計算まわり */

const DB_NAME = 'bodyapp';
let _db = null;

function idbOpen() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function idbReq(store, mode, fn) {
  return idbOpen().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const r = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(r && 'result' in r ? r.result : undefined);
    tx.onerror = () => reject(tx.error);
  }));
}

const kvGet = (k) => idbReq('kv', 'readonly', (s) => s.get(k));
const kvSet = (k, v) => idbReq('kv', 'readwrite', (s) => s.put(v, k));
const photoAll = () => idbReq('photos', 'readonly', (s) => s.getAll());
const photoAdd = (rec) => idbReq('photos', 'readwrite', (s) => s.add(rec));
const photoDel = (id) => idbReq('photos', 'readwrite', (s) => s.delete(id));
const photoClear = () => idbReq('photos', 'readwrite', (s) => s.clear());

/* ---------- 日付 ---------- */
function dkey(d) {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
const today = () => dkey(new Date());
function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return dkey(new Date(y, m - 1, d + n));
}
function daysBetween(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000);
}
const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
function mdLabel(key) {
  const [y, m, d] = key.split('-').map(Number);
  return { md: `${m}/${d}`, wd: WEEK[new Date(y, m - 1, d).getDay()] };
}

/* ---------- 状態 ---------- */
function defaultState() {
  return {
    v: 1,
    settings: { phase: 'bulk', sex: 'male', height: 164, age: 27, activity: 1.375, baseWeight: 55, rest: 90, theme: 'auto' },
    foods: DEFAULT_FOODS.map((m) => ({ ...m })),
    sets: DEFAULT_SETS.map((s) => ({ ...s, items: s.items.map((i) => ({ ...i })) })),
    meals: {},      // { 'YYYY-MM-DD': { breakfast: [item], ... } }
    weights: {},    // { 'YYYY-MM-DD': 55.8 }
    workouts: [],   // [{ id, date, menuId, exercises: [{ exId, weight, repMin, repMax, sets:[{reps, done}] }], pbs: [exId] }]
    exState: {},    // { exId: { weight, low, confirmed, best, bestLabel, bestDate } }
    nextMenu: 0,
    active: null,   // 実施中のトレーニング
  };
}

let S = defaultState();
// 記録したらすぐ保存（同じ瞬間の複数回の保存は1回にまとめる）。
// 以前は少し待ってから保存していたため、記録直後にアプリを閉じると消えることがあった
let _savePending = false;
function save() {
  if (_savePending) return;
  _savePending = true;
  Promise.resolve().then(() => {
    _savePending = false;
    kvSet('state', S).catch((e) => console.error(e));
  });
}
async function loadState() {
  const saved = await kvGet('state');
  if (saved && saved.v) {
    const d = defaultState();
    S = { ...d, ...saved, settings: { ...d.settings, ...(saved.settings || {}) } };
    // 旧版（マイ食事が1段だけ）からの移行：自分で足した分を単品として残す
    if (!saved.foods) {
      S.foods = d.foods;
      S.sets = d.sets;
      (saved.myMeals || []).filter((m) => /^m_\d+$/.test(m.id)).forEach((m) => {
        S.foods.push({ id: 'f_' + m.id.slice(2), name: m.name, kcal: m.kcal, p: m.p, f: m.f, c: m.c });
      });
    }
    delete S.myMeals;
    // セットの分類（朝・昼・間食・夜・夜の間食）がない古いデータには、初期セットの分類を入れる
    S.sets.forEach((s) => { if (s.slot === undefined) { const d = DEFAULT_SETS.find((x) => x.id === s.id); s.slot = d ? d.slot : null; } });
  }
}

/* ---------- マイ食事（単品とセット） ---------- */
const foodById = (id) => S.foods.find((x) => x.id === id);
const setById = (id) => S.sets.find((x) => x.id === id);
function setTotals(set) {
  return set.items.reduce((a, it) => {
    const f = foodById(it.foodId);
    if (!f) return a;
    return { kcal: a.kcal + f.kcal * it.qty, p: a.p + f.p * it.qty, f: a.f + f.f * it.qty, c: a.c + f.c * it.qty };
  }, { kcal: 0, p: 0, f: 0, c: 0 });
}
function setDetail(set) {
  return set.items.map((it) => { const f = foodById(it.foodId); return f ? f.name + (it.qty !== 1 ? ` ×${fmtKg(it.qty)}` : '') : ''; }).filter(Boolean).join('・');
}
// 選択キー 'set:ID' / 'food:ID' → 記録用のデータ
function entryFor(key) {
  const [type, id] = key.split(':');
  if (type === 'set') {
    const s = setById(id);
    if (!s) return null;
    const t = setTotals(s);
    return { name: s.name, detail: setDetail(s), kcal: +t.kcal.toFixed(1), p: +t.p.toFixed(1), f: +t.f.toFixed(1), c: +t.c.toFixed(1), from: key };
  }
  const f = foodById(id);
  return f ? { name: f.name, kcal: f.kcal, p: f.p, f: f.f, c: f.c, from: key } : null;
}

/* ---------- 連続日数 ---------- */
function streakOf(has) {
  let n = 0, k = today();
  while (has(k) && n < 3650) { n++; k = addDays(k, -1); }
  return n;
}
const hasMeal = (k) => SLOTS.some((sl) => slotItems(k, sl.id).length);
const mealStreak = () => streakOf(hasMeal);
const weightStreak = () => streakOf((k) => S.weights[k] != null);

/* ---------- 体重 ---------- */
function weightList() {
  return Object.keys(S.weights).sort().map((k) => ({ date: k, kg: S.weights[k] }));
}
function latestWeight() {
  const l = weightList();
  return l.length ? l[l.length - 1] : null;
}
// endKey までの7日間の平均（記録がある日だけ）
function avgWeight(endKey, days = 7) {
  const vals = [];
  for (let i = 0; i < days; i++) {
    const k = addDays(endKey, -i);
    if (S.weights[k] != null) vals.push(S.weights[k]);
  }
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}
function weekAvgNow() {
  const l = latestWeight();
  return l ? avgWeight(l.date) : null;
}
// 4週間前の週平均との差（4週間＝ほぼ1か月）
function monthlyChange() {
  const l = latestWeight();
  if (!l) return null;
  const now = avgWeight(l.date);
  const before = avgWeight(addDays(l.date, -28));
  if (before == null) return null;
  return now - before;
}
/* ---------- 期間と目標体重（増量・減量の目安） ---------- */
// ひと月あたりの目安：増量 +0.2〜0.8kg、減量 −0.3〜−1.5kg、維持 ±0.5kg（真ん中を目標の計算に使う）
const PACE = { bulk: [0.2, 0.8], cut: [-1.5, -0.3], maintain: [-0.5, 0.5] };
function weightAround(k) {
  const a = avgWeight(k);
  if (a != null) return a;
  const after = weightList().find((x) => x.date >= k);
  return after ? after.kg : S.settings.baseWeight;
}
function goal() {
  const st = S.settings;
  const first = weightList()[0];
  const start = st.goalStart || (first ? first.date : today());
  const end = st.goalEnd && st.goalEnd > start ? st.goalEnd : addDays(start, 90);
  const base = weightAround(start);
  const months = daysBetween(start, end) / 30.4;
  const [lo, hi] = PACE[st.phase] || PACE.maintain;
  const auto = +(base + ((lo + hi) / 2) * months).toFixed(1);
  const target = st.goalWeight != null ? st.goalWeight : auto;
  const now = Math.min(daysBetween(start, today()), daysBetween(start, end));
  const expect = base + (target - base) * Math.max(0, now) / Math.max(1, daysBetween(start, end));
  return { start, end, base, target, auto, custom: st.goalWeight != null, lo, hi, months, expect, left: daysBetween(today(), end) };
}

function calcWeight() {
  return weekAvgNow() || S.settings.baseWeight;
}

/* ---------- 目標カロリー（ユーザーのカロリー計算シートと同じ式） ---------- */
function targets() {
  const st = S.settings;
  const w = calcWeight();
  const bmr = st.sex === 'female'
    ? 9.247 * w + 3.098 * st.height - 4.33 * st.age + 447.593
    : 13.397 * w + 4.799 * st.height - 5.677 * st.age + 88.362;
  const tdee = bmr * st.activity;
  const ph = PHASES.find((x) => x.id === st.phase) || PHASES[0];
  const kcal = tdee + ph.delta;
  const p = w * ph.pPerKg;
  const f = (kcal * ph.fRatio) / 9;
  const c = (kcal - (p * 4 + f * 9)) / 4;
  return { kcal: Math.round(kcal), p: Math.round(p), f: Math.round(f), c: Math.round(c), weight: w, bmr: Math.round(bmr), tdee: Math.round(tdee) };
}

/* ---------- 食事 ---------- */
function dayMeals(key) {
  if (!S.meals[key]) S.meals[key] = {};
  return S.meals[key];
}
function slotItems(key, slot) {
  return (S.meals[key] && S.meals[key][slot]) || [];
}
function sumItems(items) {
  return items.reduce((a, it) => ({ kcal: a.kcal + it.kcal, p: a.p + it.p, f: a.f + it.f, c: a.c + it.c }), { kcal: 0, p: 0, f: 0, c: 0 });
}
function dayTotals(key) {
  const day = S.meals[key] || {};
  return sumItems(SLOTS.flatMap((s) => day[s.id] || []));
}
function prevSameSlot(key, slot) {
  for (let i = 1; i <= 7; i++) {
    const k = addDays(key, -i);
    const items = slotItems(k, slot);
    if (items.length) return { date: k, items };
  }
  return null;
}

/* ---------- トレーニング ---------- */
function incFor(kind) { return kind === 'dumbbell' ? 1 : 2.5; }
function exInfo(exId) { return EXERCISES[exId]; }
function exState(exId) {
  if (!S.exState[exId]) {
    const e = EXERCISES[exId];
    S.exState[exId] = { weight: e.kind === 'bodyweight' ? 0 : e.start, low: 0, confirmed: false, best: null, bestLabel: '', bestDate: null, prevWeight: null };
  }
  return S.exState[exId];
}
// 今の1巡（上半身A〜下半身Bを1回ずつ）でやったメニュー
function cycleDone() {
  if (!S.cycle) {
    // 初回：直近7日のトレーニングから作る
    const from = addDays(today(), -6);
    S.cycle = { done: [...new Set(S.workouts.filter((w) => w.date >= from).map((w) => w.menuId))] };
  }
  return S.cycle.done;
}
const cycleComplete = () => MENUS.every((m) => cycleDone().includes(m.id));
// 次にやるメニュー：今のメニューのあとで、まだやっていないもの
function nextUndone(fromIdx) {
  const done = cycleDone();
  for (let k = 1; k <= MENUS.length; k++) {
    const i = (fromIdx + k) % MENUS.length;
    if (!done.includes(MENUS[i].id)) return i;
  }
  return (fromIdx + 1) % MENUS.length;
}
function resetCycle() { S.cycle = { done: [] }; S.nextMenu = 0; save(); }
function currentMenu() { return MENUS[S.nextMenu % MENUS.length]; }

// メニューの各種目について「今日やる内容」
// 自分で並べ替えた順番（メニューごとに保存）
function menuItems(menu) {
  const ord = (S.menuOrder || {})[menu.id];
  if (!ord) return menu.items;
  const pos = (id) => { const i = ord.indexOf(id); return i < 0 ? 999 : i; };
  return menu.items.map((it, k) => [it, k]).sort((a, b) => pos(a[0][0]) - pos(b[0][0]) || a[1] - b[1]).map((x) => x[0]);
}
function saveMenuOrder(menuId, exIds) {
  if (!S.menuOrder) S.menuOrder = {};
  S.menuOrder[menuId] = exIds;
}
function planFor(menu) {
  return menuItems(menu).map(([exId, sets, repMin, repMax]) => {
    const st = exState(exId);
    return { exId, sets, repMin, repMax, weight: st.weight, diff: st.prevWeight != null ? +(st.weight - st.prevWeight).toFixed(2) : 0, confirmed: st.confirmed };
  });
}
function lastWorkout() { return S.workouts.length ? S.workouts[S.workouts.length - 1] : null; }

// セットごとの重量（古い記録はセットに重量がないので種目の重量）
function setW(ex, s) { return s.w != null ? s.w : ex.weight; }
// 古い形式の進行中データを、セットごとに重量・予定回数を持つ形にそろえる
function normalizeActive(a) {
  if (!a) return;
  a.exercises.forEach((ex) => {
    if (ex.planW == null) ex.planW = ex.weight;
    ex.sets.forEach((s) => { if (s.w == null) s.w = ex.weight; if (s.plan == null) s.plan = s.reps; });
  });
}
// 自重種目の計算用の体重（最新の体重 → なければ設定の体重）
function bodyKg() { const l = latestWeight(); return l ? l.kg : S.settings.baseWeight; }
function e1rm(w, r) { return w * (1 + r / 30); }
function bestOf(ex) {
  const done = ex.sets.filter((s) => s.done);
  if (!done.length) return null;
  const kind = EXERCISES[ex.exId].kind;
  if (kind === 'bodyweight') {
    // 体重＋加重（補助はマイナス）で比べる。補助を減らしても記録が伸びる
    let best = null;
    done.forEach((s) => {
      const w = setW(ex, s) || 0;
      const sc = e1rm(bodyKg() + w, s.reps);
      const lab = w ? (w < 0 ? `自重−${fmtKg(-w)}kg` : `自重+${fmtKg(w)}kg`) : '自重';
      if (!best || sc > best.score) best = { score: sc, label: `${lab} ×${s.reps}` };
    });
    return best;
  }
  let best = null;
  done.forEach((s) => {
    const w = setW(ex, s);
    const sc = e1rm(w, s.reps);
    if (!best || sc > best.score) best = { score: sc, label: `${fmtKg(w)}kg ×${s.reps}` };
  });
  return best;
}

// 自己ベストの値（以前の自重の記録は回数だけなので、体重込みにそろえて返す）
function bestScore(exId) {
  const st = exState(exId);
  if (st.best == null) return null;
  return EXERCISES[exId].kind === 'bodyweight' && !st.bwLoad ? e1rm(bodyKg(), st.best) : st.best;
}
// 今日のチャレンジ：自己ベストまでいちばん近い1種目を選び、更新できる回数を決める
function challengeFor(plan) {
  let pick = null;
  plan.forEach((p) => {
    const best = bestScore(p.exId);
    if (best == null) return;
    const kind = EXERCISES[p.exId].kind;
    const bw = kind === 'bodyweight';
    const load = (w) => (bw ? bodyKg() + (w || 0) : w);
    const base = p.repMax || exState(p.exId).lastReps || 8;
    const need = (w) => Math.max(1, Math.floor(30 * (best / load(w) - 1) + 1e-9) + 1);
    const tries = [p.weight];
    if (!bw) tries.push(+(p.weight + incFor(kind)).toFixed(2));
    tries.forEach((w, k) => {
      if (!(load(w) > 0)) return;
      const reps = Math.max(need(w), k === 0 ? base : 1);
      if (k === 1 && reps > base) return;
      if (reps - base > 4) return;
      const gap = Math.max(0, reps - base) + k;
      if (!pick || gap < pick.gap) pick = { exId: p.exId, w, reps, gap };
    });
  });
  return pick ? { exId: pick.exId, w: pick.w, reps: pick.reps } : null;
}
function startWorkout() {
  const menu = currentMenu();
  S.active = {
    menuId: menu.id,
    date: today(),
    startedAt: Date.now(),
    idx: 0,
    restEnd: null,
    exercises: planFor(menu).map((p) => ({
      exId: p.exId, weight: p.weight, planW: p.weight, repMin: p.repMin, repMax: p.repMax,
      sets: Array.from({ length: p.sets }, () => ({ w: p.weight, reps: p.repMax || p.repMin || 10, plan: p.repMax || p.repMin || 10, done: false })),
    })),
  };
  // 今日のチャレンジ（1セット目を自己ベスト更新の回数にする）
  const ch = challengeFor(planFor(menu));
  S.active.challenge = ch;
  // 自重種目は前回の回数を目安に
  S.active.exercises.forEach((ex) => {
    if (EXERCISES[ex.exId].kind === 'bodyweight') {
      const st = exState(ex.exId);
      const r = st.lastReps || 8;
      ex.sets.forEach((s) => { s.reps = r; s.plan = r; });
    }
    if (ch && ex.exId === ch.exId) { const s0 = ex.sets[0]; s0.w = ch.w; s0.reps = ch.reps; s0.chal = ch.reps; }
  });
  save();
}

// 終了時：記録を保存し、次回の重量を決める（ダブルプログレッション）
function finishWorkout() {
  const a = S.active;
  if (!a) return null;
  normalizeActive(a);
  const pbs = [];
  const exercises = a.exercises.filter((ex) => ex.sets.some((s) => s.done));
  exercises.forEach((ex) => {
    const info = EXERCISES[ex.exId];
    const st = exState(ex.exId);
    // 以前の自重の記録は「回数」で保存していたので、体重込みの値にそろえる
    if (info.kind === 'bodyweight' && st.best != null && !st.bwLoad) st.best = e1rm(bodyKg(), st.best);
    if (info.kind === 'bodyweight') st.bwLoad = true;
    const best = bestOf(ex);
    if (best) {
      if (st.best != null && best.score > st.best + 1e-6) pbs.push(ex.exId);
      if (st.best == null || best.score > st.best) { st.best = best.score; st.bestLabel = best.label; st.bestDate = a.date; }
    }
    const done = ex.sets.filter((s) => s.done);
    // 次回の基準は、やったセットの重量の平均（器具の刻みに丸める）
    // 例：57.5kg・57.5kg・50kg → 平均55kg。最後だけ軽くしても大きく下がらない
    const step = incFor(info.kind);
    const avg = done.reduce((a, s) => a + (setW(ex, s) || 0), 0) / done.length;
    ex.weight = +(Math.round(avg / step) * step).toFixed(2);
    st.lastReps = Math.max(...done.map((s) => s.reps));
    st.prevWeight = ex.weight;
    st.confirmed = true;
    if (info.kind === 'bodyweight') { st.weight = ex.weight || 0; return; }
    const allTop = ex.sets.every((s) => s.done && s.reps >= ex.repMax && setW(ex, s) >= ex.weight - 1e-6);
    const anyLow = done.some((s) => s.reps < ex.repMin && setW(ex, s) >= ex.weight - 1e-6);
    let next = ex.weight;
    if (allTop) { next = ex.weight + incFor(info.kind); st.low = 0; }
    else if (anyLow) {
      st.low = (st.low || 0) + 1;
      if (st.low >= 2) { next = Math.max(ex.weight - incFor(info.kind), incFor(info.kind)); st.low = 0; }
    } else { st.low = 0; }
    st.weight = +next.toFixed(2);
  });
  const complete = a.exercises.every((ex) => ex.sets.every((s) => s.done));
  const rec = { id: Date.now(), date: a.date, menuId: a.menuId, minutes: Math.round((Date.now() - a.startedAt) / 60000), exercises, pbs, complete };
  if (exercises.length) {
    S.workouts.push(rec);
    // 4つ全部終わったあとにまたやった場合は、新しい1巡として数えはじめる
    if (cycleComplete()) S.cycle.done = [];
    if (!S.cycle.done.includes(a.menuId)) S.cycle.done.push(a.menuId);
    S.nextMenu = nextUndone(MENUS.findIndex((m) => m.id === a.menuId));
  }
  S.active = null;
  save();
  return exercises.length ? rec : null;
}

/* ---------- 種目の推移（週ごと） ---------- */
function weekStart(key) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const back = (dt.getDay() + 6) % 7; // 月曜はじまり
  return dkey(new Date(y, m - 1, d - back));
}
function exSessions(exId) {
  return S.workouts.flatMap((w) => w.exercises.filter((e) => e.exId === exId).map((e) => ({
    date: w.date, weight: e.weight, reps: e.sets.filter((s) => s.done).map((s) => s.reps),
  }))).filter((s) => s.reps.length);
}
// 直近 weeks 週ぶん。週ごとに「いちばん重い重量」と「その重量での最多回数」
function exWeekly(exId, weeks = 12) {
  const sess = exSessions(exId);
  const end = weekStart(today());
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = addDays(end, -7 * i);
    const inWeek = sess.filter((s) => weekStart(s.date) === ws);
    if (!inWeek.length) { out.push({ ws, weight: null, reps: null }); continue; }
    const top = Math.max(...inWeek.map((s) => s.weight));
    const reps = Math.max(...inWeek.filter((s) => s.weight === top).flatMap((s) => s.reps));
    out.push({ ws, weight: top, reps });
  }
  return out;
}

function fmtKg(n) {
  if (n == null) return '';
  return Number.isInteger(n) ? String(n) : String(+n.toFixed(2));
}
function fmtNum(n) { return Math.round(n).toLocaleString('ja-JP'); }
function fmt1(n) { return (Math.round(n * 10) / 10).toFixed(1); }
