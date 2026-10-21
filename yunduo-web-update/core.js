(function(root) {
  'use strict';
  const safe = value => Number.isSafeInteger(value) && value >= 0;
  function amount(value, allowZero=false) {
    if (!/^\d+(\.\d{1,2})?$/.test(String(value).trim())) throw new Error('金额最多两位小数。');
    const [whole,fraction=''] = String(value).trim().split('.');
    const cents = Number(whole)*100+Number(fraction.padEnd(2,'0'));
    if (!safe(cents) || (!allowZero && !cents)) throw new Error('请填写有效金额。');
    return cents;
  }
  function date(value) {if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;const d = new Date(value+'T12:00:00Z');return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === value;}
  function change(accounts,records,debts,oldId,next) {
    const aa = accounts.map(a => ({...a})), dd = debts.map(d => ({...d}));
    const old = oldId ? records.find(r => r.id === oldId) : null;
    if (oldId && !old) throw new Error('记录已不存在，请刷新。');
    function apply(record,direction) {
      if (!record) return;
      if (!safe(record.amountCents) || !record.amountCents || !date(record.date)) throw new Error('无效的金额或日期。');
      const account = aa.find(a => a.id === record.accountId);
      if (!account) throw new Error('找不到对应账户。');
      if (record.type === 'income') account.balanceCents += direction*record.amountCents;
      else if (record.type === 'expense' || record.type === 'transfer') account.balanceCents -= direction*record.amountCents;
      else throw new Error('无效的记录类型。');
      if (record.type === 'transfer') {
        const to = aa.find(a => a.id === record.toAccountId);
        if (!to || to.id === account.id) throw new Error('转入和转出必须是不同账户。');
        to.balanceCents += direction*record.amountCents;
      }
      if (record.debtId) {
        const debt = dd.find(d => d.id === record.debtId);
        if (!debt || record.type !== 'expense' || !safe(record.debtReductionCents) || record.debtReductionCents > record.amountCents) throw new Error('无效的还款关联或减少欠款金额。');
        debt.amountCents -= direction*record.debtReductionCents;
      }
    }
    apply(old,-1);apply(next,1);
    if (!aa.every(a => safe(a.balanceCents)) || !safe(aa.reduce((s,a) => s+a.balanceCents,0))) throw new Error('操作后账户余额不足或金额过大，请先检查后续账目。');
    if (!dd.every(d => safe(d.amountCents)) || !safe(dd.reduce((s,d) => s+d.amountCents,0))) throw new Error('还款减少的欠款不能超过当前待还金额。');
    const rr = records.filter(r => r.id !== oldId);if (next) rr.push({...next});
    if (!safe(rr.reduce((s,r) => s+r.amountCents,0))) throw new Error('累计金额过大。');
    return {accounts:aa,records:rr,debts:dd};
  }
  root.LedgerCore = {amount,date,change};
  if (typeof module !== 'undefined') module.exports = root.LedgerCore;
})(typeof globalThis !== 'undefined' ? globalThis : this);
