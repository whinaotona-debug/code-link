/** バトル演出 */

let layer;

function ensureLayer() {
  if (layer && document.body.contains(layer)) return layer;
  layer = document.createElement("div");
  layer.id = "fx-layer";
  layer.setAttribute("aria-hidden", "true");
  document.body.appendChild(layer);
  return layer;
}

export function fxShake(el) {
  if (!el) return;
  el.classList.remove("fx-shake");
  void el.offsetWidth;
  el.classList.add("fx-shake");
}

export function fxFlash(el, kind = "damage") {
  if (!el) return;
  const cls = kind === "heal" ? "fx-flash-heal" : kind === "ok" ? "fx-flash-ok" : "fx-flash-dmg";
  el.classList.remove("fx-flash-heal", "fx-flash-ok", "fx-flash-dmg");
  void el.offsetWidth;
  el.classList.add(cls);
}

export function fxFloatText(targetEl, text, kind = "dmg") {
  const root = ensureLayer();
  const rect = targetEl?.getBoundingClientRect?.();
  const node = document.createElement("div");
  node.className = `fx-float fx-float-${kind}`;
  node.textContent = text;
  if (rect) {
    node.style.left = `${rect.left + rect.width / 2}px`;
    node.style.top = `${rect.top + rect.height / 3}px`;
  } else {
    node.style.left = "50%";
    node.style.top = "40%";
  }
  root.appendChild(node);
  setTimeout(() => node.remove(), 1100);
}

export function fxSlash(fromEl, toEl) {
  const root = ensureLayer();
  const a = fromEl?.getBoundingClientRect?.();
  const b = toEl?.getBoundingClientRect?.();
  if (!a || !b) return;
  const x1 = a.left + a.width / 2;
  const y1 = a.top + a.height / 2;
  const x2 = b.left + b.width / 2;
  const y2 = b.top + b.height / 2;
  const node = document.createElement("div");
  node.className = "fx-slash";
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  node.style.width = `${len}px`;
  node.style.left = `${x1}px`;
  node.style.top = `${y1}px`;
  node.style.transform = `rotate(${ang}deg)`;
  root.appendChild(node);
  setTimeout(() => node.remove(), 450);
}

export function fxCodeBurst(el) {
  if (!el) return;
  el.classList.remove("fx-code-burst");
  void el.offsetWidth;
  el.classList.add("fx-code-burst");
  const root = ensureLayer();
  const rect = el.getBoundingClientRect();
  for (let i = 0; i < 8; i++) {
    const p = document.createElement("div");
    p.className = "fx-spark";
    p.style.left = `${rect.left + rect.width / 2}px`;
    p.style.top = `${rect.top + rect.height / 2}px`;
    p.style.setProperty("--dx", `${(Math.random() - 0.5) * 120}px`);
    p.style.setProperty("--dy", `${(Math.random() - 0.5) * 100}px`);
    root.appendChild(p);
    setTimeout(() => p.remove(), 700);
  }
}

export function fxDealCards() {
  document.querySelectorAll(".hand-card").forEach((el, i) => {
    el.style.setProperty("--deal-i", String(i));
    el.classList.remove("fx-deal");
    void el.offsetWidth;
    el.classList.add("fx-deal");
  });
}

export function fxBanner(text) {
  const root = ensureLayer();
  const node = document.createElement("div");
  node.className = "fx-banner";
  node.textContent = text;
  root.appendChild(node);
  setTimeout(() => node.remove(), 1400);
}
