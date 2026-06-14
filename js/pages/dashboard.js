// ===== DASHBOARD PAGE =====
import { getTransactions, getBudgets, getSavingsGoals, getRecurringList, getSettings } from '../store.js';
import { today, fmt, getCat } from '../utils.js';
import { escapeHTML } from '../sanitize.js';
import { drawPieChart, drawBarChart, drawHealthRing } from '../charts.js';

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

let dashMonthOffset = 0;

function calcHealthScore(monthStart, monthEnd) {
  const now = new Date();
  const thisMonthExp = getExpenses(monthStart, monthEnd);

  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1 + dashMonthOffset, 1);
  const lmStart = lastMonth.toISOString().slice(0, 7) + '-01';
  const lmEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).toISOString().slice(0, 10);
  const lastMonthExp = getExpenses(lmStart, lmEnd);

  const thisMonthInc = getIncome(monthStart, monthEnd);
  const totalExp = thisMonthExp.reduce((s, x) => s + x.amount, 0);
  const totalInc = thisMonthInc.reduce((s, x) => s + x.amount, 0);
  const totalExpLast = lastMonthExp.reduce((s, x) => s + x.amount, 0);

  const factors = {};

  // Savings Rate
  let savingsPts = 0;
  let savingsRate = 0;
  if (totalInc > 0) {
    savingsRate = Math.max(0, (totalInc - totalExp) / totalInc);
    savingsPts = savingsRate * 30;
  }
  factors.savings = { pts: Math.round(savingsPts), max: 30, rate: savingsRate };

  // Budget Adherence
  const budgets = getBudgets();
  let budgetPts = 0;
  let overBudgetCats = [];
  if (budgets.length > 0) {
    const budgetScore = budgets.reduce((acc, b) => {
      const spent = thisMonthExp.filter(e => e.category === b.category).reduce((s, x) => s + x.amount, 0);
      const ratio = spent / b.limit;
      if (ratio <= 0.8) return acc + 1;
      if (ratio <= 1.0) return acc + 0.5;
      overBudgetCats.push({ ...b, spent, ratio });
      return acc;
    }, 0);
    budgetPts = (budgetScore / budgets.length) * 10;
  }
  factors.budget = { pts: Math.round(budgetPts * 10) / 10, max: 10, overBudget: overBudgetCats };

  // Spending Trend
  let trendPts = 0;
  let expChange = 0;
  if (totalExpLast > 0) {
    expChange = (totalExp - totalExpLast) / totalExpLast;
    if (expChange < -0.1) trendPts = 5;
    else if (expChange > 0.2) trendPts = -5;
  }
  const trendPct = totalExpLast > 0 ? Math.round(expChange * 100) : null;
  const trendLabel = trendPct !== null ? (trendPct > 0 ? '+' : '') + trendPct + '%' : 'N/A';
  const trendColor = trendPts > 0 ? 'var(--green)' : trendPts < 0 ? 'var(--red)' : 'var(--accent)';
  factors.trend = { pts: trendPts, max: 5, change: expChange, pct: trendPct, label: trendLabel, color: trendColor };

  let score = 50 + savingsPts + budgetPts + trendPts;
  if (getTransactions().length === 0) score = 0;
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Last month score for comparison
  let lastScore = null;
  if (totalExpLast > 0 || getIncome(lmStart, lmEnd).reduce((s, x) => s + x.amount, 0) > 0) {
    lastScore = calcHealthScoreRaw(lmStart, lmEnd, dashMonthOffset - 1);
  }

  // Generate actionable insights
  const insights = [];
  if (totalInc > 0 && savingsRate < 0.2) {
    insights.push({ icon: '💰', text: `Savings rate is <strong>${Math.round(savingsRate * 100)}%</strong> — aim for at least 20%`, color: savingsRate < 0.1 ? 'var(--red)' : 'var(--yellow)' });
  }
  if (overBudgetCats.length > 0) {
    const names = overBudgetCats.map(c => getCat(c.category).name).slice(0, 2);
    insights.push({ icon: '📊', text: `Over budget in <strong>${escapeHTML(names.join(', '))}</strong>`, color: 'var(--red)' });
  }
  if (expChange > 0.2 && totalExpLast > 0) {
    const topCats = sumByCategory(thisMonthExp).slice(0, 2);
    const topNames = topCats.map(c => getCat(c.category).name).join(', ');
    insights.push({ icon: '📈', text: `Spending up <strong>${Math.round(expChange * 100)}%</strong> vs last month — mainly ${escapeHTML(topNames)}`, color: 'var(--red)' });
  } else if (expChange < -0.1 && totalExpLast > 0) {
    insights.push({ icon: '📉', text: `Spending down <strong>${Math.abs(Math.round(expChange * 100))}%</strong> vs last month — nice work!`, color: 'var(--green)' });
  }
  if (thisMonthExp.length > 0 && budgets.length === 0) {
    insights.push({ icon: '🎯', text: `Set a budget to get personalized spending alerts`, color: 'var(--accent)' });
  }

  return { score, factors, lastScore, insights };
}

