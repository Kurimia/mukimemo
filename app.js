/* 画面と操作 */

const U = {
  tab: 'meal',
  page: null,          // mealInput / quickAdd / workout / done / photos / settings / myMeals / editSet / editFood
  date: today(),
  slot: null,
  sel: {},             // マイ食事の選択 { id: 個数 }
  quick: { text: '', kcal: '', p: '', f: '', c: '', save: false },
  sheet: null,         // 回数の調整 { i, reps, weight }
  ask: null,           // Claudeに聞く { who, text, title, desc }
  toast: null,
  doneRec: null,
  weightDraft: null,
  pose: 'front',
  photoSel: null,
  editSet: null,
  editFood: null,
  picker: false,
  said: {},            // 吹き出しの一時メッセージ
  back: null,
};
let PHOTOS = [];
let _toastTimer = null;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ロボット表示のときは、通知の文もていねいな言い方に
const ROBOT_TOAST = {
  '食べたものを入力してね': '食べたものを入力してください', '数字が見つからなかったよ': '数字が見つかりませんでした',
  '貼り付けできなかったので、手で入力してね': '貼り付けできませんでした。手で入力してください', 'kcalを入力してね': 'kcalを入力してください',
  '相談文もコピーしたよ': '相談文もコピーしました', '写真はClaudeで添付してね': '写真はClaudeで添付してください',
  '名前を入力してね': '名前を入力してください', '単品を1つ以上入れてね': '単品を1つ以上入れてください', '保存したよ': '保存しました',
  '書き出したよ': '書き出しました', '保存したよ（セットはそのまま）': '保存しました（セットはそのまま）',
  'バックアップから戻したよ': 'バックアップから戻しました', 'このファイルは読み込めなかったよ': 'このファイルは読み込めませんでした',
  '変更したよ': '変更しました', '削除したよ': '削除しました',
};
function toast(msg) {
  U.toast = isRobot() && ROBOT_TOAST[msg] ? ROBOT_TOAST[msg] : msg;
  render();
  clearTimeout(_toastTimer);
  // 消すときは通知だけを取り除く（画面全体を描き直すと、入力中の文字入力が途切れるため）
  _toastTimer = setTimeout(() => { U.toast = null; const el = document.querySelector('.toast'); if (el) el.remove(); }, U.toast.length > 16 ? 3600 : 2200);
}

/* ================= 描画 ================= */
function pageTab() {
  if (['workout', 'done'].includes(U.page)) return 'train';
  if (['photos', 'settings', 'progress'].includes(U.page)) return 'record';
  return 'meal';
}

let _lastView = '';
function focusKey() {
  const el = document.activeElement;
  if (!el || !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return null;
  const k = ['q', 'em', 'es', 'set', 'ed'].find((x) => el.dataset[x] != null);
  if (!k) return null;
  let sel = null;
  try { sel = [el.selectionStart, el.selectionEnd]; } catch (e) { /* 数値入力などは取れない */ }
  return { sel: `[data-${k}="${el.dataset[k]}"]`, range: sel };
}
let _rendering = false, _renderAgain = false;
function render() {
  // 描き直しの途中で入力欄が外れて（blur）もう一度 render が呼ばれた場合は、終わってからやり直す
  if (_rendering) { _renderAgain = true; return; }
  _rendering = true;
  const fk = focusKey();
  try { renderInner(); } finally {
    _rendering = false;
    if (_renderAgain) { _renderAgain = false; setTimeout(render, 0); }
    if (fk) {
      const el = document.querySelector(fk.sel);
      if (el && document.activeElement !== el) {
        el.focus({ preventScroll: true });
        try { if (fk.range && fk.range[0] != null) el.setSelectionRange(fk.range[0], fk.range[1]); } catch (e) { /* なくてOK */ }
      }
    }
  }
}
function renderInner() {
  applyCharMode();
  const view = `${U.page || ''}|${U.tab}|${U.clear ? 'clear' + U.clear.idx : ''}|${U.chal ? 'chal' : ''}|${U.fx && !U.fx.small ? 'fx' : ''}|${S.active ? S.active.idx : ''}`;
  if (view !== _lastView) { _lastView = view; newScene(); }
  const root = document.getElementById('app');
  const pageEl = root.querySelector('.page');
  const keep = pageEl ? pageEl.scrollTop : 0;
  const theme = S.settings.theme;
  if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = theme;
  document.body.dataset.tab = U.page ? pageTab() : U.tab;
  let h = '';
  if (!U.page) h += tabView() + navView();
  else h += pageView();
  if (U.sheet) h += sheetView();
  if (U.editItem) h += editItemView();
  if (U.ask) h += askView();
  if (U.linkAsk) h += linkAskView();
  if (U.fx) h += fxPopView();
  if (U.title) h += titleView();
  if (U.toast) h += `<div class="toast" role="status">${phrase(U.toast)}</div>`;
  root.innerHTML = h;
  const np = root.querySelector('.page');
  if (np && pageEl && np.dataset.p === pageEl.dataset.p) np.scrollTop = keep;
  syncChrome();
}
// 画面上部（時計・電池の表示）の色を、いま見えている画面に合わせる
const TITLE_TOP = '#FC6CBA'; // トップ画面の絵のいちばん上の色
function syncChrome() {
  const c = U.title ? TITLE_TOP : (getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#FFFFFF');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = c;
  document.documentElement.style.backgroundColor = U.title ? TITLE_TOP : '';
}

/* ---------- 記録したときの演出（連続日数ボーナス：1週間で7段階） ---------- */
let _fxTimer = null;
function celebrate(kind, first) {
  if (first) {
    const n = kind === 'meal' ? mealStreak() : weightStreak();
    const lvl = ((n - 1) % 7) + 1;
    U.fx = { kind, n, lvl, line: pick(ML['streak' + lvl] || ML.onRecord) };
    if (navigator.vibrate) navigator.vibrate(lvl >= 7 ? [120, 60, 120, 60, 300] : lvl >= 5 ? [80, 50, 80] : 40);
  } else {
    U.fx = { kind, small: true };
  }
  clearTimeout(_fxTimer);
  _fxTimer = setTimeout(() => { U.fx = null; const el = document.querySelector('.fxpop'); if (el) el.remove(); }, first ? 2400 + U.fx.lvl * 380 : 1300);
}
function fxPopView() {
  const f = U.fx;
  if (f.small) {
    const fx = f.played ? '' : fxLayer({ burst: 24, ring: 1, y: '42%', seed: 5 });
    f.played = true;
    return `<div class="fxpop small" aria-hidden="true">${fx}</div>`;
  }
  const L = f.lvl;
  const week = Math.floor((f.n - 1) / 7) + 1;
  const fx = f.played ? '' : fxLayer({
    fall: [0, 0, 10, 20, 32, 48, 90][L - 1], burst: [14, 20, 28, 38, 50, 66, 100][L - 1],
    ring: [1, 1, 1, 2, 2, 2, 3][L - 1], rays: L >= 4, flash: L >= 5, y: '40%', seed: L, fallRepeat: L === 7 ? 3 : 1,
  });
  const shake = f.played ? '' : ['', '', '', '', ' shake-s', ' shake-m', ' shake-l'][L - 1];
  f.played = true;
  const title = L === 7 ? (week > 1 ? `${week}週連続！！` : '1週間連続！！') : f.n === 1 ? '記録スタート！' : `${f.n}日連続！`;
  const sub = `${f.kind === 'meal' ? '食事' : '体重'}の記録${week > 1 && L < 7 ? `　${week}週目` : ''}`;
  const dots = Array.from({ length: 7 }, (_, i) => `<span class="${i < L ? 'on' : ''}${i === L - 1 ? ' now' : ''}">${i === 6 ? IC.trophy(12) : ''}</span>`).join('');
  // 顔まわりを丸く切り抜いて表示（全身だと小さく見えるため）。ポーズごとに顔の位置が違う
  const src = isRobot() ? '' : charSrc('meal', f.line);
  const facePos = /meal2-/.test(src) ? '60% 5.6%' : '50% 0.7%';
  const fig = isRobot() ? `<span class="sp-fig bot">${robotSVG('meal')}</span>` : `<span class="sp-face" style="background-image:url(${src});background-position:${facePos}" aria-hidden="true"></span>`;
  return `<div class="fxpop lv${L}" data-act="closeFx" role="status" aria-label="${sub} ${title}">
    ${fx}
    <div class="sp-card${shake}">
      <p class="sp-sub">${sub}</p>
      <h2 class="sp-title">${title}</h2>
      <div class="sp-dots">${dots}</div>
      <div class="sp-say">${fig}<p>${phrase(f.line)}</p></div>
    </div>
  </div>`;
}

function tabView() {
  if (U.tab === 'train') return trainView();
  if (U.tab === 'record') return recordView();
  return mealView();
}

function navView() {
  const it = (tab, label, icon) => `<a href="#" data-act="tab" data-tab="${tab}" ${U.tab === tab ? 'aria-current="page"' : ''}><span>${IC[icon]()}</span>${label}</a>`;
  return `<nav class="nav" aria-label="メイン">${it('meal', '食事', 'navMeal')}${it('train', 'トレーニング', 'navTrain')}${it('record', '記録', 'navRecord')}</nav>`;
}

// キャラの見た目：女の子の画像 or シンプルなロボット
const charName = (who) => (isRobot() ? CHARACTERS[who].robotName : CHARACTERS[who].name);
const persona = (who) => (isRobot() ? CHARACTERS[who].robotPersona : CHARACTERS[who].persona);
// セリフの種類 → 表情。配列はその中からランダム
const EXPR = {
  meal: {
    onRecord: 'kyun', praise: ['kyun', 'laugh'], nutrition: 'smile', tease: 'grin', ijiwaru: 'grin',
    weighSaved: 'smile', weighDown: 'laugh', weighUp: 'confused', weighPrompt: 'normal',
    daily: ['normal', 'smile'], morning: ['smile', 'laugh'], noon: ['smile', 'laugh'], night: ['smile', 'normal'],
    comeback: 'surprise', common: ['normal', 'smile'],
    dereTalk1: 'kyun', dereTalk2: 'kyunkyun',
    streak1: 'kyun', streak2: 'kyun', streak3: 'kyun', streak4: ['kyun', 'laugh'], streak5: ['kyun', 'laugh'], streak6: ['kyun', 'laugh'], streak7: 'kyunkyun',
  },
  trainer: {
    menu: 'normal', preStart: 'grin', cheer: 'laugh', effort: 'kyun', muscleDere: 'love', restStart: 'normal',
    restChat: ['normal', 'grin'], restEnd: 'grin', complete: 'laugh', incomplete: 'normal', pr: 'kyunkyun', heavy: 'grin',
    plateau: 'normal', daily: 'normal', cheeky: 'grin', morning: 'laugh', noon: 'laugh', night: ['laugh', 'normal'],
    comeback: 'surprise', growth: 'kyun', hideDere: 'love', respect: 'love',
    clearLow: 'normal', clearNormal: 'laugh', clearHigh: 'kyun', clearFinal: 'kyunkyun', clearFinalHigh: 'kyunkyun', clearFinalLow: 'laugh',
    chalStart: 'grin', chalWin: 'kyunkyun', chalLose: 'normal', weekDone: 'kyunkyun',
    dereTalk1: 'kyun', dereTalk2: 'kyunkyun',
  },
};
const EXPR_DEFAULT = { meal: 'smile', trainer: 'normal' };
// 持っていない表情のときの代わり
const EXPR_FALLBACK = { kyunkyun: 'kyun', kyun: 'laugh', love: 'kyun', confused: 'surprise', grin: 'laugh', laugh: 'smile', smile: 'normal', surprise: 'normal' };
const EXPR_ALT = { normal: ['normal', 'normal2'], grin: ['grin', 'grin2'] };
// セリフ → 種類 の早見表（女の子表示のセリフから作る）
const LINE_KEY = { meal: new Map(), trainer: new Map() };
[['meal', MEAL_LINES], ['trainer', TRAINER_LINES]].forEach(([who, set]) => {
  Object.entries(set).forEach(([k, arr]) => { if (Array.isArray(arr)) arr.forEach((l) => { if (!LINE_KEY[who].has(l)) LINE_KEY[who].set(l, k); }); });
});
// 驚いた感じで始まるセリフは「驚き」の表情に
const SURPRISE_RE = /^(えっ|え、|え！|うそ|ちょ、|まあ！|わっ|あら、|ええ)/;
function exprFor(who, line) {
  if (!line) return EXPR_DEFAULT[who];
  return cached(`expr|${who}|${line}`, () => {
    const k = LINE_KEY[who].get(line);
    if (k && k.startsWith('dereTalk')) return EXPR[who][k];
    if (SURPRISE_RE.test(line)) return 'surprise';
    const e = (k && EXPR[who][k]) || EXPR_DEFAULT[who];
    return Array.isArray(e) ? pick(e) : e;
  });
}
// ポーズ（1・2）は画面が切り替わったときだけ選び直す。セリフをタップしたときは同じポーズのまま表情だけ変える
const _pose = { meal: null, trainer: null };
const _poseFresh = { meal: true, trainer: true };
function newScene() { _poseFresh.meal = true; _poseFresh.trainer = true; }
function charSrc(who, line, expr, only) {
  const want = expr || exprFor(who, line);
  const has = (p, e) => CHAR_POSES[who][p].includes(e);
  const poses = only ? only.map(String) : Object.keys(CHAR_POSES[who]);
  if (only && !only.map(String).includes(String(_pose[who]))) _poseFresh[who] = true;
  if (_poseFresh[who] || !_pose[who]) {
    // 新しい画面：今の表情を持っているポーズからランダム
    const ok = poses.filter((p) => has(p, want));
    _pose[who] = pick(ok.length ? ok : poses);
    _poseFresh[who] = false;
  }
  const pose = _pose[who];
  let e = want;
  for (let n = 0; n < 6 && !has(pose, e); n++) e = EXPR_FALLBACK[e] || 'normal';
  if (!has(pose, e)) e = 'normal';
  const file = cached(`var|${who}|${pose}|${e}|${line || ''}`, () => pick((EXPR_ALT[e] || [e]).filter((f) => has(pose, f))));
  return `assets/char/v2/${who}${pose}-${file}.webp`;
}
// 画像は最初に全部読み込んでおく（表情を切り替えたときに待たないように）
const _imgKeep = [];
function preloadChars() {
  Object.entries(CHAR_POSES).forEach(([who, ps]) => Object.entries(ps).forEach(([pose, list]) => list.forEach((e) => {
    const im = new Image();
    im.decoding = 'async';
    im.src = `assets/char/v2/${who}${pose}-${e}.webp`;
    if (im.decode) im.decode().catch(() => {});
    _imgKeep.push(im);
  })));
}
/* ---------- トップ画面（その日はじめて開いたとき・左上のアイコン） ---------- */
function titleView() {
  const t = U.title;
  const fresh = !t.played;
  t.played = true;
  const fx = fresh ? fxLayer({ burst: 60, ring: 2, flash: true, y: '45%', seed: 9 }) : '';
  const chars = isRobot()
    ? `<div class="tt-robots">${robotSVG('trainer')}${robotSVG('meal')}</div>`
    : '<img class="tt-chars" src="assets/title/chars.webp" alt="むきメモ♡">';
  return `<div class="title-screen${fresh ? ' fresh' : ''}" data-act="closeTitle" role="dialog" aria-label="むきメモ♡ トップ画面。タップしてはじめる">
    <div class="tt-backdrop"></div>
    <div class="tt-stage">
      <img class="tt-bg" src="assets/title/bg.webp" alt="">
      ${chars}
      <div class="tt-fx">${fx}</div>
    </div>
    <p class="tt-tap">タップしてはじめる</p>
  </div>`;
}
// キャラが出てきたとき・セリフや表情が変わったときだけ、ちょっと動く（表情ごとに動き方を変える）
const MOTION = { kyun: 'hop', kyunkyun: 'hop2', surprise: 'jump', grin: 'sway', grin2: 'sway', love: 'tilt', confused: 'tilt', laugh: 'bob', smile: 'bob', normal: 'bob', normal2: 'bob' };
const _shown = {};
function motionCls(slotKey, src, line) {
  const key = `${src}|${line || ''}`;
  if (_shown[slotKey] === key) return '';
  _shown[slotKey] = key;
  const e = (src.match(/-(\w+)\.webp$/) || [])[1] || 'normal';
  return ` mv-${MOTION[e] || 'bob'}`;
}
function charImg(who, line, expr) {
  if (isRobot()) return robotSVG(who);
  const src = charSrc(who, line, expr);
  return `<img class="cimg${motionCls('stage-' + who, src, line)}" src="${src}" alt="" decoding="sync">`;
}
function robotSVG(who, size) {
  const col = who === 'meal' ? '#2FA866' : '#EE7A26';
  const id = 'rb' + who + (size || '');
  return `<svg class="robot" viewBox="0 0 200 214" ${size ? `width="${size}" height="${Math.round(size * 1.07)}"` : ''} aria-hidden="true">
    <defs><radialGradient id="${id}" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".7" stop-color="#EEEAE3"/><stop offset="1" stop-color="#D6D0C6"/></radialGradient></defs>
    <rect x="42" y="166" width="26" height="42" rx="11" fill="#2A2A2C"/><rect x="132" y="166" width="26" height="42" rx="11" fill="#2A2A2C"/>
    <line x1="100" y1="46" x2="100" y2="22" stroke="#DCD6CD" stroke-width="7" stroke-linecap="round"/>
    <circle cx="100" cy="16" r="10" fill="${col}"/>
    <circle cx="100" cy="122" r="80" fill="url(#${id})" stroke="#CBC4BA" stroke-width="1.5"/>
    <path d="M22 136 Q100 160 178 136" fill="none" stroke="#CBC4BA" stroke-width="2"/>
    <rect x="44" y="70" width="112" height="64" rx="24" fill="#1C1C1E"/>
    <g class="eyes"><circle cx="77" cy="99" r="13" fill="#FFF6E2"/><circle cx="123" cy="99" r="13" fill="#FFF6E2"/></g>
    <path d="M91 120 Q100 125 109 120" fill="none" stroke="#FFF6E2" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="33" cy="112" r="5" fill="${col}"/><circle cx="167" cy="112" r="5" fill="${col}"/>
  </svg>`;
}

// セリフをタップすると別のセリフに切り替わる
// 日本語の文を文節っぽいまとまりに区切り、短いまとまりは途中で改行しないようにする
// （句読点・空白のあと、ひらがな→漢字・カタカナ・数字に変わるところで区切る。長いまとまりは普通に折り返す）
function phrase(text) {
  const t = String(text);
  const kind = (ch) => /[ぁ-ゟ]/.test(ch) ? 'h' : /[゠-ヿ一-鿿々]/.test(ch) ? 'k' : /[0-9A-Za-z０-９]/.test(ch) ? 'n' : 'p';
  const after = /[、。！？!?…♪」』）)\s]/;
  const noStart = /[ーぁぃぅぇぉっゃゅょゎァィゥェォッャュョ、。！？!?…♪」』）)～〜]/;
  const parts = [];
  let cur = '';
  for (let i = 0; i < t.length; i++) {
    const ch = t[i], prev = t[i - 1];
    let brk = false;
    if (i > 0 && !noStart.test(ch)) {
      if (after.test(prev) && !after.test(ch) && !(/[」』）)]/.test(prev) && kind(ch) === 'h')) brk = true;
      else if ((ch === '「' || ch === '（') && kind(prev) !== 'p') brk = true;
      else if (kind(prev) === 'h' && (kind(ch) === 'k' || kind(ch) === 'n')) {
        // 「お姉さん」「ご飯」の「お・ご」と漢字の間では区切らない
        brk = !/[おご]/.test(prev);
      }
      // そのかわり「お・ご」の前で区切る（例：ちゃんと｜ご飯）
      else if (kind(prev) === 'h' && /[おご]/.test(ch) && kind(t[i + 1] || '') === 'k') brk = true;
      // 長いひらがなは「が・を」のあとで区切る（例：お姉さんが｜ついてる）
      else if (kind(prev) === 'h' && kind(ch) === 'h' && /[がを]/.test(prev) && cur.length >= 3 && /[\u3041-\u309f]{3}/.test(t.slice(i, i + 3))) brk = true;
    }
    if (brk && cur) { parts.push(cur); cur = ''; }
    cur += ch;
  }
  if (cur) parts.push(cur);
  return parts.map((x) => (x.trim().length <= 20 ? `<span class="ph">${esc(x)}</span>` : esc(x))).join('');
}
const _lastLine = {};
const lineBtn = (slot, msg, cls = '') => { const pop = _lastLine[slot] !== msg ? ' pop' : ''; _lastLine[slot] = msg; return lineBtnHtml(slot, msg, cls + pop); };
const lineBtnHtml = (slot, msg, cls = '') => `<button class="line ${cls}" data-act="nextLine" data-slot="${slot}" aria-label="セリフを切り替える：${esc(msg)}">${phrase(msg)}</button>`;

