'use strict';
const navigationItems = [{id:'home',label:'首页',icon:'⌂'},{id:'spending',label:'支出',icon:'▥'},{id:'goals',label:'心愿',icon:'☆'},{id:'accounts',label:'账户',icon:'▣'},{id:'debts',label:'负债',icon:'◷'}];
let activePage = 'home';
let chartMonth = currentMonth();
const appMain = document.querySelector('main');
const pageSections = {};
for (const item of navigationItems) {const section = document.createElement('section');section.id = 'page-'+item.id;section.className = 'app-page';section.hidden = item.id !== 'home';section.setAttribute('aria-label',item.label);pageSections[item.id] = section;appMain.append(section);}
for (const selector of ['.intro','.overview','.budget-panel']) pageSections.home.append(document.querySelector(selector));
pageSections.goals.append(document.querySelector('.goals-panel'));
pageSections.debts.append(document.querySelector('.debt-panel'));
const accountPanel = document.getElementById('account-list').closest('article');
pageSections.accounts.append(accountPanel);
pageSections.home.append(document.getElementById('record-list').closest('article'));
pageSections.accounts.append(document.querySelector('.tools-panel'));
document.querySelector('.details').remove();
const statusElement = document.getElementById('status');const footerElement = document.querySelector('footer');appMain.append(statusElement,footerElement);
const nav = document.createElement('nav');nav.className = 'bottom-nav';nav.setAttribute('aria-label','账本页面');
for (const item of navigationItems) {const button = document.createElement('button');button.type = 'button';button.dataset.page = item.id;button.setAttribute('aria-label',item.label);const icon = document.createElement('span');icon.className = 'nav-icon';icon.textContent = item.icon;const label = document.createElement('span');label.textContent = item.label;button.append(icon,label);button.addEventListener('click',() => switchPage(item.id));nav.append(button);}
document.body.append(nav);
function switchPage(id) {
  activePage = id;
  for (const item of navigationItems) {pageSections[item.id].hidden = item.id !== id;const button = nav.querySelector(`[data-page="${item.id}"]`);button.classList.toggle('selected',item.id === id);if (item.id === id) button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}
  if (id === 'spending') renderSpendingDashboard();
  window.scrollTo({top:0,behavior:'auto'});
}
pageSections.spending.innerHTML = `<div class="page-heading"><p class="eyebrow">SPENDING JOURNAL</p><h1>看见每一笔生活</h1><p class="muted">从日常开销里，找到属于自己的节奏。</p></div>
<div class="cycle-toolbar"><button id="chart-previous" type="button" aria-label="上一周期">‹</button><label>预算起始月份<input id="chart-month" type="month" aria-label="支出看板起始月份"></label><button id="chart-next" type="button" aria-label="下一周期">›</button></div><p id="chart-range" class="form-hint"></p>
<div id="chart-summary" class="chart-summary"></div><p class="form-hint">仅统计支出，包含还款；收入和账户转账不计入。</p>
<div class="chart-layout"><section class="panel"><h2>钱都花在哪里了 <span>◌</span></h2><p class="form-hint">分类占比</p><div id="category-chart" class="category-chart"></div><div id="category-legend"></div></section>
<section class="panel"><h2>每日开销的节奏 <span>▥</span></h2><p class="form-hint">横向滑动查看完整周期；点按柱形可查看当天金额。</p><div id="daily-chart" class="daily-chart"></div><p id="daily-detail" class="form-hint" role="status"></p></section></div>
<section class="panel chart-budget-panel"><h2>预算还剩多少 <span>♡</span></h2><div id="chart-budgets"></div><p id="chart-unlinked" class="form-hint"></p></section>`;
document.getElementById('chart-month').value = chartMonth;
document.getElementById('chart-month').addEventListener('change',event => {if (validGoalDate(event.target.value+'-01')) {chartMonth = event.target.value;renderSpendingDashboard();}});
function shiftChart(offset) {chartMonth = LedgerCharts.day(LedgerCharts.start(chartMonth,cycleDay,offset)).slice(0,7);document.getElementById('chart-month').value = chartMonth;renderSpendingDashboard();}
document.getElementById('chart-previous').addEventListener('click',() => shiftChart(-1));document.getElementById('chart-next').addEventListener('click',() => shiftChart(1));
function element(tag,className,text) {const el = document.createElement(tag);if(className) el.className = className;if(text !== undefined) el.textContent = text;return el;}
function renderSpendingDashboard() {
  if (!document.getElementById('chart-summary')) return;
  const summary = document.getElementById('chart-summary');summary.replaceChildren();
  const category = document.getElementById('category-chart');category.replaceChildren();
  const legend = document.getElementById('category-legend');legend.replaceChildren();
  const daily = document.getElementById('daily-chart');daily.replaceChildren();
  const budgetList = document.getElementById('chart-budgets');budgetList.replaceChildren();
  if (!storageReadable || !budgetsReadable || !cycleReadable) {summary.textContent = '账本数据读取失败，暂不能生成图表，请保留浏览器数据并排查。';return;}
  const data = LedgerCharts.analyze(records,budgets,cycleDay,chartMonth);
  document.getElementById('chart-range').textContent = `${data.start} 至 ${data.end}`;
  for (const [label,value] of [['本期支出',data.totalMoney],['支出笔数',data.count+' 笔'],['周期日均',data.averageMoney],['单日最高',data.peakMoney]]) {const card = element('div','summary-tile');card.append(element('span','',label),element('strong','',value));summary.append(card);}
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 220 220');svg.setAttribute('role','img');svg.setAttribute('aria-label',data.hasData ? '分类支出占比，具体金额见下方列表' : '本期暂无支出');
  function circle(color,ratio,offset) {const c = document.createElementNS(svg.namespaceURI,'circle');for (const [k,v] of Object.entries({cx:110,cy:110,r:82,fill:'none',stroke:color,'stroke-width':24,pathLength:100,'stroke-dasharray':`${ratio*100} ${100-ratio*100}`,'stroke-dashoffset':-offset*100,transform:'rotate(-90 110 110)'})) c.setAttribute(k,v);svg.append(c);}
  circle('#eee8f3',1,0);let offset = 0;for(const c of data.categories){circle(c.color,c.ratio,offset);offset += c.ratio;}
  const total = document.createElementNS(svg.namespaceURI,'text');total.setAttribute('x',110);total.setAttribute('y',108);total.setAttribute('text-anchor','middle');total.setAttribute('class','donut-total');total.textContent = data.totalMoney;svg.append(total);
  const caption = document.createElementNS(svg.namespaceURI,'text');caption.setAttribute('x',110);caption.setAttribute('y',132);caption.setAttribute('text-anchor','middle');caption.setAttribute('class','donut-caption');caption.textContent = data.hasData ? '本期支出' : '还没有支出';svg.append(caption);category.append(svg);
  if (!data.hasData) legend.append(element('p','form-hint','记下第一笔支出后，这里会长出你的生活图表。'));
  for(const c of data.categories){const row=element('div','legend-row');const dot=element('i','legend-dot');dot.style.background=c.color;row.append(dot,element('span','legend-name',c.name),element('span','legend-percent',c.percent+'%'),element('strong','',c.money));legend.append(row);}
  for(const d of data.daily){const button=element('button','day-column');button.type='button';button.setAttribute('aria-label',`${d.date} 支出 ${d.money}`);const bar=element('span','day-bar');bar.style.height=d.height+'px';button.append(bar,element('span','day-label',d.label));button.addEventListener('click',()=>{document.getElementById('daily-detail').textContent=`${d.date} · ${d.money}`;});daily.append(button);}
  const firstSpendingDay = data.daily.findIndex(d => d.amount > 0);daily.scrollLeft = Math.max(0,firstSpendingDay-2)*36;
  document.getElementById('daily-detail').textContent = data.hasData ? '单日最高 '+data.peakMoney : '本期暂无支出，所有日期均为 0。';
  if (!data.budgets.length) budgetList.append(element('p','form-hint','本期尚未设置支出预算，可在首页添加。'));
  for(const b of data.budgets){const row=element('div','chart-budget-row');const title=element('div','budget-bar-title');title.append(element('span','',b.name),element('span','',b.usedMoney+' / '+b.limitMoney));const progress=element('progress',b.over?'over':'');progress.max=b.limit;progress.value=Math.min(b.used,b.limit);progress.setAttribute('aria-label',b.name+'预算已用');row.append(title,progress,element('p',b.over?'over-text form-hint':'form-hint',b.remaining));budgetList.append(row);}
  document.getElementById('chart-unlinked').textContent = data.unlinked ? `${data.unlinkedMoney} 尚未关联本期预算，已计入总支出和图表，可在首页记录的“⋯”菜单中修改关联。` : '每一笔关联支出都会同步更新预算用量。';
}
const previousRender = render;
render = function() {previousRender();if (activePage === 'spending') renderSpendingDashboard();};
const recordMenuDialog = document.createElement('dialog');recordMenuDialog.className='record-menu-dialog';recordMenuDialog.setAttribute('aria-label','记录操作');document.body.append(recordMenuDialog);
function decorateRecord(record,row,detail) {
  const more=element('button','record-more-button','⋯');more.type='button';more.setAttribute('aria-label','更多记录操作');
  more.addEventListener('click',()=>{
    recordMenuDialog.replaceChildren(element('h2','',record.category));
    function action(label,callback){const button=element('button','menu-choice',label);button.type='button';button.addEventListener('click',()=>{recordMenuDialog.close();callback();});recordMenuDialog.append(button);}
    action('修改',()=>editRecord(record));
    if(record.type==='expense') action('关联预算',()=>openRecordBudget(record.id));
    if(record.photo) action('查看照片',()=>{$('record-photo-preview').src=record.photo;$('photo-dialog').showModal();});
    action('删除',()=>{if(confirm('删除这笔记录并撤回对余额和关联负债的影响？')){try{applyRecordChange(record.id,null);render();status.textContent='记录已删除，余额与预算已更新。';}catch(e){status.textContent=e.message;}}});
    action('取消',()=>{});recordMenuDialog.showModal();
  });
  const oldLink=detail.querySelector('button');if(oldLink) oldLink.remove();
  if(record.debtId) detail.append(element('small','',`已减少“${debts.find(d=>d.id===record.debtId)?.name || '负债'}” ${money(record.debtReductionCents)}`));
  row.append(more);
}
render();switchPage('home');

