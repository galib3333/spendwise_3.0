// ===== HTML SANITIZATION =====
const _div = document.createElement('div');

export function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  _div.textContent = String(str);
  return _div.innerHTML;
}
