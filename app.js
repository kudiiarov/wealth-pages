'use strict';

const DB_NAME='worth-local-portfolio';
const DB_VERSION=1;
const STORE_NAMES=['accounts','assets','positions','snapshots'];
const state={accounts:[],assets:[],positions:[],snapshots:[],moneyHidden:false};
let db=null;

const $=(sel,root=document)=>root.querySelector(sel);
const $$=(sel,root=document)=>Array.from(root.querySelectorAll(sel));
const byId=id=>document.getElementById(id);
const palette=['#17181b','#5667ff','#9b63e8','#21c26b','#f5a341','#33bfc6','#ee5264','#7a8395'];
const rub=new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0});
const numberFmt=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:8});

function money(value){return rub.format(Number(value)||0).replace(/\s?₽/,' ₽')}
function number(value){return numberFmt.format(Number(value)||0)}
function uid(){return crypto.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}
function escapeHTML(value=''){return String(value).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]))}
function initials(text=''){return String(text).trim().slice(0,2).toUpperCase()||'•'}
function colorFor(id=''){let sum=0;for(const ch of id)sum=(sum+ch.charCodeAt(0))%palette.length;return palette[sum]}

function openDatabase(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{
      const database=request.result;
      for(const name of STORE_NAMES){if(!database.objectStoreNames.contains(name))database.createObjectStore(name,{keyPath:'id'})}
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error('IndexedDB blocked'));
  });
}
function store(name,mode='readonly'){return db.transaction(name,mode).objectStore(name)}
function dbAll(name){return new Promise((resolve,reject)=>{const r=store(name).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function dbPut(name,value){return new Promise((resolve,reject)=>{const r=store(name,'readwrite').put(value);r.onsuccess=()=>resolve(value);r.onerror=()=>reject(r.error)})}
function dbDelete(name,id){return new Promise((resolve,reject)=>{const r=store(name,'readwrite').delete(id);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error)})}
function dbClear(name){return new Promise((resolve,reject)=>{const r=store(name,'readwrite').clear();r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error)})}

async function reload(){
  for(const name of STORE_NAMES)state[name]=await dbAll(name);
  state.accounts.sort((a,b)=>a.name.localeCompare(b.name,'ru'));
  state.assets.sort((a,b)=>a.symbol.localeCompare(b.symbol,'ru'));
  state.snapshots.sort((a,b)=>a.createdAt-b.createdAt);
  renderAll();
}

function assetBy(id){return state.assets.find(item=>item.id===id)}
function accountBy(id){return state.accounts.find(item=>item.id===id)}
function positionValue(position){return WorthCore.positionValue(position,state.assets)}
function portfolioTotal(){return WorthCore.portfolioTotal(state.positions,state.assets)}
function assetQuantity(assetId){return WorthCore.assetQuantity(assetId,state.positions)}
function assetTotal(assetId){return WorthCore.assetTotal(assetId,state.positions,state.assets)}
function accountTotal(accountId){return WorthCore.accountTotal(accountId,state.positions,state.assets)}
function visibleMoney(value){return state.moneyHidden?'••••••':money(value)}

function renderAll(){
  renderBalance();renderAllocation();renderAccounts();renderAssets();renderPositions();renderHistory();refreshPositionForm();
}
function renderBalance(){
  const total=portfolioTotal();
  byId('homeTitle').textContent=visibleMoney(total);
  const delta=byId('balanceDelta');
  const last=state.snapshots.at(-1);
  if(!last){delta.textContent='Сохраните первый снимок';delta.style.color='';return}
  const diff=total-Number(last.total||0);const pct=last.total?diff/last.total*100:0;
  if(Math.abs(diff)<0.005){delta.textContent='Без изменений с последнего снимка';delta.style.color='';return}
  delta.textContent=`${diff>0?'+':'−'}${state.moneyHidden?'••••':money(Math.abs(diff))} · ${diff>0?'+':'−'}${Math.abs(pct).toFixed(1)}%`;
  delta.style.color=diff>0?'var(--green)':'var(--red)';
}
function renderAllocation(){
  const rows=state.assets.map(a=>({asset:a,value:assetTotal(a.id),qty:assetQuantity(a.id)})).filter(x=>x.value!==0).sort((a,b)=>b.value-a.value);
  const gross=rows.reduce((sum,x)=>sum+Math.abs(x.value),0);
  byId('assetsCount').textContent=`${rows.length} ${decl(rows.length,'актив','актива','активов')}`;
  const bar=byId('allocationBar'),list=byId('allocationList');
  if(!rows.length||gross===0){bar.innerHTML='';list.innerHTML='<div class="empty-state">Добавьте счёт, актив и первый остаток — здесь появится структура портфеля.</div>';return}
  bar.innerHTML=rows.map(x=>`<span class="allocation-segment" style="width:${Math.abs(x.value)/gross*100}%;background:${colorFor(x.asset.id)}"></span>`).join('');
  list.innerHTML=rows.slice(0,6).map(x=>`<div class="allocation-row"><span class="asset-badge" style="background:${colorFor(x.asset.id)}">${escapeHTML(initials(x.asset.symbol))}</span><div class="allocation-meta"><strong>${escapeHTML(x.asset.symbol)}</strong><small>${number(x.qty)} · ${(Math.abs(x.value)/gross*100).toFixed(1)}%</small></div><div class="allocation-value"><strong>${visibleMoney(x.value)}</strong><small>${visibleMoney(x.asset.price)} / ед.</small></div></div>`).join('');
}
function renderAccounts(){
  const list=byId('accountsList');
  if(!state.accounts.length){list.innerHTML='<div class="empty-state">Например: Наличные, банк, биржа или деньги, которые вам должны.</div>';return}
  list.innerHTML=state.accounts.map(a=>`<div class="list-card"><div class="list-icon">${accountGlyph(a.type)}</div><div class="list-main"><strong>${escapeHTML(a.name)}</strong><small>${escapeHTML(a.type)} · ${state.positions.filter(p=>p.accountId===a.id).length} поз.</small></div><div class="list-value"><strong>${visibleMoney(accountTotal(a.id))}</strong></div><button class="menu-button" data-delete-account="${a.id}" aria-label="Удалить счёт">···</button></div>`).join('');
}
function renderAssets(){
  const list=byId('assetsList');
  if(!state.assets.length){list.innerHTML='<div class="empty-state">Актив — это валюта, металл, криптовалюта, акция или другое имущество с ценой.</div>';return}
  list.innerHTML=state.assets.map(a=>`<div class="list-card"><div class="list-icon" style="background:${colorFor(a.id)};color:#fff">${escapeHTML(initials(a.symbol))}</div><div class="list-main"><strong>${escapeHTML(a.symbol)} · ${escapeHTML(a.name)}</strong><small>${number(assetQuantity(a.id))} ед. · ${visibleMoney(a.price)} / ед.</small></div><div class="list-value"><strong>${visibleMoney(assetTotal(a.id))}</strong></div><button class="menu-button" data-asset-menu="${a.id}" aria-label="Действия с активом">···</button></div>`).join('');
}
function renderPositions(){
  const summary=byId('positionsSummary'),list=byId('positionsList');
  summary.innerHTML=state.accounts.map(a=>`<div class="summary-pill"><small>${escapeHTML(a.name)}</small><strong>${visibleMoney(accountTotal(a.id))}</strong></div>`).join('');
  if(!state.positions.length){list.innerHTML='<div class="empty-state">Позиция связывает актив со счётом и хранит его количество.</div>';return}
  list.innerHTML=state.positions.slice().sort((a,b)=>positionValue(b)-positionValue(a)).map(p=>{const a=assetBy(p.assetId),acc=accountBy(p.accountId);return `<div class="list-card"><div class="list-icon" style="background:${colorFor(a?.id||'x')};color:#fff">${escapeHTML(initials(a?.symbol))}</div><div class="list-main"><strong>${escapeHTML(a?.symbol||'Удалённый актив')}</strong><small>${escapeHTML(acc?.name||'Удалённый счёт')} · ${number(p.quantity)} ед.</small></div><div class="list-value"><strong>${visibleMoney(positionValue(p))}</strong><small>${a?visibleMoney(a.price):'—'} / ед.</small></div><button class="menu-button" data-position-menu="${p.id}" aria-label="Действия с позицией">···</button></div>`}).join('');
}
function renderHistory(){
  const list=byId('historyList');
  if(!state.snapshots.length){list.innerHTML='<div class="empty-state">Снимок фиксирует стоимость портфеля на выбранный момент. Делайте их регулярно, чтобы видеть динамику.</div>'}else{
    list.innerHTML=state.snapshots.slice().reverse().map((s,index,arr)=>{const chronologicalIndex=state.snapshots.findIndex(x=>x.id===s.id);const prev=state.snapshots[chronologicalIndex-1];const diff=prev?Number(s.total)-Number(prev.total):null;return `<div class="list-card"><span class="history-dot"></span><div class="list-main"><strong>${formatDate(s.createdAt)}</strong><small>${formatTime(s.createdAt)}${diff===null?' · первый снимок':` · ${diff>=0?'+':'−'}${state.moneyHidden?'••••':money(Math.abs(diff))}`}</small></div><div class="list-value"><strong>${visibleMoney(s.total)}</strong></div><button class="menu-button" data-delete-snapshot="${s.id}" aria-label="Удалить снимок">···</button></div>`}).join('');
  }
  drawChart();
}
function refreshPositionForm(){
  const form=byId('positionForm');
  const accountSelect=form.elements.accountId,assetSelect=form.elements.assetId;
  accountSelect.innerHTML=state.accounts.map(a=>`<option value="${a.id}">${escapeHTML(a.name)}</option>`).join('');
  assetSelect.innerHTML=state.assets.map(a=>`<option value="${a.id}">${escapeHTML(a.symbol)} · ${escapeHTML(a.name)}</option>`).join('');
  const disabled=!state.accounts.length||!state.assets.length;
  byId('positionPrerequisite').classList.toggle('hidden',!disabled);
  form.querySelector('.sheet-primary').disabled=disabled;
}
function drawChart(){
  const canvas=byId('historyChart'),empty=byId('historyEmpty'),dateRow=byId('chartDates'),change=byId('historyChange');
  const data=state.snapshots;
  if(data.length<2){empty.classList.remove('hidden');dateRow.children[0].textContent='';dateRow.children[1].textContent='';change.textContent='—';return}
  empty.classList.add('hidden');
  const rect=canvas.getBoundingClientRect();if(rect.width<20)return;
  const dpr=Math.min(window.devicePixelRatio||1,3),cssW=rect.width,cssH=220;canvas.width=Math.round(cssW*dpr);canvas.height=Math.round(cssH*dpr);const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cssW,cssH);
  const vals=data.map(s=>Number(s.total)||0),min=Math.min(...vals),max=Math.max(...vals),range=max-min||Math.max(Math.abs(max),1),padX=4,padY=23;
  const pts=vals.map((v,i)=>({x:padX+i*(cssW-padX*2)/(vals.length-1),y:padY+(max-v)/range*(cssH-padY*2)}));
  const grad=ctx.createLinearGradient(0,0,0,cssH);grad.addColorStop(0,'rgba(33,194,107,.20)');grad.addColorStop(1,'rgba(33,194,107,0)');
  ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.lineTo(pts.at(-1).x,cssH-padY);ctx.lineTo(pts[0].x,cssH-padY);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
  ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle='#21c26b';ctx.lineWidth=2.6;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();
  const diff=vals.at(-1)-vals[0],pct=vals[0]?diff/Math.abs(vals[0])*100:0;change.textContent=`${diff>=0?'+':'−'}${state.moneyHidden?'••••':money(Math.abs(diff))} · ${diff>=0?'+':'−'}${Math.abs(pct).toFixed(1)}%`;change.style.color=diff>=0?'var(--green)':'var(--red)';
  dateRow.children[0].textContent=shortDate(data[0].createdAt);dateRow.children[1].textContent=shortDate(data.at(-1).createdAt);
}

