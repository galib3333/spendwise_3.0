# SpendWise 3.0 — Codebase Reference

> Last updated: 2026-06-16. This file documents the architecture, conventions, known issues, and gotchas for future development.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Language | Vanilla JavaScript (ES2022, ES Modules) |
| Build | Vite 6.x with oxc minifier |
| Testing | Vitest 3.x with jsdom |
| Storage | IndexedDB (primary) + localStorage (fallback) |
| PWA | Service worker (`public/sw.js`) — runtime caching only |
| Deploy | Netlify (auto-deploy from `origin/master`) |
| Auth | Google Identity Services (GIS) — client-side OAuth implicit flow |

---

## Directory Structure

```
spendwise_3.0/
├── index.html              # Single-page app shell
├── expense-tracker.css     # All styles
├── manifest.json           # PWA manifest
├── netlify.toml            # Netlify headers config
├── public/
│   └── sw.js               # Service worker (runtime caching)
├── js/
│   ├── app.js              # Entry point — boot, nav, init
│   ├── router.js           # SPA routing (registerPage/navigate)
│   ├── store.js            # Centralized state (IndexedDB + localStorage)
│   ├── db.js               # IndexedDB adapter
│   ├── utils.js            # Constants, formatters, date helpers, CSV
│   ├── helpers.js          # Shared UI helpers (renderCard, ICONS, etc.)
│   ├── charts.js           # Canvas chart drawing (pie, bar, line, health ring)
│   ├── modals.js           # Modal open/close/focus trap
│   ├── toast.js            # Toast notifications
│   ├── sanitize.js         # HTML escaping
│   ├── security.js         # PIN/lock crypto (SHA-256, AES-GCM)
│   ├── lockscreen.js       # Lock screen UI and PIN flow
│   ├── shortcuts.js        # Keyboard shortcuts
│   ├── onboarding.js       # First-time user onboarding
│   ├── banking/
│   │   ├── email-parser.js     # Parser registry + auto-detection
│   │   ├── bkb-adapter.js      # bKash email parser
│   │   ├── ebl-adapter.js      # EBL email parser
│   │   ├── gmail-auth.js       # Google OAuth (GIS implicit flow)
│   │   ├── gmail-fetcher.js    # Gmail API fetch + parse
│   │   └── balance-tracker.js  # Running balance calculator
│   └── pages/
│       ├── dashboard.js        # Main dashboard
│       ├── transactions.js     # Transaction list + CRUD
│       ├── reports.js          # Weekly/monthly/yearly reports
│       ├── budgets.js          # Budget management
│       ├── recurring.js        # Recurring expenses
│       ├── savings.js          # Savings goals
│       ├── settings.js         # App settings
│       ├── export-page.js      # Export/import/backup
│       ├── business.js         # Business mode pages
│       └── banking.js          # Banking dashboard
└── __tests__/
    ├── utils.test.js
    ├── security.test.js
    ├── sanitize.test.js
    ├── heavy-traffic.test.js
    └── email-parser.test.js
```

---

## Conventions

### State Management (`store.js`)
- Single `state` object with arrays for each entity
- Getters return copies (`[...state.X]`) to prevent external mutation
- **Generic CRUD factory** reduces repetition: `crudOps(key, stateKey)` returns `{ add, update, remove }`
- CRUD exports: `addX(data)`, `updateX(id, data)`, `deleteX(id)`
- `persistSync()` — sync localStorage, async IndexedDB (fire-and-forget)
- `subscribe(key, fn)` — pub/sub for reactive updates
- All persistence dual-mode: IndexedDB primary, localStorage fallback

### Page Module Pattern
```js
import { renderCard, renderCatOptions, ICONS } from '../helpers.js';

export function renderX(container) {
  // 1. Read state from store
  // 2. Set container.innerHTML with HTML (use renderCard, ICONS, etc.)
  // 3. Bind event listeners on elements by ID
}
```
- Pages receive `container` (the `#mainContent` element)
- Event binding happens after `innerHTML` assignment
- Use `?.` for optional chaining on DOM queries
- Store container refs in module-level vars for callbacks
- Use `renderCard(label, value, colorClass)` for metric cards
- Use `renderCatOptions(cats, selected)` for category `<select>` elements
- Use `ICONS.xxx` for inline SVG icons (edit, delete, plus, close, etc.)

