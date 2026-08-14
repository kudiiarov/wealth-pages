
'use strict';
const DB_NAME='worth-local-portfolio', DB_VERSION=1;
const STORE_NAMES=['accounts','assets','positions','snapshots'];
const state={accounts:[],assets:[],positions:[],snapshots:[],historyScope:'portfolio',displayCurrency:localStorage.getItem('worth-display-currency')||'USD',expandedAccounts:new Set(),expandedAssets:new Set(),theme:localStorage.getItem('worth-theme')||'light',lang:localStorage.getItem('worth-language')||'ru',pnlPeriod:localStorage.getItem('worth-pnl-period')||'all',autoRefreshOnLaunch:localStorage.getItem('worth-auto-refresh-launch')==='1'};
let db=null, pendingActions=[];
const $=(sel,root=document)=>root.querySelector(sel), $$=(sel,root=document)=>Array.from(root.querySelectorAll(sel)), byId=id=>document.getElementById(id);
const palette=['#17181b','#5667ff','#9b63e8','#21c26b','#f5a341','#33bfc6','#ee5264','#7a8395'];

const I18N={
ru:{
totalBalance:'Общий баланс',position:'Остаток',update:'Обновить',snapshot:'Снимок',portfolio:'Портфель',allocation:'Распределение',accounts:'Счета',assets:'Активы',add:'Добавить',addPlus:'+ Добавить',byAccounts:'По счетам',positions:'Позиции',trend:'Динамика',history:'История',app:'Приложение',settings:'Настройки',home:'Главная',theme:'Тема',lightOrDark:'Светлая или тёмная',light:'Светлая',dark:'Тёмная',language:'Язык',interfaceLanguage:'Язык интерфейса',exportData:'Экспорт данных',downloadJson:'Скачать резервную копию JSON',importData:'Импорт данных',restoreJson:'Восстановить резервную копию JSON',deleteAll:'Удалить все данные',deleteAllSub:'Счета, активы, позиции и история',cancel:'Отмена',name:'Название',type:'Тип',icon:'Иконка · 1–5 символов',color:'Цвет',assetCode:'Код актива · уникальный',currentPrice:'Текущая цена за единицу, $',account:'Счёт',asset:'Актив',quantity:'Количество',unitPrice:'Цена за единицу, $',fullName:'Полное название',commentOptional:'Комментарий <em>необязательно</em>',createAccount:'Создать счёт',createAsset:'Создать актив',save:'Сохранить',updatePrice:'Обновить цену',saveChanges:'Сохранить изменения',cashExample:'Например, Наличные',tetherExample:'Например, Tether',commentExample:'На машину, резерв, отпуск…',
saveFirst:'Сохраните первый снимок',noChanges:'Без изменений с последнего снимка',wholePortfolio:'Весь портфель',firstSnapshot:'первый снимок',positionHistoryEmpty:'Для этой позиции пока нет совместимых снимков. История позиции начинается с новых снимков версии 2.0-final.',portfolioHistoryEmpty:'Снимок фиксирует стоимость портфеля на выбранный момент. Делайте их регулярно, чтобы видеть динамику.',needTwo:'Нужно минимум два снимка для графика.',actions:'Действия',positionHistory:'История позиции',
configureAccount:'Настроить счёт',deleteAccount:'Удалить счёт',configureAsset:'Настроить актив',changePrice:'Изменить цену',deleteAsset:'Удалить актив',showPositionHistory:'Показать историю позиции',editPosition:'Изменить позицию',deletePosition:'Удалить позицию',deleteSnapshot:'Удалить снимок',
accountCreated:'Счёт создан',accountUpdated:'Счёт обновлён',accountDeleted:'Счёт удалён',assetCreated:'Актив создан',assetUpdated:'Актив обновлён',assetDeleted:'Актив удалён',positionSaved:'Позиция сохранена',positionDeleted:'Позиция удалена',priceUpdated:'Цена обновлена',snapshotSaved:'Снимок сохранён',snapshotDeleted:'Снимок удалён',changesSaved:'Изменения сохранены',backupCreated:'Резервная копия создана',dataRestored:'Данные восстановлены',allDeleted:'Все данные удалены',
confirmDeletePosition:'Удалить эту позицию?',confirmDeleteSnapshot:'Удалить этот снимок из истории?',confirmImport:'Импорт полностью заменит текущие локальные данные. Продолжить?',confirmDeleteAll:'Удалить все счета, активы, позиции и историю с этого устройства?',duplicateCode:'Актив с таким кодом уже существует. Код актива должен быть уникальным.',importFailed:'Не удалось импортировать резервную копию',unsupported:'неподдерживаемый формат',
emptyAccounts:'Например: Наличные, банк, биржа или деньги, которые вам должны.',emptyAccount:'На этом счёте пока нет активов',emptyAssets:'Актив — это валюта, металл, криптовалюта, акция или другое имущество с базовой ценой в долларах.',emptyAsset:'Этот актив пока не добавлен ни в одну позицию',emptyPositions:'Позиция связывает актив со счётом и хранит его количество.',deletedAccount:'Удалённый счёт',emptyAllocation:'Добавьте счёт, актив и первый остаток — здесь появится структура портфеля.',noPositions:'Нет позиций с этим активом',unitPriceLabel:'Цена за единицу',basePrice:'Базовая цена в USD',balances:'Остатки по счетам',editing:'Редактирование',newPos:'Новая',displayName:'US Dollar',base:'базовая',
confirmDeleteAccount:n=>`Удалить счёт «${n}» и все позиции на нём?`,confirmDeleteAsset:(n,c)=>`Удалить ${n} (${c}) и все позиции с этим активом?`,assetsCount:n=>`${n} ${decl(n,'актив','актива','активов')}`,qtyCode:c=>`Количество ${c}`,qtyAccount:(c,n)=>`Количество ${c} на счёте ${n}`,priceUsd:c=>`Цена ${c} в долларах`,refreshPrices:'Обновить цены активов',refreshPricesSub:'Автоматически обновить доступные валюты и криптоактивы',refreshAssetPrice:'Обновить цену автоматически',pricesUpdated:n=>`Цены обновлены: ${n}`,priceUpdatedAuto:'Цена обновлена автоматически',noAutoPrices:'Нет активов с доступным автоматическим источником цены',priceSourceUnavailable:'Автоматическая цена для этого актива недоступна',priceUpdateFailed:'Не удалось обновить цены',lastAutoUpdate:'Автообновление',neverAutoUpdated:'Не обновлялось автоматически',priceCurrency:'Валюта цены',autoUpdate:'Автообновление',autoNone:'Нет',autoSourceLabel:'Источник',autoSourceNone:'Ручная цена',autoSourceCoinGecko:'CoinGecko',autoSourceFrankfurter:'Frankfurter',sourceUnavailable:'Выбранный источник не смог обновить этот актив',updatingPrices:'Обновление цен…',displayCurrencyAria:'Валюта отображения',displayCurrencyTitle:'Валюта отображения',displayTitle:'Отображение',displayCurrencyHeading:'Валюта цен',displayCurrencyNote:'USD остаётся базовой валютой хранения. Выбор ниже меняет только отображение сумм на всех экранах.',baseLabel:'базовая',unitLabel:'за ед.',cash:'Наличные',bank:'Банк',exchange:'Биржа',cryptoWallet:'Криптокошелёк',debt:'Долг',other:'Другое',unitShort:'ед.',positionsShort:'поз.',appTitle:'Worth — личный портфель',zeroAssets:'0 активов',allHistory:'Вся история',new:'Новый',newPos:'Новая',position:'Позиция',price:'Цена',bulkChange:'Массовое изменение',updatePortfolio:'Обновить портфель',changeOnlyNeeded:'Измените только нужные значения. Цены применяются ко всем счетам с этим активом.',configureAccount:'Настроить счёт',configureAsset:'Настроить актив',choose:'Выбрать',createAccountAssetFirst:'Сначала создайте хотя бы один счёт и один актив.',autoRefreshOnLaunch:'Обновлять цены при открытии приложения',autoRefreshOnLaunchSub:'Автоматически обновлять настроенные курсы и цены при каждом открытии Worth',pnlNoBaseline:'Недостаточно истории для P&L',pnlVsFirst:'За всё время',pnlVsLast:'С последнего снапшота'
},
en:{
totalBalance:'Total balance',position:'Position',update:'Update',snapshot:'Snapshot',portfolio:'Portfolio',allocation:'Allocation',accounts:'Accounts',assets:'Assets',add:'Add',addPlus:'+ Add',byAccounts:'By account',positions:'Positions',trend:'Performance',history:'History',app:'App',settings:'Settings',home:'Home',theme:'Theme',lightOrDark:'Light or dark',light:'Light',dark:'Dark',language:'Language',interfaceLanguage:'Interface language',exportData:'Export data',downloadJson:'Download JSON backup',importData:'Import data',restoreJson:'Restore JSON backup',deleteAll:'Delete all data',deleteAllSub:'Accounts, assets, positions and history',cancel:'Cancel',name:'Name',type:'Type',icon:'Icon · 1–5 characters',color:'Color',assetCode:'Asset code · unique',currentPrice:'Current unit price, $',account:'Account',asset:'Asset',quantity:'Quantity',unitPrice:'Unit price, $',fullName:'Full name',commentOptional:'Comment <em>optional</em>',createAccount:'Create account',createAsset:'Create asset',save:'Save',updatePrice:'Update price',saveChanges:'Save changes',cashExample:'For example, Cash',tetherExample:'For example, Tether',commentExample:'Car fund, reserve, vacation…',
saveFirst:'Save your first snapshot',noChanges:'No change since the last snapshot',wholePortfolio:'Whole portfolio',firstSnapshot:'first snapshot',positionHistoryEmpty:'There are no compatible snapshots for this position yet. Position history starts with new snapshots made in version 2.0-final.',portfolioHistoryEmpty:'A snapshot records your portfolio value at a point in time. Save them regularly to track performance.',needTwo:'At least two snapshots are needed for the chart.',actions:'Actions',positionHistory:'Position history',
configureAccount:'Edit account',deleteAccount:'Delete account',configureAsset:'Edit asset',changePrice:'Change price',deleteAsset:'Delete asset',showPositionHistory:'Show position history',editPosition:'Edit position',deletePosition:'Delete position',deleteSnapshot:'Delete snapshot',
accountCreated:'Account created',accountUpdated:'Account updated',accountDeleted:'Account deleted',assetCreated:'Asset created',assetUpdated:'Asset updated',assetDeleted:'Asset deleted',positionSaved:'Position saved',positionDeleted:'Position deleted',priceUpdated:'Price updated',snapshotSaved:'Snapshot saved',snapshotDeleted:'Snapshot deleted',changesSaved:'Changes saved',backupCreated:'Backup created',dataRestored:'Data restored',allDeleted:'All data deleted',
confirmDeletePosition:'Delete this position?',confirmDeleteSnapshot:'Delete this snapshot from history?',confirmImport:'Import will completely replace your current local data. Continue?',confirmDeleteAll:'Delete all accounts, assets, positions and history from this device?',duplicateCode:'An asset with this code already exists. Asset codes must be unique.',importFailed:'Could not import the backup',unsupported:'unsupported format',
emptyAccounts:'For example: cash, bank, exchange, or money someone owes you.',emptyAccount:'There are no assets in this account yet.',emptyAssets:'An asset can be a currency, metal, crypto, stock or anything else with a USD base price.',emptyAsset:'This asset is not used in any position yet.',emptyPositions:'A position links an asset to an account and stores its quantity.',deletedAccount:'Deleted account',emptyAllocation:'Add an account, an asset and your first position to see the portfolio structure here.',noPositions:'No positions with this asset',unitPriceLabel:'Unit price',basePrice:'Base price in USD',balances:'Balances by account',editing:'Editing',newPos:'New',displayName:'US Dollar',base:'base',
confirmDeleteAccount:n=>`Delete account “${n}” and all positions in it?`,confirmDeleteAsset:(n,c)=>`Delete ${n} (${c}) and all positions using this asset?`,assetsCount:n=>`${n} asset${n===1?'':'s'}`,qtyCode:c=>`${c} quantity`,qtyAccount:(c,n)=>`${c} quantity in ${n}`,priceUsd:c=>`${c} price in USD`,refreshPrices:'Refresh asset prices',refreshPricesSub:'Automatically update supported currencies and crypto assets',refreshAssetPrice:'Refresh price automatically',pricesUpdated:n=>`Prices updated: ${n}`,priceUpdatedAuto:'Price updated automatically',noAutoPrices:'No assets have an available automatic price source',priceSourceUnavailable:'Automatic pricing is not available for this asset',priceUpdateFailed:'Could not update prices',lastAutoUpdate:'Auto-updated',neverAutoUpdated:'Never auto-updated',priceCurrency:'Price currency',autoUpdate:'Auto-update',autoNone:'None',autoSourceLabel:'Source',autoSourceNone:'Manual price',autoSourceCoinGecko:'CoinGecko',autoSourceFrankfurter:'Frankfurter',sourceUnavailable:'The selected source could not update this asset',updatingPrices:'Updating prices…',displayCurrencyAria:'Display currency',displayCurrencyTitle:'Display currency',displayTitle:'Display',displayCurrencyHeading:'Display currency',displayCurrencyNote:'USD remains the base storage currency. This setting only changes how amounts are displayed across the app.',baseLabel:'base',unitLabel:'per unit',cash:'Cash',bank:'Bank',exchange:'Exchange',cryptoWallet:'Crypto wallet',debt:'Debt',other:'Other',unitShort:'units',positionsShort:'pos.',appTitle:'Worth — personal portfolio',zeroAssets:'0 assets',allHistory:'All history',new:'New',newPos:'New',position:'Position',price:'Price',bulkChange:'Bulk update',updatePortfolio:'Update portfolio',changeOnlyNeeded:'Change only the values you need. Asset prices apply to every account holding that asset.',configureAccount:'Edit account',configureAsset:'Edit asset',choose:'Choose',createAccountAssetFirst:'Create at least one account and one asset first.',autoRefreshOnLaunch:'Refresh prices when opening the app',autoRefreshOnLaunchSub:'Automatically refresh configured rates and prices whenever Worth opens',pnlNoBaseline:'Not enough history for P&L',pnlVsFirst:'All time',pnlVsLast:'Since last snapshot'
}}
function t(k,...a){const v=(I18N[state.lang]||I18N.ru)[k]??I18N.ru[k]??k;return typeof v==='function'?v(...a):v}
function applyLanguage(){
 document.documentElement.lang=state.lang;
 $$('[data-i18n]').forEach(el=>{const v=t(el.dataset.i18n);if(typeof v==='string')el.textContent=v});document.title=t('appTitle');
 $$('[data-i18n-html]').forEach(el=>el.innerHTML=t(el.dataset.i18nHtml));
 $$('[data-i18n-placeholder]').forEach(el=>el.placeholder=t(el.dataset.i18nPlaceholder));
 $$('[data-lang-choice]').forEach(b=>b.classList.toggle('active',b.dataset.langChoice===state.lang));
 const ar=byId('autoRefreshOnLaunch');if(ar)ar.checked=!!state.autoRefreshOnLaunch;
 const qu=byId('quickUpdateModal');if(qu){
   const kicker=qu.querySelector('.section-kicker'),h=qu.querySelector('h2'),note=qu.querySelector('.sheet-note'),save=qu.querySelector('.quick-save');
   if(kicker)kicker.textContent=t('bulkChange');
   if(h)h.textContent=t('updatePortfolio');
   if(note)note.textContent=t('changeOnlyNeeded');
   if(save)save.textContent=t('saveChanges');
 }
 const cb=byId('displayCurrencyBtn');if(cb){cb.setAttribute('aria-label',t('displayCurrencyAria'));cb.setAttribute('title',t('displayCurrencyTitle'))}
 const typeMap={'Наличные':'cash','Банк':'bank','Биржа':'exchange','Криптокошелёк':'cryptoWallet','Долг':'debt','Другое':'other','Cash':'cash','Bank':'bank','Exchange':'exchange','Crypto wallet':'cryptoWallet','Debt':'debt','Other':'other'};
 $$('select[name="type"] option').forEach(o=>{const key=o.dataset.typeKey||o.value||typeMap[o.textContent.trim()];if(I18N[state.lang]?.[key]){o.dataset.typeKey=key;o.textContent=t(key)}});
 const cm=byId('currencyModal');if(cm){
   const kicker=cm.querySelector('.section-kicker'),h=cm.querySelector('h2'),note=cm.querySelector('.sheet-note');
   if(kicker)kicker.textContent=t('displayTitle');if(h)h.textContent=t('displayCurrencyHeading');if(note)note.textContent=t('displayCurrencyNote');
 }
}
function setLanguage(lang){state.lang=lang==='en'?'en':'ru';localStorage.setItem('worth-language',state.lang);applyLanguage();renderAll()}