function decl(n,one,few,many){const x=Math.abs(n)%100,y=x%10;if(x>10&&x<20)return many;if(y>1&&y<5)return few;if(y===1)return one;return many}
function accountGlyph(type=''){if(type.includes('Банк'))return '▥';if(type.includes('Бирж'))return '↗';if(type.includes('Долг'))return '↔';if(type.includes('Крипто'))return '◇';if(type.includes('Налич'))return '₽';return '•'}
function formatDate(ts){return new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric'}).format(new Date(ts))}
function shortDate(ts){return new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short'}).format(new Date(ts))}
function formatTime(ts){return new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit'}).format(new Date(ts))}
function toast(text){const el=byId('toast');el.textContent=text;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),1800)}
function closeDialog(id){const dialog=byId(id);if(dialog?.open)dialog.close()}
function openDialog(id){
  if(id==='positionModal')resetPositionForm();
  const dialog=byId(id);if(dialog&&!dialog.open)dialog.showModal();
}
function navigate(viewId){
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===viewId));
  $$('.tab').forEach(t=>t.classList.toggle('active',t.dataset.nav===viewId));
  window.scrollTo({top:0,behavior:'instant'});
  if(viewId==='historyView')requestAnimationFrame(drawChart);
}
function resetPositionForm(){const form=byId('positionForm');form.reset();delete form.dataset.editId;byId('positionModeLabel').textContent='Новая';refreshPositionForm()}

