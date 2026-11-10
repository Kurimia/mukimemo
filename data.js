/* マスターデータ：食事の枠、マイ食事の初期登録、種目、メニュー */

const SLOTS = [
  { id: 'breakfast', label: '朝', icon: 'sunrise' },
  { id: 'lunch', label: '昼', icon: 'sun' },
  { id: 'snack', label: '間食', icon: 'cookie' },
  { id: 'dinner', label: '夜', icon: 'moon' },
  { id: 'night', label: '夜の間食', icon: 'cookieMoon' },
];

// 単品（食材）。数値は1つ分のおおよその目安（日本食品標準成分表などからの概算）。設定 > マイ食事 で直せる
const DEFAULT_FOODS = [
  { id: 'f_rice_half', name: 'ご飯 0.5合', kcal: 257, p: 4.1, f: 0.5, c: 61.2 },
  { id: 'f_pack_rice', name: 'パックご飯（200g）', kcal: 300, p: 4.5, f: 0.6, c: 68 },
  { id: 'f_banana', name: 'バナナ 1本', kcal: 93, p: 1.1, f: 0.2, c: 22.5 },
  { id: 'f_blueberry', name: 'ブルーベリー 15粒', kcal: 7, p: 0.1, f: 0, c: 1.9 },
  { id: 'f_protein', name: 'プロテイン 1杯', kcal: 100, p: 20, f: 1.5, c: 2 },
  { id: 'f_malto', name: 'マルトデキストリン 1杯', kcal: 95, p: 0, f: 0, c: 24 },
  { id: 'f_breast', name: '鶏むね肉 100g', kcal: 105, p: 23.3, f: 1.9, c: 0 },
  { id: 'f_thigh', name: '鶏もも肉 100g', kcal: 190, p: 16.6, f: 14.2, c: 0 },
  { id: 'f_broccoli', name: 'ブロッコリー 50g', kcal: 19, p: 2.7, f: 0.3, c: 3.3 },
  { id: 'f_tamagoyaki', name: '卵焼き（卵1個）', kcal: 89, p: 6.1, f: 7.1, c: 0.2 },
  { id: 'f_egg', name: '卵 1個', kcal: 71, p: 6.1, f: 5.1, c: 0.2 },
  { id: 'f_spinach', name: 'ほうれん草 1/6束', kcal: 9, p: 1.1, f: 0.2, c: 1.6 },
  { id: 'f_shimeji', name: 'しめじ 少し', kcal: 7, p: 0.8, f: 0.2, c: 1.4 },
  { id: 'f_meatball', name: '一口肉団子 4個', kcal: 120, p: 6, f: 7.5, c: 6 },
  { id: 'f_mizuna', name: '水菜 少し', kcal: 5, p: 0.4, f: 0, c: 1 },
  { id: 'f_dango', name: 'みたらし団子', kcal: 250, p: 4, f: 0.6, c: 57 },
  { id: 'f_nuts', name: 'ミックスナッツ 20g', kcal: 122, p: 4, f: 11, c: 3 },
  { id: 'f_salmon', name: 'サーモン 100g', kcal: 200, p: 21, f: 12, c: 0 },
  { id: 'f_natto', name: '納豆 1パック', kcal: 90, p: 7, f: 4.5, c: 6 },
  { id: 'f_miso', name: '味噌汁', kcal: 30, p: 2, f: 1, c: 4 },
  { id: 'f_donut', name: 'ドーナツ 1個', kcal: 270, p: 3, f: 15, c: 30 },
  { id: 'f_oyakodon', name: 'なか卯 親子丼（大盛り）', kcal: 738, p: 30, f: 12, c: 120 },
  { id: 'f_udon', name: 'なか卯 はいからうどん（小）', kcal: 166, p: 4.5, f: 3.6, c: 28.7 },
  { id: 'f_kaisendon', name: '丼丸 海鮮丼（並）', kcal: 570, p: 26, f: 9, c: 91 },
];

// セット＝単品の組み合わせ。qty は個数（0.5刻み）
const DEFAULT_SETS = [
  { id: 's_breakfast', name: '朝食セット', items: [['f_rice_half', 1], ['f_banana', 1], ['f_blueberry', 1], ['f_protein', 1], ['f_malto', 2]] },
  { id: 's_lunch_breast', name: '鶏むねランチ', items: [['f_rice_half', 1], ['f_breast', 1], ['f_broccoli', 1], ['f_tamagoyaki', 1]] },
  { id: 's_lunch_thigh', name: '鶏ももランチ', items: [['f_rice_half', 1], ['f_thigh', 1], ['f_broccoli', 1], ['f_tamagoyaki', 1]] },
  { id: 's_nabe', name: '鍋セット', items: [['f_breast', 1], ['f_spinach', 1], ['f_shimeji', 1], ['f_egg', 1], ['f_meatball', 1], ['f_mizuna', 1], ['f_rice_half', 1]] },
  { id: 's_night', name: '寝る前プロテイン', items: [['f_protein', 1], ['f_malto', 2]] },
  { id: 's_nakau', name: 'なか卯セット', items: [['f_oyakodon', 1], ['f_udon', 1]] },
  { id: 's_donmaru', name: '丼丸セット', items: [['f_kaisendon', 1], ['f_miso', 1], ['f_natto', 1]] },
].map((s) => ({ id: s.id, name: s.name, items: s.items.map(([foodId, qty]) => ({ foodId, qty })) }));

