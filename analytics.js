(function(root) {
  'use strict';
  const colors = ['#a695ca','#df9eaf','#8bbdb1','#d5b17d','#8baed0','#b3bd86','#b5abc0'];
  const money = n => '¥ '+(n/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
  function day(d) {return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function start(month,cycleDay,offset=0) {const [y,m] = month.split('-').map(Number);const first = new Date(y,m-1+offset,1);return new Date(first.getFullYear(),first.getMonth(),Math.min(cycleDay,new Date(first.getFullYear(),first.getMonth()+1,0).getDate()));}
  function bounds(month,cycleDay) {const end = start(month,cycleDay,1);end.setDate(end.getDate()-1);return {start:day(start(month,cycleDay)),end:day(end)};}
  function monthFor(date,cycleDay) {const month = date.slice(0,7);return date >= day(start(month,cycleDay)) ? month : day(start(month,cycleDay,-1)).slice(0,7);}
  function analyze(records,budgets,cycleDay,month) {
    const range = bounds(month,cycleDay);
    const expenses = records.filter(r => r.type === 'expense' && r.date >= range.start && r.date <= range.end);
    const total = expenses.reduce((sum,r) => sum+r.amountCents,0);
    const grouped = new Map();for (const r of expenses) grouped.set(r.category,(grouped.get(r.category)||0)+r.amountCents);
    let categories = [...grouped].map(([name,amount]) => ({name,amount})).sort((a,b) => b.amount-a.amount);
    if (categories.length > 7) categories = [...categories.slice(0,6),{name:'其他分类合计',amount:categories.slice(6).reduce((s,c) => s+c.amount,0)}];
    categories = categories.map((c,i) => ({...c,color:colors[i],ratio:total ? c.amount/total : 0,percent:total ? (c.amount/total*100).toFixed(1) : '0.0',money:money(c.amount)}));
    const [y,m,d] = range.start.split('-').map(Number);const cursor = new Date(y,m-1,d);const daily = [];
    const amounts = new Map();for (const r of expenses) amounts.set(r.date,(amounts.get(r.date)||0)+r.amountCents);
    while (day(cursor) <= range.end) {const date = day(cursor);daily.push({date,label:`${cursor.getMonth()+1}/${cursor.getDate()}`,amount:amounts.get(date)||0});cursor.setDate(cursor.getDate()+1);}
    const max = Math.max(0,...daily.map(d => d.amount));
    const trend = daily.map(d => ({...d,height:d.amount && max ? Math.max(2,Math.round(d.amount/max*140)) : 0,money:money(d.amount)}));
    const budgetRows = budgets.filter(b => b.month === month && b.type === 'expense').map(b => {
      const used = expenses.filter(r => r.budgetId === b.id).reduce((s,r) => s+r.amountCents,0);
      return {id:b.id,name:b.name,used,limit:b.amountCents,percent:Math.min(100,Math.round(used/b.amountCents*100)),usedMoney:money(used),limitMoney:money(b.amountCents),remaining:used > b.amountCents ? '超出 '+money(used-b.amountCents) : '剩余 '+money(b.amountCents-used),over:used>b.amountCents};
    });
    const unlinked = expenses.filter(r => !budgetRows.some(b => b.id === r.budgetId)).reduce((s,r) => s+r.amountCents,0);
    return {month,start:range.start,end:range.end,total,totalMoney:money(total),count:expenses.length,averageMoney:money(Math.round(total/daily.length)),peakMoney:money(max),categories,daily:trend,budgets:budgetRows,unlinkedMoney:money(unlinked),unlinked,hasData:!!expenses.length};
  }
  const api = {analyze,bounds,monthFor,day,start,colors};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LedgerCharts = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
