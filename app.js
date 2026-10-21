'use strict';
const today = new Date();
document.getElementById('month').textContent = `${today.getFullYear()} 年 ${today.getMonth() + 1} 月 · 慢慢记录每一天`;
const storageKey = 'dream-ledger.data.v1';
const kinds = {wechat:'💚', alipay:'💙', pocket:'🌷', yuebao:'🌱', fund:'📈', bank:'💳'};
const defaultNames = {wechat:'微信钱包', alipay:'支付宝余额', pocket:'小荷包', yuebao:'余额宝', fund:'基金', bank:'银行卡'};
const status = document.getElementById('status');
const form = document.getElementById('account-form');
const dialog = document.getElementById('account-dialog');
let accounts = [];
let records = [];
let loadedSnapshot = null;
let storageReadable = true;
function validAccounts(value) {
  return Array.isArray(value) && value.every(a => a && typeof a.id === 'string' && Object.hasOwn(kinds,a.type) && typeof a.name === 'string' && a.name.trim().length > 0 && a.name.length <= 40 && Number.isSafeInteger(a.balanceCents) && a.balanceCents >= 0) && Number.isSafeInteger(value.reduce((sum,a) => sum+a.balanceCents,0));
}
try {
  const stored = ledgerStorage.getItem(storageKey);
  loadedSnapshot = stored;
  if (stored !== null) {
    const parsed = JSON.parse(stored);
    if (!validAccounts(parsed.accounts) || !Array.isArray(parsed.records) || !parsed.records.every(r => r && ['expense','income','transfer'].includes(r.type) && (r.type !== 'transfer' || (r.toAccountId !== r.accountId && parsed.accounts.some(a => a.id === r.toAccountId))) && Number.isSafeInteger(r.amountCents) && r.amountCents > 0 && typeof r.category === 'string' && typeof r.note === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && parsed.accounts.some(a => a.id === r.accountId))) throw new Error('Invalid ledger data');
    accounts = parsed.accounts;
    records = parsed.records;
  } else {
    const old = ledgerStorage.getItem('dream-ledger.accounts.v1');
    if (old !== null) {
      const parsed = JSON.parse(old);
      if (!validAccounts(parsed)) throw new Error('Invalid account data');
      accounts = parsed;
    }
  }
  accounts = accounts.map(account => account.type === 'pocket' && ['独立小金库','小金库'].includes(account.name) ? {...account,name:'小荷包'} : account);
} catch {
  storageReadable = false;
  status.textContent = '暂时无法读取本地账户数据，请保留浏览器数据并联系我排查。';
  document.getElementById('add-account').disabled = true;
}
function money(cents) {return '¥ ' + (cents/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});}
let savingsGoals = [];
const goalLinksKey = 'dream-ledger.goal-links.v1';
let goalLinks = {};
let goalLinksSnapshot = null;
let goalLinksReadable = true;
try {
  goalLinksSnapshot = ledgerStorage.getItem(goalLinksKey);
  if (goalLinksSnapshot !== null) {
    const saved = JSON.parse(goalLinksSnapshot);
    if (!saved || typeof saved !== 'object' || Array.isArray(saved) || !Object.values(saved).every(ids => Array.isArray(ids) && ids.every(id => typeof id === 'string'))) throw new Error('Invalid goal links');
    goalLinks = saved;
  }
} catch {goalLinksReadable = false;}
const goalsKey = 'dream-ledger.goals.v1';
let goalsSnapshot = null;
function validGoalDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value+'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
}
try {
  goalsSnapshot = ledgerStorage.getItem(goalsKey);
  if (goalsSnapshot !== null) {
    const saved = JSON.parse(goalsSnapshot);
    if (!Array.isArray(saved) || !saved.every(g => g && typeof g.name === 'string' && g.name.trim() && g.name.length <= 60 && Number.isSafeInteger(g.targetCents) && g.targetCents > 0 && validGoalDate(g.deadline) && Array.isArray(g.accountIds) && g.accountIds.every(id => typeof id === 'string'))) throw new Error('Invalid goals');
    savingsGoals = saved;
    goalLinksReadable = true;
  }
} catch {goalLinksReadable = false;}
document.getElementById('add-goal').disabled = !storageReadable || !goalLinksReadable;
document.getElementById('add-goal').addEventListener('click',() => openGoalAccounts(null));
let editingGoal = null;
let goalCheckboxes = [];
function linkedAccounts(goal, index) {
  if (Array.isArray(goal.accountIds)) return accounts.filter(a => goal.accountIds.includes(a.id));
  return Object.hasOwn(goalLinks,index) ? accounts.filter(a => goalLinks[index].includes(a.id)) : accounts.filter(a => goal.accounts.includes(a.name.trim()));
}
function openGoalAccounts(index) {
  editingGoal = index;
  const goal = index === null ? null : savingsGoals[index];
  const selected = goal ? linkedAccounts(goal,index).map(a => a.id) : [];
  document.getElementById('goal-dialog-title').textContent = goal ? '编辑储蓄目标' : '添加储蓄目标';
  document.getElementById('goal-name').value = goal?.name || '';
  document.getElementById('goal-amount').value = goal ? (goal.targetCents/100).toFixed(2) : '';
  document.getElementById('goal-date').value = goal?.deadline || '';
  document.getElementById('goal-error').textContent = '';
  const list = document.getElementById('goal-account-options');list.replaceChildren();
  goalCheckboxes = accounts.map(a => {
    const label = document.createElement('label');label.className = 'goal-option';
    const input = document.createElement('input');input.type = 'checkbox';input.value = a.id;input.checked = selected.includes(a.id);
    const text = document.createElement('span');text.textContent = `${a.name} · ${money(a.balanceCents)}`;
    label.append(input,text);list.append(label);return input;
  });
  if (!accounts.length) {const empty = document.createElement('p');empty.textContent = '请先添加账户。';list.append(empty);}
  document.getElementById('goal-dialog').showModal();
}
document.getElementById('cancel-goal').addEventListener('click',() => document.getElementById('goal-dialog').close());
document.getElementById('goal-form').addEventListener('submit',event => {
  event.preventDefault();
  const error = document.getElementById('goal-error');
  const name = document.getElementById('goal-name').value.trim();
  const amount = document.getElementById('goal-amount').value.trim();
  const deadline = document.getElementById('goal-date').value;
  if (!name || name.length > 60) {error.textContent = '请填写目标名称，最多 60 个字。';return;}
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) {error.textContent = '请填写正数目标金额，最多两位小数。';return;}
  const [whole,fraction=''] = amount.split('.');
  const targetCents = Number(whole)*100+Number(fraction.padEnd(2,'0'));
  if (!Number.isSafeInteger(targetCents) || targetCents <= 0) {error.textContent = '请填写有效的正数目标金额。';return;}
  if (!validGoalDate(deadline)) {error.textContent = '请选择有效的目标日期。';return;}
  const updated = savingsGoals.map((goal,index) => ({...goal,accountIds:linkedAccounts(goal,index).map(a => a.id)}));
  const goal = {name,targetCents,deadline,accountIds:goalCheckboxes.filter(input => input.checked).map(input => input.value)};
  if (editingGoal === null) updated.push(goal);else updated[editingGoal] = goal;
  try {
    if (!goalLinksReadable) throw new Error('无法读取关联设置，请保留浏览器数据并联系我排查。');
    if (ledgerStorage.getItem(goalsKey) !== goalsSnapshot || (goalsSnapshot === null && ledgerStorage.getItem(goalLinksKey) !== goalLinksSnapshot)) throw new Error('目标已在其他页面更新，请刷新后重试。');
    const snapshot = JSON.stringify(updated);
    ledgerStorage.setItem(goalsKey,snapshot);
    goalsSnapshot = snapshot;
  } catch (e) {error.textContent = e.message || '保存失败，请重试。';return;}
  savingsGoals = updated;renderGoals();document.getElementById('goal-dialog').close();
  status.textContent = '储蓄目标已保存。';
});
function renderGoals() {
  const container = document.getElementById('goal-list');
  container.replaceChildren();
  const now = new Date();
  for (const [index,goal] of savingsGoals.entries()) {
    const linked = linkedAccounts(goal,index);
    const custom = Array.isArray(goal.accountIds) || Object.hasOwn(goalLinks,index);
    const missing = custom ? [] : goal.accounts.filter(name => !linked.some(a => a.name.trim() === name));
    const current = linked.reduce((sum,a) => sum+a.balanceCents,0);
    const remaining = Math.max(0,goal.targetCents-current);
    const percent = Math.min(100,Math.floor(current/goal.targetCents*100));
    const [year,month,day] = goal.deadline.split('-').map(Number);
    const months = Math.max(0,(year-now.getFullYear())*12+month-1-now.getMonth()+1);
    const overdue = new Date(year,month-1,day,23,59,59,999) < now;
    const card = document.createElement('article');card.className = 'goal-card';
    const title = document.createElement('h3');title.textContent = '🌟 '+goal.name;
    const total = document.createElement('p');total.className = 'goal-total';total.textContent = `${money(current)} / ${money(goal.targetCents)}`;
    const progress = document.createElement('progress');progress.max = goal.targetCents;progress.value = Math.min(current,goal.targetCents);progress.setAttribute('aria-label',goal.name+'储蓄进度');
    const info = document.createElement('p');info.className = 'form-hint';info.textContent = `${percent}% · 目标日期 ${year} 年 ${month} 月 ${day} 日`;
    const suggestion = document.createElement('p');suggestion.className = 'goal-suggestion';
    suggestion.textContent = remaining === 0 ? '心愿已达成，继续好好照顾这份积攒 🌷' : `还差 ${money(remaining)}${overdue ? ' · 目标日期已过' : ` · 平均每月再存 ${money(Math.ceil(remaining/Math.max(1,months)))}`}`;
    const note = document.createElement('p');note.className = 'form-hint';note.textContent = '关联账户：'+(custom ? (linked.map(a => a.name).join(' ＋ ') || '尚未选择') : goal.accounts.join(' ＋ '))+(missing.length ? '。未找到：'+missing.join('、')+'，可点击“选择账户”手动关联。' : '。');
    const basis = document.createElement('p');basis.className = 'form-hint';basis.textContent = '每月建议按含本月和目标月的剩余月份计算，不含收益预测。';
    const choose = document.createElement('button');choose.type = 'button';choose.textContent = '编辑目标 / 关联账户';choose.disabled = !storageReadable || !goalLinksReadable;choose.addEventListener('click',() => openGoalAccounts(index));
    if (!goalLinksReadable) {note.textContent += ' 关联设置读取失败，请保留浏览器数据并联系我排查。';}
    card.append(title,total,progress,info,suggestion,note,basis,choose);container.append(card);
  }
}
function render() {
  renderBudgets();
  renderDebts();
  document.getElementById('add-income').disabled = !storageReadable || !accounts.length;
  document.getElementById('add-transfer').disabled = !storageReadable || accounts.length < 2;
  renderGoals();
  document.getElementById('add-expense').disabled = !storageReadable || !accounts.length;
  const month = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  document.getElementById('monthly-spending').textContent = money(records.filter(r => r.type === 'expense' && inCycle(r.date,currentMonth())).reduce((sum,r) => sum+r.amountCents,0));
  document.getElementById('month').textContent = cycleLabel(currentMonth());
  const recordList = document.getElementById('record-list');
  recordList.replaceChildren();
  if (!records.length) {
    const empty = document.createElement('p');empty.className = 'empty';empty.textContent = '还没有记录，记下生活的第一笔吧 🌷';recordList.append(empty);
  }
  for (const record of [...records].reverse().sort((a,b) => b.date.localeCompare(a.date))) {
    const row = document.createElement('div');row.className = 'account-row';
    const detail = document.createElement('div');detail.className = 'account-label';
    const title = document.createElement('div');title.textContent = record.category;
    const subtitle = document.createElement('small');subtitle.textContent = `${record.date} · ${accounts.find(a => a.id === record.accountId)?.name || '账户'}${record.type === 'transfer' ? ' → '+(accounts.find(a => a.id === record.toAccountId)?.name || '账户') : ''}${record.note ? ' · '+record.note : ''}`;
    detail.append(title,subtitle);
    const amount = document.createElement('strong');amount.textContent = (record.type === 'income' ? '＋ ' : record.type === 'transfer' ? '↔ ' : '− ')+money(record.amountCents);
    if (record.type === 'expense') {
      const budget = budgets.find(b => b.id === record.budgetId);
      const note = document.createElement('small');note.textContent = budget ? `预算：${budget.name}${inCycle(record.date,budget.month) ? '' : '（周期已变更，请重新关联）'}` : '预算：未关联';detail.append(note);
      const link = document.createElement('button');link.type = 'button';link.textContent = '关联预算';link.addEventListener('click',() => openRecordBudget(record.id));detail.append(link);
    }
    row.append(detail,amount);recordList.append(row);
    if (typeof decorateRecord === 'function') decorateRecord(record,row,detail);
  }
  document.getElementById('total-assets').textContent = money(accounts.reduce((sum,a) => sum+a.balanceCents,0));
  document.getElementById('account-summary').textContent = accounts.length ? `${accounts.length} 个账户 · 一点点积攒小幸福 ✨` : '从添加第一个账户开始 ✨';
  const list = document.getElementById('account-list');
  list.replaceChildren();
  if (!accounts.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.innerHTML = '<div class="symbol">👛</div><h3>给每一份余额安个家</h3><p>点击“添加账户”，记录你的第一个账户。</p>';
    list.append(empty);
  }
  for (const account of accounts) {
    const row = document.createElement('div'); row.className = 'account-row';
    const icon = document.createElement('span'); icon.className = 'account-icon'; icon.textContent = kinds[account.type];
    const name = document.createElement('span'); name.className = 'account-label'; name.textContent = account.name;
    const balance = document.createElement('strong'); balance.textContent = money(account.balanceCents);
    row.append(icon,name,balance); list.append(row);
  }
}
document.getElementById('add-account').addEventListener('click',() => {
  form.reset();
  document.getElementById('account-name').value = defaultNames[document.getElementById('account-type').value];
  document.getElementById('form-error').textContent = '';
  dialog.showModal();
});
document.getElementById('account-type').addEventListener('change',() => {
  const nameInput = document.getElementById('account-name');
  if (!nameInput.value.trim() || Object.values(defaultNames).includes(nameInput.value.trim())) {
    nameInput.value = defaultNames[document.getElementById('account-type').value];
  }
});
document.getElementById('cancel-account').addEventListener('click',() => dialog.close());
form.addEventListener('submit',event => {
  event.preventDefault();
  const error = document.getElementById('form-error');
  const name = document.getElementById('account-name').value.trim();
  const amount = document.getElementById('account-balance').value.trim();
  if (!name) {error.textContent = '请填写账户名称。';return;}
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) {error.textContent = '请填写非负金额，最多两位小数，例如 128.50。';return;}
  const [whole,fraction = ''] = amount.split('.');
  const balanceCents = Number(whole)*100+Number(fraction.padEnd(2,'0'));
  const updated = [...accounts,{id:crypto.randomUUID(),type:document.getElementById('account-type').value,name,balanceCents}];
  if (!validAccounts(updated)) {error.textContent = '金额太大，请检查后重新填写。';return;}
  try {
    if (!storageReadable) throw new Error('Storage unavailable');
    saveLedger(updated, records);
  } catch (e) {error.textContent = e.message;return;}
  accounts = updated; render(); dialog.close(); status.textContent = `已保存“${name}”，刷新页面后仍会保留。`;
});
function saveLedger(nextAccounts, nextRecords) {
  if (!storageReadable) throw new Error('本地存储不可用，请保留填写内容。');
  if (ledgerStorage.getItem(storageKey) !== loadedSnapshot) throw new Error('账本已在其他页面更新，请刷新后再记账。');
  const snapshot = JSON.stringify({accounts:nextAccounts,records:nextRecords});
  try {ledgerStorage.setItem(storageKey,snapshot);} catch {throw new Error('保存失败，请检查浏览器存储空间和权限，填写内容已保留。');}
  loadedSnapshot = snapshot;
}
const expenseDialog = document.getElementById('expense-dialog');
const expenseForm = document.getElementById('expense-form');
let editingExpense = null;
document.getElementById('add-expense').addEventListener('click',() => {
  expenseForm.reset();
  editingExpense = null;
  if (typeof prepareExpenseExtras === 'function') prepareExpenseExtras();
  const select = document.getElementById('expense-account');select.replaceChildren();
  for (const a of accounts) {const option = document.createElement('option');option.value = a.id;option.textContent = `${a.name} · ${money(a.balanceCents)}`;select.append(option);}
  const now = new Date();
  document.getElementById('expense-date').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  document.getElementById('expense-error').textContent = '';
  populateExpenseBudgets();
  expenseDialog.showModal();
});
document.getElementById('cancel-expense').addEventListener('click',() => expenseDialog.close());
expenseForm.addEventListener('submit',async event => {
  event.preventDefault();
  const error = document.getElementById('expense-error');
  const amount = document.getElementById('expense-amount').value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) {error.textContent = '请输入大于零的金额，最多两位小数。';return;}
  const [whole,fraction=''] = amount.split('.');
  const cents = Number(whole)*100+Number(fraction.padEnd(2,'0'));
  if (!Number.isSafeInteger(cents) || cents <= 0) {error.textContent = '请输入有效的正数金额。';return;}
  const account = accounts.find(a => a.id === document.getElementById('expense-account').value);
  if (!account) {error.textContent = '请选择付款账户。';return;}
  const date = document.getElementById('expense-date').value;
  const parsedDate = new Date(date+'T12:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0,10) !== date) {error.textContent = '请选择有效日期。';return;}
  const category = document.getElementById('expense-category').value;
  const budgetId = document.getElementById('expense-budget').value;
  if (!budgetsReadable || !cycleReadable || !budgets.some(b => b.id === budgetId && b.type === 'expense' && inCycle(date,b.month))) {error.textContent = '请先为支出日期所在周期添加预算，并选择关联项目。';return;}
  const record = {id:editingExpense || crypto.randomUUID(),type:'expense',accountId:account.id,amountCents:cents,category,date,budgetId,note:document.getElementById('expense-note').value.trim()};
  const button = expenseForm.querySelector('button[type="submit"]');button.disabled = true;
  try {await completeExpense(record);applyRecordChange(editingExpense,record);} catch(e) {error.textContent = e.message;return;} finally {button.disabled = false;}
  editingExpense = null;render();expenseDialog.close();
  status.textContent = `已记录支出 ${money(cents)}，并从“${account.name}”扣除。`;
});
const debtKey = 'dream-ledger.debts.v1';
const debtTypes = {huabei:'花呗',credit:'信用卡',loan:'贷款'};
let debts = [];
let debtSnapshot = null;
let debtsReadable = true;
let editingDebt = null;
try {
  debtSnapshot = ledgerStorage.getItem(debtKey);
  if (debtSnapshot !== null) {
    const saved = JSON.parse(debtSnapshot);
    if (!Array.isArray(saved) || !saved.every(d => d && typeof d.id === 'string' && Object.hasOwn(debtTypes,d.type) && typeof d.name === 'string' && d.name.trim() && d.name.length <= 60 && Number.isSafeInteger(d.amountCents) && d.amountCents >= 0 && validGoalDate(d.date)) || !Number.isSafeInteger(saved.reduce((sum,d) => sum+d.amountCents,0))) throw new Error('Invalid debts');
    debts = saved;
  }
} catch {debtsReadable = false;document.getElementById('debt-status').textContent = '负债数据读取失败，请保留浏览器数据并联系我排查。';}
function renderDebts() {
  const sum = debts.reduce((total,d) => total+d.amountCents,0);
  document.getElementById('debt-total').textContent = debtsReadable ? money(sum) : '暂不可用';
  document.getElementById('net-assets').textContent = debtsReadable && storageReadable ? money(accounts.reduce((total,a) => total+a.balanceCents,0)-sum) : '暂不可用';
  document.getElementById('add-debt').disabled = !debtsReadable;
  const list = document.getElementById('debt-list');list.replaceChildren();
  if (!debts.length && debtsReadable) {const empty = document.createElement('p');empty.className = 'form-hint';empty.textContent = '还没有登记负债，可以添加花呗、信用卡或贷款。';list.append(empty);}
  const now = new Date();const localDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  for (const debt of [...debts].sort((a,b) => a.date.localeCompare(b.date))) {
    const row = document.createElement('div');row.className = 'account-row';
    const detail = document.createElement('div');detail.className = 'account-label';
    const name = document.createElement('div');name.textContent = debt.name;
    const subtitle = document.createElement('small');subtitle.textContent = `${debtTypes[debt.type]} · 还款日期 ${debt.date} · ${debt.amountCents === 0 ? '已结清' : debt.date < localDate ? '已过还款日期，请核对账单' : debt.date === localDate ? '今天到期' : '待还'}`;
    detail.append(name,subtitle);
    const amount = document.createElement('strong');amount.textContent = money(debt.amountCents);
    const edit = document.createElement('button');edit.type = 'button';edit.textContent = '修改';edit.addEventListener('click',() => openDebt(debt.id));
    row.append(detail,amount,edit);list.append(row);
  }
}
function openDebt(id = null) {
  editingDebt = id;
  const debt = debts.find(d => d.id === id);
  document.getElementById('debt-dialog-title').textContent = debt ? '修改负债' : '添加负债';
  document.getElementById('debt-type').value = debt?.type || 'huabei';
  document.getElementById('debt-name').value = debt?.name || '花呗';
  document.getElementById('debt-amount').value = debt ? (debt.amountCents/100).toFixed(2) : '';
  document.getElementById('debt-date').value = debt?.date || '';
  document.getElementById('debt-error').textContent = '';
  document.getElementById('debt-dialog').showModal();
}
document.getElementById('add-debt').addEventListener('click',() => openDebt());
document.getElementById('cancel-debt').addEventListener('click',() => document.getElementById('debt-dialog').close());
document.getElementById('debt-type').addEventListener('change',() => {
  const name = document.getElementById('debt-name');
  if (!name.value.trim() || Object.values(debtTypes).includes(name.value.trim())) name.value = debtTypes[document.getElementById('debt-type').value];
});
document.getElementById('debt-form').addEventListener('submit',event => {
  event.preventDefault();
  const error = document.getElementById('debt-error');
  const type = document.getElementById('debt-type').value;
  const name = document.getElementById('debt-name').value.trim();
  const amount = document.getElementById('debt-amount').value.trim();
  const date = document.getElementById('debt-date').value;
  if (!Object.hasOwn(debtTypes,type) || !name || name.length > 60) {error.textContent = '请选择类型并填写名称，名称最多 60 个字。';return;}
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) {error.textContent = '请填写非负金额，最多两位小数。';return;}
  const [whole,fraction=''] = amount.split('.');const amountCents = Number(whole)*100+Number(fraction.padEnd(2,'0'));
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) {error.textContent = '请检查金额是否正确。';return;}
  if (!validGoalDate(date)) {error.textContent = '请选择有效的还款日期。';return;}
  const debt = {id:editingDebt || crypto.randomUUID(),type,name,amountCents,date};
  const updated = editingDebt ? debts.map(d => d.id === editingDebt ? debt : d) : [...debts,debt];
  if (!Number.isSafeInteger(updated.reduce((sum,d) => sum+d.amountCents,0))) {error.textContent = '负债总金额过大，请检查。';return;}
  try {
    if (!debtsReadable) throw new Error('无法读取负债数据，请保留浏览器数据。');
    if (ledgerStorage.getItem(debtKey) !== debtSnapshot) throw new Error('负债已在其他页面修改，请刷新后重试。');
    const snapshot = JSON.stringify(updated);ledgerStorage.setItem(debtKey,snapshot);debtSnapshot = snapshot;
  } catch(e) {error.textContent = '保存失败：'+e.message;return;}
  debts = updated;renderDebts();document.getElementById('debt-dialog').close();
  status.textContent = '负债已保存，账户余额未发生变动。';
});
let movementType = 'income';
let editingMovement = null;
function openMovement(type) {
  editingMovement = null;
  movementType = type;
  document.getElementById('movement-form').reset();
  if (typeof prepareMovementExtras === 'function') prepareMovementExtras(type);
  document.getElementById('movement-title').textContent = type === 'income' ? '记一笔收入' : '账户之间转账';
  document.getElementById('movement-account-label').textContent = type === 'income' ? '收款账户' : '转出账户';
  document.getElementById('movement-destination-label').hidden = type !== 'transfer';
  document.getElementById('movement-category-label').hidden = type !== 'income';
  for (const id of ['movement-account','movement-destination']) {
    const select = document.getElementById(id);select.replaceChildren();
    for (const account of accounts) {
      const option = document.createElement('option');option.value = account.id;option.textContent = `${account.name} · ${money(account.balanceCents)}`;select.append(option);
    }
  }
  if (accounts.length > 1) document.getElementById('movement-destination').value = accounts[1].id;
  const now = new Date();document.getElementById('movement-date').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  document.getElementById('movement-error').textContent = '';
  document.getElementById('movement-dialog').showModal();
}
document.getElementById('add-income').addEventListener('click',() => openMovement('income'));
document.getElementById('add-transfer').addEventListener('click',() => openMovement('transfer'));
document.getElementById('cancel-movement').addEventListener('click',() => document.getElementById('movement-dialog').close());
document.getElementById('movement-form').addEventListener('submit',async event => {
  event.preventDefault();
  const error = document.getElementById('movement-error');
  const amount = document.getElementById('movement-amount').value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) {error.textContent = '请输入正数金额，最多两位小数。';return;}
  const [whole,fraction=''] = amount.split('.');const cents = Number(whole)*100+Number(fraction.padEnd(2,'0'));
  if (!Number.isSafeInteger(cents) || cents <= 0) {error.textContent = '请输入有效的正数金额。';return;}
  const accountId = document.getElementById('movement-account').value;
  const toAccountId = document.getElementById('movement-destination').value;
  const account = accounts.find(a => a.id === accountId);
  if (!account) {error.textContent = '请选择账户。';return;}
  if (movementType === 'transfer') {
    if (accountId === toAccountId || !accounts.some(a => a.id === toAccountId)) {error.textContent = '请选择不同的转出和转入账户。';return;}
  }
  const date = document.getElementById('movement-date').value;
  if (!validGoalDate(date)) {error.textContent = '请选择有效日期。';return;}
  const record = {id:editingMovement || crypto.randomUUID(),type:movementType,accountId,amountCents:cents,date,category:movementType === 'income' ? document.getElementById('movement-category').value : '🔄 转账',note:document.getElementById('movement-note').value.trim()};
  if (movementType === 'transfer') record.toAccountId = toAccountId;
  const button = document.querySelector('#movement-form button[type="submit"]');button.disabled = true;
  try {record.photo = await readRecordPhoto('movement',editingMovement);applyRecordChange(editingMovement,record);} catch(e) {error.textContent = e.message;return;} finally {button.disabled = false;}
  editingMovement = null;render();document.getElementById('movement-dialog').close();
  status.textContent = movementType === 'income' ? '收入已保存，收款账户余额已增加。' : '转账已保存，不计入本月支出。';
});
const budgetKey = 'dream-ledger.budgets.v1';
let budgets = [];
let budgetSnapshot = null;
let budgetsReadable = true;
let editingBudget = null;
let editingBudgetMonth = '';
const cycleKey = 'dream-ledger.cycle.v1';
let cycleDay = 20;
let cycleSnapshot = null;
let cycleReadable = true;
try {cycleSnapshot = ledgerStorage.getItem(cycleKey);if (cycleSnapshot !== null) {const saved = JSON.parse(cycleSnapshot);if (!Number.isInteger(saved) || saved < 1 || saved > 31) throw new Error('Invalid cycle');cycleDay = saved;}} catch {cycleReadable = false;}
function dateString(date) {return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function cycleStart(month,offset=0) {const [year,m] = month.split('-').map(Number);const first = new Date(year,m-1+offset,1);return new Date(first.getFullYear(),first.getMonth(),Math.min(cycleDay,new Date(first.getFullYear(),first.getMonth()+1,0).getDate()));}
function cycleBounds(month) {const start = cycleStart(month);const end = cycleStart(month,1);end.setDate(end.getDate()-1);return {start:dateString(start),end:dateString(end)};}
function inCycle(date,month) {const range = cycleBounds(month);return date >= range.start && date <= range.end;}
function monthForDate(date) {const month = date.slice(0,7);return date >= dateString(cycleStart(month)) ? month : dateString(new Date(Number(month.slice(0,4)),Number(month.slice(5,7))-2,1)).slice(0,7);}
function cycleLabel(month) {const range = cycleBounds(month);return `${range.start} 至 ${range.end}`;}
const currentMonth = () => monthForDate(dateString(new Date()));
document.getElementById('budget-month').value = currentMonth();
try {
  budgetSnapshot = ledgerStorage.getItem(budgetKey);
  if (budgetSnapshot !== null) {
    const saved = JSON.parse(budgetSnapshot);
    if (!Array.isArray(saved) || !saved.every(b => b && typeof b.id === 'string' && ['income','expense'].includes(b.type) && typeof b.name === 'string' && b.name.trim() && b.name.length <= 60 && Number.isSafeInteger(b.amountCents) && b.amountCents > 0 && validGoalDate(b.month+'-01') && (b.date === '' || (b.type === 'income' && validGoalDate(b.date)))) || new Set(saved.map(b => b.id)).size !== saved.length || !Number.isSafeInteger(saved.reduce((sum,b) => sum+b.amountCents,0))) throw new Error('Invalid budgets');
    budgets = saved;
  }
} catch {budgetsReadable = false;document.getElementById('budget-status').textContent = '预算数据读取失败，请保留浏览器数据并联系我排查。';}
function budgetTotals(month) {
  const items = budgets.filter(b => b.month === month);
  return {income:items.filter(b => b.type === 'income').reduce((sum,b) => sum+b.amountCents,0),expense:items.filter(b => b.type === 'expense').reduce((sum,b) => sum+b.amountCents,0),actual:records.filter(r => r.type === 'expense' && inCycle(r.date,month)).reduce((sum,r) => sum+r.amountCents,0)};
}
function saveBudgets(updated) {
  if (!Number.isSafeInteger(updated.reduce((sum,b) => sum+b.amountCents,0))) throw new Error('预算总额过大，请检查。');
  if (!budgetsReadable) throw new Error('预算数据不可用，请保留浏览器数据。');
  if (ledgerStorage.getItem(budgetKey) !== budgetSnapshot) throw new Error('预算已在其他页面更新，请刷新后重试。');
  const snapshot = JSON.stringify(updated);ledgerStorage.setItem(budgetKey,snapshot);budgetSnapshot = snapshot;budgets = updated;
}
function renderBudgets() {
  document.getElementById('cycle-range').textContent = cycleReadable ? '周期：'+cycleLabel(document.getElementById('budget-month').value || currentMonth()) : '周期设置读取失败，请保留数据并联系我排查。';
  document.getElementById('add-budget').disabled = !budgetsReadable;
  const home = budgetTotals(currentMonth());
  document.getElementById('budget-expense-total').textContent = budgetsReadable ? (home.expense ? money(home.expense) : '尚未设置') : '暂不可用';
  document.getElementById('budget-home-summary').textContent = budgetsReadable ? `预算收入 ${money(home.income)}${home.expense && storageReadable ? ' · '+(home.actual > home.expense ? '已超支 '+money(home.actual-home.expense) : '剩余 '+money(home.expense-home.actual)) : ''}` : '预算数据读取失败';
  const month = document.getElementById('budget-month').value;
  if (!validGoalDate(month+'-01')) return;
  const totals = budgetTotals(month);
  const summary = document.getElementById('budget-summary');summary.replaceChildren();
  for (const [label,value] of [['预算收入',totals.income],['预算支出',totals.expense],['计划结余',totals.income-totals.expense]]) {
    const item = document.createElement('p');item.textContent = label;const amount = document.createElement('strong');amount.textContent = budgetsReadable ? money(value) : '暂不可用';item.append(amount);summary.append(item);
  }
  const warning = document.getElementById('budget-warning');
  warning.textContent = !budgetsReadable ? '无法读取预算，暂不能计算提醒。' : !storageReadable ? '实际收支读取失败，暂不能计算支出提醒。' : !totals.expense ? '添加支出预算后，这里会显示剩余额度和超支提醒。' : totals.actual > totals.expense ? `支出已超预算 ${money(totals.actual-totals.expense)}，可以先减少非必要开销。` : `已支出 ${money(totals.actual)}，还可支出 ${money(totals.expense-totals.actual)}。${totals.actual >= totals.expense*.8 ? '预算已使用至少 80%，留意后续开销。' : ''}`;
  if (budgetsReadable && totals.expense > totals.income) warning.textContent += ` 计划支出比计划收入多 ${money(totals.expense-totals.income)}，可调整项目或安排已有存款。`;
  const unlinked = records.filter(r => r.type === 'expense' && inCycle(r.date,month) && !budgets.some(b => b.id === r.budgetId && b.type === 'expense' && b.month === month)).reduce((sum,r) => sum+r.amountCents,0);
  if (unlinked) warning.textContent += ` 其中 ${money(unlinked)} 尚未关联本期预算，请在记录中补选；这部分已计入周期总支出。`;
  for (const type of ['income','expense']) {
    const list = document.getElementById(`budget-${type}-list`);list.replaceChildren();
    const items = budgets.filter(b => b.month === month && b.type === type);
    if (!items.length) {const empty = document.createElement('p');empty.className = 'form-hint';empty.textContent = '这个月还没有项目。';list.append(empty);}
    for (const budget of items) {
      const row = document.createElement('div');row.className = 'budget-row';
      const detail = document.createElement('div');detail.className = 'account-label';detail.textContent = budget.name;
      if (type === 'income') {const date = document.createElement('small');date.textContent = budget.date ? '预计到账 '+budget.date+(inCycle(budget.date,month) ? '' : '（不在当前周期，请修改）') : '未设置收入日期';detail.append(date);}
      const amount = document.createElement('strong');amount.textContent = money(budget.amountCents);
      if (type === 'expense') {const used = records.filter(r => r.type === 'expense' && r.budgetId === budget.id && inCycle(r.date,month)).reduce((sum,r) => sum+r.amountCents,0);const usage = document.createElement('small');usage.textContent = `已用 ${money(used)} · ${used > budget.amountCents ? '超出 '+money(used-budget.amountCents) : '剩余 '+money(budget.amountCents-used)}`;detail.append(usage);}
      const actions = document.createElement('div');actions.className = 'record-actions';
      const edit = document.createElement('button');edit.type = 'button';edit.textContent = '修改';edit.addEventListener('click',() => openBudget(budget.id));
      const remove = document.createElement('button');remove.type = 'button';remove.textContent = '删除';
      remove.addEventListener('click',() => {
        if (records.some(r => r.budgetId === budget.id)) {document.getElementById('budget-status').textContent = '该项目已有关联支出，请先将支出关联到其他预算后再删除。';return;}
        if (!window.confirm(`删除“${budget.name}”这个预算项目？不会影响实际账目。`)) return;
        try {saveBudgets(budgets.filter(b => b.id !== budget.id));renderBudgets();document.getElementById('budget-status').textContent = '预算项目已删除。';} catch(e) {document.getElementById('budget-status').textContent = '删除失败：'+e.message;}
      });
      actions.append(edit,remove);row.append(detail,amount,actions);list.append(row);
    }
  }
}
function openBudget(id = null) {
  const budget = budgets.find(b => b.id === id);
  editingBudget = id;editingBudgetMonth = budget?.month || document.getElementById('budget-month').value;
  if (!validGoalDate(editingBudgetMonth+'-01')) {document.getElementById('budget-status').textContent = '请先选择有效的预算月份。';return;}
  document.getElementById('budget-dialog-title').textContent = budget ? '修改预算项目' : '添加预算项目';
  document.getElementById('budget-type').value = budget?.type || 'income';
  document.getElementById('budget-name').value = budget?.name || '';
  document.getElementById('budget-amount').value = budget ? (budget.amountCents/100).toFixed(2) : '';
  document.getElementById('budget-date').value = budget?.date || '';
  document.getElementById('budget-date').min = cycleBounds(editingBudgetMonth).start;
  const [y,m] = editingBudgetMonth.split('-').map(Number);
  document.getElementById('budget-date').max = cycleBounds(editingBudgetMonth).end;
  document.getElementById('budget-date-label').hidden = budget?.type === 'expense';
  document.getElementById('budget-form-month').textContent = '所属月份：'+editingBudgetMonth;
  document.getElementById('budget-error').textContent = '';
  document.getElementById('budget-dialog').showModal();
}
document.getElementById('budget-month').addEventListener('change',renderBudgets);
document.getElementById('add-budget').addEventListener('click',() => openBudget());
document.getElementById('cancel-budget').addEventListener('click',() => document.getElementById('budget-dialog').close());
document.getElementById('budget-type').addEventListener('change',() => {document.getElementById('budget-date-label').hidden = document.getElementById('budget-type').value !== 'income';});
document.getElementById('budget-form').addEventListener('submit',event => {
  event.preventDefault();const error = document.getElementById('budget-error');
  const type = document.getElementById('budget-type').value;
  const name = document.getElementById('budget-name').value.trim();
  const amount = document.getElementById('budget-amount').value.trim();
  const date = type === 'income' ? document.getElementById('budget-date').value : '';
  if (!['income','expense'].includes(type) || !name || name.length > 60) {error.textContent = '请选择类型并填写项目名称，最多 60 个字。';return;}
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) {error.textContent = '请填写正数金额，最多两位小数。';return;}
  const [whole,fraction=''] = amount.split('.');const amountCents = Number(whole)*100+Number(fraction.padEnd(2,'0'));
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {error.textContent = '请填写有效的正数金额。';return;}
  if (date && (!validGoalDate(date) || !inCycle(date,editingBudgetMonth))) {error.textContent = '收入日期需要在当前预算周期内，也可以留空。';return;}
  if (editingBudget && type !== 'expense' && records.some(r => r.budgetId === editingBudget)) {error.textContent = '该项目有关联支出，不能改为收入预算。';return;}
  const budget = {id:editingBudget || crypto.randomUUID(),month:editingBudgetMonth,type,name,amountCents,date};
  const updated = editingBudget ? budgets.map(b => b.id === editingBudget ? budget : b) : [...budgets,budget];
  if (!Number.isSafeInteger(updated.reduce((sum,b) => sum+b.amountCents,0))) {error.textContent = '预算总额过大，请检查。';return;}
  try {saveBudgets(updated);} catch(e) {error.textContent = '保存失败：'+e.message;return;}
  renderBudgets();document.getElementById('budget-dialog').close();document.getElementById('budget-status').textContent = '预算项目已保存。';
});
document.getElementById('cycle-day').value = cycleDay;
document.getElementById('save-cycle').disabled = !cycleReadable;
document.getElementById('save-cycle').addEventListener('click',() => {
  const value = Number(document.getElementById('cycle-day').value);
  const status = document.getElementById('budget-status');
  if (!Number.isInteger(value) || value < 1 || value > 31) {status.textContent = '起始日请填写 1 到 31 的整数。';return;}
  try {
    if (!cycleReadable || ledgerStorage.getItem(cycleKey) !== cycleSnapshot) throw new Error('设置已变化或不可用，请刷新后重试。');
    const snapshot = JSON.stringify(value);ledgerStorage.setItem(cycleKey,snapshot);cycleSnapshot = snapshot;
  } catch(e) {status.textContent = '保存失败：'+e.message;return;}
  cycleDay = value;document.getElementById('budget-month').value = currentMonth();render();
  status.textContent = '周期已更新，历史支出按新周期重新统计。已有预算保留在原起始月份，请检查关联和预计收入日期。';
});
function fillBudgetChoices(select,date,selected='') {
  select.replaceChildren();
  const placeholder = document.createElement('option');placeholder.value = '';placeholder.textContent = '请选择预算项目';select.append(placeholder);
  if (!validGoalDate(date)) return;
  for (const budget of budgets.filter(b => b.type === 'expense' && inCycle(date,b.month))) {
    const option = document.createElement('option');option.value = budget.id;option.textContent = `${budget.name} · ${money(budget.amountCents)}`;select.append(option);
  }
  select.value = selected;
}
function populateExpenseBudgets() {
  const select = document.getElementById('expense-budget');const date = document.getElementById('expense-date').value;
  fillBudgetChoices(select,date,select.value);
  document.getElementById('expense-budget-hint').textContent = validGoalDate(date) ? `所属周期：${cycleLabel(monthForDate(date))}。没有项目时，请先在该起始月份添加支出预算。` : '请先选择日期。';
}
document.getElementById('expense-date').addEventListener('change',populateExpenseBudgets);
let linkingRecord = null;
function openRecordBudget(id) {
  const record = records.find(r => r.id === id);if (!record) return;
  linkingRecord = id;fillBudgetChoices(document.getElementById('link-budget-select'),record.date,record.budgetId || '');
  document.getElementById('link-budget-error').textContent = '所属周期：'+cycleLabel(monthForDate(record.date));
  document.getElementById('link-budget-dialog').showModal();
}
document.getElementById('cancel-link-budget').addEventListener('click',() => document.getElementById('link-budget-dialog').close());
document.getElementById('link-budget-form').addEventListener('submit',event => {
  event.preventDefault();const error = document.getElementById('link-budget-error');
  const record = records.find(r => r.id === linkingRecord);const id = document.getElementById('link-budget-select').value;
  if (!cycleReadable || !budgetsReadable || !record || !budgets.some(b => b.id === id && b.type === 'expense' && inCycle(record.date,b.month))) {error.textContent = '请选择该周期内的支出预算；没有项目时请先添加。';return;}
  const updated = records.map(r => r.id === record.id ? {...r,budgetId:id} : r);
  try {saveLedger(accounts,updated);} catch(e) {error.textContent = e.message;return;}
  records = updated;render();document.getElementById('link-budget-dialog').close();status.textContent = '预算关联已保存，账户余额没有改变。';
});
render();