const CRYPTO_PRICE_IDS={
 BTC:'bitcoin',ETH:'ethereum',SOL:'solana',USDT:'tether',USDC:'usd-coin',XAUT:'tether-gold',
 BNB:'binancecoin',XRP:'ripple',DOGE:'dogecoin',ADA:'cardano',TON:'the-open-network',TRX:'tron',
 DOT:'polkadot',LINK:'chainlink',LTC:'litecoin',BCH:'bitcoin-cash',AVAX:'avalanche-2',
 UNI:'uniswap',DAI:'dai',SHIB:'shiba-inu',APT:'aptos',SUI:'sui'
};
const fiatPairCache=new Map();
async function fetchFiatRate(code){
  const c=String(code||'').toUpperCase();
  if(c==='USD')return 1;
  const cached=fiatPairCache.get(c);
  if(cached&&Date.now()-cached.at<60000)return cached.rate;
  const r=await fetch(`https://api.frankfurter.dev/v2/rate/USD/${encodeURIComponent(c)}`,{cache:'no-store'});
  if(!r.ok)throw new Error(`Frankfurter ${r.status}`);
  const data=await r.json(),rate=Number(data.rate);
  if(!(rate>0))throw new Error('Frankfurter invalid rate');
  fiatPairCache.set(c,{rate,at:Date.now()});
  return rate;
}
async function fetchFiatRates(codes=[]){
  const out={USD:1};
  await Promise.all([...new Set(codes.map(c=>String(c).toUpperCase()).filter(c=>c&&c!=='USD'))].map(async c=>{
    try{out[c]=await fetchFiatRate(c)}catch(e){console.warn(`Frankfurter ${c} unavailable`,e)}
  }));
  return out;
}
async function fetchCryptoUsdByIds(ids){
  const unique=[...new Set(ids.filter(Boolean))];
  if(!unique.length)return {};
  const url=`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(unique.join(','))}&vs_currencies=usd`;
  const r=await fetch(url,{cache:'no-store'});
  if(!r.ok)throw new Error(`CoinGecko ${r.status}`);
  return await r.json();
}
function configuredPriceSource(asset){
  const type=asset?.autoUpdateSource||'none',code=String(asset?.code||'').toUpperCase();
  if(type==='frankfurter')return {type:'fiat',code};
  if(type==='coingecko'){
    const id=CRYPTO_PRICE_IDS[code];
    return id?{type:'crypto',id}:null;
  }
  return null;
}

