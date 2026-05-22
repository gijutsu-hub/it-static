import nodemailer from "nodemailer";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://itstatic.app";
const FROM = process.env.SMTP_FROM ?? "IT'S STATIC <noreply@itstatic.app>";

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function baseHtml(content: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:system-ui,sans-serif;background:#fbf8fc;margin:0;padding:0;}
    .wrap{max-width:520px;margin:40px auto;background:#fbf8fc;border:4px solid #1b1b1e;box-shadow:8px 8px 0 #1b1b1e;padding:36px;}
    .logo{font-size:28px;font-weight:900;text-transform:uppercase;letter-spacing:-0.03em;color:#9f376f;margin-bottom:8px;}
    .tag{display:inline-block;background:#ffe24c;border:2px solid #1b1b1e;padding:2px 10px;font-size:11px;font-weight:700;text-transform:uppercase;margin-bottom:24px;}
    h1{font-size:22px;font-weight:900;text-transform:uppercase;color:#1b1b1e;margin:0 0 12px;}
    p{font-size:14px;color:#544249;font-weight:600;line-height:1.6;margin:0 0 16px;}
    .btn{display:inline-block;background:#9f376f;color:#fff;border:3px solid #1b1b1e;box-shadow:4px 4px 0 #1b1b1e;padding:12px 28px;font-weight:800;font-size:13px;text-transform:uppercase;text-decoration:none;letter-spacing:0.04em;margin-top:8px;}
    .info{background:#7ed4fd;border:2px solid #1b1b1e;padding:12px 16px;margin:16px 0;}
    .warn{background:#ffe24c;border:2px solid #1b1b1e;padding:12px 16px;margin:16px 0;}
    .error{background:#ffd8e7;border:2px solid #ba1a1a;padding:12px 16px;margin:16px 0;}
    .footer{margin-top:32px;padding-top:16px;border-top:2px solid #e4e1e6;font-size:11px;color:#9e9ba1;font-weight:600;}
  </style></head><body><div class="wrap">${content}<div class="footer">IT'S STATIC · <a href="${BASE_URL}">itstatic.app</a></div></div></body></html>`;
}

export async function sendWelcomeEmail(to: string, name: string, trialEndsAt: Date) {
  const days = Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000);
  const html = baseHtml(`
    <div class="logo">IT'S STATIC</div>
    <div class="tag">WELCOME</div>
    <h1>You're in, ${name.split(" ")[0]}!</h1>
    <p>Your 7-day free trial has started. Explore the map, join squads, drop photo challenges, and find your crew.</p>
    <div class="info"><strong>Trial ends in ${days} days.</strong> Your UPI autopay mandate is set — ₹69/month kicks in after your trial.</div>
    <a href="${BASE_URL}/discover" class="btn">OPEN DISCOVER →</a>
  `);
  await createTransport().sendMail({ from: FROM, to, subject: "Welcome to IT'S STATIC — Trial Started!", html });
}

export async function sendTrialEndingEmail(to: string, name: string, daysLeft: number) {
  const html = baseHtml(`
    <div class="logo">IT'S STATIC</div>
    <div class="tag">TRIAL ENDING</div>
    <h1>Your trial ends in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}</h1>
    <p>Hey ${name.split(" ")[0]}, your free trial is almost over.</p>
    <div class="warn">After the trial, your UPI autopay will charge <strong>₹69/month</strong> automatically. No action needed — you're already set up.</div>
    <p>Cancel anytime from your profile settings before the trial ends to avoid charges.</p>
    <a href="${BASE_URL}/discover" class="btn">OPEN IT'S STATIC →</a>
  `);
  await createTransport().sendMail({ from: FROM, to, subject: `IT'S STATIC — Trial ends in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`, html });
}

export async function sendPaymentSuccessEmail(to: string, name: string, amountRs: number) {
  const html = baseHtml(`
    <div class="logo">IT'S STATIC</div>
    <div class="tag">PAYMENT CONFIRMED</div>
    <h1>₹${amountRs} received</h1>
    <p>Hey ${name.split(" ")[0]}, your monthly membership has been renewed.</p>
    <div class="info">Amount: ₹${amountRs} · Your access continues uninterrupted.</div>
    <a href="${BASE_URL}/discover" class="btn">BACK TO THE MAP →</a>
  `);
  await createTransport().sendMail({ from: FROM, to, subject: "IT'S STATIC — Payment Confirmed ₹" + amountRs, html });
}

export async function sendPaymentFailedEmail(to: string, name: string) {
  const html = baseHtml(`
    <div class="logo">IT'S STATIC</div>
    <div class="tag">ACTION NEEDED</div>
    <h1>Payment failed</h1>
    <p>Hey ${name.split(" ")[0]}, we couldn't charge your UPI mandate for this month's subscription.</p>
    <div class="error"><strong>Your access may be suspended</strong> if payment isn't resolved. Razorpay will retry automatically. You can also update your payment method.</div>
    <a href="${BASE_URL}/discover" class="btn">RESOLVE PAYMENT →</a>
  `);
  await createTransport().sendMail({ from: FROM, to, subject: "IT'S STATIC — Payment Failed — Action Required", html });
}

export async function sendSubscriptionCancelledEmail(to: string, name: string) {
  const html = baseHtml(`
    <div class="logo">IT'S STATIC</div>
    <div class="tag">SUBSCRIPTION ENDED</div>
    <h1>Your subscription has ended</h1>
    <p>Hey ${name.split(" ")[0]}, your IT'S STATIC membership has been cancelled.</p>
    <p>You can resubscribe anytime to regain access to the map, squads, and challenges.</p>
    <a href="${BASE_URL}/discover" class="btn">RESUBSCRIBE →</a>
  `);
  await createTransport().sendMail({ from: FROM, to, subject: "IT'S STATIC — Subscription Cancelled", html });
}
