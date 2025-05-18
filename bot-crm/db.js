const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Caminho absoluto para a raiz (onde está o leads.db)
const dbPath = path.resolve(__dirname, '../leads.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err.message);
  } else {
    console.log('Conectado ao banco leads.db com sucesso.');
  }
});

function getLeadByPhone(phone, cb) {
  db.get('SELECT * FROM leads WHERE phone = ?', [phone], cb);
}

function addOrUpdateLead(phone, name, problem, cb) {
  db.run(
    `INSERT INTO leads (phone, name, problem) VALUES (?, ?, ?)
     ON CONFLICT(phone) DO UPDATE SET name=excluded.name, problem=excluded.problem, active_chat=1`,
    [phone, name, problem],
    function (err) {
      cb && cb(err, this.lastID);
    }
  );
}

function setChatActive(phone, active, cb) {
  db.run(`UPDATE leads SET active_chat = ? WHERE phone = ?`, [active ? 1 : 0, phone], cb);
}

module.exports = { db, getLeadByPhone, addOrUpdateLead, setChatActive };
