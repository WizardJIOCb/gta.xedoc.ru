import './hud.css';

const MAIN_ROADS = [-128, -64, 0];
const CROSS_STREETS = [-224, -160, -96, -32, 32, 96];
const currencyNumber = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const paths = {
  sound: '<path d="m3 9 4 0 5-4v14l-5-4H3z"/><path d="M15 8a6 6 0 0 1 0 8m3-12a11 11 0 0 1 0 16"/>',
  silent: '<path d="m3 9 4 0 5-4v14l-5-4H3z"/><path d="m16 9 6 6m0-6-6 6"/>',
  pause: '<path d="M8 5v14m8-14v14" stroke-width="3.5"/>',
  arrow: '<path d="m9 5 7 7-7 7"/>',
  wheel: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="1.8"/><path d="m4.7 8.5 6 3m8.6-3-6 3m-1.3 2v6"/>',
  walk: '<circle cx="14" cy="4.5" r="1.7"/><path d="m7 13 3-4 4-1 2 4 3 1m-6-4-2 7-4 5m5-7 3 3 1 4"/>',
  flag: '<path d="M5 21V4m.5 1C11 1 14 9 20 4v8c-6 5-9-3-14.5 1"/>',
};
function icon(name) {
  return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' + paths[name] + '</svg>';
}
function duration(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
const closest = (list, value) => list.reduce((a, b) => Math.abs(a - value) < Math.abs(b - value) ? a : b);

function drawMap(canvas, s) {
  const r = canvas.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(r.width), h = Math.round(r.height);
  const width = Math.round(w * pixelRatio), height = Math.round(h * pixelRatio);
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const scale = w / 180;
  const px = x => w * .47 + (x - s.x) * scale;
  const py = z => h * .65 + (z - s.z) * scale;
  function rect(x, z, ww, dd, color) {
    ctx.fillStyle = color; ctx.fillRect(px(x), py(z), ww * scale, dd * scale);
  }
  function line(coords, color, thickness) {
    ctx.beginPath();
    for (let i = 0; i < coords.length; i++) {
      const [x, z] = coords[i];
      if (i === 0) ctx.moveTo(px(x), py(z)); else ctx.lineTo(px(x), py(z));
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = thickness;
    ctx.strokeStyle = color; ctx.stroke();
  }
  ctx.fillStyle = '#394846'; ctx.fillRect(0, 0, w, h);
  rect(13,-1000,27,2000,'#5e6b59'); rect(40,-1000,28,2000,'#8b8a72'); rect(68,-1000,1600,2000,'#356169');
  for (const x of MAIN_ROADS.slice(0,2)) for (const z of CROSS_STREETS.slice(0,-1)) {
    rect(x+9,z+10,20,16,'#53615a'); rect(x+33,z+9,17,28,'#566057');
    rect(x+9,z+32,19,22,'#46564d'); rect(x+34,z+41,19,13,'#53615a');
  }
  const road = '#929a8c';
  for (const x of MAIN_ROADS) line([[x,-250],[x,122]],road,5 * scale);
  for (const z of CROSS_STREETS) line([[-147,z],[z === -160 ? 50 : 10,z]],road,4.6 * scale);
  const isFoot = s.phase === 'foot', tx = isFoot ? s.carX : s.goalX, tz = isFoot ? s.carZ : s.goalZ;
  if (s.phase !== 'done' && Number.isFinite(tx) && Number.isFinite(tz)) {
    const route = [[s.x,s.z]];
    if (!isFoot) {
      const roadX = closest(MAIN_ROADS, s.x);
      if (roadX !== 0) {
        const cross = closest(CROSS_STREETS, s.z);
        route.push([roadX,s.z],[roadX,cross],[0,cross]);
      } else if (Math.abs(s.z - tz) > 9 || s.x < 0) { route.push([0,s.z]); }
      if (Math.abs(s.z - tz) > 9 || roadX !== 0) route.push([0,tz]);
    }
    route.push([tx,tz]);
    line(route,'#492e32',4.6); line(route,'#ff9883',2.6);
    const mx = Math.min(w - 8, Math.max(8, px(tx))), my = Math.min(h - 8, Math.max(8, py(tz)));
    ctx.save(); ctx.translate(mx,my); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffab92'; ctx.strokeStyle = '#493334'; ctx.lineWidth = 1.8;
    ctx.fillRect(-3.7,-3.7,7.4,7.4); ctx.strokeRect(-3.7,-3.7,7.4,7.4); ctx.restore();
  }
  ctx.save(); ctx.translate(px(s.x), py(s.z)); ctx.rotate(-s.yaw);
  ctx.beginPath(); ctx.moveTo(0,-7.5); ctx.lineTo(5.5,5.7); ctx.lineTo(0,3.5); ctx.lineTo(-5.5,5.7); ctx.closePath();
  ctx.strokeStyle='#25312e'; ctx.lineWidth=2.7; ctx.stroke(); ctx.fillStyle='#fff6d9'; ctx.fill(); ctx.restore();
}

export function createHUD({onAction, onKey}) {
  const root = document.createElement('div');
  root.className = 'pc-hud';
  root.innerHTML = `
    <div class="pc-mast">
      <div class="pc-lockup"><i class="pc-sun" aria-hidden="true"></i><b>Palm Coast</b></div>
      <div class="pc-job">
        <span class="pc-kicker"><i></i> Задание</span>
        <strong>Чужие ключи</strong>
        <span class="pc-objective"></span>
      </div>
    </div>
    <div class="pc-tools"><button type="button" data-action="audio" class="pc-tool"></button><button type="button" data-action="pause" class="pc-tool" aria-label="Пауза (Esc)" title="Пауза (Esc)">${icon('pause')}</button></div>
    <div class="pc-navigation">
      <div class="pc-map"><canvas aria-label="Мини-карта района"></canvas><span class="pc-north">N</span></div>
      <div class="pc-map-caption"><b>Ocean Drive</b><span class="pc-distance"></span></div>
    </div>
    <div class="pc-center">
      <div class="pc-toast" role="status"></div>
      <button type="button" class="pc-interact" data-action="interact"><kbd>E</kbd><span></span>${icon('arrow')}</button>
      <div class="pc-bindings"></div>
    </div>
    <div class="pc-instruments">
      <div class="pc-instrument-caption">${icon('wheel')}<span>Кабриолет</span></div>
      <div class="pc-speed"><b></b><span>км/ч</span></div>
      <div class="pc-health"><span>Кузов</span><i><u></u></i></div>
    </div>
    <div class="pc-touch" aria-label="Сенсорное управление">
      <div class="pc-touch-steer">
        <button data-key="KeyA" aria-label="Влево">◀</button><button data-key="KeyD" aria-label="Вправо">▶</button>
      </div>
      <div class="pc-touch-go">
        <button data-key="Space" class="pc-handbrake" aria-label="Ручной тормоз">Ручник</button><button data-key="KeyS" aria-label="Назад">▼</button><button data-key="KeyW" aria-label="Вперёд">▲</button>
      </div>
    </div>
    <div class="pc-scrim" hidden>
      <section class="pc-dialog" role="dialog" aria-modal="true" aria-labelledby="pc-dialog-title">
        <div class="pc-lockup"><i class="pc-sun" aria-hidden="true"></i><b>Palm Coast</b></div>
        <p class="pc-dialog-kicker"></p><h1 id="pc-dialog-title"></h1>
        <div class="pc-result"></div>
        <div class="pc-dialog-actions"><button data-action="resume">Продолжить ${icon('arrow')}</button><button data-action="restart"></button></div>
      </section>
    </div>`;
  document.body.append(root);
  const get = sel => root.querySelector(sel);
  const parts = Object.fromEntries(['objective','distance','bindings','speed','health','instruments','toast','interact','scrim','dialog-kicker','result'].map(name => [name,get('.pc-'+name)]));
  const map = get('.pc-map canvas'), audio = get('[data-action="audio"]');
  const speed = parts.speed.querySelector('b'), bar = parts.health.querySelector('u'), label = parts.interact.querySelector('span');
  const menuTitle = get('#pc-dialog-title'), resume = get('[data-action="resume"]'), restart = get('[data-action="restart"]');
  root.addEventListener('click', event => { const button = event.target.closest('[data-action]'); if (button) onAction(button.dataset.action); });
  const pressed = new Map();
  function release(pointerId) {
    const b = pressed.get(pointerId);
    if (!b) return;
    pressed.delete(pointerId);
    if (![...pressed.values()].includes(b)) { b.classList.remove('is-held'); onKey(b.dataset.key,false); }
  }
  for (const b of root.querySelectorAll('[data-key]')) {
    b.addEventListener('pointerdown', event => {
      event.preventDefault(); b.setPointerCapture(event.pointerId); pressed.set(event.pointerId,b);
      b.classList.add('is-held'); onKey(b.dataset.key,true);
    });
    for (const name of ['pointerup','pointercancel','lostpointercapture']) b.addEventListener(name,e => release(e.pointerId));
    b.addEventListener('contextmenu', e => e.preventDefault());
  }
  window.addEventListener('blur', () => [...pressed.keys()].forEach(release));
  function write(node, value) { if (node.textContent !== value) node.textContent = value; }
  let lastMap = -Infinity, oldPhase, oldMuted, oldMenu = '';
  return { update(s) {
    const driving = s.phase === 'drive', done = s.phase === 'done', menu = done ? 'done' : s.paused ? 'pause' : '';
    if (s.phase !== oldPhase) {
      oldPhase = s.phase; root.dataset.phase = s.phase;
      parts.bindings.innerHTML = driving ? '<kbd>WASD</kbd> вождение <i></i> <kbd>Space</kbd> ручник' : '<kbd>WASD</kbd> движение <i></i> <kbd>E</kbd> сесть';
      parts.instruments.hidden = !driving;
      parts.objective.textContent = driving ? 'Доставьте кабриолет к пирсу' : 'Заберите кабриолет у отеля';
      label.textContent = driving ? 'Передать ключи' : 'Сесть за руль';
    }
    const ready = driving ? s.nearGoal : s.nearCar;
    if (parts.interact.hidden !== (!ready || !!menu)) parts.interact.hidden = !ready || !!menu;
    write(parts.toast, s.toast || '');
    if (parts.toast.hidden !== (!s.toast || !!menu)) parts.toast.hidden = !s.toast || !!menu;
    const metres = Math.max(0,Math.round(s.distance || 0));
    write(parts.distance, metres >= 1000 ? (metres / 1000).toFixed(1).replace('.',',')+' км' : metres+' м');
    write(speed, String(Math.max(0,Math.round(s.speed || 0))).padStart(2,'0'));
    const condition = Math.max(0, Math.min(100, 100-(s.damage || 0)));
    bar.style.width = condition+'%'; bar.style.backgroundColor = condition <= 35 ? '#ef866e' : '';
    if (oldMuted !== s.muted) {
      oldMuted = s.muted; audio.innerHTML = icon(s.muted ? 'silent' : 'sound');
      const t = (s.muted ? 'Включить' : 'Выключить')+' звук (M)';
      audio.setAttribute('aria-label',t); audio.title=t;
    }
    if (menu !== oldMenu) {
      oldMenu = menu; root.classList.toggle('pc-modal-open',!!menu); parts.scrim.hidden = !menu;
      for (const id of [...pressed.keys()]) release(id);
      if (menu) {
        parts['dialog-kicker'].textContent = done ? 'Задание выполнено' : 'Ocean Drive';
        menuTitle.textContent = done ? 'Чужие ключи' : 'Пауза';
        parts.result.hidden = !done; resume.hidden = done; restart.textContent = done ? 'Ещё один перегон' : 'Начать заново';
        if (done) {
          parts.result.replaceChildren();
          const verdict=document.createElement('p');
          verdict.className='pc-verdict';
          verdict.textContent=condition===100?'«Даже диски целы. Держи всю тысячу».':
            condition>70?'«Вот эту вмятину я запомнил. Вычту за кузовщика».':'«Ключи оставляй. Сейчас позвоню кузовщику».';
          parts.result.append(verdict);
          for (const [name,value] of [['Выплата','$'+currencyNumber.format(s.payout || 0)],['Время',duration(s.elapsed)],['Состояние кузова',Math.round(condition)+'%']]) {
            const row=document.createElement('div'), key=document.createElement('span'), val=document.createElement('b');
            key.textContent=name; val.textContent=value; row.append(key,val); parts.result.append(row);
          }
        }
        (done ? restart : resume).focus({preventScroll:true});
      } else if (root.contains(document.activeElement)) document.activeElement.blur();
    }
    const now = performance.now();
    if (!menu && now-lastMap>65) { drawMap(map,s); lastMap=now; }
  }};
}
