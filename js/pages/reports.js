// ===== REPORTS PAGE (Weekly, Monthly, Yearly) =====
import { getTransactions, getSettings } from '../store.js';
import { fmt, formatDate, getCat, getWeekDates, PAYMENT_LABELS } from '../utils.js';
import { escapeHTML } from '../sanitize.js';
import { drawPieChart, drawBarChart, drawLineChart } from '../charts.js';

function getExpenses(start, end) {
  return getTransactions().filter(t => t.type === 'expense' && t.date >= start && t.date <= end);
}

function getIncome(start, end) {
  return getTransactions().filter(t => t.type === 'income' && t.date >= start && t.date <= end);
}

function sumByCategory(items) {
  const map = {};
  items.forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });
  return Object.entries(map).map(([cat, val]) => ({ category: cat, amount: val })).sort((a, b) => b.amount - a.amount);
}

function sumByDay(items) {
  const map = {};
  items.forEach(t => { map[t.date] = (map[t.date] || 0) + t.amount; });
  return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
}

function sumByPayment(items) {
  const map = {};
  items.forEach(t => { map[t.payment] = (map[t.payment] || 0) + t.amount; });
  return Object.entries(map).map(([k, v]) => ({ payment: k, amount: v })).sort((a, b) => b.amount - a.amount);
}

// ===== WEEKLY =====
let weeklyOffset = 0;

export function renderWeekly(container) {
  const settings = getSettings();
  const now = new Date();
  now.setDate(now.getDate() + weeklyOffset * 7);
  const weekDates = getWeekDates(now);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];
  const exp = getExpenses(weekStart, weekEnd);
  const inc = getIncome(weekStart, weekEnd);
  const totalExp = exp.reduce((s, t) => s + t.amount, 0);
  const totalInc = inc.reduce((s, t) => s + t.amount, 0);
  const catData = sumByCategory(exp);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dailyData = weekDates.map(d => exp.filter(t => t.date === d).reduce((s, t) => s + t.amount, 0));
  const dailyLabels = weekDates.map(d => { const dt = new Date(d + 'T00:00:00'); return dayNames[dt.getDay()]; });

  const periodLabel = weeklyOffset === 0 ? 'This Week' : weeklyOffset === -1 ? 'Last Week' : `${Math.abs(weeklyOffset)} week${Math.abs(weeklyOffset) > 1 ? 's' : ''} ${weeklyOffset < 0 ? 'ago' : 'ahead'}`;

  container.innerHTML = `
    <div class="fade-in">
      <div class="header">
        <div>
          <h2>Weekly Report</h2>
          <p class="text-sm text-muted">${escapeHTML(formatDate(weekStart, settings.dateFormat))} — ${escapeHTML(formatDate(weekEnd, settings.dateFormat))}</p>
        </div>
        <div class="header-actions">
          <div class="period-nav">
            <button class="btn btn-ghost btn-sm btn-icon" id="weekPrev" aria-label="Previous week">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span class="period-label">${periodLabel}</span>
            <button class="btn btn-ghost btn-sm btn-icon" id="weekNext" aria-label="Next week" ${weeklyOffset >= 0 ? 'disabled' : ''}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            ${weeklyOffset !== 0 ? '<button class="btn btn-ghost btn-sm" id="weekToday">Today</button>' : ''}
          </div>
        </div>
      </div>
      <div class="cards-grid">
        <div class="card"><div class="card-label">💸 Total Spent</div><div class="card-value red">${fmt(totalExp, settings.currency)}</div></div>
        <div class="card"><div class="card-label">💰 Income</div><div class="card-value green">${fmt(totalInc, settings.currency)}</div></div>
        <div class="card"><div class="card-label">📊 Transactions</div><div class="card-value accent">${exp.length + inc.length}</div></div>
        <div class="card"><div class="card-label">📈 Avg/Day</div><div class="card-value yellow">${fmt(totalExp / 7, settings.currency)}</div></div>
      </div>
      <div class="grid-2">
        <div class="panel">
          <div class="panel-header"><h3>Daily Spending</h3></div>
          <canvas id="weeklyBar" aria-label="Daily spending bar chart"></canvas>
        </div>
        <div class="panel">
          <div class="panel-header"><h3>By Category</h3></div>
          <div class="chart-split" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
            <div style="flex:1;min-width:180px">
              <canvas id="weeklyPie" aria-label="Category breakdown pie chart"></canvas>
            </div>
            <div style="flex:1;min-width:160px">
              ${catData.map(c => `
                <div class="flex flex-center flex-between mb-8">
                  <div class="flex flex-center gap-8">
                    <div style="width:8px;height:8px;border-radius:50%;background:${getCat(c.category).color}" aria-hidden="true"></div>
                    <span class="text-sm">${getCat(c.category).icon} ${escapeHTML(getCat(c.category).name)}</span>
                  </div>
                  <span class="text-sm" style="font-weight:600">${fmt(c.amount, settings.currency)}</span>
                </div>
              `).join('') || '<p class="text-muted text-sm">No expenses</p>'}
            </div>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><h3>Top Expenses This Week</h3></div>
        ${exp.sort((a, b) => b.amount - a.amount).slice(0, 5).map(t => {
          const cat = getCat(t.category);
          return `
            <div class="flex flex-center flex-between" style="padding:8px 0;border-bottom:1px solid var(--border)">
              <div class="flex flex-center gap-8">
                <div class="transaction-icon" style="background:${cat.color}22;color:${cat.color}" aria-hidden="true">${cat.icon}</div>
                <div>
                  <div class="text-sm" style="font-weight:500">${escapeHTML(t.description || cat.name)}</div>
                  <div class="text-sm text-muted">${escapeHTML(formatDate(t.date, settings.dateFormat))}</div>
                </div>
              </div>
              <span style="font-weight:600;color:var(--red)">- ${fmt(t.amount, settings.currency)}</span>
            </div>
          `;
        }).join('') || '<p class="empty-state text-muted">No expenses this week</p>'}
      </div>
    </div>
  `;

  document.getElementById('weekPrev')?.addEventListener('click', () => { weeklyOffset--; renderWeekly(container); });
  document.getElementById('weekNext')?.addEventListener('click', () => { if(weeklyOffset < 0) { weeklyOffset++; renderWeekly(container); } });
  document.getElementById('weekToday')?.addEventListener('click', () => { weeklyOffset = 0; renderWeekly(container); });

  setTimeout(() => {
    drawBarChart('weeklyBar', dailyData, dailyLabels, '#e17055', settings.currency);
    drawPieChart('weeklyPie', catData, totalExp, settings.currency);
  }, 50);
}

