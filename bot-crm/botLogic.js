const { getLeadByPhone, addOrUpdateLead, setChatActive } = require('./db');

const STATES = {
  ASK_NAME: 'ask_name',
  ASK_PHONE: 'ask_phone',
  ASK_PROBLEM: 'ask_problem',
  WAIT_HUMAN: 'wait_human',
  CHATTING: 'chatting',
};

const sessions = {};  // sessions por telefone para controlar estado da conversa

function handleMessage(phone, text, sendReply) {
  // text = mensagem recebida do cliente
  // sendReply = callback(texto_resposta) para enviar resposta

  getLeadByPhone(phone, (err, lead) => {
    if (err) {
      sendReply('Ops, ocorreu um erro. Tente mais tarde.');
      return;
    }

    // Se o cliente não está no db, iniciar conversa coletando nome
    if (!lead) {
      if (!sessions[phone]) sessions[phone] = { state: STATES.ASK_NAME };

      const session = sessions[phone];

      switch(session.state) {
        case STATES.ASK_NAME:
          sessions[phone].state = STATES.ASK_PHONE;
          sendReply('Olá! Que bom falar com você. Qual seu nome completo? 😊');
          break;

        case STATES.ASK_PHONE:
          // Aqui espera receber o nome do cliente, mas o telefone já veio via parâmetro
          sessions[phone].name = text.trim();
          sessions[phone].state = STATES.ASK_PROBLEM;
          sendReply(`Obrigado, ${sessions[phone].name}! Agora me conte rapidamente qual serviço ou problema você precisa? Exemplo: formatação, site, rede...`);
          break;

        case STATES.ASK_PROBLEM:
          sessions[phone].problem = text.trim();
          addOrUpdateLead(phone, sessions[phone].name, sessions[phone].problem, () => {
            sessions[phone].state = STATES.WAIT_HUMAN;
            sendReply(`Obrigado, ${sessions[phone].name}! Seu pedido foi registrado. Um especialista da nuvemITech vai entrar em contato com você em breve. 😊`);
          });
          break;

        case STATES.WAIT_HUMAN:
          sendReply(`Olá ${sessions[phone].name}, seu pedido já está registrado. Um especialista vai te ajudar em breve. Obrigado pela paciência!`);
          break;
      }
      return;
    }

    // Se o cliente já existe no banco

    // Se chat está ativo = humano assumiu e bot para de responder
    if (lead.active_chat === 0) {
      // Não responde, só mantém silêncio (pode mandar uma mensagem automatica só na primeira mensagem após assumir)
      return;
    }

    // Se cliente existe, mas conversa não foi concluída (problema ou nome vazio)
    if (!lead.name || !lead.problem) {
      // Continua o fluxo para pegar os dados que faltam
      if (!sessions[phone]) {
        sessions[phone] = { state: !lead.name ? STATES.ASK_PHONE : STATES.ASK_PROBLEM, name: lead.name, problem: lead.problem };
      }

      const session = sessions[phone];
      switch(session.state) {
        case STATES.ASK_PHONE:
          sessions[phone].name = text.trim();
          sessions[phone].state = STATES.ASK_PROBLEM;
          sendReply(`Obrigado, ${sessions[phone].name}! Agora me conte rapidamente qual serviço ou problema você precisa? Exemplo: formatação, site, rede...`);
          break;

        case STATES.ASK_PROBLEM:
          sessions[phone].problem = text.trim();
          addOrUpdateLead(phone, sessions[phone].name, sessions[phone].problem, () => {
            sessions[phone].state = STATES.WAIT_HUMAN;
            sendReply(`Obrigado, ${sessions[phone].name}! Seu pedido foi registrado. Um especialista da nuvemITech vai entrar em contato com você em breve. 😊`);
          });
          break;
      }
      return;
    }

    // Se já tem dados e chat ativo = conversa automatica de aguardar humano
    sendReply(`Olá ${lead.name}, seu pedido já está registrado e aguardando atendimento humano. Obrigado pela paciência!`);
  });
}

function humanAssume(phone) {
  // Chame essa função quando assumir conversa manualmente para pausar respostas do bot
  setChatActive(phone, false);
  delete sessions[phone];
}

function humanRelease(phone) {
  // Quando finalizar atendimento humano e liberar bot pra responder de novo
  setChatActive(phone, true);
  delete sessions[phone];
}

module.exports = { handleMessage, humanAssume, humanRelease };