function charStage(who, msg, extra = '', slot = who) {
  const c = CHARACTERS[who];
  return `<button class="char${isRobot() ? ' bot' : ''}" data-act="ask" data-who="${who}" aria-label="${charName(who)}に相談する（長押しで表示を切り替え）">${charImg(who, msg)}</button>
  <div class="bubble">${lineBtn(slot, msg)}${extra}</div>`;
}

/* ---------- 食事 ---------- */
function mealView() {
  const t = targets();
  const tot = dayTotals(U.date);
  const rem = Math.round(t.kcal - tot.kcal);
  const pct = Math.min(tot.kcal / t.kcal, 1);
  const circ = 2 * Math.PI * 58;
  const d = mdLabel(U.date);
  const isToday = U.date === today();
  const ph = PHASES.find((x) => x.id === S.settings.phase);
  const bar = (k, now, goal) => `<div style="display:flex;flex-direction:column;gap:4px">
      <div style="display:flex;align-items:baseline;gap:6px"><b class="num acc" style="width:14px;font-size:14px">${k}</b><b class="num" style="font-size:18px;line-height:1">${Math.round(now)}</b><span class="num sub" style="font-size:12px">/ ${goal}g</span></div>
      <div class="bar"><i style="width:${Math.min(100, (now / goal) * 100)}%"></i></div></div>`;
  const slots = SLOTS.map((s) => {
    const items = slotItems(U.date, s.id);
    if (!items.length) {
      return `<button class="slot empty" data-act="openSlot" data-slot="${s.id}" aria-label="${s.label} 記録する">
        <span class="ico">${IC[s.icon]()}</span><span class="name"></span>
        <span style="display:flex;align-items:center;gap:4px;font-size:15px;font-weight:700;color:var(--accent)">${IC.plus()}記録</span></button>`;
    }
    const sum = sumItems(items);
    const names = items.map(itemName).join('・');
    return `<button class="slot" data-act="openSlot" data-slot="${s.id}" aria-label="${s.label} ${esc(names)} ${Math.round(sum.kcal)}kcal">
      <span class="ico">${IC[s.icon]()}</span><span class="name">${esc(names)}</span>
      <span class="kcal num"><b>${fmtNum(sum.kcal)}</b><small> kcal</small></span></button>`;
  }).join('');
  return `<main class="screen">
    <div class="head">
      <div style="display:flex;align-items:center">
        <button class="topbtn" data-act="openTitle" aria-label="トップ画面">TOP</button>
        <button class="iconbtn" data-act="day" data-d="-1" aria-label="前の日">${IC.chevL()}</button>
        <h1 class="num" style="font-size:20px;font-weight:800">${d.md}<span style="font-size:14px;font-weight:500;color:var(--sub)"> ${d.wd}${isToday ? '・今日' : ''}</span></h1>
        <button class="iconbtn" data-act="day" data-d="1" aria-label="次の日" ${isToday ? 'disabled' : ''}>${IC.chevR(22)}</button>
      </div>
      <button class="pill" data-act="openPage" data-page="settings">${IC.up()}${ph.label}</button>
    </div>
    <section class="card" aria-label="今日の摂取量" style="padding:16px 18px;display:flex;gap:16px;align-items:center">
      <div class="ring">
        <svg width="136" height="136" viewBox="0 0 136 136" role="img" aria-label="摂取カロリー ${Math.round(tot.kcal)} / ${t.kcal} kcal"><circle cx="68" cy="68" r="58" fill="none" stroke="var(--track)" stroke-width="14"/>${pct > 0 ? `<circle cx="68" cy="68" r="58" fill="none" stroke="var(--accent)" stroke-width="14" stroke-linecap="round" stroke-dasharray="${(circ * pct).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 68 68)"/>` : ''}</svg>
        <div class="c"><b class="num" style="font-size:32px;font-weight:800;line-height:1">${fmtNum(tot.kcal)}</b><span class="num sub" style="font-size:12px;margin-top:6px">/ ${fmtNum(t.kcal)} kcal</span></div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;gap:10px;min-width:0">
        ${rem > 0
          ? `<div style="display:flex;align-items:baseline;gap:4px"><span class="sub" style="font-size:12px">あと</span><b class="num acc" style="font-size:28px;line-height:1">${fmtNum(rem)}</b><span class="sub" style="font-size:12px">kcal</span></div>`
          : `<div style="display:flex;align-items:center;gap:4px;color:var(--accent);font-weight:800">${IC.check(18)}<span style="font-size:15px">目標クリア</span></div>`}
        ${bar('P', tot.p, t.p)}${bar('F', tot.f, t.f)}${bar('C', tot.c, t.c)}
      </div>
    </section>
    <section aria-label="食事" style="display:flex;flex-direction:column;gap:6px">${slots}</section>
  </main>
  ${charStage('meal', mealMessage())}`;
}

/* ---------- 食事管理士のセリフ選び（lines.js） ---------- */
let _msgCache = {};
function cached(key, fn) { if (!(key in _msgCache)) _msgCache[key] = fn(); return _msgCache[key]; }
function hourLines() {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return ML.morning;
  if (h >= 11 && h < 15) return ML.noon;
  if (h >= 18 || h < 5) return ML.night;
  return [];
}
function mealIdleLine() {
  const hl = hourLines();
  return pick([...hl, ...hl, ...ML.nutrition, ...ML.daily, ...ML.common, ...ML.ijiwaru]);
}
// 食事を記録した直後
function mealRecordLine() {
  U.comeback = false;
  const t = targets();
  if (U.date === today() && dayTotals(U.date).kcal >= t.kcal * 0.95) return pick([...R(['ふふ、今日の目標クリアね。花丸よ♪'], []), ...ML.praise]);
  const r = Math.random();
  if (r < 0.2) return pick(ML.tease);
  if (r < 0.3) return pick(ML.ijiwaru);
  return pick(ML.onRecord);
}

function mealMessage() {
  if (U.said.meal) return U.said.meal;
  if (U.comeback) return cached('comeback', () => pick(ML.comeback));
  if (U.date !== today()) return R('あら、前の日の記録？ あとからでも直せるわよ。', '前の日の記録です。あとからでも直せます。');
  const h = new Date().getHours();
  const t = targets();
  const tot = dayTotals(U.date);
  const rem = Math.round(t.kcal - tot.kcal);
  if (tot.kcal === 0) return cached('meal0', () => pick([...(h < 11 ? ML.morning : []), ...R(['今日はまだ記録がないわね。食べたもの、教えてちょうだい？', 'ふふっ、今日のご飯は何かな？', '食事の記録、忘れずにね。お姉さんとの約束♪'], ['今日はまだ記録がありません。', '食べたものを記録しましょう。'])]));
  if (rem <= t.kcal * 0.05) return cached('goal', () => pick([...R(['ふふ、今日の目標クリアね。花丸よ♪'], []), ...ML.praise]));
  if (h >= 16 && !slotItems(U.date, 'dinner').length) return R(`あと${fmtNum(rem)}kcalね。夜ごはん、一緒に考えましょうか？`, `あと${fmtNum(rem)}kcalです。夜ごはんで調整しましょう。`);
  if (tot.f / t.f < tot.p / t.p - 0.25) return R('脂質がまだ少なめね。卵やナッツを足してみたらどうかしら？', '脂質が少なめです。卵やナッツがおすすめです。');
  if (h >= 15 && tot.p / t.p < tot.kcal / t.kcal - 0.2) return R('たんぱく質は意識できてる？ 筋肉が泣いちゃうわよ。', 'たんぱく質が少なめです。');
  const idle = cached('mealIdle', () => (Math.random() < 0.35 ? null : mealIdleLine()));
  return idle || R(`いい感じよ。あと${fmtNum(rem)}kcalね♪`, `いい調子です。あと${fmtNum(rem)}kcalです。`);
}

const itemName = (it) => (it.qty && it.qty !== 1 ? `${it.name} ×${fmtKg(it.qty)}` : it.name);

// 記録済みの食事を直す（量・枠の移動・削除）
function editItemView() {
  const ed = U.editItem;
  const it = slotItems(U.date, ed.slot)[ed.i];
  if (!it) return '';
  const base = it.base || { kcal: it.kcal / (it.qty || 1), p: it.p / (it.qty || 1), f: it.f / (it.qty || 1), c: it.c / (it.qty || 1) };
  const v = (k) => base[k] * ed.qty;
  return `<div class="sheet-scrim" data-act="closeEditItem"></div>
  <section class="sheet" role="dialog" aria-label="${esc(it.name)}を直す">
    <div class="grab"></div>
    <h2 style="font-size:17px">${esc(it.name)}</h2>
    <div style="display:flex;align-items:center;justify-content:space-between">
      <button class="round" style="width:60px;height:60px;background:var(--soft)" data-act="itemQty" data-d="-0.5" aria-label="量を減らす">${IC.minus(26)}</button>
      <div style="text-align:center"><b class="num" style="font-size:52px;line-height:1">×${fmtKg(ed.qty)}</b>
        <span class="sub num" style="display:block;font-size:13px;margin-top:4px">${fmtNum(v('kcal'))} kcal ・ P${fmt1(v('p'))} F${fmt1(v('f'))} C${fmt1(v('c'))}</span></div>
      <button class="round" style="width:60px;height:60px;background:var(--soft)" data-act="itemQty" data-d="0.5" aria-label="量を増やす">${IC.plus(26)}</button>
    </div>
    <div>
      <span class="sub" style="font-size:13px">記録する枠</span>
      <div class="seg" role="group" aria-label="記録する枠" style="margin-top:6px">${SLOTS.map((sl) => `<button data-act="itemSlot" data-slot="${sl.id}" aria-pressed="${ed.to === sl.id}" style="font-size:13px">${sl.label}</button>`).join('')}</div>
    </div>
    <div style="display:flex;gap:10px">
      <button class="btn ghost" data-act="itemDel" style="flex:0 0 auto;width:96px">${IC.trash(18)}削除</button>
      <button class="btn" data-act="itemSave" style="flex:1">保存</button>
    </div>
  </section>`;
}

function mealInputView() {
  const s = SLOTS.find((x) => x.id === U.slot);
  const items = slotItems(U.date, U.slot);
  const prev = prevSameSlot(U.date, U.slot);
  const d = mdLabel(U.date);
  const selTot = sumItems(Object.entries(U.sel).flatMap(([key, n]) => {
    const m = entryFor(key);
    return m ? Array(n).fill(m) : [];
  }));
  const selCount = Object.values(U.sel).reduce((a, b) => a + b, 0);
  const recorded = items.length ? `<h2 class="sectitle">記録済み</h2><div class="list">${items.map((it, i) => `
      <div style="padding-top:8px;padding-bottom:8px"><button data-act="editItem" data-i="${i}" aria-label="${esc(itemName(it))}を直す" style="flex:1;min-width:0;display:flex;align-items:center;gap:10px;text-align:left;color:var(--text)"><span style="flex:1;min-width:0"><span style="display:block;font-size:15px">${esc(itemName(it))}</span>${it.detail ? `<span class="sub" style="display:block;font-size:12px;margin-top:2px">${esc(it.detail)}</span>` : ''}</span><span class="kcal num"><b style="font-size:18px">${fmtNum(it.kcal)}</b><small> kcal</small></span><span class="sub" style="display:flex">${IC.pencil(16)}</span></button>
      <button class="iconbtn" data-act="removeItem" data-i="${i}" aria-label="${esc(it.name)}を削除" style="margin-right:-10px">${IC.close(20)}</button></div>`).join('')}</div>` : '';
  const prevLabel = prev ? (prev.date === addDays(U.date, -1) ? '昨日と同じ' : `${mdLabel(prev.date).md}と同じ`) : '';
  const prevBtn = prev ? `<button data-act="copyPrev" style="display:flex;align-items:center;gap:14px;min-height:72px;padding:0 16px;border-radius:18px;background:var(--soft);text-align:left">
      <span style="width:40px;height:40px;border-radius:50%;background:var(--accent);color:var(--onAccent);display:flex;align-items:center;justify-content:center;flex-shrink:0">${IC.repeat()}</span>
      <span style="flex:1;min-width:0"><span style="display:block;font-size:16px;font-weight:700">${prevLabel}</span><span class="sub" style="display:block;font-size:12px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(prev.items.map((i) => i.name).join('・'))}</span></span>
      <span class="kcal num"><b>${fmtNum(sumItems(prev.items).kcal)}</b><small> kcal</small></span></button>` : '';
  const card = (key, name, kcal, detail) => {
    const n = U.sel[key] || 0;
    return `<button class="mcard" data-act="toggleMeal" data-id="${key}" aria-pressed="${n > 0}">
      <span class="t">${esc(name)}</span>${detail ? `<span class="d">${esc(detail)}</span>` : ''}<span class="kcal num"><b>${fmtNum(kcal)}</b><small> kcal</small></span>
      ${n > 1 ? `<span class="cnt num">×${n}</span>` : `<span class="tick">${IC.check(14)}</span>`}</button>`;
  };
  const setGrid = S.sets.map((s) => card('set:' + s.id, s.name, setTotals(s).kcal, setDetail(s))).join('');
  const foodGrid = S.foods.filter((f) => !f.hidden).map((f) => card('food:' + f.id, f.name, f.kcal, '')).join('');
  return `<div class="page" data-p="mealInput"><div class="inner">
    <div class="head" style="justify-content:flex-start">
      <button class="iconbtn" data-act="closePage" aria-label="閉じる" style="margin-left:-10px">${IC.close()}</button>
      <span style="width:36px;height:36px;border-radius:10px;background:var(--soft);color:var(--accent);display:flex;align-items:center;justify-content:center">${IC[s.icon](22)}</span>
      <h1 style="font-size:20px">${s.label}</h1>
      <span class="num sub" style="margin-left:auto;font-size:14px">${d.md}</span>
    </div>
    ${recorded}${prevBtn}
    <div style="display:flex;align-items:center;justify-content:space-between"><h2 class="sectitle">セット</h2>
      <button data-act="openMyMeals" data-back="mealInput" class="acc" style="display:flex;align-items:center;gap:4px;font-size:13px;font-weight:700;min-height:40px">${IC.pencil(16)}編集</button></div>
    <div class="mgrid">${setGrid}</div>
    <h2 class="sectitle">単品</h2>
    <div class="mgrid">${foodGrid}</div>
    <button data-act="openPage" data-page="quickAdd" style="display:flex;align-items:center;gap:12px;min-height:56px;padding:0 16px;border:1.5px dashed var(--dash);border-radius:16px;text-align:left">
      <span class="acc">${IC.chat(22)}</span><span style="flex:1;font-size:15px;font-weight:700">外食・その他</span><span class="sub" style="font-size:12px">Claudeに聞く</span><span class="sub">${IC.chevR()}</span></button>
  </div></div>
  <div class="footer">
    <div style="flex:1"><span class="sub" style="display:block;font-size:12px">${selCount ? `${selCount}品 選択中　<a href="#" data-act="clearSel" class="acc" style="font-weight:700">やり直す</a>` : '合計'}</span><span class="num" style="font-size:26px;font-weight:800">${fmtNum(selTot.kcal)}</span><span class="num sub" style="font-size:12px"> kcal</span></div>
    <button class="btn" style="width:auto;padding:0 32px" data-act="saveSel" ${selCount ? '' : 'disabled'}>記録する</button>
  </div>`;
}

function quickAddView() {
  const q = U.quick;
  return `<div class="page" data-p="quickAdd"><div class="inner">
    <div class="head" style="justify-content:flex-start">
      <button class="iconbtn" data-act="openPage" data-page="mealInput" aria-label="戻る" style="margin-left:-10px">${IC.chevL(24)}</button>
      <h1>外食・その他</h1>
    </div>
    <label class="step" for="qtext"><i>1</i>食べたものを入力</label>
    <textarea id="qtext" rows="2" data-q="text" placeholder="例：なか卯 親子丼大盛り＋はいからうどん小" style="height:80px">${esc(q.text)}</textarea>
    <button class="btn softbtn sm" data-act="askFood" style="height:52px">${IC.chat(22)}Claudeに聞く</button>
    <div class="step" style="margin-top:14px"><i>2</i><span style="flex:1">Claudeが調べたカロリー・PFCを入力</span>
      <button data-act="pasteNums" class="acc" style="display:flex;align-items:center;gap:4px;font-size:13px;font-weight:700;min-height:44px">${IC.paste()}貼り付け</button></div>
    <div class="field"><label for="qkcal">kcal</label><input id="qkcal" class="num" inputmode="decimal" data-q="kcal" value="${esc(q.kcal)}" placeholder="0" style="font-size:32px"></div>
    <div class="pfc3">
      <label><b class="num">P</b><input class="num" inputmode="decimal" data-q="p" value="${esc(q.p)}" placeholder="0"></label>
      <label><b class="num">F</b><input class="num" inputmode="decimal" data-q="f" value="${esc(q.f)}" placeholder="0"></label>
      <label><b class="num">C</b><input class="num" inputmode="decimal" data-q="c" value="${esc(q.c)}" placeholder="0"></label>
    </div>
    <label style="display:flex;align-items:center;gap:10px;min-height:48px;font-size:15px"><input type="checkbox" data-q="save" ${q.save ? 'checked' : ''} style="width:22px;height:22px;margin:0;accent-color:var(--accent)">マイ食事にも保存</label>
  </div></div>
  <div class="footer"><button class="btn" data-act="saveQuick">記録する</button></div>`;
}

/* ---------- トレーニング ---------- */
// 自重の表示：補助ありは「自重 −10kg」、加重は「自重 +5kg」
function bwLabel(w) {
  if (!w) return '自重';
  return w < 0 ? `自重 −${fmtKg(-w)}kg` : `自重 +${fmtKg(w)}kg`;
}
function exWeightHtml(exId, weight, repMin, repMax, bigSize = 'big') {
  const kind = EXERCISES[exId].kind;
  const reps = repMax ? (repMin === repMax ? `×${repMax}` : `×${repMin}–${repMax}`) : '×限界';
  if (kind === 'bodyweight') return `<span style="font-size:15px;font-weight:700">${bwLabel(weight)}</span><span class="num mid" style="margin-left:4px">${reps}</span>`;
  return `<span class="num ${bigSize}">${fmtKg(weight)}</span><span class="num sub" style="font-size:13px">kg</span><span class="num mid" style="margin-left:6px">${reps}</span>`;
}

const chalText = (exId, w, reps) => EXERCISES[exId].kind === 'bodyweight' ? `${bwLabel(w)} ×${reps}回` : `${fmtKg(w)}kg ×${reps}回`;
const gripBtn = (name) => `<span class="grip" role="button" aria-label="${esc(name)}をドラッグして並べ替え"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/></svg></span>`;

// 「57.5kg × 8・8・7」のようなセットのまとめ
function setsSummary(ex, onlyDone = true) {
  const sets = onlyDone ? ex.sets.filter((s) => s.done) : ex.sets;
  if (!sets.length) return '';
  if (EXERCISES[ex.exId].kind === 'bodyweight') {
    const bws = sets.map((s) => setW(ex, s) || 0);
    if (bws.every((w) => w === bws[0])) return `<span style="font-size:14px;font-weight:700">${bwLabel(bws[0])}</span> <b class="num" style="font-size:17px">× ${sets.map((s) => s.reps).join('・')}</b>`;
    return `<b style="font-size:14px">${sets.map((s) => `${bwLabel(setW(ex, s) || 0)}×${s.reps}`).join('・')}</b>`;
  }
  const ws = sets.map((s) => setW(ex, s));
  if (ws.every((w) => w === ws[0])) return `<b class="num" style="font-size:20px">${fmtKg(ws[0])}</b><span class="num sub" style="font-size:12px">kg</span> <b class="num" style="font-size:17px">× ${sets.map((s) => s.reps).join('・')}</b>`;
  return `<b class="num" style="font-size:16px">${sets.map((s) => `${fmtKg(setW(ex, s))}×${s.reps}`).join('・')}</b>`;
}

