import { CUP_RULES, cupStandings } from './cup.js';

export const SAVE_KEY = 'gl_cup_progress_v1';
export const COSMETICS = Object.freeze([
  { id: 'stock', name: 'Factory Stock', glyph: '', color: '#b9cad3', requirement: 'Always available', earned: () => true },
  { id: 'beta', name: 'Certified Beta', glyph: 'B', color: '#67e1e5', requirement: 'Complete your first cup', earned: p => p.cups >= 1 },
  { id: 'void', name: 'Warranty Voided', glyph: '!', color: '#ff8d79', requirement: 'Win a cup', earned: p => p.wins >= 1 },
  { id: 'assist', name: 'Roadside Assistance', glyph: '+', color: '#a9e9aa', requirement: 'Make a save during a cup', earned: p => p.saves >= 1 },
  { id: 'orbit', name: 'Low Earth Orbit', glyph: 'O', color: '#b9a4ff', requirement: 'Earn 150 Warranty Claims', earned: p => p.claims >= 150 },
  { id: 'hotfix', name: 'Over-the-air Hotfix', glyph: 'X', color: '#ffe27a', requirement: 'Earn 300 Warranty Claims', earned: p => p.claims >= 300 },
  { id: 'recall', name: 'Total Recall', glyph: '#', color: '#f79ee6', requirement: 'Earn 500 Warranty Claims', earned: p => p.claims >= 500 }
]);
export const cosmetic = id => COSMETICS.find(c => c.id === id) || COSMETICS[0];
const empty = () => ({ version: 1, claims: 0, cups: 0, wins: 0, draws: 0, saves: 0, streak: 0, bestStreak: 0, equipped: 'stock', receipts: [], history: [] });
const count = n => Number.isSafeInteger(n) && n >= 0 && n < 1e9;
function decode(raw) {
  if (!raw) return empty();
  const value = JSON.parse(raw);
  if (value.version !== 1 || !['claims','cups','wins','draws','saves','streak','bestStreak'].every(k => count(value[k])) || !Array.isArray(value.receipts) || value.receipts.some(id => typeof id !== 'string' || !id || id.length > 128)) throw new TypeError('Invalid save');
  const p = { ...empty(), ...Object.fromEntries(['claims','cups','wins','draws','saves','streak','bestStreak'].map(k => [k, value[k]])), receipts: [...new Set(value.receipts)] };
  p.history = Array.isArray(value.history) ? value.history.filter(h => typeof h?.id === 'string' && ['A','B','shared'].includes(h.winner) && count(h.a) && count(h.b)).slice(-5) : [];
  p.equipped = COSMETICS.find(c => c.id === value.equipped && c.earned(p))?.id || 'stock';
  return p;
}
export function createProgression(storage) {
  let profile = empty(), persistent = !!storage, notice = 'Saved on this browser.';
  try { if (storage) profile = decode(storage.getItem(SAVE_KEY)); else notice = 'Storage unavailable. Rewards last for this visit.'; }
  catch (error) { notice = error instanceof SyntaxError || error instanceof TypeError ? 'Unreadable save. A fresh collection is ready.' : 'Storage unavailable. Rewards last for this visit.'; if (!(error instanceof SyntaxError || error instanceof TypeError)) persistent = false; }
  const save = () => {
    try { if (!persistent) return; storage.setItem(SAVE_KEY, JSON.stringify(profile)); notice = 'Saved on this browser.'; }
    catch { persistent = false; notice = 'Could not save. Rewards last for this visit.'; }
  };
  return {
    get view() { return { ...profile, receipts: undefined, history: profile.history.map(h => ({...h})), unlocked: COSMETICS.filter(c => c.earned(profile)).map(c => c.id), persistent, notice }; },
    completeCup({ id, heats, saves = 0 }) {
      if (typeof id !== 'string' || !id || id.length > 128 || !Array.isArray(heats) || heats.length !== CUP_RULES.heats || !count(saves)) throw new TypeError('Invalid completed cup');
      const standings = cupStandings(heats);
      if (profile.receipts.includes(id)) return { duplicate: true, claims: 0, unlocked: [] };
      const before = new Set(COSMETICS.filter(c => c.earned(profile)).map(c => c.id));
      const claims = 50 + (standings.winner === 'B' ? 0 : 25);
      profile.cups++; profile.claims += claims; profile.saves += saves;
      if (standings.winner === 'A') { profile.wins++; profile.streak++; }
      else { if (standings.winner === 'shared') profile.draws++; profile.streak = 0; }
      profile.bestStreak = Math.max(profile.bestStreak, profile.streak);
      profile.receipts.push(id);
      profile.history.push({ id, ...standings }); profile.history = profile.history.slice(-5);
      const unlocked = COSMETICS.filter(c => c.earned(profile) && !before.has(c.id)).map(c => c.id);
      save(); return { duplicate: false, claims, unlocked };
    },
    equip(id) {
      if (!COSMETICS.some(c => c.id === id && c.earned(profile))) return false;
      profile.equipped = id; save(); return true;
    }
  };
}