async function saveSnapshot(){
  await dbPut('snapshots',{id:uid(),createdAt:Date.now(),total:portfolioTotal(),assets:state.assets.map(a=>({assetId:a.id,symbol:a.symbol,price:Number(a.price),quantity:assetQuantity(a.id),value:assetTotal(a.id)}))});
  await reload();toast('Снимок сохранён');
}
async function deleteAccount(id){
  const a=accountBy(id);if(!a||!confirm(`Удалить счёт «${a.name}» и все позиции на нём?`))return;
  for(const p of state.positions.filter(p=>p.accountId===id))await dbDelete('positions',p.id);await dbDelete('accounts',id);await reload();toast('Счёт удалён')
}
async function assetMenu(id){
  const a=assetBy(id);if(!a)return;
  const action=prompt(`Актив ${a.symbol}\nВведите: 1 — изменить цену, 2 — удалить`,'1');
  if(action==='1'){const form=byId('priceForm');form.elements.assetId.value=a.id;form.elements.price.value=a.price;byId('priceAssetTitle').textContent=`${a.symbol} · ${a.name}`;openDialog('priceModal')}
  if(action==='2'&&confirm(`Удалить ${a.symbol} и все позиции с этим активом?`)){for(const p of state.positions.filter(p=>p.assetId===id))await dbDelete('positions',p.id);await dbDelete('assets',id);await reload();toast('Актив удалён')}
}
async function positionMenu(id){
  const p=state.positions.find(x=>x.id===id);if(!p)return;
  const action=prompt('Введите: 1 — изменить, 2 — удалить','1');
  if(action==='1'){const form=byId('positionForm');refreshPositionForm();form.dataset.editId=p.id;form.elements.accountId.value=p.accountId;form.elements.assetId.value=p.assetId;form.elements.quantity.value=p.quantity;byId('positionModeLabel').textContent='Редактирование';openDialog('positionModal');form.dataset.editId=p.id;form.elements.accountId.value=p.accountId;form.elements.assetId.value=p.assetId;form.elements.quantity.value=p.quantity;byId('positionModeLabel').textContent='Редактирование'}
  if(action==='2'&&confirm('Удалить эту позицию?')){await dbDelete('positions',id);await reload();toast('Позиция удалена')}
}
function renderQuickUpdate(){
  const container=byId('quickUpdateFields');
  if(!state.assets.length){container.innerHTML='<div class="empty-state">Сначала добавьте активы.</div>';return}
  container.innerHTML=state.assets.map(a=>{
    const positions=state.positions.filter(p=>p.assetId===a.id);
    const qtyFields=positions.map(p=>{const acc=accountBy(p.accountId);return `<div class="update-input"><label>${escapeHTML(acc?.name||'Счёт')} · количество</label><input type="number" step="any" inputmode="decimal" data-position-qty="${p.id}" value="${p.quantity}"></div>`}).join('');
    return `<div class="update-group"><div class="update-group-head"><strong>${escapeHTML(a.symbol)} · ${escapeHTML(a.name)}</strong><small>${visibleMoney(assetTotal(a.id))}</small></div><div class="update-grid"><div class="update-input"><label>Цена, ₽</label><input type="number" min="0" step="any" inputmode="decimal" data-asset-price="${a.id}" value="${a.price}"></div>${qtyFields}</div></div>`;
  }).join('');
}

