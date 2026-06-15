// ===== CONSTANTS =====
export const EXPENSE_CATS = [
  {id:'food',name:'Food & Dining',icon:'🍽️',color:'#f44336'},
  {id:'transport',name:'Transport',icon:'🚗',color:'#2196f3'},
  {id:'bills',name:'Bills & Utilities',icon:'💡',color:'#ff9800'},
  {id:'entertainment',name:'Entertainment',icon:'🎬',color:'#9c27b0'},
  {id:'health',name:'Health',icon:'🏥',color:'#4caf50'},
  {id:'shopping',name:'Shopping',icon:'🛍️',color:'#e91e63'},
  {id:'education',name:'Education',icon:'📚',color:'#00bcd4'},
  {id:'rent',name:'Rent',icon:'🏠',color:'#ff5722'},
  {id:'groceries',name:'Groceries',icon:'🛒',color:'#8bc34a'},
  {id:'subscriptions',name:'Subscriptions',icon:'📱',color:'#673ab7'},
  {id:'personal',name:'Personal Care',icon:'💇',color:'#ffeb3b'},
  {id:'other-exp',name:'Other Expense',icon:'📦',color:'#607d8b'}
];
export const INCOME_CATS = [
  {id:'salary',name:'Salary',icon:'💰',color:'#009688'},
  {id:'freelance',name:'Freelance',icon:'💻',color:'#3f51b5'},
  {id:'investment',name:'Investment',icon:'📈',color:'#795548'},
  {id:'business',name:'Business',icon:'🏢',color:'#ffc107'},
  {id:'gift',name:'Gift',icon:'🎁',color:'#03a9f4'},
  {id:'other-inc',name:'Other Income',icon:'💎',color:'#9e9e9e'}
];
export const ALL_CATS = [...EXPENSE_CATS, ...INCOME_CATS];
export const PAYMENT_LABELS = {cash:'Cash',card:'Debit Card',credit:'Credit Card',upi:'UPI',bank:'Bank Transfer',wallet:'Digital Wallet'};

// ===== HELPERS =====
export function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
export function fmt(n, currency) { return currency + Number(n||0).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2}); }
export function fmtShort(n, currency) { return currency + Number(n||0).toLocaleString('en-IN', {maximumFractionDigits:0}); }
export function today() { return new Date().toISOString().slice(0,10); }

