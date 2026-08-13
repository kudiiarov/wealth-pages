(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.WorthCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const n=v=>Number(v)||0;
  function assetBy(assets,id){return assets.find(a=>a.id===id)}
  function positionValue(position,assets){return n(position.quantity)*n(assetBy(assets,position.assetId)?.price)}
  function portfolioTotal(positions,assets){return positions.reduce((s,p)=>s+positionValue(p,assets),0)}
  function assetQuantity(assetId,positions){return positions.filter(p=>p.assetId===assetId).reduce((s,p)=>s+n(p.quantity),0)}
  function assetTotal(assetId,positions,assets){return positions.filter(p=>p.assetId===assetId).reduce((s,p)=>s+positionValue(p,assets),0)}
  function accountTotal(accountId,positions,assets){return positions.filter(p=>p.accountId===accountId).reduce((s,p)=>s+positionValue(p,assets),0)}
  function validateImport(data){
    const stores=['accounts','assets','positions','snapshots'];
    if(!data||typeof data!=='object')throw new Error('Неверный файл');
    for(const name of stores)if(!Array.isArray(data[name]))throw new Error(`Нет раздела ${name}`);
    const accIds=new Set(data.accounts.map(x=>x.id)), assetIds=new Set(data.assets.map(x=>x.id));
    if(data.accounts.some(a=>!a.id||typeof a.name!=='string'||!a.name.trim()))throw new Error('Повреждены счета');
    if(data.assets.some(a=>!a.id||typeof a.name!=='string'||!a.name.trim()||typeof a.symbol!=='string'||!a.symbol.trim()||!Number.isFinite(Number(a.price))||Number(a.price)<0))throw new Error('Повреждены активы');
    if(data.positions.some(p=>!p.id||!accIds.has(p.accountId)||!assetIds.has(p.assetId)||!Number.isFinite(Number(p.quantity))))throw new Error('Повреждены позиции');
    if(data.snapshots.some(s=>!s.id||!Number.isFinite(Number(s.createdAt))||!Number.isFinite(Number(s.total))))throw new Error('Повреждена история');
    return true;
  }
  return {positionValue,portfolioTotal,assetQuantity,assetTotal,accountTotal,validateImport};
});
