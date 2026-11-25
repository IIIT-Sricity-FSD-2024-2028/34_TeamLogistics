import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class PasswordResetMailerService {
  private readonly logger = new Logger(PasswordResetMailerService.name);
  private transporter?: ReturnType<typeof nodemailer.createTransport>;

  isConfigured(): boolean {
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
  }

  async sendCode(email: string, code: string, expiresInMinutes: number): Promise<void> {
    await this.send(email, 'Your DeliverSync password reset code',
      `Your password reset code is ${code}. It expires in ${expiresInMinutes} minutes.`);
  }

  async sendLoginCode(email: string, code: string) {
    await this.send(email, 'Verify your DeliverSync sign-in', `Your sign-in code is ${code}. It expires in ten minutes.`);
  }

  async sendDeliveryCode(email: string, deliveryId: string, code: string): Promise<void> {
    await this.send(email, 'Confirm your DeliverSync delivery',
      `Share ${code} with the driver only after receiving delivery ${deliveryId}. It expires in 10 minutes.`);
  }

  private async send(email: string, subject: string, text: string): Promise<void> {
    if (!this.isConfigured()) throw new Error('SMTP is not configured');

    if (!this.transporter) {
      const port = Number(process.env.SMTP_PORT || 587);
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: process.env.SMTP_SECURE === 'true' || port === 465,
        auth: user && pass ? { user, pass } : undefined,
      });
    }

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject,
      text,
    });

    this.logger.log('Confirmation email accepted by mail server');
  }
}
