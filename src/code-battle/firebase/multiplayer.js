/**
 * Firebase 対人戦 — 準備用スタブ
 * あとで Firebase プロジェクトを作ったら config を埋めて有効化する
 */

export const MULTIPLAYER_ENABLED = false;

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
  // Realtime Database or Firestore 用
  databaseURL: "https://YOUR_PROJECT.firebaseio.com",
};

/** 対人マッチの部屋作成・参加 API（未実装） */
export async function createMatchRoom(_opts = {}) {
  throw new Error("対人戦は準備中です。Firebase設定後に有効化できます。");
}

export async function joinMatchRoom(_roomId) {
  throw new Error("対人戦は準備中です。Firebase設定後に有効化できます。");
}

export function getMultiplayerStatus() {
  return {
    enabled: MULTIPLAYER_ENABLED,
    ready: false,
    message: "対人戦（Firebase）は近日公開予定",
  };
}
