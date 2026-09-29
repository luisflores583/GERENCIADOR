import { prisma } from "../db";
import {
  assertSlotAvailable,
  getAvailableDates,
  getAvailableSlots,
} from "../availability";
import { combineDateAndTime, formatBRL, formatDate, STATUS_LABELS } from "../constants";
import { APPOINTMENT_STATUS } from "../constants";
import { getWhatsAppProvider } from "./provider";

type Ctx = {
  serviceId?: string;
  dateKey?: string;
  slot?: string;
  name?: string;
  awaitingName?: boolean;
};

const MAIN_MENU = `*Menu principal*
1️⃣ Agendar
2️⃣ Consultar
3️⃣ Cancelar
4️⃣ Serviços
5️⃣ Falar com profissional
6️⃣ Encerrar

Digite o número da opção (0 = menu).`;

function parseCtx(json: string): Ctx {
  try {
    return JSON.parse(json || "{}") as Ctx;
  } catch {
    return {};
  }
}

async function saveSession(
  organizationId: string,
  phone: string,
  state: string,
  ctx: Ctx,
  humanHandoff = false
) {
  return prisma.whatsAppSession.upsert({
    where: { organizationId_phone: { organizationId, phone } },
    create: {
      organizationId,
      phone,
      state,
      contextJson: JSON.stringify(ctx),
      humanHandoff,
    },
    update: {
      state,
      contextJson: JSON.stringify(ctx),
      humanHandoff,
    },
  });
}

async function logMessage(
  organizationId: string,
  phone: string,
  direction: "IN" | "OUT",
  body: string
) {
  await prisma.whatsAppMessage.create({
    data: { organizationId, phone, direction, body },
  });
}

async function reply(organizationId: string, phone: string, body: string) {
  await logMessage(organizationId, phone, "OUT", body);
  await getWhatsAppProvider().send({ to: phone, body });
  return body;
}

async function defaultOrg() {
  return prisma.organization.findFirst({
    include: {
      professionals: true,
      whatsappSettings: true,
    },
  });
}