### Date Handling
- **ALWAYS use local dates, never UTC** — use `YYYY-MM-DD` format
- `today()` returns local date as `YYYY-MM-DD`
- `parseLocalDate(str)` — creates Date from `YYYY-MM-DD` string (local time)
- `toDateStr(date)` — formats Date as `YYYY-MM-DD` (local time)
- `addDays(dateStr, n)` / `addMonths(dateStr, n)` — arithmetic on date strings
- `getMonthStart(offset)` / `getMonthEnd(offset)` — month boundaries
- Date construction: use template literals with `padStart`
  ```js
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  ```
- **NEVER use** `toISOString().slice(0,10)` for user-facing dates (returns UTC)

### Navigation
- Import `navigate` from `../router.js`
- `registerPage(name, renderFn)` in `app.js`
- Nav items defined in `PERSONAL_NAV` / `BUSINESS_NAV` strings in `app.js`
- `data-page="name"` attribute on `.nav-item` elements

### Modals
- Use `openModal(id)` / `closeModal(id)` from `modals.js`
- Modals defined inline in `index.html`
- Escape key auto-closes via `openModal`
- `data-close-modal="id"` attribute on close buttons
- For dynamic modals, use `createModal(html)` from `helpers.js`

### Testing
- `npm test` — run all tests
- `npm run test:watch` — watch mode
- Tests in `__tests__/` directory
- Follow existing patterns in `utils.test.js`

---

## Critical Architecture Decisions

### Privacy-First
- **Zero server communication** — all data stays on device
- No analytics, no telemetry, no remote calls (except Gmail API)
- Banking module uses Gmail API with user OAuth consent

