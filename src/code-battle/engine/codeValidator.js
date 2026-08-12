/**
 * コードカード列の検証・実行
 *
 * 文法:
 *   stmt := action target number
 *        | if stat compare number then action target number
 *
 * 例: damage enemy 30
 *     if HP < 50 then heal self 30
 */

const ACTIONS = new Set(["damage", "heal", "shield", "draw", "boost"]);
const TARGETS = new Set(["self", "enemy", "active"]);
const STATS = new Set(["HP", "ATK"]);
const COMPARES = new Set(["<", ">", "==", "<=", ">="]);

function isNumberToken(t) {
  return /^\d+$/.test(t);
}

function parseFull(tokens) {
  let i = 0;
  const next = () => {
    if (i >= tokens.length) {
      throw Object.assign(new Error("カードが足りません"), { incomplete: true });
    }
    return tokens[i++];
  };

  if (!tokens.length) {
    throw Object.assign(new Error("コードが空です"), { incomplete: true });
  }

  if (tokens[0] === "if") {
    next();
    const stat = next();
    if (!STATS.has(stat)) throw new Error("if のあとは HP か ATK");
    const op = next();
    if (!COMPARES.has(op)) throw new Error("比較演算子（< > ==）が必要");
    const condVal = next();
    if (!isNumberToken(condVal)) throw new Error("比較する数値が必要");
    const thenKw = next();
    if (thenKw !== "then") throw new Error("then が必要です");
    const action = next();
    if (!ACTIONS.has(action)) throw new Error("then のあとはアクション");
    const target = next();
    if (!TARGETS.has(target)) throw new Error("ターゲットが必要");
    const value = next();
    if (!isNumberToken(value)) throw new Error("最後に数値が必要");
    if (i < tokens.length) throw new Error(`余分なカード: ${tokens.slice(i).join(" ")}`);
    return {
      ok: true,
      complete: true,
      ast: {
        type: "if",
        cond: { stat, op, value: Number(condVal) },
        then: { action, target, value: Number(value) },
      },
      display: tokens.join(" "),
    };
  }

  const action = next();
  if (!ACTIONS.has(action)) throw new Error("最初はアクション（damage/heal/…）か if");
  const target = next();
  if (!TARGETS.has(target)) throw new Error("ターゲット（self/enemy/active）が必要");
  const value = next();
  if (!isNumberToken(value)) throw new Error("数値が必要");
  if (i < tokens.length) throw new Error(`余分なカード: ${tokens.slice(i).join(" ")}`);
  return {
    ok: true,
    complete: true,
    ast: { type: "stmt", action, target, value: Number(value) },
    display: tokens.join(" "),
  };
}

/** カードインスタンス配列から検証 */
export function validateCodeCards(codeCardInstances, getDef) {
  const tokens = codeCardInstances.map((c) => getDef(c.defId).token);
  try {
    return parseFull(tokens);
  } catch (e) {
    return {
      ok: false,
      complete: false,
      error: e.message || String(e),
      incomplete: Boolean(e.incomplete),
    };
  }
}

function evalCond(cond, ctx) {
  const left = cond.stat === "HP" ? ctx.hp : ctx.atk;
  const right = cond.value;
  switch (cond.op) {
    case "<":
      return left < right;
    case ">":
      return left > right;
    case "==":
      return left === right;
    case "<=":
      return left <= right;
    case ">=":
      return left >= right;
    default:
      return false;
  }
}

export function executeAst(ast, ctx) {
  if (ast.type === "if") {
    if (!evalCond(ast.cond, ctx)) {
      return {
        fired: false,
        skipped: true,
        effects: [],
        reason: "条件が false だったので何もしない",
      };
    }
    return { fired: true, effects: [ast.then] };
  }
  return { fired: true, effects: [{ action: ast.action, target: ast.target, value: ast.value }] };
}

/** 学習用ヒント */
export function suggestNext(tokens) {
  if (!tokens.length) return "アクション（damage / heal / …）か if から始めよう";
  if (tokens[0] === "if") {
    const n = tokens.length;
    if (n === 1) return "次は HP か ATK";
    if (n === 2) return "次は比較 < > ==";
    if (n === 3) return "次は数値（例: 50）";
    if (n === 4) return "次は then";
    if (n === 5) return "次はアクション";
    if (n === 6) return "次はターゲット";
    if (n === 7) return "次は数値";
    return "完成！緑の丸なら実行できる";
  }
  if (tokens.length === 1) return "次はターゲット（self / enemy / active）";
  if (tokens.length === 2) return "次は数値（例: 30）";
  return "完成！緑の丸なら実行できる";
}