async function refreshAssetPrices(targetAssetId=null){
  const targets=(targetAssetId?state.assets.filter(a=>a.id===targetAssetId):state.assets.slice()).filter(a=>(a.autoUpdateSource||'none')!=='none');
  if(!targets.length)return {updated:0,skipped:0};

  const fiatTargets=targets.filter(a=>a.autoUpdateSource==='frankfurter');
  let fiatRates={USD:1};
  if(fiatTargets.length)fiatRates=await fetchFiatRates(fiatTargets.map(a=>a.code));

  const cryptoTargets=targets.map(a=>({a,source:configuredPriceSource(a)})).filter(x=>x.source?.type==='crypto');
  let cryptoData={};
  if(cryptoTargets.length){
    try{cryptoData=await fetchCryptoUsdByIds(cryptoTargets.map(x=>x.source.id))}catch(e){console.warn('CoinGecko unavailable',e)}
  }

  let updated=0,skipped=0;
  for(const asset of targets){
    const source=configuredPriceSource(asset);
    let newPrice=null;
    if(source?.type==='fiat'){
      const unitsPerUsd=Number(fiatRates[source.code]);
      if(source.code==='USD')newPrice=1;
      else if(unitsPerUsd>0)newPrice=1/unitsPerUsd;
    }else if(source?.type==='crypto'){
      const p=Number(cryptoData[source.id]?.usd);
      if(p>0)newPrice=p;
    }
    if(Number.isFinite(newPrice)&&newPrice>0){
      asset.price=newPrice;
      asset.priceSource=source;
      asset.priceUpdatedAt=Date.now();
      await dbPut('assets',asset);
      updated++;
    }else skipped++;
  }
  await reload();
  return {updated,skipped};
}

async function runPriceRefresh(targetAssetId=null){
  const button=targetAssetId?null:byId('refreshPricesBtn');
  if(button){button.disabled=true;button.classList.add('loading')}
  try{
    const result=await refreshAssetPrices(targetAssetId);
    if(result.updated>0)toast(targetAssetId?t('priceUpdatedAuto'):t('pricesUpdated',result.updated));
    else toast(targetAssetId?t('sourceUnavailable'):t('noAutoPrices'));
    return result;
  }catch(e){
    console.error(e);toast(t('priceUpdateFailed'));return {updated:0,skipped:0,error:e}
  }finally{
    if(button){button.disabled=false;button.classList.remove('loading')}
  }
}


const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2});
function locale(){return state.lang==='en'?'en-US':'ru-RU'}
function number(v){return new Intl.NumberFormat(locale(),{maximumFractionDigits:8}).format(Number(v)||0)}
function displayAsset(){return state.displayCurrency==='USD'?null:state.assets.find(a=>a.code===state.displayCurrency)}
function displayRate(){const a=displayAsset();return a&&Number(a.price)>0?Number(a.price):1}
function displayValue(usdValue){return state.displayCurrency==='USD'?Number(usdValue||0):Number(usdValue||0)/displayRate()}
function displayUnit(){const a=displayAsset();return a?assetIcon(a):'$'}
function displayCode(){return displayAsset()?.code||'USD'}

function currencyChoices(){
  return [{code:'USD',name:t('displayName'),icon:'$',price:1},...state.assets.filter(a=>Number(a.price)>0).map(a=>({code:a.code,name:a.name,icon:assetIcon(a),price:Number(a.price)}))];
}
function priceCurrencyToUsd(amount,code){
  const n=Number(amount);
  if(!Number.isFinite(n))return NaN;
  if(code==='USD')return n;
  const a=state.assets.find(x=>x.code===code);
  const rate=Number(a?.price);
  return rate>0?n*rate:NaN;
}
function usdToPriceCurrency(usdValue,code){
  const n=Number(usdValue);
  if(!Number.isFinite(n))return NaN;
  if(code==='USD')return n;
  const a=state.assets.find(x=>x.code===code);
  const rate=Number(a?.price);
  return rate>0?n/rate:NaN;
}
function currencySelectOptions(selected='USD'){
  return currencyChoices().map(c=>`<option value="${escapeHTML(c.code)}" ${c.code===selected?'selected':''}>${escapeHTML(c.icon)} ${escapeHTML(c.code)}</option>`).join('');
}
function relativeTime(ts){
  if(!ts)return t('neverAutoUpdated');
  const diff=Math.max(0,Date.now()-Number(ts)),m=Math.floor(diff/60000);
  if(state.lang==='en'){
    if(m<1)return 'just now'; if(m<60)return `${m} min ago`; const h=Math.floor(m/60); if(h<24)return `${h} h ago`; return `${Math.floor(h/24)} d ago`;
  }else{
    if(m<1)return 'только что'; if(m<60)return `${m} мин назад`; const h=Math.floor(m/60); if(h<24)return `${h} ч назад`; return `${Math.floor(h/24)} дн назад`;
  }
}

