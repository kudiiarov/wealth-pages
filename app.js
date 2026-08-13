
'use strict';
const DB_NAME='worth-local-portfolio', DB_VERSION=1;
const STORE_NAMES=['accounts','assets','positions','snapshots'];
const state={accounts:[],assets:[],positions:[],snapshots:[],historyScope:'portfolio',displayCurrency:localStorage.getItem('worth-display-currency')||'USD',expandedAccounts:new Set(),expandedAssets:new Set(),theme:localStorage.getItem('worth-theme')||'light'};
let db=null, pendingActions=[];
const $=(sel,root=document)=>root.querySelector(sel), $$=(sel,root=document)=>Array.from(root.querySelectorAll(sel)), byId=id=>document.getElementById(id);
const palette=['#17181b','#5667ff','#9b63e8','#21c26b','#f5a341','#33bfc6','#ee5264','#7a8395'];
const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2});
const numberFmt=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:8});
function number(v){return numberFmt.format(Number(v)||0)}
function displayAsset(){return state.displayCurrency==='USD'?null:state.assets.find(a=>a.code===state.displayCurrency)}
function displayRate(){const a=displayAsset();return a&&Number(a.price)>0?Number(a.price):1}
function displayValue(usdValue){return state.displayCurrency==='USD'?Number(usdValue||0):Number(usdValue||0)/displayRate()}
function displayUnit(){const a=displayAsset();return a?assetIcon(a):'$'}
function displayCode(){return displayAsset()?.code||'USD'}
function money(v){
  if(state.displayCurrency==='USD') return usd.format(Number(v)||0);
  const a=displayAsset();
  if(!a||Number(a.price)<=0) return usd.format(Number(v)||0);
  const amount=displayValue(v);
  const abs=Math.abs(amount);
  const digits=abs>=1000?0:abs>=10?2:4;
  const formatted=new Intl.NumberFormat('ru-RU',{minimumFractionDigits:0,maximumFractionDigits:digits}).format(amount);
  return `${formatted} ${assetIcon(a)}`;
}
function parseDecimal(value){
  const normalized=String(value??'').trim().replace(/\s+/g,'').replace(',', '.');
  if(!normalized||!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return NaN;
  return Number(normalized);
}
function inputDecimal(value){return String(value??'').replace('.', ',')}
function uid(){return crypto.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}
function escapeHTML(v=''){return String(v).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]))}
function initials(v=''){return String(v).trim().slice(0,2).toUpperCase()||'•'}
function colorFor(id=''){let s=0;for(const c of id)s=(s+c.charCodeAt(0))%palette.length;return palette[s]}
function iconLenClass(icon=''){return `icon-len-${Math.max(1,Math.min(5,Array.from(String(icon)).length||1))}`}
function assetIcon(a){return WorthCore.trimIcon(a?.icon,a?.code||'•')}
function accountIcon(a){return WorthCore.trimIcon(a?.icon,WorthCore.defaultAccountIcon(a?.type))}
function assetColor(a){return WorthCore.validColor(a?.color)?a.color:colorFor(a?.id||'asset')}
function accountColor(a){return WorthCore.validColor(a?.color)?a.color:colorFor(a?.id||'account')}
function openDatabase(){return new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{for(const n of STORE_NAMES)if(!r.result.objectStoreNames.contains(n))r.result.createObjectStore(n,{keyPath:'id'})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);r.onblocked=()=>rej(new Error('IndexedDB blocked'))})}
function store(n,m='readonly'){return db.transaction(n,m).objectStore(n)} function dbAll(n){return new Promise((res,rej)=>{const r=store(n).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})} function dbPut(n,v){return new Promise((res,rej)=>{const r=store(n,'readwrite').put(v);r.onsuccess=()=>res(v);r.onerror=()=>rej(r.error)})} function dbDelete(n,id){return new Promise((res,rej)=>{const r=store(n,'readwrite').delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})} function dbClear(n){return new Promise((res,rej)=>{const r=store(n,'readwrite').clear();r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
async function reload(){
  for(const n of STORE_NAMES)state[n]=await dbAll(n);
  let migrated=false;
  const normalizedAccounts=state.accounts.map(a=>{const x=WorthCore.normalizeAccount(a);if(JSON.stringify(x)!==JSON.stringify(a))migrated=true;return x});
  const normalizedAssets=state.assets.map(a=>{const x=WorthCore.normalizeAsset(a);if(JSON.stringify(x)!==JSON.stringify(a))migrated=true;return x});
  const normalizedSnapshots=state.snapshots.map(s=>{const x=WorthCore.normalizeSnapshot(s);if(JSON.stringify(x)!==JSON.stringify(s))migrated=true;return x});
  const normalizedPositions=state.positions.map(p=>{const x={...p,comment:String(p.comment||'').trim()};if(JSON.stringify(x)!==JSON.stringify(p))migrated=true;return x});
  state.accounts=normalizedAccounts;state.assets=normalizedAssets;state.positions=normalizedPositions;state.snapshots=normalizedSnapshots;
  if(migrated){
    for(const a of state.accounts)await dbPut('accounts',a);
    for(const a of state.assets)await dbPut('assets',a);
    for(const p of state.positions)await dbPut('positions',p);
    for(const s of state.snapshots)await dbPut('snapshots',s);
  }
  state.accounts.sort((a,b)=>a.name.localeCompare(b.name,'ru'));
  state.assets.sort((a,b)=>a.code.localeCompare(b.code,'ru'));
  state.snapshots.sort((a,b)=>a.createdAt-b.createdAt);
  renderAll();
}
function assetBy(id){return state.assets.find(x=>x.id===id)} function accountBy(id){return state.accounts.find(x=>x.id===id)}
function positionValue(p){return WorthCore.positionValue(p,state.assets)} function portfolioTotal(){return WorthCore.portfolioTotal(state.positions,state.assets)} function assetQuantity(id){return WorthCore.assetQuantity(id,state.positions)} function assetTotal(id){return WorthCore.assetTotal(id,state.positions,state.assets)} function accountTotal(id){return WorthCore.accountTotal(id,state.positions,state.assets)} function visibleMoney(v){return money(v)}
function renderAll(){syncDisplayCurrency();applyTheme();renderCurrencyButton();renderBalance();renderAllocation();renderAccounts();renderAssets();renderPositions();refreshHistoryScope();renderHistory();refreshPositionForm()}
function renderBalance(){
  const total=portfolioTotal(),el=byId('homeTitle'),delta=byId('balanceDelta'),last=state.snapshots.at(-1);
  el.textContent=money(total);
  if(!last){delta.textContent='Сохраните первый снимок';delta.style.color='';return}
  const diff=total-Number(last.total||0),pct=last.total?diff/Math.abs(last.total)*100:0;
  if(Math.abs(diff)<.005){delta.textContent='Без изменений с последнего снимка';delta.style.color='';return}
  delta.textContent=`${diff>0?'+':'−'}${money(Math.abs(diff))} · ${diff>0?'+':'−'}${Math.abs(pct).toFixed(1)}%`;
  delta.style.color=diff>0?'var(--green)':'var(--red)';
}
function renderAllocation(){
  const rows=state.assets.map(asset=>({asset,value:assetTotal(asset.id),qty:assetQuantity(asset.id)})).filter(x=>x.value!==0).sort((a,b)=>b.value-a.value),
    gross=rows.reduce((s,x)=>s+Math.abs(x.value),0),bar=byId('allocationBar'),list=byId('allocationList');
  byId('assetsCount').textContent=`${rows.length} ${decl(rows.length,'актив','актива','активов')}`;
  if(!rows.length||gross===0){bar.innerHTML='';list.innerHTML='<div class="empty-state">Добавьте счёт, актив и первый остаток — здесь появится структура портфеля.</div>';return}
  bar.innerHTML=rows.map(x=>`<span class="allocation-segment" style="width:${Math.abs(x.value)/gross*100}%;background:${assetColor(x.asset)}"></span>`).join('');
  list.innerHTML=rows.slice(0,6).map(x=>`<div class="allocation-row"><span class="asset-badge ${iconLenClass(assetIcon(x.asset))}" style="background:${assetColor(x.asset)}">${escapeHTML(assetIcon(x.asset))}</span><div class="allocation-meta"><strong>${escapeHTML(x.asset.name)}</strong><small>${escapeHTML(x.asset.code)} · ${number(x.qty)} · ${(Math.abs(x.value)/gross*100).toFixed(1)}%</small></div><div class="allocation-value"><strong>${visibleMoney(x.value)}</strong><small>${visibleMoney(x.asset.price)} / ед.</small></div></div>`).join('');
}
function renderAccounts(){
  const list=byId('accountsList');
  if(!state.accounts.length){list.innerHTML='<div class="empty-state">Например: Наличные, банк, биржа или деньги, которые вам должны.</div>';return}
  list.innerHTML=state.accounts.map(a=>{
    const open=state.expandedAccounts.has(a.id);
    const positions=state.positions.filter(p=>p.accountId===a.id);
    const details=positions.length?positions.map(p=>{const asset=assetBy(p.assetId),comment=p.comment?`<span class="account-position-comment">• ${escapeHTML(p.comment)}</span>`:'';return `<div class="account-asset-row"><span class="mini-asset-icon ${iconLenClass(assetIcon(asset))}" style="background:${assetColor(asset)}">${escapeHTML(assetIcon(asset))}</span><div><div class="account-position-title"><strong>${escapeHTML(asset?.code||asset?.name||'Актив')}</strong>${comment}</div><small>${escapeHTML(asset?.name||'')} · ${number(p.quantity)} ед.</small></div><b>${money(positionValue(p))}</b></div>`}).join(''):'<div class="account-empty">На этом счёте пока нет активов</div>';
    return `<div class="account-expand-card ${open?'expanded':''}">
      <div class="list-card account-toggle" data-account-toggle="${a.id}">
        <div class="list-icon ${iconLenClass(accountIcon(a))}" style="background:${accountColor(a)};color:#fff">${escapeHTML(accountIcon(a))}</div>
        <div class="list-main"><strong>${escapeHTML(a.name)}</strong><small>${escapeHTML(a.type)} · ${positions.length} поз.</small></div>
        <div class="list-value"><strong>${money(accountTotal(a.id))}</strong></div>
        <button class="menu-button" data-account-menu="${a.id}" aria-label="Действия со счётом">···</button>
      </div>
      <div class="account-assets ${open?'':'hidden'}">${details}</div>
    </div>`;
  }).join('');
}
function renderAssets(){
  const list=byId('assetsList');
  if(!state.assets.length){list.innerHTML='<div class="empty-state">Актив — это валюта, металл, криптовалюта, акция или другое имущество с базовой ценой в долларах.</div>';return}
  list.innerHTML=state.assets.map(a=>{
    const open=state.expandedAssets.has(a.id),positions=state.positions.filter(p=>p.assetId===a.id);
    const details=positions.length?positions.map(p=>{const acc=accountBy(p.accountId),comment=p.comment?`<small class="asset-position-comment">• ${escapeHTML(p.comment)}</small>`:'';return `<div class="account-asset-row"><span class="mini-asset-icon ${iconLenClass(accountIcon(acc))}" style="background:${accountColor(acc)}">${escapeHTML(accountIcon(acc))}</span><div><strong>${escapeHTML(acc?.name||'Счёт')}</strong><small>${number(p.quantity)} ${escapeHTML(a.code)}</small>${comment}</div><b>${money(positionValue(p))}</b></div>`}).join(''):'<div class="account-empty">Этот актив пока не добавлен ни в одну позицию</div>';
    return `<div class="account-expand-card ${open?'expanded':''}"><div class="list-card asset-toggle" data-asset-toggle="${a.id}"><div class="list-icon ${iconLenClass(assetIcon(a))}" style="background:${assetColor(a)};color:#fff">${escapeHTML(assetIcon(a))}</div><div class="list-main"><strong>${escapeHTML(a.name)}</strong><small>${escapeHTML(a.code)} · ${number(assetQuantity(a.id))} ед. · ${money(a.price)} / ед.</small></div><div class="list-value"><strong>${money(assetTotal(a.id))}</strong></div><button class="menu-button" data-asset-menu="${a.id}" aria-label="Действия с активом">···</button></div><div class="account-assets ${open?'':'hidden'}">${details}</div></div>`;
  }).join('');
}
function renderPositions(){
  const summary=byId('positionsSummary'),list=byId('positionsList');
  summary.innerHTML=state.accounts.map(a=>`<div class="summary-pill"><span class="summary-icon ${iconLenClass(accountIcon(a))}" style="background:${accountColor(a)};color:#fff">${escapeHTML(accountIcon(a))}</span><span><small>${escapeHTML(a.name)}</small><strong>${money(accountTotal(a.id))}</strong></span></div>`).join('');
  if(!state.positions.length){list.innerHTML='<div class="empty-state">Позиция связывает актив со счётом и хранит его количество.</div>';return}
  list.innerHTML=state.positions.slice().sort((a,b)=>positionValue(b)-positionValue(a)).map(p=>{const a=assetBy(p.assetId),acc=accountBy(p.accountId),comment=p.comment?`<span class="position-comment">• ${escapeHTML(p.comment)}</span>`:'';return `<div class="list-card"><div class="list-icon ${iconLenClass(assetIcon(a))}" style="background:${assetColor(a)};color:#fff">${escapeHTML(assetIcon(a))}</div><div class="list-main"><div class="position-title-line"><strong>${escapeHTML(a?.code||a?.name||'Актив')}</strong>${comment}</div><small>${escapeHTML(acc?.name||'Удалённый счёт')} · ${number(p.quantity)} ед. · ${escapeHTML(a?.name||'')}</small></div><div class="list-value"><strong>${money(positionValue(p))}</strong><small>${a?money(a.price):'—'} / ед.</small></div><button class="menu-button" data-position-menu="${p.id}" aria-label="Действия с позицией">···</button></div>`}).join('');
}
function refreshHistoryScope(){const select=byId('historyScope'),current=state.historyScope;select.innerHTML='<option value="portfolio">Весь портфель</option>'+state.accounts.map(a=>`<option value="account:${a.id}">${escapeHTML(a.name)}</option>`).join('');if([...select.options].some(o=>o.value===current))select.value=current;else{state.historyScope='portfolio';select.value='portfolio'}}
function historyData(){if(state.historyScope==='portfolio')return state.snapshots.map(s=>({snapshot:s,value:Number(s.total)||0}));const id=state.historyScope.slice(8);return state.snapshots.map(s=>{const rec=Array.isArray(s.accounts)?s.accounts.find(a=>a.accountId===id):null;return rec?{snapshot:s,value:Number(rec.total)||0}:null}).filter(Boolean)}
function renderHistory(){const list=byId('historyList'),data=historyData(),isAccount=state.historyScope!=='portfolio';byId('historyRangeLabel').textContent=isAccount?(accountBy(state.historyScope.slice(8))?.name||'Счёт'):'Весь портфель';if(!data.length){list.innerHTML=`<div class="empty-state">${isAccount?'Для этого счёта пока нет совместимых снимков. Сделайте новый снимок после обновления приложения.':'Снимок фиксирует стоимость портфеля на выбранный момент. Делайте их регулярно, чтобы видеть динамику.'}</div>`}else{list.innerHTML=data.slice().reverse().map((item,reverseIndex,arr)=>{const chronologicalIndex=data.findIndex(x=>x.snapshot.id===item.snapshot.id),prev=data[chronologicalIndex-1],diff=prev?item.value-prev.value:null;return `<div class="list-card"><span class="history-dot"></span><div class="list-main"><strong>${formatDate(item.snapshot.createdAt)}</strong><small>${formatTime(item.snapshot.createdAt)}${diff===null?' · первый снимок':` · ${diff>=0?'+':'−'}${money(Math.abs(diff))}`}</small></div><div class="list-value"><strong>${visibleMoney(item.value)}</strong></div><button class="menu-button" data-snapshot-menu="${item.snapshot.id}" aria-label="Действия со снимком">···</button></div>`}).join('')}drawChart()}
function drawChart(){
  const canvas=byId('historyChart'),empty=byId('historyEmpty'),dateRow=byId('chartDates'),change=byId('historyChange'),data=historyData();
  if(data.length<2){empty.classList.remove('hidden');dateRow.children[0].textContent='';dateRow.children[1].textContent='';change.textContent='—';return}
  empty.classList.add('hidden');const rect=canvas.getBoundingClientRect();if(rect.width<20)return;
  const dpr=Math.min(devicePixelRatio||1,3),w=rect.width,h=270;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const vals=data.map(x=>displayValue(x.value)),raw=data.map(x=>x.value),min0=Math.min(...vals),max0=Math.max(...vals),extra=(max0-min0)*.12||Math.max(Math.abs(max0)*.08,1),min=min0-extra,max=max0+extra,range=max-min||1;
  const compact=v=>{const abs=Math.abs(v),sign=v<0?'−':'',unit=displayUnit();if(abs>=1e9)return `${sign}${(abs/1e9).toFixed(abs>=1e10?0:1)}B ${unit}`;if(abs>=1e6)return `${sign}${(abs/1e6).toFixed(abs>=1e7?0:1)}M ${unit}`;if(abs>=1e3)return `${sign}${(abs/1e3).toFixed(abs>=1e4?0:1)}K ${unit}`;return `${new Intl.NumberFormat('ru-RU',{maximumFractionDigits:abs<10?2:0}).format(v)} ${unit}`};
  ctx.font='10px -apple-system,BlinkMacSystemFont,sans-serif';const yLabels=[0,1,2,3].map(i=>compact(max-i/3*range)),maxLabelWidth=Math.max(...yLabels.map(t=>ctx.measureText(t).width));
  const pad={l:Math.min(Math.max(42,maxLabelWidth+10),Math.max(54,w*.30)),r:8,t:22,b:30},plotW=Math.max(20,w-pad.l-pad.r),plotH=h-pad.t-pad.b;
  const css=getComputedStyle(document.documentElement),grid=css.getPropertyValue('--line').trim()||'#e7e8eb',muted=css.getPropertyValue('--muted').trim()||'#777',ink=css.getPropertyValue('--ink').trim()||'#111';ctx.textBaseline='middle';
  for(let i=0;i<4;i++){const ratio=i/3,y=pad.t+ratio*plotH;ctx.strokeStyle=grid;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillStyle=muted;ctx.textAlign='right';ctx.fillText(yLabels[i],pad.l-6,y)}
  const pts=vals.map((v,i)=>({x:pad.l+i*plotW/(vals.length-1),y:pad.t+(max-v)/range*plotH})),diff=raw.at(-1)-raw[0],pct=raw[0]?diff/Math.abs(raw[0])*100:0,lineColor=diff>=0?'#21c26b':'#ee5264';
  const grad=ctx.createLinearGradient(0,pad.t,0,h-pad.b);grad.addColorStop(0,diff>=0?'rgba(33,194,107,.18)':'rgba(238,82,100,.16)');grad.addColorStop(1,'rgba(0,0,0,0)');
  ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.lineTo(pts.at(-1).x,h-pad.b);ctx.lineTo(pts[0].x,h-pad.b);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
  ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle=lineColor;ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();
  pts.forEach((p,i)=>{ctx.beginPath();ctx.arc(p.x,p.y,3.2,0,Math.PI*2);ctx.fillStyle=lineColor;ctx.fill();if((data.length<=6||i===0||i===pts.length-1)&&w>350){ctx.fillStyle=ink;ctx.textAlign=i===0?'left':i===pts.length-1?'right':'center';ctx.textBaseline='bottom';ctx.font='10px -apple-system,BlinkMacSystemFont,sans-serif';ctx.fillText(compact(vals[i]),p.x,Math.max(13,p.y-7))}});
  change.textContent=`${diff>=0?'+':'−'}${money(Math.abs(diff))} · ${diff>=0?'+':'−'}${Math.abs(pct).toFixed(1)}%`;change.style.color=diff>=0?'var(--green)':'var(--red)';
  dateRow.children[0].textContent=shortDate(data[0].snapshot.createdAt);dateRow.children[1].textContent=shortDate(data.at(-1).snapshot.createdAt);
}
function refreshPositionForm(){const f=byId('positionForm');f.elements.accountId.innerHTML=state.accounts.map(a=>`<option value="${a.id}">${escapeHTML(a.name)}</option>`).join('');f.elements.assetId.innerHTML=state.assets.map(a=>`<option value="${a.id}">${escapeHTML(a.name)} · ${escapeHTML(a.code)}</option>`).join('');const disabled=!state.accounts.length||!state.assets.length;byId('positionPrerequisite').classList.toggle('hidden',!disabled);f.querySelector('.sheet-primary').disabled=disabled}
function decl(n,o,f,m){const x=Math.abs(n)%100,y=x%10;if(x>10&&x<20)return m;if(y>1&&y<5)return f;if(y===1)return o;return m} function accountGlyph(t=''){if(t.includes('Банк'))return '▥';if(t.includes('Бирж'))return '↗';if(t.includes('Долг'))return '↔';if(t.includes('Крипто'))return '◇';if(t.includes('Налич'))return '$';return '•'}
function formatDate(ts){return new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric'}).format(new Date(ts))} function shortDate(ts){return new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short'}).format(new Date(ts))} function formatTime(ts){return new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit'}).format(new Date(ts))}
function syncDisplayCurrency(){
  if(state.displayCurrency!=='USD'&&!state.assets.some(a=>a.code===state.displayCurrency&&Number(a.price)>0)){
    state.displayCurrency='USD';localStorage.setItem('worth-display-currency','USD');
  }
}
function renderCurrencyButton(){
  const a=displayAsset();
  byId('displayCurrencyIcon').textContent=a?assetIcon(a):'$';
  byId('displayCurrencyCode').textContent=a?.code||'USD';
}
function renderCurrencyOptions(){
  const box=byId('currencyOptions');
  const items=[{code:'USD',name:'US Dollar',icon:'$',color:'#17181b'},...state.assets.filter(a=>Number(a.price)>0)];
  box.innerHTML=items.map(a=>`<button type="button" class="currency-option ${state.displayCurrency===a.code?'selected':''}" data-currency-code="${escapeHTML(a.code)}"><span class="currency-option-icon ${iconLenClass(a.icon||'$')}" style="background:${a.color||'#17181b'}">${escapeHTML(a.icon||'$')}</span><span><strong>${escapeHTML(a.name)}</strong><small>${escapeHTML(a.code)}${a.code==='USD'?' · базовая':` · ${usd.format(Number(a.price))} / ед.`}</small></span><b>${state.displayCurrency===a.code?'✓':''}</b></button>`).join('');
}
function setDisplayCurrency(code){
  state.displayCurrency=code;localStorage.setItem('worth-display-currency',code);closeDialog('currencyModal');renderAll();
}
function applyTheme(){
  document.documentElement.dataset.theme=state.theme;
  document.documentElement.style.colorScheme=state.theme;
  $$('[data-theme-choice]').forEach(b=>b.classList.toggle('active',b.dataset.themeChoice===state.theme));
}
function setTheme(theme){
  state.theme=theme==='dark'?'dark':'light';localStorage.setItem('worth-theme',state.theme);applyTheme();if(byId('historyView').classList.contains('active'))requestAnimationFrame(drawChart);
}
function toast(t){const el=byId('toast');el.textContent=t;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),1800)} function closeDialog(id){const d=byId(id);if(d?.open)d.close()} function openDialog(id){if(id==='positionModal')resetPositionForm();const d=byId(id);if(d&&!d.open)d.showModal()} function navigate(id){$$('.view').forEach(v=>v.classList.toggle('active',v.id===id));$$('.tab').forEach(t=>t.classList.toggle('active',t.dataset.nav===id));scrollTo({top:0,behavior:'instant'});if(id==='historyView')requestAnimationFrame(drawChart)} function resetPositionForm(){const f=byId('positionForm');f.reset();delete f.dataset.editId;byId('positionModeLabel').textContent='Новая';refreshPositionForm()}
function showActionMenu(title,actions){pendingActions=actions;byId('actionMenuTitle').textContent=title;byId('actionMenuItems').innerHTML=actions.map((a,i)=>`<button type="button" class="action-item ${a.danger?'danger':''}" data-action-index="${i}">${escapeHTML(a.label)}</button>`).join('');openDialog('actionMenuModal')}
async function saveSnapshot(){await dbPut('snapshots',{id:uid(),createdAt:Date.now(),total:portfolioTotal(),accounts:state.accounts.map(a=>({accountId:a.id,name:a.name,total:accountTotal(a.id)})),assets:state.assets.map(a=>({assetId:a.id,code:a.code,name:a.name,icon:a.icon,color:a.color,price:Number(a.price),quantity:assetQuantity(a.id),value:assetTotal(a.id)}))});await reload();toast('Снимок сохранён')}
function accountMenu(id){const a=accountBy(id);if(!a)return;showActionMenu(a.name,[{label:'Настроить счёт',run:()=>{const f=byId('accountEditForm');f.elements.accountId.value=a.id;f.elements.name.value=a.name;f.elements.type.value=a.type;f.elements.icon.value=a.icon;f.elements.color.value=a.color;openDialog('accountEditModal')}},{label:'Показать историю счёта',run:()=>{state.historyScope=`account:${a.id}`;navigate('historyView');refreshHistoryScope();renderHistory()}},{label:'Удалить счёт',danger:true,run:async()=>{if(!confirm(`Удалить счёт «${a.name}» и все позиции на нём?`))return;for(const p of state.positions.filter(p=>p.accountId===id))await dbDelete('positions',p.id);await dbDelete('accounts',id);await reload();toast('Счёт удалён')}}])}
function assetMenu(id){const a=assetBy(id);if(!a)return;showActionMenu(`${a.name} · ${a.code}`,[{label:'Настроить актив',run:()=>{const f=byId('assetEditForm');f.elements.assetId.value=a.id;f.elements.name.value=a.name;f.elements.code.value=a.code;f.elements.icon.value=a.icon;f.elements.color.value=a.color;openDialog('assetEditModal')}},{label:'Изменить цену',run:()=>{const f=byId('priceForm');f.elements.assetId.value=a.id;f.elements.price.value=inputDecimal(a.price);byId('priceAssetTitle').textContent=`${a.name} · ${a.code}`;openDialog('priceModal')}},{label:'Удалить актив',danger:true,run:async()=>{if(!confirm(`Удалить ${a.name} (${a.code}) и все позиции с этим активом?`))return;for(const p of state.positions.filter(p=>p.assetId===id))await dbDelete('positions',p.id);await dbDelete('assets',id);await reload();toast('Актив удалён')}}])}
function positionMenu(id){const p=state.positions.find(x=>x.id===id),a=p&&assetBy(p.assetId);if(!p)return;showActionMenu(a?.name||'Позиция',[{label:'Изменить позицию',run:()=>{openDialog('positionModal');const f=byId('positionForm');f.dataset.editId=p.id;f.elements.accountId.value=p.accountId;f.elements.assetId.value=p.assetId;f.elements.quantity.value=inputDecimal(p.quantity);f.elements.comment.value=p.comment||'';byId('positionModeLabel').textContent='Редактирование'}},{label:'Удалить позицию',danger:true,run:async()=>{if(!confirm('Удалить эту позицию?'))return;await dbDelete('positions',id);await reload();toast('Позиция удалена')}}])}
function snapshotMenu(id){showActionMenu('Снимок',[{label:'Удалить снимок',danger:true,run:async()=>{if(!confirm('Удалить этот снимок из истории?'))return;await dbDelete('snapshots',id);await reload();toast('Снимок удалён')}}])}
function renderQuickUpdate(){
  const c=byId('quickUpdateFields');
  if(!state.assets.length){c.innerHTML='<div class="empty-state">Сначала добавьте активы.</div>';return}
  c.innerHTML=state.assets.map(a=>{
    const positions=state.positions.filter(p=>p.assetId===a.id);
    const positionRows=positions.length?positions.map(p=>{
      const acc=accountBy(p.accountId);
      return `<label class="quick-position-row">
        <span class="quick-position-account">
          <span class="quick-account-icon ${iconLenClass(accountIcon(acc))}" style="background:${accountColor(acc)}">${escapeHTML(accountIcon(acc))}</span>
          <span><strong>${escapeHTML(acc?.name||'Счёт')}</strong><small>Количество ${escapeHTML(a.code)}</small></span>
        </span>
        <input type="text" inputmode="decimal" autocomplete="off" data-position-qty="${p.id}" value="${inputDecimal(p.quantity)}" aria-label="Количество ${escapeHTML(a.code)} на счёте ${escapeHTML(acc?.name||'Счёт')}">
      </label>`;
    }).join(''):`<div class="quick-no-positions">Нет позиций с этим активом</div>`;
    return `<section class="quick-asset-card">
      <div class="quick-asset-head">
        <span class="quick-asset-icon ${iconLenClass(assetIcon(a))}" style="background:${assetColor(a)}">${escapeHTML(assetIcon(a))}</span>
        <div class="quick-asset-meta"><strong>${escapeHTML(a.name)}</strong><small>${escapeHTML(a.code)} · ${money(assetTotal(a.id))}</small></div>
      </div>
      <label class="quick-price-row">
        <span><strong>Цена за единицу</strong><small>Базовая цена в USD</small></span>
        <div class="quick-price-input"><span>$</span><input type="text" inputmode="decimal" autocomplete="off" data-asset-price="${a.id}" value="${inputDecimal(a.price)}" aria-label="Цена ${escapeHTML(a.code)} в долларах"></div>
      </label>
      <div class="quick-positions-block">
        <div class="quick-block-title">Остатки по счетам</div>
        ${positionRows}
      </div>
    </section>`;
  }).join('');
}
function exportData(){const payload={app:'Worth',version:7,appVersion:'1.9-final',baseCurrency:'USD',exportedAt:new Date().toISOString(),accounts:state.accounts,assets:state.assets,positions:state.positions,snapshots:state.snapshots},blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`worth-backup-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);toast('Резервная копия создана')}
function validateImport(data){return WorthCore.validateImport(data)}
async function importData(file){try{const raw=JSON.parse(await file.text()),data=validateImport(raw);if(!confirm('Импорт полностью заменит текущие локальные данные. Продолжить?'))return;for(const n of STORE_NAMES){await dbClear(n);for(const item of data[n])await dbPut(n,item)}await reload();toast('Данные восстановлены')}catch(e){console.error(e);alert(`Не удалось импортировать резервную копию: ${e.message||'неподдерживаемый формат'}`)}}
function bindEvents(){document.addEventListener('click',async e=>{const currency=e.target.closest('[data-currency-code]');if(currency){setDisplayCurrency(currency.dataset.currencyCode);return}const theme=e.target.closest('[data-theme-choice]');if(theme){setTheme(theme.dataset.themeChoice);return}const accountToggle=e.target.closest('[data-account-toggle]');if(accountToggle&&!e.target.closest('[data-account-menu]')){const id=accountToggle.dataset.accountToggle;state.expandedAccounts.has(id)?state.expandedAccounts.delete(id):state.expandedAccounts.add(id);renderAccounts();return}const assetToggle=e.target.closest('[data-asset-toggle]');if(assetToggle&&!e.target.closest('[data-asset-menu]')){const id=assetToggle.dataset.assetToggle;state.expandedAssets.has(id)?state.expandedAssets.delete(id):state.expandedAssets.add(id);renderAssets();return}const open=e.target.closest('[data-open]');if(open){openDialog(open.dataset.open);return}const close=e.target.closest('[data-close]');if(close){closeDialog(close.dataset.close);return}const nav=e.target.closest('[data-nav]');if(nav){navigate(nav.dataset.nav);return}const am=e.target.closest('[data-account-menu]');if(am){accountMenu(am.dataset.accountMenu);return}const asm=e.target.closest('[data-asset-menu]');if(asm){assetMenu(asm.dataset.assetMenu);return}const pm=e.target.closest('[data-position-menu]');if(pm){positionMenu(pm.dataset.positionMenu);return}const sm=e.target.closest('[data-snapshot-menu]');if(sm){snapshotMenu(sm.dataset.snapshotMenu);return}const ai=e.target.closest('[data-action-index]');if(ai){const action=pendingActions[Number(ai.dataset.actionIndex)];closeDialog('actionMenuModal');if(action)await action.run();return}});
byId('historyScope').addEventListener('change',e=>{state.historyScope=e.target.value;renderHistory()});byId('saveSnapshotBtn').addEventListener('click',saveSnapshot);byId('saveSnapshotBtnHistory').addEventListener('click',saveSnapshot);byId('openQuickUpdate').addEventListener('click',()=>{renderQuickUpdate();openDialog('quickUpdateModal')});byId('displayCurrencyBtn').addEventListener('click',()=>{renderCurrencyOptions();openDialog('currencyModal')});byId('settingsShortcut').addEventListener('click',()=>navigate('settingsView'));
byId('exportBtn').addEventListener('click',exportData);
byId('importInput').addEventListener('change',async e=>{const f=e.target.files?.[0];if(f)await importData(f);e.target.value=''});
byId('resetBtn').addEventListener('click',async()=>{if(!confirm('Удалить все счета, активы, позиции и историю с этого устройства?'))return;for(const n of STORE_NAMES)await dbClear(n);await reload();toast('Все данные удалены')});
byId('accountForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,name=f.elements.name.value.trim();if(!name)return;const raw={id:uid(),name,type:f.elements.type.value,icon:f.elements.icon.value,color:f.elements.color.value,createdAt:Date.now()};await dbPut('accounts',WorthCore.normalizeAccount(raw));f.reset();f.elements.color.value='#17181b';closeDialog('accountModal');await reload();toast('Счёт создан')});
byId('accountEditForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,a=accountBy(f.elements.accountId.value),name=f.elements.name.value.trim();if(!a||!name)return;const next=WorthCore.normalizeAccount({...a,name,type:f.elements.type.value,icon:f.elements.icon.value,color:f.elements.color.value,updatedAt:Date.now()});await dbPut('accounts',next);closeDialog('accountEditModal');await reload();toast('Счёт обновлён')});
byId('assetForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,name=f.elements.name.value.trim(),code=WorthCore.cleanCode(f.elements.code.value),price=parseDecimal(f.elements.price.value);if(!name||!code||!Number.isFinite(price)||price<0)return;if(state.assets.some(a=>a.code===code)){alert('Актив с таким кодом уже существует. Код актива должен быть уникальным.');return}const raw={id:uid(),name,code,icon:f.elements.icon.value,color:f.elements.color.value,price,createdAt:Date.now(),updatedAt:Date.now()};await dbPut('assets',WorthCore.normalizeAsset(raw));f.reset();f.elements.color.value='#5667ff';closeDialog('assetModal');await reload();toast('Актив создан')});
byId('assetEditForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,a=assetBy(f.elements.assetId.value),name=f.elements.name.value.trim(),code=WorthCore.cleanCode(f.elements.code.value);if(!a||!name||!code)return;if(state.assets.some(x=>x.id!==a.id&&x.code===code)){alert('Актив с таким кодом уже существует. Код актива должен быть уникальным.');return}const next=WorthCore.normalizeAsset({...a,name,code,icon:f.elements.icon.value,color:f.elements.color.value,updatedAt:Date.now()});await dbPut('assets',next);closeDialog('assetEditModal');await reload();toast('Актив обновлён')});
byId('positionForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;if(!state.accounts.length||!state.assets.length)return;const q=parseDecimal(f.elements.quantity.value),accountId=f.elements.accountId.value,assetId=f.elements.assetId.value,editId=f.dataset.editId,comment=String(f.elements.comment?.value||'').trim();if(!Number.isFinite(q))return;const dup=state.positions.find(p=>p.accountId===accountId&&p.assetId===assetId&&p.id!==editId);if(dup&&!editId){dup.quantity=q;dup.comment=comment||dup.comment||'';dup.updatedAt=Date.now();await dbPut('positions',dup)}else await dbPut('positions',{id:editId||uid(),accountId,assetId,quantity:q,comment,createdAt:state.positions.find(p=>p.id===editId)?.createdAt||Date.now(),updatedAt:Date.now()});closeDialog('positionModal');resetPositionForm();await reload();toast('Позиция сохранена')});
byId('priceForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,a=assetBy(f.elements.assetId.value),price=parseDecimal(f.elements.price.value);if(!a||!Number.isFinite(price)||price<0)return;a.price=price;a.updatedAt=Date.now();await dbPut('assets',a);closeDialog('priceModal');await reload();toast('Цена обновлена')});byId('quickUpdateForm').addEventListener('submit',async e=>{e.preventDefault();for(const i of $$('[data-asset-price]',e.currentTarget)){const a=assetBy(i.dataset.assetPrice),v=parseDecimal(i.value);if(a&&Number.isFinite(v)&&v>=0){a.price=v;a.updatedAt=Date.now();await dbPut('assets',a)}}for(const i of $$('[data-position-qty]',e.currentTarget)){const p=state.positions.find(x=>x.id===i.dataset.positionQty),v=parseDecimal(i.value);if(p&&Number.isFinite(v)){p.quantity=v;p.updatedAt=Date.now();await dbPut('positions',p)}}closeDialog('quickUpdateModal');await reload();toast('Портфель обновлён')});window.addEventListener('resize',()=>{if(byId('historyView').classList.contains('active'))drawChart()},{passive:true})}
async function init(){try{db=await openDatabase();bindEvents();await reload();if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn))}catch(e){console.error(e);document.body.innerHTML='<div style="padding:30px;font-family:-apple-system">Не удалось открыть локальную базу данных. Проверьте, что Safari разрешает хранение данных для этого сайта.</div>'}} init();
