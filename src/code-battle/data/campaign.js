/** キャンペーン Lv1–30 & チュートリアル定義 */

import { CHARACTERS, STARTER_DECK, TUTORIAL_DECK } from "./cards.js";

export const TUTORIAL = {
  id: "tutorial",
  title: "チュートリアル",
  subtitle: "コードを組んでバトルしよう",
  steps: [
    {
      id: "welcome",
      text: "ようこそ！ここではカードを並べてプログラムを作り、モンスターを動かすよ。",
      wait: "tap",
    },
    {
      id: "place_char",
      text: "手札のモンスターを選んで、バトルゾーンに出そう。",
      require: "hasActive",
    },
    {
      id: "attach_code",
      text: "コードカードを ダメージ → enemy → 30 の順でモンスターにつけよう。緑の丸が出たらOK！",
      require: "codeOk",
    },
    {
      id: "execute",
      text: "「コード実行」を押そう。効果が発動してコードはトラッシュへ行くよ。",
      require: "executed",
    },
    {
      id: "attack",
      text: "技ボタンで攻撃！相手のHPを削ろう。",
      require: "attacked",
    },
    {
      id: "done",
      text: "完璧！これで基本はクリア。次はAIとの連戦に挑戦だ。",
      wait: "tap",
    },
  ],
  playerDeck: TUTORIAL_DECK,
  enemyDeck: TUTORIAL_DECK,
  enemyName: "練習用AI",
  aiLevel: 0,
  pointsToWin: 1,
};

function enemyNameForLevel(lv) {
  const names = [
    "ノイズの使い手",
    "分岐の番人",
    "バグの狩人",
    "層の守護者",
    "虚無の影",
    "構文の竜騎士",
    "輪廻の蛇使い",
    "記憶食い",
    "信号の司祭",
    "監視の梟",
  ];
  return `Lv${lv} ${names[(lv - 1) % names.length]}`;
}

function deckForLevel(lv) {
  // レベルが上がるほど強いモンスター比率を上げる
  const pool = CHARACTERS.map((c) => c.id);
  const strong = pool.slice(Math.min(3, pool.length - 1));
  const deck = [...STARTER_DECK];
  if (lv >= 10) {
    for (let i = 0; i < 4; i++) deck.push(strong[i % strong.length]);
  }
  if (lv >= 20) {
    for (let i = 0; i < 4; i++) deck.push(pool[pool.length - 1 - (i % 3)]);
  }
  return deck;
}

/** Lv1〜30 */
export const CAMPAIGN_LEVELS = Array.from({ length: 30 }, (_, i) => {
  const lv = i + 1;
  return {
    id: `lv_${lv}`,
    level: lv,
    title: `レベル ${lv}`,
    subtitle: enemyNameForLevel(lv),
    enemyName: enemyNameForLevel(lv),
    playerDeck: STARTER_DECK,
    enemyDeck: deckForLevel(lv),
    aiLevel: lv,
    /** AIモンスターのHP倍率 */
    enemyHpScale: 1 + (lv - 1) * 0.04,
    /** AIダメージ倍率 */
    enemyDmgScale: 1 + (lv - 1) * 0.03,
    pointsToWin: lv >= 25 ? 3 : lv >= 10 ? 2 : 1,
    rewardHint: lv % 5 === 0 ? "ボス戦" : null,
  };
});

export function getLevelConfig(level) {
  if (level === 0 || level === "tutorial") return TUTORIAL;
  return CAMPAIGN_LEVELS.find((l) => l.level === level) || CAMPAIGN_LEVELS[0];
}