function money(v){
  if(state.displayCurrency==='USD') return usd.format(Number(v)||0);
  const a=displayAsset();
  if(!a||Number(a.price)<=0) return usd.format(Number(v)||0);
  const amount=displayValue(v);
  const abs=Math.abs(amount);
  const digits=abs>=1000?0:abs>=10?2:4;
  const formatted=new Intl.NumberFormat(locale(),{minimumFractionDigits:0,maximumFractionDigits:digits}).format(amount);
  return `${formatted} ${assetIcon(a)}`;
}
function parseDecimal(value){
  const normalized=String(value??'').trim().replace(/\s+/g,'').replace(',', '.');
  if(!normalized||!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return NaN;
  return Number(normalized);
}
function inputDecimal(value){const s=String(value??'');return state.lang==='en'?s.replace(',','.'):s.replace('.',',')}
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
function positionValue(p){return WorthCore.positionValue(p,state.assets)} function portfolioTotal(){return WorthCore.portfolioTotal(state.positions,state.assets)} function assetQuantity(id){return WorthCore.assetQuantity(id,state.positions)} function assetTotal(id){return WorthCore.assetTotal(id,state.positions,state.assets)} function accountTotal(id){return WorthCore.accountTotal(id,state.positions,state.assets)}

function compatibleSnapshots(){return state.snapshots.filter(s=>Array.isArray(s.positions))}
function pnlBaselineSnapshot(){
  const s=compatibleSnapshots();
  if(!s.length)return null;
  return state.pnlPeriod==='last'?s.at(-1):s[0];
}
function currentPnlPoint(){
  return {
    createdAt:Date.now(),
    positions:state.positions.map(p=>{const a=assetBy(p.assetId),acc=accountBy(p.accountId);return {positionId:p.id,accountId:p.accountId,accountName:acc?.name||'',assetId:p.assetId,assetCode:a?.code||'',quantity:Number(p.quantity)||0,price:Number(a?.price)||0,value:positionValue(p)}}),
    assets:state.assets.map(a=>({assetId:a.id,price:Number(a.price)||0}))
  };
}
function pointAssetPrice(point,assetId,fallback=0){
  const a=(point?.assets||[]).find(x=>x.assetId===assetId);
  return Number(a?.price)||Number(fallback)||0;
}
function pointPositionMap(point){
  const m=new Map();for(const p of (point?.positions||[]))m.set(p.positionId,p);return m;
}
function pnlSeriesPoints(){
  const snaps=compatibleSnapshots(),base=pnlBaselineSnapshot();
  if(!base)return [];
  const idx=snaps.findIndex(s=>s.id===base.id);
  return [...snaps.slice(idx),currentPnlPoint()];
}
function intervalPositionResult(prev,next,positionId){
  const pm=pointPositionMap(prev),nm=pointPositionMap(next),a=pm.get(positionId),b=nm.get(positionId);
  if(!a&&!b)return null;
  const assetId=b?.assetId||a?.assetId;
  const q0=Number(a?.quantity)||0,q1=Number(b?.quantity)||0;
  const p0=Number(a?.price)||pointAssetPrice(prev,assetId,0);
  const p1=Number(b?.price)||pointAssetPrice(next,assetId,p0);
  const start=q0*p0,end=q1*p1,flow=(q1-q0)*p1,pnl=end-start-flow;
  return {pnl,flow,start,end,accountId:b?.accountId||a?.accountId,assetId};
}
function flowAdjustedPnl(filterFn){
  const points=pnlSeriesPoints();if(points.length<2)return null;
  let pnl=0,positiveFlows=0,baseCapital=0,has=false;
  const firstMap=pointPositionMap(points[0]);
  for(const p of firstMap.values())if(filterFn(p))baseCapital+=Math.abs((Number(p.quantity)||0)*(Number(p.price)||0));
  for(let i=1;i<points.length;i++){
    const prev=points[i-1],next=points[i],ids=new Set([...pointPositionMap(prev).keys(),...pointPositionMap(next).keys()]);
    for(const id of ids){
      const probe=pointPositionMap(next).get(id)||pointPositionMap(prev).get(id);
      if(!probe||!filterFn(probe))continue;
      const r=intervalPositionResult(prev,next,id);if(!r)continue;has=true;pnl+=r.pnl;if(r.flow>0)positiveFlows+=r.flow;
    }
  }
  if(!has&&baseCapital===0)return null;
  const denom=baseCapital+positiveFlows,pct=denom>0?pnl/denom*100:null;
  return {pnl,pct,baseCapital,positiveFlows,baselineAt:points[0].createdAt}
}
function portfolioPnl(){return flowAdjustedPnl(()=>true)}
function accountPnl(id){return flowAdjustedPnl(p=>p.accountId===id)}
function assetPnl(id){return flowAdjustedPnl(p=>p.assetId===id)}
function positionPnl(id){return flowAdjustedPnl(p=>p.positionId===id)}
function pnlPctText(r){if(!r||r.pct===null)return '—';const s=r.pct>0?'+':r.pct<0?'−':'';return `${s}${Math.abs(r.pct).toFixed(1)}%`}
function pnlMoneyText(r){if(!r)return t('pnlNoBaseline');const s=r.pnl>0?'+':r.pnl<0?'−':'';return `${s}${money(Math.abs(r.pnl))} · ${pnlPctText(r)}`}
function pnlClass(r){return !r||r.pnl===0?'':r.pnl>0?'pnl-positive':'pnl-negative'}
 function visibleMoney(v){return money(v)}
function renderAll(){syncDisplayCurrency();applyTheme();applyLanguage();renderCurrencyButton();renderBalance();renderAllocation();renderAccounts();renderAssets();renderPositions();refreshHistoryScope();renderHistory();refreshPositionForm()}
function pnlReferenceSnapshot(){
  const snaps=compatibleSnapshots();
  if(!snaps.length)return null;
  return state.pnlPeriod==='last'?snaps.at(-1):snaps[0];
}
function shortPnlDate(ts){
  return new Intl.DateTimeFormat(locale(),{day:'2-digit',month:'2-digit',year:'2-digit'}).format(new Date(ts));
}
function renderPnlSummary(){
  const r=portfolioPnl(),ref=pnlReferenceSnapshot(),moneyEl=byId('pnlMoney'),pctEl=byId('pnlPercent'),dateBtn=byId('pnlPeriodToggle'),caption=byId('pnlModeCaption');
  byId('homeTitle').textContent=money(portfolioTotal());
  if(!r||!ref){
    moneyEl.textContent='—';pctEl.textContent='—';dateBtn.textContent='—';caption.textContent=t('pnlNoBaseline');
    moneyEl.className='pnl-money';pctEl.className='pnl-percent';return;
  }
  const sign=r.pnl>0?'+':r.pnl<0?'−':'';
  moneyEl.textContent=`${sign}${money(Math.abs(r.pnl))}`;
  pctEl.textContent=`${sign}${Math.abs(r.pct||0).toFixed(2)}%`;
  dateBtn.textContent=shortPnlDate(ref.createdAt);
  caption.textContent=state.pnlPeriod==='last'?t('pnlVsLast'):t('pnlVsFirst');
  const cls=r.pnl>0?'pnl-positive':r.pnl<0?'pnl-negative':'';
  moneyEl.className=`pnl-money ${cls}`;pctEl.className=`pnl-percent ${cls}`;
}
function renderBalance(){renderPnlSummary()}
function renderAllocation(){
  const rows=state.assets.map(asset=>({asset,value:assetTotal(asset.id),qty:assetQuantity(asset.id)})).filter(x=>x.value!==0).sort((a,b)=>b.value-a.value),
    gross=rows.reduce((s,x)=>s+Math.abs(x.value),0),bar=byId('allocationBar'),list=byId('allocationList');
  byId('assetsCount').textContent=t('assetsCount',rows.length);
  if(!rows.length||gross===0){bar.innerHTML='';list.innerHTML=`<div class="empty-state">${t('emptyAllocation')}</div>`;return}
  bar.innerHTML=rows.map(x=>`<span class="allocation-segment" style="width:${Math.abs(x.value)/gross*100}%;background:${assetColor(x.asset)}"></span>`).join('');
  list.innerHTML=rows.slice(0,6).map(x=>`<div class="allocation-row"><span class="asset-badge ${iconLenClass(assetIcon(x.asset))}" style="background:${assetColor(x.asset)}">${escapeHTML(assetIcon(x.asset))}</span><div class="allocation-meta"><strong>${escapeHTML(x.asset.name)}</strong><small>${escapeHTML(x.asset.code)} · ${number(x.qty)} · ${(Math.abs(x.value)/gross*100).toFixed(1)}%</small></div><div class="allocation-value"><strong>${visibleMoney(x.value)}</strong><small>${visibleMoney(x.asset.price)} / ${t('unitShort')}</small><small class="pnl-inline ${pnlClass(assetPnl(x.asset.id))}">${pnlPctText(assetPnl(x.asset.id))}</small></div></div>`).join('');
}
function renderAccounts(){
  const list=byId('accountsList');
  if(!state.accounts.length){list.innerHTML=`<div class="empty-state">${t('emptyAccounts')}</div>`;return}
  list.innerHTML=state.accounts.map(a=>{
    const open=state.expandedAccounts.has(a.id);
    const positions=state.positions.filter(p=>p.accountId===a.id);
    const details=positions.length?positions.map(p=>{const asset=assetBy(p.assetId),comment=p.comment?`<span class="account-position-comment">• ${escapeHTML(p.comment)}</span>`:'';return `<div class="account-asset-row"><span class="mini-asset-icon ${iconLenClass(assetIcon(asset))}" style="background:${assetColor(asset)}">${escapeHTML(assetIcon(asset))}</span><div><div class="account-position-title"><strong>${escapeHTML(asset?.code||asset?.name||t('asset'))}</strong>${comment}</div><small>${escapeHTML(asset?.name||'')} · ${number(p.quantity)} ${t('unitShort')}</small></div><b>${money(positionValue(p))}</b></div>`}).join(''):`<div class="account-empty">${t('emptyAccount')}</div>`;
    return `<div class="account-expand-card ${open?'expanded':''}">
      <div class="list-card account-toggle" data-account-toggle="${a.id}">
        <div class="list-icon ${iconLenClass(accountIcon(a))}" style="background:${accountColor(a)};color:#fff">${escapeHTML(accountIcon(a))}</div>
        <div class="list-main"><strong>${escapeHTML(a.name)}</strong><small>${escapeHTML(accountTypeLabel(a.type))} · ${positions.length} ${t('positionsShort')}</small></div>
        <div class="list-value"><strong>${money(accountTotal(a.id))}</strong><small class="pnl-inline ${pnlClass(accountPnl(a.id))}">${pnlPctText(accountPnl(a.id))}</small></div>
        <button class="menu-button" data-account-menu="${a.id}" aria-label="${t('actions')}">···</button>
      </div>
      <div class="account-assets ${open?'':'hidden'}">${details}</div>
    </div>`;
  }).join('');
}
function renderAssets(){
  const list=byId('assetsList');
  if(!state.assets.length){list.innerHTML=`<div class="empty-state">${t('emptyAssets')}</div>`;return}
  list.innerHTML=state.assets.map(a=>{
    const open=state.expandedAssets.has(a.id),positions=state.positions.filter(p=>p.assetId===a.id);
    const details=positions.length?positions.map(p=>{const acc=accountBy(p.accountId),comment=p.comment?`<small class="asset-position-comment">• ${escapeHTML(p.comment)}</small>`:'';return `<div class="account-asset-row"><span class="mini-asset-icon ${iconLenClass(accountIcon(acc))}" style="background:${accountColor(acc)}">${escapeHTML(accountIcon(acc))}</span><div><strong>${escapeHTML(acc?.name||t('account'))}</strong><small>${number(p.quantity)} ${escapeHTML(a.code)}</small>${comment}</div><b>${money(positionValue(p))}</b></div>`}).join(''):`<div class="account-empty">${t('emptyAsset')}</div>`;
    return `<div class="account-expand-card ${open?'expanded':''}"><div class="list-card asset-toggle" data-asset-toggle="${a.id}"><div class="list-icon ${iconLenClass(assetIcon(a))}" style="background:${assetColor(a)};color:#fff">${escapeHTML(assetIcon(a))}</div><div class="list-main"><strong>${escapeHTML(a.name)}</strong><small>${escapeHTML(a.code)} · ${number(assetQuantity(a.id))} ${t('unitShort')} · ${money(a.price)} / ${t('unitShort')}<br><span class="asset-updated-time">${a.autoUpdateSource==='none'?t('autoSourceNone'):`${t('autoSourceLabel')}: ${a.autoUpdateSource==='coingecko'?t('autoSourceCoinGecko'):t('autoSourceFrankfurter')} · ${relativeTime(a.priceUpdatedAt)}`}</span></small></div><div class="list-value"><strong>${money(assetTotal(a.id))}</strong><small class="pnl-inline ${pnlClass(assetPnl(a.id))}">${pnlPctText(assetPnl(a.id))}</small></div><button class="menu-button" data-asset-menu="${a.id}" aria-label="${t('actions')}">···</button></div><div class="account-assets ${open?'':'hidden'}">${details}</div></div>`;
  }).join('');
}
function renderPositions(){
  const summary=byId('positionsSummary'),list=byId('positionsList');
  summary.innerHTML=state.accounts.map(a=>`<div class="summary-pill"><span class="summary-icon ${iconLenClass(accountIcon(a))}" style="background:${accountColor(a)};color:#fff">${escapeHTML(accountIcon(a))}</span><span><small>${escapeHTML(a.name)}</small><strong>${money(accountTotal(a.id))}</strong></span></div>`).join('');
  if(!state.positions.length){list.innerHTML=`<div class="empty-state">${t('emptyPositions')}</div>`;return}
  list.innerHTML=state.positions.slice().sort((a,b)=>positionValue(b)-positionValue(a)).map(p=>{const a=assetBy(p.assetId),acc=accountBy(p.accountId),comment=p.comment?`<span class="position-comment">• ${escapeHTML(p.comment)}</span>`:'';return `<div class="list-card"><div class="list-icon ${iconLenClass(assetIcon(a))}" style="background:${assetColor(a)};color:#fff">${escapeHTML(assetIcon(a))}</div><div class="list-main"><div class="position-title-line"><strong>${escapeHTML(a?.code||a?.name||t('asset'))}</strong>${comment}</div><small>${escapeHTML(acc?.name||t('deletedAccount'))} · ${number(p.quantity)} ${t('unitShort')} · ${escapeHTML(a?.name||'')}</small></div><div class="list-value"><strong>${money(positionValue(p))}</strong><small>${a?money(a.price):'—'} / ${t('unitShort')}</small><small class="pnl-inline ${pnlClass(positionPnl(p.id))}">${pnlPctText(positionPnl(p.id))}</small></div><button class="menu-button" data-position-menu="${p.id}" aria-label="${t('actions')}">···</button></div>`}).join('');
}
function positionLabel(p){const a=assetBy(p.assetId),acc=accountBy(p.accountId),comment=p.comment?` · ${p.comment}`:'';return `${acc?.name||t('account')} · ${a?.code||t('asset')}${comment}`}
function historicalPositionOptions(){const map=new Map();for(const p of state.positions)map.set(p.id,{positionId:p.id,label:positionLabel(p)});for(const s of state.snapshots)for(const p of (Array.isArray(s.positions)?s.positions:[]))if(!map.has(p.positionId))map.set(p.positionId,{positionId:p.positionId,label:`${p.accountName||t('account')} · ${p.assetCode||t('asset')}${p.comment?` · ${p.comment}`:''}`});return [...map.values()].sort((a,b)=>a.label.localeCompare(b.label,locale()))}
function refreshHistoryScope(){const select=byId('historyScope'),current=state.historyScope;select.innerHTML=`<option value="portfolio">${t('wholePortfolio')}</option>`+historicalPositionOptions().map(p=>`<option value="position:${p.positionId}">${escapeHTML(p.label)}</option>`).join('');if([...select.options].some(o=>o.value===current))select.value=current;else{state.historyScope='portfolio';select.value='portfolio'}}
function historyData(){if(state.historyScope==='portfolio')return state.snapshots.map(s=>({snapshot:s,value:Number(s.total)||0}));const id=state.historyScope.slice(9);return state.snapshots.map(s=>{const rec=Array.isArray(s.positions)?s.positions.find(p=>p.positionId===id):null;return rec?{snapshot:s,value:Number(rec.value)||0,record:rec}:null}).filter(Boolean)}
function currentHistoryLabel(){if(state.historyScope==='portfolio')return t('wholePortfolio');const id=state.historyScope.slice(9),p=state.positions.find(x=>x.id===id);if(p)return positionLabel(p);for(const s of state.snapshots){const r=(s.positions||[]).find(x=>x.positionId===id);if(r)return `${r.accountName||t('account')} · ${r.assetCode||t('asset')}${r.comment?` · ${r.comment}`:''}`}return t('positionHistory')}
function renderHistory(){const list=byId('historyList'),data=historyData(),isPosition=state.historyScope!=='portfolio';byId('historyRangeLabel').textContent=currentHistoryLabel();if(!data.length)list.innerHTML=`<div class="empty-state">${isPosition?t('positionHistoryEmpty'):t('portfolioHistoryEmpty')}</div>`;else list.innerHTML=data.slice().reverse().map(item=>{const i=data.findIndex(x=>x.snapshot.id===item.snapshot.id),prev=data[i-1],diff=prev?item.value-prev.value:null;return `<div class="list-card"><span class="history-dot"></span><div class="list-main"><strong>${formatDate(item.snapshot.createdAt)}</strong><small>${formatTime(item.snapshot.createdAt)}${diff===null?` · ${t('firstSnapshot')}`:` · ${diff>=0?'+':'−'}${money(Math.abs(diff))}`}</small></div><div class="list-value"><strong>${money(item.value)}</strong></div><button class="menu-button" data-snapshot-menu="${item.snapshot.id}" aria-label="${t('actions')}">···</button></div>`}).join('');drawChart()}

function drawChart(){
  const canvas=byId('historyChart'),empty=byId('historyEmpty'),dateRow=byId('chartDates'),change=byId('historyChange'),data=historyData();
  if(data.length<2){empty.classList.remove('hidden');dateRow.children[0].textContent='';dateRow.children[1].textContent='';change.textContent='—';return}
  empty.classList.add('hidden');const rect=canvas.getBoundingClientRect();if(rect.width<20)return;
  const dpr=Math.min(devicePixelRatio||1,3),w=rect.width,h=270;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const vals=data.map(x=>displayValue(x.value)),raw=data.map(x=>x.value),min0=Math.min(...vals),max0=Math.max(...vals),extra=(max0-min0)*.12||Math.max(Math.abs(max0)*.08,1),min=min0-extra,max=max0+extra,range=max-min||1;
  const compact=v=>{const abs=Math.abs(v),sign=v<0?'−':'',unit=displayUnit();if(abs>=1e9)return `${sign}${(abs/1e9).toFixed(abs>=1e10?0:1)}B ${unit}`;if(abs>=1e6)return `${sign}${(abs/1e6).toFixed(abs>=1e7?0:1)}M ${unit}`;if(abs>=1e3)return `${sign}${(abs/1e3).toFixed(abs>=1e4?0:1)}K ${unit}`;return `${new Intl.NumberFormat(locale(),{maximumFractionDigits:abs<10?2:0}).format(v)} ${unit}`};
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
function decl(n,o,f,m){const x=Math.abs(n)%100,y=x%10;if(x>10&&x<20)return m;if(y>1&&y<5)return f;if(y===1)return o;return m}
function accountTypeKey(v=''){const s=String(v).toLowerCase();if(s.includes('банк')||s==='bank')return 'bank';if(s.includes('бирж')||s==='exchange')return 'exchange';if(s.includes('долг')||s==='debt')return 'debt';if(s.includes('крипто')||s==='crypto wallet')return 'cryptoWallet';if(s.includes('налич')||s==='cash')return 'cash';return 'other'}
function accountTypeLabel(v=''){return t(accountTypeKey(v))}
function accountGlyph(v=''){const k=accountTypeKey(v);if(k==='bank')return '▥';if(k==='exchange')return '↗';if(k==='debt')return '↔';if(k==='cryptoWallet')return '◇';if(k==='cash')return '$';return '•'}
function formatDate(ts){return new Intl.DateTimeFormat(locale(),{day:'numeric',month:'long',year:'numeric'}).format(new Date(ts))} function shortDate(ts){return new Intl.DateTimeFormat(locale(),{day:'numeric',month:'short'}).format(new Date(ts))} function formatTime(ts){return new Intl.DateTimeFormat(locale(),{hour:'2-digit',minute:'2-digit'}).format(new Date(ts))}
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
  const items=[{code:'USD',name:t('displayName'),icon:'$',color:'#17181b'},...state.assets.filter(a=>Number(a.price)>0)];
  box.innerHTML=items.map(a=>`<button type="button" class="currency-option ${state.displayCurrency===a.code?'selected':''}" data-currency-code="${escapeHTML(a.code)}"><span class="currency-option-icon ${iconLenClass(a.icon||'$')}" style="background:${a.color||'#17181b'}">${escapeHTML(a.icon||'$')}</span><span><strong>${escapeHTML(a.name)}</strong><small>${escapeHTML(a.code)}${a.code==='USD'?` · ${t('baseLabel')}`:` · ${usd.format(Number(a.price))} / ${t('unitLabel')}`}</small></span><b>${state.displayCurrency===a.code?'✓':''}</b></button>`).join('');
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
function toast(t){const el=byId('toast');el.textContent=t;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),1800)} function closeDialog(id){const d=byId(id);if(d?.open)d.close()} function openDialog(id){if(id==='positionModal')resetPositionForm();const d=byId(id);if(d&&!d.open)d.showModal()} function navigate(id){$$('.view').forEach(v=>v.classList.toggle('active',v.id===id));$$('.tab').forEach(t=>t.classList.toggle('active',t.dataset.nav===id));scrollTo({top:0,behavior:'instant'});if(id==='historyView')requestAnimationFrame(drawChart)} function resetPositionForm(){const f=byId('positionForm');f.reset();delete f.dataset.editId;byId('positionModeLabel').textContent=t('newPos');refreshPositionForm()}
function showActionMenu(title,actions){pendingActions=actions;byId('actionMenuTitle').textContent=title;byId('actionMenuItems').innerHTML=actions.map((a,i)=>`<button type="button" class="action-item ${a.danger?'danger':''}" data-action-index="${i}">${escapeHTML(a.label)}</button>`).join('');openDialog('actionMenuModal')}
function buildSnapshot(){
  const positions=state.positions.map(p=>{const a=assetBy(p.assetId),acc=accountBy(p.accountId);return {
    positionId:p.id,accountId:p.accountId,accountName:acc?.name||'',assetId:p.assetId,
    assetCode:a?.code||'',assetName:a?.name||'',comment:p.comment||'',
    quantity:Number(p.quantity)||0,price:Number(a?.price)||0,value:positionValue(p)
  }});
  return {
    id:uid(),createdAt:Date.now(),total:portfolioTotal(),
    accounts:state.accounts.map(a=>({accountId:a.id,name:a.name,total:accountTotal(a.id)})),
    assets:state.assets.map(a=>({assetId:a.id,code:a.code,name:a.name,icon:a.icon,color:a.color,price:Number(a.price),quantity:assetQuantity(a.id),value:assetTotal(a.id)})),
    positions
  };
}
async function saveSnapshot(){const snapshot=buildSnapshot();await dbPut('snapshots',snapshot);await reload();toast(t('snapshotSaved'))}

