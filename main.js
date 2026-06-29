'use strict';

// const { HarmCategory } = require("firebase/ai");
// const { experimentalSetDeliveryMetricsExportedToBigQueryEnabled } = require("firebase/messaging/sw");

const CATEGORIES = {
  income: ['給与', '副業', '賞与', '投資', 'その他収入'],
  expense: ['食費', '交通費', '住居費', '光熱費', '通信費', '娯楽', 'ファッション', 'その他支出']
};

const EXPENSE_COLORS = [
  '#c94040', '#e0763a', '#c8960c', '#2a7c6f',
  '#3a7bbf','#7c5cbf', '#bf3a7c', '#60a060', '#888'
];

const ICONS = {
  income: '+',
  expense: '-'
};

let transactions = JSON.parse(localStorage.getItem('kakeibo_txs') || '[]');
let currentType = 'income';
let currentFilter = 'all';
let viewYear, viewMonth;
let deleteTargetId = null;
let editTargetId = null;

const DOM = {
  currentMonth: document.getElementById('currentMonth'),
  prevMonth: document.getElementById('prevMonth'),
  nextMonth: document.getElementById('nextMonth'),
  totalIncome: document.getElementById('totalIncome'),
  totalExpense: document.getElementById('totalExpense'),
  totalBalance: document.getElementById('totalBalance'),
  btnIncome: document.getElementById('btnIncome'),
  btnExpense: document.getElementById('btnExpense'),
  inputDate: document.getElementById('inputDate'),
  inputAmount: document.getElementById('inputAmount'),
  inputCategory: document.getElementById('inputCategory'),
  inputMemo: document.getElementById('inputMemo'),
  btnAdd: document.getElementById('btnAdd'),
  txList: document.getElementById('transactionList'),
  emptyMsg: document.getElementById('emptyMsg'),
  donutChart: document.getElementById('donutChart'),
  trendChart: document.getElementById('trendChart'),
  chartLegend: document.getElementById('chartLegend'),
  modalOverlay: document.getElementById('modalOverlay'),
  modalCancel: document.getElementById('modalCancel'),
  modalConfirm: document.getElementById('modalConfirm'),
  toast: document.getElementById('toast'),
  filterBtns: document.querySelectorAll('.filter-btn'),
  btnCsv: document.getElementById('btnCsv')
};

function init() {
  const now = new Date();
  viewYear = now.getFullYear();
  viewMonth = now.getMonth() + 1;

  const today = now.toISOString().split('T')[0];
  DOM.inputDate.value = today;
  DOM.inputDate.max = today;

  updateCategoryOptions();
  render();
  bindEvents();
}


// イベントバインドから続き
function bindEvents() {
  DOM.prevMonth.addEventListener('click', () => {
    viewMonth--;
    if (viewMonth < 1) {
      viewMonth = 12; viewYear--;
    }
    render();
  });
  DOM.nextMonth.addEventListener('click', () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if(
      viewYear > currentYear ||
      (viewYear === currentYear && viewMonth >= currentMonth)
    ) {
      return;
    }

    viewMonth++;
    if (viewMonth > 12) {
      viewMonth = 1; viewYear++;
    }
    render();
  });

  DOM.btnIncome.addEventListener('click', () => switchType('income'));
  DOM.btnExpense.addEventListener('click', () => switchType('expense'));

  DOM.btnAdd.addEventListener('click', addTransaction);
  DOM.btnCsv.addEventListener('click', exportCSV);

  DOM.filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.filterBtns.forEach(b => b.classList.remove('filter-btn--active'));
      btn.classList.add('filter-btn--active');
      currentFilter = btn.dataset.filter;
      renderList();
    });
  });

  DOM.modalCancel.addEventListener('click', closeModal);
  DOM.modalOverlay.addEventListener('click', e => {
    if (e.target === DOM.modalOverlay) closeModal();
  });
  DOM.modalConfirm.addEventListener('click', () => {
    deleteTransaction(deleteTargetId);
    closeModal();
  });
  // document.addEventListener('keydown', e => {
  //   if(e.key === 'Enter' && document.activeElement !== DOM.btnAdd && !DOM.modalOverlay.classList.contains('open')) {
  //     addTransaction();
  //   }
  // });

  // DOM.btnAdd.addEventListener('click', addTransaction);
  DOM.inputMemo.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      addTransaction();
    }
  });
}

function switchType(type) {
  currentType = type;
  DOM.btnIncome.classList.toggle('type-toggle__btn--active', type === 'income');
  DOM.btnExpense.classList.toggle('type-toggle__btn--active', type === 'expense');
  updateCategoryOptions();
}

function updateCategoryOptions() {
  DOM.inputCategory.innerHTML = CATEGORIES[currentType]
  .map(c => `<option value="${c}">${c}</option>`)
  .join('');
}

