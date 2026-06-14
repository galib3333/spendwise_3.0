// ===== TOAST NOTIFICATION SYSTEM =====
let toastContainer = null;
const toastQueue = [];
const MAX_TOASTS = 5;

function ensureContainer() {
  if(!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.setAttribute('role', 'status');
    toastContainer.setAttribute('aria-live', 'polite');
    toastContainer.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:10000;display:flex;flex-direction:column-reverse;gap:8px;pointer-events:none;';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function showToast(message, options = {}) {
  const { type = 'info', duration = 3000, action = null, actionLabel = 'Undo' } = options;
  const container = ensureContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.style.cssText = 'pointer-events:auto;min-width:280px;max-width:400px;padding:12px 16px;display:flex;align-items:center;gap:12px;font-family:var(--font-mono);font-size:0.7rem;letter-spacing:0.5px;text-transform:uppercase;border:1px solid var(--border);background:var(--bg2);color:var(--text);transform:translateX(120%);transition:transform 0.3s cubic-bezier(0.4,0,0.2,1),opacity 0.3s ease;';

  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠' : 'ℹ';
  const iconColor = type === 'success' ? 'var(--green)' : type === 'error' ? 'var(--red)' : type === 'warning' ? 'var(--yellow)' : 'var(--blue)';

  let html = `<span style="color:${iconColor};font-size:1rem;flex-shrink:0">${icon}</span>`;
  html += `<span style="flex:1">${message}</span>`;

  if(action) {
    html += `<button class="toast-action" style="background:none;border:1px solid var(--border);color:var(--text);padding:4px 10px;font-family:var(--font-mono);font-size:0.6rem;text-transform:uppercase;letter-spacing:1px;cursor:pointer;flex-shrink:0;transition:all 0.2s">${actionLabel}</button>`;
  }

  html += `<button class="toast-close" style="background:none;border:none;color:var(--text3);cursor:pointer;padding:2px;font-size:0.9rem;line-height:1;flex-shrink:0" aria-label="Dismiss">×</button>`;

  toast.innerHTML = html;

  // Event handlers
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => removeToast(toast));

  const actionBtn = toast.querySelector('.toast-action');
  if(actionBtn && action) {
    actionBtn.addEventListener('click', () => {
      action();
      removeToast(toast);
    });
    actionBtn.addEventListener('mouseenter', () => { actionBtn.style.borderColor = 'var(--text)'; });
    actionBtn.addEventListener('mouseleave', () => { actionBtn.style.borderColor = 'var(--border)'; });
  }

  // Close button hover
  closeBtn.addEventListener('mouseenter', () => { closeBtn.style.color = 'var(--text)'; });
  closeBtn.addEventListener('mouseleave', () => { closeBtn.style.color = 'var(--text3)'; });

  container.appendChild(toast);
  toastQueue.push(toast);

  // Limit visible toasts
  while(toastQueue.length > MAX_TOASTS) {
    removeToast(toastQueue[0]);
  }

  // Animate in
  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(0)';
  });

  // Auto-remove
  if(duration > 0) {
    setTimeout(() => removeToast(toast), duration);
  }

  return toast;
}

function removeToast(toast) {
  if(!toast || !toast.parentNode) return;
  toast.style.transform = 'translateX(120%)';
  toast.style.opacity = '0';
  const idx = toastQueue.indexOf(toast);
  if(idx > -1) toastQueue.splice(idx, 1);
  setTimeout(() => { if(toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
}

export function toastSuccess(msg, opts = {}) { return showToast(msg, { ...opts, type: 'success' }); }
export function toastError(msg, opts = {}) { return showToast(msg, { ...opts, type: 'error' }); }
export function toastWarning(msg, opts = {}) { return showToast(msg, { ...opts, type: 'warning' }); }
export function toastInfo(msg, opts = {}) { return showToast(msg, { ...opts, type: 'info' }); }
