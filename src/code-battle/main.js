import "./style.css";
import { artForDef } from "./ui/art.js";
import {
  fxShake,
  fxFlash,
  fxFloatText,
  fxSlash,
  fxCodeBurst,
  fxDealCards,
  fxBanner,
} from "./ui/fx.js";
import {
  createGame,
  selectHand,
  setFocus,
  playSelected,
  popCode,
  executeCode,
  attack,
  promoteBench,
  startBattle,
  endPlayerTurn,
  getCardDef,
  getSlotCodeStatus,
  getCollection,
  STARTER_DECK,
  normalizeDeck,
} from "./engine/game.js";
import { TUTORIAL, CAMPAIGN_LEVELS, getLevelConfig } from "./data/campaign.js";
import {
  loadProgress,
  completeTutorial,
  completeLevel,
  recordLoss,
  resetProgress,
} from "./progress.js";
import { getMultiplayerStatus } from "./firebase/multiplayer.js";
import { listCraftable } from "./data/recipes.js";
import { showCoach, hideCoach, refreshCoachSpotlight } from "./ui/coach.js";

const app = document.getElementById("app");

/** @type {ReturnType<typeof createGame> | null} */
let game = null;
/** @type {Record<string, number>} */
let deckCounts = Object.create(null);
let tutorialStep = 0;
let currentMode = "title"; // title | tutorial | campaign | battle | deck
let currentLevel = null;

function initDeckCounts() {
  deckCounts = Object.create(null);
  for (const id of STARTER_DECK) deckCounts[id] = (deckCounts[id] || 0) + 1;
}
initDeckCounts();

function showScreen(id) {
  app.querySelectorAll(".screen").forEach((el) => {
    const on = el.id === id;
    el.classList.toggle("active", on);
    el.hidden = !on;
  });
}

