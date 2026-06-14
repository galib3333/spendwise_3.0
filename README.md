# SpendWise 2.0

A privacy-first personal expense tracking Progressive Web App (PWA). All data stays on your device — no accounts, no cloud, no tracking.

[![CI](https://github.com/yourusername/spendwise/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/spendwise/actions/workflows/ci.yml)

## Features

- **Transaction Tracking** — Add income/expenses with categories, payment methods, and tags
- **Financial Health Score** — 0-100 score based on savings rate, budget adherence, and trends
- **Smart Reports** — Weekly, Monthly, and Yearly reports with interactive charts
- **Budgets & Goals** — Set spending limits and track savings goals with alerts
- **Recurring Expenses** — Track subscriptions with auto-processing
- **Quick Add** — Floating action button for rapid expense entry
- **CSV/JSON Export** — Download your data anytime
- **Encrypted Backups** — AES-256-GCM encryption via Web Crypto API
- **Bank Import** — Auto-detect HDFC, SBI, ICICI, Axis bank formats
- **PIN Lock** — SHA-256 hashed PIN with brute-force protection
- **PWA** — Works offline, installable on any device
- **Dark/Light Theme** — Easy on the eyes, day or night
- **Keyboard Shortcuts** — Press `?` to see all shortcuts

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | Vanilla JavaScript (ES2022, ES Modules) |
| Framework | None — zero runtime dependencies |
| State | Custom centralized pub/sub store |
| Routing | Custom client-side SPA router |
| Styling | Single CSS file with CSS custom properties |
| Charts | HTML5 Canvas with custom animations |
| Encryption | Web Crypto API (AES-256-GCM, PBKDF2) |
| Offline | Service Worker (network-first + cache) |
| Storage | IndexedDB with localStorage fallback |
| Testing | Vitest (57 tests) |
| Build | Vite (oxc minifier) |

## Getting Started

```bash
# Clone
git clone https://github.com/yourusername/spendwise.git
cd spendwise

# Install (optional — zero runtime dependencies)
npm install

# Development
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Run tests
npm test

# Static server
npm run serve
```

## Project Structure

```
├── index.html              # App shell + modal templates
├── expense-tracker.css     # Complete stylesheet (1764 lines)
├── server.js               # Static file server with security headers
├── sw.js                   # Service Worker
├── manifest.json           # PWA manifest
├── vite.config.js          # Build configuration
├── vitest.config.js        # Test configuration
├── js/
│   ├── app.js              # Entry point, lifecycle
│   ├── store.js            # State management (IndexedDB + localStorage)
│   ├── db.js               # IndexedDB adapter
│   ├── router.js           # SPA router
│   ├── utils.js            # Helpers, validators, CSV utilities
│   ├── sanitize.js         # XSS sanitizer
│   ├── charts.js           # Canvas chart drawing
│   ├── toast.js            # Toast notifications
│   ├── modals.js           # Modal management
│   ├── security.js         # Crypto, PIN hashing, encryption
│   ├── lockscreen.js       # Lock screen UI
│   ├── shortcuts.js        # Keyboard shortcuts
│   ├── onboarding.js       # First-time user flow
│   └── pages/              # Page modules
│       ├── dashboard.js
│       ├── transactions.js
│       ├── reports.js
│       ├── budgets.js
│       ├── recurring.js
│       ├── savings.js
│       ├── export-page.js
│       └── settings.js
├── __tests__/              # Unit tests
│   ├── utils.test.js
│   ├── security.test.js
│   └── sanitize.test.js
├── landing/                # Marketing landing page
│   └── index.html
├── marketing/              # Launch materials
│   └── product-hunt.md
└── .github/workflows/      # CI/CD
    └── ci.yml
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1`-`0` | Navigate between pages |
| `Ctrl+N` | Quick add expense |
| `/` | Focus search |
| `?` | Show shortcuts help |

## Security

- PIN hashing: SHA-256 + random salt
- Brute-force protection: 5 attempts, 30-second lockout
- Auto-lock: Configurable timeout (30s to 30min)
- Encrypted backups: AES-256-GCM with PBKDF2 key derivation
- CSP headers: `object-src 'none'`, `frame-ancestors 'none'`
- No external data transmission — everything stays local

## Browser Support

- Chrome 80+
- Firefox 80+
- Safari 14+
- Edge 80+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm test` to verify
5. Submit a pull request

## License

Private — All rights reserved.
