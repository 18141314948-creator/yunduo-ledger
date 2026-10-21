'use strict';
const $ = id => document.getElementById(id);
const categoryKey = 'dream-ledger.categories.v1';
let categorySnapshot = ledgerStorage.getItem(categoryKey);
let categoriesReadable = true;
const initialCategories = {
  expense:['🍚 餐饮','🚌 交通','🛍️ 购物','🏠 居住','🎮 娱乐','💊 医疗','📚 学习','💸 还款','🌷 其他'],
  income:['💼 工资','🎁 红包','🌱 收益','🌷 其他收入']
};
let categories = Object.entries(initialCategories).flatMap(([type,items]) => items.map((item,index) => ({id:type+'-'+index,type,icon:item.split(' ')[0],name:item.split(' ').slice(1).join(' ')})));
function validCategories(value) {
  return Array.isArray(value) && value.every(c => c && typeof c.id === 'string' && ['income','expense'].includes(c.type) && typeof c.icon === 'string' && c.icon.trim().length > 0 && c.icon.length <= 16 && typeof c.name === 'string' && c.name.trim().length > 0 && c.name.length <= 30) && new Set(value.map(c => c.id)).size === value.length;
}
try {if (categorySnapshot !== null) {const saved = JSON.parse(categorySnapshot);if (!validCategories(saved)) throw new Error('Invalid categories');categories = saved;}} catch {categoriesReadable = false;$('backup-status').textContent = '分类读取失败，请保留数据并联系我排查。';}
function fillCategories(id,type,selected='') {
  const select = $(id);select.replaceChildren();
  for (const c of categories.filter(c => c.type === type)) {const option = document.createElement('option');option.value = c.icon+' '+c.name;option.textContent = option.value;select.append(option);}
  if (selected && ![...select.options].some(o => o.value === selected)) {const option = document.createElement('option');option.value = selected;option.textContent = selected+'（历史分类）';select.append(option);}
  if (selected) select.value = selected;
}
function applyRecordChange(id,next) {
  if (!storageReadable || !debtsReadable) throw new Error('账户或负债数据不可用，请先排查。');
  if (ledgerStorage.getItem(storageKey) !== loadedSnapshot || ledgerStorage.getItem(debtKey) !== debtSnapshot) throw new Error('账本已经更新，请刷新后重试。');
  const changed = LedgerCore.change(accounts,records,debts,id,next);
  const ledger = JSON.stringify({accounts:changed.accounts,records:changed.records});
  const debtData = JSON.stringify(changed.debts);
  ledgerStorage.commit({[storageKey]:ledger,[debtKey]:debtData});
  accounts = changed.accounts;records = changed.records;debts = changed.debts;loadedSnapshot = ledger;debtSnapshot = debtData;
}
function prepareExpenseExtras(record = null) {
  fillCategories('expense-category','expense',record?.category);
  $('expense-photo').value = '';$('expense-remove-photo').checked = false;
  const select = $('expense-debt');select.replaceChildren();
  const none = document.createElement('option');none.value = '';none.textContent = '不关联负债';select.append(none);
  for (const debt of debts) {
    const option = document.createElement('option');option.value = debt.id;option.textContent = `${debt.name} · 待还 ${money(debt.amountCents)}`;select.append(option);
  }
  select.value = record?.debtId || '';
  $('expense-reduction').value = record?.debtId ? (record.debtReductionCents/100).toFixed(2) : '';
  $('expense-reduction-label').hidden = !select.value;
}
$('expense-debt').addEventListener('change',() => {
  $('expense-reduction-label').hidden = !$('expense-debt').value;
  if ($('expense-debt').value && !$('expense-reduction').value) $('expense-reduction').value = $('expense-amount').value;
});
async function completeExpense(record) {
  record.photo = await readRecordPhoto('expense',editingExpense);
  if ($('expense-debt').value) {
    record.debtId = $('expense-debt').value;
    record.debtReductionCents = $('expense-reduction').value.trim() ? LedgerCore.amount($('expense-reduction').value,true) : record.amountCents;
    if (record.debtReductionCents > record.amountCents) throw new Error('减少欠款金额不能大于本次支出。');
  }
}
function prepareMovementExtras(type,record = null) {
  fillCategories('movement-category','income',record?.category);
  $('movement-photo').value = '';$('movement-remove-photo').checked = false;
}
async function readRecordPhoto(prefix,oldId) {
  const file = $(prefix+'-photo').files[0];
  if (!file) return $(prefix+'-remove-photo').checked ? '' : records.find(r => r.id === oldId)?.photo || '';
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10*1024*1024) throw new Error('请选择 10 MB 以内的 JPG、PNG 或 WebP 图片。');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();img.src = url;await img.decode();
    const scale = Math.min(1,1200/Math.max(img.width,img.height));
    const canvas = document.createElement('canvas');canvas.width = Math.max(1,Math.round(img.width*scale));canvas.height = Math.max(1,Math.round(img.height*scale));
    const context = canvas.getContext('2d');context.fillStyle = '#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(img,0,0,canvas.width,canvas.height);
    let photo = canvas.toDataURL('image/jpeg',.72);
    if (photo.length > 400000) photo = canvas.toDataURL('image/jpeg',.4);
    if (photo.length > 400000) throw new Error('图片压缩后仍过大，请选择较小的照片。');
    return photo;
  } finally {URL.revokeObjectURL(url);}
}
function editRecord(record) {
  if (record.type === 'expense') {
    $('add-expense').click();editingExpense = record.id;
    $('expense-title').textContent = '修改支出';
    $('expense-account').value = record.accountId;$('expense-amount').value = (record.amountCents/100).toFixed(2);
    $('expense-date').value = record.date;$('expense-note').value = record.note;
    prepareExpenseExtras(record);populateExpenseBudgets();$('expense-budget').value = record.budgetId || '';
  } else {
    openMovement(record.type);editingMovement = record.id;
    $('movement-title').textContent = record.type === 'income' ? '修改收入' : '修改转账';
    $('movement-account').value = record.accountId;$('movement-destination').value = record.toAccountId || '';
    $('movement-amount').value = (record.amountCents/100).toFixed(2);$('movement-date').value = record.date;$('movement-note').value = record.note;
    prepareMovementExtras(record.type,record);
  }
}
function decorateRecord(record,row,detail) {
  const actions = document.createElement('div');actions.className = 'record-actions record-edit-actions';
  const edit = document.createElement('button');edit.type = 'button';edit.textContent = '修改';edit.addEventListener('click',() => editRecord(record));
  const remove = document.createElement('button');remove.type = 'button';remove.textContent = '删除';
  remove.addEventListener('click',() => {
    if (!confirm('删除这笔记录并撤回对账户余额'+(record.debtId ? '、待还负债' : '')+'的影响？')) return;
    try {applyRecordChange(record.id,null);render();status.textContent = '记录已删除，余额与预算已更新。';} catch(e) {status.textContent = e.message;}
  });
  actions.append(edit,remove);
  if (record.photo) {
    const photo = document.createElement('button');photo.type = 'button';photo.textContent = '查看照片';
    photo.addEventListener('click',() => {$('record-photo-preview').src = record.photo;$('photo-dialog').showModal();});actions.append(photo);
  }
  if (record.debtId) {const info = document.createElement('small');info.textContent = `已减少“${debts.find(d => d.id === record.debtId)?.name || '负债'}” ${money(record.debtReductionCents)}`;detail.append(info);}
  detail.append(actions);
}
$('close-photo').addEventListener('click',() => {$('photo-dialog').close();$('record-photo-preview').removeAttribute('src');});
$('add-expense').addEventListener('click',() => {$('expense-title').textContent = '记一笔生活的小账';});
let editingCategory = null;
function renderCategories() {
  const list = $('categories-list');list.replaceChildren();
  for (const category of categories) {
    const row = document.createElement('div');row.className = 'budget-row';
    const title = document.createElement('span');title.className = 'account-label';title.textContent = `${category.type === 'expense' ? '支出' : '收入'} · ${category.icon} ${category.name}`;
    const edit = document.createElement('button');edit.type = 'button';edit.textContent = '修改';edit.addEventListener('click',() => {editingCategory = category.id;$('category-type').value = category.type;$('category-icon').value = category.icon;$('category-name').value = category.name;$('category-form-title').textContent = '修改分类';});
    const remove = document.createElement('button');remove.type = 'button';remove.textContent = '移除';remove.addEventListener('click',() => {
      if (categories.filter(c => c.type === category.type).length <= 1) {$('category-error').textContent = '每种收支类型至少保留一个分类。';return;}
      if (confirm('移除这个分类？历史记录会保留原分类。')) persistCategories(categories.filter(c => c.id !== category.id));
    });row.append(title,edit,remove);list.append(row);
  }
}
function resetCategory() {editingCategory = null;$('category-name').value = '';$('category-icon').value = '🌷';$('category-form-title').textContent = '添加分类';$('category-error').textContent = '';}
function persistCategories(updated) {
  try {
    if (!categoriesReadable || ledgerStorage.getItem(categoryKey) !== categorySnapshot) throw new Error('分类设置已变化或不可用，请刷新后重试。');
    const snapshot = JSON.stringify(updated);ledgerStorage.setItem(categoryKey,snapshot);categorySnapshot = snapshot;categories = updated;resetCategory();renderCategories();
  } catch(e) {$('category-error').textContent = '保存失败：'+e.message;}
}
$('manage-categories').addEventListener('click',() => {renderCategories();resetCategory();$('categories-dialog').showModal();});
$('close-categories').addEventListener('click',() => $('categories-dialog').close());
$('reset-category').addEventListener('click',resetCategory);
$('category-form').addEventListener('submit',event => {
  event.preventDefault();
  const category = {id:editingCategory || crypto.randomUUID(),type:$('category-type').value,icon:$('category-icon').value.trim(),name:$('category-name').value.trim()};
  const updated = editingCategory ? categories.map(c => c.id === editingCategory ? category : c) : [...categories,category];
  if (!validCategories(updated) || !['income','expense'].every(type => updated.some(c => c.type === type))) {$('category-error').textContent = '请填写有效名称和图标，并为收入、支出各保留一个分类。';return;}
  if (updated.some(c => c.id !== category.id && c.type === category.type && c.icon === category.icon && c.name === category.name)) {$('category-error').textContent = '已有相同分类。';return;}
  persistCategories(updated);
});
$('copy-budget').addEventListener('click',() => {
  const from = $('budget-month').value;if (!validGoalDate(from+'-01')) return;
  const target = dateString(cycleStart(from,1)).slice(0,7);
  const source = budgets.filter(b => b.month === from);
  const additions = source.filter(b => !budgets.some(other => other.month === target && other.type === b.type && other.name === b.name)).map(b => ({...b,id:crypto.randomUUID(),month:target,date:''}));
  if (!additions.length) {$('budget-status').textContent = '没有可复制的项目，或下一期已有同名项目。';return;}
  if (!confirm(`将 ${additions.length} 个预算项目复制到 ${target}？已有同名项目保留不覆盖，预计收入日期留空。`)) return;
  try {saveBudgets([...budgets,...additions]);$('budget-month').value = target;renderBudgets();$('budget-status').textContent = '预算已复制到下一期，可按需要调整。';} catch(e) {$('budget-status').textContent = e.message;}
});

