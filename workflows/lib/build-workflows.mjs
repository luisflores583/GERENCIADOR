import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultConfig } from './agenda-logic.mjs';

const libDir = path.dirname(fileURLToPath(import.meta.url));
const workflowsDir = path.resolve(libDir, '..');

const GOOGLE_CREDENTIAL = {
  googleCalendarOAuth2Api: {
    id: 'PREENCHER_GOOGLE_CALENDAR',
    name: 'Google Calendar',
  },
};

const WHATSAPP_CREDENTIAL = {
  whatsAppApi: {
    id: 'PREENCHER_WHATSAPP',
    name: 'WhatsApp Cloud API',
  },
};

const TZ = "={{ $('Configuração do consultório').first().json.config.timezone }}";
const GRAPH_URL =
  "={{ 'https://graph.facebook.com/' + $('Configuração do consultório').first().json.config.graphApiVersion + '/' + $('Configuração do consultório').first().json.config.whatsappPhoneNumberId + '/messages' }}";

function read(name) {
  return fs.readFileSync(path.join(libDir, 'n8n', name), 'utf8').trim() + '\n';
}

function librarySource() {
  return fs.readFileSync(path.join(libDir, 'agenda-logic.mjs'), 'utf8').replace(/^export /gm, '');
}

function withLibrary(snippet) {
  return librarySource() + '\n' + snippet;
}

function calendarLocator(value) {
  return { __rl: true, mode: 'id', value };
}

function codeNode(id, name, position, js, notes) {
  const node = {
    id,
    name,
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position,
    parameters: {
      language: 'javaScript',
      mode: 'runOnceForAllItems',
      jsCode: js,
    },
  };
  if (notes) {
    node.notes = notes;
    node.notesInFlow = true;
  }
  return node;
}

function configCode(config, mode) {
  const lines = [
    '// ============================================================',
    '// EDITE ESTE BLOCO.',
    '// Phone Number ID, verify token, calendários e horário de funcionamento.',
    '// Não cole o token de acesso da Meta: ele fica na credencial WhatsApp Cloud API.',
    '// Para outro fisioterapeuta, copie um item de professionals.',
    '// Se alterar horários ou calendarId, repita no workflow de lembretes.',
    '// ============================================================',
    'const CONFIG = ' + JSON.stringify(config, null, 2) + ';',
    '',
  ];
  if (mode === 'webhook') {
    lines.push(
      'const input = $input.first().json;',
      'return [{',
      '  json: {',
      "    entrada: input.entrada || 'mensagem',",
      '    request: {',
      '      headers: input.headers || {},',
      '      query: input.query || {},',
      '      body: input.body || {},',
      '    },',
      '    config: CONFIG,',
      '  },',
      '}];',
    );
  } else {
    lines.push('return [{ json: { config: CONFIG } }];');
  }
  return lines.join('\n');
}

function markCode(entrada) {
  return [
    'const input = $input.first().json;',
    'return [{ json: Object.assign({}, input, { entrada: ' + JSON.stringify(entrada) + ' }) }];',
  ].join('\n');
}

function switchRule(outputKey, value, id) {
  return {
    conditions: {
      options: {
        caseSensitive: true,
        leftValue: '',
        typeValidation: 'loose',
        version: 2,
      },
      conditions: [
        {
          id,
          leftValue: '={{ $json.action }}',
          rightValue: value,
          operator: {
            type: 'string',
            operation: 'equals',
            name: 'filter.operator.equals',
          },
        },
      ],
      combinator: 'and',
    },
    renameOutput: true,
    outputKey,
  };
}

function ifNode(id, name, position, left, right) {
  return {
    id,
    name,
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position,
    parameters: {
      conditions: {
        options: {
          caseSensitive: true,
          leftValue: '',
          typeValidation: 'loose',
          version: 2,
        },
        conditions: [
          {
            id: id + '-cond',
            leftValue: left,
            rightValue: right,
            operator: {
              type: typeof right === 'boolean' ? 'boolean' : 'string',
              operation: 'equals',
            },
          },
        ],
        combinator: 'and',
      },
      options: {},
    },
  };
}

function googleNode(id, name, position, parameters, extra = {}) {
  return {
    id,
    name,
    type: 'n8n-nodes-base.googleCalendar',
    typeVersion: 1.3,
    position,
    parameters,
    credentials: GOOGLE_CREDENTIAL,
    ...extra,
  };
}