// ===== MONTHLY =====
let monthlyOffset = 0;

export function renderMonthly(container) {
  const settings = getSettings();
  const now = new Date();
  now.setMonth(now.getMonth() + monthlyOffset);
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthStart = year + '-' + String(month + 1).padStart(2, '0') + '-01';
  const monthEnd = new Date(year, month + 1, 0).toISOString().slice(0, 10);
  const exp = getExpenses(monthStart, monthEnd);
  const inc = getIncome(monthStart, monthEnd);
  const totalExp = exp.reduce((s, t) => s + t.amount, 0);
  const totalInc = inc.reduce((s, t) => s + t.amount, 0);
  const catData = sumByCategory(exp);
  const payData = sumByPayment(exp);
  const dailyExp = sumByDay(exp);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dailyData = [];
  const dailyLabels = [];
  for(let i = 1; i <= daysInMonth; i++) {
    const d = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(i).padStart(2, '0');
    dailyData.push(exp.filter(t => t.date === d).reduce((s, t) => s + t.amount, 0));
    dailyLabels.push(i.toString());
  }
  const catSpending = catData.map(c => ({ ...c, pct: totalExp ? (c.amount / totalExp * 100) : 0 }));
  const avgPerDay = totalExp / daysInMonth;
  const topDay = dailyExp.length ? dailyExp.reduce((a, b) => b[1] > a[1] ? b : a, ['', [0]]) : ['', [0]];

  const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const isCurrentMonth = monthlyOffset === 0;

  container.innerHTML = `
    <div class="fade-in">
      <div class="header">
        <div>
          <h2>Monthly Report — ${escapeHTML(monthName)}</h2>
        </div>
        <div class="header-actions">
          <div class="period-nav">
            <button class="btn btn-ghost btn-sm btn-icon" id="monthPrev" aria-label="Previous month">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span class="period-label">${isCurrentMonth ? 'This Month' : monthName}</span>
            <button class="btn btn-ghost btn-sm btn-icon" id="monthNext" aria-label="Next month" ${isCurrentMonth ? 'disabled' : ''}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            ${!isCurrentMonth ? '<button class="btn btn-ghost btn-sm" id="monthToday">Today</button>' : ''}
          </div>
        </div>
      </div>
      <div class="cards-grid">
        <div class="card"><div class="card-label">💸 Total Expenses</div><div class="card-value red">${fmt(totalExp, settings.currency)}</div></div>
        <div class="card"><div class="card-label">💰 Total Income</div><div class="card-value green">${fmt(totalInc, settings.currency)}</div></div>
        <div class="card"><div class="card-label">🏦 Net Balance</div><div class="card-value ${totalInc - totalExp >= 0 ? 'green' : 'red'}">${fmt(totalInc - totalExp, settings.currency)}</div></div>
        <div class="card"><div class="card-label">📅 Avg Daily</div><div class="card-value accent">${fmt(avgPerDay, settings.currency)}</div></div>
      </div>
      <div class="grid-2">
        <div class="panel">
          <div class="panel-header"><h3>Daily Expense Trend</h3></div>
          <canvas id="monthlyLine" aria-label="Daily expense trend line chart"></canvas>
        </div>
        <div class="panel">
          <div class="panel-header"><h3>Category Breakdown</h3></div>
          <div class="chart-split" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
            <div style="flex:1;min-width:180px">
              <canvas id="monthlyPie" aria-label="Category breakdown pie chart"></canvas>
            </div>
            <div style="flex:1;min-width:180px">
              ${catSpending.map(c => `
                <div style="margin-bottom:10px">
                  <div class="flex flex-center flex-between mb-8">
                    <span class="text-sm">${getCat(c.category).icon} ${escapeHTML(getCat(c.category).name)}</span>
                    <span class="text-sm" style="font-weight:600">${fmt(c.amount, settings.currency)} <span class="text-muted">(${c.pct.toFixed(0)}%)</span></span>
                  </div>
                  <div class="progress-bar">
                    <div class="progress-fill" style="width:${c.pct}%;background:${getCat(c.category).color}"></div>
                  </div>
                </div>
              `).join('') || '<p class="text-muted text-sm">No expenses</p>'}
            </div>
          </div>
        </div>
      </div>
      <div class="grid-2">
        <div class="panel">
          <div class="panel-header"><h3>Payment Methods</h3></div>
          ${payData.map(p => `
            <div class="flex flex-center flex-between" style="padding:10px 0;border-bottom:1px solid var(--border)">
              <span class="text-sm">${escapeHTML(PAYMENT_LABELS[p.payment] || p.payment)}</span>
              <div class="flex flex-center gap-8">
                <div class="progress-bar" style="width:100px">
                  <div class="progress-fill" style="width:${totalExp ? (p.amount / totalExp * 100) : 0}%;background:var(--accent)"></div>
                </div>
                <span class="text-sm" style="font-weight:600;min-width:80px;text-align:right">${fmt(p.amount, settings.currency)}</span>
              </div>
            </div>
          `).join('') || '<p class="text-muted text-sm">No data</p>'}
        </div>
        <div class="panel">
          <div class="panel-header"><h3>Highlights</h3></div>
          <div class="flex flex-center gap-8 mb-16" style="padding:12px;background:var(--bg3)">
            <span style="font-size:1.5rem" aria-hidden="true">🏆</span>
            <div>
              <div class="text-sm" style="font-weight:600">Highest Spending Day</div>
              <div class="text-sm text-muted">${topDay[0] ? escapeHTML(formatDate(topDay[0], settings.dateFormat)) + ' — ' + fmt(topDay[1], settings.currency) : 'N/A'}</div>
            </div>
          </div>
          <div class="flex flex-center gap-8 mb-16" style="padding:12px;background:var(--bg3)">
            <span style="font-size:1.5rem" aria-hidden="true">${catData.length ? getCat(catData[0].category).icon : '📊'}</span>
            <div>
              <div class="text-sm" style="font-weight:600">Top Category</div>
              <div class="text-sm text-muted">${catData.length ? escapeHTML(getCat(catData[0].category).name) + ' — ' + fmt(catData[0].amount, settings.currency) : 'N/A'}</div>
            </div>
          </div>
          <div class="flex flex-center gap-8" style="padding:12px;background:var(--bg3)">
            <span style="font-size:1.5rem" aria-hidden="true">📝</span>
            <div>
              <div class="text-sm" style="font-weight:600">Total Transactions</div>
              <div class="text-sm text-muted">${exp.length} expenses, ${inc.length} income</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('monthPrev')?.addEventListener('click', () => { monthlyOffset--; renderMonthly(container); });
  document.getElementById('monthNext')?.addEventListener('click', () => { if(monthlyOffset < 0) { monthlyOffset++; renderMonthly(container); } });
  document.getElementById('monthToday')?.addEventListener('click', () => { monthlyOffset = 0; renderMonthly(container); });

  setTimeout(() => {
    drawLineChart('monthlyLine', dailyData, dailyLabels, '#e17055');
    drawPieChart('monthlyPie', catData, totalExp, settings.currency);
  }, 50);
}

// ===== YEARLY =====
let yearlyOffset = 0;

export function renderYearly(container) {
  const settings = getSettings();
  const now = new Date();
  const year = now.getFullYear() + yearlyOffset;
  const yearStart = year + '-01-01';
  const yearEnd = year + '-12-31';
  const exp = getExpenses(yearStart, yearEnd);
  const inc = getIncome(yearStart, yearEnd);
  const totalExp = exp.reduce((s, t) => s + t.amount, 0);
  const totalInc = inc.reduce((s, t) => s + t.amount, 0);
  const catData = sumByCategory(exp);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const expByMonth = [];
  const incByMonth = [];
  const monthLabels = [];
  for(let i = 0; i < 12; i++) {
    const ms = year + '-' + String(i + 1).padStart(2, '0') + '-01';
    const me = new Date(year, i + 1, 0).toISOString().slice(0, 10);
    expByMonth.push(getExpenses(ms, me).reduce((s, t) => s + t.amount, 0));
    incByMonth.push(getIncome(ms, me).reduce((s, t) => s + t.amount, 0));
    monthLabels.push(monthNames[i]);
  }

  const isCurrentYear = yearlyOffset === 0;

  container.innerHTML = `
    <div class="fade-in">
      <div class="header">
        <div><h2>Yearly Report — ${year}</h2></div>
        <div class="header-actions">
          <div class="period-nav">
            <button class="btn btn-ghost btn-sm btn-icon" id="yearPrev" aria-label="Previous year">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span class="period-label">${year}</span>
            <button class="btn btn-ghost btn-sm btn-icon" id="yearNext" aria-label="Next year" ${isCurrentYear ? 'disabled' : ''}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            ${!isCurrentYear ? '<button class="btn btn-ghost btn-sm" id="yearToday">Today</button>' : ''}
          </div>
        </div>
      </div>
      <div class="cards-grid">
        <div class="card"><div class="card-label">💸 Total Expenses</div><div class="card-value red">${fmt(totalExp, settings.currency)}</div></div>
        <div class="card"><div class="card-label">💰 Total Income</div><div class="card-value green">${fmt(totalInc, settings.currency)}</div></div>
        <div class="card"><div class="card-label">🏦 Net Savings</div><div class="card-value ${totalInc - totalExp >= 0 ? 'green' : 'red'}">${fmt(totalInc - totalExp, settings.currency)}</div></div>
        <div class="card"><div class="card-label">📊 Savings Rate</div><div class="card-value accent">${totalInc ? ((totalInc - totalExp) / totalInc * 100).toFixed(1) : 0}%</div></div>
      </div>
      <div class="panel mb-20">
        <div class="panel-header"><h3>Monthly Comparison</h3></div>
        <div class="chart-container"><canvas id="yearlyBar" aria-label="Monthly comparison bar chart"></canvas></div>
      </div>
      <div class="grid-2">
        <div class="panel">
          <div class="panel-header"><h3>Income vs Expenses</h3></div>
          <canvas id="yearlyLine" aria-label="Income vs expenses line chart"></canvas>
        </div>
        <div class="panel">
          <div class="panel-header"><h3>Top Categories</h3></div>
          ${catData.slice(0, 6).map((c, i) => `
            <div class="flex flex-center flex-between" style="padding:10px 0;border-bottom:1px solid var(--border)">
              <div class="flex flex-center gap-8">
                <span style="font-weight:700;color:var(--text3);width:20px">${i + 1}.</span>
                <span>${getCat(c.category).icon} ${escapeHTML(getCat(c.category).name)}</span>
              </div>
              <span style="font-weight:600">${fmt(c.amount, settings.currency)}</span>
            </div>
          `).join('') || '<p class="text-muted">No data</p>'}
        </div>
      </div>
      <div class="grid-2">
        <div class="panel">
          <div class="panel-header"><h3>Expense by Category</h3></div>
          <div class="chart-split" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
            <div style="flex:1;min-width:180px;max-width:260px">
              <canvas id="yearlyPie" aria-label="Expense by category pie chart"></canvas>
            </div>
            <div style="flex:1;min-width:180px">
              ${catData.map(c => `
                <div class="flex flex-center flex-between mb-8">
                  <div class="flex flex-center gap-8">
                    <div style="width:8px;height:8px;border-radius:50%;background:${getCat(c.category).color}" aria-hidden="true"></div>
                    <span class="text-sm">${escapeHTML(getCat(c.category).name)}</span>
                  </div>
                  <span class="text-sm" style="font-weight:600">${fmt(c.amount, settings.currency)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-header"><h3>Quarterly Summary</h3></div>
          ${[0, 1, 2, 3].map(q => {
            const qExp = expByMonth.slice(q * 3, q * 3 + 3).reduce((s, v) => s + v, 0);
            const qInc = incByMonth.slice(q * 3, q * 3 + 3).reduce((s, v) => s + v, 0);
            return `
              <div style="padding:12px;background:var(--bg3);margin-bottom:8px">
                <div class="flex flex-center flex-between mb-8">
                  <span style="font-weight:600">Q${q + 1}</span>
                  <span class="badge badge-${qInc - qExp >= 0 ? 'success' : 'danger'}">${qInc - qExp >= 0 ? 'Surplus' : 'Deficit'}</span>
                </div>
                <div class="flex flex-center flex-between text-sm">
                  <span class="text-muted">Income: <strong style="color:var(--green)">${fmt(qInc, settings.currency)}</strong></span>
                  <span class="text-muted">Expenses: <strong style="color:var(--red)">${fmt(qExp, settings.currency)}</strong></span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  document.getElementById('yearPrev')?.addEventListener('click', () => { yearlyOffset--; renderYearly(container); });
  document.getElementById('yearNext')?.addEventListener('click', () => { if(yearlyOffset < 0) { yearlyOffset++; renderYearly(container); } });
  document.getElementById('yearToday')?.addEventListener('click', () => { yearlyOffset = 0; renderYearly(container); });

  setTimeout(() => {
    drawBarChart('yearlyBar', expByMonth, monthLabels, '#6c5ce7', settings.currency);
    drawLineChart('yearlyLine', incByMonth, monthLabels, '#00b894');
    drawPieChart('yearlyPie', catData, totalExp, settings.currency);
  }, 50);
}