function exportData(){
  const payload={app:'Worth',version:1,exportedAt:new Date().toISOString(),accounts:state.accounts,assets:state.assets,positions:state.positions,snapshots:state.snapshots};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`worth-backup-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),500);toast('Резервная копия создана')
}
function validateImport(data){return WorthCore.validateImport(data)}
async function importData(file){
  try{const data=JSON.parse(await file.text());validateImport(data);if(!confirm('Импорт полностью заменит текущие локальные данные. Продолжить?'))return;for(const name of STORE_NAMES){await dbClear(name);for(const item of data[name])await dbPut(name,item)}await reload();toast('Данные восстановлены')}catch(error){console.error(error);alert('Не удалось импортировать резервную копию. Файл повреждён или имеет неподдерживаемый формат.')}
}

function bindEvents(){
  document.addEventListener('click',async event=>{
    const open=event.target.closest('[data-open]');if(open){openDialog(open.dataset.open);return}
    const close=event.target.closest('[data-close]');if(close){closeDialog(close.dataset.close);return}
    const nav=event.target.closest('[data-nav]');if(nav){navigate(nav.dataset.nav);return}
    const delAcc=event.target.closest('[data-delete-account]');if(delAcc){await deleteAccount(delAcc.dataset.deleteAccount);return}
    const aMenu=event.target.closest('[data-asset-menu]');if(aMenu){await assetMenu(aMenu.dataset.assetMenu);return}
    const pMenu=event.target.closest('[data-position-menu]');if(pMenu){await positionMenu(pMenu.dataset.positionMenu);return}
    const delSnap=event.target.closest('[data-delete-snapshot]');if(delSnap&&confirm('Удалить этот снимок из истории?')){await dbDelete('snapshots',delSnap.dataset.deleteSnapshot);await reload();toast('Снимок удалён');return}
  });
  byId('privacyToggle').addEventListener('click',()=>{state.moneyHidden=!state.moneyHidden;renderAll()});
  byId('saveSnapshotBtn').addEventListener('click',saveSnapshot);byId('saveSnapshotBtnHistory').addEventListener('click',saveSnapshot);
  byId('openQuickUpdate').addEventListener('click',()=>{renderQuickUpdate();openDialog('quickUpdateModal')});
  byId('backupShortcut').addEventListener('click',()=>navigate('dataView'));
  byId('exportBtn').addEventListener('click',exportData);
  byId('importInput').addEventListener('change',async e=>{const file=e.target.files?.[0];if(file)await importData(file);e.target.value=''});
  byId('resetBtn').addEventListener('click',async()=>{if(!confirm('Удалить все счета, активы, позиции и историю с этого устройства?'))return;for(const name of STORE_NAMES)await dbClear(name);await reload();toast('Все данные удалены')});

  byId('accountForm').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,name=form.elements.name.value.trim();if(!name)return;await dbPut('accounts',{id:uid(),name,type:form.elements.type.value,createdAt:Date.now()});form.reset();closeDialog('accountModal');await reload();toast('Счёт создан')});
  byId('assetForm').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,name=form.elements.name.value.trim(),symbol=form.elements.symbol.value.trim().toUpperCase(),price=Number(form.elements.price.value);if(!name||!symbol||!Number.isFinite(price)||price<0)return;if(state.assets.some(a=>a.symbol.toUpperCase()===symbol)){alert('Актив с таким тикером уже существует.');return}await dbPut('assets',{id:uid(),name,symbol,price,createdAt:Date.now(),updatedAt:Date.now()});form.reset();closeDialog('assetModal');await reload();toast('Актив создан')});
  byId('positionForm').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;if(!state.accounts.length||!state.assets.length)return;const quantity=Number(form.elements.quantity.value);if(!Number.isFinite(quantity))return;const accountId=form.elements.accountId.value,assetId=form.elements.assetId.value,editId=form.dataset.editId;const duplicate=state.positions.find(p=>p.accountId===accountId&&p.assetId===assetId&&p.id!==editId);if(duplicate&&!editId){duplicate.quantity=quantity;duplicate.updatedAt=Date.now();await dbPut('positions',duplicate)}else{await dbPut('positions',{id:editId||uid(),accountId,assetId,quantity,createdAt:state.positions.find(p=>p.id===editId)?.createdAt||Date.now(),updatedAt:Date.now()})}closeDialog('positionModal');resetPositionForm();await reload();toast('Позиция сохранена')});
  byId('priceForm').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,a=assetBy(form.elements.assetId.value),price=Number(form.elements.price.value);if(!a||!Number.isFinite(price)||price<0)return;a.price=price;a.updatedAt=Date.now();await dbPut('assets',a);closeDialog('priceModal');await reload();toast('Цена обновлена')});
  byId('quickUpdateForm').addEventListener('submit',async e=>{e.preventDefault();for(const input of $$('[data-asset-price]',e.currentTarget)){const a=assetBy(input.dataset.assetPrice),value=Number(input.value);if(a&&Number.isFinite(value)&&value>=0){a.price=value;a.updatedAt=Date.now();await dbPut('assets',a)}}for(const input of $$('[data-position-qty]',e.currentTarget)){const p=state.positions.find(x=>x.id===input.dataset.positionQty),value=Number(input.value);if(p&&Number.isFinite(value)){p.quantity=value;p.updatedAt=Date.now();await dbPut('positions',p)}}closeDialog('quickUpdateModal');await reload();toast('Портфель обновлён')});
  window.addEventListener('resize',()=>{if(byId('historyView').classList.contains('active'))drawChart()},{passive:true});
}

async function init(){
  try{db=await openDatabase();bindEvents();await reload();if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn))}catch(error){console.error(error);document.body.innerHTML='<div style="padding:30px;font-family:-apple-system">Не удалось открыть локальную базу данных. Проверьте, что Safari разрешает хранение данных для этого сайта.</div>'}
}
init();
