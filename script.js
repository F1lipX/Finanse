console.log('🟢 Skrypt działa!');

// 🧠 Token JWT
const token = localStorage.getItem('jwt');
if (!token) location.href = 'login.html';

// 🔓 Logout
const logoutBtn = document.createElement('button');
logoutBtn.textContent = '🚪 Wyloguj';
logoutBtn.onclick = () => {
  localStorage.removeItem('jwt');
  location.href = 'login.html';
};
document.body.prepend(logoutBtn);

// 📦 Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(reg => console.log('🛡️ SW zarejestrowany:', reg.scope))
    .catch(err => console.error('❌ SW błąd:', err));
}

// 🔔 Web Push
if ('serviceWorker' in navigator && 'PushManager' in window) {
  navigator.serviceWorker.ready.then(async reg => {
    try {
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          'BPkPAlNshJlBq3WgeSx8P3O9w95MGVGiRYVInB_0S7cA3fBtL28sZYBD-Syw4TYOJDBGU_3OXoXeZuQM8H1Hh7Q'
        )
      });

      await fetch('https://localhost:3000/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
      });

      console.log('🔔 Subskrypcja Web Push wysłana');
    } catch (err) {
      console.error('❌ Subskrypcja NIEUDANA:', err);
    }
  });
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// 🍪 UID
function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
}
function getCookie(name) {
  return document.cookie.split('; ').reduce((r, v) => {
    const parts = v.split('=');
    return parts[0] === name ? decodeURIComponent(parts[1]) : r;
  }, '');
}
if (!getCookie('finance_uid')) {
  setCookie('finance_uid', 'uid-' + Math.random().toString(36).substring(2), 30);
}

// ⬇️ Pobierz z Mongo
async function loadFromMongo() {
  try {
    const res = await fetch('https://localhost:3000/transactions', {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });
    const transactions = await res.json();
    localStorage.setItem('transactions', JSON.stringify(transactions));
  } catch (err) {
    console.error('❌ Błąd pobierania z Mongo:', err);
  }
}

// 🔁 Renderowanie
function renderTransactions() {
  const list = document.getElementById('transactions');
  const transactions = JSON.parse(localStorage.getItem('transactions')) || [];

  list.innerHTML = '';
  let balance = 0, income = 0, expense = 0;

  transactions.forEach((t, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${t.description} (${t.amount} zł)</span>
      <button class="delete-btn" data-index="${i}">🗑️</button>`;
    list.appendChild(li);

    balance += t.amount;
    if (t.amount > 0) income += t.amount;
    else expense += t.amount;
  });

  document.getElementById('balance').textContent = balance.toFixed(2);
  document.getElementById('income').textContent = income.toFixed(2);
  document.getElementById('expense').textContent = Math.abs(expense).toFixed(2);

  analyzeTransactions(transactions);
}

document.getElementById('transactions').addEventListener('click', (e) => {
  if (e.target.classList.contains('delete-btn')) {
    const index = e.target.dataset.index;
    const data = JSON.parse(localStorage.getItem('transactions')) || [];
    data.splice(index, 1);
    localStorage.setItem('transactions', JSON.stringify(data));
    renderTransactions();
    updateBudgetStatus();
    updateChart();
  }
});

document.getElementById('transaction-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const description = document.getElementById('description').value;
  const amount = parseFloat(document.getElementById('amount').value);
  if (!description || isNaN(amount)) return alert('Uzupełnij dane');

  const transaction = {
    description,
    amount,
    type: amount >= 0 ? 'income' : 'expense',
    date: new Date()
  };

  const transactions = JSON.parse(localStorage.getItem('transactions')) || [];
  transactions.push(transaction);
  localStorage.setItem('transactions', JSON.stringify(transactions));

  try {
    await fetch('https://localhost:3000/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify(transaction)
    });
  } catch (err) {
    console.error('❌ Błąd zapisu do Mongo:', err);
  }

  e.target.reset();
  renderTransactions();
  updateBudgetStatus();
  updateChart();
});

// 💰 Budżet
const budgetInput = document.getElementById('budget');
const budgetForm = document.getElementById('budget-form');
const currentBudgetSpan = document.getElementById('current-budget');
const spentSpan = document.getElementById('spent');
const warning = document.getElementById('budget-warning');
const editBtn = document.getElementById('edit-budget');

let currentBudget = parseFloat(localStorage.getItem('budget')) || 0;
currentBudgetSpan.textContent = currentBudget;

budgetForm.addEventListener('submit', (e) => {
  e.preventDefault();
  currentBudget = parseFloat(budgetInput.value);
  localStorage.setItem('budget', currentBudget);
  currentBudgetSpan.textContent = currentBudget;
  updateBudgetStatus();
  budgetInput.value = '';
});
editBtn.addEventListener('click', () => {
  budgetInput.value = currentBudget;
  budgetInput.focus();
});

function updateBudgetStatus() {
  const tx = JSON.parse(localStorage.getItem('transactions')) || [];
  const expenses = tx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  spentSpan.textContent = expenses.toFixed(2);
  warning.textContent = (currentBudget && expenses > currentBudget) ? '⚠️ Przekroczono budżet!' : '';
}

// 📊 Wykres + analiza
let chart;
function updateChart() {
  const ctx = document.getElementById('finance-chart').getContext('2d');
  const all = JSON.parse(localStorage.getItem('transactions')) || [];
  const month = getCurrentMonth();
  const data = all.filter(t => toMonth(t.date) === month);
  const income = data.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = data.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Przychody', 'Wydatki'],
      datasets: [{
        label: `Finanse (${month})`,
        data: [income, expense],
        backgroundColor: ['#4caf50', '#f44336']
      }]
    },
    options: {
      plugins: { legend: { display: false } }
    }
  });
}

function analyzeTransactions(tx) {
  const month = getCurrentMonth();
  const filtered = tx.filter(t => toMonth(t.date) === month && t.amount < 0);
  if (!filtered.length) return;

  let max = filtered[0];
  const total = filtered.reduce((s, t) => s + Math.abs(t.amount), 0);
  filtered.forEach(t => { if (t.amount < max.amount) max = t; });
  const avg = (total / filtered.length).toFixed(2);

  document.getElementById('analysis-box').innerHTML = `
    <p>📅 Miesiąc: ${month}</p>
    <p>🔺 Największy wydatek: ${max.description} (${max.amount} zł)</p>
    <p>📊 Średni wydatek: ${avg} zł</p>
  `;
}

document.getElementById('toggle-chart').addEventListener('click', () => {
  document.getElementById('chart-container').classList.toggle('hidden');
});

function toMonth(dateStr) {
  return new Date(dateStr).toISOString().slice(0, 7);
}
function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

window.onload = async () => {
  await loadFromMongo();
  renderTransactions();
  updateBudgetStatus();
  updateChart();
  if (Notification.permission !== 'granted') Notification.requestPermission();
};