function calcHealthScoreRaw(monthStart, monthEnd, offset) {
  const now = new Date();
  const thisMonthExp = getExpenses(monthStart, monthEnd);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1 + offset, 1);
  const lmStart = lastMonth.toISOString().slice(0, 7) + '-01';
  const lmEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).toISOString().slice(0, 10);
  const lastMonthExp = getExpenses(lmStart, lmEnd);
  const thisMonthInc = getIncome(monthStart, monthEnd);
  const totalExp = thisMonthExp.reduce((s, x) => s + x.amount, 0);
  const totalInc = thisMonthInc.reduce((s, x) => s + x.amount, 0);
  const totalExpLast = lastMonthExp.reduce((s, x) => s + x.amount, 0);

  let score = 50;
  if (totalInc > 0) {
    const savingsRate = Math.max(0, (totalInc - totalExp) / totalInc);
    score += savingsRate * 30;
  }
  const budgets = getBudgets();
  if (budgets.length > 0) {
    const budgetScore = budgets.reduce((acc, b) => {
      const spent = thisMonthExp.filter(e => e.category === b.category).reduce((s, x) => s + x.amount, 0);
      const ratio = spent / b.limit;
      if (ratio <= 0.8) return acc + 1;
      if (ratio <= 1.0) return acc + 0.5;
      return acc;
    }, 0);
    score += (budgetScore / budgets.length) * 10;
  }
  if (totalExpLast > 0) {
    const expChange = (totalExp - totalExpLast) / totalExpLast;
    if (expChange < -0.1) score += 5;
    else if (expChange > 0.2) score -= 5;
  }
  if (getTransactions().length === 0) score = 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getInsights(monthStart, monthEnd) {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1 + dashMonthOffset, 1);
  const lmStart = lastMonth.toISOString().slice(0, 7) + '-01';
  const lmEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).toISOString().slice(0, 10);

  const thisMonthExp = getExpenses(monthStart, monthEnd);
  const lastMonthExp = getExpenses(lmStart, lmEnd);
  const settings = getSettings();
  const totalExp = thisMonthExp.reduce((s, x) => s + x.amount, 0);
  const totalExpLast = lastMonthExp.reduce((s, x) => s + x.amount, 0);
  const insights = [];

  if(totalExpLast > 0) {
    const change = ((totalExp - totalExpLast) / totalExpLast * 100);
    if(Math.abs(change) > 5) {
      const dir = change > 0 ? 'up' : 'down';
      insights.push({
        text: `Overall spending is <strong>${dir === 'up' ? 'up' : 'down'} ${Math.abs(change).toFixed(0)}%</strong> vs last month`,
        color: dir === 'up' ? 'var(--red)' : 'var(--green)',
        change: `${dir === 'up' ? '+' : '-'}${Math.abs(change).toFixed(0)}%`,
        changeColor: dir === 'up' ? 'var(--red)' : 'var(--green)'
      });
    }
  }

  const thisCats = sumByCategory(thisMonthExp);
  const lastCats = sumByCategory(lastMonthExp);
  const lastCatMap = Object.fromEntries(lastCats.map(c => [c.category, c.amount]));
  for(const cat of thisCats.slice(0, 3)) {
    const lastAmt = lastCatMap[cat.category] || 0;
    if(lastAmt > 0) {
      const catChange = ((cat.amount - lastAmt) / lastAmt * 100);
      if(Math.abs(catChange) > 15) {
        const info = getCat(cat.category);
    insights.push({
      text: `<strong>${escapeHTML(info.name)}</strong> spending ${catChange > 0 ? 'increased' : 'decreased'} ${Math.abs(catChange).toFixed(0)}% — ${fmt(lastAmt, settings.currency)} → ${fmt(cat.amount, settings.currency)}`,
          color: catChange > 0 ? 'var(--red)' : 'var(--green)',
          change: `${catChange > 0 ? '+' : '-'}${Math.abs(catChange).toFixed(0)}%`,
          changeColor: catChange > 0 ? 'var(--red)' : 'var(--green)'
        });
      }
    }
  }

  if(thisMonthExp.length > 0) {
    const topExp = thisMonthExp.reduce((max, x) => x.amount > max.amount ? x : max, thisMonthExp[0]);
    const topCat = getCat(topExp.category);
    insights.push({
      text: `Largest expense: <strong>${escapeHTML(topExp.description || topCat.name)}</strong> at ${fmt(topExp.amount, settings.currency)}`,
      color: 'var(--accent)', change: '', changeColor: ''
    });
  }

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1 + dashMonthOffset, 0).getDate();
  const dayOfMonth = dashMonthOffset === 0 ? now.getDate() : daysInMonth;
  const daysLeft = daysInMonth - dayOfMonth;
  if(totalExpLast > 0 && daysLeft > 0) {
    const dailyAvg = totalExp / dayOfMonth;
    const projected = dailyAvg * daysInMonth;
    if(projected > totalExpLast * 1.15) {
      insights.push({
        text: `At current pace, you'll spend <strong>${fmt(projected, settings.currency)}</strong> by month end (${((projected / totalExpLast - 1) * 100).toFixed(0)}% over last month)`,
        color: 'var(--orange)', change: 'PROJECTED', changeColor: 'var(--orange)'
      });
    }
  }

  return insights;
}

