import './sandbox.css';

const commands = [
  ['FIX', 'Восстановить кузов'],
  ['NITRO', 'Переключить форсаж'],
  ['OVERCHARGE', 'Усилить импульс'],
  ['SLOWMO', 'Переключить замедление'],
  ['MIDNIGHT', 'Ночной город'],
  ['SUNSET', 'Вернуть закат'],
  ['MARINA', 'К причалам'],
  ['HAVANA', 'В Маленькую Гавану'],
  ['CANAL', 'К набережной канала'],
  ['KEYS', 'На острова'],
  ['GLADES', 'К болотам'],
  ['OUTPOST', 'К придорожному посёлку'],
  ['HOME', 'К отелю'],
  ['RADIO', 'Сменить станцию'],
  ['STATS', 'Показать состояние']
];

// Only the named game actions below are accepted. The input is never
// evaluated as JavaScript and is never transmitted to the server.
export function createConsole(execute, onToggle) {
  const panel=document.createElement('dialog');
  panel.className='pc-console';
  panel.setAttribute('aria-labelledby','pc-console-title');
  panel.innerHTML=`
    <header><div><small>PALM COAST</small><h2 id="pc-console-title">Чит-консоль</h2></div><button type="button" aria-label="Закрыть консоль">×</button></header>
    <div class="pc-codes"></div>
    <pre role="log" aria-live="polite"></pre>
    <form><label for="pc-command">❯</label><input id="pc-command" placeholder="Код или HELP" autocomplete="off" spellcheck="false" autocapitalize="characters" maxlength="48"><button>Ввод ↵</button></form>`;
  document.body.append(panel);
  const input=panel.querySelector('input'), log=panel.querySelector('pre');
  const history=[], lines=[];
  let cursor=0;
  function run(raw) {
    const code=raw.trim().toUpperCase();
    if (!code) return;
    if(history.at(-1)!==code)history.push(code);
    if(history.length>40)history.shift();
    cursor=history.length;
    let message;
    if(code==='HELP')message=commands.map(([key])=>key).join(' · ');
    else if(commands.some(([key])=>key===code))message=execute(code);
    else message='Неизвестный код. Введите HELP.';
    lines.push('❯ '+code+'   '+message);
    if(lines.length>16)lines.shift();
    log.textContent=lines.join('\n');log.scrollTop=log.scrollHeight;input.value='';
  }
  const codes=panel.querySelector('.pc-codes');
  for(const [code,hint] of commands) {
    const b=document.createElement('button'),key=document.createElement('b'),label=document.createElement('span');
    b.type='button';key.textContent=code;label.textContent=hint;b.append(key,label);
    b.addEventListener('click',()=>run(code));codes.append(b);
  }
  panel.querySelector('header button').onclick=()=>panel.close();
  panel.querySelector('form').onsubmit=e=>{e.preventDefault();run(input.value);};
  input.addEventListener('keydown',e=>{
    if(e.key!=='ArrowUp' && e.key!=='ArrowDown')return;
    e.preventDefault();cursor=Math.max(0,Math.min(history.length,cursor+(e.key==='ArrowUp'?-1:1)));
    input.value=history[cursor] || '';
  });
  panel.addEventListener('close',()=>onToggle(false));
  return {
    get open(){return panel.open;},
    toggle(){
      if(panel.open){panel.close();return;}
      onToggle(true);panel.showModal();input.focus({preventScroll:true});
    }
  };
}