### Banking Module
- Gmail API implicit grant flow (no backend needed)
- Refresh tokens NOT used (implicit flow doesn't provide them)
- Access token stored in memory only (lost on tab close)
- `CONNECTED_KEY = 'sw_gmail_connected'` in localStorage
- Email parsers: `bkb-adapter.js` (bKash), `ebl-adapter.js` (EBL)
- `detectProvider(from, subject)` → auto-detects provider
- `parseEmailAuto(subject, body, from, date)` → parses any supported email

### IndexedDB Schema
- Stores: `transactions`, `budgets`, `savingsGoals`, `recurringList`, `settings`, `businessProfile`, `businessTransactions`, `businessCategories`, `bankAccounts`, `bankTransactions`
- `settings` store is key-value (no `keyPath`)
- All others use `{ keyPath: 'id' }`
- `DB_VERSION` in `db.js` — bump when adding stores

---

## Known Issues & Gotchas

### Flaky Test
- `heavy-traffic.test.js` "updates nextDate for 500 recurring items under 500ms" — timing-sensitive, fails intermittently. Not related to code bugs.

### Date Gotchas
- `new Date('YYYY-MM-DDT00:00:00')` parses as local time but `toISOString()` returns UTC
- If user is in UTC+ timezone and it's late evening, `toISOString().slice(0,10)` can return previous day's date
- **Solution**: Use `parseLocalDate()`/`toDateStr()` or template literal date construction

### Service Worker
- Moved to `public/sw.js` — Vite copies to `dist/sw.js`
- Uses runtime caching only (no precache — Vite hashes filenames)
- Old `sw.js` at root was deleted

### Netlify
- `netlify.toml` overrides Permissions-Policy headers
- Platform headers may cause CORS issues — `netlify.toml` fixes this

### OAuth Setup
- User type MUST be "External" for personal Gmail accounts
- Test users must be added AND accept invitation email
- App stays in "Testing" mode — no Google review needed for personal use
- Client ID stored in `localStorage` under `sw_gmail_client_id`

---

## When Refactoring

1. **Run `npm test` and `npm run build`** before committing
2. **Check all date handling** — ensure local dates, not UTC
3. **Check imports** — unused imports cause warnings, missing imports cause runtime crashes
4. **Check null safety** — use `?.` for DOM queries that may not exist
5. **Check event listener cleanup** — prevent stacking (see `modals.js`, `banking.js`)
6. **Check container refs** — callbacks should use stored refs, not re-query DOM
7. **Check for `document.getElementById('mainContent')`** — should use `container` param
8. **Use shared helpers** — `renderCard`, `renderCatOptions`, `ICONS` from `helpers.js`

---

## File-Specific Notes

| File | Notes |
|------|-------|
| `app.js` | Nav strings (`PERSONAL_NAV`, `BUSINESS_NAV`) are large HTML templates |
| `store.js` | Generic CRUD factory (`crudOps`) — add/update/delete for all entities; `clearAllData()` must clear ALL stores |
| `helpers.js` | Shared UI: `renderCard`, `renderEmptyState`, `renderCatOptions`, `createModal`, `ICONS` |
| `utils.js` | Date helpers: `parseLocalDate`, `toDateStr`, `addDays`, `addMonths`; query helpers: `getExpenses`, `getIncome`, `sumByCategory` |
| `db.js` | `idbPutAll` clears store before insert — data loss risk on partial failure |
| `charts.js` | `Math.max(...data)` can overflow with large arrays — use `reduce` |
| `security.js` | PIN hash: SHA-256(salt + pin), encryption: AES-GCM with PBKDF2 |
| `lockscreen.js` | `handlePinComplete` wraps async calls in try/catch to prevent UI freeze |
| `banking.js` | `_unsubscribeConnection` prevents listener stacking on re-render |
| `gmail-auth.js` | No refresh token — user re-authenticates when token expires (~60min) |
| `email-parser.js` | Registry pattern — adapters self-register via `registerAdapter()` |

---

## Lightweight Refactoring (Phase 2)

### Shared Helpers (`js/helpers.js`)
- `renderCard(label, value, colorClass)` — renders a metric card
- `renderEmptyState(message)` — renders empty state with text
- `renderCatOptions(cats, selected)` — renders category `<option>` elements
- `renderExpenseCatOptions(selected)` — shortcut for expense categories
- `bindPeriodNav(container, prefix, getOffset, setOffset, onNavigate)` — binds period nav
- `bindDataActions(container, handlers)` — binds data-action buttons (edit/delete/sync)
- `createModal(html)` — creates dynamic modal overlay, returns `{ overlay, close }`
- `ICONS` — exported SVG icon strings:
  - `edit`, `delete`, `plus`, `close`, `bank`
  - `search`, `filter`, `info`
  - `chevronLeft`, `chevronRight`
  - `play`, `pause`

### Date Helpers (`js/utils.js`)
- `parseLocalDate(dateStr)` — creates Date from `YYYY-MM-DD` string (local time, not UTC)
- `toDateStr(date)` — formats Date as `YYYY-MM-DD` (local time, not UTC)
- `addDays(dateStr, days)` — adds N days to date string, returns new string
- `addMonths(dateStr, months)` — adds N months to date string, returns new string
- **NEVER use** `toISOString().slice(0,10)` — it returns UTC date and can shift to previous day in UTC+ timezones

### Store CRUD Factory (`js/store.js`)
```js
function crudOps(key, stateKey) {
  return {
    add(data) { ... },
    update(id, data) { ... },
    remove(id) { ... }
  };
}
```
- Used for: transactions, budgets, savingsGoals, recurringList, businessTransactions, businessCategories, bankAccounts, bankTransactions
- Each entity gets exported `addX`, `updateX`, `deleteX` functions

---

## Commands

```bash
npm run dev          # Start dev server (localhost:5173)
npm run build        # Production build to dist/
npm run preview      # Preview production build
npm test             # Run all tests
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
```
