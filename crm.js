const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const dbPath = process.env.NODE_ENV === 'production' ? '/opt/render/project/src/data/leads.db' : './leads.db';
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Erro ao conectar ao SQLite:', err.message);
  else console.log('Conectado ao SQLite.');
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      problem TEXT,
      active_chat INTEGER DEFAULT 1,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    )
  `);
  const defaultUser = 'admin';
  const defaultPassword = 'admin123';
  bcrypt.hash(defaultPassword, 10, (err, hash) => {
    if (err) console.error('Erro ao criar usuário padrão:', err.message);
    db.run(
      'INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)',
      [defaultUser, hash],
      (err) => {
        if (err) console.error('Erro ao inserir usuário padrão:', err.message);
      }
    );
  });
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'seu_segredo_aqui_123',
    resave: false,
    saveUninitialized: false,
  })
);

function isAuthenticated(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login');
}

app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err || !user) {
      return res.render('login', { error: 'Usuário ou senha inválidos' });
    }
    bcrypt.compare(password, user.password, (err, result) => {
      if (result) {
        req.session.user = username;
        res.redirect('/');
      } else {
        res.render('login', { error: 'Usuário ou senha inválidos' });
      }
    });
  });
});

app.get('/', isAuthenticated, (req, res) => {
  db.all('SELECT * FROM leads', [], (err, leads) => {
    if (err) {
      console.error('Erro ao buscar leads:', err.message);
      return res.render('index', { user: req.session.user, leads: [], error: 'Erro ao carregar leads' });
    }
    res.render('index', { user: req.session.user, leads, error: null });
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.listen(port, () => {
  console.log(`CRM rodando na porta ${port}`);
});