export function formatDate(dateStr, format) {
  if(!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  switch(format) {
    case 'MM/DD/YYYY': return `${m}/${dd}/${y}`;
    case 'DD/MM/YYYY': return `${dd}/${m}/${y}`;
    case 'DD.MM.YYYY': return `${dd}.${m}.${y}`;
    case 'YYYY-MM-DD':
    default: return `${y}-${m}-${dd}`;
  }
}

function getWeekStart(d) { const dt=new Date(d); const day=dt.getDay(); dt.setDate(dt.getDate()-day); return dt; }
export function getCat(id) { return ALL_CATS.find(c=>c.id===id) || {name:'Unknown',icon:'❓',color:'#9aa0b0'}; }

export function getWeekDates(date) {
  const start = getWeekStart(new Date(date));
  const dates = [];
  for(let i=0;i<7;i++) { const d=new Date(start); d.setDate(d.getDate()+i); dates.push(d.toISOString().slice(0,10)); }
  return dates;
}

// ===== CSV ESCAPING =====
export function escapeCSV(val) {
  const s = String(val == null ? '' : val);
  if(s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// ===== CSV PARSING =====
export function parseCSVSimple(text) {
  const rows = [];
  let row = [];
  let current = '';
  let inQuotes = false;

  function pushField() { row.push(current); current = ''; }
  function pushRow() { if(row.length > 0 && row.some(c => c !== '')) rows.push(row); row = []; }

  for(let i = 0; i < text.length; i++) {
    const ch = text[i];
    if(inQuotes) {
      if(ch === '"') {
        if(text[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = false; }
      } else { current += ch; }
    } else {
      if(ch === '"') { inQuotes = true; }
      else if(ch === ',') { pushField(); }
      else if(ch === '\n' || ch === '\r') {
        if(ch === '\r' && text[i + 1] === '\n') i++;
        pushField();
        pushRow();
      } else { current += ch; }
    }
  }
  pushField();
  pushRow();
  return rows;
}

// Bank statement format detection
const BANK_PATTERNS = [
  { name: 'Generic (Date, Description, Amount)', date: 0, desc: 1, amount: 2, type: null },
  { name: 'Generic (Date, Description, Debit, Credit)', date: 0, desc: 1, debit: 2, credit: 3, type: 'split' },
  { name: 'HDFC Bank', date: 0, desc: 2, amount: 3, type: null, dateFormats: ['DD/MM/YYYY', 'DD-MM-YYYY'] },
  { name: 'SBI Bank', date: 0, desc: 3, amount: 5, type: 'split', debit: 4, credit: 5, dateFormats: ['DD/MM/YYYY'] },
  { name: 'ICICI Bank', date: 0, desc: 2, amount: 4, type: null, dateFormats: ['DD/MM/YY'] },
  { name: 'Axis Bank', date: 0, desc: 2, debit: 3, credit: 4, type: 'split', dateFormats: ['DD-MM-YYYY'] },
];

const HEADER_KEYWORDS = {
  date: ['date', 'txn date', 'transaction date', 'posted date', 'value date', 'trans date'],
  description: ['description', 'narration', 'particulars', 'details', 'memo', 'payee', 'merchant', 'transaction'],
  amount: ['amount', 'txn amount', 'transaction amount'],
  debit: ['debit', 'debit amount', 'withdrawal', 'dr'],
  credit: ['credit', 'credit amount', 'deposit', 'cr'],
  category: ['category', 'type', 'txn type'],
  balance: ['balance', 'closing balance', 'available balance']
};

export function detectBankFormat(headers) {
  const lower = headers.map(h => h.toLowerCase().trim());
  const mapping = {};

  for(const [field, keywords] of Object.entries(HEADER_KEYWORDS)) {
    for(let i = 0; i < lower.length; i++) {
      if(keywords.some(kw => lower[i].includes(kw))) {
        mapping[field] = i;
        break;
      }
    }
  }

  const hasDebitCredit = mapping.debit !== undefined || mapping.credit !== undefined;
  const hasAmount = mapping.amount !== undefined;

  if(mapping.date === undefined) return null;

  return {
    mapping,
    isSplitAmount: hasDebitCredit && !hasAmount,
    dateFormats: detectDateFormats(lower)
  };
}

function detectDateFormats(headers) {
  return ['YYYY-MM-DD', 'DD/MM/YYYY', 'DD-MM-YYYY', 'MM/DD/YYYY', 'DD/MM/YY', 'DD.MM.YYYY'];
}

export function mapCSVRow(row, mapping) {
  const get = (field) => {
    const idx = mapping[field];
    return idx !== undefined ? (row[idx] || '').trim() : '';
  };

  let amount = parseFloat(get('amount')) || 0;
  let type = 'expense';

  if(mapping.isSplitAmount) {
    const debit = parseFloat(get('debit')) || 0;
    const credit = parseFloat(get('credit')) || 0;
    if(credit > 0 && debit === 0) { amount = credit; type = 'income'; }
    else { amount = debit || credit; type = 'expense'; }
  } else {
    const raw = get('amount');
    const num = parseFloat(raw) || 0;
    if(num < 0) { amount = Math.abs(num); type = 'expense'; }
    else { amount = num; type = 'income'; }
  }

  let date = get('date');
  date = normalizeDate(date);

  const category = guessCategory(get('description') || get('category'));

  return {
    date,
    type,
    amount,
    category,
    description: get('description').slice(0, 200),
    payment: 'auto',
    tags: ['imported'],
    recurring: false,
    frequency: null
  };
}

function normalizeDate(dateStr) {
  if(!dateStr) return today();
  const s = dateStr.trim();

  if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const parts = s.split(/[\/.\-]/);
  if(parts.length !== 3) return today();

  let [a, b, c] = parts.map(Number);

  if(c > 99 && c < 1000) return today();

  if(c < 100) c += 2000;

  if(a > 12) return `${c}-${String(b).padStart(2,'0')}-${String(a).padStart(2,'0')}`;
  if(b > 12) return `${c}-${String(a).padStart(2,'0')}-${String(b).padStart(2,'0')}`;
  return `${c}-${String(a).padStart(2,'0')}-${String(b).padStart(2,'0')}`;
}

function guessCategory(desc) {
  if(!desc) return 'other-exp';
  const d = desc.toLowerCase();
  if(/food|restaurant|cafe|starbucks|mcdonald|swiggy|zomato|pizza|burger|coffee|tea/.test(d)) return 'food';
  if(/uber|ola|rapido|metro|bus|train|flight|petrol|fuel|parking|taxi/.test(d)) return 'transport';
  if(/electric|electricity|water|gas|internet|wifi|phone|recharge| broadband/.test(d)) return 'bills';
  if(/netflix|hotstar|prime|movie|cinema|game|spotify|youtube|entertainment/.test(d)) return 'entertainment';
  if(/hospital|doctor|pharmacy|medicine|medical|health|clinic/.test(d)) return 'health';
  if(/shop|store|amazon|flipkart|mall|clothing|shoe/.test(d)) return 'shopping';
  if(/school|college|course|book|udemy|coursera|tuition|education/.test(d)) return 'education';
  if(/rent|house|apartment|flat/.test(d)) return 'rent';
  if(/grocery|supermarket|bigbasket|blinkit|zepto|jiomart/.test(d)) return 'groceries';
  if(/subscription|membership|premium|plan/.test(d)) return 'subscriptions';
  if(/salary|payroll|wage/.test(d)) return 'salary';
  if(/freelanc|client|project|consulting/.test(d)) return 'freelance';
  if(/invest|dividend|stock|mutual|fund|interest/.test(d)) return 'investment';
  if(/business|revenue|sales|profit/.test(d)) return 'business';
  if(/gift|bonus|reward|cashback/.test(d)) return 'gift';
  return 'other-exp';
}

// ===== VALIDATION =====
const MAX_AMOUNT = 999999999999; // 999 billion max
const MAX_DESC_LENGTH = 200;
const MAX_TAG_LENGTH = 30;
const MAX_TAGS = 10;

export function validateTransaction(data) {
  const errors = [];
  if(!data.amount || isNaN(data.amount) || data.amount <= 0) errors.push('Amount must be a positive number');
  if(data.amount > MAX_AMOUNT) errors.push('Amount exceeds maximum allowed');
  if(!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) errors.push('Invalid date format');
  if(!data.category) errors.push('Category is required');
  if(!['expense','income'].includes(data.type)) errors.push('Invalid transaction type');
  if(data.payment && !Object.keys(PAYMENT_LABELS).includes(data.payment) && data.payment !== 'auto') errors.push('Invalid payment method');
  if(data.description && data.description.length > MAX_DESC_LENGTH) errors.push(`Description must be ${MAX_DESC_LENGTH} characters or less`);
  if(data.tags && data.tags.length > MAX_TAGS) errors.push(`Maximum ${MAX_TAGS} tags allowed`);
  if(data.tags) {
    for(const tag of data.tags) {
      if(typeof tag === 'string' && tag.length > MAX_TAG_LENGTH) {
        errors.push(`Tag must be ${MAX_TAG_LENGTH} characters or less`);
        break;
      }
    }
  }
  return errors;
}

export function validateBudget(data) {
  const errors = [];
  if(!data.category) errors.push('Category is required');
  if(!data.limit || isNaN(data.limit) || data.limit <= 0) errors.push('Budget limit must be a positive number');
  if(data.limit > MAX_AMOUNT) errors.push('Budget limit exceeds maximum allowed');
  return errors;
}

export function validateGoal(data) {
  const errors = [];
  if(!data.name || !data.name.trim()) errors.push('Goal name is required');
  if(data.name && data.name.length > 100) errors.push('Goal name must be 100 characters or less');
  if(!data.target || isNaN(data.target) || data.target <= 0) errors.push('Target amount must be a positive number');
  if(data.target > MAX_AMOUNT) errors.push('Target amount exceeds maximum allowed');
  if(data.current != null && (isNaN(data.current) || data.current < 0)) errors.push('Current amount cannot be negative');
  return errors;
}

export function validateRecurring(data) {
  const errors = [];
  if(!data.amount || isNaN(data.amount) || data.amount <= 0) errors.push('Amount must be a positive number');
  if(data.amount > MAX_AMOUNT) errors.push('Amount exceeds maximum allowed');
  if(!data.description || !data.description.trim()) errors.push('Description is required');
  if(data.description && data.description.length > MAX_DESC_LENGTH) errors.push(`Description must be ${MAX_DESC_LENGTH} characters or less`);
  if(!data.frequency || !['weekly','biweekly','monthly','quarterly','yearly'].includes(data.frequency)) errors.push('Invalid frequency');
  if(!data.category) errors.push('Category is required');
  if(!data.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(data.startDate)) errors.push('Invalid start date');
  if(!data.nextDate || !/^\d{4}-\d{2}-\d{2}$/.test(data.nextDate)) errors.push('Invalid next date');
  if(data.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(data.endDate)) errors.push('Invalid end date');
  if(data.endDate && data.startDate && data.endDate < data.startDate) errors.push('End date must be after start date');
  return errors;
}

export function validateBusinessTransaction(data) {
  const errors = [];
  if (!data.amount || isNaN(data.amount) || data.amount <= 0) errors.push('Amount must be a positive number');
  if (data.amount > MAX_AMOUNT) errors.push('Amount exceeds maximum allowed');
  if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) errors.push('Invalid date format');
  if (!data.category) errors.push('Category is required');
  if (!['expense', 'income'].includes(data.type)) errors.push('Invalid transaction type');
  if (data.payment && !['cash', 'card', 'bank', 'mobile'].includes(data.payment)) errors.push('Invalid payment method');
  if (data.description && data.description.length > MAX_DESC_LENGTH) errors.push(`Description must be ${MAX_DESC_LENGTH} characters or less`);
  if (data.tax != null && (isNaN(data.tax) || data.tax < 0)) errors.push('Tax must be a non-negative number');
  if (data.taxRate != null && (isNaN(data.taxRate) || data.taxRate < 0 || data.taxRate > 100)) errors.push('Tax rate must be between 0 and 100');
  return errors;
}

export function validateBusinessCategory(data) {
  const errors = [];
  if (!data.name || !data.name.trim()) errors.push('Category name is required');
  if (data.name && data.name.length > 50) errors.push('Category name must be 50 characters or less');
  if (!['expense', 'income'].includes(data.type)) errors.push('Invalid category type');
  if (data.taxRate == null || isNaN(data.taxRate) || data.taxRate < 0 || data.taxRate > 100) errors.push('Tax rate must be between 0 and 100');
  return errors;
}

export function sanitizeImportData(data) {
  if(!data || typeof data !== 'object') return null;
  const clean = {};
  if(Array.isArray(data.transactions)) {
    clean.transactions = data.transactions.filter(t => {
      return t && typeof t === 'object' && t.id && t.amount && t.date && t.type && t.category;
    }).map(t => ({
      id: String(t.id),
      type: ['expense','income'].includes(t.type) ? t.type : 'expense',
      amount: Math.max(0, Number(t.amount) || 0),
      date: String(t.date).slice(0,10),
      category: String(t.category),
      payment: String(t.payment || 'cash'),
      description: String(t.description || '').slice(0, 200),
      tags: Array.isArray(t.tags) ? t.tags.map(tag => String(tag).slice(0, 30)).slice(0, 10) : [],
      recurring: !!t.recurring,
      frequency: t.frequency || null
    }));
  }
  if(Array.isArray(data.budgets)) {
    clean.budgets = data.budgets.filter(b => b && b.category && b.limit).map(b => ({
      id: String(b.id),
      category: String(b.category),
      limit: Math.max(0, Number(b.limit) || 0)
    }));
  }
  if(Array.isArray(data.savingsGoals)) {
    clean.savingsGoals = data.savingsGoals.filter(g => g && g.name && g.target).map(g => ({
      id: String(g.id),
      name: String(g.name).slice(0, 100),
      target: Math.max(0, Number(g.target) || 0),
      current: Math.max(0, Number(g.current) || 0),
      date: g.date || null,
      createdAt: g.createdAt || null
    }));
  }
  if(Array.isArray(data.recurringList)) {
    clean.recurringList = data.recurringList.filter(r => r && r.amount && r.description).map(r => ({
      id: String(r.id),
      amount: Math.max(0, Number(r.amount) || 0),
      description: String(r.description).slice(0, 100),
      frequency: ['weekly','biweekly','monthly','quarterly','yearly'].includes(r.frequency) ? r.frequency : 'monthly',
      category: String(r.category || 'other-exp'),
      startDate: String(r.startDate || today()),
      nextDate: String(r.nextDate || today()),
      endDate: r.endDate || null,
      active: r.active !== false
    }));
  }
  if (data.businessProfile && typeof data.businessProfile === 'object') {
    clean.businessProfile = {
      id: 'profile',
      name: String(data.businessProfile.name || '').slice(0, 100),
      type: ['retail', 'grocery', 'restaurant', 'service', 'pharmacy'].includes(data.businessProfile.type) ? data.businessProfile.type : 'retail',
      taxId: String(data.businessProfile.taxId || '').slice(0, 50)
    };
  }
  if (Array.isArray(data.businessTransactions)) {
    clean.businessTransactions = data.businessTransactions.filter(t => t && typeof t === 'object' && t.amount && t.date && t.type).map(t => ({
      id: String(t.id || uid()),
      type: ['expense', 'income'].includes(t.type) ? t.type : 'expense',
      amount: Math.max(0, Number(t.amount) || 0),
      date: String(t.date).slice(0, 10),
      category: String(t.category || ''),
      description: String(t.description || '').slice(0, 200),
      payment: ['cash', 'card', 'bank', 'mobile'].includes(t.payment) ? t.payment : 'cash',
      tax: Math.max(0, Number(t.tax) || 0),
      taxRate: Math.max(0, Number(t.taxRate) || 0),
      createdBy: String(t.createdBy || 'owner')
    }));
  }
  if (Array.isArray(data.businessCategories)) {
    clean.businessCategories = data.businessCategories.filter(c => c && typeof c === 'object' && c.name).map(c => ({
      id: String(c.id || uid()),
      name: String(c.name).slice(0, 50),
      icon: String(c.icon || '📋').slice(0, 4),
      type: ['expense', 'income'].includes(c.type) ? c.type : 'expense',
      taxRate: Math.max(0, Math.min(100, Number(c.taxRate) || 0))
    }));
  }
  return clean;
}
