console.log('Skrypt działa!');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(reg => console.log('Zarejestrowano Service Workera:', reg.scope))
    .catch(err => console.error('Błąd Service Workera:', err));
}

// Dodawanie transakcji
document.getElementById('transaction-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const description = document.getElementById('description').value;
  const amount = parseFloat(document.getElementById('amount').value);

  if (!description || isNaN(amount)) {
    alert('Uzupełnij poprawnie wszystkie pola.');
    return;
  }

  const transaction = {
    description,
    amount,
    type: amount >= 0 ? 'income' : 'expense',
    date: new Date()
  };

  // Local Storage
  const localTransactions = JSON.parse(localStorage.getItem('transactions')) || [];
  localTransactions.push(transaction);
  localStorage.setItem('transactions', JSON.stringify(localTransactions));

  // MongoDB (przez backend)
  try {
    const res = await fetch('http://localhost:3000/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction)
    });
    const msg = await res.text();
    console.log('✅ MongoDB:', msg);
  } catch (err) {
    console.error('❌ Błąd zapisu do MongoDB:', err);
  }

  // Aktualizacja UI
  renderTransactions();
  e.target.reset();

  // Powiadomienie
  if (Notification.permission === 'granted') {
    new Notification('Nowa transakcja', {
      body: `${description}: ${amount} zł`
    });
  }
});

// Renderowanie listy i bilansu
function renderTransactions() {
  const list = document.getElementById('transactions');
  const localTransactions = JSON.parse(localStorage.getItem('transactions')) || [];

  list.innerHTML = '';
  let balance = 0, income = 0, expense = 0;

  localTransactions.forEach(t => {
    const li = document.createElement('li');
    li.textContent = `${t.description} (${t.amount} zł)`;
    list.appendChild(li);

    balance += t.amount;
    if (t.amount > 0) income += t.amount;
    else expense += t.amount;
  });

  document.getElementById('balance').textContent = balance.toFixed(2);
  document.getElementById('income').textContent = income.toFixed(2);
  document.getElementById('expense').textContent = Math.abs(expense).toFixed(2);
}

// Załaduj dane po starcie
window.onload = () => {
  renderTransactions();

  if (Notification.permission !== 'granted') {
    Notification.requestPermission();
  }
};
