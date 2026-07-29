interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export function resetPasswordTemplate(resetUrl: string): EmailContent {
  return {
    subject: 'Redefinir sua senha do SoTreina',
    text: `Recebemos um pedido para redefinir a senha da sua conta no SoTreina.\n\nAcesse o link abaixo para escolher uma nova senha (válido por 30 minutos):\n${resetUrl}\n\nSe você não pediu isso, pode ignorar este email — sua senha continua a mesma.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <p style="font-size: 15px; line-height: 1.6;">
          Recebemos um pedido para redefinir a senha da sua conta no <strong>SoTreina</strong>.
        </p>
        <p style="font-size: 15px; line-height: 1.6;">
          Clique no botão abaixo para escolher uma nova senha (o link é válido por 30 minutos):
        </p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="display: inline-block; background: #fc4c02; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">
            Redefinir senha
          </a>
        </p>
        <p style="font-size: 13px; line-height: 1.6; color: #666;">
          Se você não pediu isso, pode ignorar este email — sua senha continua a mesma.
        </p>
      </div>
    `,
  };
}
