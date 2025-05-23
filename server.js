// Importujemy potrzebne biblioteki
const express = require('express');           // Framework do tworzenia serwera HTTP
const mongoose = require('mongoose');         // Biblioteka do pracy z bazą MongoDB
const cors = require('cors');                 // Umożliwia połączenie z innymi źródłami (np. frontend)
const bodyParser = require('body-parser');    // Odczytuje dane z żądań typu POST
const path = require('path');                 // Narzędzie do obsługi ścieżek systemowych

// Tworzymy instancję aplikacji Express
const app = express();

// Middleware – obsługa CORS, JSON i serwowanie plików
app.use(cors()); // pozwala na komunikację z frontendem
app.use(bodyParser.json()); // pozwala odczytać dane przesłane w formacie JSON

// Serwujemy statyczne pliki z katalogu 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Łączymy się z lokalną bazą danych MongoDB
mongoose.connect('mongodb://localhost:27017/finance-pwa', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Tworzymy schemat danych dla pojedynczej transakcji
const TransactionSchema = new mongoose.Schema({
  type: String,          // 'income' lub 'expense'
  amount: Number,        // Kwota (np. 100)
  description: String,   // Opis transakcji
  date: {                // Data transakcji
    type: Date,
    default: Date.now
  }
});

// Tworzymy model do obsługi kolekcji 'transactions'
const Transaction = mongoose.model('Transaction', TransactionSchema);

// Endpoint POST do dodawania nowej transakcji do bazy danych
app.post('/transactions', async (req, res) => {
  try {
    const transaction = new Transaction(req.body); // Tworzymy nową transakcję z danych przesłanych z frontu
    await transaction.save();                      // Zapisujemy ją w MongoDB
    res.status(201).send('✅ Dodano transakcję');
  } catch (err) {
    console.error(err);
    res.status(500).send('❌ Błąd dodawania transakcji');
  }
});

// Endpoint GET do pobierania wszystkich transakcji
app.get('/transactions', async (req, res) => {
  try {
    const transactions = await Transaction.find().sort({ date: -1 }); // najnowsze pierwsze
    res.json(transactions); // Zwracamy dane jako JSON
  } catch (err) {
    console.error(err);
    res.status(500).send('❌ Błąd pobierania danych');
  }
});

// Uruchamiamy serwer na porcie 3000
app.listen(3000, () => {
  console.log('🚀 Serwer działa na http://localhost:3000');
});