// 上半身A〜下半身Bのどれをやったか（1巡ぶん）。タップで今日やるメニューを選ぶ
function cycleBar(pickable) {
  const done = cycleDone();
  const all = cycleComplete();
  const chips = MENUS.map((m, i) => {
    const d = done.includes(m.id);
    const cur = pickable && !all && i === S.nextMenu % MENUS.length;
    const label = `${m.name}${d ? '（済み）' : ''}${cur ? '（次にやる）' : ''}`;
    const inner = `<span class="cy-mark">${d ? IC.check(14) : `<span class="num">${m.no}</span>`}</span><span class="cy-name">${m.name}</span>`;
    return pickable && !S.active
      ? `<button class="cy${d ? ' done' : ''}${cur ? ' cur' : ''}" data-act="pickMenu" data-i="${i}" aria-pressed="${cur}" aria-label="${label}">${inner}</button>`
      : `<span class="cy${d ? ' done' : ''}${cur ? ' cur' : ''}" aria-label="${label}">${inner}</span>`;
  }).join('');
  const banner = all ? `<div class="cy-all"><span class="cy-tro">${IC.trophy(22)}</span><span class="cy-msg"><b>4メニュー完了！</b><span>1週間おつかれさま</span></span>
      <button data-act="resetCycle" class="cy-reset">リセット</button></div>` : '';
  return `<section class="cycle" aria-label="今週のメニュー ${done.length}/${MENUS.length}">${banner}<div class="cy-row">${chips}</div></section>`;
}

// 今日のトレーニングが終わっている日
function doneTodayView(last) {
  const menu = MENUS.find((m) => m.id === last.menuId);
  const rows = last.exercises.map((ex) => {
    const e = EXERCISES[ex.exId];
    const pb = last.pbs.includes(ex.exId);
    return `<div class="exrow" style="${pb ? 'border:2px solid var(--accent)' : ''}" aria-label="${e.name}${pb ? ' 自己ベスト' : ''}">
      <span class="ico" style="${pb ? 'background:var(--accent);color:var(--onAccent)' : ''}">${partIcon(e.part, 30)}</span>
      <div style="flex:1;min-width:0"><div class="sub" style="font-size:11px">${e.name}</div><div style="display:flex;align-items:baseline;gap:4px;flex-wrap:wrap">${setsSummary(ex)}</div></div>
      ${pb ? '<span class="badge">自己ベスト</span>' : ''}</div>`;
  }).join('');
  return `<main class="screen">
    <div class="head"><span class="hl"><button class="topbtn" data-act="openTitle" aria-label="トップ画面">TOP</button><h1>トレーニング</h1></span></div>
    ${cycleBar(false)}
    <section class="donetoday" aria-label="今日のトレーニング完了">
      <span class="tro">${IC.trophy(34)}</span>
      <h2>${phrase('今日はもうトレーニング済み')}</h2>
      <p>${menu.name}${last.complete ? ' コンプリート' : ''}</p>
      <div class="stats">
        <span><b class="num">${last.exercises.length}</b>種目</span>
        <span><b class="num">${last.minutes || '—'}</b>分</span>
        ${last.pbs.length ? `<span><b class="num">${last.pbs.length}</b>自己ベスト</span>` : ''}
      </div>
    </section>
    <section aria-label="今日の記録" style="display:flex;flex-direction:column;gap:6px">${rows}</section>
    <button data-act="showNext" class="sub" style="font-size:13px;font-weight:700;min-height:44px;align-self:center">次のメニューを見る ›</button>
  </main>
  ${charStage('trainer', trainMessage(), '', 'train')}`;
}

function trainView() {
  const menu = currentMenu();
  const plan = planFor(menu);
  const last = lastWorkout();
  const mins = menu.items.reduce((a, it) => a + it[1], 0) * 3.5;
  if (!S.active && last && last.date === today() && !U.showNext) return doneTodayView(last);
  const canSort = !S.active;
  const chal = S.active ? S.active.challenge : challengeFor(plan);
  const rows = plan.map((p, i) => {
    const e = EXERCISES[p.exId];
    const badge = p.diff > 0 ? `<span class="badge num">+${fmtKg(p.diff)}</span>` : p.diff < 0 ? `<span class="badge weak num">${fmtKg(p.diff)}</span>` : '';
    return `<div class="exrow" data-sort-i="${i}" aria-label="${PART_LABEL[e.part] || ''} ${e.name}">
      <span class="ico">${partIcon(e.part, 30)}</span>
      <div style="flex:1;min-width:0"><div class="sub" style="font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.name}${p.confirmed || e.kind === 'bodyweight' ? '' : '（仮の重さ）'}</div><div class="w">${exWeightHtml(p.exId, p.weight, p.repMin, p.repMax)}</div></div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">${badge}<span class="num sub" style="font-size:12px">${p.sets}set</span></div>
      ${canSort ? gripBtn(e.name) : ''}
    </div>${chal && chal.exId === p.exId ? `<div class="chal-note">${IC.flame(16)}<b>チャレンジ</b><span>${chalText(p.exId, chal.w, chal.reps)}で自己ベスト更新</span></div>` : ''}`;
  }).join('');
  return `<main class="screen">
    <div class="head"><span class="hl"><button class="topbtn" data-act="openTitle" aria-label="トップ画面">TOP</button><h1>トレーニング</h1></span>${last ? `<span class="sub" style="font-size:13px">前回 <b class="num" style="font-size:15px;color:var(--text)">${mdLabel(last.date).md}</b></span>` : ''}</div>
    ${cycleBar(true)}
    <section class="soft" aria-label="今日のメニュー" style="padding:18px;display:flex;flex-direction:column;gap:14px">
      <div style="display:flex;align-items:center;gap:14px">
        <span class="num" style="width:52px;height:52px;border-radius:16px;background:var(--accent);color:var(--onAccent);font-size:26px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">${menu.no}</span>
        <div style="flex:1"><h2 style="font-size:24px;font-weight:700;line-height:1.2">${menu.name}</h2>
        <p class="sub" style="font-size:13px;margin-top:4px"><b class="num" style="color:var(--text)">${menu.items.length}</b>種目・約<b class="num" style="color:var(--text)">${Math.round(mins / 5) * 5}</b>分</p></div>
      </div>
      <button class="btn" data-act="startWorkout">${IC.play()}${S.active ? 'つづきから' : 'スタート'}</button>
    </section>
    <section aria-label="種目と重量" data-sortable="plan" style="display:flex;flex-direction:column;gap:6px">${rows}</section>
    ${U.showNext && last && last.date === today() ? '<button data-act="hideNext" class="sub" style="font-size:13px;font-weight:700;min-height:44px">‹ 今日の記録に戻る</button>' : ''}
  </main>
  ${charStage('trainer', trainMessage(), '', 'train')}`;
}

/* ---------- トレーナーのセリフ選び（lines.js） ---------- */
let T = TRAINER_LINES, ML = MEAL_LINES;
// ロボット表示かどうか（設定 or キャラ長押しで切り替え）
const isRobot = () => S.settings.charMode === 'robot';
const R = (girl, robot) => (isRobot() ? robot : girl);
function applyCharMode() {
  T = isRobot() ? ROBOT_TRAINER_LINES : TRAINER_LINES;
  ML = isRobot() ? ROBOT_MEAL_LINES : MEAL_LINES;
}
function setCharMode(v) {
  if ((S.settings.charMode || 'girl') === v) return;
  S.settings.charMode = v;
  save();
  applyCharMode();
  U.said = {}; U.doneSay = null; _msgCache = {};
  toast(v === 'robot' ? 'ロボット表示にしました' : 'ふたりの表示に戻しました');
}
function trainerHourLines() {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return T.morning;
  if (h >= 11 && h < 17) return T.noon;
  if (h >= 19 || h < 5) return T.night;
  return [];
}
// 同じ重量が3回続いて自己ベストも出ていない種目
function plateauEx(menu) {
  return menu.items.map((it) => it[0]).find((id) => {
    if (EXERCISES[id].kind === 'bodyweight') return false;
    const s = exSessions(id).slice(-3);
    if (s.length < 3 || !s.every((x) => x.weight === s[0].weight)) return false;
    const st = exState(id);
    return !st.bestDate || st.bestDate < s[0].date;
  });
}

function trainMessage() {
  if (U.said.train) return U.said.train;
  if (U.comeback) return cached('t-comeback', () => pick(T.comeback));
  if (S.active) return R('続き、やりますよ先輩！ 逃げちゃダメですからね？', 'トレーニングの続きがあります。');
  const last = lastWorkout();
  if (cycleComplete()) return cached('t-weekDone', () => pick(T.weekDone));
  if (last && last.date === today() && !U.showNext) return cached('t-doneToday', () => pick([...R(['先輩、今日もお疲れさまでした！', 'トレーニングが終わったら、ゆっくり休んでください。筋肉の成長には休息も大切ですよ！'], ['今日のトレーニングは完了です。', 'ゆっくり休みましょう。休息も成長に必要です。']), ...T.respect]));
  const menu = currentMenu();
  const plan = planFor(menu);
  const hasTemp = plan.some((p) => !p.confirmed && EXERCISES[p.exId].kind !== 'bodyweight');
  return cached('t-idle', () => {
    // 「仮の重さ」の案内は、いくつかある一言のうちの1つとしてたまに出す
    if (hasTemp && Math.random() < 0.25) return pick(R([
      '「仮の重さ」は目安ですからね。あと2回できる重さに調整してくださいよ？',
      '初めての種目は、鉛筆マークで実際の重さに直してくださいね、先輩！',
      '仮の重さで無理しちゃダメですよ？ 怪我したら困りますからね',
    ], ['「仮の重さ」は目安です。あと2回できる重さに調整しましょう。', '初めての種目は、鉛筆マークで重さを直せます。']));
    const r = Math.random();
    const up = plan.find((p) => p.diff > 0);
    if (up && r < 0.4) return R(`${EXERCISES[up.exId].name}は前回より+${fmtKg(up.diff)}kg。いけますよね、先輩？`, `${EXERCISES[up.exId].name}は前回より+${fmtKg(up.diff)}kgです。`);
    const pl = plateauEx(menu);
    if (pl && r < 0.6) return pick(T.plateau);
    return pick([...T.menu, ...T.preStart, ...trainerHourLines(), ...T.daily, ...T.cheeky]);
  });
}

// セリフを切り替えるときの候補（場面ごと）
function linePool(slot) {
  const M = ML;
  switch (slot) {
    case 'meal': return [...hourLines(), ...M.nutrition, ...M.daily, ...M.common, ...M.ijiwaru, ...M.tease];
    case 'recordMeal': return S.weights[today()] == null
      ? [...M.weighPrompt, ...M.common]
      : [...M.weighSaved, ...M.common, ...M.daily];
    case 'train': return [...T.menu, ...T.preStart, ...trainerHourLines(), ...T.daily, ...T.cheeky];
    case 'record': return [...T.daily, ...T.cheeky, ...trainerHourLines(), ...T.respect];
    case 'workout': {
      const a = S.active;
      const resting = a && a.restEnd && a.restEnd > Date.now();
      return resting ? [...T.restChat] : [...T.cheer, ...T.effort];
    }
    case 'done': {
      const r = U.doneRec;
      return r && r.pbs.length ? [...T.pr, ...T.heavy, ...T.hideDere] : r && r.complete ? [...T.complete, ...T.respect] : [...T.incomplete];
    }
    case 'clear': return clearPool();
    case 'chal': return T.chalWin;
    default: return [];
  }
}

// トレーニング中の一言
function workoutLine() {
  if (U.said.workout) return U.said.workout;
  const a = S.active;
  const ex = a.exercises[a.idx];
  const setNo = ex.sets.filter((s) => s.done).length;
  const resting = a.restEnd && a.restEnd > Date.now();
  if (resting) return cached(`rest-${a.idx}-${setNo}`, () => pick(T.restChat));
  if (ex.sets[setNo] && ex.sets[setNo].chal) return cached(`chal-${a.idx}`, () => pick(T.chalStart));
  if (a.idx === 0 && setNo === 0) return cached('pre', () => pick(T.preStart));
  return cached(`cheer-${a.idx}-${setNo}`, () => {
    const st = exState(ex.exId);
    if (st.prevWeight != null && ex.weight > st.prevWeight && setNo === 0 && Math.random() < 0.6) return pick(T.heavy);
    return pick(T.cheer);
  });
}

// まだ終わっていない次の種目（なければ -1）
function nextIdx(a, from) {
  const n = a.exercises.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (a.exercises[i].sets.some((s) => !s.done)) return i;
  }
  return -1;
}
const exDone = (ex) => ex.sets.every((s) => s.done);
const wxr = (ex, s) => EXERCISES[ex.exId].kind === 'bodyweight'
  ? `<span style="font-size:14px;font-weight:700">${bwLabel(setW(ex, s) || 0)}</span> <b class="num" style="font-size:22px">× ${s.reps}</b><span class="sub" style="font-size:12px">回</span>`
  : `<b class="num" style="font-size:22px">${fmtKg(setW(ex, s))}</b><span class="sub" style="font-size:12px">kg</span> <b class="num" style="font-size:22px">× ${s.reps}</b><span class="sub" style="font-size:12px">回</span>`;

// 予定どおり？ 予定より少ない？ 多い？（少ない → 控えめに、多い → いつもより褒める）
function exPerf(ex) {
  const done = ex.sets.filter((s) => s.done);
  const planW = ex.planW != null ? ex.planW : ex.weight;
  const plan = (s) => (s.plan != null ? s.plan : s.reps);
  // 重さを下げても、重さ×回数の合計が予定（予定の重さ×回数の下限）を超えたら「がんばった」扱い
  // 例：20kg×10〜12回の予定 → 15kg×14回（210）は 20kg×10回（200）を超えるので派手に褒める
  // 自重は「体重＋加重（補助はマイナス）」を重さとして計算
  const bw = EXERCISES[ex.exId].kind === 'bodyweight';
  const load = (w) => (bw ? bodyKg() + (w || 0) : w);
  if ((bw || planW > 0) && done.some((s) => (setW(ex, s) || 0) < (planW || 0) - 1e-6)) {
    const vol = done.reduce((a, s) => a + load(setW(ex, s)) * s.reps, 0);
    const planVol = done.reduce((a, s) => a + load(planW) * (ex.repMin || plan(s)), 0);
    return vol > planVol + 1e-6 ? 'high' : 'low';
  }
  const low = done.some((s) => !s.chal && (setW(ex, s) < planW - 1e-6 || s.reps < plan(s)));
  if (low) return 'low';
  const high = done.some((s) => setW(ex, s) > planW + 1e-6 || s.reps > plan(s));
  return high ? 'high' : 'normal';
}

function buildClear(idx) {
  const a = S.active;
  const n = a.exercises.length;
  const cleared = a.exercises.filter(exDone).length;
  const final = cleared === n;
  const chalOk = a.exercises[idx].sets.some((s) => s.chalOk);
  const perf = chalOk ? 'high' : exPerf(a.exercises[idx]);
  let allPerf = perf;
  if (final) {
    const ps = a.exercises.map(exPerf);
    allPerf = ps.filter((p) => p === 'low').length > n / 2 ? 'low' : ps.includes('high') && !ps.includes('low') ? 'high' : 'normal';
  }
  const pool = final ? (allPerf === 'high' ? T.clearFinalHigh : allPerf === 'low' ? T.clearFinalLow : T.clearFinal)
    : perf === 'high' ? T.clearHigh : perf === 'low' ? T.clearLow : T.clearNormal;
  const boomV = final || n - cleared === 1;
  if (navigator.vibrate) navigator.vibrate(final ? [120, 60, 120, 60, 300] : boomV ? [100, 50, 100, 50, 160] : perf === 'low' ? 30 : [60, 50, 60]);
  return { idx, n, cleared, final, perf: final ? allPerf : perf, line: pick(pool), chalOk };
}

function clearPool() {
  const c = U.clear;
  if (!c) return [];
  if (c.final) return c.perf === 'high' ? [...T.clearFinalHigh, ...T.clearFinal] : c.perf === 'low' ? T.clearFinalLow : T.clearFinal;
  return c.perf === 'high' ? T.clearHigh : c.perf === 'low' ? T.clearLow : T.clearNormal;
}

// 種目が終わったあとのワンクッション画面。進むほど・予定を超えるほど派手に
// 演出のパーツ（紙吹雪・爆発・光の線・衝撃波・フラッシュ）
const FX_COLS = ['#FFD84D', '#FF7A45', '#FFFFFF', '#4DD4A8', '#5AA8FF', '#FF5C8A'];
function fxLayer({ fall = 0, burst = 0, rays = false, ring = 0, flash = false, y = '32%', seed = 1, fallRepeat = 1 }) {
  const falls = Array.from({ length: fall }, (_, k) => {
    const l = (k * 37 + seed * 13) % 100;
    const d = ((k * 53) % 100) / 100 * 1.6;
    const dur = 2.2 + ((k * 29) % 10) / 6;
    const sz = 6 + (k % 4) * 2;
    return `<i class="fx-fall" style="left:${l}%;width:${sz}px;height:${sz * 1.6}px;background:${FX_COLS[k % 6]};animation-delay:${d.toFixed(2)}s;animation-duration:${dur.toFixed(2)}s;animation-iteration-count:${fallRepeat};--r:${(k * 47) % 360}deg"></i>`;
  }).join('');
  const bursts = Array.from({ length: burst }, (_, k) => {
    const ang = (k / burst) * Math.PI * 2 + (k % 3) * 0.2;
    const dist = 120 + ((k * 61) % 100) * 1.9;
    const sz = 7 + (k % 5) * 2;
    return `<i class="fx-bp" style="top:${y};width:${sz}px;height:${k % 2 ? sz : sz * 1.7}px;border-radius:${k % 3 ? '2px' : '50%'};background:${FX_COLS[(k + seed) % 6]};--dx:${(Math.cos(ang) * dist).toFixed(0)}px;--dy:${(Math.sin(ang) * dist).toFixed(0)}px;--r:${(k * 83) % 720}deg;animation-delay:${(0.12 + (k % 4) * 0.03).toFixed(2)}s"></i>`;
  }).join('');
  const rings = Array.from({ length: ring }, (_, k) => `<i class="fx-ring" style="top:${y};animation-delay:${(0.08 + k * 0.18).toFixed(2)}s"></i>`).join('');
  return `<div class="fx" aria-hidden="true">${flash ? '<i class="fx-flash"></i>' : ''}${rays ? `<i class="fx-rays" style="top:${y}"></i>` : ''}${rings}${bursts}${falls}</div>`;
}

// チャレンジ成功！の画面（いちばん派手に）
function chalView() {
  const c = U.chal;
  const fx = c.played ? '' : fxLayer({ fall: 90, burst: 100, rays: true, ring: 3, flash: true, seed: 3, fallRepeat: 3 });
  const shake = c.played ? '' : ' shake-l';
  c.played = true;
  if (navigator.vibrate && fx) navigator.vibrate([150, 60, 150, 60, 400]);
  const fig = isRobot() ? `<span class="cl-fig bot">${robotSVG('trainer')}</span>` : `<img class="cl-fig" src="${charSrc('trainer', 'chal-win', 'kyunkyun')}" alt="">`;
  return `<div class="page clear perf-high final boom chal-win${fx ? ' fresh' : ''}" data-p="clear" style="--heat:1">
    ${fx}
    <div class="cl-inner${shake}">
      <span class="cl-tag" style="display:flex;align-items:center;gap:4px">${IC.flame(16)}チャレンジ成功</span>
      <h1 class="cl-title">自己ベスト<br>更新！！</h1>
      <p class="cl-ex">${EXERCISES[c.exId].name}　<b class="num" style="font-size:20px">${c.label}</b></p>
      <div class="cl-stage">${fig}${lineBtn('chal', c.line, 'cl-say')}</div>
      <div class="cl-actions"><button class="btn cl-main" data-act="chalClose">${IC.arrowR(22)}つづける</button></div>
    </div>
  </div>`;
}