function addTransaction() {
  const date = DOM.inputDate.value;
  const amount = parseInt(DOM.inputAmount.value, 10);
  const category = DOM.inputCategory.value;
  const memo = DOM.inputMemo.value.trim() || category;

  if (!date) return showToast('⚠️ 日付を入力してください');
  if (!amount || amount <= 0) return showToast('⚠️ 正しい金額を入力してください');
  
  if (editTargetId) {
    const tx = transactions.find(t => t.id === editTargetId);
      tx.type = currentType;
      tx.date = date;
      tx.amount = amount;
      tx.category = category;
      tx.memo = memo;

      editTargetId = null;

      DOM.btnAdd.textContent = '追加する';
      currentType = 'income';
      switchType('income');
      updateCategoryOptions();

      showToast('✏️編集しました');
    } else {
      const tx = {
        id: Date.now(),
        type: currentType,
        date,
        amount,
        category,
        memo
      };
      transactions.unshift(tx);

      showToast('✔︎追加しました');
    }
    save();
    DOM.inputAmount.value = '';
    DOM.inputMemo.value = '';
    DOM.inputDate.value = new Date().toISOString().split('T')[0];

    render();
}
  

  // transactions.unshift(tx);
  // save();

  // DOM.inputAmount.value = '';
  // DOM.inputMemo.value = '';

  // showToast('✔︎ 追加しました');
  // render();


function openDeleteModal(id) {
  deleteTargetId = id;
  DOM.modalOverlay.classList.add('open');
}

function closeModal() {
  deleteTargetId = null;
  DOM.modalOverlay.classList.remove('open');
}

function deleteTransaction(id) {
  transactions = transactions.filter(tx => tx.id !== id);
  save();
  showToast('🗑️ 削除しました');
  render();
}

function editTransaction(id) {
  const tx = transactions.find(t => t.id === id);

  if (!tx) return;
  editTargetId = id;
  currentType = tx.type;
  switchType(tx.type);

  DOM.inputDate.value = tx.date;
  DOM.inputAmount.value = tx.amount;
  DOM.inputCategory.value = tx.category;
  DOM.inputMemo.value = tx.memo;

  DOM.btnAdd.textContent = '更新する';

  window.scrollTo ({
    top: 0,
    behavior: 'smooth'
  });
}

function save() {
  localStorage.setItem('kakeibo_txs', JSON.stringify(transactions));
}

function exportCSV() {

  if (transactions.length === 0) {
    showToast('出力するデータがありません');
    return;
  }

  const rows = [
    ['日付', '種別', 'カテゴリ', 'メモ', '金額']
  ];

  transactions.forEach(tx => {
    rows.push([
      tx.date,
      tx.type === 'income' ? '収入' : '支出',
      tx.category,
      tx.memo,
      tx.amount
    ]);
  });

  const csvContent = rows
    .map(row => row.join(','))
    .join('\n');

  const blob = new Blob(
    ['\uFEFF' + csvContent],
    {
      type: 'text/csv;charset=utf-8;'
    }
  );

  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');

  a.href = url;
  a.download = 'kakeibo.csv';

  document.body.appendChild(a);

  a.click();

  document.body.removeChild(a);

  URL.revokeObjectURL(url);

  showToast('CSVを出力しました');
}

function getMonthlyTx() {
  return transactions.filter(tx => {
    const[y, m] = tx.date.split('-').map(Number);
    return y === viewYear && m === viewMonth;
  });
}

function render() {
  updateMonthLabel();
  updateSummary();
  renderList();
  renderChart();
  renderTrendChart();
}

function updateMonthLabel() {
  DOM.currentMonth.textContent = 
  `${viewYear}年 ${String(viewMonth).padStart(2, '0')}月`;
}

function updateSummary() {
  const monthly = getMonthlyTx();
  const income = monthly.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = monthly.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  DOM.totalIncome.textContent = formatYen(income);
  DOM.totalExpense.textContent = formatYen(expense);
  DOM.totalBalance.textContent = formatYen(balance);
}

function renderList() {
  const monthly = getMonthlyTx();
  const filtered = currentFilter === 'all'
  ? monthly
  :monthly.filter(tx => tx.type === currentFilter);

  DOM.txList.innerHTML = '';

  if (filtered.length === 0) {
    DOM.emptyMsg.style.display = 'block';
    return;
  }
  DOM.emptyMsg.style.display = 'none';

  filtered.forEach(tx => {
    const li = document.createElement('li');
    li.className = `tx-item tx-item--${tx.type}`;
    li.dataset.id = tx.id;
    li.innerHTML = `
    <div class="tx-icon">${ICONS[tx.type]}</div>
    <div class="tx-body">
      <div class="tx-top">
        <span class="tx-memo">${escapeHtml(tx.memo)}</span>
        <span class="tx-amount">${tx.type === 'income' ? '+' : '-'}${formatYen(tx.amount)}</span>
      </div>
      <div class="tx-bottom">
        <span class="tx-date">${formatDate(tx.date)}</span>
        <span class="tx-category">${escapeHtml(tx.category)}</span>
      </div>
    </div>
    <button class="tx-edit" data-id="${tx.id}">編集</button>
    <button class="tx-delete" data-id="${tx.id}">×</button>
    `;
    li.querySelector('.tx-delete').addEventListener('click', e => {
      e.stopPropagation();
      openDeleteModal(tx.id);
    });

    li.querySelector('.tx-edit').addEventListener('click', e => {
      e.stopPropagation();
      editTransaction(tx.id);
    });

    DOM.txList.appendChild(li);
  });
}

