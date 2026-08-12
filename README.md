# コードリンク (Code Link)

プログラミングを学べるモンスターカードバトル。ポケポケ風の盤面で、コードカードを並べてプログラムを完成させ、実行して戦う。

## 遊び方

1. **チュートリアル**で基本操作を覚える
2. **AI対戦 (Lv1–30)** を順番にクリア
3. カードを並べて緑●になったら **実行**
4. 技で攻撃し、規定ポイントで勝利

### コード例

- `damage enemy 30`
- `heal self 20`
- `if HP < 50 then heal self 30`

## 起動

```bash
npm install
npm run dev
```

ブラウザで表示される URL（例: http://localhost:5173/）を開く。

- カードゲーム: `/` または `/code-battle.html`
- ピタゴラメーカー: `/pitagora.html`

## モバイル

レスポンシブ対応。スマホのブラウザでもプレイ可能。

## 対人戦（予定）

`src/code-battle/firebase/multiplayer.js` に Firebase 連携のスタブあり。  
設定を埋めて `MULTIPLAYER_ENABLED = true` にすると対人戦を拡張できる。

## 技術

- Vite + Vanilla JS
- ローカル進捗: `localStorage`
