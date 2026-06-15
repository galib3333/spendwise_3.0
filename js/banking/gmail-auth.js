// ===== GMAIL OAUTH (Google Identity Services) =====
// Client-side OAuth using implicit grant flow — no server needed

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const CONNECTED_KEY = 'sw_gmail_connected';

let _tokenClient = null;
let _accessToken = null;
let _tokenExpiry = 0;
let _onChange = null;

export function onConnectionChange(fn) {
  _onChange = fn;
}

function notifyChange(connected) {
  if (_onChange) _onChange(connected);
}

export function isGmailConnected() {
  return localStorage.getItem(CONNECTED_KEY) === 'true';
}

export function getAccessToken() {
  if (_accessToken && Date.now() < _tokenExpiry) return _accessToken;
  return null;
}

export function initGmailAuth(clientId) {
  return new Promise((resolve) => {
    if (!window.google || !window.google.accounts) {
      console.warn('[SpendWise] Google Identity Services not loaded. Check if the script tag is in index.html.');
      resolve(false);
      return;
    }

    _tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GMAIL_SCOPE,
      callback: (tokenResponse) => {
        console.debug('[SpendWise] Gmail OAuth callback fired:', tokenResponse.error || 'success');
        if (tokenResponse.error) {
          console.error('Gmail auth error:', tokenResponse.error);
          notifyChange(false);
          return;
        }
        _accessToken = tokenResponse.access_token;
        _tokenExpiry = Date.now() + (tokenResponse.expires_in * 1000) - 60000;
        localStorage.setItem(CONNECTED_KEY, 'true');
        notifyChange(true);
      },
      error_callback: (err) => {
        console.error('[SpendWise] Gmail auth error_callback:', err);
        notifyChange(false);
      },
    });

    resolve(true);
  });
}

export function requestGmailAccess() {
  if (!_tokenClient) {
    console.error('Gmail auth not initialized. Call initGmailAuth first.');
    return false;
  }
  console.debug('[SpendWise] Requesting Gmail access...');
  _tokenClient.requestAccessToken({ prompt: 'consent' });
  return true;
}

export function disconnectGmail() {
  const token = _accessToken;
  if (token && window.google) {
    window.google.accounts.oauth2.revoke(token, () => {
      // Revoked
    });
  }
  _accessToken = null;
  _tokenExpiry = 0;
  localStorage.removeItem(CONNECTED_KEY);
  notifyChange(false);
}

export function renderGmailStatus() {
  const connected = isGmailConnected();
  return `
    <div class="flex flex-center gap-8" style="margin-top:8px">
      <span style="width:8px;height:8px;border-radius:50%;background:${connected ? 'var(--green)' : 'var(--text3)'}"></span>
      <span class="text-sm" style="color:${connected ? 'var(--green)' : 'var(--text3)'}">
        ${connected ? 'Connected to Gmail' : 'Not connected'}
      </span>
    </div>
  `;
}
