export const EFFECTS = {
  lure: { label: "Lure", minutes: 15 },
  booster: { label: "Booster x2 sell", minutes: 10 },
  luckycoin: { label: "Lucky Coin +25% sell", minutes: 60 },
  megabooster: { label: "Mega Booster x2.5 sell", minutes: 5 },
  doublehook: { label: "Double Hook 30%", minutes: 10 },
  vacuum: { label: "Vacuum -2 clicks", minutes: 15 },
  sonar: { label: "Sonar min Rare", minutes: 10 },
  charm: { label: "Charm (light rarity boost)", minutes: 24*60 },
  relic: { label: "Relic (strong rarity boost)", minutes: 24*60 },
};
export function now() { return new Date(); }
export function addMinutes(d, m) { return new Date(d.getTime() + m * 60 * 1000); }
export function isEffectActive(profile, key) {
  const t = now(); return (profile.activeEffects || []).some(e => e.key === key && e.until && e.until > t);
}
export function getActive(profile) {
  const t = now(); return (profile.activeEffects || []).filter(e => e.until && e.until > t);
}
export function activateEffect(profile, key, minutes) {
  const t = now(); const untilNew = addMinutes(t, minutes);
  const existing = (profile.activeEffects || []).find(e => e.key === key && e.until && e.until > t);
  if (existing) existing.until = addMinutes(existing.until, minutes); else profile.activeEffects.push({ key, until: untilNew });
}
export function formatRemaining(ms) { const sec = Math.ceil(ms/1000); const m = Math.floor(sec/60); const s = sec%60; return `${m}m ${s}s`; }
