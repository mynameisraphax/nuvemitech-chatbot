const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const { DateTime } = require('luxon');
const dotenv = require('dotenv');
const fs = require('fs');
const P = require('pino');

dotenv.config();

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

async function connectToWhatsApp() {
  const authPath = process.env.NODE_ENV === 'production' ? '/opt/render/project/src/data/.wwebjs_auth' : './.wwebjs_auth';
  const { state, saveCreds } = await useMultiFileAuthState(authPath);
  const sock = makeWASocket({
    auth: state,
    logger: P({ level: 'error' }),
    printQRInTerminal: false
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log('QR code gerado.');
      qrcode.generate(qr, { small: true });
      console.log('Escaneie o QR code com o WhatsApp Business.');
    }
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.error('Desconectado:', lastDisconnect?.error?.message);
      if (shouldReconnect) {
        setTimeout(() => connectToWhatsApp(), 15000);
      } else {
        console.error('Sessão encerrada. Remova a pasta .wwebjs_auth e reinicie.');
        process.exit(1);
      }
    } else if (connection === 'open') {
      console.log('Chatbot da NuvemITech online!');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  const conversationState = {};
  const pausedConversations = {};
  const ADMIN_NUMBER = '5511962823519@s.whatsapp.net';

  const services = {
    computadores: [
      'Formatação e reinstalação de sistemas',
      'Limpeza interna e externa',
      'Upgrade de hardware (SSD, RAM, processadores)',
      'Atualização de BIOS',
      'Manutenção preventiva e corretiva',
      'Diagnósticos avançados',
      'Recuperação de dados',
      'Configuração de backups e soluções em nuvem',
      'Instalação e configuração de servidores',
      'Suporte remoto para problemas comuns',
      'Instalação de antivírus e segurança digital',
      'Otimização de desempenho para gamers e designers',
    ],
    redes: [
      'Projeto e estruturação de redes',
      'Instalação e configuração de roteadores',
      'Manutenção preventiva de redes',
      'Instalação de cabos e conexões de internet',
      'Configuração de servidores de rede e firewall',
      'Consultoria para melhoria de conexões empresariais',
      'Instalação de VPNs para acesso remoto seguro',
      'Configuração de sistemas de monitoramento remoto',
    ],
    desenvolvimento: [
      'Automatizações de agentes IA Chatbots',
      'Sites Completos ou Landing Pages',
      'Automatizadores de Análise de Dados (Python)',
      'Banco de dados',
      'APIs de consulta',
      'Ferramentas de melhorias para o dia a dia',
    ],
  };

  function getGreeting() {
    const hour = DateTime.now().setZone('America/Sao_Paulo').hour;
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  function saveLead(name, phone, callback) {
    db.run(
      'INSERT INTO leads (name, phone) VALUES (?, ?)',
      [name, phone],
      (err) => {
        if (err) console.error('Erro ao salvar lead:', err.message);
        callback(err);
      }
    );
  }

  async function sendPromotion(promoText, imagePath = './public/promo.jpg') {
    db.all('SELECT phone FROM leads', [], async (err, leads) => {
      if (err) {
        console.error('Erro ao buscar leads para promoção:', err.message);
        return;
      }
      for (const lead of leads) {
        if (pausedConversations[lead.phone]) continue;
        try {
          console.log(`Enviando promoção para ${lead.phone}`);
          const media = {
            mimetype: 'image/jpeg',
            data: fs.readFileSync(imagePath).toString('base64')
          };
          await sock.sendMessage(`${lead.phone.replace('+', '')}@s.whatsapp.net`, {
            image: media,
            caption: promoText
          });
          console.log(`Promoção enviada para ${lead.phone}`);
        } catch (error) {
          console.error(`Erro ao enviar promoção para ${lead.phone}:`, error.message);
        }
      }
    });
  }

  function handleGeneralQuestions(text, name) {
    const lowerText = text.toLowerCase();
    const greeting = getGreeting();
    if (lowerText.includes('que dia') || lowerText.includes('hoje é')) {
      const today = DateTime.now().setZone('America/Sao_Paulo').toFormat('cccc, dd/MM/yyyy');
      return `${greeting}, ${name}! Hoje é ${today}. 😊 Alguma coisa especial planejada ou quer falar sobre como a NuvemITech pode te ajudar?`;
    } else if (lowerText.includes('clima') || lowerText.includes('tempo')) {
      return `${greeting}, ${name}! O clima em São Paulo tá naquele estilo imprevisível, né? 🌦️ Mas não se preocupe, a NuvemITech deixa sua tecnologia sempre no sol! 😎 Quer saber mais sobre nossos serviços?`;
    } else if (lowerText.includes('preço') || lowerText.includes('quanto custa')) {
      return `${greeting}, ${name}! Os preços variam conforme o serviço, mas garanto que são justos e com qualidade top! 😊 Quer que eu te passe mais detalhes ou prefere agendar uma conversa com nossa equipe digitando *AGENDAR*?`;
    } else if (lowerText.includes('onde') || lowerText.includes('localização')) {
      return `${greeting}, ${name}! Estamos em São Paulo! Atendemos presencialmente e remotamente, conforme sua necessidade. 😄 Digite *AGENDAR* para combinar um atendimento ou me conta o que precisa!`;
    }
    return null;
  }

  function generateWelcomeMessage(name) {
    const greeting = getGreeting();
    return `${greeting}, ${name}! 🌩️ *Bem-vindo(a) à NuvemITech!* 🌩️\n\nSomos especialistas em *TI, redes e desenvolvimento* em São Paulo, com anos de experiência transformando tecnologia em resultados! 🚀\n\n*Por que nos escolher?*\n✅ *Expertise*: Já ajudamos centenas de clientes a resolverem problemas complexos.\n✅ *Oferta Exclusiva*: Agende hoje e ganhe uma *análise inicial grátis* (só para os primeiros 10 do mês)!\n✅ *Prova Social*: "A NuvemITech otimizou nossa rede e dobrou nossa produtividade!" - Cliente satisfeito.\n\n*Como posso te ajudar hoje?*\n1️⃣ Computadores\n2️⃣ Redes\n3️⃣ Desenvolvimento\n\nDigite o número da opção ou me conte o que precisa! 😊`;
  }

  async function checkExistingLead(phone, callback) {
    db.get('SELECT name FROM leads WHERE phone = ?', [phone], (err, row) => {
      if (err) {
        console.error('Erro ao consultar lead:', err.message);
        callback(err, null);
      } else {
        callback(null, row ? row.name : null);
      }
    });
  }

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const message = messages[0];
    if (!message.message) return;
    const userId = message.key.remoteJid;
    const text = message.message.conversation || message.message.extendedTextMessage?.text || '';
    const lowerText = text.toLowerCase();
    console.log(`Mensagem recebida de ${userId}: ${text}`);

    if (userId === ADMIN_NUMBER && lowerText.startsWith('pausar ')) {
      const phone = text.split(' ')[1];
      if (phone) {
        pausedConversations[phone] = DateTime.now().plus({ hours: 24 }).toISO();
        await sock.sendMessage(userId, { text: `Conversa com ${phone} pausada por 24 horas.` });
      }
      return;
    }

    if (userId === ADMIN_NUMBER && lowerText.startsWith('retomar ')) {
      const phone = text.split(' ')[1];
      if (phone && pausedConversations[phone]) {
        delete pausedConversations[phone];
        await sock.sendMessage(userId, { text: `Conversa com ${phone} retomada.` });
      }
      return;
    }

    if (pausedConversations[userId.replace('@s.whatsapp.net', '')] && DateTime.now().toISO() < pausedConversations[userId.replace('@s.whatsapp.net', '')]) {
      return;
    }

    if (lowerText === 'enviar promo' && userId === ADMIN_NUMBER) {
      await sendPromotion('🌟 *Oferta Exclusiva NuvemITech!* 20% de desconto na formatação de PCs ou configuração de redes! Agende agora pelo +5511962823519 e aproveite! 🚀');
      await sock.sendMessage(userId, { text: 'Promoção enviada para todos os leads! 🚀' });
      return;
    }

    if (!conversationState[userId]) {
      checkExistingLead(userId.replace('@s.whatsapp.net', ''), async (err, name) => {
        if (err) {
          await sock.sendMessage(userId, { text: `${getGreeting()}! 😊 Algo deu errado, mas vamos começar! Me diz seu nome, por favor!` });
          conversationState[userId] = { step: 'ask_name' };
          return;
        }
        if (name) {
          conversationState[userId] = { step: 'initial', name, phone: userId.replace('@s.whatsapp.net', '') };
          await sock.sendMessage(userId, { text: generateWelcomeMessage(name) });
          await sock.sendMessage(
            ADMIN_NUMBER,
            { text: `Lead retornou! Nome: ${name}, Telefone: ${userId.replace('@s.whatsapp.net', '')}` }
          );
        } else {
          conversationState[userId] = { step: 'ask_name' };
          await sock.sendMessage(userId, { text: `${getGreeting()}! 😊 Antes de começarmos, me diz seu nome, por favor!` });
        }
      });
      return;
    }

    const state = conversationState[userId];

    if (state.step === 'ask_name') {
      state.name = text;
      state.step = 'ask_phone';
      await sock.sendMessage(userId, { text: `Beleza, ${state.name}! 😄 Qual é o seu número de telefone (ex.: +5511999999999)?` });
    } else if (state.step === 'ask_phone') {
      state.phone = text;
      saveLead(state.name, state.phone, async (err) => {
        if (err) {
          await sock.sendMessage(userId, { text: `${getGreeting()}, ${state.name}! Ops, algo deu errado ao salvar seus dados. 😅 Mas não se preocupe, vamos continuar!` });
        } else {
          await sock.sendMessage(userId, { text: `${getGreeting()}, ${state.name}! Dados salvos com sucesso! 🎉` });
          await sock.sendMessage(
            ADMIN_NUMBER,
            { text: `Novo lead capturado! Nome: ${state.name}, Telefone: ${state.phone}` }
          );
        }
        state.step = 'initial';
        await sock.sendMessage(userId, { text: generateWelcomeMessage(state.name) });
      });
    } else if (state.step === 'initial') {
      const generalResponse = handleGeneralQuestions(text, state.name);
      if (generalResponse) {
        await sock.sendMessage(userId, { text: generalResponse });
        return;
      }

      if (lowerText === '1') {
        state.step = 'computadores';
        await sock.sendMessage(userId, {
          text: `${getGreeting()}, ${state.name}! 💻 *Serviços de Computadores* 💻\n\nTemos tudo pra deixar seu computador voando! Desde formatações até otimizações para gamers e designers. Confira:\n\n${services.computadores.join(
            '\n• '
          )}\n\n*Interessado?* Me conta qual serviço você precisa ou digite *AGENDAR* para falar com nossa equipe! 😊\n\n*⚠️ Dica*: Nossos especialistas garantem um serviço rápido e seguro, sem dor de cabeça!`
        });
      } else if (lowerText === '2') {
        state.step = 'redes';
        await sock.sendMessage(userId, {
          text: `${getGreeting()}, ${state.name}! 🌐 *Soluções em Redes* 🌐\n\nProjetamos redes domésticas e empresariais com máxima performance e segurança! Veja o que oferecemos:\n\n${services.redes.join(
            '\n• '
          )}\n\n*Quer melhorar sua conexão?* Me diga como posso ajudar ou digite *AGENDAR* para um atendimento personalizado! 😊\n\n*⚠️ Dica*: Configurações complexas? Deixe com a gente!`
        });
      } else if (lowerText === '3') {
        state.step = 'desenvolvimento';
        await sock.sendMessage(userId, {
          text: `${getGreeting()}, ${state.name}! 💻 *Desenvolvimento Personalizado* 💻\n\nCriamos soluções sob medida, como chatbots e sites incríveis! Confira:\n\n${services.desenvolvimento.join(
            '\n• '
          )}\n\n*Quer transformar sua ideia em realidade?* Me conte mais ou digite *AGENDAR* para falar com nossos desenvolvedores! 😊\n\n*⚠️ Dica*: Projetos personalizados exigem experiência, e nós somos especialistas!`
        });
      } else if (lowerText === 'agendar') {
        await sock.sendMessage(userId, {
          text: `${getGreeting()}, ${state.name}! 🚀 Perfeito! Vamos agendar seu atendimento com a NuvemITech! 📞 Entre em contato pelo *+55 11 96282-3519* ou me diga um horário que te ligamos! 😊\n\n*Oferta Exclusiva*: Agendando hoje, você ganha uma *análise inicial gratuita*!`
        });
        state.step = 'initial';
      } else {
        await sock.sendMessage(userId, {
          text: `${getGreeting()}, ${state.name}! Ops, não entendi! 😅 Digite *1* para Computadores, *2* para Redes, *3* para Desenvolvimento, ou me conte o que precisa!`
        });
      }
    } else if (lowerText === 'agendar') {
      await sock.sendMessage(userId, {
        text: `${getGreeting()}, ${state.name}! 🚀 Beleza! Vamos agendar seu atendimento! 📞 Ligue para *+55 11 96282-3519* ou me diga um horário que entramos em contato! 😊\n\n*Oferta Exclusiva*: Agende agora e ganhe uma *análise inicial grátis*!`
      });
      state.step = 'initial';
    } else {
      const generalResponse = handleGeneralQuestions(text, state.name);
      if (generalResponse) {
        await sock.sendMessage(userId, { text: generalResponse });
      } else {
        await sock.sendMessage(userId, {
          text: `${getGreeting()}, ${state.name}! 😊 Me conta mais sobre o que você precisa ou digite *AGENDAR* para falar com nossa equipe!`
        });
      }
    }
  });

  return sock;
}

connectToWhatsApp().catch(console.error);