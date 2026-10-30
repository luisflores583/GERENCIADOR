import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { buildAgendaWorkflow, buildReminderWorkflow, writeWorkflows } from './build-workflows.mjs';

const written = writeWorkflows();
const agenda = JSON.parse(fs.readFileSync(written.agendaPath, 'utf8'));
const reminders = JSON.parse(fs.readFileSync(written.remindersPath, 'utf8'));

function assertWorkflow(workflow) {
  assert.equal(workflow.active, false);
  assert.equal(workflow.settings.executionOrder, 'v1');
  assert.equal(workflow.settings.timezone, 'America/Sao_Paulo');
  const names = workflow.nodes.map((node) => node.name);
  assert.equal(new Set(names).size, names.length);
  const byName = new Map(workflow.nodes.map((node) => [node.name, node]));
  for (const [source, outputs] of Object.entries(workflow.connections)) {
    assert.ok(byName.has(source), source);
    for (const links of outputs.main) {
      for (const link of links) {
        assert.ok(byName.has(link.node), link.node);
        assert.equal(link.type, 'main');
      }
    }
  }
  for (const node of workflow.nodes) {
    if (node.type !== 'n8n-nodes-base.code') continue;
    assert.equal(typeof node.parameters.jsCode, 'string');
    new Function(node.parameters.jsCode);
  }
  const raw = JSON.stringify(workflow);
  assert.equal(raw.includes('ya29.'), false);
  assert.equal(raw.includes('EAA'), false);
  assert.match(raw, /SEU_PHONE_NUMBER_ID/);
  assert.match(raw, /SEU_CALENDAR_ID@group\.calendar\.google\.com/);
  assert.match(raw, /America\/Sao_Paulo/);
  assert.match(raw, /WhatsApp Cloud API/);
  assert.match(raw, /Google Calendar/);
}

test('os JSON gerados parseiam e batem com o gerador', () => {
  assert.deepEqual(agenda, buildAgendaWorkflow());
  assert.deepEqual(reminders, buildReminderWorkflow());
  assertWorkflow(agenda);
  assertWorkflow(reminders);
});

test('o webhook aceita GET e POST no mesmo caminho', () => {
  const hooks = agenda.nodes.filter((node) => node.type === 'n8n-nodes-base.webhook');
  assert.deepEqual(
    hooks.map((node) => node.parameters.httpMethod).sort(),
    ['GET', 'POST'],
  );
  assert.ok(hooks.every((node) => node.parameters.path === 'fisioterapia-whatsapp'));
  assert.ok(hooks.every((node) => node.parameters.responseMode === 'responseNode'));
});

test('gravar na agenda só depois da confirmação, com lembrete e horário ocupado', () => {
  const create = agenda.nodes.find((node) => node.name === 'Criar evento');
  assert.equal(create.parameters.useDefaultReminders, false);
  assert.equal(create.parameters.additionalFields.showMeAs, 'opaque');
  assert.equal(create.parameters.additionalFields.summary, '={{ $json.summary }}');
  assert.equal(create.parameters.additionalFields.description, '={{ $json.description }}');
  assert.equal(create.credentials.googleCalendarOAuth2Api.name, 'Google Calendar');
  assert.equal(create.parameters.remindersUi.remindersValues[0].minutes, '={{ $json.reminderMinutes[0] }}');
  const router = agenda.nodes.find((node) => node.name === 'Roteador da conversa');
  assert.match(router.parameters.jsCode, /Não entendi/);
  assert.match(router.parameters.jsCode, /recheck_create/);
  const send = agenda.nodes.find((node) => node.name === 'Enviar WhatsApp');
  assert.equal(send.credentials.whatsAppApi.name, 'WhatsApp Cloud API');
  assert.equal(send.parameters.nodeCredentialType, 'whatsAppApi');
  assert.equal(send.parameters.authentication, 'predefinedCredentialType');
});

test('disponibilidade usa free/busy cru antes de oferecer horário', () => {
  const availability = agenda.nodes.find((node) => node.name === 'Consultar disponibilidade');
  assert.equal(availability.parameters.operation, 'availability');
  assert.equal(availability.parameters.options.outputFormat, 'raw');
  assert.equal(agenda.connections['Escolher ação'].main[1][0].node, 'Consultar disponibilidade');
  assert.equal(agenda.connections['Depois da disponibilidade'].main[1][0].node, 'Criar evento');
  assert.equal(agenda.connections['Depois da disponibilidade'].main[2][0].node, 'Atualizar evento');
});
