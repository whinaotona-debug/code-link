/** 手札のコードから組めるレシピ一覧 */

export const CODE_RECIPES = [
  { tokens: ["damage", "enemy", "30"], label: "相手に30ダメージ", short: "damage enemy 30" },
  { tokens: ["damage", "enemy", "20"], label: "相手に20ダメージ", short: "damage enemy 20" },
  { tokens: ["damage", "enemy", "40"], label: "相手に40ダメージ", short: "damage enemy 40" },
  { tokens: ["damage", "enemy", "50"], label: "相手に50ダメージ", short: "damage enemy 50" },
  { tokens: ["heal", "self", "20"], label: "自分を20回復", short: "heal self 20" },
  { tokens: ["heal", "self", "30"], label: "自分を30回復", short: "heal self 30" },
  { tokens: ["heal", "active", "30"], label: "バトルを30回復", short: "heal active 30" },
  { tokens: ["shield", "self", "20"], label: "シールド20", short: "shield self 20" },
  { tokens: ["boost", "self", "20"], label: "攻撃+20", short: "boost self 20" },
  { tokens: ["draw", "self", "10"], label: "カードを引く", short: "draw self 10" },
  {
    tokens: ["if", "HP", "<", "50", "then", "heal", "self", "30"],
    label: "HP<50なら30回復",
    short: "if HP < 50 then heal self 30",
  },
  {
    tokens: ["if", "HP", "<", "50", "then", "damage", "enemy", "40"],
    label: "HP<50なら40ダメ",
    short: "if HP < 50 then damage enemy 40",
  },
  {
    tokens: ["if", "HP", ">", "40", "then", "damage", "enemy", "30"],
    label: "HP>40なら30ダメ",
    short: "if HP > 40 then damage enemy 30",
  },
];

function takeFromBag(bag, token) {
  const i = bag.indexOf(token);
  if (i < 0) return false;
  bag.splice(i, 1);
  return true;
}

/** @param {string[]} availableTokens 手札＋装着中など使えるトークン（重複あり） */
export function listCraftable(availableTokens) {
  return CODE_RECIPES.map((r) => {
    const bag = [...availableTokens];
    const missing = [];
    for (const t of r.tokens) {
      if (!takeFromBag(bag, t)) missing.push(t);
    }
    return {
      ...r,
      ready: missing.length === 0,
      missing,
      almost: missing.length > 0 && missing.length <= 2,
    };
  }).filter((r) => r.ready || r.almost);
}
