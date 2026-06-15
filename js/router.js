// ===== ROUTER / NAVIGATION =====
import { escapeHTML } from './sanitize.js';
let currentPage = 'dashboard';
const pageRenderers = {};

export function registerPage(name, renderFn) {
  pageRenderers[name] = renderFn;
}

export function getCurrentPage() { return currentPage; }

export function navigate(page) {
  if(!pageRenderers[page]) return;
  currentPage = page;

  document.querySelectorAll('.nav-item').forEach(n => {
    const isActive = n.dataset.page === page;
    n.classList.toggle('active', isActive);
    if (isActive) {
      n.setAttribute('aria-current', 'page');
    } else {
      n.removeAttribute('aria-current');
    }
  });

  const main = document.getElementById('mainContent');
  if(main) {
    main.innerHTML = '';
    try {
      pageRenderers[page](main);
    } catch(e) {
      console.error(`Error rendering page "${page}":`, e);
      main.innerHTML = `
        <div style="padding:40px;text-align:center;color:var(--text2)">
          <div style="font-size:3rem;margin-bottom:16px">⚠️</div>
          <h2 style="color:var(--red)">Something went wrong</h2>
          <p style="margin:12px 0">Failed to load the ${escapeHTML(page)} page.</p>
          <p style="margin:0 0 20px;font-size:0.75rem;color:var(--text3)">${escapeHTML(e.message || 'Unknown error')}</p>
          <button onclick="location.reload()" style="margin-top:12px;padding:8px 16px;background:var(--accent);color:#fff;border:none;border-radius:4px;cursor:pointer">Reload Page</button>
        </div>
      `;
    }
  }

  toggleSidebar(false);
}

function toggleSidebar(force) {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('overlay');
  if(!sb || !ov) return;
  const open = force !== undefined ? force : !sb.classList.contains('open');
  sb.classList.toggle('open', open);
  ov.classList.toggle('show', open);

  if(open) {
    const firstFocusable = sb.querySelector('button, [tabindex], a');
    if(firstFocusable) firstFocusable.focus();
  }
}

export function initRouter() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => navigate(item.dataset.page));
    item.addEventListener('keydown', e => {
      if(e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigate(item.dataset.page);
      }
    });
  });

  const hamburger = document.getElementById('hamburgerBtn');
  const overlay = document.getElementById('overlay');
  if(hamburger) hamburger.addEventListener('click', () => toggleSidebar());
  if(overlay) overlay.addEventListener('click', () => toggleSidebar(false));

  document.addEventListener('keydown', e => {
    if(e.key === 'Escape') {
      const sb = document.getElementById('sidebar');
      if(sb && sb.classList.contains('open')) {
        toggleSidebar(false);
      }
    }
  });
}