// Full backup uses normalized data and validates every relationship before replacing anything.
function exportState() {
  ledgerStorage.assertCurrent();
  if (![storageReadable,debtsReadable,budgetsReadable,cycleReadable,goalLinksReadable,categoriesReadable].every(Boolean)) throw new Error('有数据未能正常读取，请先排查，避免生成不完整备份。');
  return {accounts,records,debts,budgets,cycleDay,categories,goals:savingsGoals.map((g,index) => ({name:g.name,targetCents:g.targetCents,deadline:g.deadline,accountIds:linkedAccounts(g,index).map(a => a.id)}))};
}
function validateBackup(file) {
  if (!file || file.format !== 'dream-ledger' || file.version !== 2 || !file.data) throw new Error('这不是受支持的云朵账本备份。');
  const d = file.data;
  const unique = list => Array.isArray(list) && list.every(x => x && typeof x.id === 'string' && x.id.length > 0) && new Set(list.map(x => x.id)).size === list.length;
  const label = (s,max) => typeof s === 'string' && s.trim().length > 0 && s.length <= max;
  const integer = n => Number.isSafeInteger(n) && n >= 0;
  if (!validAccounts(d.accounts) || !unique(d.accounts) || !unique(d.records) || !unique(d.debts) || !unique(d.budgets)) throw new Error('账户或记录数据无效，或存在重复标识。');
  if (!Number.isInteger(d.cycleDay) || d.cycleDay < 1 || d.cycleDay > 31 || !validCategories(d.categories) || !['income','expense'].every(t => d.categories.some(c => c.type === t))) throw new Error('周期或分类设置无效。');
  if (!d.debts.every(x => Object.hasOwn(debtTypes,x.type) && label(x.name,60) && integer(x.amountCents) && validGoalDate(x.date))) throw new Error('负债数据无效。');
  if (!d.budgets.every(x => ['income','expense'].includes(x.type) && label(x.name,60) && integer(x.amountCents) && x.amountCents > 0 && validGoalDate(x.month+'-01') && (x.date === '' || (x.type === 'income' && validGoalDate(x.date))))) throw new Error('预算数据无效。');
  if (!Array.isArray(d.goals) || !d.goals.every(g => label(g.name,60) && integer(g.targetCents) && g.targetCents > 0 && validGoalDate(g.deadline) && Array.isArray(g.accountIds) && g.accountIds.every(id => d.accounts.some(a => a.id === id)))) throw new Error('储蓄目标数据无效。');
  if (!d.records.every(r => ['income','expense','transfer'].includes(r.type) && integer(r.amountCents) && r.amountCents > 0 && validGoalDate(r.date) && label(r.category,100) && typeof r.note === 'string' && r.note.length <= 120 && d.accounts.some(a => a.id === r.accountId) && (r.type !== 'transfer' || (r.toAccountId !== r.accountId && d.accounts.some(a => a.id === r.toAccountId))) && (!r.budgetId || (r.type === 'expense' && d.budgets.some(b => b.id === r.budgetId && b.type === 'expense'))) && (!r.debtId || (r.type === 'expense' && d.debts.some(x => x.id === r.debtId) && integer(r.debtReductionCents) && r.debtReductionCents <= r.amountCents)) && (!r.photo || (typeof r.photo === 'string' && r.photo.length <= 400000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(r.photo))))) throw new Error('收支记录或关联信息无效。');
  for (const [list,field] of [[d.records,'amountCents'],[d.debts,'amountCents'],[d.budgets,'amountCents']]) if (!integer(list.reduce((sum,x) => sum+x[field],0))) throw new Error('累计金额无效。');
  return d;
}
function downloadBackup() {
  const backup = {format:'dream-ledger',version:2,exportedAt:new Date().toISOString(),data:exportState()};
  validateBackup(backup);
  const blob = new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);const link = document.createElement('a');link.href = url;link.download = '云朵账本-'+dateString(new Date())+'-'+Date.now()+'.json';document.body.append(link);link.click();link.remove();setTimeout(() => URL.revokeObjectURL(url),30000);
  $('backup-status').textContent = '已生成完整备份，请在浏览器下载记录中确认文件已保存。';
}
$('export-backup').addEventListener('click',() => {try {downloadBackup();} catch(e) {$('backup-status').textContent = e.message;}});
let pendingImport = null;
$('import-backup').addEventListener('click',() => {$('backup-file').value = '';$('backup-file').click();});
$('backup-file').addEventListener('change',async () => {
  try {
    const file = $('backup-file').files[0];if (!file) return;
    if (file.size > 30*1024*1024) throw new Error('备份文件超过 30 MB。');
    pendingImport = validateBackup(JSON.parse(await file.text()));
    $('import-summary').textContent = `将导入 ${pendingImport.accounts.length} 个账户、${pendingImport.records.length} 笔记录、${pendingImport.budgets.length} 个预算项目、${pendingImport.goals.length} 个目标及 ${pendingImport.debts.length} 项负债。`;
    $('confirm-import').disabled = true;$('import-error').textContent = '';$('import-dialog').showModal();
  } catch(e) {pendingImport = null;$('backup-status').textContent = '未导入：'+e.message;}
});
$('cancel-import').addEventListener('click',() => {pendingImport = null;$('import-dialog').close();});
$('backup-before-import').addEventListener('click',() => {try {downloadBackup();$('confirm-import').disabled = false;} catch(e) {$('import-error').textContent = e.message;}});
$('confirm-import').addEventListener('click',() => {
  if (!pendingImport) return;
  try {
    const d = validateBackup({format:'dream-ledger',version:2,data:pendingImport});
    ledgerStorage.commit({[storageKey]:JSON.stringify({accounts:d.accounts,records:d.records}),[debtKey]:JSON.stringify(d.debts),[budgetKey]:JSON.stringify(d.budgets),[goalsKey]:JSON.stringify(d.goals),[cycleKey]:JSON.stringify(d.cycleDay),[categoryKey]:JSON.stringify(d.categories)},true);
    location.reload();
  } catch(e) {$('import-error').textContent = '导入失败，原账本保留：'+e.message;}
});
let installPrompt = null;
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
window.addEventListener('beforeinstallprompt',event => {event.preventDefault();installPrompt = event;});
$('install-app').addEventListener('click',async () => {
  if (installPrompt) {await installPrompt.prompt();installPrompt = null;}
  else $('offline-status').textContent = isIOS ? '请用 Safari 打开网址，点击“分享”→“添加到主屏幕”。安装后从主屏幕打开，再导入你的备份。' : '请在 Chrome 或 Edge 菜单中选择“安装云朵账本”或“将此页面安装为应用”。首次打开并准备离线完成后，可断网使用。';
});
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(() => navigator.serviceWorker.ready).then(() => {$('offline-status').textContent = '离线页面已准备好 · 可添加到主屏幕，断网也能打开。';}).catch(() => {$('offline-status').textContent = '离线准备未完成，请联网刷新后重试。';});
} else $('offline-status').textContent = '当前浏览器不支持离线安装，请使用 Chrome 或 Edge。';
window.addEventListener('storage',event => {if (event.key === 'dream-ledger.bundle.v2') status.textContent = '账本已在其他窗口更新，请刷新后继续操作。';});
setInterval(() => {if (!document.querySelector('dialog[open]')) render();},60000);
render();