function accountMenu(id){const a=accountBy(id);if(!a)return;showActionMenu(a.name,[{label:t('configureAccount'),run:()=>{const f=byId('accountEditForm');f.elements.accountId.value=a.id;f.elements.name.value=a.name;f.elements.type.value=accountTypeKey(a.type);f.elements.icon.value=a.icon;f.elements.color.value=a.color;openDialog('accountEditModal')}},{label:t('deleteAccount'),danger:true,run:async()=>{if(!confirm(t('confirmDeleteAccount',a.name)))return;for(const p of state.positions.filter(p=>p.accountId===id))await dbDelete('positions',p.id);await dbDelete('accounts',id);await reload();toast(t('accountDeleted'))}}])}

function assetMenu(id){const a=assetBy(id);if(!a)return;showActionMenu(`${a.name} · ${a.code}`,[{label:t('refreshAssetPrice'),run:async()=>{await runPriceRefresh(a.id)}},{label:t('configureAsset'),run:()=>{const f=byId('assetEditForm');f.elements.assetId.value=a.id;f.elements.name.value=a.name;f.elements.code.value=a.code;f.elements.icon.value=a.icon;f.elements.color.value=a.color;f.elements.autoUpdateSource.value=a.autoUpdateSource||'none';openDialog('assetEditModal')}},{label:t('changePrice'),run:()=>{const f=byId('priceForm');f.elements.assetId.value=a.id;f.elements.priceCurrency.innerHTML=currencySelectOptions('USD');f.dataset.priceCurrency='USD';f.elements.price.value=inputDecimal(a.price);byId('priceAssetTitle').textContent=`${a.name} · ${a.code}`;openDialog('priceModal')}},{label:t('deleteAsset'),danger:true,run:async()=>{if(!confirm(t('confirmDeleteAsset',a.name,a.code)))return;for(const p of state.positions.filter(p=>p.assetId===id))await dbDelete('positions',p.id);await dbDelete('assets',id);await reload();toast(t('assetDeleted'))}}])}

