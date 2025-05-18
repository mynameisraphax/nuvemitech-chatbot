const express = require('express');
const bodyParser = require('body-parser');
const { handleMessage } = require('./botLogic');

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

app.post('/webhook', (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).send('Faltam dados (phone, message)');
  }

  handleMessage(phone, message, (reply) => {
    res.json({ reply });
  });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Bot rodando na porta ${PORT}`));
