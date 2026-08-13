(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.WorthCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const n=v=>Number(v)||0;
  const DEFAULT_ACCOUNT_COLOR='#17181b';
  const DEFAULT_ASSET_COLOR='#5667ff';
  function cleanCode(v=''){return String(v).trim().toUpperCase()}
  function codePoints(v=''){return Array.from(String(v))}
  function trimIcon(v='',fallback='•'){const x=codePoints(String(v).trim()).slice(0,5).join('');return x||fallback}
  function validColor(v){return /^#[0-9a-f]{6}$/i.test(String(v||''))}
  function defaultAccountIcon(type=''){
    const t=String(type);
    if(t.includes('Банк'))return '▥';
    if(t.includes('Бирж'))return '↗';
    if(t.includes('Долг'))return '↔';
    if(t.includes('Крипто'))return '◇';
    if(t.includes('Налич'))return '$';
    return '•';
  }
  function normalizeAccount(a){
    const x={...a};
    x.name=String(x.name||'').trim();
    x.type=String(x.type||'Другое');
    x.icon=trimIcon(x.icon,defaultAccountIcon(x.type));
    x.color=validColor(x.color)?x.color:DEFAULT_ACCOUNT_COLOR;
    return x;
  }
  function normalizeAsset(a){
    const x={...a};
    x.name=String(x.name||'').trim();
    x.code=cleanCode(x.code||x.symbol||'');
    delete x.symbol;
    x.icon=trimIcon(x.icon,x.code.slice(0,5)||'•');
    x.color=validColor(x.color)?x.color:DEFAULT_ASSET_COLOR;
    x.price=n(x.price);
    return x;
  }
  function normalizeSnapshot(s){
    const x={...s};
    if(Array.isArray(x.assets))x.assets=x.assets.map(a=>{
      const y={...a};
      y.code=cleanCode(y.code||y.symbol||'');
      delete y.symbol;
      return y;
    });
    return x;
  }
  function normalizeData(data){
    return {
      ...data,
      accounts:(data.accounts||[]).map(normalizeAccount),
      assets:(data.assets||[]).map(normalizeAsset),
      positions:(data.positions||[]).map(x=>({...x,comment:String(x.comment||'').trim()})),
      snapshots:(data.snapshots||[]).map(normalizeSnapshot)
    };
  }
  function assetBy(assets,id){return assets.find(a=>a.id===id)}
  function positionValue(position,assets){return n(position.quantity)*n(assetBy(assets,position.assetId)?.price)}
  function portfolioTotal(positions,assets){return positions.reduce((s,p)=>s+positionValue(p,assets),0)}
  function assetQuantity(assetId,positions){return positions.filter(p=>p.assetId===assetId).reduce((s,p)=>s+n(p.quantity),0)}
  function assetTotal(assetId,positions,assets){return positions.filter(p=>p.assetId===assetId).reduce((s,p)=>s+positionValue(p,assets),0)}
  function accountTotal(accountId,positions,assets){return positions.filter(p=>p.accountId===accountId).reduce((s,p)=>s+positionValue(p,assets),0)}
  function rubEquivalent(totalUsd,assets){
    const rub=assets.find(a=>cleanCode(a.code||a.symbol)==='RUB');
    const price=Number(rub?.price);
    return Number.isFinite(price)&&price>0 ? n(totalUsd)/price : 0;
  }
  function validateImport(raw){
    const stores=['accounts','assets','positions','snapshots'];
    if(!raw||typeof raw!=='object')throw new Error('Неверный файл');
    for(const name of stores)if(!Array.isArray(raw[name]))throw new Error(`Нет раздела ${name}`);
    const data=normalizeData(raw);
    const accIds=new Set(data.accounts.map(x=>x.id)), assetIds=new Set(data.assets.map(x=>x.id));
    if(data.accounts.some(a=>!a.id||!a.name))throw new Error('Повреждены счета');
    if(data.assets.some(a=>!a.id||!a.name||!a.code||!Number.isFinite(Number(a.price))||Number(a.price)<0))throw new Error('Повреждены активы');
    const codes=data.assets.map(a=>a.code);
    if(new Set(codes).size!==codes.length)throw new Error('Коды активов должны быть уникальны');
    if(data.positions.some(p=>!p.id||!accIds.has(p.accountId)||!assetIds.has(p.assetId)||!Number.isFinite(Number(p.quantity))))throw new Error('Повреждены позиции');
    if(data.snapshots.some(s=>!s.id||!Number.isFinite(Number(s.createdAt))||!Number.isFinite(Number(s.total))))throw new Error('Повреждена история');
    return data;
  }
  return {positionValue,portfolioTotal,assetQuantity,assetTotal,accountTotal,rubEquivalent,normalizeAccount,normalizeAsset,normalizeSnapshot,normalizeData,validateImport,cleanCode,trimIcon,validColor,defaultAccountIcon};
});