function renderChart() {
  const canvas = DOM.donutChart;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const monthly = getMonthlyTx();
  const expenses = monthly.filter(t => t.type === 'expense');
  const totalExp = expenses.reduce((s, t) => s + t.amount, 0);

  const map = {};
  expenses.forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount;});
  const data = Object.entries(map)
  .sort((a, b) => b[1]-a[1])
  .map(([label, value], i) => ({
    label,
    value,
    pct: totalExp > 0 ? Math.round(value / totalExp * 100) : 0,
    color: EXPENSE_COLORS[i % EXPENSE_COLORS.length]
  }));

  DOM.chartLegend.innerHTML = '';

  if (data.length === 0) {
    ctx.strokeStyle = '#e8e2d8';
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.arc(W/2, H/2, 80, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#aaa8a0';
    ctx.font = '13px "Shippori Mincho", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('データなし', W/2, H/2);

    DOM.chartLegend.innerHTML = `<p style="color:#aaa;font-size:.85rem;">支出を追加すると<br>グラフが表示されます</p>`;
    return;
  }

  let startAngle = Math.PI / 2;
  const cx = W/2, cy = H/2, r = 80, ringWidth= 24;

  data.forEach(d => {
    const sliceAngle = (d.value / totalExp) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy,r, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = d.color;
    ctx.fill();
    startAngle += sliceAngle;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  ctx.beginPath();
  ctx.arc(cx, cy, r - ringWidth, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.fillStyle = '#1a1714';
  ctx.font = `bold 14px "DM Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(formatYen(totalExp), cx, cy);

  data.forEach(d => {
    const el = document.createElement('div');
    el.className = 'legend-item';
    el.innerHTML = `
    <span class="legend-dot" style="background:${d.color}"></span>
    <span class="legend-label">${d.label}</span>
    <span class="legend-pct">${d.pct}%</span>
    `;
    DOM.chartLegend.appendChild(el);
  });
}

function renderTrendChart() {
  const canvas = DOM.trendChart;
  const ctx = canvas.getContext('2d');

  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  const monthlyData = {};

  transactions.forEach(tx => {
    const[year, month] = tx.date.split('-');

    const key = `${year}-${month}`;

    if (!monthlyData[key]) {
      monthlyData[key] = 0;
    }

    if (tx.type === 'expense') {
      monthlyData[key] += tx.amount;
    }
  });

  const entries = Object.entries(monthlyData)
  .sort((a, b) => a[0].localeCompare(b[0]));

  if (entries.length < 2) {
    ctx.fillStyle = '#999';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';

    ctx.fillText(
      'データが不足しています',
      W / 2,
      H / 2
    );

    return;
  }

  const values = entries.map(e => e[1]);

  const maxValue = Math.max(...values);

  const chartWidth = W - 80;
  const chartHeight = H - 80;

  ctx.strokeStyle = '#ddd';

  ctx.beginPath();
  ctx.moveTo(50, 20);
  ctx.lineTo(50, H - 40);
  ctx.lineTo(W - 20, H - 40);
  ctx.stroke();

  ctx.strokeStyle = '#c94040';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.beginPath();

  entries.forEach(([month, value], index) => {
    const x =
    50 +
    (index * chartWidth) /
    (entries.length - 1);

    const y = 
    H - 
    40 -
    (value / maxValue
    ) *
    chartHeight;

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();

  entries.forEach(([month, value], index) => {
    const x =
    50 *
    (index + chartWidth) /
    (entries.length - 1);

    const y = 
    H - 
    40 -
    (value / maxValue
    ) *
    chartHeight;

    ctx.fillStyle ='#c94040';

    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#666';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';

    ctx.fillText (
      month.slice(5),
      x,
      H - 15
    );
  });
}

function formatYen(n) {
  return '¥' + n.toLocaleString('ja-JP');
}

function formatDate(dateStr) {
  const [, m, d] = dateStr.split('-');
  return `${parseInt(m)}月${parseInt(d)}日`;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g, '&#039;');
}

let toastTimer;
function showToast(msg) {
  DOM.toast.textContent = msg;
  DOM.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => DOM.toast.classList.remove('show'), 2500);
}

init();