function clearView() {
  const a = S.active;
  const c = U.clear;
  const ex = a.exercises[c.idx];
  const e = EXERCISES[ex.exId];
  const heat = c.final ? 1 : c.cleared / c.n;
  const remain0 = c.n - c.cleared;
  // ラスト1種目に入るとき・全種目コンプリートは「ドカン」。予定より少なめなら控えめ、多めならさらに派手に
  const boom = c.final || remain0 === 1;
  const lvl = c.perf === 'high' ? 2 : c.perf === 'low' ? 0 : 1;
  const mult = [0.35, 1, 1.6][lvl];
  const fx = c.played ? '' : fxLayer({
    fall: Math.round((c.final ? 80 : boom ? 50 : 10 + 30 * heat) * mult),
    burst: Math.round((c.final ? 90 : boom ? 60 : 18 + 20 * heat) * mult),
    rays: boom && lvl > 0 || c.final,
    ring: boom ? (lvl === 2 || c.final ? 3 : lvl === 1 ? 2 : 1) : lvl > 0 ? 1 : 0,
    flash: boom && lvl > 0 || c.final,
    seed: c.cleared,
    fallRepeat: c.final ? 3 : 1,
  });
  const shake = c.played ? '' : boom ? (lvl === 2 || c.final ? ' shake-l' : lvl === 1 ? ' shake-m' : ' shake-s') : lvl === 2 ? ' shake-s' : '';
  c.played = true; // セリフの切り替えなどで描き直しても、演出は最初の1回だけ
  const dots = a.exercises.map((x, i) => `<span class="${exDone(x) ? 'on' : ''}${i === c.idx ? ' now' : ''}"></span>`).join('');
  const remain = c.n - c.cleared;
  const title = c.final ? '全種目<br>コンプリート！' : remain === 1 ? `${c.cleared}種目クリア！<small>あと1種目！</small>` : `${c.cleared}種目目 クリア！`;
  const tag = c.chalOk ? `<span class="cl-tag" style="display:flex;align-items:center;gap:4px">${IC.flame(16)}チャレンジ成功！</span>` : c.perf === 'high' ? '<span class="cl-tag">予定超え！</span>' : '';
  const ni = c.final ? -1 : nextIdx(a, c.idx);
  const nx = ni >= 0 ? a.exercises[ni] : null;
  const nextBox = nx ? `<div class="cl-next"><span class="ico">${partIcon(EXERCISES[nx.exId].part, 28)}</span>
      <span style="flex:1;min-width:0"><span style="display:block;font-size:12px;font-weight:700;opacity:.8">次は ${EXERCISES[nx.exId].name}</span>
      <span style="display:flex;align-items:baseline;gap:4px;margin-top:2px">${exWeightHtml(nx.exId, setW(nx, nx.sets[0]), nx.repMin, nx.repMax, 'mid')}</span></span></div>` : '';
  const actions = c.final
    ? `<button class="btn cl-main" data-act="finishWorkout">${IC.trophy(22)}トレーニングを終える</button>
       <button class="cl-sub" data-act="clearClose">記録を見直す</button>`
    : `<button class="btn cl-main" data-act="clearNext">${IC.arrowR(22)}次の種目へ</button>
       <button class="cl-sub" data-act="clearNext" data-rest="1">${IC.timer(18)}休憩タイマーを使って次へ</button>`;
  const fig = isRobot() ? `<span class="cl-fig bot">${robotSVG('trainer')}</span>` : `<img class="cl-fig" src="${charSrc('trainer', c.line)}" alt="">`;
  return `<div class="page clear perf-${c.perf}${c.final ? ' final' : ''}${boom ? ' boom' : ''}${fx ? ' fresh' : ''}" data-p="clear" style="--heat:${heat.toFixed(2)}">
    ${fx}
    <div class="cl-inner${shake}">
      <div class="cl-dots" aria-label="${c.cleared} / ${c.n} 種目">${dots}</div>
      <h1 class="cl-title">${title}</h1>
      <p class="cl-ex">${e.name}　${setsSummary(ex)}</p>
      ${tag}
      <div class="cl-stage">${fig}${lineBtn('clear', c.line, 'cl-say')}</div>
      ${nextBox}
      <div class="cl-actions">${actions}</div>
    </div>
  </div>`;
}

// 今日のメニュー（タップで移動、⠿ で並べ替え）
function workoutList(a) {
  const rows = a.exercises.map((x, i) => {
    const e = EXERCISES[x.exId];
    const d = exDone(x);
    const n = x.sets.filter((s) => s.done).length;
    const cur = i === a.idx;
    const mark = d ? `<span class="wl-no on">${IC.check(16)}</span>` : `<span class="wl-no${cur ? ' cur' : ''} num">${i + 1}</span>`;
    const info = n && !d ? `<span class="num sub" style="font-size:12px">${n}/${x.sets.length}</span>` : '';
    return `<div class="wl-row${cur ? ' cur' : ''}${d ? ' done' : ''}" data-sort-i="${i}">
      <button class="wl-go" data-act="goEx" data-i="${i}" aria-label="${e.name}へ移動">
        ${mark}<span class="wl-ico">${partIcon(e.part, 22)}</span>
        <span class="wl-name">${e.name}</span>${info}
      </button>${gripBtn(e.name)}</div>`;
  }).join('');
  return `<section aria-label="今日のメニュー" class="wl">
    <h2 class="sectitle" style="margin:6px 2px 2px">今日のメニュー</h2>
    <div data-sortable="workout" style="display:flex;flex-direction:column;gap:4px">${rows}</div>
  </section>`;
}

function workoutView() {
  const a = S.active;
  normalizeActive(a);
  if (U.chal) return chalView();
  if (U.clear) return clearView();
  const menu = MENUS.find((m) => m.id === a.menuId);
  const ex = a.exercises[a.idx];
  const e = EXERCISES[ex.exId];
  const curSet = ex.sets.findIndex((s) => !s.done);
  const resting = a.restEnd && a.restEnd > Date.now();
  const left = resting ? Math.ceil((a.restEnd - Date.now()) / 1000) : 0;
  const timer = resting ? `<section class="timer" aria-label="休憩タイマー">
      <div style="display:flex;align-items:center;justify-content:space-between"><span style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:700">${IC.timer()}休憩中</span><span style="font-size:13px">${curSet >= 0 ? `次は${curSet + 1}セット目` : '次の種目へ'}</span></div>
      <div class="t num" id="restT">${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</div>
      <div class="tb"><i id="restBar" style="width:${(left / a.restDur) * 100}%"></i></div>
      <div class="g3"><button class="num" data-act="restAdd" data-s="-15">−15</button><button class="num" data-act="restAdd" data-s="15">+15</button><button class="w" data-act="restSkip">スキップ</button></div>
    </section>` : '';
  const sets = ex.sets.map((s, i) => {
    if (s.done) return `<div class="setrow done" aria-label="${i + 1}セット目 完了">
        <span class="setno" style="background:var(--accent);color:var(--onAccent)">${IC.check(18)}</span>
        <span style="flex:1;display:flex;align-items:baseline;gap:3px;flex-wrap:wrap">${wxr(ex, s)}${s.chal ? `<span class="chal-res${s.chalOk ? ' ok' : ''}">${s.chalOk ? '自己ベスト！' : 'チャレンジ'}</span>` : ''}</span>
        <button class="iconbtn" data-act="editSet" data-i="${i}" aria-label="${i + 1}セット目を修正">${IC.pencil()}</button></div>`;
    if (i === curSet && s.chal) return `<div class="chal-set"><div class="chal-head">${IC.flame(16)}<b>チャレンジ</b><span>この回数で自己ベスト！ できなくてもOK</span></div><div class="setrow cur" aria-label="${i + 1}セット目 チャレンジ">
        <span class="setno num" style="border:2px solid #E8A400;color:#B67F00">${i + 1}</span>
        <button class="setval" data-act="editSet" data-i="${i}" aria-label="${i + 1}セット目の重さと回数を調整">${wxr(ex, s)}<span class="pen">${IC.pencil()}</span></button>
        <button class="btn" data-act="doneSet" style="flex:0 0 auto;width:96px;height:52px;border-radius:14px;padding:0">${IC.check(20)}できた</button></div></div>`;
    if (i === curSet) return `<div class="setrow cur" aria-label="${i + 1}セット目">
        <span class="setno num" style="border:2px solid var(--accent);color:var(--accent)">${i + 1}</span>
        <button class="setval" data-act="editSet" data-i="${i}" aria-label="${i + 1}セット目の重さと回数を調整">${wxr(ex, s)}<span class="pen">${IC.pencil()}</span></button>
        <button class="btn" data-act="doneSet" style="flex:0 0 auto;width:96px;height:52px;border-radius:14px;padding:0">${IC.check(20)}できた</button></div>`;
    return `<div class="setrow todo" aria-label="${i + 1}セット目 未実施"><span class="setno num" style="background:var(--track);color:var(--sub)">${i + 1}</span><span style="display:flex;align-items:baseline;gap:3px;opacity:.55">${wxr(ex, s)}</span></div>`;
  }).join('');
  const nI = curSet < 0 ? nextIdx(a, a.idx) : (a.idx + 1 < a.exercises.length && !exDone(a.exercises[a.idx + 1]) ? a.idx + 1 : nextIdx(a, a.idx));
  const nx = nI >= 0 && nI !== a.idx ? a.exercises[nI] : null;
  const next = nx
    ? `<button class="nextcard" data-act="goEx" data-i="${nI}" aria-label="次の種目 ${EXERCISES[nx.exId].name}">
        <span style="width:50px;height:50px;border-radius:14px;background:var(--card);color:var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0">${partIcon(EXERCISES[nx.exId].part, 32)}</span>
        <span style="flex:1;min-width:0"><span style="display:block;font-size:12px;font-weight:700;color:var(--accent)">次の種目</span><span style="display:flex;align-items:baseline;gap:4px;margin-top:2px">${exWeightHtml(nx.exId, setW(nx, nx.sets.find((s) => !s.done) || nx.sets[0]), nx.repMin, nx.repMax, 'mid')}</span></span>
        <span style="width:40px;height:40px;border-radius:50%;background:var(--accent);color:var(--onAccent);display:flex;align-items:center;justify-content:center;flex-shrink:0">${IC.arrowR()}</span></button>`
    : `<button class="btn" data-act="finishWorkout">${IC.trophy(22)}トレーニングを終える</button>`;
  const prevBtn = a.idx > 0 ? `<button data-act="goEx" data-i="${a.idx - 1}" class="sub" style="font-size:13px;font-weight:700;min-height:44px;align-self:flex-start">‹ 前の種目</button>` : '';
  return `<div class="page" data-p="workout"><div class="inner" style="padding-bottom:calc(var(--sb) + 150px)">
    <div class="head">
      <button class="btn ghost sm" style="width:auto;padding:0 14px;color:var(--sub)" data-act="finishWorkout">終了</button>
      <span style="font-size:15px;font-weight:700">${menu.name}</span>
      <span class="num sub" style="font-size:15px;font-weight:700"><b style="font-size:20px;color:var(--accent)">${a.idx + 1}</b> / ${a.exercises.length}</span>
    </div>
    ${timer}
    <section aria-label="今の種目" style="display:flex;align-items:center;gap:14px;padding:4px 2px">
      <span style="width:56px;height:56px;border-radius:16px;background:var(--soft);color:var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0">${partIcon(e.part, 40)}</span>
      <div style="flex:1;min-width:0"><div class="sub" style="font-size:12px">${e.name}</div>
      <button data-act="editSet" data-i="${curSet >= 0 ? curSet : ex.sets.length - 1}" style="display:flex;align-items:baseline;gap:6px;margin-top:2px;text-align:left">${exWeightHtml(ex.exId, setW(ex, ex.sets[curSet >= 0 ? curSet : ex.sets.length - 1]), ex.repMin, ex.repMax)}</button></div>
    </section>
    <section aria-label="セット" style="display:flex;flex-direction:column;gap:8px">${sets}</section>
    ${prevBtn}${next}
    ${workoutList(a)}
  </div>
  ${charStage('trainer', workoutLine(), '', 'workout')}
  </div>`;
}

function sheetView() {
  const sh = U.sheet;
  const ex = S.active.exercises[S.active.idx];
  const e = EXERCISES[ex.exId];
  // 目標の範囲がすべて入るように（例：12〜15回 → 11〜16）
  const lo = Math.max(1, ex.repMax ? ex.repMin - 1 : sh.reps - 2);
  const hi = ex.repMax ? Math.max(ex.repMax + 1, lo + 4) : sh.reps + 2;
  const opts = Array.from({ length: Math.min(6, hi - lo + 1) }, (_, k) => lo + k);
  return `<div class="sheet-scrim" data-act="closeSheet"></div>
  <section class="sheet" role="dialog" aria-label="${sh.i + 1}セット目の重さと回数">
    <div class="grab"></div>
    <div style="display:flex;align-items:center;justify-content:space-between"><h2 style="font-size:17px">${sh.i + 1}セット目${e.kind === 'bodyweight' ? 'の回数・補助' : 'の重さ・回数'}</h2><span class="num sub" style="font-size:14px">目標 ${ex.repMax ? `${ex.repMin}–${ex.repMax}` : '限界まで'}</span></div>
    <div style="display:flex;align-items:center;justify-content:space-between">
      <button class="round" style="width:68px;height:68px;background:var(--soft)" data-act="sheetReps" data-d="-1" aria-label="1回減らす">${IC.minus(30)}</button>
      <div style="display:flex;align-items:baseline;gap:6px"><b class="num" style="font-size:80px;line-height:1">${sh.reps}</b><span class="sub" style="font-size:18px;font-weight:700">回</span></div>
      <button class="round" style="width:68px;height:68px;background:var(--soft)" data-act="sheetReps" data-d="1" aria-label="1回増やす">${IC.plus(30)}</button>
    </div>
    <div class="quick" style="grid-template-columns:repeat(${opts.length}, minmax(0, 1fr))">${opts.map((n) => `<button class="num" data-act="sheetSet" data-n="${n}" aria-pressed="${n === sh.reps}">${n}</button>`).join('')}</div>
    ${`<div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
      <span class="sub" style="font-size:13px">${e.kind === 'bodyweight' ? '補助・加重' : '重量'}</span>
      <div style="display:flex;align-items:center;gap:8px">
        <button class="round" style="width:44px;height:44px;background:var(--mute)" data-act="sheetW" data-d="-1" aria-label="重量を下げる">${IC.minus(20)}</button>
        <span style="min-width:72px;text-align:center">${e.kind === 'bodyweight'
          ? (sh.weight ? `<b class="num" style="font-size:22px">${sh.weight < 0 ? '−' : '+'}${fmtKg(Math.abs(sh.weight))}</b><span class="sub" style="font-size:13px">kg</span><span class="sub" style="display:block;font-size:11px">${sh.weight < 0 ? '補助' : '加重'}</span>` : '<b style="font-size:18px">自重</b>')
          : `<b class="num" style="font-size:22px">${fmtKg(sh.weight)}</b><span class="sub" style="font-size:13px">kg</span>`}</span>
        <button class="round" style="width:44px;height:44px;background:var(--mute)" data-act="sheetW" data-d="1" aria-label="重量を上げる">${IC.plus(20)}</button>
      </div></div>`}
    <button class="btn" data-act="sheetSave">保存</button>
  </section>`;
}

function doneView() {
  const r = U.doneRec;
  const menu = MENUS.find((m) => m.id === r.menuId);
  const pbNames = r.pbs.map((id) => PART_LABEL[EXERCISES[id].part]).filter((v, i, a) => a.indexOf(v) === i);
  const say = U.doneSay || (U.doneSay = r.pbs.length
    ? (Math.random() < 0.5 ? R(`${pbNames.join('と')}で新記録ですよ、先輩！`, `${pbNames.join('と')}で新記録です！`) : pick(T.pr))
    : pick(r.complete ? T.complete : T.incomplete));
  const rows = r.exercises.map((ex) => {
    const e = EXERCISES[ex.exId];
    const pb = r.pbs.includes(ex.exId);
    const reps = ex.sets.filter((s) => s.done).map((s) => s.reps).join('・');
    return `<div class="exrow" style="${pb ? 'border:2px solid var(--accent);box-shadow:0 6px 18px var(--shadow)' : ''}" aria-label="${e.name} ${reps}${pb ? ' 自己ベスト' : ''}">
      <span class="ico" style="${pb ? 'background:var(--accent);color:var(--onAccent)' : ''}">${partIcon(e.part, 30)}</span>
      <div style="flex:1;min-width:0"><div class="sub" style="font-size:11px">${e.name}</div><div style="display:flex;align-items:baseline;gap:4px;flex-wrap:wrap">${setsSummary(ex)}</div></div>
      ${pb ? '<span class="badge">自己ベスト</span>' : ''}</div>`;
  }).join('');
  // おつかれさま画面の演出：自己ベストがあれば最大、全種目できたら派手、途中までなら控えめ
  const lvl = r.pbs.length ? 2 : r.complete ? 1 : 0;
  const fx = r.played ? '' : fxLayer({ fall: [16, 60, 90][lvl], burst: [14, 50, 80][lvl], rays: lvl > 0, ring: [1, 2, 3][lvl], flash: lvl > 0, y: '24%', seed: 7, fallRepeat: lvl === 2 ? 3 : 2 });
  const shake = r.played ? '' : ['', ' shake-m', ' shake-l'][lvl];
  r.played = true;
  return `<div class="page done-fx${fx ? ' fresh' : ''} lv${lvl}" data-p="done">
    ${fx}
    <div class="hero${shake}">
      <div class="txt">
        <span style="width:52px;height:52px;border-radius:50%;background:var(--pill);display:flex;align-items:center;justify-content:center">${IC.trophy(30)}</span>
        <h1 style="font-size:26px;line-height:1.25">おつかれさま！</h1>
        <p style="font-size:14px">${menu.name}${r.pbs.length ? `　自己ベスト <b class="num" style="font-size:22px">${r.pbs.length}</b> 種目` : ''}</p>
        ${lineBtn('done', say, 'say')}
      </div>
      ${isRobot() ? `<span class="full bot">${robotSVG('trainer')}</span>` : `<img class="full" src="${charSrc('trainer', 'done' + r.id, ['normal', 'kyun', 'kyunkyun'][lvl])}" alt="トレーナー">`}
    </div>
    <div class="inner" style="position:relative;margin-top:-24px;padding-top:0">${rows}</div>
  </div>
  <div class="footer"><button class="btn" data-act="closeDone">完了</button></div>`;
}

/* ---------- 記録 ---------- */
function recordView() {
  const last = latestWeight();
  const todayKg = S.weights[today()];
  const draft = U.weightDraft ?? todayKg ?? (last ? last.kg : S.settings.baseWeight);
  const prevKg = (() => { const l = weightList().filter((x) => x.date !== today()); return l.length ? l[l.length - 1].kg : null; })();
  const wa = weekAvgNow();
  const mc = monthlyChange();
  const bests = Object.entries(S.exState).filter(([, v]) => v.best != null).sort((a, b) => (b[1].bestDate || '').localeCompare(a[1].bestDate || '')).slice(0, 3);
  const lastPhoto = PHOTOS.length ? PHOTOS[PHOTOS.length - 1] : null;
  return `<main class="screen">
    <div class="head"><span class="hl"><button class="topbtn" data-act="openTitle" aria-label="トップ画面">TOP</button><h1>記録</h1></span><button class="iconbtn" data-act="openPage" data-page="settings" aria-label="設定" style="margin-right:-10px"><span class="part" style="width:24px;height:24px;--m:url(assets/icons/gear.png)" aria-hidden="true"></span></button></div>
    ${backupDue() ? `<button class="backup-note" data-act="exportData">${IC.download(20)}<span><b>バックアップしておきましょう</b><small>${S.lastBackup ? `最後のバックアップから${backupDays()}日` : 'まだ一度もバックアップしていません'}</small></span>${IC.chevR()}</button>` : ''}
    <section class="soft" aria-label="今朝の体重" style="padding:16px 18px 18px;display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;align-items:center;justify-content:space-between"><span class="acc" style="font-size:13px;font-weight:700">今朝の体重${todayKg != null ? '（記録済み）' : ''}</span>${prevKg != null ? `<span class="sub" style="font-size:12px">前回 <b class="num">${fmt1(prevKg)}</b>kg</span>` : ''}</div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <button class="round" data-act="wAdj" data-d="-0.1" aria-label="0.1kg減らす">${IC.minus()}</button>
        <div style="display:flex;align-items:baseline;gap:4px"><b class="num" style="font-size:56px;line-height:1;letter-spacing:-1.5px">${fmt1(draft)}</b><span class="num sub" style="font-size:18px;font-weight:700">kg</span></div>
        <button class="round" data-act="wAdj" data-d="0.1" aria-label="0.1kg増やす">${IC.plus(26)}</button>
      </div>
      <button class="btn" data-act="saveWeight">${IC.check(22)}${todayKg != null ? '更新する' : '記録する'}</button>
    </section>
    <section class="card" aria-label="体重の推移" style="padding:14px 18px 16px;display:flex;flex-direction:column;gap:8px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span class="sub" style="font-size:12px">週平均 <b class="num" style="font-size:18px;color:var(--text)">${wa != null ? fmt1(wa) : '—'}</b>kg</span>
        ${mc != null ? `<span class="pill" style="padding:4px 10px;border-radius:10px">${IC.trend()}<b class="num" style="font-size:16px">${mc >= 0 ? '+' : ''}${fmt1(mc)}</b><span style="font-size:11px">/月</span></span>` : '<span class="sub" style="font-size:12px">4週間たつと増え方が出るよ</span>'}
      </div>
      ${goalLine()}
      ${weightChart()}
    </section>
    <section aria-label="自己ベストと写真" style="display:flex;flex-direction:column">
      <a href="#" data-act="openProgress" data-id="" class="row" style="border-bottom:1px solid var(--line)">
        <span style="width:34px;height:34px;border-radius:10px;background:var(--soft);color:var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0">${IC.trend(20)}</span>
        <span style="flex:1;font-size:15px;font-weight:700">種目の推移</span><span class="sub" style="font-size:12px">重量と回数のグラフ</span><span class="sub">${IC.chevR()}</span></a>
      ${bests.map(([id, v]) => `<a href="#" data-act="openProgress" data-id="${id}" class="row" style="border-bottom:1px solid var(--line);min-height:46px">
        <span style="width:34px;height:34px;border-radius:10px;background:var(--soft);color:var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0">${partIcon(EXERCISES[id].part, 24)}</span>
        <span style="flex:1;min-width:0;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" class="sub">${EXERCISES[id].name}</span>
        ${v.bestDate && daysBetween(v.bestDate, today()) <= 7 ? `<span class="acc">${IC.trophy(18)}</span>` : ''}
        <b class="num" style="font-size:17px">${esc(v.bestLabel)}</b></a>`).join('')}
      <a href="#" data-act="openPage" data-page="photos" class="row" style="border-bottom:1px solid var(--line)">
        <span style="width:34px;height:34px;border-radius:10px;background:var(--soft);color:var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0">${IC.camera(20)}</span>
        <span style="flex:1;font-size:15px;font-weight:700">体型写真</span>
        <span class="sub" style="font-size:12px">${lastPhoto ? `前回 ${mdLabel(lastPhoto.date).md}` : 'まだありません'}</span><span class="sub">${IC.chevR()}</span></a>
    </section>
  </main>
  ${charDuo(recordMessage(), recordMealMessage())}`;
}