function getPrompts(monthStart, monthEnd) {
  const t = today();
  const now = new Date();
  const settings = getSettings();
  const prompts = [];

  const recurringList = getRecurringList();
  const upcomingRecurring = recurringList.filter(r => r.active && r.nextDate <= t);
  const futureRecurring = recurringList.filter(r => r.active && r.nextDate > t && r.nextDate <= new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10));

  if(upcomingRecurring.length > 0) {
    const total = upcomingRecurring.reduce((s, r) => s + r.amount, 0);
    prompts.push({ icon: '🔄', bg: 'var(--blue)', title: 'Due Now', text: `${upcomingRecurring.length} recurring charge${upcomingRecurring.length > 1 ? 's' : ''} — ${fmt(total, settings.currency)}` });
  } else if(futureRecurring.length > 0) {
    const total = futureRecurring.reduce((s, r) => s + r.amount, 0);
    prompts.push({ icon: '📅', bg: 'var(--yellow)', title: 'Coming Up', text: `${futureRecurring.length} charge${futureRecurring.length > 1 ? 's' : ''} in 7 days — ${fmt(total, settings.currency)}` });
  }

  const thisMonthExp = getExpenses(monthStart, monthEnd);
  const budgets = getBudgets();
  budgets.forEach(b => {
    const spent = thisMonthExp.filter(e => e.category === b.category).reduce((s, x) => s + x.amount, 0);
    const ratio = spent / b.limit;
    const info = getCat(b.category);
    if(ratio >= 0.85 && ratio < 1.0) {
      prompts.push({ icon: info.icon, bg: 'var(--yellow)', title: 'Budget Warning', text: `${escapeHTML(info.name)}: ${Math.round(ratio * 100)}% used — ${fmt(b.limit - spent, settings.currency)} left` });
    } else if(ratio >= 1.0) {
      prompts.push({ icon: info.icon, bg: 'var(--red)', title: 'Over Budget', text: `${escapeHTML(info.name)}: ${fmt(spent, settings.currency)} of ${fmt(b.limit, settings.currency)} — ${fmt(spent - b.limit, settings.currency)} over` });
    }
  });

  const savingsGoals = getSavingsGoals();
  savingsGoals.forEach(g => {
    const pct = g.target > 0 ? (g.current / g.target) * 100 : 0;
    if(pct >= 80 && pct < 100) {
      prompts.push({ icon: '🎯', bg: 'var(--green)', title: 'Goal Almost There', text: `"${escapeHTML(g.name)}" is ${Math.round(pct)}% — ${fmt(g.target - g.current, settings.currency)} to go` });
    } else if(pct >= 100) {
      prompts.push({ icon: '🎉', bg: 'var(--green)', title: 'Goal Reached', text: `You hit your "${escapeHTML(g.name)}" target!` });
    }
  });

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1 + dashMonthOffset, 0).getDate();
  const dayOfMonth = dashMonthOffset === 0 ? now.getDate() : daysInMonth;
  if(dayOfMonth > 5 && thisMonthExp.length === 0) {
    prompts.push({ icon: '💸', bg: 'var(--accent)', title: 'No Activity', text: `No expenses logged this month yet — ${daysInMonth - dayOfMonth} days left` });
  }

  return prompts;
}

