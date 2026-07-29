interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export function welcomeTemplate(firstName: string | null): EmailContent {
  const greeting = firstName ? `Oi, ${firstName}!` : 'Oi!';

  return {
    subject: 'Bem-vindo ao SoTreina',
    text: `${greeting}\n\nSua conta no SoTreina foi criada com sucesso. A partir de agora você pode acompanhar seus treinos de corrida, musculação e muito mais, tudo em um só lugar.\n\nBons treinos!\nEquipe SoTreina`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <p style="font-size: 16px;">${greeting}</p>
        <p style="font-size: 15px; line-height: 1.6;">
          Sua conta no <strong>SoTreina</strong> foi criada com sucesso. A partir de agora você pode
          acompanhar seus treinos de corrida, musculação e muito mais, tudo em um só lugar.
        </p>
        <p style="font-size: 15px; line-height: 1.6;">Bons treinos!<br/>Equipe SoTreina</p>
      </div>
    `,
  };
}
