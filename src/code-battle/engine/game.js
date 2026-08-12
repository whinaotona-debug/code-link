import { STARTER_DECK, getCardDef, CHARACTERS, CODE_CARDS } from "../data/cards.js";
import { validateCodeCards, executeAst, suggestNext } from "./codeValidator.js";

let uid = 1;
function nextId() {
  return `inst_${uid++}`;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeInstance(defId, hpScale = 1) {
  const def = getCardDef(defId);
  if (!def) throw new Error(`Unknown card: ${defId}`);
  if (def.type === "character") {
    const maxHp = Math.round(def.hp * hpScale);
    return {
      uid: nextId(),
      defId,
      type: "character",
      hp: maxHp,
      maxHp,
      shield: 0,
      boost: 0,
      code: [],
      charged: false,
    };
  }
  return {
    uid: nextId(),
    defId,
    type: "code",
    kind: def.kind,
    token: def.token,
  };
}

function emptySide(name, isPlayer) {
  return {
    name,
    isPlayer,
    deck: [],
    hand: [],
    trash: [],
    active: null,
    bench: [null, null, null],
    supportCode: [],
    points: 0,
  };
}

function drawCards(side, n) {
  const got = [];
  for (let i = 0; i < n; i++) {
    if (!side.deck.length) break;
    const c = side.deck.shift();
    side.hand.push(c);
    got.push(c);
  }
  return got;
}

function drawOpeningHand(side, n = 8) {
  drawCards(side, n);
  if (side.hand.some((c) => c.type === "character")) return;
  const deckIdx = side.deck.findIndex((c) => c.type === "character");
  if (deckIdx < 0) return;
  const [charCard] = side.deck.splice(deckIdx, 1);
  const codeIdx = side.hand.findIndex((c) => c.type === "code");
  if (codeIdx >= 0) {
    const [back] = side.hand.splice(codeIdx, 1);
    side.deck.push(back);
    side.deck = shuffle(side.deck);
  }
  side.hand.push(charCard);
}

/**
 * @param {object} opts
 * @param {string[]} [opts.playerDeck]
 * @param {string[]} [opts.enemyDeck]
 * @param {string} [opts.enemyName]
 * @param {number} [opts.aiLevel]
 * @param {number} [opts.enemyHpScale]
 * @param {number} [opts.enemyDmgScale]
 * @param {number} [opts.pointsToWin]
 * @param {boolean} [opts.tutorial]
 * @param {number|string} [opts.campaignLevel]
 */
export function createGame(opts = {}) {
  const playerDeck = opts.playerDeck || STARTER_DECK;
  const enemyDeck = opts.enemyDeck || STARTER_DECK;
  const pointsToWin = opts.pointsToWin ?? 3;
  const enemyHpScale = opts.enemyHpScale ?? 1;
  const enemyDmgScale = opts.enemyDmgScale ?? 1;
  const aiLevel = opts.aiLevel ?? 1;

  const player = emptySide("あなた", true);
  const enemy = emptySide(opts.enemyName || "AI", false);

  player.deck = shuffle(playerDeck.map((id) => makeInstance(id, 1)));
  enemy.deck = shuffle(enemyDeck.map((id) => makeInstance(id, enemyHpScale)));

  drawOpeningHand(player, 8);
  drawOpeningHand(enemy, 8);

  // チュートリアル：最初の手札をわかりやすく整える
  if (opts.tutorial) {
    arrangeTutorialHand(player);
  }

  return {
    phase: "setup",
    turn: 1,
    log: ["バトルゾーンにモンスターを出そう。"],
    player,
    enemy,
    selectedHandUid: null,
    focus: { side: "player", slot: "active", index: 0 },
    lesson: "モンスターをバトルゾーンへ",
    pointsToWin,
    aiLevel,
    enemyDmgScale,
    tutorial: Boolean(opts.tutorial),
    campaignLevel: opts.campaignLevel ?? null,
    flags: {
      executed: false,
      attacked: false,
      codeOkSeen: false,
      battleStarted: false,
    },
    lastFx: null,
  };
}

function arrangeTutorialHand(side) {
  // 山札+手札から必要カードを集めて手札先頭に
  const all = [...side.hand, ...side.deck];
  side.hand = [];
  side.deck = [];
  const need = ["char_bitra", "code_damage", "code_enemy", "code_30", "code_heal", "code_self", "code_20", "char_forkus"];
  for (const id of need) {
    const i = all.findIndex((c) => c.defId === id);
    if (i >= 0) side.hand.push(all.splice(i, 1)[0]);
  }
  side.deck = shuffle(all);
  while (side.hand.length < 8 && side.deck.length) {
    side.hand.push(side.deck.shift());
  }
}

function pushLog(game, msg) {
  game.log = [msg, ...game.log].slice(0, 50);
}

function otherSide(game, side) {
  return side.isPlayer ? game.enemy : game.player;
}

function getCodeStatus(codeList) {
  const result = validateCodeCards(codeList, getCardDef);
  const tokens = codeList.map((c) => getCardDef(c.defId).token);
  return {
    ...result,
    tokens,
    hint: suggestNext(tokens),
    status: result.ok ? "ok" : codeList.length ? "error" : "empty",
  };
}

export function getSlotCodeStatus(game, sideKey, slot, index = 0) {
  const side = game[sideKey];
  if (slot === "support") return getCodeStatus(side.supportCode);
  const char = slot === "active" ? side.active : side.bench[index];
  if (!char) return { status: "empty", tokens: [], hint: "モンスターがいない", ok: false };
  return getCodeStatus(char.code);
}

export function selectHand(game, uid) {
  game.selectedHandUid = game.selectedHandUid === uid ? null : uid;
  return game;
}

export function setFocus(game, focus) {
  game.focus = focus;
  return game;
}

function takeFromHand(side, uid) {
  const i = side.hand.findIndex((c) => c.uid === uid);
  if (i < 0) return null;
  return side.hand.splice(i, 1)[0];
}

export function playSelected(game) {
  if (game.phase !== "player" && game.phase !== "setup") return game;
  const side = game.player;
  const uid = game.selectedHandUid;
  if (!uid) {
    pushLog(game, "手札を選んでから配置先をタップ");
    return game;
  }
  const card = side.hand.find((c) => c.uid === uid);
  if (!card) return game;
  const focus = game.focus;
  if (!focus || focus.side !== "player") {
    pushLog(game, "配置先を選んでね");
    return game;
  }

  if (card.type === "character") {
    if (focus.slot === "support") {
      pushLog(game, "サポートにはコードだけ");
      return game;
    }
    if (focus.slot === "active") {
      if (side.active) {
        pushLog(game, "バトルゾーンは埋まっている → ベンチへ");
        return game;
      }
      const c = takeFromHand(side, uid);
      side.active = c;
      game.selectedHandUid = null;
      pushLog(game, `${getCardDef(c.defId).name} 登場！`);
      game.lastFx = { type: "summon", side: "player", slot: "active" };
      return game;
    }
    if (focus.slot === "bench") {
      const idx = focus.index ?? 0;
      if (side.bench[idx]) {
        pushLog(game, "そのベンチは埋まっている");
        return game;
      }
      const c = takeFromHand(side, uid);
      side.bench[idx] = c;
      game.selectedHandUid = null;
      pushLog(game, `${getCardDef(c.defId).name} をベンチへ`);
      game.lastFx = { type: "summon", side: "player", slot: "bench", index: idx };
      return game;
    }
  }

  if (card.type === "code") {
    if (focus.slot === "support") {
      const c = takeFromHand(side, uid);
      side.supportCode.push(c);
      game.selectedHandUid = null;
      const st = getCodeStatus(side.supportCode);
      if (st.ok) game.flags.codeOkSeen = true;
      pushLog(game, `サポート ← ${c.token} ${st.ok ? "🟢" : "🔴"}`);
      return game;
    }
    const char = focus.slot === "active" ? side.active : side.bench[focus.index ?? 0];
    if (!char) {
      pushLog(game, "先にモンスターを出して");
      return game;
    }
    const c = takeFromHand(side, uid);
    char.code.push(c);
    game.selectedHandUid = null;
    const st = getCodeStatus(char.code);
    if (st.ok) game.flags.codeOkSeen = true;
    pushLog(game, `${getCardDef(char.defId).name} ← ${c.token} ${st.ok ? "🟢" : "🔴"}`);
    return game;
  }
  return game;
}

export function popCode(game, sideKey, slot, index = 0) {
  if (game.phase !== "player" && game.phase !== "setup") return game;
  if (sideKey !== "player") return game;
  const side = game.player;
  let list;
  if (slot === "support") list = side.supportCode;
  else {
    const char = slot === "active" ? side.active : side.bench[index];
    if (!char) return game;
    list = char.code;
  }
  if (!list.length) return game;
  const c = list.pop();
  side.hand.push(c);
  pushLog(game, `${c.token} を手札に戻した`);
  return game;
}

function resolveTarget(effect, side, foe, attachedChar) {
  if (effect.target === "enemy") return foe.active;
  if (effect.target === "active") return side.active;
  if (effect.target === "self") return attachedChar || side.active;
  return null;
}

function applyEffects(game, side, effects, attachedChar, sourceLabel) {
  const foe = otherSide(game, side);
  const scale = side.isPlayer ? 1 : game.enemyDmgScale || 1;
  for (const fx of effects) {
    const target = resolveTarget(fx, side, foe, attachedChar);
    let val = fx.value;
    if (fx.action === "damage" && !side.isPlayer) val = Math.round(val * scale);

    if (fx.action === "damage") {
      if (!target) continue;
      let dmg = val;
      if (target.shield > 0) {
        const blocked = Math.min(target.shield, dmg);
        target.shield -= blocked;
        dmg -= blocked;
      }
      target.hp = Math.max(0, target.hp - dmg);
      pushLog(game, `${sourceLabel}: ${getCardDef(target.defId).name} に ${dmg}`);
      game.lastFx = {
        type: "damage",
        amount: dmg,
        targetSide: foe.isPlayer ? "player" : "enemy",
        targetUid: target.uid,
      };
      checkKnockout(game, foe, target);
    } else if (fx.action === "heal") {
      if (!target) continue;
      const before = target.hp;
      target.hp = Math.min(target.maxHp, target.hp + val);
      const healed = target.hp - before;
      pushLog(game, `${sourceLabel}: ${healed} 回復`);
      game.lastFx = { type: "heal", amount: healed, targetUid: target.uid };
    } else if (fx.action === "shield") {
      if (!target) continue;
      target.shield += val;
      pushLog(game, `${sourceLabel}: シールド ${val}`);
    } else if (fx.action === "boost") {
      if (!target) continue;
      target.boost += val;
      pushLog(game, `${sourceLabel}: ブースト +${val}`);
    } else if (fx.action === "draw") {
      const got = drawCards(side, Math.min(val, 5));
      pushLog(game, `${sourceLabel}: ${got.length} 枚ドロー`);
    }
  }
}

function checkKnockout(game, ownerSide, char) {
  if (!char || char.hp > 0) return;
  pushLog(game, `${getCardDef(char.defId).name} ダウン！`);
  ownerSide.trash.push(char, ...char.code);
  char.code = [];
  if (ownerSide.active === char) ownerSide.active = null;
  else {
    const bi = ownerSide.bench.indexOf(char);
    if (bi >= 0) ownerSide.bench[bi] = null;
  }
  const attacker = otherSide(game, ownerSide);
  attacker.points += 1;
  pushLog(game, `ポイント ${attacker.points}/${game.pointsToWin}`);
  game.lastFx = { type: "ko", name: getCardDef(char.defId).name };

  if (attacker.points >= game.pointsToWin) {
    game.phase = attacker.isPlayer ? "win" : "lose";
    pushLog(game, attacker.isPlayer ? "勝利！" : "敗北…");
    return;
  }
  if (!ownerSide.active) {
    const alive = ownerSide.bench.filter(Boolean);
    if (!alive.length) {
      game.phase = ownerSide.isPlayer ? "lose" : "win";
      pushLog(game, game.phase === "win" ? "勝利！" : "敗北…");
    } else if (!ownerSide.isPlayer) {
      const idx = ownerSide.bench.findIndex(Boolean);
      ownerSide.active = ownerSide.bench[idx];
      ownerSide.bench[idx] = null;
      pushLog(game, `AIは ${getCardDef(ownerSide.active.defId).name} を出した`);
    } else {
      game.lesson = "ベンチから次のモンスターを選んで";
    }
  }
}

export function executeCode(game, sideKey, slot, index = 0) {
  if (game.phase !== "player") return game;
  if (sideKey !== "player") return game;
  const side = game.player;
  let codeList;
  let attachedChar = null;
  let label = "";

  if (slot === "support") {
    codeList = side.supportCode;
    attachedChar = side.active;
    label = "サポート";
  } else {
    attachedChar = slot === "active" ? side.active : side.bench[index];
    if (!attachedChar) return game;
    codeList = attachedChar.code;
    label = getCardDef(attachedChar.defId).name;
  }

  const st = getCodeStatus(codeList);
  if (!st.ok) {
    pushLog(game, `実行不可: ${st.error || "未完成"}`);
    return game;
  }

  const ctx = {
    hp: attachedChar?.hp ?? 0,
    maxHp: attachedChar?.maxHp ?? 0,
    atk: attachedChar ? getCardDef(attachedChar.defId).attacks[0].damage : 0,
  };
  const result = executeAst(st.ast, ctx);
  if (result.skipped) {
    pushLog(game, `条件false — ${result.reason}`);
  } else {
    applyEffects(game, side, result.effects, attachedChar, label);
    if (attachedChar && slot !== "support") attachedChar.charged = true;
  }
  side.trash.push(...codeList);
  if (slot === "support") side.supportCode = [];
  else attachedChar.code = [];
  game.flags.executed = true;
  game.lastFx = { ...(game.lastFx || {}), type: game.lastFx?.type || "execute", execute: true };
  pushLog(game, "コード実行 → トラッシュへ");
  return game;
}

export function attack(game, attackIndex) {
  if (game.phase !== "player") return game;
  const side = game.player;
  const foe = game.enemy;
  if (!side.active || !foe.active) {
    pushLog(game, "バトルできない");
    return game;
  }
  const def = getCardDef(side.active.defId);
  const atk = def.attacks[attackIndex];
  if (!atk) return game;
  if (atk.cost > 0 && !side.active.charged) {
    pushLog(game, `「${atk.name}」はコード実行後に解放`);
    return game;
  }
  let dmg = atk.damage + (side.active.boost || 0);
  side.active.boost = 0;
  if (atk.cost > 0) side.active.charged = false;
  let target = foe.active;
  if (target.shield > 0) {
    const blocked = Math.min(target.shield, dmg);
    target.shield -= blocked;
    dmg -= blocked;
  }
  target.hp = Math.max(0, target.hp - dmg);
  pushLog(game, `${def.name}「${atk.name}」→ ${dmg}`);
  game.flags.attacked = true;
  game.lastFx = {
    type: "attack",
    amount: dmg,
    fromSide: "player",
    toSide: "enemy",
  };
  checkKnockout(game, foe, target);
  if (game.phase === "player") game.lesson = "ターン終了へ";
  return game;
}

export function promoteBench(game, benchIndex) {
  if (game.phase !== "player" && game.phase !== "setup") return game;
  const side = game.player;
  const b = side.bench[benchIndex];
  if (!b) return game;
  if (!side.active) {
    side.active = b;
    side.bench[benchIndex] = null;
    pushLog(game, `${getCardDef(b.defId).name} がバトルへ！`);
    return game;
  }
  side.bench[benchIndex] = side.active;
  side.active = b;
  pushLog(game, `${getCardDef(b.defId).name} と交代`);
  return game;
}

export function beginPlayerTurn(game) {
  if (game.phase === "win" || game.phase === "lose") return game;
  game.phase = "player";
  const n = game.turn === 1 ? 0 : 3;
  if (n > 0) {
    const got = drawCards(game.player, n);
    pushLog(game, `ターン${game.turn}: ${got.length}枚ドロー`);
    game.lastFx = { type: "draw", n: got.length };
  } else pushLog(game, `ターン${game.turn}`);
  game.lesson = "コードを組んで実行、そして攻撃";
  return game;
}

export function endPlayerTurn(game) {
  if (game.phase !== "player") return game;
  if (!game.player.active) {
    pushLog(game, "バトルモンスターを出してから");
    return game;
  }
  pushLog(game, "—— AIのターン ——");
  game.phase = "enemy";
  runEnemyTurn(game);
  if (game.phase === "win" || game.phase === "lose") return game;
  game.turn += 1;
  beginPlayerTurn(game);
  return game;
}

export function startBattle(game) {
  if (!game.player.active) {
    pushLog(game, "まずモンスターを出して");
    return game;
  }
  ensureEnemySetup(game);
  game.phase = "player";
  beginPlayerTurn(game);
  game.flags.battleStarted = true;
  game.lastFx = { type: "battle_start" };
  return game;
}

function ensureEnemySetup(game) {
  const side = game.enemy;
  const chars = side.hand.filter((c) => c.type === "character");
  if (!side.active && chars[0]) side.active = takeFromHand(side, chars[0].uid);
  const rest = side.hand.filter((c) => c.type === "character");
  const benchCount = game.aiLevel >= 15 ? 2 : 1;
  for (let i = 0; i < benchCount && rest[i] && !side.bench[i]; i++) {
    side.bench[i] = takeFromHand(side, rest[i].uid);
  }
}

function runEnemyTurn(game) {
  const side = game.enemy;
  const foe = game.player;
  drawCards(side, 3);
  if (!side.active) {
    const ch = side.hand.find((c) => c.type === "character");
    if (ch) side.active = takeFromHand(side, ch.uid);
    else {
      const bi = side.bench.findIndex(Boolean);
      if (bi >= 0) {
        side.active = side.bench[bi];
        side.bench[bi] = null;
      }
    }
  }
  if (!side.active || !foe.active) return;

  const lv = game.aiLevel || 1;
  // 低レベルは単純攻撃多め、高レベルはコードを組む
  if (lv >= 3) tryBuildAndExecute(game, side, ["damage", "enemy", "30"]);
  if (lv >= 8) tryBuildAndExecute(game, side, ["boost", "self", "20"]);
  if (lv >= 12 && side.active.hp < side.active.maxHp * 0.5) {
    tryBuildAndExecute(game, side, ["heal", "self", "30"]);
  }
  if (lv >= 18) tryBuildAndExecute(game, side, ["damage", "enemy", "50"]);
  if (lv >= 22) {
    tryBuildAndExecute(game, side, ["if", "HP", "<", "50", "then", "heal", "self", "30"]);
  }

  const def = getCardDef(side.active.defId);
  const useStrong = side.active.charged && def.attacks[1] && lv >= 5;
  const atk = useStrong ? def.attacks[1] : def.attacks[0];
  let dmg = Math.round((atk.damage + (side.active.boost || 0)) * (game.enemyDmgScale || 1));
  side.active.boost = 0;
  if (atk.cost > 0) side.active.charged = false;
  let target = foe.active;
  if (target.shield > 0) {
    const blocked = Math.min(target.shield, dmg);
    target.shield -= blocked;
    dmg -= blocked;
  }
  target.hp = Math.max(0, target.hp - dmg);
  pushLog(game, `AI ${def.name}「${atk.name}」→ ${dmg}`);
  game.lastFx = { type: "attack", amount: dmg, fromSide: "enemy", toSide: "player" };
  checkKnockout(game, foe, target);
}

function tryBuildAndExecute(game, side, recipe) {
  if (!side.active || side.active.code.length) return false;
  const taken = [];
  for (const tok of recipe) {
    const idx = side.hand.findIndex((c) => c.type === "code" && getCardDef(c.defId).token === tok);
    if (idx < 0) {
      side.hand.push(...taken);
      return false;
    }
    taken.push(side.hand.splice(idx, 1)[0]);
  }
  side.active.code.push(...taken);
  const st = getCodeStatus(side.active.code);
  if (!st.ok) {
    side.hand.push(...side.active.code);
    side.active.code = [];
    return false;
  }
  const ctx = {
    hp: side.active.hp,
    maxHp: side.active.maxHp,
    atk: getCardDef(side.active.defId).attacks[0].damage,
  };
  const result = executeAst(st.ast, ctx);
  if (!result.skipped) {
    applyEffects(game, side, result.effects, side.active, "AI");
    side.active.charged = true;
  }
  side.trash.push(...side.active.code);
  side.active.code = [];
  return true;
}

export function getCollection() {
  return { characters: CHARACTERS, codes: CODE_CARDS };
}

export function normalizeDeck(counts) {
  const list = [];
  for (const [id, n] of Object.entries(counts)) {
    for (let i = 0; i < n; i++) list.push(id);
  }
  return list;
}

export { getCardDef, STARTER_DECK, getCodeStatus };
