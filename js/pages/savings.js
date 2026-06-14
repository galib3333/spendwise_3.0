// ===== SAVINGS GOALS PAGE =====
import { getSavingsGoals, addGoal, updateGoal, deleteGoal, getTransactions, getSettings } from '../store.js';
import { fmt, validateGoal, uid, today } from '../utils.js';
import { escapeHTML } from '../sanitize.js';
import { toastSuccess, toastInfo, toastError } from '../toast.js';
import { openModal, closeModal } from '../modals.js';
import { drawLineChart } from '../charts.js';

function openAddGoal() {
  document.getElementById('goalEditId').value = '';
  document.getElementById('goalName').value = '';
  document.getElementById('goalTarget').value = '';
  document.getElementById('goalCurrent').value = '0';
  document.getElementById('goalDate').value = '';
  openModal('savingsModal');
}

function openEditGoal(id) {
  const g = getSavingsGoals().find(x => x.id === id);
  if(!g) return;
  document.getElementById('goalEditId').value = g.id;
  document.getElementById('goalName').value = g.name;
  document.getElementById('goalTarget').value = g.target;
  document.getElementById('goalCurrent').value = g.current;
  document.getElementById('goalDate').value = g.date || '';
  openModal('savingsModal');
}

function saveGoal() {
  const name = document.getElementById('goalName').value.trim();
  const target = parseFloat(document.getElementById('goalTarget').value);
  const current = parseFloat(document.getElementById('goalCurrent').value) || 0;
  const date = document.getElementById('goalDate').value;
  const id = document.getElementById('goalEditId').value;

  const errors = validateGoal({ name, target, current });
  if(errors.length) { toastError(errors[0]); return; }

  if(id) {
    updateGoal(id, { name, target, current, date });
    toastSuccess('Goal updated');
  } else {
    addGoal({ id: uid(), name, target, current, date, createdAt: today() });
    toastSuccess('Goal created');
  }
  closeModal('savingsModal');
  renderSavings(document.getElementById('mainContent'));
}

function deleteGoalHandler(id) {
  if(!confirm('Delete this goal?')) return;
  const removed = deleteGoal(id);
  if(removed) {
    toastInfo('Goal deleted', {
      action: () => { addGoal(removed); renderSavings(document.getElementById('mainContent')); },
      actionLabel: 'Undo',
      duration: 5000
    });
  }
  renderSavings(document.getElementById('mainContent'));
}

function getSavingsTrend() {
  const now = new Date();
  const months = [];
  const labels = [];
  const cumulativeData = [];
  let cumulative = 0;

  for(let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ms = d.toISOString().slice(0, 7) + '-01';
    const me = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);

    const monthExp = getTransactions().filter(t => t.type === 'expense' && t.date >= ms && t.date <= me).reduce((s, t) => s + t.amount, 0);
    const monthInc = getTransactions().filter(t => t.type === 'income' && t.date >= ms && t.date <= me).reduce((s, t) => s + t.amount, 0);
    cumulative += (monthInc - monthExp);

    months.push(cumulative);
    labels.push(d.toLocaleDateString('en-US', { month: 'short' }));
  }

  return { data: months, labels };
}