function positionMenu(id){const p=state.positions.find(x=>x.id===id),a=p&&assetBy(p.assetId);if(!p)return;showActionMenu(a?.name||t('position'),[{label:t('showPositionHistory'),run:()=>{state.historyScope=`position:${p.id}`;navigate('historyView');refreshHistoryScope();renderHistory()}},{label:t('editPosition'),run:()=>{openDialog('positionModal');const f=byId('positionForm');f.dataset.editId=p.id;f.elements.accountId.value=p.accountId;f.elements.assetId.value=p.assetId;f.elements.quantity.value=inputDecimal(p.quantity);f.elements.comment.value=p.comment||'';byId('positionModeLabel').textContent=t('editing')}},{label:t('deletePosition'),danger:true,run:async()=>{if(!confirm(t('confirmDeletePosition')))return;await dbDelete('positions',id);await reload();toast(t('positionDeleted'))}}])}

function snapshotMenu(id){showActionMenu(t('snapshot'),[{label:t('deleteSnapshot'),danger:true,run:async()=>{if(!confirm(t('confirmDeleteSnapshot')))return;await dbDelete('snapshots',id);await reload();toast(t('snapshotDeleted'))}}])}

function renderQuickUpdate(){const c=byId('quickUpdateFields');if(!state.assets.length){c.innerHTML=`<div class="empty-state">${t('emptyAssets')}</div>`;return}c.innerHTML=state.assets.map(a=>{const positions=state.positions.filter(p=>p.assetId===a.id);const rows=positions.length?positions.map(p=>{const acc=accountBy(p.accountId);return `<label class="quick-position-row"><span class="quick-position-account"><span class="quick-account-icon ${iconLenClass(accountIcon(acc))}" style="background:${accountColor(acc)}">${escapeHTML(accountIcon(acc))}</span><span><strong>${escapeHTML(acc?.name||t('account'))}</strong><small>${escapeHTML(t('qtyCode',a.code))}</small></span></span><input type="text" inputmode="decimal" autocomplete="off" data-position-qty="${p.id}" value="${inputDecimal(p.quantity)}" aria-label="${escapeHTML(t('qtyAccount',a.code,acc?.name||t('account')))}"></label>`}).join(''):`<div class="quick-no-positions">${t('noPositions')}</div>`;return `<section class="quick-asset-card"><div class="quick-asset-head"><span class="quick-asset-icon ${iconLenClass(assetIcon(a))}" style="background:${assetColor(a)}">${escapeHTML(assetIcon(a))}</span><div class="quick-asset-meta"><strong>${escapeHTML(a.name)}</strong><small>${escapeHTML(a.code)} · ${money(assetTotal(a.id))}</small></div></div><label class="quick-price-row"><span><strong>${t('unitPriceLabel')}</strong><small>${t('basePrice')}</small></span><div class="quick-price-entry"><input type="text" inputmode="decimal" autocomplete="off" data-asset-price="${a.id}" value="${inputDecimal(a.price)}" aria-label="${escapeHTML(t('priceUsd',a.code))}"><select data-asset-price-currency="${a.id}" class="price-currency-select">${currencySelectOptions('USD')}</select></div></label><div class="quick-positions-block"><div class="quick-block-title">${t('balances')}</div>${rows}</div></section>`}).join('')}

