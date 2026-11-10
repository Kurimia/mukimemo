/* アイコン（線画SVG）と部位アイコン */

const _svg = (d, size = 24, sw = 2) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

const IC = {
  chevL: (s = 22) => _svg('<path d="M15 6l-6 6 6 6"/>', s, 2.2),
  chevR: (s = 18) => _svg('<path d="M9 6l6 6-6 6"/>', s, 2.2),
  plus: (s = 20) => _svg('<path d="M12 5v14M5 12h14"/>', s, 2.6),
  minus: (s = 26) => _svg('<path d="M5 12h14"/>', s, 2.6),
  check: (s = 20) => _svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', s, 2.8),
  close: (s = 24) => _svg('<path d="M6 6l12 12M18 6 6 18"/>', s, 2.2),
  chat: (s = 20) => _svg('<path d="M4 5h16v11H9l-5 4z"/>', s, 2.2),
  gear: (s = 24) => _svg('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>', s, 2),
  camera: (s = 22) => _svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', s, 2.2),
  timer: (s = 20) => _svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>', s, 2.2),
  trophy: (s = 24) => _svg('<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/>', s, 1.9),
  flame: (s = 24) => _svg('<path d="M12 22c4 0 7-2.7 7-6.6 0-3.1-1.9-5.4-3.6-7.2-.3 1.6-1.1 2.8-2.3 3.4.3-3.5-1.3-6.6-4.1-8.6.2 3.3-1.6 5.2-3.1 7C4.6 11.4 5 13 5 15.4 5 19.3 8 22 12 22z"/><path d="M12 22c-1.7 0-3-1.2-3-2.9 0-1.6 1.2-2.6 2-3.6.4 1 1.1 1.5 1.8 1.7.1-.9.4-1.6.9-2.2.9.9 1.3 2.1 1.3 3.2 0 2.2-1.3 3.8-3 3.8z"/>', s, 1.8),
  arrowR: (s = 20) => _svg('<path d="M5 12h14M13 6l6 6-6 6"/>', s, 2.6),
  pencil: (s = 20) => _svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>', s, 2),
  play: (s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>`,
  up: (s = 16) => _svg('<path d="M12 19V5M6 11l6-6 6 6"/>', s, 2.4),
  down: (s = 16) => _svg('<path d="M12 5v14M6 13l6 6 6-6"/>', s, 2.4),
  trend: (s = 18) => _svg('<path d="M4 16l6-6 4 4 6-6M15 8h5v5"/>', s, 2.4),
  repeat: (s = 22) => _svg('<path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4"/>', s, 2.2),
  swap: (s = 16) => _svg('<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>', s, 2.2),
  download: (s = 20) => _svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', s, 2),
  upload: (s = 20) => _svg('<path d="M12 15V4M7 9l5-5 5 5M5 20h14"/>', s, 2),
  paste: (s = 18) => _svg('<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6"/>', s, 2),
  person: (s = 40) => _svg('<circle cx="12" cy="7" r="3"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7"/>', s, 1.5),
  sun1: (s = 18) => _svg('<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>', s, 2),
  trash: (s = 20) => _svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', s, 2),
  // 食事の枠
  sunrise: (s = 24) => _svg('<path d="M2.5 16h19M8.65 16A4.5 4.5 0 1 1 15.35 16"/>', s, 2),
  sun: (s = 24) => _svg('<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>', s, 2),
  cookie: (s = 24) => _svg('<path d="M2.5 12.2 20.5 6.8V20.5H2.5z"/><path d="M2.5 16.3h18"/><circle cx="12.8" cy="7.2" r="1.9"/><path d="M13.9 5.6c.5-1.5 1.5-2.5 2.9-3"/>', s, 2),
  moon: (s = 24) => _svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>', s, 2),
  cookieMoon: (s = 24) => _svg('<path d="M6.5 15.4 21.5 11V21H6.5z"/><path d="M6.5 18.2h15"/><circle cx="15.6" cy="10.9" r="1.6"/><path d="M16.5 9.5c.4-1.2 1.2-2 2.3-2.4"/><path d="M8.2 2.6a4.4 4.4 0 1 0 4.6 6.9 5.2 5.2 0 0 1-4.6-6.9z"/>', s, 2),
  // タブ
  navMeal: (s = 24) => _svg('<path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M9 7.5c0-1.2 1-1.8 1-3M14 7.5c0-1.2 1-1.8 1-3"/>', s, 2.1),
  navTrain: (s = 24) => _svg('<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>', s, 2.1),
  navRecord: (s = 24) => _svg('<path d="M4 20h16M7 16v-4M12 16V8M17 16v-6"/>', s, 2.1),
};

function partIcon(part, size = 30) {
  return `<span class="part" style="width:${size}px;height:${size}px;--m:url(assets/parts/${part}.png)" aria-hidden="true"></span>`;
}
