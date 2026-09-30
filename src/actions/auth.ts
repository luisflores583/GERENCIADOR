"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { clearSession, setSession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export type FormState = { error: string };

const loginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido.").transform((value) => value.toLowerCase()),
  password: z.string().min(1, "Informe a senha."),
});

const signupSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(80, "Use um nome mais curto."),
  email: z.string().trim().email("Informe um e-mail válido.").transform((value) => value.toLowerCase()),
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres.").max(72, "A senha está longa demais."),
  confirm: z.string(),
});

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "E-mail ou senha incorretos." };
  }

  await setSession(user.id);
  redirect("/inicio");
}

export async function signupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (parsed.data.password !== parsed.data.confirm) return { error: "As senhas não coincidem." };

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { error: "Já existe uma conta com esse e-mail." };

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
    },
  });

  await setSession(user.id);
  redirect("/perfil");
}

export async function logoutAction() {
  await clearSession();
  redirect("/");
}
