/** SVGイラスト生成 — カード全面用 */

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

const MONSTER_SVG = {
  bitra: (c) => `
    <ellipse cx="50" cy="72" rx="28" ry="16" fill="${c}" opacity=".35"/>
    <ellipse cx="50" cy="55" rx="26" ry="22" fill="${c}"/>
    <circle cx="50" cy="32" r="18" fill="${c}"/>
    <circle cx="43" cy="30" r="3.5" fill="#fff"/><circle cx="57" cy="30" r="3.5" fill="#fff"/>
    <circle cx="44" cy="31" r="1.6" fill="#14212b"/><circle cx="58" cy="31" r="1.6" fill="#14212b"/>
    <path d="M32 28 L22 18 L34 24 Z" fill="${c}" stroke="#14212b" stroke-width="1"/>
    <path d="M68 28 L78 18 L66 24 Z" fill="${c}" stroke="#14212b" stroke-width="1"/>
    <path d="M42 38 Q50 44 58 38" fill="none" stroke="#14212b" stroke-width="2"/>
    <text x="50" y="88" text-anchor="middle" font-size="9" fill="#14212b" opacity=".5" font-family="monospace">BIT</text>`,
  forkus: (c) => `
    <ellipse cx="50" cy="78" rx="30" ry="12" fill="${c}" opacity=".3"/>
    <path d="M50 20 C30 25 22 50 28 70 L50 62 L72 70 C78 50 70 25 50 20Z" fill="${c}"/>
    <circle cx="38" cy="40" r="8" fill="#0f172a"/><circle cx="62" cy="40" r="8" fill="#0f172a"/>
    <circle cx="38" cy="40" r="3" fill="#7dd3fc"/><circle cx="62" cy="40" r="3" fill="#7dd3fc"/>
    <path d="M50 48 L50 72" stroke="#0f172a" stroke-width="3"/>
    <path d="M50 55 L35 68 M50 55 L65 68" stroke="#0f172a" stroke-width="2.5"/>
    <text x="50" y="92" text-anchor="middle" font-size="8" fill="#14212b" opacity=".45" font-family="monospace">IF</text>`,
  glitch: (c) => `
    <ellipse cx="50" cy="76" rx="26" ry="14" fill="${c}" opacity=".3"/>
    <path d="M50 18 L72 70 L50 58 L28 70 Z" fill="${c}"/>
    <path d="M50 18 L58 8 L55 22 M50 18 L42 8 L45 22" fill="${c}" stroke="#14212b" stroke-width="1"/>
    <rect x="40" y="36" width="8" height="6" fill="#fef08a"/><rect x="52" y="36" width="8" height="6" fill="#fef08a"/>
    <path d="M36 48 H64 M38 52 H62" stroke="#14212b" stroke-width="1.5" opacity=".5"/>
    <text x="50" y="90" text-anchor="middle" font-size="8" fill="#14212b" opacity=".45" font-family="monospace">ERR</text>`,
  stackdon: (c) => `
    <rect x="22" y="58" width="56" height="14" rx="3" fill="${c}" opacity=".5"/>
    <rect x="26" y="44" width="48" height="14" rx="3" fill="${c}" opacity=".75"/>
    <rect x="30" y="28" width="40" height="16" rx="3" fill="${c}"/>
    <circle cx="42" cy="36" r="3" fill="#fff"/><circle cx="58" cy="36" r="3" fill="#fff"/>
    <circle cx="42.5" cy="36.5" r="1.4" fill="#14212b"/><circle cx="58.5" cy="36.5" r="1.4" fill="#14212b"/>
    <path d="M38 40 Q50 46 62 40" stroke="#14212b" fill="none" stroke-width="1.5"/>
    <ellipse cx="50" cy="78" rx="28" ry="10" fill="${c}" opacity=".25"/>`,
  voidnul: (c) => `
    <ellipse cx="50" cy="55" rx="24" ry="30" fill="${c}" opacity=".85"/>
    <ellipse cx="50" cy="55" rx="14" ry="18" fill="#042f2e"/>
    <circle cx="50" cy="52" r="6" fill="#99f6e4" opacity=".9"/>
    <path d="M30 40 Q20 55 30 70 M70 40 Q80 55 70 70" fill="none" stroke="${c}" stroke-width="3" opacity=".6"/>
    <text x="50" y="92" text-anchor="middle" font-size="10" fill="#14212b" opacity=".4" font-family="monospace">null</text>`,
  parselex: (c) => `
    <ellipse cx="50" cy="78" rx="32" ry="12" fill="${c}" opacity=".3"/>
    <path d="M18 55 Q50 10 82 55 L70 58 Q50 28 30 58 Z" fill="${c}"/>
    <path d="M50 28 L50 70" stroke="#7c2d12" stroke-width="2"/>
    <circle cx="40" cy="48" r="4" fill="#fef3c7"/><circle cx="60" cy="48" r="4" fill="#fef3c7"/>
    <path d="M34 20 L28 8 M66 20 L72 8" stroke="${c}" stroke-width="3"/>
    <path d="M42 58 Q50 64 58 58" stroke="#7c2d12" fill="none"/>`,
  loopra: (c) => `
    <path d="M50 20 C70 20 80 40 70 55 C90 55 85 78 55 78 C30 78 18 60 28 45 C15 40 30 18 50 20Z" fill="${c}"/>
    <circle cx="58" cy="40" r="5" fill="#ecfdf5"/><circle cx="59" cy="40" r="2" fill="#14212b"/>
    <circle cx="50" cy="55" r="10" fill="none" stroke="#042f2e" stroke-width="2" stroke-dasharray="4 3"/>`,
  cachemaw: (c) => `
    <ellipse cx="50" cy="50" rx="34" ry="28" fill="${c}"/>
    <path d="M28 48 Q50 78 72 48" fill="#1c1917"/>
    <path d="M32 50 L36 62 L40 50 L44 64 L48 50 L52 64 L56 50 L60 62 L64 50" fill="#fef3c7"/>
    <circle cx="36" cy="38" r="4" fill="#fff"/><circle cx="58" cy="38" r="4" fill="#fff"/>
    <circle cx="37" cy="39" r="1.8" fill="#14212b"/><circle cx="59" cy="39" r="1.8" fill="#14212b"/>`,
  semaphor: (c) => `
    <rect x="44" y="22" width="12" height="56" rx="4" fill="#334155"/>
    <circle cx="50" cy="34" r="10" fill="#ef4444"/>
    <circle cx="50" cy="50" r="10" fill="#eab308"/>
    <circle cx="50" cy="66" r="10" fill="#22c55e"/>
    <ellipse cx="50" cy="82" rx="22" ry="8" fill="${c}" opacity=".35"/>
    <path d="M30 70 Q50 88 70 70" fill="${c}"/>`,
  debugga: (c) => `
    <ellipse cx="50" cy="58" rx="26" ry="22" fill="${c}"/>
    <circle cx="50" cy="36" r="16" fill="${c}"/>
    <path d="M28 28 Q18 18 30 22 M72 28 Q82 18 70 22" fill="${c}"/>
    <circle cx="44" cy="34" r="4" fill="#fef9c3"/><circle cx="56" cy="34" r="4" fill="#fef9c3"/>
    <circle cx="44.5" cy="34.5" r="1.8" fill="#14212b"/><circle cx="56.5" cy="34.5" r="1.8" fill="#14212b"/>
    <path d="M42 42 Q50 48 58 42" stroke="#14212b" fill="none"/>
    <path d="M34 55 L22 70 M66 55 L78 70" stroke="${c}" stroke-width="4"/>`,
};

