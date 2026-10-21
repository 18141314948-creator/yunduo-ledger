/* All changes are one atomic localStorage write; old v1 data stays intact. */
'use strict';
const ledgerStorage = (() => {
  const rootKey = 'dream-ledger.bundle.v2';
  const keys = ['dream-ledger.data.v1','dream-ledger.accounts.v1','dream-ledger.goals.v1','dream-ledger.goal-links.v1','dream-ledger.debts.v1','dream-ledger.budgets.v1','dream-ledger.cycle.v1','dream-ledger.categories.v1'];
  let snapshot = localStorage.getItem(rootKey);
  let data = {};
  if (snapshot !== null) {
    data = JSON.parse(snapshot);
    if (!data || typeof data !== 'object' || Array.isArray(data) || !Object.keys(data).every(k => keys.includes(k) && typeof data[k] === 'string')) throw new Error('账本数据读取失败，请保留浏览器数据。');
  } else for (const key of keys) {const value = localStorage.getItem(key);if (value !== null) data[key] = value;}
  function commit(changes, replace = false) {
    if (localStorage.getItem(rootKey) !== snapshot) throw new Error('账本已在其他页面更新，请刷新后重试。');
    const updated = replace ? {...changes} : {...data,...changes};
    if (!Object.keys(updated).every(k => keys.includes(k) && typeof updated[k] === 'string')) throw new Error('无效的保存数据');
    const next = JSON.stringify(updated);
    localStorage.setItem(rootKey,next);
    data = updated;snapshot = next;
  }
  function assertCurrent() {if (localStorage.getItem(rootKey) !== snapshot) throw new Error('账本已在其他页面更新，请刷新后继续。');}
  return {getItem:key => data[key] ?? null,setItem:(key,value) => commit({[key]:value}),commit,assertCurrent,export:() => JSON.parse(JSON.stringify(data)),keys};
})();
