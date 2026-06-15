import nodemailer from 'nodemailer';
import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'tool-send-email' });

export async function sendEmail(input: {
  smtpHost: string;
  smtpPort?: number;
  smtpUser: string;
  smtpPass: string;
  from: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  secure?: boolean;
}): Promise<{ sent: boolean; messageId?: string }> {
  const { smtpHost, smtpPort = 587, smtpUser, smtpPass, from, to, subject, text, html, secure = false } = input;
  log.info({ smtpHost, to, subject }, 'sending email');

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const info = await transporter.sendMail({
    from,
    to: Array.isArray(to) ? to.join(', ') : to,
    subject,
    text,
    html,
  });

  log.info({ messageId: info.messageId }, 'email sent');
  return { sent: true, messageId: info.messageId };
}