export function renderSavings(container) {
  const settings = getSettings();
  const savingsGoals = getSavingsGoals();
  const totalSaved = savingsGoals.reduce((s, g) => s + g.current, 0);
  const totalTarget = savingsGoals.reduce((s, g) => s + g.target, 0);
  const trend = getSavingsTrend();

  container.innerHTML = `
    <div class="fade-in">
      <div class="header">
        <h2>Savings Goals</h2>
        <button class="btn btn-primary" id="addGoalBtn" aria-label="Add savings goal">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Goal
        </button>
      </div>
      <div class="cards-grid">
        <div class="card savings-card">
          <div class="card-label">💎 Total Saved</div>
          <div class="card-value">${fmt(totalSaved, settings.currency)}</div>
        </div>
        <div class="card"><div class="card-label">🎯 Total Target</div><div class="card-value accent">${fmt(totalTarget, settings.currency)}</div></div>
        <div class="card"><div class="card-label">📊 Overall Progress</div><div class="card-value ${totalTarget ? (totalSaved / totalTarget * 100 >= 100 ? 'green' : 'yellow') : 'accent'}">${totalTarget ? (totalSaved / totalTarget * 100).toFixed(1) : 0}%</div></div>
      </div>
      <div class="panel mb-20">
        <div class="panel-header"><h3>Savings Trend</h3><span class="text-sm text-muted">Last 6 months</span></div>
        <canvas id="savingsTrend" aria-label="Savings trend line chart"></canvas>
      </div>
      <div class="savings-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr));gap:16px">
        ${savingsGoals.length ? savingsGoals.map(g => {
          const pct = g.target ? Math.min((g.current / g.target) * 100, 100) : 0;
          const remaining = Math.max(g.target - g.current, 0);
          const daysLeft = g.date ? Math.max(Math.ceil((new Date(g.date) - new Date()) / (1000 * 60 * 60 * 24)), 0) : null;
          const monthlyNeeded = daysLeft !== null && daysLeft > 0 && remaining > 0 ? remaining / (daysLeft / 30) : null;
          return `
            <div class="panel" style="position:relative;overflow:hidden">
              <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,${pct >= 100 ? 'var(--green)' : 'var(--accent)'},${pct >= 100 ? 'var(--green2)' : 'var(--accent2)'});width:${pct}%"></div>
              <div class="flex flex-center flex-between mb-16">
                <h3 style="font-size:1rem">${escapeHTML(g.name)}</h3>
                <div class="flex gap-8">
                  <button class="btn btn-ghost btn-sm btn-icon" data-action="edit" data-id="${escapeHTML(g.id)}" title="Edit goal" aria-label="Edit ${escapeHTML(g.name)}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button class="btn btn-ghost btn-sm btn-icon" data-action="delete" data-id="${escapeHTML(g.id)}" title="Delete goal" aria-label="Delete ${escapeHTML(g.name)}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  </button>
                </div>
              </div>
              <div class="mb-8">
                <div class="flex flex-center flex-between text-sm mb-8">
                  <span style="font-weight:600;color:var(--green)">${fmt(g.current, settings.currency)}</span>
                  <span class="text-muted">${fmt(g.target, settings.currency)}</span>
                </div>
                <div class="progress-bar" style="height:10px">
                  <div class="progress-fill" style="width:${pct}%;background:${pct >= 100 ? 'var(--green)' : pct >= 70 ? 'var(--yellow)' : 'var(--accent)'}"></div>
                </div>
                <div class="text-sm text-muted mt-8" style="text-align:center">${pct.toFixed(1)}% complete</div>
              </div>
              <div class="savings-subgrid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
                <div style="padding:8px;background:var(--bg3);text-align:center">
                  <div class="text-sm text-muted">Remaining</div>
                  <div style="font-weight:600;font-size:0.85rem">${fmt(remaining, settings.currency)}</div>
                </div>
                <div style="padding:8px;background:var(--bg3);text-align:center">
                  <div class="text-sm text-muted">${daysLeft !== null ? 'Days Left' : 'Target Date'}</div>
                  <div style="font-weight:600;font-size:0.85rem">${daysLeft !== null ? daysLeft + 'd' : g.date || 'None'}</div>
                </div>
              </div>
              ${monthlyNeeded ? `
                <div class="text-sm text-muted mt-8" style="text-align:center">
                  Need ${fmt(monthlyNeeded, settings.currency)}/month to reach goal
                </div>
              ` : ''}
              ${pct >= 100 ? '<div style="text-align:center;margin-top:8px"><span class="badge badge-success">🎉 Goal Reached!</span></div>' : ''}
            </div>
          `;
        }).join('') : '<div class="empty-state" style="grid-column:1/-1"><p>No savings goals yet. Set your first goal!</p></div>'}
      </div>
    </div>
  `;

  document.getElementById('addGoalBtn')?.addEventListener('click', openAddGoal);
  document.getElementById('goalSaveBtn')?.addEventListener('click', saveGoal);

  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if(btn.dataset.action === 'edit') openEditGoal(btn.dataset.id);
      else if(btn.dataset.action === 'delete') deleteGoalHandler(btn.dataset.id);
    });
  });

  setTimeout(() => {
    drawLineChart('savingsTrend', trend.data, trend.labels, '#8faa7b');
  }, 50);
}