// 記録画面：トレーナー（左）と食事管理士（右）が並ぶ
function charDuo(trainerMsg, mealMsg) {
  return `<button class="char duo l${isRobot() ? ' bot' : ''}" data-act="ask" data-who="trainer" aria-label="${charName('trainer')}に相談する（長押しで表示を切り替え）">${isRobot() ? robotSVG('trainer') : `<span class="bust">${(() => { const src = charSrc('trainer', trainerMsg, null, [1]); return `<img class="cimg${motionCls('duo-trainer', src, trainerMsg)}" src="${src}" alt="" decoding="sync">`; })()}</span>`}</button>
  <button class="char duo r${isRobot() ? ' bot' : ''}" data-act="ask" data-who="meal" aria-label="${charName('meal')}に相談する（長押しで表示を切り替え）">${isRobot() ? robotSVG('meal') : `<span class="bust">${(() => { const src = charSrc('meal', mealMsg); return `<img class="cimg${motionCls('duo-meal', src, mealMsg)}" src="${src}" alt="" decoding="sync">`; })()}</span>`}</button>
  <div class="duobub">${lineBtn('record', trainerMsg, 'l')}${lineBtn('recordMeal', mealMsg, 'r')}</div>`;
}

// 記録画面の食事管理士：体重の測定と、前日の食事
// 最後のバックアップから30日以上（バックアップしたことがなければ、記録を始めてから30日以上）
function firstDataDate() {
  const ds = [...Object.keys(S.weights), ...Object.keys(S.meals).filter(hasMeal), ...S.workouts.map((w) => w.date)].sort();
  return ds[0] || null;
}
function backupDays() {
  const from = S.lastBackup || firstDataDate();
  return from ? daysBetween(from, today()) : 0;
}
const backupDue = () => backupDays() >= 30;

function recordMealMessage() {
  if (backupDue()) return cached('m-backup', () => R(
    S.lastBackup ? `最後のバックアップから${backupDays()}日たったわ。記録はこのスマホの中だけにあるから、そろそろ書き出しておきましょ？` : '記録はこのスマホの中だけにあるの。大事な記録だから、一度バックアップしておきましょ？',
    S.lastBackup ? `最後のバックアップから${backupDays()}日たちました。バックアップをおすすめします。` : '記録はこの端末の中だけにあります。バックアップをおすすめします。'));
  if (U.said.recordMeal) return U.said.recordMeal;
  if (U.comeback) return cached('comeback', () => pick(ML.comeback));
  if (S.weights[today()] == null) return cached('weighPrompt', () => pick(ML.weighPrompt));
  return cached('recMeal', () => {
    const tot = dayTotals(addDays(today(), -1));
    if (Math.random() < 0.4) return pick(ML.common);
    if (!tot.kcal) return R('食事の記録も、体を変える大事な材料なのよ？', '昨日の食事記録はありません。');
    const pct = Math.round((tot.kcal / targets().kcal) * 100);
    if (pct >= 95 && pct <= 110) return R(`昨日は目標の${pct}%。しっかり食べられてたわね♪`, `昨日は目標の${pct}%。ちょうどいい量です。`);
    if (pct < 95) return R(`昨日は目標の${pct}%。今日はもう少し食べましょうね`, `昨日は目標の${pct}%。今日はもう少し食べましょう。`);
    return R(`昨日は目標の${pct}%。今日は少し控えめにしましょうか`, `昨日は目標の${pct}%。今日は少し控えめにしましょう。`);
  });
}

// 体重を記録した直後：目標の向きに動いたか（増量期は増えたら◎）
function weighLine(diff) {
  if (diff == null || Math.abs(diff) < 0.05 || Math.random() < 0.3) return pick(ML.weighSaved);
  const ph = S.settings.phase;
  const good = ph === 'bulk' ? diff > 0 : ph === 'cut' ? diff < 0 : Math.abs(diff) <= 0.3;
  if (good) return pick(ML.weighDown);
  return pick(ML.weighUp.filter((l) => ph !== 'bulk' || !l.includes('増えた')));
}

