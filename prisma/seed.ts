import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.whatsAppMessage.deleteMany();
  await prisma.whatsAppSession.deleteMany();
  await prisma.financialTransaction.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.blockedTime.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.businessHour.deleteMany();
  await prisma.service.deleteMany();
  await prisma.client.deleteMany();
  await prisma.whatsAppSettings.deleteMany();
  await prisma.professional.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  const org = await prisma.organization.create({
    data: {
      name: "Studio Luna Nails",
      slug: "studio-luna",
    },
  });

  const passwordHash = await bcrypt.hash("demo1234", 10);
  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: "demo@manicure.app",
      passwordHash,
      name: "Luna Ferreira",
      role: "OWNER",
    },
  });

  const professional = await prisma.professional.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      displayName: "Luna Ferreira",
      phone: "11999990000",
      bio: "Manicure e pedicure com foco em nail art delicada.",
      cancellationHours: 2,
    },
  });

  await prisma.whatsAppSettings.create({
    data: {
      organizationId: org.id,
      provider: "mock",
      verifyToken: "manicure-verify",
      welcomeMessage:
        "Olá! Bem-vinda ao Studio Luna 💅 Digite o número da opção:",
    },
  });

  const services = await Promise.all(
    [
      {
        name: "Manicure clássica",
        description: "Corte, lixa e esmaltação tradicional",
        priceCents: 4500,
        durationMin: 45,
        category: "Mãos",
        sortOrder: 1,
      },
      {
        name: "Pedicure clássica",
        description: "Cuidados com os pés e esmaltação",
        priceCents: 5500,
        durationMin: 60,
        category: "Pés",
        sortOrder: 2,
      },
      {
        name: "Esmaltação em gel",
        description: "Acabamento em gel de longa duração",
        priceCents: 8000,
        durationMin: 75,
        category: "Mãos",
        sortOrder: 3,
      },
      {
        name: "Blindagem",
        description: "Fortalecimento com blindagem",
        priceCents: 9000,
        durationMin: 90,
        category: "Mãos",
        sortOrder: 4,
      },
    ].map((s) =>
      prisma.service.create({
        data: { organizationId: org.id, ...s, active: true },
      })
    )
  );

  // Seg–Sáb 9–18, almoço 12–13; Dom fechado
  for (let weekday = 0; weekday <= 6; weekday++) {
    await prisma.businessHour.create({
      data: {
        organizationId: org.id,
        professionalId: professional.id,
        weekday,
        openTime: "09:00",
        closeTime: "18:00",
        breakStart: "12:00",
        breakEnd: "13:00",
        closed: weekday === 0,
      },
    });
  }

  const client = await prisma.client.create({
    data: {
      organizationId: org.id,
      name: "Ana Costa",
      phone: "11988887777",
      email: "ana@email.com",
    },
  });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const end = new Date(tomorrow.getTime() + 45 * 60_000);

  await prisma.appointment.create({
    data: {
      organizationId: org.id,
      professionalId: professional.id,
      clientId: client.id,
      serviceId: services[0].id,
      startAt: tomorrow,
      endAt: end,
      status: "CONFIRMED",
      priceCents: services[0].priceCents,
      source: "ADMIN",
    },
  });

  console.log("Seed OK");
  console.log("Login: demo@manicure.app / demo1234");
  console.log("Org:", org.slug, "| Professional:", professional.displayName);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
