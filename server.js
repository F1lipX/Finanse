const fs = require('fs');
const https = require('https');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const webpush = require('web-push');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// 🔐 JWT Secret
const JWT_SECRET = 'tajnehaslo123';

// ✅ Połączenie z MongoDB
mongoose.connect('mongodb://localhost:27017/finance-pwa', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// 📦 MODELE
const Transaction = mongoose.model('Transaction', new mongoose.Schema({
  userId: String,
  type: String,
  amount: Number,
  description: String,
  date: { type: Date, default: Date.now }
}));
const Subscription = mongoose.model('Subscription', new mongoose.Schema({
  endpoint: String,
  keys: Object
}));
const User = mongoose.model('User', new mongoose.Schema({
  email: String,
  password: String // prostota: czysty tekst (w produkcji hashować!)
}));

// 🧠 JWT Middleware
function authenticateJWT(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// 🔐 Rejestracja
app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  const exists = await User.findOne({ email });
  if (exists) return res.status(400).send('Użytkownik już istnieje');
  const user = new User({ email, password });
  await user.save();
  res.status(201).send('Zarejestrowano');
});

// 🔐 Logowanie
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email, password });
  if (!user) return res.status(401).send('Nieprawidłowe dane logowania');
  const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET);
  res.json({ token });
});

// 🔄 TRANSAKCJE
app.get('/transactions', authenticateJWT, async (req, res) => {
  const tx = await Transaction.find({ userId: req.user.id }).sort({ date: -1 });
  res.json(tx);
});

app.post('/transactions', authenticateJWT, async (req, res) => {
  const transaction = new Transaction({ ...req.body, userId: req.user.id });
  await transaction.save();

  const subs = await Subscription.find();
  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub, JSON.stringify({
        title: '💸 Nowa transakcja',
        body: `${transaction.description}: ${transaction.amount} zł`
      }));
    } catch (err) {
      await Subscription.deleteOne({ endpoint: sub.endpoint });
    }
  }

  res.status(201).send('OK');
});

// 🔔 SUBSKRYPCJA
app.post('/subscribe', async (req, res) => {
  const exists = await Subscription.findOne({ endpoint: req.body.endpoint });
  if (!exists) await new Subscription(req.body).save();
  res.status(201).json({});
});

// 🔐 VAPID do WebPush
webpush.setVapidDetails(
  'mailto:kontakt@twojemail.pl',
  'BPkPAlNshJlBq3WgeSx8P3O9w95MGVGiRYVInB_0S7cA3fBtL28sZYBD-Syw4TYOJDBGU_3OXoXeZuQM8H1Hh7Q',
  'K5TD-wq6jjEQGG374_Nzcn9s03ekLNF5DggD9o-kQMg'
);

// 🚀 HTTPS
https.createServer({
  key: fs.readFileSync('localhost-key.pem'),
  cert: fs.readFileSync('localhost.pem')
}, app).listen(3000, () => {
  console.log('✅ HTTPS: https://localhost:3000');
});