// 期間（開始〜終了）全体の体重。目標体重と、増え方・減り方の目安の帯つき
function weightChart() {
  const g = goal();
  const t0 = today();
  const last = t0 > g.end ? t0 : g.end; // 期間を過ぎたら今日まで伸ばす
  const N = Math.max(1, daysBetween(g.start, last));
  const dx = (k) => daysBetween(g.start, k);
  const pts = [], avg = [];
  for (let i = 0; i <= N; i++) {
    const k = addDays(g.start, i);
    if (S.weights[k] != null) { pts.push({ x: i, y: S.weights[k] }); avg.push({ x: i, y: avgWeight(k) }); }
  }
  const per = (d) => d / 30.4;
  const bandLo = (d) => g.base + g.lo * per(d);
  const bandHi = (d) => g.base + g.hi * per(d);
  const ys = [g.base, g.target, bandLo(N), bandHi(N), ...pts.map((p) => p.y), ...avg.map((p) => p.y)];
  const lo = Math.min(...ys) - 0.3, hi = Math.max(...ys) + 0.3;
  const W = 320, H = 132, L = 6, Rr = 58, T = 10, B = 22;
  const sx = (x) => L + (x / N) * (W - L - Rr);
  const sy = (y) => T + (1 - (y - lo) / (hi - lo)) * (H - T - B);
  const f = (n) => n.toFixed(1);
  const band = `${f(sx(0))},${f(sy(g.base))} ${f(sx(N))},${f(sy(bandHi(N)))} ${f(sx(N))},${f(sy(bandLo(N)))}`;
  const line = avg.map((p) => `${f(sx(p.x))},${f(sy(p.y))}`).join(' ');
  const lastP = avg[avg.length - 1];
  const xe = sx(dx(g.end)), xt = sx(Math.min(dx(t0), N));
  const md = (k) => mdLabel(k).md;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="${md(g.start)}から${md(g.end)}までの体重。目標${fmt1(g.target)}kg">
    <polygon points="${band}" fill="var(--accent)" opacity=".1"/>
    <line x1="${f(sx(0))}" y1="${f(sy(g.base))}" x2="${f(xe)}" y2="${f(sy(g.target))}" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="4 4" opacity=".7"/>
    <line x1="${f(xt)}" y1="${T - 4}" x2="${f(xt)}" y2="${H - B}" stroke="var(--line)" stroke-width="1"/>
    <text x="${f(xt)}" y="${T - 2}" font-size="9" text-anchor="middle" fill="var(--sub)">今日</text>
    <line x1="${L}" y1="${H - B}" x2="${W - Rr}" y2="${H - B}" stroke="var(--line)"/>
    ${pts.map((p) => `<circle cx="${f(sx(p.x))}" cy="${f(sy(p.y))}" r="2.2" fill="var(--dash)"/>`).join('')}
    ${avg.length > 1 ? `<polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
    ${lastP ? `<circle cx="${f(sx(lastP.x))}" cy="${f(sy(lastP.y))}" r="5" fill="var(--accent)"/>` : ''}
    <circle cx="${f(xe)}" cy="${f(sy(g.target))}" r="5" fill="var(--card)" stroke="var(--accent)" stroke-width="2.5"/>
    <text x="${f(xe + 9)}" y="${f(sy(g.target) - 2)}" font-size="10" font-weight="700" fill="var(--sub)">目標</text>
    <text x="${f(xe + 9)}" y="${f(sy(g.target) + 11)}" font-size="13" font-weight="800" fill="var(--text)">${fmt1(g.target)}</text>
    <text x="${L}" y="${H - 6}" font-size="10" fill="var(--sub)">${md(g.start)}</text>
    <text x="${f(xe)}" y="${H - 6}" font-size="10" text-anchor="end" fill="var(--sub)">${md(g.end)}</text>
  </svg>
  <div class="wleg"><span><i class="lg-line"></i>週平均</span><span><i class="lg-dot"></i>毎日</span><span><i class="lg-band"></i>目安の範囲</span><span><i class="lg-dash"></i>目標までの線</span></div>`;
}

function goalLine() {
  const g = goal();
  const ph = PHASES.find((p) => p.id === S.settings.phase);
  const wa = weekAvgNow();
  const diff = wa != null ? wa - g.expect : null;
  return `<div class="goalline">
    <span class="gl-phase">${ph.label}</span>
    <span class="num">${mdLabel(g.start).md}〜${mdLabel(g.end).md}</span>
    <span class="sub">${g.left > 0 ? `あと${g.left}日` : '期間終了'}</span>
    <span class="gl-target">目標 <b class="num">${fmt1(g.target)}</b>kg</span>
  </div>
  ${wa != null && g.left >= 0 ? `<p class="sub" style="font-size:12px">今日の目安 <b class="num" style="color:var(--text)">${fmt1(g.expect)}</b>kg（週平均は目安より <b class="num" style="color:var(--text)">${diff >= 0 ? '+' : ''}${fmt1(diff)}</b>kg）</p>` : ''}`;
}

function recordMessage() {
  if (U.said.record) return U.said.record;
  if (U.comeback) return cached('t-comeback', () => pick(T.comeback));
  if (S.weights[today()] == null) {
    const last = lastWorkout();
    return last ? R(`前回は${MENUS.find((m) => m.id === last.menuId).name}でしたね。次は${currentMenu().name}ですよ、先輩！`, `前回は${MENUS.find((m) => m.id === last.menuId).name}でした。次は${currentMenu().name}です。`) : R('先輩、トレーニングも一緒に頑張りましょうね！', 'トレーニングも一緒にがんばりましょう。');
  }
  const mc = monthlyChange();
  const ph = S.settings.phase;
  if (mc == null) return cached('t-rec', () => pick(T.daily));
  if (ph === 'bulk') {
    if (mc < 0.2) return R('増え方がゆっくりですね。先輩、ちゃんとご飯食べてます？', '増え方がゆっくりです。食事量を少し増やしましょう。');
    if (mc > 0.8) return R('増え方が速めですね。食べすぎはダメですよ、先輩？', '増え方が速めです。食事量を少し減らしましょう。');
    return cached('t-good', () => (Math.random() < 0.5 ? R('順調に増えてますね！ その調子です、先輩！', '順調に増えています。この調子です。') : pick(T.growth)));
  }
  if (ph === 'cut') {
    if (mc > -0.3) return R('落ち方がゆっくりですね。食事、ちょっと見直してみましょうか', '落ち方がゆっくりです。食事を見直しましょう。');
    if (mc < -1.5) return R('落ち方が速すぎです！ 無理は禁物ですよ、先輩', '落ち方が速すぎます。無理は禁物です。');
    return R('順調に絞れてますね！ その調子です、先輩！', '順調に絞れています。この調子です。');
  }
  return Math.abs(mc) < 0.5 ? R('いい感じにキープできてますね、先輩！', 'うまくキープできています。') : R('少し動いてますね。食事、見直してみましょうか', '少し動いています。食事を見直しましょう。');
}

/* ---------- 体型写真 ---------- */
function photoPair() {
  const list = PHOTOS.filter((p) => p.pose === U.pose);
  if (!list.length) return { cur: null, base: null, list };
  const cur = list.find((p) => p.id === U.photoSel) || list[list.length - 1];
  const older = list.filter((p) => p.date < cur.date);
  let base = null;
  if (older.length) {
    const want = addDays(cur.date, -28);
    base = older.reduce((a, b) => (Math.abs(daysBetween(b.date, want)) < Math.abs(daysBetween(a.date, want)) ? b : a));
  }
  return { cur, base, list };
}

function photosView() {
  const { cur, base, list } = photoPair();
  const frame = (p, label, hl) => `<div style="display:flex;flex-direction:column;gap:6px">
      <div class="photo" style="${hl ? 'outline:3px solid var(--accent);outline-offset:-3px' : ''}">${p ? `<img src="${p.url}" alt="${label}の写真">` : IC.person(48)}</div>
      <span style="font-size:13px;${hl ? 'font-weight:700;color:var(--accent)' : 'color:var(--sub)'}">${label}${p ? ` <b class="num">${mdLabel(p.date).md}</b>` : ''}</span></div>`;
  const baseLabel = base ? `${Math.round(daysBetween(base.date, cur.date) / 7)}週前` : '比べる写真';
  return `<div class="page" data-p="photos"><div class="inner">
    <div class="head" style="justify-content:flex-start"><button class="iconbtn" data-act="closePage" aria-label="戻る" style="margin-left:-10px">${IC.chevL(24)}</button><h1>体型写真</h1></div>
    <div class="seg" role="group" aria-label="向き"><button data-act="pose" data-v="front" aria-pressed="${U.pose === 'front'}">正面</button><button data-act="pose" data-v="side" aria-pressed="${U.pose === 'side'}">横</button></div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${frame(base, baseLabel, false)}${frame(cur, cur && cur.date === today() ? '今日' : '最新', true)}</div>
    <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:12px;background:var(--mute);font-size:13px" class="sub">${IC.sun1()}週1回・起床後・同じ場所と照明で撮ろう</div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
      <label class="btn" style="font-size:17px">${IC.camera()}撮影<input type="file" accept="image/*" data-file="photo" hidden></label>
      <button class="btn softbtn" style="font-size:17px" data-act="sharePhotos" ${cur ? '' : 'disabled'}>${IC.chat(22)}相談</button>
    </div>
    ${list.length ? `<h2 class="sectitle">これまで</h2>
    <div class="strip">${list.slice(-10).map((p) => `<button data-act="photoSel" data-id="${p.id}" aria-pressed="${cur && p.id === cur.id}"><span class="th"><img src="${p.url}" alt=""></span><span class="num">${mdLabel(p.date).md}</span></button>`).join('')}</div>
    ${cur ? `<button data-act="delPhoto" class="sub" style="font-size:13px;min-height:44px;align-self:flex-start">${IC.trash(16)} 選んでいる写真を削除</button>` : ''}` : ''}
  </div></div>`;
}

/* ---------- 種目の推移 ---------- */
function progressChart(data, key, unit, H, asBars) {
  const W = 350, L = 34, R = 10, T = 26, B = 22;
  const pts = data.map((d, i) => ({ i, v: d[key], ws: d.ws })).filter((p) => p.v != null);
  if (!pts.length) return '';
  let lo = Math.min(...pts.map((p) => p.v)), hi = Math.max(...pts.map((p) => p.v));
  if (asBars) lo = 0;
  if (hi === lo) { hi += asBars ? 1 : 2.5; lo = asBars ? 0 : Math.max(0, lo - 2.5); }
  const pad = asBars ? 0 : (hi - lo) * 0.15;
  lo = Math.max(0, lo - pad); hi += pad;
  const n = data.length;
  const sx = (i) => L + (n === 1 ? (W - L - R) / 2 : (i / (n - 1)) * (W - L - R));
  const sy = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const fmt = (v) => (key === 'weight' ? fmtKg(Math.round(v * 2) / 2) : Math.round(v));
  const grid = [hi, (hi + lo) / 2, lo].map((v) => `<line x1="${L}" x2="${W - R}" y1="${sy(v).toFixed(1)}" y2="${sy(v).toFixed(1)}" stroke="var(--line)"/>
    <text x="${L - 6}" y="${(sy(v) + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--sub)" class="num">${fmt(v)}</text>`).join('');
  const xl = data.map((d, i) => (i % 3 === (n - 1) % 3 ? `<text x="${sx(i).toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="var(--sub)" class="num">${mdLabel(d.ws).md}</text>` : '')).join('');
  const sel = U.ptSel != null ? pts.find((p) => p.i === U.ptSel) : pts[pts.length - 1];
  let marks;
  if (asBars) {
    const bw = Math.min(16, ((W - L - R) / n) * 0.6);
    marks = pts.map((p) => {
      const y = sy(p.v), h = sy(lo) - y;
      return `<path d="M${(sx(p.i) - bw / 2).toFixed(1)},${(y + h).toFixed(1)} v${(-h + 4).toFixed(1)} q0,-4 4,-4 h${(bw - 8).toFixed(1)} q4,0 4,4 v${(h - 4).toFixed(1)} z" fill="var(--accent)" opacity="${sel && sel.i === p.i ? 1 : 0.55}"/>`;
    }).join('');
  } else {
    const line = pts.map((p) => `${sx(p.i).toFixed(1)},${sy(p.v).toFixed(1)}`).join(' ');
    marks = `<polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`
      + pts.map((p) => `<circle cx="${sx(p.i).toFixed(1)}" cy="${sy(p.v).toFixed(1)}" r="${sel && sel.i === p.i ? 6 : 4}" fill="var(--accent)" stroke="var(--card)" stroke-width="2"/>`).join('');
  }
  const hits = pts.map((p) => `<rect data-act="ptSel" data-i="${p.i}" x="${(sx(p.i) - 14).toFixed(1)}" y="${T - 10}" width="28" height="${H - T - B + 10}" fill="transparent" style="cursor:pointer"/>`).join('');
  let tip = '';
  if (sel) {
    const tx = Math.min(Math.max(sx(sel.i), L + 30), W - R - 30);
    tip = `<text x="${tx.toFixed(1)}" y="${(Math.max(sy(sel.v) - 10, 12)).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="800" fill="var(--text)" class="num">${fmt(sel.v)}${unit}</text>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${key === 'weight' ? '週ごとの最大重量' : '週ごとの回数'}">${grid}${xl}${marks}${tip}${hits}</svg>`;
}

function progressView() {
  const ids = MENUS.flatMap((m) => m.items.map((it) => it[0])).filter((v, i, a) => a.indexOf(v) === i);
  const withData = ids.filter((id) => exSessions(id).length);
  const exId = U.progEx && withData.includes(U.progEx) ? U.progEx : withData[0];
  const head = `<div class="head" style="justify-content:flex-start"><button class="iconbtn" data-act="closePage" aria-label="戻る" style="margin-left:-10px">${IC.chevL(24)}</button><h1>種目の推移</h1></div>`;
  if (!exId) return `<div class="page" data-p="progress"><div class="inner">${head}<p class="empty-note">トレーニングを記録すると、ここに種目ごとのグラフが出るよ</p></div></div>`;
  const e = EXERCISES[exId];
  const bw = e.kind === 'bodyweight';
  const data = exWeekly(exId, 12);
  const sess = exSessions(exId);
  const st = exState(exId);
  const wk = data.filter((d) => d.weight != null);
  const first = wk[0], last = wk[wk.length - 1];
  const delta = first && last && first !== last ? (bw ? last.reps - first.reps : last.weight - first.weight) : null;
  const chips = withData.map((id) => `<button data-act="progEx" data-id="${id}" aria-pressed="${id === exId}" style="display:flex;align-items:center;gap:6px;flex-shrink:0;height:40px;padding:0 12px 0 8px;border-radius:999px;font-size:13px;font-weight:700;${id === exId ? 'background:var(--accent);color:var(--onAccent)' : 'background:var(--mute);color:var(--text)'}">${partIcon(EXERCISES[id].part, 22)}${EXERCISES[id].name}</button>`).join('');
  return `<div class="page" data-p="progress"><div class="inner">
    ${head}
    <div role="group" aria-label="種目" style="display:flex;gap:8px;overflow-x:auto;margin:0 -20px;padding:2px 20px 6px;scrollbar-width:none">${chips}</div>
    <section class="card" style="padding:16px 14px 10px;display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;align-items:baseline;gap:8px;padding:0 4px;flex-wrap:wrap">
        <span class="sub" style="font-size:12px">自己ベスト</span><b class="num" style="font-size:22px">${esc(st.bestLabel || '—')}</b>
        ${delta != null && delta !== 0 ? `<span class="pill" style="margin-left:auto;padding:4px 10px;border-radius:10px">${delta > 0 ? IC.up(14) : IC.down(14)}<b class="num">${delta > 0 ? '+' : ''}${bw ? delta + '回' : fmtKg(delta) + 'kg'}</b><span style="font-size:11px">／12週</span></span>` : ''}
      </div>
      ${bw ? '' : `<h2 class="sectitle" style="margin-top:6px">重量（週ごとの最大）</h2>${progressChart(data, 'weight', 'kg', 170, false)}`}
      <h2 class="sectitle" style="margin-top:6px">${bw ? '回数（週ごとの最多）' : 'その重量での回数'}</h2>
      ${progressChart(data, 'reps', '回', bw ? 170 : 110, true)}
    </section>
    <h2 class="sectitle">これまでの記録</h2>
    <div class="list">${sess.slice().reverse().slice(0, 12).map((s) => `<div>
      <span class="num sub" style="width:44px;font-size:13px">${mdLabel(s.date).md}</span>
      <span style="flex:1">${bw ? `<span style="font-size:14px;font-weight:700">${bwLabel(s.weight)}</span>` : `<b class="num" style="font-size:18px">${fmtKg(s.weight)}</b><span class="num sub" style="font-size:12px">kg</span>`}</span>
      <b class="num" style="font-size:15px">${s.reps.join('・')}</b></div>`).join('')}</div>
  </div></div>`;
}

/* ---------- 設定 ---------- */
function settingsView() {
  const st = S.settings;
  const t = targets();
  const wa = weekAvgNow();
  return `<div class="page" data-p="settings"><div class="inner">
    <div class="head" style="justify-content:flex-start"><button class="iconbtn" data-act="closePage" aria-label="戻る" style="margin-left:-10px">${IC.chevL(24)}</button><h1>設定</h1></div>
    <h2 class="sectitle">時期</h2>
    <div class="seg accent" role="group" aria-label="時期">${PHASES.map((p) => `<button data-act="phase" data-v="${p.id}" aria-pressed="${st.phase === p.id}">${p.label}</button>`).join('')}</div>
    ${(() => { const g = goal(); return `<h2 class="sectitle">期間と目標体重</h2>
    <div class="list">
      <label><span style="flex:1;font-size:15px">開始</span><input type="date" data-goal="goalStart" value="${g.start}" style="height:48px;border:0;background:transparent;text-align:right;font-size:16px;font-weight:700;color:var(--text)"></label>
      <label><span style="flex:1;font-size:15px">終了</span><input type="date" data-goal="goalEnd" value="${g.end}" style="height:48px;border:0;background:transparent;text-align:right;font-size:16px;font-weight:700;color:var(--text)"></label>
      <label><span style="flex:1;font-size:15px">目標体重<span class="sub" style="display:block;font-size:11px">${g.custom ? `目安は ${fmt1(g.auto)}kg` : '期間と時期から自動で計算'}</span></span><input class="num" type="number" inputmode="decimal" step="0.1" data-goal="goalWeight" value="${fmt1(g.target)}" style="width:90px;height:48px;border:0;background:transparent;text-align:right;font-size:18px;font-weight:800;color:var(--text)"><span class="sub" style="font-size:13px">kg</span></label>
      ${g.custom ? '<button data-act="goalAuto" style="justify-content:center;font-size:14px;font-weight:700;color:var(--accent)">目標体重を自動に戻す</button>' : ''}
    </div>`; })()}
    <h2 class="sectitle">1日の目標（自動計算）</h2>
    <div class="card" style="border-radius:16px;padding:14px 16px;display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;align-items:baseline;gap:4px"><b class="num" style="font-size:30px;line-height:1">${fmtNum(t.kcal)}</b><span class="num sub" style="font-size:13px">kcal</span><span class="sub" style="font-size:12px;margin-left:auto">基礎代謝 ${fmtNum(t.bmr)}・消費 ${fmtNum(t.tdee)}</span></div>
      <div class="pfc3">${[['P', t.p], ['F', t.f], ['C', t.c]].map(([k, v]) => `<span style="padding:6px 10px;border-radius:10px;background:var(--mute)"><b class="num acc" style="font-size:13px">${k} </b><b class="num" style="font-size:18px">${v}</b><span class="num sub" style="font-size:11px">g</span></span>`).join('')}</div>
      <p class="sub" style="font-size:12px">体重は${wa != null ? `週平均の <b class="num">${fmt1(wa)}</b>kg` : `下の基準体重 <b class="num">${fmt1(st.baseWeight)}</b>kg`}で計算</p>
    </div>
    <h2 class="sectitle">体の情報</h2>
    <div class="list">
      <label><span style="flex:1;font-size:15px">身長</span><input class="num" type="number" inputmode="decimal" data-set="height" value="${st.height}" style="width:90px;height:48px;border:0;background:transparent;text-align:right;font-size:18px;font-weight:800;outline:none"><span class="sub" style="font-size:13px;width:24px">cm</span></label>
      <label><span style="flex:1;font-size:15px">年齢</span><input class="num" type="number" inputmode="numeric" data-set="age" value="${st.age}" style="width:90px;height:48px;border:0;background:transparent;text-align:right;font-size:18px;font-weight:800;outline:none"><span class="sub" style="font-size:13px;width:24px">歳</span></label>
      <label><span style="flex:1;font-size:15px">基準体重<span class="sub" style="font-size:11px">（記録がないとき）</span></span><input class="num" type="number" inputmode="decimal" step="0.1" data-set="baseWeight" value="${st.baseWeight}" style="width:90px;height:48px;border:0;background:transparent;text-align:right;font-size:18px;font-weight:800;outline:none"><span class="sub" style="font-size:13px;width:24px">kg</span></label>
      <label><span style="font-size:15px;white-space:nowrap">活動</span><select data-set="activity" style="flex:1;min-width:0;height:48px;border:0;background:transparent;text-align:right;font-size:14px;font-weight:700;outline:none;text-align-last:right">${ACTIVITY_OPTIONS.map((o) => `<option value="${o.v}" ${o.v === st.activity ? 'selected' : ''}>${o.label}</option>`).join('')}</select></label>
    </div>
    <h2 class="sectitle">トレーニング</h2>
    <div class="list"><div><span style="flex:1;font-size:15px">休憩時間</span>
      <button class="round" style="width:40px;height:40px;background:var(--mute)" data-act="restSet" data-d="-15" aria-label="15秒短く">${IC.minus(18)}</button>
      <b class="num" style="font-size:18px;min-width:52px;text-align:center">${st.rest}<span class="sub" style="font-size:12px;font-weight:500">秒</span></b>
      <button class="round" style="width:40px;height:40px;background:var(--mute)" data-act="restSet" data-d="15" aria-label="15秒長く">${IC.plus(18)}</button></div></div>
    <h2 class="sectitle">休憩が終わったときの音</h2>
    <div class="seg" role="group" aria-label="休憩が終わったときの音">${[['mix', '鳴らす'], ['loud', 'マナーでも'], ['off', '鳴らさない']].map(([v, l]) => `<button data-act="soundMode" data-v="${v}" aria-pressed="${(st.sound || 'mix') === v}">${l}</button>`).join('')}</div>
    <p class="sub" style="font-size:12px;line-height:1.6;margin-top:-4px">${(st.sound || 'mix') === 'loud' ? 'マナーモードでも鳴ります。音楽や動画を再生中は、音が鳴るときに止まります。' : (st.sound || 'mix') === 'off' ? '音は鳴りません。' : '音楽や動画を止めずに、重ねて鳴ります。マナーモードのときは鳴りません。'}</p>
    <h2 class="sectitle">キャラクター</h2>
    <div class="seg" role="group" aria-label="キャラクター">${[['girl', 'ふたり'], ['robot', 'ロボット']].map(([v, l]) => `<button data-act="charMode" data-v="${v}" aria-pressed="${(st.charMode || 'girl') === v}">${l}</button>`).join('')}</div>
    <h2 class="sectitle">いつも同じチャットで相談する</h2>
    <div class="list">
      ${['trainer', 'meal'].map((w) => `<label style="flex-direction:column;align-items:stretch;gap:4px;padding-top:10px;padding-bottom:10px"><span style="font-size:14px;font-weight:700">${CHARACTERS[w].name}のチャットのURL</span>
        <input type="url" inputmode="url" data-chat="${w}" value="${esc((st.chatUrl || {})[w] || '')}" placeholder="https://claude.ai/chat/…" style="height:40px;border:1px solid var(--line);border-radius:10px;padding:0 10px;font-size:14px;background:var(--card);color:var(--text)"></label>`).join('')}
    </div>
    <p class="sub" style="font-size:12px;line-height:1.6;margin-top:-4px">Safariで claude.ai を開き、相談に使っているチャットのURLをコピーして貼り付けてください。空欄のときは、相談のたびに新しいチャットになります。</p>
    <h2 class="sectitle">画面の色</h2>
    <div class="seg" role="group" aria-label="画面の色">${[['auto', '自動'], ['light', 'ライト'], ['dark', 'ダーク']].map(([v, l]) => `<button data-act="theme" data-v="${v}" aria-pressed="${st.theme === v}">${l}</button>`).join('')}</div>
    <h2 class="sectitle">データ</h2>
    <div class="list">
      <a href="#" data-act="openMyMeals" data-back="settings"><span style="flex:1;font-size:15px">マイ食事の編集</span><span class="sub">${IC.chevR()}</span></a>
      <button data-act="exportData"><span class="acc">${IC.download()}</span><span style="flex:1;font-size:15px">バックアップを書き出す</span><span class="sub" style="font-size:12px">${S.lastBackup ? `前回 ${mdLabel(S.lastBackup).md}` : 'まだなし'}</span></button>
      <label><span class="acc">${IC.upload()}</span><span style="flex:1;font-size:15px">バックアップから戻す</span><input type="file" accept="application/json,.json" data-file="backup" hidden></label>
    </div>
    <p class="sub" style="font-size:12px;line-height:1.6;margin-top:4px">記録と写真はこのiPhoneの中だけに保存されます。機種変更の前や月に1回くらい、バックアップを書き出しておくと安心です。</p>
  </div></div>`;
}

function pfcLine(t) {
  return `<span class="sub num" style="font-size:12px">P ${fmt1(t.p)}　F ${fmt1(t.f)}　C ${fmt1(t.c)}</span>`;
}

function myMealsView() {
  const setRows = S.sets.map((s) => {
    const t = setTotals(s);
    return `<button data-act="openSetEdit" data-id="${s.id}" style="min-height:64px;padding-top:10px;padding-bottom:10px">
      <span style="flex:1;min-width:0"><span style="display:block;font-size:15px;font-weight:700">${esc(s.name)}</span><span class="sub" style="display:block;font-size:12px;margin-top:2px;line-height:1.5">${esc(setDetail(s))}</span></span>
      <span class="kcal num"><b style="font-size:18px">${fmtNum(t.kcal)}</b><small> kcal</small></span><span class="sub">${IC.chevR()}</span></button>`;
  }).join('');
  const foodRows = S.foods.filter((f) => !f.hidden).map((f) => `<button data-act="openFoodEdit" data-id="${f.id}" style="min-height:56px">
      <span style="flex:1;min-width:0"><span style="display:block;font-size:15px;font-weight:700">${esc(f.name)}</span>${pfcLine(f)}</span>
      <span class="kcal num"><b style="font-size:18px">${fmtNum(f.kcal)}</b><small> kcal</small></span><span class="sub">${IC.chevR()}</span></button>`).join('');
  return `<div class="page" data-p="myMeals"><div class="inner">
    <div class="head" style="justify-content:flex-start"><button class="iconbtn" data-act="closeMyMeals" aria-label="戻る" style="margin-left:-10px">${IC.chevL(24)}</button><h1>マイ食事</h1></div>
    <div style="display:flex;align-items:center;justify-content:space-between"><h2 class="sectitle">セット<span style="font-weight:500">　単品の組み合わせ</span></h2><button class="pill" data-act="openSetEdit" data-id="">${IC.plus(16)}セット</button></div>
    <div class="list">${setRows}</div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px"><h2 class="sectitle">単品<span style="font-weight:500">　1つ分の数値</span></h2><button class="pill" data-act="openFoodEdit" data-id="">${IC.plus(16)}単品</button></div>
    <div class="list">${foodRows}</div>
    <p class="sub" style="font-size:12px;line-height:1.6">最初の数値はおおよその目安です。セットに入っている単品の数値を直すときは、セットにも反映するかを選べます。</p>
  </div></div>`;
}

function editSetView() {
  const s = U.editSet;
  const t = setTotals(s);
  const rows = s.items.map((it, i) => {
    const f = foodById(it.foodId);
    if (!f) return '';
    return `<div style="min-height:64px;padding-top:8px;padding-bottom:8px">
      <span style="flex:1;min-width:0"><span style="display:block;font-size:15px;font-weight:700">${esc(f.name)}</span><span class="sub num" style="font-size:12px">${fmtNum(f.kcal * it.qty)} kcal</span></span>
      <button class="round" style="width:36px;height:36px;background:var(--mute)" data-act="qtyItem" data-i="${i}" data-d="-0.5" aria-label="${esc(f.name)}を減らす">${IC.minus(18)}</button>
      <b class="num" style="min-width:44px;text-align:center;font-size:18px">×${fmtKg(it.qty)}</b>
      <button class="round" style="width:36px;height:36px;background:var(--mute)" data-act="qtyItem" data-i="${i}" data-d="0.5" aria-label="${esc(f.name)}を増やす">${IC.plus(18)}</button>
      <button class="iconbtn" style="width:36px;margin-right:-8px" data-act="removeSetItem" data-i="${i}" aria-label="${esc(f.name)}を外す">${IC.close(18)}</button></div>`;
  }).join('');
  return `<div class="page" data-p="editSet"><div class="inner">
    <div class="head" style="justify-content:flex-start"><button class="iconbtn" data-act="openPage" data-page="myMeals" aria-label="戻る" style="margin-left:-10px">${IC.chevL(24)}</button><h1>${s.id ? 'セットを編集' : 'セットを作る'}</h1></div>
    <div class="field"><label for="es_name">名前</label><input id="es_name" data-es="name" value="${esc(s.name)}" placeholder="例：朝食セット" style="font-size:17px;font-weight:700;text-align:right"></div>
    <div class="soft" style="padding:14px 16px;border-radius:16px;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">
      <span class="sub" style="font-size:12px">合計</span><b class="num" style="font-size:28px;line-height:1">${fmtNum(t.kcal)}</b><span class="num sub" style="font-size:13px">kcal</span><span style="margin-left:auto">${pfcLine(t)}</span></div>
    <h2 class="sectitle">中身<span style="font-weight:500">　−／＋で0.5ずつ</span></h2>
    ${s.items.length ? `<div class="list">${rows}</div>` : '<p class="empty-note">まだ何も入っていません</p>'}
    <button class="btn softbtn sm" data-act="openPicker">${IC.plus(18)}単品を追加</button>
    ${s.id ? `<button data-act="deleteSetDef" class="sub" style="display:flex;align-items:center;gap:6px;font-size:14px;min-height:44px;align-self:flex-start">${IC.trash(18)}このセットを削除</button>` : ''}
  </div></div>
  <div class="footer"><button class="btn" data-act="saveSetDef">保存</button></div>
  ${U.picker ? pickerView() : ''}`;
}

function pickerView() {
  return `<div class="sheet-scrim" data-act="closePicker"></div>
  <section class="sheet" role="dialog" aria-label="単品を追加" style="max-height:78dvh;overflow-y:auto">
    <div class="grab"></div>
    <div style="display:flex;align-items:center;justify-content:space-between"><h2 style="font-size:17px">単品を追加</h2>
      <button class="pill" data-act="newFoodForSet">${IC.plus(16)}新しい単品</button></div>
    <div class="list">${S.foods.filter((f) => !f.hidden).map((f) => `<button data-act="pickFood" data-id="${f.id}"><span style="flex:1;font-size:15px">${esc(f.name)}</span><span class="kcal num"><b style="font-size:16px">${fmtNum(f.kcal)}</b><small> kcal</small></span></button>`).join('')}</div>
  </section>`;
}

function editFoodView() {
  const m = U.editFood;
  const used = m.id ? S.sets.filter((s) => s.items.some((i) => i.foodId === m.id)).map((s) => s.name) : [];
  return `<div class="page" data-p="editFood"><div class="inner">
    <div class="head" style="justify-content:flex-start"><button class="iconbtn" data-act="closeFoodEdit" aria-label="戻る" style="margin-left:-10px">${IC.chevL(24)}</button><h1>${m.id ? '単品を編集' : '単品を追加'}</h1></div>
    <div class="field"><label for="em_name">名前</label><input id="em_name" data-em="name" value="${esc(m.name)}" placeholder="例：鶏もも肉 100g" style="font-size:17px;font-weight:700;text-align:right"></div>
    <p class="sub" style="font-size:12px;margin:0 2px">1つ分の数値を入れてください</p>
    <div class="field"><label for="em_kcal">kcal</label><input id="em_kcal" class="num" inputmode="decimal" data-em="kcal" value="${esc(m.kcal)}" placeholder="0" style="font-size:28px"></div>
    <div class="pfc3">${['p', 'f', 'c'].map((k) => `<label><b class="num">${k.toUpperCase()}</b><input class="num" inputmode="decimal" data-em="${k}" value="${esc(m[k])}" placeholder="0"></label>`).join('')}</div>
    ${used.length ? `<p class="sub" style="font-size:12px;line-height:1.6">使っているセット：${esc(used.join('、'))}</p>` : ''}
    ${m.id ? `<button data-act="deleteFood" class="sub" style="display:flex;align-items:center;gap:6px;font-size:14px;min-height:44px;align-self:flex-start">${IC.trash(18)}この単品を削除</button>` : ''}
  </div></div>
  <div class="footer"><button class="btn" data-act="saveFood">保存</button></div>`;
}

function pageView() {
  switch (U.page) {
    case 'mealInput': return mealInputView();
    case 'quickAdd': return quickAddView();
    case 'workout': return S.active ? workoutView() : trainView();
    case 'done': return doneView();
    case 'photos': return photosView();
    case 'progress': return progressView();
    case 'settings': return settingsView();
    case 'myMeals': return myMealsView();
    case 'editSet': return editSetView();
    case 'editFood': return editFoodView();
    default: return '';
  }
}

/* ---------- Claudeに聞く ---------- */
function profileLine() {
  const st = S.settings;
  const t = targets();
  const ph = PHASES.find((x) => x.id === st.phase).label;
  return `【私】${st.age}歳・男性・身長${st.height}cm・体重${fmt1(t.weight)}kg（週平均）・${ph}。目標は細身のまま胸・肩・腕に筋肉をつけ、腹筋が見える体。\n【1日の目標】${t.kcal}kcal・P${t.p}g・F${t.f}g・C${t.c}g`;
}
function mealsText(key) {
  return SLOTS.map((s) => {
    const it = slotItems(key, s.id);
    return it.length ? `${s.label}：${it.map((i) => `${i.name}(${Math.round(i.kcal)})`).join('、')}` : `${s.label}：なし`;
  }).join('\n');
}
function totalsText(key) {
  const x = dayTotals(key);
  return `${fmtNum(x.kcal)}kcal・P${Math.round(x.p)}g・F${Math.round(x.f)}g・C${Math.round(x.c)}g`;
}
// 相談の内容：記録（共通の前置き）＋ 選んだ相談テーマの質問
function buildAsk(who) {
  const tab = U.page ? pageTab() : U.tab;
  if (who === 'meal') {
    const k = U.date;
    const y = addDays(k, -1);
    const morning = new Date().getHours() < 11 && dayTotals(k).kcal === 0;
    return {
      who, desc: '今日の食事の記録といっしょに、Claudeに送ります', sel: 0,
      base: `${persona('meal')}\n\n${profileLine()}\n\n【${mdLabel(k).md}の食事】\n${mealsText(k)}\n合計 ${totalsText(k)}\n\n【前日の合計】${totalsText(y)}`,
      topics: [
        { label: 'おすすめの食事メニュー', q: morning ? '前日の振り返りと、今日の食事プランを提案して。' : '今日の残りの食事で、目標に近づくおすすめメニューを教えて。' },
        { label: '今日の食事の評価', q: '今日の食事を評価して。よかった点と、次に気をつけるとよい点を短く教えて。' },
        { label: '外食・コンビニで選ぶなら？', q: 'これから外食かコンビニで食べるなら、目標に合うおすすめを具体的に教えて。' },
      ],
    };
  }
  if (tab === 'record') {
    const l = weightList().slice(-21);
    const wa = weekAvgNow();
    const mc = monthlyChange();
    const g = goal();
    const ph = PHASES.find((x) => x.id === S.settings.phase);
    return {
      who, desc: '体重の記録といっしょに、Claudeに送ります', sel: 0,
      base: `${persona('trainer')}\n\n${profileLine()}\n\n【最近の体重】\n${l.length ? l.map((x) => `${mdLabel(x.date).md} ${fmt1(x.kg)}kg`).join('\n') : 'まだ記録なし'}\n週平均：${wa != null ? fmt1(wa) + 'kg' : '—'}　4週間の変化：${mc != null ? (mc >= 0 ? '+' : '') + fmt1(mc) + 'kg' : '—'}\n\n【期間と目標】${ph.label} ${mdLabel(g.start).md}〜${mdLabel(g.end).md}（あと${Math.max(0, g.left)}日）　目標 ${fmt1(g.target)}kg　今日の目安 ${fmt1(g.expect)}kg`,
      topics: [
        { label: '体重の推移を見てほしい', q: 'この推移を見て、食事やトレーニングで調整すべき点を教えて。' },
        { label: '目標までのペースは大丈夫？', q: '目標体重に対して、今のペースで大丈夫？ 足りない・速すぎるなら、どう調整すればいいか教えて。' },
        { label: '伸び悩んでるときは？', q: '体重やトレーニングの記録が伸び悩んでいる気がする。見直すポイントを優先順に教えて。' },
      ],
    };
  }
  const menu = S.active ? MENUS.find((m) => m.id === S.active.menuId) : currentMenu();
  const curEx = S.active ? EXERCISES[S.active.exercises[S.active.idx].exId].name : '';
  const recent = S.workouts.slice(-3).map((w) => `${mdLabel(w.date).md} ${MENUS.find((m) => m.id === w.menuId).name}：` + w.exercises.map((ex) => `${EXERCISES[ex.exId].name} ${EXERCISES[ex.exId].kind === 'bodyweight' ? bwLabel(ex.weight) : fmtKg(ex.weight) + 'kg'} ${ex.sets.filter((s) => s.done).map((s) => s.reps).join('/')}`).join('、')).join('\n');
  const plan = planFor(menu).map((p) => `${EXERCISES[p.exId].name} ${EXERCISES[p.exId].kind === 'bodyweight' ? bwLabel(p.weight) : fmtKg(p.weight) + 'kg'} ${p.sets}×${p.repMax ? `${p.repMin}-${p.repMax}` : '限界'}`).join('\n');
  return {
    who, desc: 'トレーニングの記録といっしょに、Claudeに送ります', sel: 0,
    base: `${persona('trainer')}\n\n${profileLine()}\n\n【${S.active ? '今日' : '次'}のメニュー：${menu.name}】\n${plan}${curEx ? `\n（いまやっている種目：${curEx}）` : ''}\n\n【最近のトレーニング】\n${recent || 'まだ記録なし'}`,
    topics: [
      { label: 'トレーニングで意識することは？', q: '今日のメニューで、フォームや意識するポイントを種目ごとに短く教えて。' },
      { label: '筋肉痛があるんだけど…', q: '筋肉痛が残っているんだけど、今日のトレーニングはどうするのがいい？\n痛い部位と程度：【ここに書く】' },
      { label: '器具が埋まってる！代わりの種目は？', q: `器具が埋まっていて「${curEx || '【種目名】'}」ができない。同じ部位を鍛えられる代わりの種目を、重さと回数の目安つきで教えて。` },
    ],
  };
}
const chatUrl = (who) => (S.settings.chatUrl || {})[who] || '';
const askText = (a) => (a.topics ? `${a.base}\n\n${a.topics[a.sel].q}` : a.text);

function askView() {
  const a = U.ask;
  const c = CHARACTERS[a.who];
  return `<div class="scrim" data-act="closeAsk"></div>
  <section class="dialog" role="dialog" aria-label="Claudeに聞く">
    <div style="display:flex;align-items:center;gap:12px">
      ${isRobot() ? `<span style="width:52px;height:52px;border-radius:50%;background:var(--mute);border:2px solid var(--accent);display:flex;align-items:center;justify-content:center;flex:none">${robotSVG(a.who, 38)}</span>` : `<span class="ava" style="background-image:url(assets/char/v2/${a.who}1-normal.webp);${a.who === 'meal' ? 'background-size:140% auto;background-position:50% 6%' : 'background-size:139% auto;background-position:71% 6.9%'}" aria-hidden="true"></span>`}
      <h2 style="font-size:20px">相談してみる？</h2>
    </div>
    ${a.topics ? `<div class="topics" role="radiogroup" aria-label="相談したいこと">
      <span class="sub" style="font-size:13px;font-weight:700">相談したいことは？</span>
      ${a.topics.map((t, i) => `<button class="topic${i === a.sel ? ' on' : ''}" data-act="askTopic" data-i="${i}" role="radio" aria-checked="${i === a.sel}"><span class="tp-dot"></span>${esc(t.label)}</button>`).join('')}
    </div>` : ''}
    <p class="sub" style="font-size:12px;line-height:1.6">${esc(a.desc)}</p>
    <div class="pre">${esc(askText(a))}</div>
    ${chatUrl(a.who) && a.topics
      ? `<button class="btn" data-act="goClaude" data-same="1">いつものチャットで聞く</button>
         <p class="sub" style="font-size:12px;text-align:center;margin-top:-6px">相談文をコピーしてチャットを開きます。入力欄に貼り付けて送ってね</p>
         <div class="g2"><button class="btn ghost" data-act="closeAsk">やめる</button><button class="btn ghost" data-act="goClaude">新しいチャットで</button></div>`
      : '<div class="g2"><button class="btn ghost" data-act="closeAsk">やめる</button><button class="btn" data-act="goClaude">聞く</button></div>'}
  </section>`;
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* 失敗時は下の方法で */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    return true;
  } catch (e) { return false; }
}
function openClaude(text) {
  copyText(text);
  const url = 'https://claude.ai/new?q=' + encodeURIComponent(text);
  const w = window.open(url, '_blank');
  if (!w) location.href = url;
}

/* ================= 操作 ================= */
const A = {
  tab(d) { U.tab = d.tab; U.talk = { meal: 0, trainer: 0 }; U.showNext = false; U.said = {}; _msgCache = {}; U.weightDraft = null; render(); window.scrollTo(0, 0); },
  day(d) { const n = addDays(U.date, Number(d.d)); if (n <= today()) { U.date = n; U.said.meal = null; render(); } },
  openPage(d) { U.page = d.page; if (d.page === 'quickAdd') U.quick = { text: '', kcal: '', p: '', f: '', c: '', save: false }; render(); },
  closePage() {
    const back = U.page === 'mealInput' || U.page === 'quickAdd' ? 'meal' : ['photos', 'settings', 'progress'].includes(U.page) ? 'record' : U.tab;
    if (U.page === 'settings' && U.tab === 'meal') { U.page = null; render(); return; }
    U.page = null; U.tab = back; render();
  },
  openSlot(d) { U.slot = d.slot; U.sel = {}; U.page = 'mealInput'; render(); },
  toggleMeal(d) { U.sel[d.id] = ((U.sel[d.id] || 0) + 1); if (U.sel[d.id] > 3) delete U.sel[d.id]; render(); },
  clearSel() { U.sel = {}; render(); },
  saveSel() {
    const first = U.date === today() && !hasMeal(today());
    const day = dayMeals(U.date);
    const add = Object.entries(U.sel).flatMap(([key, n]) => {
      const m = entryFor(key);
      return m ? Array(n).fill(0).map(() => ({ ...m })) : [];
    });
    day[U.slot] = (day[U.slot] || []).concat(add);
    save();
    U.sel = {}; U.page = null; U.tab = 'meal';
    U.said.meal = mealRecordLine();
    newScene();
    if (U.date === today()) celebrate('meal', first);
    render();
  },
  copyPrev() {
    const prev = prevSameSlot(U.date, U.slot);
    if (!prev) return;
    const first = U.date === today() && !hasMeal(today());
    const day = dayMeals(U.date);
    day[U.slot] = (day[U.slot] || []).concat(prev.items.map((i) => ({ ...i })));
    save();
    U.page = null; U.tab = 'meal';
    U.said.meal = mealRecordLine();
    newScene();
    if (U.date === today()) celebrate('meal', first);
    render();
  },
  editItem(d) {
    const it = slotItems(U.date, U.slot)[Number(d.i)];
    if (!it) return;
    U.editItem = { i: Number(d.i), slot: U.slot, to: U.slot, qty: it.qty || 1 };
    render();
  },
  closeEditItem() { U.editItem = null; render(); },
  itemQty(d) { U.editItem.qty = Math.max(0.5, +(U.editItem.qty + Number(d.d)).toFixed(1)); render(); },
  itemSlot(d) { U.editItem.to = d.slot; render(); },
  itemSave() {
    const ed = U.editItem;
    const day = dayMeals(U.date);
    const it = day[ed.slot][ed.i];
    if (!it.base) { const q = it.qty || 1; it.base = { kcal: it.kcal / q, p: it.p / q, f: it.f / q, c: it.c / q }; }
    it.qty = ed.qty;
    ['kcal', 'p', 'f', 'c'].forEach((k) => { it[k] = +(it.base[k] * ed.qty).toFixed(1); });
    if (ed.to !== ed.slot) {
      day[ed.slot].splice(ed.i, 1);
      day[ed.to] = (day[ed.to] || []).concat(it);
    }
    save(); U.editItem = null;
    toast(ed.to !== ed.slot ? `${SLOTS.find((x) => x.id === ed.to).label}に移したよ` : '変更したよ');
  },
  itemDel() {
    const ed = U.editItem;
    dayMeals(U.date)[ed.slot].splice(ed.i, 1);
    save(); U.editItem = null; toast('削除したよ');
  },
  removeItem(d) { const day = dayMeals(U.date); day[U.slot].splice(Number(d.i), 1); save(); render(); },
  askFood() {
    const q = U.quick;
    if (!q.text.trim()) { toast('食べたものを入力してね'); return; }
    U.ask = { who: 'meal', desc: '食べたものをコピーして、Claudeを開きます', text: `${persona('meal')}\n\n次の食事のカロリーとPFCを推定してください。最後の行に「kcal: ○ / P: ○ / F: ○ / C: ○」の形で数字だけを書いてください。\n\n食べたもの：${q.text.trim()}` };
    render();
  },
  async pasteNums() {
    try {
      const raw = await navigator.clipboard.readText();
      // 全角数字を半角に、「1,250」のカンマを取る
      const t = raw.replace(/[０-９．]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)).replace(/(\d),(?=\d{3}(?!\d))/g, '$1');
      const parse = (s) => {
        const get = (re) => { const m = s.match(re); return m ? m[1] : ''; };
        return {
          kcal: get(/([\d.]+)\s*kcal/i) || get(/kcal\s*[:：]?\s*([\d.]+)/i),
          p: get(/(?:^|[^A-Za-z])P\s*[:：]?\s*([\d.]+)/), f: get(/(?:^|[^A-Za-z])F\s*[:：]?\s*([\d.]+)/), c: get(/(?:^|[^A-Za-z])C\s*[:：]?\s*([\d.]+)/),
        };
      };
      // 最後の行から順に、kcalが書いてある行を探す
      let kcal = '', p = '', f = '', c = '';
      const lines = t.split(/\n/).map((l) => l.trim()).filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        const r = parse(lines[i]);
        if (r.kcal) { ({ kcal, p, f, c } = r); break; }
      }
      if (!kcal) {
        const nums = (lines.length ? lines[lines.length - 1] : '').match(/[\d.]+/g) || [];
        if (nums.length >= 4) [kcal, p, f, c] = nums.slice(-4);
      }
      if (!kcal) { toast('数字が見つからなかったよ'); return; }
      Object.assign(U.quick, { kcal, p, f, c });
      render();
    } catch (e) { toast('貼り付けできなかったので、手で入力してね'); }
  },
  saveQuick() {
    const q = U.quick;
    const n = (v) => Number(String(v).replace(/[^\d.]/g, '')) || 0;
    if (!n(q.kcal)) { toast('kcalを入力してね'); return; }
    const name = q.text.trim().slice(0, 30) || '外食・その他';
    const item = { name, kcal: n(q.kcal), p: n(q.p), f: n(q.f), c: n(q.c) };
    const first = U.date === today() && !hasMeal(today());
    const day = dayMeals(U.date);
    day[U.slot] = (day[U.slot] || []).concat([item]);
    if (q.save) S.foods.push({ id: 'f_' + Date.now(), ...item });
    save();
    U.page = null; U.tab = 'meal';
    U.said.meal = mealRecordLine();
    newScene();
    if (U.date === today()) celebrate('meal', first);
    render();
  },

  pickMenu(d) { if (S.active) return; S.nextMenu = Number(d.i); save(); U.said.train = null; _msgCache = {}; render(); },
  resetCycle() { resetCycle(); U.said.train = null; _msgCache = {}; toast(isRobot() ? 'チェックをリセットしました' : 'チェックをリセットしました。また1週間がんばりましょ！'); },
  startWorkout() { if (!S.active) startWorkout(); _msgCache = {}; U.page = 'workout'; U.said.workout = null; render(); window.scrollTo(0, 0); },
  doneSet() {
    const a = S.active;
    const ex = a.exercises[a.idx];
    const i = ex.sets.findIndex((s) => !s.done);
    if (i < 0) return;
    const s = ex.sets[i];
    s.done = true;
    if (s.chal) {
      // 自己ベストを超えたか（記録に残る自己ベストと同じ計算）
      const bw = EXERCISES[ex.exId].kind === 'bodyweight';
      const best = bestScore(ex.exId);
      s.chalOk = best != null && e1rm(bw ? bodyKg() + (setW(ex, s) || 0) : setW(ex, s), s.reps) > best + 1e-6;
      if (s.chalOk) U.chal = { exId: ex.exId, label: chalText(ex.exId, setW(ex, s), s.reps), line: pick(T.chalWin) };
    }
    afterSet();
    if (s.chal && !s.chalOk && !U.clear) { U.said.workout = pick(T.chalLose); render(); }
  },
  editSet(d) {
    const ex = S.active.exercises[S.active.idx];
    const i = Number(d.i);
    U.sheet = { i, reps: ex.sets[i].reps, weight: setW(ex, ex.sets[i]) };
    render();
  },
  sheetReps(d) { U.sheet.reps = Math.max(0, U.sheet.reps + Number(d.d)); render(); },
  sheetSet(d) { U.sheet.reps = Number(d.n); render(); },
  sheetW(d) {
    const ex = S.active.exercises[S.active.idx];
    const bw = EXERCISES[ex.exId].kind === 'bodyweight';
    U.sheet.weight = Math.max(bw ? -80 : 0, +((U.sheet.weight || 0) + Number(d.d) * incFor(EXERCISES[ex.exId].kind)).toFixed(2));
    render();
  },
  closeSheet() { U.sheet = null; render(); },
  sheetSave() {
    const a = S.active;
    const ex = a.exercises[a.idx];
    const s = ex.sets[U.sheet.i];
    s.reps = U.sheet.reps;
    s.w = U.sheet.weight;
    // このあとのセットも、直した数字から始める
    // チャレンジのセットだけは特別な重さ・回数なので、ほかのセットにはうつさない
    if (!s.chal) ex.sets.forEach((x, j) => { if (j > U.sheet.i && !x.done) { x.w = s.w; x.reps = s.reps; } });
    U.sheet = null;
    save(); render();
  },
  goEx(d) { S.active.idx = Number(d.i); U.said.workout = null; save(); render(); document.querySelector('.page') && (document.querySelector('.page').scrollTop = 0); },
  clearNext(d) {
    const a = S.active;
    const ni = nextIdx(a, U.clear.idx);
    U.clear = null;
    if (ni >= 0) a.idx = ni;
    a.restWarned = false;
    if (d.rest) { a.restDur = S.settings.rest; a.restEnd = Date.now() + S.settings.rest * 1000; U.said.workout = pick(T.restStart); }
    else { a.restEnd = null; U.said.workout = null; }
    save(); render();
  },
  clearClose() { U.clear = null; render(); },
  openTitle() { U.title = { played: false }; render(); },
  closeTitle() {
    const el = document.querySelector('.title-screen');
    U.title = null;
    syncChrome();
    if (el) { el.classList.add('out'); setTimeout(() => { el.remove(); }, 380); } else render();
  },
  closeFx() { clearTimeout(_fxTimer); U.fx = null; render(); },
  chalClose() { U.chal = null; render(); },
  showNext() { U.showNext = true; U.said.train = null; _msgCache = {}; render(); },
  hideNext() { U.showNext = false; render(); },
  restAdd(d) { const a = S.active; a.restEnd = Math.max(Date.now() + 1000, a.restEnd + Number(d.s) * 1000); a.restDur = Math.max(a.restDur, Math.ceil((a.restEnd - Date.now()) / 1000)); save(); render(); },
  restSkip() { S.active.restEnd = null; U.said.workout = null; save(); render(); },
  finishWorkout() {
    const any = S.active && S.active.exercises.some((ex) => ex.sets.some((s) => s.done));
    if (!any) {
      if (!confirm('まだ1セットも記録していないよ。トレーニングを中止する？')) return;
      S.active = null; save(); U.page = null; U.tab = 'train'; render(); return;
    }
    const left = S.active.exercises.reduce((a, ex) => a + ex.sets.filter((s) => !s.done).length, 0);
    if (left && !confirm(isRobot() ? `まだ${left}セット残っています。トレーニングを終えて記録しますか？` : `まだ${left}セット残ってるよ。ここで終えて記録する？`)) return;
    U.clear = null;
    keepAwake(false);
    const rec = finishWorkout();
    U.showNext = false;
    U.doneRec = rec; U.doneSay = null; U.page = 'done'; render(); window.scrollTo(0, 0);
  },
  closeDone() { U.page = null; U.tab = 'train'; U.doneRec = null; U.said = {}; render(); },

  wAdj(d) {
    const base = U.weightDraft ?? S.weights[today()] ?? (latestWeight() ? latestWeight().kg : S.settings.baseWeight);
    U.weightDraft = +(base + Number(d.d)).toFixed(1);
    render();
  },
  saveWeight() {
    const v = U.weightDraft ?? S.weights[today()] ?? (latestWeight() ? latestWeight().kg : S.settings.baseWeight);
    const had = S.weights[today()] != null;
    const prev = weightList().filter((x) => x.date !== today()).pop();
    S.weights[today()] = +v.toFixed(1);
    U.weightDraft = null;
    U.comeback = false;
    save();
    U.said.record = had ? R('更新したよ！', '更新しました。') : pick(R(['記録ありがと！今日もいい一日にしよ！', 'ナイス！毎朝の記録、えらいよ！'], ['記録しました。今日もがんばりましょう。', '毎朝の記録、続いています。']));
    U.said.recordMeal = weighLine(prev ? S.weights[today()] - prev.kg : null);
    newScene();
    celebrate('weight', !had);
    render();
  },

  openProgress(d) { U.progEx = d.id || U.progEx || null; U.ptSel = null; U.page = 'progress'; render(); },
  progEx(d) { U.progEx = d.id; U.ptSel = null; render(); },
  ptSel(d) { U.ptSel = Number(d.i); render(); },
  pose(d) { U.pose = d.v; U.photoSel = null; render(); },
  photoSel(d) { U.photoSel = Number(d.id); render(); },
  async delPhoto() {
    const { cur } = photoPair();
    if (!cur || !confirm('この写真を削除する？')) return;
    await photoDel(cur.id);
    URL.revokeObjectURL(cur.url);
    PHOTOS = PHOTOS.filter((p) => p.id !== cur.id);
    U.photoSel = null; render();
  },
  async sharePhotos() {
    const { cur, base } = photoPair();
    if (!cur) return;
    const wa = weekAvgNow();
    const text = `${persona('trainer')}\n\n${profileLine()}\n\n体型写真（${U.pose === 'front' ? '正面' : '横'}）を送ります。${base ? `1枚目が${mdLabel(base.date).md}、2枚目が${mdLabel(cur.date).md}です。` : `${mdLabel(cur.date).md}の写真です。`}\n週平均体重：${wa != null ? fmt1(wa) + 'kg' : '—'}\n\n見た目の変化を教えて。そのうえで、トレーニングメニューと食事の調整を提案して。`;
    const files = [base, cur].filter(Boolean).map((p) => new File([p.blob], `body-${p.date}-${p.pose}.jpg`, { type: 'image/jpeg' }));
    if (navigator.canShare && navigator.canShare({ files })) {
      await copyText(text);
      try { await navigator.share({ files, text }); toast('相談文もコピーしたよ'); } catch (e) { /* キャンセル */ }
    } else {
      openClaude(text);
      toast('写真はClaudeで添付してね');
    }
  },

  phase(d) {
    if (S.settings.phase !== d.v) { S.settings.goalStart = today(); S.settings.goalEnd = null; S.settings.goalWeight = null; }
    S.settings.phase = d.v; save(); render();
  },
  goalAuto() { S.settings.goalWeight = null; save(); render(); },
  theme(d) { S.settings.theme = d.v; save(); render(); },
  charMode(d) { setCharMode(d.v); },
  soundMode(d) { S.settings.sound = d.v; save(); audioUnlock(); render(); if (d.v !== 'off') setTimeout(() => chime('end'), 120); },
  restSet(d) { S.settings.rest = Math.min(300, Math.max(30, S.settings.rest + Number(d.d))); save(); render(); },
  openMyMeals(d) { U.mmBack = d.back || 'settings'; U.page = 'myMeals'; render(); },
  closeMyMeals() { U.page = U.mmBack || 'settings'; if (U.page === 'mealInput') U.sel = {}; render(); },
  openSetEdit(d) {
    const s = d.id ? setById(d.id) : null;
    U.editSet = s ? { id: s.id, name: s.name, items: s.items.map((i) => ({ ...i })) } : { id: '', name: '', items: [] };
    U.picker = false; U.page = 'editSet'; render();
  },
  qtyItem(d) { const it = U.editSet.items[Number(d.i)]; it.qty = Math.max(0.5, +(it.qty + Number(d.d)).toFixed(1)); render(); },
  removeSetItem(d) { U.editSet.items.splice(Number(d.i), 1); render(); },
  openPicker() { U.picker = true; render(); },
  closePicker() { U.picker = false; render(); },
  pickFood(d) {
    const ex = U.editSet.items.find((i) => i.foodId === d.id);
    if (ex) ex.qty += 1; else U.editSet.items.push({ foodId: d.id, qty: 1 });
    U.picker = false; render();
  },
  newFoodForSet() { U.picker = false; U.editFood = { id: '', name: '', kcal: '', p: '', f: '', c: '' }; U.foodBack = 'editSet'; U.page = 'editFood'; render(); },
  saveSetDef() {
    const s = U.editSet;
    if (!String(s.name).trim()) { toast('名前を入力してね'); return; }
    if (!s.items.length) { toast('単品を1つ以上入れてね'); return; }
    const rec = { id: s.id || 's_' + Date.now(), name: String(s.name).trim(), items: s.items.map((i) => ({ ...i })) };
    const i = S.sets.findIndex((x) => x.id === rec.id);
    if (i >= 0) S.sets[i] = rec; else S.sets.push(rec);
    save(); U.page = 'myMeals'; toast('保存したよ');
  },
  deleteSetDef() {
    if (!confirm('このセットを削除する？（記録済みの食事は消えません）')) return;
    S.sets = S.sets.filter((x) => x.id !== U.editSet.id);
    save(); U.page = 'myMeals'; render();
  },
  openFoodEdit(d) {
    const f = d.id ? foodById(d.id) : null;
    U.editFood = f ? { ...f } : { id: '', name: '', kcal: '', p: '', f: '', c: '' };
    U.foodBack = 'myMeals'; U.page = 'editFood'; render();
  },
  closeFoodEdit() { U.page = U.foodBack || 'myMeals'; render(); },
  saveFood() {
    const m = U.editFood;
    const n = (v) => Number(String(v).replace(/[^\d.]/g, '')) || 0;
    if (!String(m.name).trim()) { toast('名前を入力してね'); return; }
    const rec = { id: m.id || 'f_' + Date.now(), name: String(m.name).trim(), kcal: n(m.kcal), p: n(m.p), f: n(m.f), c: n(m.c) };
    const old = m.id ? foodById(m.id) : null;
    const used = old ? S.sets.filter((s) => s.items.some((i) => i.foodId === old.id)) : [];
    const changed = old && ['kcal', 'p', 'f', 'c'].some((k) => old[k] !== rec[k]);
    if (used.length && changed) { U.linkAsk = { rec, sets: used.map((s) => s.name) }; render(); return; }
    commitFood(rec, true);
  },
  linkYes() { const r = U.linkAsk.rec; U.linkAsk = null; commitFood(r, true); },
  linkNo() { const r = U.linkAsk.rec; U.linkAsk = null; commitFood(r, false); },
  linkCancel() { U.linkAsk = null; render(); },
  deleteFood() {
    const id = U.editFood.id;
    const used = S.sets.filter((s) => s.items.some((i) => i.foodId === id));
    if (!confirm(used.length ? `この単品は「${used.map((s) => s.name).join('、')}」に入っています。セットからも外して削除する？` : 'この単品を削除する？')) return;
    S.foods = S.foods.filter((x) => x.id !== id);
    S.sets.forEach((s) => { s.items = s.items.filter((i) => i.foodId !== id); });
    save(); U.page = 'myMeals'; render();
  },
  async exportData() {
    const photos = await Promise.all(PHOTOS.map((p) => new Promise((res) => {
      const r = new FileReader(); r.onload = () => res({ date: p.date, pose: p.pose, data: r.result }); r.readAsDataURL(p.blob);
    })));
    const json = JSON.stringify({ app: 'bodyapp', exportedAt: new Date().toISOString(), state: S, photos });
    const name = `mukimemo-backup-${today()}.json`;
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); S.lastBackup = today(); save(); render(); } catch (e) { /* キャンセル */ }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    S.lastBackup = today(); save();
    toast('書き出したよ');
  },

  nextLine(d, el) {
    const slot = d.slot;
    let pool = linePool(slot);
    // たくさんタップして話しかけ続けると、デレる（6回目でキュン、12回目でキュンキュン）
    const who = slot === 'meal' || slot === 'recordMeal' ? 'meal' : 'trainer';
    if (!U.talk) U.talk = { meal: 0, trainer: 0 };
    U.talk[who] += 1;
    const n = U.talk[who];
    const set = who === 'meal' ? ML : T;
    if (n % 12 === 0 && set.dereTalk2) pool = set.dereTalk2;
    else if (n % 6 === 0 && set.dereTalk1) pool = set.dereTalk1;
    if (pool === set.dereTalk1 || pool === set.dereTalk2) _poseFresh[who] = true; // キュン顔が出せるポーズに
    const cur = el.textContent.trim();
    const cands = pool.filter((l) => l !== cur);
    if (!cands.length) return;
    const next = pick(cands);
    if (slot === 'done') U.doneSay = next;
    else if (slot === 'clear') { if (U.clear) U.clear.line = next; }
    else if (slot === 'chal') { if (U.chal) U.chal.line = next; }
    else U.said[slot] = next;
    render();
  },
  ask(d) { U.ask = buildAsk(d.who); render(); },
  closeAsk() { U.ask = null; render(); },
  askTopic(d) { U.ask.sel = Number(d.i); render(); },
  goClaude(d) {
    const a = U.ask;
    U.ask = null;
    if (d.same && chatUrl(a.who)) {
      // いつものチャット：キャラ設定はもう伝わっているので、記録と質問だけを送る
      const t = askText(a).replace(persona(a.who) + '\n\n', '');
      copyText(t);
      render();
      toast(isRobot() ? '相談文をコピーしました。チャットに貼り付けて送ってください' : '相談文をコピーしたよ。チャットに貼り付けて送ってね');
      const w = window.open(chatUrl(a.who), '_blank');
      if (!w) location.href = chatUrl(a.who);
      return;
    }
    render(); openClaude(askText(a));
  },
};

