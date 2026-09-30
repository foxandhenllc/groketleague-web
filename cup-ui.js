import { DIRECTIVES, directive } from './cup.js';
import { COSMETICS, cosmetic } from './progression.js';
import { simulationConfig } from './simulation-config.js';

const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const decal = c => `<span class="decalPreview" style="--decal:${c.color}" aria-hidden="true">${escape(c.glyph || '-')}</span>`;
const heatRows = cup => cup.heats.map((h, i) => `<li><span>Heat ${i + 1}</span><strong>${h.a} - ${h.b}</strong><span>${h.a === h.b ? 'Draw · 1 each' : h.a > h.b ? 'You · 3 points' : 'CPU · 3 points'}</span></li>`).join('');

export function createCupUI({ onDirective, onAction, onNext, onExit, onEquip }) {
  const layer = document.getElementById('cupLayer'), panel = document.getElementById('cupPanel');
  const hud = document.getElementById('cupHud'), actions = document.getElementById('cupActions');
  const collection = document.getElementById('collection');
  let panelKey = '', actionKey = '', collectionKey = '';
  layer.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.directive) onDirective(b.dataset.directive);
    if (b.dataset.cup === 'next') onNext();
    if (b.dataset.cup === 'exit') onExit();
    if (b.dataset.equip) onEquip(b.dataset.equip);
  });
  actions.addEventListener('click', e => { const b = e.target.closest('[data-action]'); if (b) onAction(b.dataset.action); });
  collection.addEventListener('click', e => { const b = e.target.closest('[data-equip]'); if (b) onEquip(b.dataset.equip); });
  layer.addEventListener('keydown', e => {
    if (e.code !== 'Tab') return;
    const buttons = [...panel.querySelectorAll('button:not(:disabled)')];
    const first = buttons[0], last = buttons.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  });
  return {
    update(cup, coaches, profile, reward, { playing, paused, car }) {
      layer.hidden = !cup || !['draft','reveal','summary','complete'].includes(cup.phase);
      hud.hidden = !cup || !playing || paused || cup.phase !== 'heat';
      if (!cup) { panelKey = ''; actionKey = ''; return; }
      const points = `${cup.standings.a} - ${cup.standings.b}`;
      if (!layer.hidden) {
        const key = `${cup.id}:${cup.heat}:${cup.phase}:${profile.equipped}`;
        if (key !== panelKey) {
          panelKey = key;
          const top = `<p class="cupEyebrow">FSD CUP / ${cup.phase === 'complete' ? 'FINAL REPORT' : `HEAT ${cup.heat} OF 3`}</p>`;
          if (cup.phase === 'draft') panel.innerHTML = top + `<h2 id="cupTitle">Make the call.</h2><p>FSD drives. Your rival has already locked a secret choice.</p><div class="directiveChoices">${DIRECTIVES.map(d => `<button type="button" data-directive="${d.id}"><strong>${d.name}</strong><span>${d.hint}</span></button>`).join('')}</div><p class="cupRules">2 interventions each. Winning the counter-pick adds 1.<br>60 seconds per heat. Win: 3 points. Draw: 1 each.<br>Dead ball? FSD recalibrates. Score and charges carry over.</p><p class="cupTimer" id="cupDraftClock"></p><p class="cupMuted">Practice rival: scripted CPU · 2D Stadium</p><button type="button" class="cupTextButton" data-cup="exit">Back to garage</button>`;
          else if (cup.phase === 'reveal') panel.innerHTML = top + `<h2 id="cupTitle">Directives locked.</h2><div class="draftReveal"><div><span>YOU</span><strong>${directive(cup.pick).name}</strong><b>${cup.allowances.A} charges</b></div><div><span>CPU RIVAL</span><strong>${directive(cup.rival).name}</strong><b>${cup.allowances.B} charges</b></div></div><p class="cupCounter">${cup.counter === null ? 'Same call. No bonus this heat.' : cup.counter === 'A' ? 'You countered the CPU. +1 intervention.' : 'CPU countered you. +1 intervention for your rival.'}</p><p class="cupTimer" id="cupDraftClock"></p>`;
          else if (cup.phase === 'summary') panel.innerHTML = top + `<h2 id="cupTitle">${cup.heats.at(-1).a === cup.heats.at(-1).b ? 'Honors even.' : cup.heats.at(-1).a > cup.heats.at(-1).b ? 'Heat secured.' : 'CPU takes the heat.'}</h2><p class="cupStanding">Cup points <strong>${points}</strong> You / CPU</p><ul class="cupHeatRows">${heatRows(cup)}</ul><p class="cupMuted">Next heat: a fresh secret pick and new charges.</p><div class="cupButtonRow"><button type="button" class="cupPrimary" data-cup="next">Next heat →</button><button type="button" class="cupSecondary" data-cup="exit">Leave cup</button></div>`;
          else {
            const winner = cup.standings.winner;
            panel.innerHTML = top + `<h2 id="cupTitle">${winner === 'shared' ? 'Shared custody.' : winner === 'A' ? 'Cup secured.' : 'CPU takes the cup.'}</h2><p class="cupStanding">Cup points <strong>${points}</strong> You / CPU</p><ul class="cupHeatRows">${heatRows(cup)}</ul><div class="cupReward"><strong>+${reward?.claims || 0} Warranty Claims</strong><span>${profile.claims} total · Earned cosmetics only</span></div>${reward?.unlocked.length ? `<div class="cupUnlocks">${reward.unlocked.map(id => {const c = cosmetic(id); return `<div class="cupUnlock">${decal(c)}<span><small>UNLOCKED ROOF DECAL</small><strong>${c.name}</strong></span><button type="button" class="cupSecondary" data-equip="${c.id}" ${profile.equipped === id ? 'disabled' : ''}>${profile.equipped === id ? 'Equipped' : 'Equip'}</button></div>`;}).join('')}</div>` : `<p class="cupMuted">Next decal: ${COSMETICS.find(c => !profile.unlocked.includes(c.id))?.requirement || 'Collection complete.'}</p>`}<p class="cupMuted">${escape(profile.notice)}</p><div class="cupButtonRow"><button type="button" class="cupPrimary" data-cup="next">Run it back</button><button type="button" class="cupSecondary" data-cup="exit">Garage & collection</button></div>`;
          }
          (panel.querySelector('button:not(:disabled)') || panel).focus({preventScroll:true});
        }
        const timer = document.getElementById('cupDraftClock');
        if (timer) timer.textContent = cup.phase === 'draft' ? `Locks in ${Math.ceil(cup.remaining)}s · No pick? Read the Room.` : `Heat starts in ${Math.ceil(cup.remaining)}s`;
      }
      if (!hud.hidden && coaches) {
        const own = coaches.A, rival = coaches.B, offer = own.offer;
        document.getElementById('cupHeatLabel').textContent = `HEAT ${cup.heat}/3 · CUP ${points}`;
        document.getElementById('cupCharges').textContent = `${own.charges} ${own.charges === 1 ? 'charge' : 'charges'}${own.reserved ? ' · 1 armed' : ''}`;
        document.getElementById('cupRivalStatus').textContent = `CPU: ${rival.charges} left${rival.status === 'activated' ? ' · intervention used' : ''}`;
        document.getElementById('cupDirectiveLabel').textContent = directive(cup.pick).name;
        const c = cosmetic(profile.equipped);
        document.getElementById('cupEquipped').textContent = c.id === 'stock' ? 'FSD has the wheel' : c.name;
        document.getElementById('cupEquipped').style.color = c.color;
        const title = document.getElementById('cupOfferTitle');
        title.textContent = offer ? `${({save:'Save incoming',contest:'Contested ball',attack:'Attack setup'})[offer.kind]} · ${offer.remaining.toFixed(1)}s` : own.charges === 0 ? 'Interventions spent. Enjoy the ride.' : 'Watching for an opening';
        const status = document.getElementById('cupActionStatus');
        if (status.textContent !== own.text) status.textContent = own.text;
        hud.dataset.status = own.status;
        const key = `${offer?.id}:${offer?.legal.join(',')}:${own.reserved}:${own.charges}:${car}`;
        if (key !== actionKey) {
          actionKey = key;
          const legal = offer && !own.reserved && own.charges > 0 ? offer.legal : [];
          actions.innerHTML = `<button type="button" data-action="boost" ${legal.includes('boost') ? '' : 'disabled'}>Boost <kbd>Space</kbd></button><button type="button" data-action="special" ${legal.includes('special') ? '' : 'disabled'}>${simulationConfig.skills.moves[car].name} <kbd>E</kbd></button><button type="button" data-action="pass" ${legal.includes('pass') ? '' : 'disabled'}>Pass</button>`;
        }
      }
    },
    collection(profile) {
      const key = JSON.stringify([profile.claims,profile.cups,profile.wins,profile.draws,profile.saves,profile.bestStreak,profile.equipped,profile.notice,profile.history]);
      if (key === collectionKey) return; collectionKey = key;
      document.getElementById('collectionSummary').textContent = `${profile.claims} Warranty Claims · ${profile.cups} cups · ${profile.wins} wins · ${profile.draws} shared · Best streak ${profile.bestStreak}`;
      collection.innerHTML = `<p class="specNote">Earned roof decals. All cars and moves are available from the start.</p><div class="collectionGrid">${COSMETICS.map(c => {const unlocked = profile.unlocked.includes(c.id); return `<button type="button" class="collectionItem" data-equip="${c.id}" ${unlocked ? '' : 'disabled'} aria-pressed="${profile.equipped === c.id}">${decal(c)}<strong>${c.name}</strong><span>${profile.equipped === c.id ? 'Equipped' : unlocked ? 'Equip decal' : c.requirement}</span></button>`;}).join('')}</div>${profile.history.length ? `<p class="specNote">Recent cups vs scripted CPU: ${profile.history.slice().reverse().map(h => `${h.a}-${h.b} ${h.winner === 'shared' ? 'shared' : h.winner === 'A' ? 'win' : 'loss'}`).join(' · ')}</p>` : ''}<p class="specNote">${escape(profile.notice)}</p>`;
    }
  };
}
