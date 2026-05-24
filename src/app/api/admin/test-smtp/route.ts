import { NextResponse } from "next/server";
import { auth } from "@/auth";
import nodemailer from "nodemailer";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "snath2973@gmail.com";

export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return NextResponse.json({ error: "SMTP not configured" }, { status: 400 });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT ?? "587"),
      secure: SMTP_SECURE === "true",
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: SMTP_FROM ?? SMTP_USER,
      to: ADMIN_EMAIL,
      subject: "IT'S STATIC — SMTP Test",
      text: "SMTP connection verified. Your mail settings are working correctly.",
      html: `<p style="font-family:sans-serif;">✅ SMTP connection verified for <strong>IT'S STATIC</strong>. Your mail settings are working correctly.</p>`,
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