function codeGlyph(art, color, label) {
  const map = {
    act_damage: `<path d="M50 18 L62 48 L50 42 L38 48 Z" fill="${color}"/><circle cx="50" cy="68" r="14" fill="${color}" opacity=".35"/>`,
    act_heal: `<path d="M50 28 v40 M30 48 h40" stroke="${color}" stroke-width="10" stroke-linecap="round"/>`,
    act_shield: `<path d="M50 22 L72 32 V52 C72 68 50 78 50 78 S28 68 28 52 V32 Z" fill="${color}"/>`,
    act_draw: `<rect x="30" y="28" width="28" height="36" rx="3" fill="${color}" opacity=".5"/><rect x="40" y="34" width="28" height="36" rx="3" fill="${color}"/>`,
    act_boost: `<path d="M42 70 L50 22 L58 70 L50 58 Z" fill="${color}"/>`,
    tgt_self: `<circle cx="50" cy="48" r="20" fill="none" stroke="${color}" stroke-width="6"/><circle cx="50" cy="48" r="8" fill="${color}"/>`,
    tgt_enemy: `<circle cx="50" cy="48" r="20" fill="${color}"/><path d="M40 40 L60 56 M60 40 L40 56" stroke="#fff" stroke-width="4"/>`,
    tgt_active: `<rect x="30" y="30" width="40" height="40" rx="6" fill="${color}"/><text x="50" y="56" text-anchor="middle" fill="#fff" font-size="14" font-weight="700">A</text>`,
    num: `<text x="50" y="58" text-anchor="middle" fill="${color}" font-size="28" font-weight="800" font-family="monospace">${esc(label)}</text>`,
    ctrl_if: `<text x="50" y="58" text-anchor="middle" fill="${color}" font-size="26" font-weight="800" font-family="monospace">if</text>`,
    ctrl_then: `<text x="50" y="56" text-anchor="middle" fill="${color}" font-size="18" font-weight="800" font-family="monospace">then</text>`,
    stat_hp: `<text x="50" y="58" text-anchor="middle" fill="${color}" font-size="22" font-weight="800" font-family="monospace">HP</text>`,
    stat_atk: `<text x="50" y="58" text-anchor="middle" fill="${color}" font-size="20" font-weight="800" font-family="monospace">ATK</text>`,
    cmp: `<text x="50" y="58" text-anchor="middle" fill="${color}" font-size="28" font-weight="800" font-family="monospace">${esc(label)}</text>`,
  };
  return map[art] || `<circle cx="50" cy="50" r="22" fill="${color}"/>`;
}

export function monsterArtSvg(def, opts = {}) {
  const w = opts.w || 120;
  const h = opts.h || 100;
  const draw = MONSTER_SVG[def.art] || MONSTER_SVG.bitra;
  const gid = `g_${def.id}_${Math.random().toString(36).slice(2, 7)}`;
  return `<svg class="card-art-svg" viewBox="0 0 100 100" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fff7ed"/><stop offset="100%" stop-color="${def.color}55"/>
      </linearGradient>
    </defs>
    <rect width="100" height="100" fill="url(#${gid})"/>
    ${draw(def.color)}
  </svg>`;
}

export function codeArtSvg(def, opts = {}) {
  const w = opts.w || 100;
  const h = opts.h || 80;
  return `<svg class="card-art-svg" viewBox="0 0 100 100" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="100" height="100" fill="#f8fafc"/>
    <circle cx="50" cy="50" r="36" fill="${def.color}22"/>
    ${codeGlyph(def.art, def.color, def.label)}
  </svg>`;
}

export function artForDef(def, opts) {
  if (!def) return "";
  if (def.type === "character") return monsterArtSvg(def, opts);
  return codeArtSvg(def, opts);
}
