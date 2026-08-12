/**
 * スポットライト・チュートリアル
 * 画面全体を暗くし、指定要素だけ穴を開けて明るく見せる
 */

let root;
let hole;
let panel;
let onNext = null;
let resizeObs;

function ensure() {
  if (root && document.body.contains(root)) return;
  root = document.createElement("div");
  root.id = "coach";
  root.hidden = true;
  root.innerHTML = `
    <div class="coach-dim" aria-hidden="true"></div>
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

  window.addEventListener("resize", () => {
    if (!root.hidden && root.dataset.sel) spotlight(root.dataset.sel);
  });
}

/**
 * @param {object} opts
 * @param {string} opts.text
 * @param {string} [opts.selector] CSS selector to spotlight
 * @param {number} opts.step
 * @param {number} opts.total
 * @param {boolean} [opts.showNext]
 * @param {() => void} [opts.onNext]
 */
export function showCoach(opts) {
  ensure();
  onNext = opts.onNext || null;
  root.hidden = false;
  root.classList.add("active");
  root.querySelector(".coach-text").textContent = opts.text;
  root.querySelector(".coach-step").textContent = `${opts.step} / ${opts.total}`;
  const nextBtn = root.querySelector("#coachNext");
  nextBtn.hidden = !opts.showNext;
  nextBtn.textContent = opts.nextLabel || "つぎへ";

  clearSpotlightClasses();
  if (opts.selector) {
    root.dataset.sel = opts.selector;
    requestAnimationFrame(() => spotlight(opts.selector));
  } else {
    delete root.dataset.sel;
    hole.hidden = true;
    hole.style.cssText = "";
  }
}

function clearSpotlightClasses() {
  document.querySelectorAll(".coach-spotlight").forEach((el) => {
    el.classList.remove("coach-spotlight");
  });
}

function spotlight(selector) {
  const el = document.querySelector(selector);
  if (!el) {
    hole.hidden = true;
    return;
  }
  const pad = 8;
  const r = el.getBoundingClientRect();
  hole.hidden = false;
  hole.style.left = `${Math.max(4, r.left - pad)}px`;
  hole.style.top = `${Math.max(4, r.top - pad)}px`;
  hole.style.width = `${r.width + pad * 2}px`;
  hole.style.height = `${r.height + pad * 2}px`;
  el.classList.add("coach-spotlight");

  // パネル位置：穴の下か上
  const spaceBelow = window.innerHeight - (r.bottom + pad);
  panel.classList.toggle("coach-panel-top", spaceBelow < 160);
}

export function hideCoach() {
  if (!root) return;
  root.hidden = true;
  root.classList.remove("active");
  clearSpotlightClasses();
  hole.hidden = true;
  delete root.dataset.sel;
  onNext = null;
}

export function refreshCoachSpotlight() {
  if (!root || root.hidden || !root.dataset.sel) return;
  spotlight(root.dataset.sel);
}