// kind: barbell / machine は2.5kg、dumbbell は1kg刻み。bodyweight は回数で伸ばす
// start は初回の目安。1回やると自動で「確定」に変わる
const EXERCISES = {
  bench: { name: 'ベンチプレス', part: 'chest', kind: 'barbell', start: 57.5 },
  incline_db: { name: 'インクラインダンベルプレス', part: 'chest', kind: 'dumbbell', start: 18 },
  pullup: { name: '懸垂', part: 'back', kind: 'bodyweight' },
  side_raise: { name: 'サイドレイズ', part: 'shoulder', kind: 'dumbbell', start: 6 },
  skull: { name: 'スカルクラッシャー', part: 'arm', kind: 'barbell', start: 20 },
  squat: { name: 'スクワット', part: 'legs', kind: 'barbell', start: 65 },
  rdl: { name: 'ルーマニアンデッドリフト', part: 'legs', kind: 'barbell', start: 50 },
  hlr: { name: 'ハンギングレッグレイズ', part: 'abs', kind: 'bodyweight' },
  cable_crunch: { name: 'ケーブルクランチ', part: 'abs', kind: 'machine', start: 25 },
  shoulder_press: { name: 'ショルダープレス', part: 'shoulder', kind: 'dumbbell', start: 16 },
  db_row: { name: 'ワンハンドダンベルロウ', part: 'back', kind: 'dumbbell', start: 20 },
  smith_incline: { name: 'スミス インクラインプレス', part: 'chest', kind: 'machine', start: 40 },
  db_curl: { name: 'ダンベルカール', part: 'arm', kind: 'dumbbell', start: 10 },
  bulgarian: { name: 'ブルガリアンスクワット', part: 'legs', kind: 'dumbbell', start: 10 },
  leg_press: { name: 'レッグプレス', part: 'legs', kind: 'machine', start: 80 },
};

const PART_LABEL = { chest: '胸', shoulder: '肩', back: '背中', legs: '脚', arm: '腕', abs: '腹筋' };

// items: [種目id, セット数, 回数の下限, 回数の上限]（自重で上限なし＝限界まで）
const MENUS = [
  { id: 'A', no: 1, name: '上半身A', items: [['bench', 3, 6, 8], ['incline_db', 3, 8, 10], ['pullup', 3, 0, 0], ['side_raise', 4, 12, 15], ['skull', 3, 10, 12]] },
  { id: 'B', no: 2, name: '下半身A', items: [['squat', 3, 6, 8], ['rdl', 3, 8, 10], ['hlr', 3, 10, 15], ['cable_crunch', 3, 10, 15]] },
  { id: 'C', no: 3, name: '上半身B', items: [['shoulder_press', 3, 8, 10], ['db_row', 3, 10, 12], ['smith_incline', 3, 8, 10], ['side_raise', 3, 12, 15], ['db_curl', 3, 10, 12]] },
  { id: 'D', no: 4, name: '下半身B', items: [['bulgarian', 3, 8, 12], ['leg_press', 3, 10, 12], ['cable_crunch', 3, 10, 15]] },
];

const ACTIVITY_OPTIONS = [
  { v: 1.2, label: '1.2　ほぼ運動しない' },
  { v: 1.375, label: '1.375　軽い運動（週1〜3回）' },
  { v: 1.55, label: '1.55　中程度（週3〜5回）' },
  { v: 1.725, label: '1.725　激しい運動（週6〜7回）' },
];

const PHASES = [
  { id: 'bulk', label: '増量期', delta: 300, pPerKg: 2, fRatio: 0.3 },
  { id: 'maintain', label: '維持', delta: 0, pPerKg: 2, fRatio: 0.3 },
  { id: 'cut', label: '減量期', delta: -300, pPerKg: 2, fRatio: 0.2 },
];

// キャラクター画像（全身・背景なし）。ポーズ1・2があり、表情はファイル名の末尾
// normal 通常 / smile 微笑み / laugh 笑顔 / grin ニヤニヤ / surprise 驚き / confused 困惑 / love 愛おしい
// kyun キュン（小さながんばりを褒める） / kyunkyun キュンキュン（たくさんがんばった特別なとき）
const CHAR_POSES = {
  meal: { 1: ['normal', 'normal2', 'smile', 'laugh', 'grin', 'surprise', 'confused', 'kyun', 'kyunkyun'], 2: ['normal', 'smile', 'surprise', 'kyunkyun'] },
  trainer: { 1: ['normal', 'normal2', 'laugh', 'grin', 'grin2', 'surprise', 'kyun', 'kyunkyun', 'love'], 2: ['normal', 'laugh', 'grin', 'surprise'] },
};
const CHARACTERS = {
  meal: {
    name: '食事管理士',
    bust: 'assets/char/v2/meal1-normal.webp',
    full: 'assets/char/v2/meal1-normal.webp',
    robotName: '食事ロボ',
    robotPersona: 'あなたは私専属の食事管理アシスタントです。シンプルでていねいな「です・ます」口調で、短く具体的に答えてください。',
    persona: 'あなたは私専属の食事管理士です。年上のお姉さんとして、優しく、ときどき少し意地悪にからかうような口調（「〜わよ」「〜かしら」「♪」など）で、短く具体的に答えてください。',
  },
  trainer: {
    name: 'トレーナー',
    bust: 'assets/char/v2/trainer1-normal.webp',
    full: 'assets/char/v2/trainer1-normal.webp',
    robotName: 'トレーニングロボ',
    robotPersona: 'あなたは私専属のパーソナルトレーナーです。シンプルで前向きな「です・ます」口調で、フォーム・休息・栄養・安全面も含めて短く具体的に答えてください。',
    persona: 'あなたは私専属のパーソナルトレーナーで、年下の女性の後輩です。私のことは「先輩」と呼び、普段は生意気で少しからかうような口調、筋肉や体の成長を褒めるときは素直になり、照れ隠しでまた生意気に戻ります。ただしフォーム・休息・栄養・安全面のアドバイスは真面目に、短く具体的に答えてください。',
  },
};