// 単品を保存。link=false のときは、セットに入っている元の数値を「セット専用」として残す
function commitFood(rec, link) {
  const i = S.foods.findIndex((x) => x.id === rec.id);
  if (i >= 0 && !link) {
    S.foods[i] = { ...S.foods[i], hidden: true };
    rec = { ...rec, id: 'f_' + Date.now() };
    S.foods.splice(i + 1, 0, rec);
  } else if (i >= 0) S.foods[i] = rec;
  else S.foods.push(rec);
  save();
  if (U.foodBack === 'editSet' && !U.editFood.id) U.editSet.items.push({ foodId: rec.id, qty: 1 });
  U.page = U.foodBack || 'myMeals';
  toast(link ? '保存したよ' : '保存したよ（セットはそのまま）');
}

function linkAskView() {
  const a = U.linkAsk;
  return `<div class="scrim" data-act="linkCancel"></div>
  <section class="dialog" role="dialog" aria-label="セットにも反映する？">
    <h2 style="font-size:20px">セットにも反映する？</h2>
    <p style="font-size:15px;line-height:1.6">「${esc(a.rec.name)}」は、次のセットに入っています。</p>
    <div class="pre" style="font-size:14px;color:var(--text)">${esc(a.sets.join('\n'))}</div>
    <button class="btn" data-act="linkYes">セットにも反映する</button>
    <button class="btn ghost" data-act="linkNo">セットはそのまま</button>
    <button data-act="linkCancel" class="sub" style="font-size:14px;font-weight:700;min-height:44px">キャンセル</button>
  </section>`;
}

