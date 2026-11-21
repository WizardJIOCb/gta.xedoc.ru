import './hud.css';
import {drawCoastMap} from './navigation.js';
const currencyNumber = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const paths = {
  sound: '<path d="m3 9 4 0 5-4v14l-5-4H3z"/><path d="M15 8a6 6 0 0 1 0 8m3-12a11 11 0 0 1 0 16"/>',
  silent: '<path d="m3 9 4 0 5-4v14l-5-4H3z"/><path d="m16 9 6 6m0-6-6 6"/>',
  pause: '<path d="M8 5v14m8-14v14" stroke-width="3.5"/>',
  arrow: '<path d="m9 5 7 7-7 7"/>',
  wheel: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="1.8"/><path d="m4.7 8.5 6 3m8.6-3-6 3m-1.3 2v6"/>',
  walk: '<circle cx="14" cy="4.5" r="1.7"/><path d="m7 13 3-4 4-1 2 4 3 1m-6-4-2 7-4 5m5-7 3 3 1 4"/>',
  flag: '<path d="M5 21V4m.5 1C11 1 14 9 20 4v8c-6 5-9-3-14.5 1"/>',
  terminal:'<path d="m4 6 6 6-6 6m9 0h7"/>',
  radio:'<rect x="3" y="8" width="18" height="12" rx="2"/><path d="m5 8 13-6m-6 11h6m-6 3h4"/><circle cx="7.5" cy="14" r="1.6"/>',
};
function icon(name) {
  return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' + paths[name] + '</svg>';
}
function duration(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
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
    <div class="pc-tools">
      <button type="button" data-action="console" class="pc-tool" aria-label="Чит-консоль" title="Чит-консоль (Ё)">${icon('terminal')}</button>
      <button type="button" data-action="radio" class="pc-tool" aria-label="Сменить радиостанцию">${icon('radio')}</button>
      <button type="button" data-action="audio" class="pc-tool"></button><button type="button" data-action="pause" class="pc-tool" aria-label="Пауза (Esc)" title="Пауза (Esc)">${icon('pause')}</button>
    </div>
    <div class="pc-arsenal"><button data-action="nextWeapon" title="Сменить оружие (1–3)"><small>1 / 2 / 3</small><b></b> ⟳</button><button data-action="fire" aria-label="Атака">Атака</button></div>
    <div class="pc-navigation">
      <button type="button" class="pc-map" data-action="map" title="Карта побережья (Tab)" aria-label="Открыть карту побережья"><canvas aria-label="Мини-карта района"></canvas><span class="pc-north">N</span><span class="pc-map-expand">↗</span></button>
      <div class="pc-map-caption"><b>Ocean Drive</b><span class="pc-distance"></span></div>
    </div>
    <div class="pc-center">
      <div class="pc-toast" role="status"></div>
      <button type="button" class="pc-interact pc-deliver" data-action="deliver" hidden><kbd>↵</kbd><span>Передать ключи</span></button>
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
        <button data-key="KeyA" aria-label="Влево">◀</button><button data-key="KeyD" aria-label="Вправо">▶</button><button data-key="ShiftLeft" class="pc-sprint" aria-label="Бежать">Бег</button>
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
        <dl class="pc-guide"><dt>WASD / стрелки</dt><dd>Ходьба и вождение</dd><dt>E</dt><dd>Сесть / выйти после остановки</dd><dt>Shift · Пробел</dt><dd>Бег · прыжок / ручник</dd><dt>ПКМ + мышь</dt><dd>Осмотреться</dd><dt>1 / 2 / 3</dt><dd>Кулаки / Прибой / Нова</dd><dt>ЛКМ · F</dt><dd>Атака по курсору · по направлению камеры</dd><dt>Tab</dt><dd>Карта побережья и маршрут</dd><dt>Enter · V · Ё</dt><dd>Передать ключи · радио · читы</dd></dl>
        <div class="pc-dialog-actions"><button data-action="resume">Продолжить ${icon('arrow')}</button><button data-action="restart"></button></div>
      </section>
    </div>`;
  document.body.append(root);
  const get = sel => root.querySelector(sel);
  const parts = Object.fromEntries(['objective','distance','bindings','speed','health','instruments','toast','interact','scrim','dialog-kicker','result'].map(name => [name,get('.pc-'+name)]));
  const map = get('.pc-map canvas'), audio = get('[data-action="audio"]');
  parts.interact=get('[data-action="interact"]');
  const speed = parts.speed.querySelector('b'), bar = parts.health.querySelector('u'), label = parts.interact.querySelector('span');
  const deliver=get('.pc-deliver'), weapon=get('.pc-arsenal b'), district=get('.pc-map-caption b'), handbrake=get('.pc-handbrake'), guide=get('.pc-guide');
  const radio=get('[data-action="radio"]');
  const menuTitle = get('#pc-dialog-title'), resume = get('[data-action="resume"]'), restart = get('[data-action="restart"]');
  root.addEventListener('click',event=>{
    const button=event.target.closest('[data-action]');
    if(!button)return;
    if(event.detail>0)button.blur();
    onAction(button.dataset.action);
  });
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
      parts.bindings.innerHTML = driving ? '<kbd>WASD</kbd> вождение <i></i> <kbd>Space</kbd> ручник <i></i> <kbd>E</kbd> выйти' : '<kbd>WASD</kbd> идти <i></i> <kbd>Shift</kbd> бег <i></i> <kbd>Space</kbd> прыжок';
      parts.instruments.hidden = !driving;
      parts.objective.textContent = driving ? 'Доставьте кабриолет к пирсу' : 'Сядьте в кабриолет';
      label.textContent = driving ? 'Выйти из машины' : 'Сесть за руль';
      handbrake.textContent=driving?'Ручник':'Прыжок';handbrake.setAttribute('aria-label',handbrake.textContent);
    }
    write(weapon,s.weapon);write(district,s.title);radio.title=s.station+' · сменить (V)';
    deliver.hidden=!(driving && s.nearGoal && !menu);
    const ready = driving ? s.speed<6 && !s.inspecting : s.nearCar;
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
        parts['dialog-kicker'].textContent = done ? 'Задание выполнено' : s.title;
        menuTitle.textContent = done ? 'Чужие ключи' : 'Пауза';
        parts.result.hidden = !done; resume.hidden = done; restart.textContent = done ? 'Ещё один перегон' : 'Начать заново';
        guide.hidden=done;
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
    if (!menu && now-lastMap>65) { drawCoastMap(map,s); lastMap=now; }
  }};
}