function remindersUi() {
  return {
    remindersValues: [
      { method: 'popup', minutes: '={{ $json.reminderMinutes[0] }}' },
      { method: 'popup', minutes: '={{ $json.reminderMinutes[1] }}' },
    ],
  };
}

function whatsAppNode(id, name, position) {
  return {
    id,
    name,
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position,
    parameters: {
      method: 'POST',
      url: GRAPH_URL,
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'whatsAppApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json.whatsappBody) }}',
      options: {},
    },
    credentials: WHATSAPP_CREDENTIAL,
    notes:
      'Usa a credencial nomeada "WhatsApp Cloud API" (tipo WhatsApp API). O Phone Number ID vem da Configuração do consultório, não da credencial.',
  };
}

function connect(connections, from, to, outputIndex = 0) {
  if (!connections[from]) connections[from] = { main: [] };
  while (connections[from].main.length <= outputIndex) connections[from].main.push([]);
  connections[from].main[outputIndex].push({ node: to, type: 'main', index: 0 });
}

function baseWorkflow(name, nodes, connections) {
  return {
    name,
    active: false,
    nodes,
    connections,
    pinData: {},
    settings: {
      executionOrder: 'v1',
      timezone: 'America/Sao_Paulo',
      saveDataErrorExecution: 'all',
      saveDataSuccessExecution: 'all',
    },
    meta: {
      templateCredsSetupCompleted: false,
    },
    tags: [],
  };
}

