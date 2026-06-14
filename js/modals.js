// ===== MODAL MANAGEMENT =====
export function openModal(id) {
  const modal = document.getElementById(id);
  if(!modal) return;
  modal.classList.add('show');

  // Focus trap
  const focusable = modal.querySelectorAll('input, select, button, textarea, [tabindex]:not([tabindex="-1"])');
  if(focusable.length) focusable[0].focus();

  // Escape key closes
  const handler = (e) => {
    if(e.key === 'Escape') {
      closeModal(id);
      document.removeEventListener('keydown', handler);
    }
  };
  document.addEventListener('keydown', handler);
  modal._escapeHandler = handler;
}

export function closeModal(id) {
  const modal = document.getElementById(id);
  if(!modal) return;
  modal.classList.remove('show');
  if(modal._escapeHandler) {
    document.removeEventListener('keydown', modal._escapeHandler);
    modal._escapeHandler = null;
  }
}

export function initModals() {
  // Close modal on overlay click
  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', e => {
      if(e.target === m) m.classList.remove('show');
    });
  });

  // Close modal via data-close-modal attribute
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal(btn.dataset.closeModal);
    });
  });
}