function exportData(){const payload={app:'Worth',version:14,appVersion:'2.5.1-final',baseCurrency:'USD',exportedAt:new Date().toISOString(),accounts:state.accounts,assets:state.assets,positions:state.positions,snapshots:state.snapshots,appSettings:{language:state.lang,theme:state.theme,displayCurrency:state.displayCurrency,pnlPeriod:state.pnlPeriod,autoRefreshOnLaunch:state.autoRefreshOnLaunch}},blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`worth-backup-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);toast(t('backupCreated'))}

function validateImport(data){return WorthCore.validateImport(data)}
async function importData(file){try{const raw=JSON.parse(await file.text()),data=validateImport(raw);if(!confirm(t('confirmImport')))return;for(const n of STORE_NAMES){await dbClear(n);for(const item of data[n])await dbPut(n,item)}
if(raw.appSettings&&typeof raw.appSettings==='object'){
  if(['ru','en'].includes(raw.appSettings.language)){state.lang=raw.appSettings.language;localStorage.setItem('worth-language',state.lang)}
  if(['light','dark'].includes(raw.appSettings.theme)){state.theme=raw.appSettings.theme;localStorage.setItem('worth-theme',state.theme)}
  if(typeof raw.appSettings.displayCurrency==='string'){state.displayCurrency=raw.appSettings.displayCurrency;localStorage.setItem('worth-display-currency',state.displayCurrency)}
  if(['all','last'].includes(raw.appSettings.pnlPeriod)){state.pnlPeriod=raw.appSettings.pnlPeriod;localStorage.setItem('worth-pnl-period',state.pnlPeriod)}
  if(typeof raw.appSettings.autoRefreshOnLaunch==='boolean'){state.autoRefreshOnLaunch=raw.appSettings.autoRefreshOnLaunch;localStorage.setItem('worth-auto-refresh-launch',state.autoRefreshOnLaunch?'1':'0')}
}
await reload();toast(t('dataRestored'))}catch(e){console.error(e);alert(`${t('importFailed')}: ${e.message||t('unsupported')}`)}}

function bindEvents(){document.addEventListener('click',async e=>{const currency=e.target.closest('[data-currency-code]');if(currency){setDisplayCurrency(currency.dataset.currencyCode);return}const theme=e.target.closest('[data-theme-choice]');if(theme){setTheme(theme.dataset.themeChoice);return}const lang=e.target.closest('[data-lang-choice]');if(lang){setLanguage(lang.dataset.langChoice);return}const accountToggle=e.target.closest('[data-account-toggle]');if(accountToggle&&!e.target.closest('[data-account-menu]')){const id=accountToggle.dataset.accountToggle;state.expandedAccounts.has(id)?state.expandedAccounts.delete(id):state.expandedAccounts.add(id);renderAccounts();return}const assetToggle=e.target.closest('[data-asset-toggle]');if(assetToggle&&!e.target.closest('[data-asset-menu]')){const id=assetToggle.dataset.assetToggle;state.expandedAssets.has(id)?state.expandedAssets.delete(id):state.expandedAssets.add(id);renderAssets();return}const open=e.target.closest('[data-open]');if(open){openDialog(open.dataset.open);return}const close=e.target.closest('[data-close]');if(close){closeDialog(close.dataset.close);return}const nav=e.target.closest('[data-nav]');if(nav){navigate(nav.dataset.nav);return}const am=e.target.closest('[data-account-menu]');if(am){accountMenu(am.dataset.accountMenu);return}const asm=e.target.closest('[data-asset-menu]');if(asm){assetMenu(asm.dataset.assetMenu);return}const pm=e.target.closest('[data-position-menu]');if(pm){positionMenu(pm.dataset.positionMenu);return}const sm=e.target.closest('[data-snapshot-menu]');if(sm){snapshotMenu(sm.dataset.snapshotMenu);return}const ai=e.target.closest('[data-action-index]');if(ai){const action=pendingActions[Number(ai.dataset.actionIndex)];closeDialog('actionMenuModal');if(action)await action.run();return}});
byId('priceForm').elements.priceCurrency.addEventListener('change',e=>{const f=byId('priceForm'),prev=f.dataset.priceCurrency||'USD',next=e.target.value,current=parseDecimal(f.elements.price.value),usdValue=priceCurrencyToUsd(current,prev);if(Number.isFinite(usdValue)){const converted=usdToPriceCurrency(usdValue,next);if(Number.isFinite(converted))f.elements.price.value=inputDecimal(converted)}f.dataset.priceCurrency=next});
byId('pnlPeriodToggle').addEventListener('click',()=>{state.pnlPeriod=state.pnlPeriod==='last'?'all':'last';localStorage.setItem('worth-pnl-period',state.pnlPeriod);renderAll()});
byId('autoRefreshOnLaunch').addEventListener('change',e=>{state.autoRefreshOnLaunch=!!e.target.checked;localStorage.setItem('worth-auto-refresh-launch',state.autoRefreshOnLaunch?'1':'0')});
byId('historyScope').addEventListener('change',e=>{state.historyScope=e.target.value;renderHistory()});byId('saveSnapshotBtn').addEventListener('click',saveSnapshot);byId('saveSnapshotBtnHistory').addEventListener('click',saveSnapshot);byId('openQuickUpdate').addEventListener('click',()=>{renderQuickUpdate();openDialog('quickUpdateModal')});byId('displayCurrencyBtn').addEventListener('click',()=>{renderCurrencyOptions();openDialog('currencyModal')});byId('settingsShortcut').addEventListener('click',()=>navigate('settingsView'));
byId('refreshPricesBtn').addEventListener('click',async()=>{await runPriceRefresh()});
byId('exportBtn').addEventListener('click',exportData);
byId('importInput').addEventListener('change',async e=>{const f=e.target.files?.[0];if(f)await importData(f);e.target.value=''});
byId('resetBtn').addEventListener('click',async()=>{if(!confirm(t('confirmDeleteAll')))return;for(const n of STORE_NAMES)await dbClear(n);await reload();toast(t('allDeleted'))});
byId('accountForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,name=f.elements.name.value.trim();if(!name)return;const raw={id:uid(),name,type:f.elements.type.value,icon:f.elements.icon.value,color:f.elements.color.value,createdAt:Date.now()};await dbPut('accounts',WorthCore.normalizeAccount(raw));f.reset();f.elements.color.value='#17181b';closeDialog('accountModal');await reload();toast(t('accountCreated'))});
byId('accountEditForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,a=accountBy(f.elements.accountId.value),name=f.elements.name.value.trim();if(!a||!name)return;const next=WorthCore.normalizeAccount({...a,name,type:f.elements.type.value,icon:f.elements.icon.value,color:f.elements.color.value,autoUpdateSource:f.elements.autoUpdateSource.value||'none',updatedAt:Date.now()});await dbPut('accounts',next);closeDialog('accountEditModal');await reload();toast(t('accountUpdated'))});
byId('assetForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,name=f.elements.name.value.trim(),code=WorthCore.cleanCode(f.elements.code.value),price=parseDecimal(f.elements.price.value);if(!name||!code||!Number.isFinite(price)||price<0)return;if(state.assets.some(a=>a.code===code)){alert(t('duplicateCode'));return}const raw={id:uid(),name,code,icon:f.elements.icon.value,color:f.elements.color.value,price,autoUpdateSource:f.elements.autoUpdateSource.value||'none',createdAt:Date.now(),updatedAt:Date.now()};await dbPut('assets',WorthCore.normalizeAsset(raw));f.reset();f.elements.color.value='#5667ff';closeDialog('assetModal');await reload();toast(t('assetCreated'))});
byId('assetEditForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,a=assetBy(f.elements.assetId.value),name=f.elements.name.value.trim(),code=WorthCore.cleanCode(f.elements.code.value);if(!a||!name||!code)return;if(state.assets.some(x=>x.id!==a.id&&x.code===code)){alert(t('duplicateCode'));return}const next=WorthCore.normalizeAsset({...a,name,code,icon:f.elements.icon.value,color:f.elements.color.value,autoUpdateSource:f.elements.autoUpdateSource.value||'none',updatedAt:Date.now()});await dbPut('assets',next);closeDialog('assetEditModal');await reload();toast(t('assetUpdated'))});
byId('positionForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;if(!state.accounts.length||!state.assets.length)return;const q=parseDecimal(f.elements.quantity.value),accountId=f.elements.accountId.value,assetId=f.elements.assetId.value,editId=f.dataset.editId,comment=String(f.elements.comment?.value||'').trim();if(!Number.isFinite(q))return;const existing=editId?state.positions.find(p=>p.id===editId):null;await dbPut('positions',{id:existing?.id||uid(),accountId,assetId,quantity:q,comment,createdAt:existing?.createdAt||Date.now(),updatedAt:Date.now()});closeDialog('positionModal');resetPositionForm();await reload();toast(t('positionSaved'))});
byId('priceForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,a=assetBy(f.elements.assetId.value),entered=parseDecimal(f.elements.price.value),currency=f.elements.priceCurrency.value||'USD',usdPrice=priceCurrencyToUsd(entered,currency);if(!a||!Number.isFinite(usdPrice)||usdPrice<0)return;a.price=usdPrice;a.updatedAt=Date.now();a.manualPriceCurrency=currency;await dbPut('assets',a);closeDialog('priceModal');await reload();toast(t('priceUpdated'))});byId('quickUpdateForm').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,btn=form.querySelector('.sheet-primary');btn.disabled=true;try{for(const i of $$('[data-asset-price]',form)){const a=assetBy(i.dataset.assetPrice),entered=parseDecimal(i.value),currency=form.querySelector(`[data-asset-price-currency="${i.dataset.assetPrice}"]`)?.value||'USD',v=priceCurrencyToUsd(entered,currency);if(a&&Number.isFinite(v)&&v>=0){a.price=v;a.manualPriceCurrency=currency;a.updatedAt=Date.now();await dbPut('assets',a)}}for(const i of $$('[data-position-qty]',form)){const p=state.positions.find(x=>x.id===i.dataset.positionQty),v=parseDecimal(i.value);if(p&&Number.isFinite(v)){p.quantity=v;p.updatedAt=Date.now();await dbPut('positions',p)}}await reload();closeDialog('quickUpdateModal');requestAnimationFrame(()=>toast(t('changesSaved')))}finally{btn.disabled=false}});window.addEventListener('resize',()=>{if(byId('historyView').classList.contains('active'))drawChart()},{passive:true})}
async function init(){try{db=await openDatabase();bindEvents();await reload();if(state.autoRefreshOnLaunch){await runPriceRefresh()}if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn))}catch(e){console.error(e);document.body.innerHTML=`<div style="padding:30px;font-family:-apple-system">${state.lang==='en'?'Could not open the local database. Check Safari website storage settings.':'Не удалось открыть локальную базу данных. Проверьте, что Safari разрешает хранение данных для этого сайта.'}</div>`}} init();