export function buildAgendaWorkflow(config = defaultConfig()) {
  const nodes = [
    {
      id: 'c0ffee00-0000-4000-8000-000000000001',
      name: 'Leia antes de ativar',
      type: 'n8n-nodes-base.stickyNote',
      typeVersion: 1,
      position: [-80, -40],
      parameters: {
        width: 460,
        height: 280,
        color: 4,
        content:
          '## Agenda da fisioterapia\n\n1. Crie as credenciais **WhatsApp Cloud API** (tipo WhatsApp API) e **Google Calendar** (OAuth2).\n2. Abra **Configuração do consultório** e preencha Phone Number ID, verify token, calendarId e horários.\n3. Associe as credenciais nos nodes do Google Calendar e no node **Enviar WhatsApp**.\n4. Ative o workflow.\n5. Na Meta, o webhook é `https://SEU-N8N/webhook/fisioterapia-whatsapp` (GET e POST).\n\nO menu tem 4 opções, então usa lista interativa. Confirmações usam até 3 botões. O paciente também pode responder 1, 2, 3, 4 ou 0.',
      },
    },
    {
      id: 'c0ffee00-0000-4000-8000-000000000002',
      name: 'Webhook verificação',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [0, 280],
      webhookId: 'b1d0a001-1111-4111-8111-000000000001',
      parameters: {
        httpMethod: 'GET',
        path: 'fisioterapia-whatsapp',
        responseMode: 'responseNode',
        options: {},
      },
    },
    {
      id: 'c0ffee00-0000-4000-8000-000000000003',
      name: 'Webhook mensagens',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [0, 560],
      webhookId: 'b1d0a001-1111-4111-8111-000000000002',
      parameters: {
        httpMethod: 'POST',
        path: 'fisioterapia-whatsapp',
        responseMode: 'responseNode',
        options: {},
      },
    },
    codeNode('c0ffee00-0000-4000-8000-000000000004', 'Marcar verificação', [280, 280], markCode('verificacao')),
    {
      id: 'c0ffee00-0000-4000-8000-000000000005',
      name: 'Responder recebido',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.1,
      position: [280, 560],
      parameters: {
        respondWith: 'noData',
        options: { responseCode: 200 },
      },
    },
    codeNode('c0ffee00-0000-4000-8000-000000000006', 'Marcar mensagem', [520, 560], markCode('mensagem')),
    codeNode(
      'c0ffee00-0000-4000-8000-000000000007',
      'Configuração do consultório',
      [800, 400],
      configCode(config, 'webhook'),
      'Edite o objeto CONFIG. Não coloque o token de acesso da Meta aqui.',
    ),
    ifNode('c0ffee00-0000-4000-8000-000000000008', 'É verificação?', [1120, 400], '={{ $json.entrada }}', 'verificacao'),
    codeNode('c0ffee00-0000-4000-8000-000000000009', 'Validar token', [1400, 220], read('validate-token.js')),
    ifNode('c0ffee00-0000-4000-8000-000000000010', 'Token confere?', [1680, 220], '={{ $json.ok }}', true),
    {
      id: 'c0ffee00-0000-4000-8000-000000000011',
      name: 'Responder challenge',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.1,
      position: [1960, 120],
      parameters: {
        respondWith: 'text',
        responseBody: '={{ $json.challenge }}',
        options: {
          responseCode: 200,
          responseHeaders: {
            entries: [{ name: 'Content-Type', value: 'text/plain' }],
          },
        },
      },
    },
    {
      id: 'c0ffee00-0000-4000-8000-000000000012',
      name: 'Responder token inválido',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.1,
      position: [1960, 320],
      parameters: {
        respondWith: 'text',
        responseBody: 'Token de verificação inválido',
        options: { responseCode: 403 },
      },
    },
    codeNode('c0ffee00-0000-4000-8000-000000000013', 'Roteador da conversa', [1400, 560], withLibrary(read('router.js'))),
    {
      id: 'c0ffee00-0000-4000-8000-000000000014',
      name: 'Escolher ação',
      type: 'n8n-nodes-base.switch',
      typeVersion: 3.2,
      position: [1720, 560],
      parameters: {
        mode: 'rules',
        rules: {
          values: [
            switchRule('send', 'send', 'rule-send'),
            switchRule('freebusy', 'freebusy', 'rule-freebusy'),
            switchRule('list_events', 'list_events', 'rule-list'),
            switchRule('delete_event', 'delete_event', 'rule-delete'),
            switchRule('ignore', 'ignore', 'rule-ignore'),
          ],
        },
        options: { fallbackOutput: 'extra' },
      },
    },
    googleNode(
      'c0ffee00-0000-4000-8000-000000000015',
      'Consultar disponibilidade',
      [2040, 360],
      {
        resource: 'calendar',
        operation: 'availability',
        calendar: calendarLocator('={{ $json.calendarId }}'),
        timeMin: '={{ $json.timeMin }}',
        timeMax: '={{ $json.timeMax }}',
        options: {
          outputFormat: 'raw',
          timezone: calendarLocator(TZ),
        },
      },
      { alwaysOutputData: true, onError: 'continueErrorOutput' },
    ),
    codeNode('c0ffee00-0000-4000-8000-000000000016', 'Montar horários livres', [2320, 360], withLibrary(read('freebusy.js'))),
    {
      id: 'c0ffee00-0000-4000-8000-000000000017',
      name: 'Depois da disponibilidade',
      type: 'n8n-nodes-base.switch',
      typeVersion: 3.2,
      position: [2600, 360],
      parameters: {
        mode: 'rules',
        rules: {
          values: [
            switchRule('send', 'send', 'rule-slots-send'),
            switchRule('create_event', 'create_event', 'rule-create'),
            switchRule('update_event', 'update_event', 'rule-update'),
          ],
        },
        options: { fallbackOutput: 'extra' },
      },
    },
    googleNode(
      'c0ffee00-0000-4000-8000-000000000018',
      'Criar evento',
      [2920, 180],
      {
        resource: 'event',
        operation: 'create',
        calendar: calendarLocator('={{ $json.calendarId }}'),
        start: '={{ $json.start }}',
        end: '={{ $json.end }}',
        useDefaultReminders: false,
        additionalFields: {
          summary: '={{ $json.summary }}',
          description: '={{ $json.description }}',
          location: '={{ $json.location }}',
          showMeAs: 'opaque',
          sendUpdates: 'none',
        },
        remindersUi: remindersUi(),
      },
      { onError: 'continueErrorOutput' },
    ),
    googleNode(
      'c0ffee00-0000-4000-8000-000000000019',
      'Atualizar evento',
      [2920, 420],
      {
        resource: 'event',
        operation: 'update',
        calendar: calendarLocator('={{ $json.calendarId }}'),
        eventId: '={{ $json.eventId }}',
        useDefaultReminders: false,
        updateFields: {
          start: '={{ $json.start }}',
          end: '={{ $json.end }}',
          summary: '={{ $json.summary }}',
          description: '={{ $json.description }}',
          location: '={{ $json.location }}',
          showMeAs: 'opaque',
          sendUpdates: 'none',
        },
        remindersUi: remindersUi(),
      },
      { onError: 'continueErrorOutput' },
    ),
    codeNode('c0ffee00-0000-4000-8000-000000000020', 'Preparar calendários', [2040, 700], read('prepare-list.js')),
    googleNode(
      'c0ffee00-0000-4000-8000-000000000021',
      'Buscar consultas',
      [2320, 700],
      {
        resource: 'event',
        operation: 'getAll',
        calendar: calendarLocator('={{ $json.calendarId }}'),
        returnAll: false,
        limit: 20,
        timeMin: '={{ $json.timeMin }}',
        timeMax: '={{ $json.timeMax }}',
        options: {
          query: '={{ $json.query }}',
          recurringEventHandling: 'expand',
          timeZone: calendarLocator(TZ),
        },
      },
      { alwaysOutputData: true, onError: 'continueErrorOutput' },
    ),
    codeNode('c0ffee00-0000-4000-8000-000000000022', 'Montar consultas', [2600, 700], withLibrary(read('events.js'))),
    googleNode(
      'c0ffee00-0000-4000-8000-000000000023',
      'Apagar evento',
      [2040, 920],
      {
        resource: 'event',
        operation: 'delete',
        calendar: calendarLocator('={{ $json.calendarId }}'),
        eventId: '={{ $json.eventId }}',
        options: { sendUpdates: 'none' },
      },
      { onError: 'continueErrorOutput' },
    ),
    codeNode('c0ffee00-0000-4000-8000-000000000024', 'Mensagem de confirmação', [3200, 420], read('confirm.js')),
    codeNode('c0ffee00-0000-4000-8000-000000000025', 'Avisar falha na agenda', [2600, 980], read('failure.js')),
    whatsAppNode('c0ffee00-0000-4000-8000-000000000026', 'Enviar WhatsApp', [3480, 560]),
    {
      id: 'c0ffee00-0000-4000-8000-000000000027',
      name: 'Ignorar',
      type: 'n8n-nodes-base.noOp',
      typeVersion: 1,
      position: [2040, 1120],
      parameters: {},
    },
  ];

  const connections = {};
  connect(connections, 'Webhook verificação', 'Marcar verificação');
  connect(connections, 'Marcar verificação', 'Configuração do consultório');
  connect(connections, 'Webhook mensagens', 'Responder recebido');
  connect(connections, 'Responder recebido', 'Marcar mensagem');
  connect(connections, 'Marcar mensagem', 'Configuração do consultório');
  connect(connections, 'Configuração do consultório', 'É verificação?');
  connect(connections, 'É verificação?', 'Validar token', 0);
  connect(connections, 'É verificação?', 'Roteador da conversa', 1);
  connect(connections, 'Validar token', 'Token confere?');
  connect(connections, 'Token confere?', 'Responder challenge', 0);
  connect(connections, 'Token confere?', 'Responder token inválido', 1);
  connect(connections, 'Roteador da conversa', 'Escolher ação');
  connect(connections, 'Escolher ação', 'Enviar WhatsApp', 0);
  connect(connections, 'Escolher ação', 'Consultar disponibilidade', 1);
  connect(connections, 'Escolher ação', 'Preparar calendários', 2);
  connect(connections, 'Escolher ação', 'Apagar evento', 3);
  connect(connections, 'Escolher ação', 'Ignorar', 4);
  connect(connections, 'Escolher ação', 'Ignorar', 5);
  connect(connections, 'Consultar disponibilidade', 'Montar horários livres', 0);
  connect(connections, 'Consultar disponibilidade', 'Avisar falha na agenda', 1);
  connect(connections, 'Montar horários livres', 'Depois da disponibilidade');
  connect(connections, 'Depois da disponibilidade', 'Enviar WhatsApp', 0);
  connect(connections, 'Depois da disponibilidade', 'Criar evento', 1);
  connect(connections, 'Depois da disponibilidade', 'Atualizar evento', 2);
  connect(connections, 'Depois da disponibilidade', 'Ignorar', 3);
  connect(connections, 'Criar evento', 'Mensagem de confirmação', 0);
  connect(connections, 'Criar evento', 'Avisar falha na agenda', 1);
  connect(connections, 'Atualizar evento', 'Mensagem de confirmação', 0);
  connect(connections, 'Atualizar evento', 'Avisar falha na agenda', 1);
  connect(connections, 'Preparar calendários', 'Buscar consultas');
  connect(connections, 'Buscar consultas', 'Montar consultas', 0);
  connect(connections, 'Buscar consultas', 'Avisar falha na agenda', 1);
  connect(connections, 'Montar consultas', 'Enviar WhatsApp');
  connect(connections, 'Apagar evento', 'Mensagem de confirmação', 0);
  connect(connections, 'Apagar evento', 'Avisar falha na agenda', 1);
  connect(connections, 'Mensagem de confirmação', 'Enviar WhatsApp');
  connect(connections, 'Avisar falha na agenda', 'Enviar WhatsApp');

  return baseWorkflow('Fisioterapia — agenda no WhatsApp', nodes, connections);
}

