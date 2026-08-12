const KEY = "codelink_progress_v1";

const defaultProgress = () => ({
  tutorialDone: false,
  /** クリア済みの最高レベル（0=未クリア、1〜30） */
  maxCleared: 0,
  /** 次に挑戦できるレベル */
  unlocked: 1,
  wins: 0,
  losses: 0,
});

export function loadProgress() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultProgress();
    return { ...defaultProgress(), ...JSON.parse(raw) };
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(p) {
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function completeTutorial() {
  const p = loadProgress();
  p.tutorialDone = true;
  if (p.unlocked < 1) p.unlocked = 1;
  saveProgress(p);
  return p;
}

export function completeLevel(level) {
  const p = loadProgress();
  p.wins += 1;
  p.maxCleared = Math.max(p.maxCleared, level);
  p.unlocked = Math.max(p.unlocked, Math.min(30, level + 1));
  saveProgress(p);
  return p;
}

export function recordLoss() {
  const p = loadProgress();
  p.losses += 1;
  saveProgress(p);
  return p;
}

export function resetProgress() {
  const p = defaultProgress();
  saveProgress(p);
  return p;
}