function deckTotal() {
  return Object.values(deckCounts).reduce((a, b) => a + b, 0);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function statusDot(st) {
  if (!st || st.status === "empty") return `<span class="status-dot empty"></span>`;
  if (st.ok) return `<span class="status-dot ok"></span>`;
  return `<span class="status-dot error" title="${escapeHtml(st.error || "")}"></span>`;
}

function codeStrip(codeList) {
  if (!codeList?.length) return "";
  return `<div class="code-strip">${codeList
    .map((c) => {
      const d = getCardDef(c.defId);
      return `<span class="code-chip" style="background:${d.color}">${escapeHtml(d.token)}</span>`;
    })
    .join("")}</div>`;
}

function fieldCharHtml(char, side, slot, index) {
  if (!char) {
    return `<div class="empty-hint">${side === "enemy" ? "相手" : "タップして配置"}</div>`;
  }
  const def = getCardDef(char.defId);
  const st = getSlotCodeStatus(game, side === "player" ? "player" : "enemy", slot, index);
  const pct = Math.max(0, Math.round((char.hp / char.maxHp) * 100));
  const prog = st.tokens?.length ? `<div class="program-line">${escapeHtml(st.tokens.join(" "))}</div>` : "";
  const compact = slot === "bench";
  const art = compact
    ? artForDef(def, { w: 56, h: 44 })
    : artForDef(def, { w: 72, h: 58 });
  return `
    <div class="char-card ${compact ? "compact" : ""}" data-uid="${char.uid}" data-side="${side}" data-slot="${slot}" data-index="${index}" style="border-color:${def.color}">
      ${statusDot(st)}
      <div class="art-wrap">${art}</div>
      <div class="name">${escapeHtml(def.name)}</div>
      <div class="hp">HP ${char.hp}/${char.maxHp}${char.shield ? ` ·盾${char.shield}` : ""}${char.boost ? ` ·+${char.boost}` : ""}${char.charged ? " ·⚡" : ""}</div>
      <div class="hp-bar"><i style="width:${pct}%"></i></div>
      ${codeStrip(char.code)}
      ${prog}
    </div>`;
}

function handCardHtml(card) {
  const def = getCardDef(card.defId);
  const sel = game.selectedHandUid === card.uid ? " selected" : "";
  if (card.type === "character") {
    return `<button type="button" class="hand-card char${sel}" data-hand="${card.uid}" data-kind="char">
      <div class="art-wrap mini">${artForDef(def, { w: 64, h: 48 })}</div>
      <div class="t">${escapeHtml(def.name)}</div>
      <div class="sub">HP${def.hp}</div>
    </button>`;
  }
  return `<button type="button" class="hand-card code${sel}" data-hand="${card.uid}" data-kind="code" data-token="${escapeHtml(def.token)}" style="border-top-color:${def.color}">
    <div class="token" style="color:${def.color}">${escapeHtml(def.token)}</div>
    <div class="sub">${escapeHtml(def.tip)}</div>
  </button>`;
}

function availableCodeTokens() {
  const tokens = [];
  for (const c of game.player.hand) {
    if (c.type === "code") tokens.push(getCardDef(c.defId).token);
  }
  if (game.player.active) {
    for (const c of game.player.active.code) tokens.push(getCardDef(c.defId).token);
  }
  for (const c of game.player.supportCode) tokens.push(getCardDef(c.defId).token);
  return tokens;
}

function renderCraftHints() {
  const el = document.getElementById("craftHints");
  if (!el || !game) return;
  const list = listCraftable(availableCodeTokens());
  const ready = list.filter((r) => r.ready);
  const almost = list.filter((r) => !r.ready && r.almost);
  if (!ready.length && !almost.length) {
    el.innerHTML = `<span class="craft-empty">組めるコードなし（damage + enemy + 数値 など）</span>`;
    return;
  }
  el.innerHTML = [
    ...ready.map(
      (r) =>
        `<button type="button" class="craft-chip ready" data-craft="${escapeHtml(r.short)}" title="${escapeHtml(r.short)}">✓ ${escapeHtml(r.label)}</button>`
    ),
    ...almost.slice(0, 3).map(
      (r) =>
        `<span class="craft-chip almost" title="足りない: ${escapeHtml(r.missing.join(", "))}">△ ${escapeHtml(r.label)}</span>`
    ),
  ].join("");
}

function consumeFx() {
  if (!game?.lastFx) return;
  const fx = game.lastFx;
  game.lastFx = null;
  const playerCard = document.querySelector('#playerActive .char-card');
  const enemyCard = document.querySelector('#enemyActive .char-card');

  if (fx.type === "battle_start") fxBanner("バトル開始！");
  if (fx.type === "draw") fxDealCards();
  if (fx.type === "execute" || fx.execute) {
    fxCodeBurst(playerCard);
    fxBanner("コード実行！");
  }
  if (fx.type === "damage" || fx.type === "attack") {
    const to = fx.toSide === "player" || fx.targetSide === "player" ? playerCard : enemyCard;
    const from = fx.fromSide === "enemy" ? enemyCard : playerCard;
    if (from && to) fxSlash(from, to);
    fxShake(to);
    fxFlash(to, "damage");
    if (fx.amount) fxFloatText(to, `-${fx.amount}`, "dmg");
  }
  if (fx.type === "heal") {
    fxFlash(playerCard, "heal");
    fxFloatText(playerCard, `+${fx.amount}`, "heal");
  }
  if (fx.type === "ko") fxBanner(`${fx.name} ダウン！`);
  if (fx.type === "summon") fxDealCards();
}

function renderTitle() {
  hideResultOverlay();
  hideCoach();
  showScreen("screen-title");
  const p = loadProgress();
  const mp = getMultiplayerStatus();
  const el = document.getElementById("progressSummary");
  if (el) {
    el.textContent = p.tutorialDone
      ? `クリア Lv${p.maxCleared}/30 · 次は Lv${Math.min(30, p.unlocked)}`
      : "まずはチュートリアルから";
  }
  const mpEl = document.getElementById("mpStatus");
  if (mpEl) mpEl.textContent = mp.message;
}

function renderCampaign() {
  hideResultOverlay();
  hideCoach();
  showScreen("screen-campaign");
  const p = loadProgress();
  const grid = document.getElementById("levelGrid");
  if (!grid) return;
  grid.innerHTML = CAMPAIGN_LEVELS.map((lv) => {
    const locked = !p.tutorialDone || lv.level > p.unlocked;
    const cleared = lv.level <= p.maxCleared;
    const boss = lv.level % 5 === 0;
    return `<button type="button" class="level-btn ${locked ? "locked" : ""} ${cleared ? "cleared" : ""} ${boss ? "boss" : ""}" data-level="${lv.level}" ${locked ? "disabled" : ""}>
      <span class="lv-num">${lv.level}</span>
      <span class="lv-sub">${locked ? "🔒" : cleared ? "✓" : boss ? "BOSS" : "VS"}</span>
    </button>`;
  }).join("");
}

function renderDeck() {
  showScreen("screen-deck");
  const { characters, codes } = getCollection();
  document.getElementById("deckTotal").textContent = `${deckTotal()} 枚`;
  document.getElementById("deckChars").innerHTML = characters
    .map((c) => deckRowHtml(c, deckCounts[c.id] || 0))
    .join("");
  document.getElementById("deckCodes").innerHTML = codes
    .map((c) => deckRowHtml(c, deckCounts[c.id] || 0))
    .join("");
}

function deckRowHtml(def, n) {
  const name = def.type === "character" ? def.name : def.label;
  const meta = def.type === "character" ? `HP${def.hp}` : def.tip;
  return `<div class="deck-row" data-id="${def.id}">
    <div class="deck-art">${artForDef(def, { w: 48, h: 40 })}</div>
    <div><div class="nm">${escapeHtml(name)}</div><div class="meta">${escapeHtml(meta)}</div></div>
    <button type="button" data-act="minus" ${n <= 0 ? "disabled" : ""}>−</button>
    <span class="cnt">${n}</span>
    <button type="button" data-act="plus" ${n >= 4 ? "disabled" : ""}>＋</button>
  </div>`;
}

function renderBattle() {
  showScreen("screen-battle");
  const g = game;
  const p = g.player;
  const e = g.enemy;

  document.getElementById("turnLabel").textContent = `T${g.turn}`;
  document.getElementById("pointsLabel").textContent = `${p.points}-${e.points}`;
  document.getElementById("phaseLabel").textContent = phaseText(g.phase);
  const lessonEl = document.getElementById("lesson");
  if (g.tutorial) {
    lessonEl.hidden = true;
  } else {
    lessonEl.hidden = false;
    lessonEl.textContent = g.lesson || "";
  }
  document.getElementById("enemyName").textContent = e.name;

  const reportEl = document.getElementById("enemyReport");
  if (reportEl) {
    if (g.enemyReport?.length && g.phase === "player" && g.turn > 1) {
      reportEl.hidden = false;
      reportEl.innerHTML = `<strong>相手の行動</strong>${g.enemyReport
        .map((line) => `<div>${escapeHtml(line)}</div>`)
        .join("")}`;
    } else if (g.phase === "setup") {
      reportEl.hidden = false;
      reportEl.innerHTML = `<strong>準備</strong><div>モンスターを出して「開始！」</div>`;
    } else {
      reportEl.hidden = true;
      reportEl.innerHTML = "";
    }
  }

  document.getElementById("enemyActive").innerHTML = fieldCharHtml(e.active, "enemy", "active", 0);
  document.getElementById("enemyBench").innerHTML = benchHtml(e, "enemy");
  document.getElementById("supportSlot").innerHTML = supportHtml(p);
  document.getElementById("playerActive").innerHTML = fieldCharHtml(p.active, "player", "active", 0);
  document.getElementById("playerBench").innerHTML = benchHtml(p, "player");
  markFocus();

  document.getElementById("handCount").textContent =
    `手札${p.hand.length} · 山${p.deck.length}`;
  document.getElementById("handCards").innerHTML = p.hand.map(handCardHtml).join("");
  renderCraftHints();

  const canAct = g.phase === "player" || g.phase === "setup";
  const canAttack =
    canAct && g.phase !== "setup" && p.active && !g.hasAttackedThisTurn;
  document.getElementById("btnStart").hidden = g.phase !== "setup";
  document.getElementById("btnEnd").disabled = g.phase !== "player";
  document.getElementById("btnAttack0").disabled = !canAttack;
  document.getElementById("btnAttack1").disabled = !canAttack;
  document.getElementById("btnExec").disabled = !canAct || g.phase === "setup";
  document.getElementById("btnPop").disabled = !canAct;

  if (p.active) {
    const def = getCardDef(p.active.defId);
    document.getElementById("btnAttack0").textContent = g.hasAttackedThisTurn
      ? `${def.attacks[0].name}✓`
      : def.attacks[0].name;
    document.getElementById("btnAttack1").textContent = def.attacks[1]
      ? `${def.attacks[1].name}${p.active.charged ? "" : "🔒"}${g.hasAttackedThisTurn ? "✓" : ""}`
      : "—";
  }

  if (g.hasAttackedThisTurn && g.phase === "player") {
    document.getElementById("btnEnd").classList.add("pulse-end");
  } else {
    document.getElementById("btnEnd").classList.remove("pulse-end");
  }

  // チュートリアル（スポットライト）
  const tip = document.getElementById("tutorialTip");
  if (tip) tip.hidden = true;

  const overlay = document.getElementById("resultOverlay");
  if (g.tutorial) {
    // チュートリアル中は勝利モーダルを出さない（コーチで完了）
    overlay.classList.add("hidden");
  } else if (g.phase === "win" || g.phase === "lose") {
    overlay.classList.remove("hidden");
    const win = g.phase === "win";
    document.getElementById("resultTitle").textContent = win ? "勝利！" : "敗北…";
    document.getElementById("resultMsg").textContent = win
      ? `レベル ${g.campaignLevel} クリア！`
      : "もう一度挑戦しよう";
    if (!g._progressSaved) {
      g._progressSaved = true;
      if (win && g.campaignLevel) completeLevel(g.campaignLevel);
      if (!win && g.campaignLevel) recordLoss();
    }
  } else {
    overlay.classList.add("hidden");
  }

  requestAnimationFrame(() => {
    consumeFx();
    syncCoach();
    refreshCoachSpotlight();
  });
}

function hideResultOverlay() {
  const overlay = document.getElementById("resultOverlay");
  if (overlay) overlay.classList.add("hidden");
}

function leaveBattleTo(mode) {
  hideResultOverlay();
  hideCoach();
  game = null;
  currentMode = mode;
  if (mode === "title") renderTitle();
  else if (mode === "campaign") renderCampaign();
}

function syncCoach() {
  if (!game?.tutorial) {
    hideCoach();
    return;
  }
  const steps = TUTORIAL.steps;
  let step = steps[tutorialStep];
  if (!step) {
    hideCoach();
    return;
  }

  let guard = 0;
  while (step?.require && checkTutorialRequire(step.require) && guard < 12) {
    advanceTutorial();
    step = steps[tutorialStep];
    guard += 1;
  }
  if (!step) {
    hideCoach();
    return;
  }

  const sel = resolveSpotlight(step);

  showCoach({
    text: step.text,
    selector: sel,
    step: tutorialStep + 1,
    total: steps.length,
    showNext: step.wait === "tap" || step.finish,
    nextLabel: step.nextLabel || (step.finish ? "AI対戦へ" : "つぎへ"),
    onNext: () => {
      if (step.finish) {
        completeTutorial();
        leaveBattleTo("campaign");
        return;
      }
      advanceTutorial();
      renderBattle();
    },
  });
}

function resolveSpotlight(step) {
  if (step.require?.startsWith("selectedToken:")) {
    const tok = step.require.split(":")[1];
    return `#handCards .hand-card[data-token="${tok}"]`;
  }
  if (step.id === "pick_monster") return "#handCards .hand-card.char";
  if (step.id === "pick_damage") return '#handCards .hand-card[data-token="damage"]';

  if (step.id === "pick_enemy" || step.id === "pick_30") {
    const need = step.id === "pick_enemy" ? "enemy" : "30";
    const selected = game.player.hand.find((x) => x.uid === game.selectedHandUid);
    const selectedOk =
      selected?.type === "code" && getCardDef(selected.defId).token === need;
    if (!selectedOk) return `#handCards .hand-card[data-token="${need}"]`;
    return "#playerActiveZone";
  }

  if (step.id === "attach_damage") {
    const selected = game.player.hand.find((x) => x.uid === game.selectedHandUid);
    const ok = selected?.type === "code" && getCardDef(selected.defId).token === "damage";
    if (!ok && game.selectedHandUid) return "#playerActiveZone";
    if (!ok) return '#handCards .hand-card[data-token="damage"]';
    return "#playerActiveZone";
  }

  return step.spotlight || null;
}

function checkTutorialRequire(req) {
  if (!game) return false;
  if (req === "hasActive") return Boolean(game.player.active);
  if (req === "battleStarted") return Boolean(game.flags.battleStarted);
  if (req === "codeOk") {
    const st = getSlotCodeStatus(game, "player", "active", 0);
    return Boolean(st.ok);
  }
  if (req === "executed") return Boolean(game.flags.executed);
  if (req === "attacked") return Boolean(game.flags.attacked);
  if (req === "selectedChar") {
    const c = game.player.hand.find((x) => x.uid === game.selectedHandUid);
    return c?.type === "character";
  }
  if (req.startsWith("selectedToken:")) {
    const tok = req.split(":")[1];
    const c = game.player.hand.find((x) => x.uid === game.selectedHandUid);
    return c?.type === "code" && getCardDef(c.defId).token === tok;
  }
  if (req.startsWith("hasToken:")) {
    const tok = req.split(":")[1];
    const tokens = (game.player.active?.code || []).map((c) => getCardDef(c.defId).token);
    return tokens.includes(tok);
  }
  return false;
}

function advanceTutorial() {
  if (tutorialStep < TUTORIAL.steps.length - 1) {
    tutorialStep += 1;
    const step = TUTORIAL.steps[tutorialStep];
    if (step) game.lesson = step.text;
  }
}

function phaseText(ph) {
  return (
    { setup: "配置", player: "あなたの番", enemy: "AIの番", win: "勝利", lose: "敗北" }[ph] || ph
  );
}

function benchHtml(sideObj, sideKey) {
  return sideObj.bench
    .map((char, i) => {
      const focused =
        game.focus?.side === sideKey && game.focus?.slot === "bench" && game.focus?.index === i
          ? " focused"
          : "";
      return `<div class="bench-slot${focused}" data-focus-side="${sideKey}" data-focus-slot="bench" data-focus-index="${i}">
        <div class="slot-label">Bench ${i + 1}</div>
        ${char ? fieldCharHtml(char, sideKey, "bench", i) : `<div class="empty-hint">—</div>`}
      </div>`;
    })
    .join("");
}

function supportHtml(p) {
  const st = getSlotCodeStatus(game, "player", "support");
  const prog = st.tokens?.length ? `<div class="program-line">${escapeHtml(st.tokens.join(" "))}</div>` : "";
  return `${statusDot(st)}<div class="slot-label">サポート</div>${
    p.supportCode.length
      ? `${codeStrip(p.supportCode)}${prog}`
      : `<div class="empty-hint">回復コードなど</div>`
  }`;
}

function markFocus() {
  const f = game.focus;
  document.getElementById("supportSlot").classList.toggle(
    "focused",
    f?.side === "player" && f?.slot === "support"
  );
  document.getElementById("playerActiveZone").classList.toggle(
    "focused",
    f?.side === "player" && f?.slot === "active"
  );
}

function startLevel(levelOrTutorial) {
  hideResultOverlay();
  hideCoach();
  const cfg = levelOrTutorial === "tutorial" ? TUTORIAL : getLevelConfig(levelOrTutorial);
  tutorialStep = 0;
  currentLevel = cfg.level ?? "tutorial";
  game = createGame({
    playerDeck: normalizeDeck(deckCounts).length >= 20 ? normalizeDeck(deckCounts) : cfg.playerDeck,
    enemyDeck: cfg.enemyDeck,
    enemyName: cfg.enemyName,
    aiLevel: cfg.aiLevel,
    enemyHpScale: cfg.enemyHpScale ?? 1,
    enemyDmgScale: cfg.enemyDmgScale ?? 1,
    pointsToWin: cfg.pointsToWin ?? 1,
    tutorial: cfg.id === "tutorial",
    campaignLevel: cfg.level ?? null,
  });
  if (cfg.id === "tutorial") {
    game = createGame({
      playerDeck: cfg.playerDeck,
      enemyDeck: cfg.enemyDeck,
      enemyName: cfg.enemyName,
      aiLevel: 0,
      pointsToWin: cfg.pointsToWin ?? 99,
      tutorial: true,
      campaignLevel: null,
    });
  }
  currentMode = "battle";
  renderBattle();
}

function boot() {
  app.innerHTML = `
    <section class="screen title-screen active" id="screen-title">
      <div class="title-inner">
        <p class="eyebrow">PROGRAMMING CARD BATTLE</p>
        <h1 class="brand">コードリンク</h1>
        <p class="tagline">モンスターにコードをくみ、AIに勝ち抜け。</p>
        <p class="progress-line" id="progressSummary"></p>
        <div class="title-actions">
          <button type="button" class="btn btn-primary" id="btnTutorial">チュートリアル</button>
          <button type="button" class="btn btn-teal" id="btnCampaign">AI対戦 (Lv1–30)</button>
          <button type="button" class="btn btn-ghost" id="btnDeck">デッキ</button>
          <button type="button" class="btn btn-ghost" id="btnPvp" title="準備中">対人戦（準備中）</button>
        </div>
        <p class="mp-note" id="mpStatus"></p>
      </div>
    </section>

    <section class="screen campaign-screen" id="screen-campaign" hidden>
      <div class="camp-header">
        <button type="button" class="btn btn-ghost" id="btnCampBack">←</button>
        <h1>キャンペーン</h1>
        <button type="button" class="btn btn-ghost" id="btnResetProg">進捗リセット</button>
      </div>
      <p class="camp-lead">クリアすると次のレベルが開く。5の倍数はボス。</p>
      <div class="level-grid" id="levelGrid"></div>
    </section>

    <section class="screen deck-screen" id="screen-deck" hidden>
      <div class="deck-header">
        <button type="button" class="btn btn-ghost" id="btnDeckBack">←</button>
        <h1>デッキ</h1>
        <span class="deck-count" id="deckTotal">0</span>
        <button type="button" class="btn btn-ghost" id="btnDeckReset">初期化</button>
      </div>
      <div class="deck-grid">
        <div class="panel"><h2>モンスター</h2><div class="card-list" id="deckChars"></div></div>
        <div class="panel"><h2>コード</h2><div class="card-list" id="deckCodes"></div></div>
      </div>
    </section>

    <section class="screen battle-screen" id="screen-battle" hidden>
      <div class="topbar">
        <div class="brand-mini">コードリンク</div>
        <span class="stat" id="enemyName">AI</span>
        <span class="stat" id="turnLabel">T1</span>
        <span class="stat"><span id="pointsLabel">0-0</span>pt</span>
        <span class="stat" id="phaseLabel"></span>
        <button type="button" class="btn btn-ghost btn-sm" id="btnTitle">メニュー</button>
      </div>
      <div class="lesson" id="lesson"></div>
      <div class="enemy-report" id="enemyReport" hidden></div>

      <div class="board">
        <div class="enemy-row field">
          <div class="zone-block">
            <div class="slot-label">相手</div>
            <div class="zone" id="enemyActive"></div>
            <div class="bench-row" id="enemyBench"></div>
          </div>
        </div>
        <div class="player-row field">
          <div class="support-slot" id="supportSlot"></div>
          <div class="zone-block">
            <div class="slot-label">自分</div>
            <div class="zone" id="playerActiveZone"><div id="playerActive"></div></div>
            <div class="bench-row" id="playerBench"></div>
          </div>
        </div>
      </div>

      <div class="craft-hints" id="craftHints"></div>

      <div class="hand-area">
        <div class="hand-toolbar">
          <span class="label" id="handCount"></span>
          <button type="button" class="btn btn-teal btn-sm" id="btnPlaySelected">配置</button>
          <button type="button" class="btn btn-ghost btn-sm" id="btnPop">戻す</button>
          <button type="button" class="btn btn-amber btn-sm" id="btnExec">実行▶</button>
          <button type="button" class="btn btn-ghost btn-sm" id="btnAttack0">技1</button>
          <button type="button" class="btn btn-ghost btn-sm" id="btnAttack1">技2</button>
          <button type="button" class="btn btn-primary btn-sm" id="btnStart">開始！</button>
          <button type="button" class="btn btn-primary btn-sm" id="btnEnd">ターン終了</button>
        </div>
        <div class="hand-scroll" id="handCards"></div>
      </div>
    </section>

    <div class="overlay hidden" id="resultOverlay">
      <div class="modal">
        <h2 id="resultTitle">勝利！</h2>
        <p id="resultMsg"></p>
        <div class="title-actions">
          <button type="button" class="btn btn-primary" id="btnAgain">つづける</button>
          <button type="button" class="btn btn-ghost" id="btnResultTitle">メニュー</button>
        </div>
      </div>
    </div>
  `;
  bind();
  renderTitle();
}

function bind() {
  document.getElementById("btnTutorial").onclick = () => startLevel("tutorial");
  document.getElementById("btnCampaign").onclick = () => {
    const p = loadProgress();
    if (!p.tutorialDone) {
      alert("先にチュートリアルをクリアしてね");
      return;
    }
    currentMode = "campaign";
    renderCampaign();
  };
  document.getElementById("btnDeck").onclick = () => {
    currentMode = "deck";
    renderDeck();
  };
  document.getElementById("btnPvp").onclick = () => {
    alert(getMultiplayerStatus().message + "\n\nFirebase設定後に対戦できます。");
  };
  document.getElementById("btnCampBack").onclick = () => {
    currentMode = "title";
    game = null;
    renderTitle();
  };
  document.getElementById("btnResetProg").onclick = () => {
    if (confirm("進捗をリセットする？")) {
      resetProgress();
      renderCampaign();
    }
  };
  document.getElementById("levelGrid").onclick = (ev) => {
    const btn = ev.target.closest("[data-level]");
    if (!btn || btn.disabled) return;
    startLevel(Number(btn.dataset.level));
  };
  document.getElementById("btnDeckBack").onclick = () => {
    currentMode = "title";
    renderTitle();
  };
  document.getElementById("btnDeckReset").onclick = () => {
    initDeckCounts();
    renderDeck();
  };
  document.getElementById("screen-deck").onclick = (ev) => {
    const row = ev.target.closest(".deck-row");
    if (!row) return;
    const act = ev.target.getAttribute("data-act");
    if (!act) return;
    const id = row.dataset.id;
    const n = deckCounts[id] || 0;
    if (act === "plus" && n < 4) deckCounts[id] = n + 1;
    if (act === "minus" && n > 0) deckCounts[id] = n - 1;
    renderDeck();
  };

  document.getElementById("handCards").onclick = (ev) => {
    const btn = ev.target.closest("[data-hand]");
    if (!btn || !game) return;
    selectHand(game, btn.dataset.hand);
    renderBattle();
  };

  const focusClick = (side, slot, index) => {
    if (!game) return;
    setFocus(game, { side, slot, index });
    if (side === "player" && game.selectedHandUid) playSelected(game);
    else if (
      side === "player" &&
      slot === "bench" &&
      !game.selectedHandUid &&
      game.player.bench[index] &&
      (game.phase === "player" || game.phase === "setup")
    ) {
      if (!game.player.active || confirm("交代する？")) promoteBench(game, index);
    }
    renderBattle();
  };

  document.getElementById("supportSlot").onclick = () => focusClick("player", "support", 0);
  document.getElementById("playerActiveZone").onclick = () => focusClick("player", "active", 0);
  document.getElementById("playerBench").onclick = (ev) => {
    const slot = ev.target.closest("[data-focus-slot]");
    if (!slot) return;
    focusClick("player", "bench", Number(slot.dataset.focusIndex));
  };

  document.getElementById("btnPlaySelected").onclick = () => {
    playSelected(game);
    renderBattle();
  };
  document.getElementById("btnPop").onclick = () => {
    if (!game?.focus || game.focus.side !== "player") return;
    popCode(game, "player", game.focus.slot, game.focus.index || 0);
    renderBattle();
  };
  document.getElementById("btnExec").onclick = () => {
    if (!game?.focus || game.focus.side !== "player") {
      alert("実行する枠を選んでね");
      return;
    }
    executeCode(game, "player", game.focus.slot, game.focus.index || 0);
    renderBattle();
  };
  document.getElementById("btnAttack0").onclick = () => {
    attack(game, 0);
    renderBattle();
  };
  document.getElementById("btnAttack1").onclick = () => {
    attack(game, 1);
    renderBattle();
  };
  document.getElementById("btnStart").onclick = () => {
    startBattle(game);
    renderBattle();
  };
  document.getElementById("btnEnd").onclick = () => {
    endPlayerTurn(game);
    renderBattle();
  };
  document.getElementById("btnTitle").onclick = () => leaveBattleTo("title");
  document.getElementById("btnAgain").onclick = () => {
    hideResultOverlay();
    if (game?.campaignLevel) {
      const next = Math.min(30, game.campaignLevel + 1);
      const p = loadProgress();
      if (p.unlocked >= next) {
        startLevel(next);
        return;
      }
      leaveBattleTo("campaign");
      return;
    }
    leaveBattleTo("title");
  };
  document.getElementById("btnResultTitle").onclick = () => leaveBattleTo("title");
}

boot();
