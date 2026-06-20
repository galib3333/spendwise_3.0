// ===== ONBOARDING FLOW =====
import { toastSuccess } from './toast.js';

const ONBOARDING_KEY = 'sw_onboarding_done';
const STEPS = [
  {
    title: 'Welcome to SpendWise',
    text: 'A privacy-first expense tracker. All your data stays on your device — nothing is ever sent to a server.',
    icon: '🔒'
  },
  {
    title: 'Track Expenses',
    text: 'Tap the + button to quickly add expenses. Use the Transactions page for detailed tracking with categories, tags, and payment methods.',
    icon: '💸'
  },
  {
    title: 'Smart Reports',
    text: 'View Weekly, Monthly, and Yearly reports with charts and insights. Your Financial Health Score helps you stay on track.',
    icon: '📊'
  },
  {
    title: 'Budgets & Goals',
    text: 'Set monthly budgets per category and create savings goals. Get alerts when you\'re approaching limits.',
    icon: '🎯'
  },
  {
    title: 'Keyboard Shortcuts',
    text: 'Press ? anytime to see available shortcuts. Numbers 1-9 navigate between pages, Ctrl+N opens quick add.',
    icon: '⌨️'
  },
  {
    title: 'Backup Your Data',
    text: 'Go to Export to download JSON or encrypted backups. We recommend backing up weekly.',
    icon: '💾'
  }
];

export function shouldShowOnboarding() {
  return !localStorage.getItem(ONBOARDING_KEY);
}

export function showOnboarding() {
  let currentStep = 0;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.style.zIndex = '9999';
  overlay.addEventListener('click', e => {
    if (e.target === overlay) finish();
  });
  renderStep();
  document.body.appendChild(overlay);

  function renderStep() {
    const step = STEPS[currentStep];
    const isLast = currentStep === STEPS.length - 1;
    const progress = ((currentStep + 1) / STEPS.length) * 100;

    overlay.innerHTML = `
      <div class="modal" style="max-width:420px;text-align:center">
        <div style="font-size:3rem;margin-bottom:12px">${step.icon}</div>
        <h3 style="margin-bottom:8px">${step.title}</h3>
        <p style="color:var(--text2);font-size:0.85rem;line-height:1.6;margin-bottom:20px">${step.text}</p>
        <div class="progress-bar" style="height:4px;margin-bottom:20px">
          <div class="progress-fill" style="width:${progress}%;background:var(--accent);transition:width 0.3s"></div>
        </div>
        <div class="flex gap-8" style="justify-content:center">
          ${currentStep > 0 ? '<button class="btn btn-ghost" id="onboardPrev">Back</button>' : ''}
          <button class="btn btn-ghost" id="onboardSkip">Skip</button>
          <button class="btn btn-primary" id="onboardNext">${isLast ? 'Get Started' : 'Next'}</button>
        </div>
        <div style="margin-top:12px;font-size:0.7rem;color:var(--text3)">
          Step ${currentStep + 1} of ${STEPS.length}
        </div>
      </div>
    `;

    overlay.querySelector('#onboardNext')?.addEventListener('click', () => {
      if (isLast) {
        finish();
      } else {
        currentStep++;
        renderStep();
      }
    });

    overlay.querySelector('#onboardSkip')?.addEventListener('click', finish);
    overlay.querySelector('#onboardPrev')?.addEventListener('click', () => {
      if (currentStep > 0) {
        currentStep--;
        renderStep();
      }
    });
  }

  function finish() {
    overlay.remove();
    localStorage.setItem(ONBOARDING_KEY, 'true');
    toastSuccess('Welcome to SpendWise!');
  }
}

export function resetOnboarding() {
  localStorage.removeItem(ONBOARDING_KEY);
}