export function buildReminderWorkflow(config = defaultConfig()) {
  const nodes = [
    {
      id: 'd0ffee00-0000-4000-8000-000000000001',
      name: 'Como funciona o lembrete',
      type: 'n8n-nodes-base.stickyNote',
      typeVersion: 1,
      position: [-40, 40],
      parameters: {
        width: 480,
        height: 220,
        color: 5,
        content:
          '## Lembrete no WhatsApp do paciente\n\nRoda de hora em hora. Avisa cerca de 24 h e de 1 h antes das consultas marcadas por este atendimento.\n\nMantenha o node **Configuração do consultório** igual ao do workflow da agenda (calendarId, Phone Number ID, fuso e lembretes).\n\nO popup do Google Calendar, configurado no outro workflow, avisa a conta da clínica. Este workflow avisa o paciente.',
      },
    },
    {
      id: 'd0ffee00-0000-4000-8000-000000000002',
      name: 'A cada hora',
      type: 'n8n-nodes-base.scheduleTrigger',
      typeVersion: 1.2,
      position: [0, 360],
      parameters: {
        rule: {
          interval: [{ field: 'cronExpression', expression: '0 * * * *' }],
        },
      },
    },
    codeNode(
      'd0ffee00-0000-4000-8000-000000000003',
      'Configuração do consultório',
      [280, 360],
      configCode(config, 'schedule'),
      'Mantenha este CONFIG igual ao do workflow da agenda.',
    ),
    codeNode('d0ffee00-0000-4000-8000-000000000004', 'Preparar lembretes', [560, 360], read('prepare-reminders.js')),
    googleNode(
      'd0ffee00-0000-4000-8000-000000000005',
      'Buscar consultas próximas',
      [840, 360],
      {
        resource: 'event',
        operation: 'getAll',
        calendar: calendarLocator('={{ $json.calendarId }}'),
        returnAll: false,
        limit: 50,
        timeMin: '={{ $json.timeMin }}',
        timeMax: '={{ $json.timeMax }}',
        options: {
          query: '={{ $json.query }}',
          recurringEventHandling: 'expand',
          timeZone: calendarLocator(TZ),
        },
      },
      { alwaysOutputData: true },
    ),
    codeNode('d0ffee00-0000-4000-8000-000000000006', 'Escolher lembretes', [1120, 360], withLibrary(read('reminders.js'))),
    whatsAppNode('d0ffee00-0000-4000-8000-000000000007', 'Enviar lembrete', [1400, 360]),
  ];

  const connections = {};
  connect(connections, 'A cada hora', 'Configuração do consultório');
  connect(connections, 'Configuração do consultório', 'Preparar lembretes');
  connect(connections, 'Preparar lembretes', 'Buscar consultas próximas');
  connect(connections, 'Buscar consultas próximas', 'Escolher lembretes');
  connect(connections, 'Escolher lembretes', 'Enviar lembrete');

  return baseWorkflow('Fisioterapia — lembretes no WhatsApp', nodes, connections);
}

export function writeWorkflows(config = defaultConfig()) {
  const agenda = buildAgendaWorkflow(config);
  const reminders = buildReminderWorkflow(config);
  const agendaPath = path.join(workflowsDir, 'fisioterapia-agenda-whatsapp.json');
  const remindersPath = path.join(workflowsDir, 'fisioterapia-lembretes-whatsapp.json');
  fs.writeFileSync(agendaPath, JSON.stringify(agenda, null, 2) + '\n');
  fs.writeFileSync(remindersPath, JSON.stringify(reminders, null, 2) + '\n');
  return { agendaPath, remindersPath, agenda, reminders };
}

const executedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (executedDirectly) {
  const written = writeWorkflows();
  console.log(written.agendaPath);
  console.log(written.remindersPath);
}