function afterSet() {
  newScene();
  const a = S.active;
  const ex = a.exercises[a.idx];
  const allDone = ex.sets.every((s) => s.done);
  U.comeback = false;
  a.restWarned = false;
  if (allDone) {
    // 種目が終わったら休憩はすぐ始めず、ワンクッション
    a.restEnd = null;
    U.said.workout = null;
    U.clear = buildClear(a.idx);
  } else {
    a.restDur = S.settings.rest;
    a.restEnd = Date.now() + S.settings.rest * 1000;
    U.said.workout = Math.random() < 0.3 ? pick([...T.effort, ...T.muscleDere.slice(0, 3)]) : pick(T.restStart);
  }
  save();
  render();
}

/* ---------- ファイル入力 ---------- */
async function handleFile(kind, file) {
  if (!file) return;
  if (kind === 'photo') {
    const blob = await resizeImage(file, 1280);
    const rec = { date: today(), pose: U.pose, blob };
    const id = await photoAdd(rec);
    PHOTOS.push({ ...rec, id, url: URL.createObjectURL(blob) });
    PHOTOS.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    U.photoSel = null;
    toast(pick([...T.muscleDere, ...T.growth, ...T.hideDere]));
  }
  if (kind === 'backup') {
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== 'bodyapp' || !data.state) throw new Error('bad');
      if (!confirm('バックアップの内容で、今のデータを置き換える？')) return;
      S = { ...defaultState(), ...data.state };
      await kvSet('state', S);
      await photoClear();
      PHOTOS.forEach((p) => URL.revokeObjectURL(p.url));
      PHOTOS = [];
      for (const p of data.photos || []) {
        const blob = await (await fetch(p.data)).blob();
        const id = await photoAdd({ date: p.date, pose: p.pose, blob });
        PHOTOS.push({ id, date: p.date, pose: p.pose, blob, url: URL.createObjectURL(blob) });
      }
      toast('バックアップから戻したよ');
    } catch (e) { toast('このファイルは読み込めなかったよ'); }
  }
}

function resizeImage(file, max) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      cv.toBlob((b) => { URL.revokeObjectURL(img.src); resolve(b); }, 'image/jpeg', 0.85);
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

/* ---------- 休憩タイマーの音 ---------- */
let _ac = null;
function audioUnlock() {
  const mode = S.settings.sound || 'mix';
  if (mode === 'off') return;
  try {
    // mix：音楽や動画と混ぜて鳴らす（マナーモードでは鳴らない） / loud：マナーモードでも鳴らす（再生中の音楽は止まる）
    if (navigator.audioSession) navigator.audioSession.type = mode === 'loud' ? 'playback' : 'ambient';
    if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
    if (_ac.state === 'suspended') _ac.resume();
  } catch (e) { /* 音が出せない環境では何もしない */ }
}
function chime(kind) {
  if ((S.settings.sound || 'mix') === 'off' || !_ac) return;
  try {
    if (_ac.state === 'suspended') _ac.resume();
    const t0 = _ac.currentTime + 0.02;
    const notes = kind === 'tick' ? [[1046, 0, 0.12]] : [[784, 0, 0.35], [1046, 0.16, 0.35], [1318, 0.32, 0.5], [1568, 0.5, 0.7]];
    notes.forEach(([f, d, len]) => {
      const o = _ac.createOscillator(), g = _ac.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + d);
      g.gain.exponentialRampToValueAtTime(kind === 'tick' ? 0.25 : 0.5, t0 + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + len);
      o.connect(g).connect(_ac.destination);
      o.start(t0 + d); o.stop(t0 + d + len + 0.05);
    });
  } catch (e) { /* 何もしない */ }
}
// トレーニング中は画面を消さない（消えるとタイマーも音も止まるため）
let _wake = null;
async function keepAwake(on) {
  try {
    if (on && !_wake && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      _wake = await navigator.wakeLock.request('screen');
      _wake.addEventListener('release', () => { _wake = null; });
    } else if (!on && _wake) { await _wake.release(); _wake = null; }
  } catch (e) { _wake = null; }
}

/* ---------- 並べ替え ---------- */
function reorder(kind, from, to) {
  const move = (arr) => { const [x] = arr.splice(from, 1); arr.splice(to, 0, x); return arr; };
  if (kind === 'plan') {
    const menu = currentMenu();
    saveMenuOrder(menu.id, move(menuItems(menu).map((it) => it[0])));
  } else if (kind === 'workout') {
    const a = S.active;
    const cur = a.exercises[a.idx];
    move(a.exercises);
    a.idx = a.exercises.indexOf(cur);
    saveMenuOrder(a.menuId, a.exercises.map((x) => x.exId));
  }
  if (navigator.vibrate) navigator.vibrate(10);
  save(); render();
}

/* ---------- イベント ---------- */
function bindEvents() {
  const root = document.getElementById('app');
  // ⠿ をドラッグして並べ替え
  root.addEventListener('pointerdown', (ev) => {
    const grip = ev.target.closest('.grip');
    if (!grip) return;
    const list = grip.closest('[data-sortable]');
    const row = grip.closest('[data-sort-i]');
    if (!list || !row) return;
    ev.preventDefault();
    const rows = [...list.querySelectorAll(':scope > [data-sort-i]')];
    const from = rows.indexOf(row);
    const mids = rows.map((r) => { const b = r.getBoundingClientRect(); return b.top + b.height / 2; });
    const h = row.getBoundingClientRect().height + 6;
    const y0 = ev.clientY;
    let to = from;
    row.classList.add('dragging');
    try { grip.setPointerCapture(ev.pointerId); } catch (e) { /* なくても動く */ }
    const move = (e) => {
      const dy = e.clientY - y0;
      row.style.transform = `translateY(${dy}px)`;
      const y = mids[from] + dy;
      to = from;
      mids.forEach((m, i) => { if (i < from && y < m) to = Math.min(to, i); if (i > from && y > m) to = Math.max(to, i); });
      rows.forEach((r, i) => {
        if (r === row) return;
        r.style.transform = from < to && i > from && i <= to ? `translateY(${-h}px)` : from > to && i < from && i >= to ? `translateY(${h}px)` : '';
      });
    };
    const up = () => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      grip.removeEventListener('pointercancel', up);
      if (to !== from) reorder(list.dataset.sortable, from, to);
      else render();
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', up);
  });

  // キャラを長押し → 女の子／ロボットの表示を切り替え
  let lpTimer = null, lpX = 0, lpY = 0, lpFired = false;
  const lpCancel = () => { clearTimeout(lpTimer); lpTimer = null; };
  root.addEventListener('pointerdown', (ev) => {
    const ch = ev.target.closest('.char');
    if (!ch) return;
    lpFired = false; lpX = ev.clientX; lpY = ev.clientY;
    lpTimer = setTimeout(() => {
      lpTimer = null; lpFired = true;
      if (navigator.vibrate) navigator.vibrate(20);
      setCharMode(isRobot() ? 'girl' : 'robot');
    }, 550);
  });
  root.addEventListener('pointermove', (ev) => { if (lpTimer && Math.hypot(ev.clientX - lpX, ev.clientY - lpY) > 10) lpCancel(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => root.addEventListener(t, lpCancel));
  root.addEventListener('contextmenu', (ev) => { if (ev.target.closest('.char')) ev.preventDefault(); });
  root.addEventListener('click', (ev) => {
    // トレーニング中は、タップのたびに音の準備と「画面を消さない」をしておく（iPhoneはタップのときしか音を鳴らす準備ができないため）
    if (S.active) { audioUnlock(); keepAwake(true); }
    if (lpFired) { lpFired = false; if (ev.target.closest('.char')) return; }
    const el = ev.target.closest('[data-act]');
    if (!el || el.disabled) return;
    if (el.tagName === 'A') ev.preventDefault();
    const fn = A[el.dataset.act];
    if (fn) fn(el.dataset, el, ev);
  });
  root.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.dataset.q) U.quick[el.dataset.q] = el.type === 'checkbox' ? el.checked : el.value;
    if (el.dataset.em) U.editFood[el.dataset.em] = el.value;
    if (el.dataset.es) U.editSet[el.dataset.es] = el.value;
  });
  root.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.dataset.q && el.type === 'checkbox') U.quick.save = el.checked;
    if (el.dataset.chat) {
      if (!S.settings.chatUrl) S.settings.chatUrl = {};
      const v = el.value.trim();
      // 使えるのはチャットそのもののURL（claude.ai/chat/…）。共有リンク（claude.ai/share/…）は読むだけのコピーなので使えない
      S.settings.chatUrl[el.dataset.chat] = /^https:\/\/claude\.ai\/chat\/[\w-]+/.test(v) ? v : '';
      if (v && !S.settings.chatUrl[el.dataset.chat]) {
        toast(/\/share\//.test(v)
          ? (isRobot() ? '共有リンクは使えません。claude.ai/chat/… のURLを入力してください' : '共有リンクは使えないの。claude.ai/chat/… のURLを入れてね')
          : (isRobot() ? 'claude.ai/chat/… のURLを入力してください' : 'claude.ai/chat/… のURLを入れてね'));
        el.value = '';
      }
      save();
    }
    if (el.dataset.goal) {
      const k = el.dataset.goal;
      if (k === 'goalWeight') { const v = Number(el.value); S.settings.goalWeight = v > 0 ? v : null; }
      else if (/^\d{4}-\d{2}-\d{2}$/.test(el.value)) S.settings[k] = el.value;
      save(); render();
    }
    if (el.dataset.set) {
      const v = Number(el.value);
      if (!Number.isNaN(v) && v > 0) { S.settings[el.dataset.set] = v; save(); render(); }
    }
    if (el.dataset.file) { const f = el.files && el.files[0]; el.value = ''; handleFile(el.dataset.file, f).then(render); }
  });
  // 休憩タイマー
  setInterval(() => {
    const a = S.active;
    if (!a || !a.restEnd) return;
    const left = Math.ceil((a.restEnd - Date.now()) / 1000);
    if (left <= 0) {
      a.restEnd = null; save();
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      chime('end');
      U.said.workout = pick(T.restEnd);
      render(); return;
    }
    if (left <= 3 && a.lastBeep !== left) { a.lastBeep = left; chime('tick'); }
    if (U.page !== 'workout') return;
    // 残り10秒で声かけ
    if (left <= 10 && !a.restWarned) { a.restWarned = true; U.said.workout = pick(T.restEnd); render(); return; }
    // 休憩の途中は雑談
    if (left <= a.restDur - 15 && U.said.workout && T.restStart.includes(U.said.workout)) { U.said.workout = null; render(); return; }
    const t = document.getElementById('restT');
    const b = document.getElementById('restBar');
    if (t) t.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    if (b) b.style.width = `${(left / a.restDur) * 100}%`;
  }, 250);
  // 日付が変わったら今日に合わせる
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { if (U.date < today() && !U.page) U.date = today(); render(); }
  });
}

/* ---------- 起動 ---------- */
(async function boot() {
  try {
    await loadState();
    preloadChars();
    if (S.lastTitle !== today()) { U.title = { played: false }; S.lastTitle = today(); save(); }
    // データを消されにくくする（iPhoneの容量が少なくなったときなど）
    try { if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch (e) { /* 対応していなくてもOK */ }
    const ps = await photoAll();
    PHOTOS = (ps || []).map((p) => ({ ...p, url: URL.createObjectURL(p.blob) })).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  } catch (e) { console.error(e); }
  if (S.active) { U.tab = 'train'; }
  // 3日以上あいたら「おかえり」
  U.comeback = !!(S.lastOpen && daysBetween(S.lastOpen, today()) >= 3);
  S.lastOpen = today(); save();
  bindEvents();
  render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
