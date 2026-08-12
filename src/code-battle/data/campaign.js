/** キャンペーン Lv1–30 & チュートリアル定義 */

import { CHARACTERS, STARTER_DECK, TUTORIAL_DECK } from "./cards.js";

export const TUTORIAL = {
  id: "tutorial",
  title: "チュートリアル",
  subtitle: "コードを組んでバトルしよう",
  steps: [
    {
      id: "welcome",
      text: "コードリンクへようこそ。カードでプログラムを組んで、モンスターを動かそう。",
      wait: "tap",
      nextLabel: "はじめる",
    },
    {
      id: "pick_monster",
      text: "① 手札の【モンスター】カードをタップして選ぶ",
      require: "selectedChar",
      spotlight: '#handCards .hand-card.char',
    },
    {
      id: "place_char",
      text: "② 光っている【自分バトル】をタップして出す",
      require: "hasActive",
      spotlight: "#playerActiveZone",
    },
    {
      id: "start",
      text: "③ 【開始！】を押してバトルスタート",
      require: "battleStarted",
      spotlight: "#btnStart",
    },
    {
      id: "pick_damage",
      text: "④ コード【damage】を選ぶ（ダメージを与える命令）",
      require: "selectedToken:damage",
      spotlight: '#handCards .hand-card.code',
    },
    {
      id: "attach_damage",
      text: "⑤ バトル中のモンスターにタップしてコードをつける",
      require: "hasToken:damage",
      spotlight: "#playerActiveZone",
    },
    {
      id: "pick_enemy",
      text: "⑥ つぎは【enemy】（相手）を選んでつける",
      require: "hasToken:enemy",
      spotlight: "#playerActiveZone",
    },
    {
      id: "pick_30",
      text: "⑦ 最後に数値【30】をつけて文章を完成。右上が緑●になればOK",
      require: "codeOk",
      spotlight: "#playerActiveZone",
    },
    {
      id: "execute",
      text: "⑧ 【実行▶】を押す。プログラムが動いてコードは捨て札へ",
      require: "executed",
      spotlight: "#btnExec",
    },
    {
      id: "attack",
      text: "⑨ 技ボタンで攻撃！相手のHPをゼロにしよう",
      require: "attacked",
      spotlight: "#btnAttack0",
    },
    {
      id: "done",
      text: "クリア！基本操作はこれでOK。AI対戦に進もう。",
      wait: "tap",
      nextLabel: "AI対戦へ",
      finish: true,
    },
  ],
  playerDeck: TUTORIAL_DECK,
  enemyDeck: TUTORIAL_DECK,
  enemyName: "練習くん",
  aiLevel: 0,
  /** チュートリアル中は勝利判定を遅らせる（クリア画面で完了） */
  pointsToWin: 99,
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
    enemyHpScale: 1 + (lv - 1) * 0.04,
    enemyDmgScale: 1 + (lv - 1) * 0.03,
    pointsToWin: lv >= 25 ? 3 : lv >= 10 ? 2 : 1,
    rewardHint: lv % 5 === 0 ? "ボス戦" : null,
  };
});

export function getLevelConfig(level) {
  if (level === 0 || level === "tutorial") return TUTORIAL;
  return CAMPAIGN_LEVELS.find((l) => l.level === level) || CAMPAIGN_LEVELS[0];
}
