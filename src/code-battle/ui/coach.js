/**
 * スポットライト・チュートリアル（モバイル対応）
 */

let root;
let hole;
let panel;
let onNext = null;

function ensure() {
  if (root && document.body.contains(root)) return;
  root = document.createElement("div");
  root.id = "coach";
  root.hidden = true;
  root.innerHTML = `
    <div class="coach-hole" hidden></div>
    <div class="coach-panel" role="dialog" aria-live="polite">
      <div class="coach-progress"><span class="coach-step"></span></div>
      <p class="coach-text"></p>
      <div class="coach-actions">
        <button type="button" class="btn btn-teal" id="coachNext">つぎへ</button>
      </div>
    </div>
  `;
  document.body.appendChild(root);
  hole = root.querySelector(".coach-hole");
  panel = root.querySelector(".coach-panel");
  root.querySelector("#coachNext").onclick = () => {
    if (typeof onNext === "function") onNext();
  };

  const relayout = () => {
    if (!root.hidden && root.dataset.sel) spotlight(root.dataset.sel);
    else if (!root.hidden) placePanel(null);
  };
  window.addEventListener("resize", relayout);
  window.addEventListener("orientationchange", () => setTimeout(relayout, 120));
}

/**
 * @param {object} opts
 */
export function showCoach(opts) {
  ensure();
  onNext = opts.onNext || null;
  root.hidden = false;
  root.classList.add("active");
  document.documentElement.classList.add("coach-open");
  document.body.classList.add("coach-open");

  root.querySelector(".coach-text").textContent = opts.text;
  root.querySelector(".coach-step").textContent = `${opts.step} / ${opts.total}`;
  const nextBtn = root.querySelector("#coachNext");
  nextBtn.hidden = !opts.showNext;
  nextBtn.textContent = opts.nextLabel || "つぎへ";

  clearSpotlightClasses();
  if (opts.selector) {
    root.dataset.sel = opts.selector;
    requestAnimationFrame(() => {
      spotlight(opts.selector);
      // レイアウト後にもう一度（手札スクロール等）
      requestAnimationFrame(() => spotlight(opts.selector));
    });
  } else {
    delete root.dataset.sel;
    hole.hidden = true;
    hole.style.cssText = "";
    placePanel(null);
  }
}

function clearSpotlightClasses() {
  document.querySelectorAll(".coach-spotlight").forEach((el) => {
    el.classList.remove("coach-spotlight");
  });
}

function isMobile() {
  return window.matchMedia("(max-width: 700px)").matches || window.innerWidth < 700;
}

function clampHole(rect) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = 6;
  const maxW = Math.min(vw - pad * 2, isMobile() ? vw - 16 : vw - 24);
  const maxH = Math.min(vh * 0.42, isMobile() ? vh * 0.38 : vh * 0.5);

  let w = Math.min(rect.width, maxW);
  let h = Math.min(rect.height, maxH);
  let left = rect.left + (rect.width - w) / 2;
  let top = rect.top + (rect.height - h) / 2;

  left = Math.min(Math.max(pad, left), vw - w - pad);
  top = Math.min(Math.max(pad, top), vh - h - pad);
  return { left, top, width: w, height: h };
}

function placePanel(targetRect) {
  panel.classList.remove("coach-panel-top", "coach-panel-bottom", "coach-panel-mid");
  const mobile = isMobile();
  const vh = window.innerHeight;

  if (!targetRect) {
    panel.classList.add(mobile ? "coach-panel-top" : "coach-panel-bottom");
    return;
  }

  const midY = targetRect.top + targetRect.height / 2;
  // 手札・下部UIを指すときはパネルを上へ
  if (mobile || midY > vh * 0.45) {
    panel.classList.add("coach-panel-top");
  } else {
    panel.classList.add("coach-panel-bottom");
  }
}

function spotlight(selector) {
  const el = document.querySelector(selector);
  if (!el) {
    hole.hidden = true;
    placePanel(null);
    return;
  }

  // 見やすい位置までスクロール（パネル分の余白を確保）
  const mobile = isMobile();
  try {
    el.scrollIntoView({ block: mobile ? "center" : "nearest", inline: "nearest", behavior: "instant" });
  } catch {
    el.scrollIntoView(false);
  }

  const raw = el.getBoundingClientRect();
  // 手札カードは横に長いリストなので、カード単体の矩形に抑える
  const r = clampHole({
    left: raw.left,
    top: raw.top,
    width: raw.width,
    height: raw.height,
  });

  hole.hidden = false;
  hole.style.left = `${r.left}px`;
  hole.style.top = `${r.top}px`;
  hole.style.width = `${r.width}px`;
  hole.style.height = `${r.height}px`;
  el.classList.add("coach-spotlight");
  placePanel(r);

  // 選択カードが手札内なら中央へ横スクロール
  const hand = document.getElementById("handCards");
  if (hand && hand.contains(el)) {
    const handRect = hand.getBoundingClientRect();
    const offset = el.offsetLeft - (hand.clientWidth / 2 - el.clientWidth / 2);
    hand.scrollTo({ left: Math.max(0, offset), behavior: "smooth" });
  }
}

export function hideCoach() {
  if (!root) return;
  root.hidden = true;
  root.classList.remove("active");
  document.documentElement.classList.remove("coach-open");
  document.body.classList.remove("coach-open");
  clearSpotlightClasses();
  hole.hidden = true;
  delete root.dataset.sel;
  onNext = null;
}

export function refreshCoachSpotlight() {
  if (!root || root.hidden || !root.dataset.sel) return;
  spotlight(root.dataset.sel);
}