function getBudgetAlerts(monthStart, monthEnd) {
  const settings = getSettings();
  const thisMonthExp = getExpenses(monthStart, monthEnd);
  const budgets = getBudgets();
  if(!budgets.length) return [];

  return budgets.map(b => {
    const spent = thisMonthExp.filter(e => e.category === b.category).reduce((s, x) => s + x.amount, 0);
    const pct = b.limit > 0 ? (spent / b.limit * 100) : 0;
    const info = getCat(b.category);
    let status, statusColor;
    if(pct >= 100) { status = 'Over'; statusColor = 'var(--red)'; }
    else if(pct >= 85) { status = 'Warning'; statusColor = 'var(--yellow)'; }
    else { status = 'On Track'; statusColor = 'var(--green)'; }
    return { category: b.category, name: info.name, icon: info.icon, color: info.color, spent, limit: b.limit, pct: Math.min(pct, 100), status, statusColor };
  }).sort((a, b) => b.pct - a.pct);
}

export function renderDashboard(container) {
  const settings = getSettings();
  const now = new Date();
  const displayDate = new Date(now.getFullYear(), now.getMonth() + dashMonthOffset, 1);
  const monthStart = displayDate.toISOString().slice(0, 7) + '-01';
  const monthEnd = new Date(displayDate.getFullYear(), displayDate.getMonth() + 1, 0).toISOString().slice(0, 10);
  const isCurrentMonth = dashMonthOffset === 0;
  const monthName = displayDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const thisMonthExp = getExpenses(monthStart, monthEnd);
  const thisMonthInc = getIncome(monthStart, monthEnd);
  const totalExp = thisMonthExp.reduce((s, x) => s + x.amount, 0);
  const totalInc = thisMonthInc.reduce((s, x) => s + x.amount, 0);
  const savings = totalInc - totalExp;

  const { score, factors, lastScore, insights: healthInsights } = calcHealthScore(monthStart, monthEnd);
  const scoreColor = score >= 70 ? 'var(--green)' : score >= 50 ? 'var(--yellow)' : 'var(--red)';
  const insights = getInsights(monthStart, monthEnd);
  const prompts = getPrompts(monthStart, monthEnd);
  const catData = sumByCategory(thisMonthExp);
  const budgetAlerts = getBudgetAlerts(monthStart, monthEnd);

  container.innerHTML = `
    <div class="fade-in">
      <div class="header">
        <div>
          <h2>Dashboard</h2>
          <p class="text-sm text-muted">${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div class="header-actions">
          <div class="period-nav">
            <button class="btn btn-ghost btn-sm btn-icon" id="dashPrev" aria-label="Previous month">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span class="period-label">${isCurrentMonth ? 'This Month' : monthName}</span>
            <button class="btn btn-ghost btn-sm btn-icon" id="dashNext" aria-label="Next month" ${isCurrentMonth ? 'disabled' : ''}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            ${!isCurrentMonth ? '<button class="btn btn-ghost btn-sm" id="dashToday">Today</button>' : ''}
          </div>
        </div>
      </div>

      <div class="health-score" role="region" aria-label="Financial health score">
        <div class="health-left">
          <div class="health-ring">
            <canvas id="healthRing" aria-hidden="true"></canvas>
            <div class="score-text">
              <span class="score-num" style="color:${scoreColor}">${score}</span>
              <span class="score-label">Score</span>
            </div>
          </div>
          ${lastScore !== null ? (() => {
            const diff = score - lastScore;
            if (diff > 0) return `<div class="health-change" style="color:var(--green)">&#9650; +${diff} vs last month</div>`;
            if (diff < 0) return `<div class="health-change" style="color:var(--red)">&#9660; ${diff} vs last month</div>`;
            return `<div class="health-change" style="color:var(--text3)">No change vs last month</div>`;
          })() : ''}
        </div>
        <div class="health-factors">
          <div class="health-factor">
            <div class="health-factor-header">
              <span class="health-factor-name">Savings Rate</span>
              <span class="health-factor-val">${factors.savings.pts}/${factors.savings.max}</span>
            </div>
            <div class="progress-bar" style="height:4px">
              <div class="progress-fill" style="width:${(factors.savings.pts / factors.savings.max) * 100}%;background:${factors.savings.rate >= 0.2 ? 'var(--green)' : factors.savings.rate >= 0.1 ? 'var(--yellow)' : 'var(--red)'}"></div>
            </div>
          </div>
          <div class="health-factor">
            <div class="health-factor-header">
              <span class="health-factor-name">Budget Adherence</span>
              <span class="health-factor-val">${factors.budget.pts}/${factors.budget.max}</span>
            </div>
            <div class="progress-bar" style="height:4px">
              <div class="progress-fill" style="width:${(factors.budget.pts / factors.budget.max) * 100}%;background:${factors.budget.pts >= 8 ? 'var(--green)' : factors.budget.pts >= 5 ? 'var(--yellow)' : 'var(--red)'}"></div>
            </div>
          </div>
          <div class="health-factor">
            <div class="health-factor-header">
              <span class="health-factor-name">Spending Trend</span>
              <span class="health-factor-val" style="color:${factors.trend.color}">${factors.trend.label}</span>
            </div>
            <div class="progress-bar" style="height:4px">
              <div class="progress-fill" style="width:${((factors.trend.pts + 5) / 10) * 100}%;background:${factors.trend.color}"></div>
            </div>
          </div>
          ${healthInsights.length ? `
            <div class="health-insights">
              ${healthInsights.map(i => `
                <div class="health-insight" style="color:${i.color}">${i.icon} ${i.text}</div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>

      ${prompts.length ? `
        <div class="prompts-grid" role="list" aria-label="Action prompts">
          ${prompts.map(p => `
            <div class="prompt-card" role="listitem">
              <div class="prompt-icon" style="background:${p.bg}22;color:${p.bg}" aria-hidden="true">${p.icon}</div>
              <div class="prompt-text">
                <div class="prompt-title">${p.title}</div>
                <div class="prompt-value">${p.text}</div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${insights.length ? `
        <div class="insights-panel" role="region" aria-label="Spending insights">
          <div class="insights-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            Insights
          </div>
          ${insights.map(i => `
            <div class="insight-row">
              <div class="insight-dot" style="background:${i.color}" aria-hidden="true"></div>
              <div class="insight-text">${i.text}</div>
              ${i.change ? `<div class="insight-change" style="color:${i.changeColor}">${i.change}</div>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="cards-grid cards-grid-3">
        <div class="card"><div class="card-label">💰 Monthly Income</div><div class="card-value green">${fmt(totalInc, settings.currency)}</div></div>
        <div class="card"><div class="card-label">💸 Monthly Expenses</div><div class="card-value red">${fmt(totalExp, settings.currency)}</div></div>
        <div class="card"><div class="card-label">📊 Net Savings</div><div class="card-value ${savings >= 0 ? 'green' : 'red'}">${fmt(savings, settings.currency)}</div></div>
      </div>

      ${budgetAlerts.length ? `
        <div class="panel mb-20">
          <div class="panel-header">
            <h3>Budget Status</h3>
            <span class="text-sm text-muted">${budgetAlerts.length} budget${budgetAlerts.length > 1 ? 's' : ''}</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(240px,100%),1fr));gap:12px">
            ${budgetAlerts.map(b => `
              <div style="padding:12px;background:var(--bg3)">
                <div class="flex flex-center flex-between mb-8">
                  <div class="flex flex-center gap-8">
                    <span aria-hidden="true">${b.icon}</span>
                    <span class="text-sm" style="font-weight:500">${escapeHTML(b.name)}</span>
                  </div>
                  <span class="badge" style="color:${b.statusColor};border-color:${b.statusColor}">${b.status}</span>
                </div>
                <div class="flex flex-center flex-between text-sm mb-8">
                  <span class="text-muted">${fmt(b.spent, settings.currency)} of ${fmt(b.limit, settings.currency)}</span>
                  <span style="font-weight:600;color:${b.statusColor}">${b.pct.toFixed(0)}%</span>
                </div>
                <div class="progress-bar" style="height:4px">
                  <div class="progress-fill" style="width:${b.pct}%;background:${b.statusColor}"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="grid-3">
        <div class="panel">
          <div class="panel-header">
            <h3>Spending Breakdown</h3>
            <span class="text-sm text-muted">This month</span>
          </div>
          <div class="chart-split" style="display:flex;gap:20px;align-items:center;flex-wrap:wrap">
            <div class="chart-container" style="flex:1;min-width:180px;max-width:280px">
              <canvas id="dashPie" aria-label="Spending breakdown pie chart"></canvas>
            </div>
            <div style="flex:1;min-width:200px">
              ${catData.length ? catData.map(c => `
                <div class="flex flex-center flex-between mb-8">
                  <div class="flex flex-center gap-8">
                    <div style="width:10px;height:10px;border-radius:50%;background:${getCat(c.category).color}" aria-hidden="true"></div>
                    <span class="text-sm">${getCat(c.category).icon} ${escapeHTML(getCat(c.category).name)}</span>
                  </div>
                  <span class="text-sm" style="font-weight:600">${fmt(c.amount, settings.currency)}</span>
                </div>
              `).join('') : '<p class="text-muted text-sm">No expenses this month</p>'}
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-header"><h3>Monthly Trend</h3></div>
          <div class="chart-container">
            <canvas id="dashBar" aria-label="Monthly spending trend bar chart"></canvas>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('dashPrev')?.addEventListener('click', () => { dashMonthOffset--; renderDashboard(container); });
  document.getElementById('dashNext')?.addEventListener('click', () => { if(dashMonthOffset < 0) { dashMonthOffset++; renderDashboard(container); } });
  document.getElementById('dashToday')?.addEventListener('click', () => { dashMonthOffset = 0; renderDashboard(container); });

  setTimeout(() => {
    drawHealthRing('healthRing', score);
    drawPieChart('dashPie', catData, totalExp, settings.currency);
    const last6 = [];
    const labels = [];
    for(let i = 5; i >= 0; i--) {
      const d = new Date(displayDate.getFullYear(), displayDate.getMonth() - i, 1);
      const ms = d.toISOString().slice(0, 7) + '-01';
      const me = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
      last6.push(getExpenses(ms, me).reduce((s, x) => s + x.amount, 0));
      labels.push(d.toLocaleDateString('en-US', { month: 'short' }));
    }
    drawBarChart('dashBar', last6, labels, '#6c5ce7', settings.currency);
  }, 50);
}