export async function handleIncomingWhatsApp(input: {
  phone: string;
  body: string;
  organizationId?: string;
}) {
  const phone = input.phone.replace(/\D/g, "");
  const text = (input.body || "").trim();
  const org =
    (input.organizationId
      ? await prisma.organization.findUnique({
          where: { id: input.organizationId },
          include: { professionals: true, whatsappSettings: true },
        })
      : null) || (await defaultOrg());

  if (!org || !org.professionals[0]) {
    return { replies: ["Sistema não configurado."] };
  }

  const organizationId = org.id;
  const professional = org.professionals[0];
  const settings = org.whatsappSettings;

  await logMessage(organizationId, phone, "IN", text);

  let session = await prisma.whatsAppSession.findUnique({
    where: { organizationId_phone: { organizationId, phone } },
  });
  if (!session) {
    session = await saveSession(organizationId, phone, "MENU", {});
  }

  if (session.humanHandoff && text !== "0") {
    const msg = await reply(
      organizationId,
      phone,
      "Você está em atendimento humano. Digite *0* para voltar ao menu."
    );
    return { replies: [msg] };
  }

  let state = session.state;
  let ctx = parseCtx(session.contextJson);
  const replies: string[] = [];

  const send = async (body: string) => {
    replies.push(await reply(organizationId, phone, body));
  };

  // nome pendente
  if (ctx.awaitingName && text && !/^\d+$/.test(text)) {
    ctx.name = text;
    ctx.awaitingName = false;
    await prisma.client.upsert({
      where: { organizationId_phone: { organizationId, phone } },
      create: { organizationId, name: text, phone },
      update: { name: text },
    });
    state = "BOOK_SERVICE";
    await saveSession(organizationId, phone, state, ctx);
    const services = await prisma.service.findMany({
      where: { organizationId, active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    const list = services
      .map((s, i) => `${i + 1}️⃣ ${s.name} — ${formatBRL(s.priceCents)} (${s.durationMin}min)`)
      .join("\n");
    await send(`Oi, ${text}! Escolha o serviço:\n\n${list}\n\n0 = Menu`);
    return { replies };
  }

  const choice = text.replace(/[^\d]/g, "");

  if (choice === "0" || text.toLowerCase() === "menu") {
    ctx = {};
    state = "MENU";
    await saveSession(organizationId, phone, state, ctx, false);
    await send(`${settings?.welcomeMessage || "Olá!"}\n\n${MAIN_MENU}`);
    return { replies };
  }

  if (state === "MENU") {
    switch (choice) {
      case "1": {
        const client = await prisma.client.findUnique({
          where: { organizationId_phone: { organizationId, phone } },
        });
        if (!client) {
          ctx.awaitingName = true;
          await saveSession(organizationId, phone, "BOOK_NAME", ctx);
          await send("Para agendar, me diga seu *nome*:");
          return { replies };
        }
        state = "BOOK_SERVICE";
        await saveSession(organizationId, phone, state, ctx);
        const services = await prisma.service.findMany({
          where: { organizationId, active: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        });
        const list = services
          .map(
            (s, i) =>
              `${i + 1}️⃣ ${s.name} — ${formatBRL(s.priceCents)} (${s.durationMin}min)`
          )
          .join("\n");
        await send(`Escolha o serviço:\n\n${list}\n\n0 = Menu`);
        return { replies };
      }
      case "2": {
        const appts = await prisma.appointment.findMany({
          where: {
            organizationId,
            client: { phone },
            status: {
              in: [
                APPOINTMENT_STATUS.SCHEDULED,
                APPOINTMENT_STATUS.CONFIRMED,
              ],
            },
            startAt: { gte: new Date() },
          },
          include: { service: true },
          orderBy: { startAt: "asc" },
          take: 5,
        });
        if (!appts.length) {
          await send("Você não tem agendamentos futuros.\n\n0 = Menu");
        } else {
          const lines = appts
            .map(
              (a, i) =>
                `${i + 1}. ${a.service.name} — ${formatDate(a.startAt)} ${a.startAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} (${STATUS_LABELS[a.status as keyof typeof STATUS_LABELS] || a.status})`
            )
            .join("\n");
          await send(`Seus próximos horários:\n\n${lines}\n\n0 = Menu`);
        }
        return { replies };
      }
      case "3": {
        const appts = await prisma.appointment.findMany({
          where: {
            organizationId,
            client: { phone },
            status: {
              in: [
                APPOINTMENT_STATUS.SCHEDULED,
                APPOINTMENT_STATUS.CONFIRMED,
              ],
            },
            startAt: { gte: new Date() },
          },
          include: { service: true },
          orderBy: { startAt: "asc" },
          take: 5,
        });
        if (!appts.length) {
          await send("Nenhum agendamento para cancelar.\n\n0 = Menu");
          return { replies };
        }
        ctx = { ...ctx };
        (ctx as Ctx & { cancelIds?: string[] }).cancelIds = appts.map((a) => a.id);
        await saveSession(organizationId, phone, "CANCEL_PICK", {
          ...ctx,
          // store ids in JSON
        });
        // persist cancel list in context
        await prisma.whatsAppSession.update({
          where: { organizationId_phone: { organizationId, phone } },
          data: {
            state: "CANCEL_PICK",
            contextJson: JSON.stringify({
              ...ctx,
              cancelIds: appts.map((a) => a.id),
            }),
          },
        });
        const lines = appts
          .map(
            (a, i) =>
              `${i + 1}️⃣ ${a.service.name} — ${formatDate(a.startAt)} ${a.startAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
          )
          .join("\n");
        await send(`Qual deseja cancelar?\n\n${lines}\n\n0 = Menu`);
        return { replies };
      }
      case "4": {
        const services = await prisma.service.findMany({
          where: { organizationId, active: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        });
        const list = services
          .map(
            (s) =>
              `• *${s.name}* — ${formatBRL(s.priceCents)} · ${s.durationMin}min${s.description ? `\n  ${s.description}` : ""}`
          )
          .join("\n\n");
        await send(`Nossos serviços:\n\n${list || "Nenhum serviço ativo."}\n\n0 = Menu`);
        return { replies };
      }
      case "5": {
        await saveSession(organizationId, phone, "HUMAN", ctx, true);
        await prisma.notification.create({
          data: {
            organizationId,
            title: "Cliente solicitou atendimento",
            body: `WhatsApp ${phone} pediu para falar com a profissional.`,
          },
        });
        await send(
          settings?.humanHandoffNote ||
            "Vou chamar a profissional. Aguarde um momento."
        );
        return { replies };
      }
      case "6": {
        await saveSession(organizationId, phone, "MENU", {});
        await send("Atendimento encerrado. Quando quiser, digite *0* para o menu. Até logo! 💅");
        return { replies };
      }
      default:
        await send(MAIN_MENU);
        return { replies };
    }
  }

  if (state === "BOOK_SERVICE") {
    const services = await prisma.service.findMany({
      where: { organizationId, active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    const idx = Number(choice) - 1;
    if (!services[idx]) {
      await send("Opção inválida. Escolha o número do serviço ou 0 para menu.");
      return { replies };
    }
    ctx.serviceId = services[idx].id;
    state = "BOOK_DATE";
    await saveSession(organizationId, phone, state, ctx);
    const today = new Date();
    const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const dates = await getAvailableDates({
      organizationId,
      professionalId: professional.id,
      serviceId: ctx.serviceId,
      fromDateKey: from,
      days: 14,
    });
    if (!dates.length) {
      await send("Sem datas disponíveis nos próximos dias. Tente outro serviço.\n\n0 = Menu");
      return { replies };
    }
    const list = dates
      .map((d, i) => `${i + 1}️⃣ ${formatDate(combineDateAndTime(d, "12:00"))}`)
      .join("\n");
    await prisma.whatsAppSession.update({
      where: { organizationId_phone: { organizationId, phone } },
      data: { contextJson: JSON.stringify({ ...ctx, dateOptions: dates }) },
    });
    await send(`Escolha a data:\n\n${list}\n\n0 = Menu`);
    return { replies };
  }

  if (state === "BOOK_DATE") {
    const raw = parseCtx(
      (
        await prisma.whatsAppSession.findUnique({
          where: { organizationId_phone: { organizationId, phone } },
        })
      )?.contextJson || "{}"
    ) as Ctx & { dateOptions?: string[] };
    const dates = raw.dateOptions || [];
    const idx = Number(choice) - 1;
    if (!dates[idx] || !raw.serviceId) {
      await send("Opção inválida. Digite 0 para o menu.");
      return { replies };
    }
    ctx = { ...raw, dateKey: dates[idx] };
    state = "BOOK_SLOT";
    const slotsRes = await getAvailableSlots({
      organizationId,
      professionalId: professional.id,
      serviceId: ctx.serviceId!,
      dateKey: ctx.dateKey!,
    });
    if (!slotsRes.ok || !slotsRes.slots.length) {
      await send("Sem horários nesta data. Digite 0 e tente outra.");
      return { replies };
    }
    await saveSession(organizationId, phone, state, {
      ...ctx,
      slotOptions: slotsRes.slots,
    } as Ctx);
    await prisma.whatsAppSession.update({
      where: { organizationId_phone: { organizationId, phone } },
      data: {
        state,
        contextJson: JSON.stringify({ ...ctx, slotOptions: slotsRes.slots }),
      },
    });
    const list = slotsRes.slots
      .slice(0, 12)
      .map((s, i) => `${i + 1}️⃣ ${s}`)
      .join("\n");
    await send(`Horários em ${formatDate(combineDateAndTime(ctx.dateKey!, "12:00"))}:\n\n${list}\n\n0 = Menu`);
    return { replies };
  }

  if (state === "BOOK_SLOT") {
    const raw = parseCtx(
      (
        await prisma.whatsAppSession.findUnique({
          where: { organizationId_phone: { organizationId, phone } },
        })
      )?.contextJson || "{}"
    ) as Ctx & { slotOptions?: string[] };
    const slots = raw.slotOptions || [];
    const idx = Number(choice) - 1;
    if (!slots[idx] || !raw.serviceId || !raw.dateKey) {
      await send("Opção inválida. Digite 0 para o menu.");
      return { replies };
    }
    ctx = { ...raw, slot: slots[idx] };
    const startAt = combineDateAndTime(ctx.dateKey!, ctx.slot!);
    const check = await assertSlotAvailable({
      organizationId,
      professionalId: professional.id,
      serviceId: ctx.serviceId!,
      startAt,
    });
    if (!check.ok) {
      await send(`${check.error}. Digite 0 para recomeçar.`);
      return { replies };
    }
    const service = await prisma.service.findUniqueOrThrow({
      where: { id: ctx.serviceId! },
    });
    state = "BOOK_CONFIRM";
    await prisma.whatsAppSession.update({
      where: { organizationId_phone: { organizationId, phone } },
      data: {
        state,
        contextJson: JSON.stringify({
          ...ctx,
          endAt: check.endAt.toISOString(),
          priceCents: check.priceCents,
        }),
      },
    });
    await send(
      `Confirmar agendamento?\n\n*${service.name}*\n${formatDate(startAt)} às ${ctx.slot}\n${formatBRL(check.priceCents)}\n\n1️⃣ Confirmar\n2️⃣ Cancelar\n0 = Menu`
    );
    return { replies };
  }

  if (state === "BOOK_CONFIRM") {
    if (choice === "2") {
      await saveSession(organizationId, phone, "MENU", {});
      await send(`Agendamento não confirmado.\n\n${MAIN_MENU}`);
      return { replies };
    }
    if (choice !== "1") {
      await send("Digite 1 para confirmar, 2 para desistir ou 0 para menu.");
      return { replies };
    }
    const raw = parseCtx(
      (
        await prisma.whatsAppSession.findUnique({
          where: { organizationId_phone: { organizationId, phone } },
        })
      )?.contextJson || "{}"
    ) as Ctx & { endAt?: string; priceCents?: number };

    const startAt = combineDateAndTime(raw.dateKey!, raw.slot!);
    const check = await assertSlotAvailable({
      organizationId,
      professionalId: professional.id,
      serviceId: raw.serviceId!,
      startAt,
    });
    if (!check.ok) {
      await saveSession(organizationId, phone, "MENU", {});
      await send(`${check.error}. Horário pode ter sido preenchido.\n\n${MAIN_MENU}`);
      return { replies };
    }

    let client = await prisma.client.findUnique({
      where: { organizationId_phone: { organizationId, phone } },
    });
    if (!client) {
      client = await prisma.client.create({
        data: {
          organizationId,
          phone,
          name: raw.name || `Cliente ${phone.slice(-4)}`,
        },
      });
    }

    const appt = await prisma.appointment.create({
      data: {
        organizationId,
        professionalId: professional.id,
        clientId: client.id,
        serviceId: raw.serviceId!,
        startAt,
        endAt: check.endAt,
        status: APPOINTMENT_STATUS.SCHEDULED,
        priceCents: check.priceCents,
        source: "WHATSAPP",
      },
      include: { service: true },
    });

    await prisma.notification.create({
      data: {
        organizationId,
        title: "Novo agendamento (WhatsApp)",
        body: `${client.name} — ${appt.service.name} em ${formatDate(startAt)} ${raw.slot}`,
      },
    });

    await saveSession(organizationId, phone, "MENU", {});
    await send(
      `✅ Agendado!\n\n*${appt.service.name}*\n${formatDate(startAt)} às ${raw.slot}\n${formatBRL(appt.priceCents)}\n\nAté lá! Digite 0 para o menu.`
    );
    return { replies, appointmentId: appt.id };
  }

  if (state === "CANCEL_PICK") {
    const raw = parseCtx(
      (
        await prisma.whatsAppSession.findUnique({
          where: { organizationId_phone: { organizationId, phone } },
        })
      )?.contextJson || "{}"
    ) as Ctx & { cancelIds?: string[] };
    const ids = raw.cancelIds || [];
    const idx = Number(choice) - 1;
    const id = ids[idx];
    if (!id) {
      await send("Opção inválida. Digite 0 para menu.");
      return { replies };
    }
    const appt = await prisma.appointment.findFirst({
      where: { id, organizationId },
      include: { service: true },
    });
    if (!appt) {
      await send("Agendamento não encontrado.\n\n0 = Menu");
      return { replies };
    }
    const hoursLeft =
      (appt.startAt.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursLeft < professional.cancellationHours) {
      await send(
        `Cancelamento só com ${professional.cancellationHours}h de antecedência.\n\n0 = Menu`
      );
      return { replies };
    }
    await prisma.appointment.update({
      where: { id: appt.id },
      data: {
        status: APPOINTMENT_STATUS.CANCELED_CLIENT,
        canceledAt: new Date(),
        cancelReason: "Cancelado via WhatsApp",
      },
    });
    await saveSession(organizationId, phone, "MENU", {});
    await send(
      `Cancelado: ${appt.service.name} em ${formatDate(appt.startAt)}. O horário foi liberado.\n\n${MAIN_MENU}`
    );
    return { replies };
  }

  await saveSession(organizationId, phone, "MENU", {});
  await send(MAIN_MENU);
  return { replies };
}
