import nodemailer from "nodemailer";

async function sendEmail(to: string, subject: string, text: string, html: string) {
  if (!process.env.SMTP_HOST) {
    console.log("\n========================================================");
    console.log(`[EMAIL SIMULÉ — ${subject}] Destinataire : ${to}\n${text}`);
    console.log("========================================================\n");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: process.env.SMTP_SECURE !== "false",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
}

export async function sendMagicLinkEmail(to: string, magicUrl: string) {
  await sendEmail(
    to,
    "Votre lien de connexion — Commune de Vufflens-la-Ville",
    `Bonjour,\n\nCliquez sur ce lien pour vous connecter (valable 15 minutes) :\n${magicUrl}\n\nSi vous n'avez pas demandé ce lien, ignorez cet email.`,
    `
      <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:24px;background:#faf8f5;color:#18181b;border:1px solid #dfdbd2;border-radius:8px">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#57534e;margin:0">Commune de Vufflens-la-Ville</p>
        <h2 style="margin:6px 0 16px 0">Connexion à votre espace habitant</h2>
        <p style="font-family:sans-serif;font-size:14px;line-height:1.5">Cliquez sur le bouton ci-dessous pour accéder à votre espace (lien valable 15 minutes) :</p>
        <p style="margin:24px 0">
          <a href="${magicUrl}" style="font-family:sans-serif;background:#18181b;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;display:inline-block">
            Accéder à mon espace
          </a>
        </p>
        <p style="font-family:sans-serif;font-size:11px;color:#57534e">Lien direct : ${magicUrl}</p>
      </div>
    `
  );
}

export async function sendAddressApprovedEmail(to: string, addressLabel: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  await sendEmail(
    to,
    "Adresse confirmée — Carte communale de Vufflens-la-Ville",
    `Bonjour,\n\nLa commune a validé le rattachement de votre compte à l'adresse : ${addressLabel}.\n\nVous pouvez désormais inscrire votre foyer pour Halloween ou le Calendrier de l'Avent sur : ${appUrl}/dashboard`,
    `
      <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:24px;background:#faf8f5;color:#18181b;border:1px solid #dfdbd2;border-radius:8px">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#57534e;margin:0">Commune de Vufflens-la-Ville</p>
        <h2 style="margin:6px 0 16px 0">Votre adresse est confirmée</h2>
        <p style="font-family:sans-serif;font-size:14px;line-height:1.5">
          Votre rattachement à l'adresse <strong>${addressLabel} (1302 Vufflens-la-Ville)</strong> a été validé.
        </p>
        <p style="margin:20px 0">
          <a href="${appUrl}/dashboard" style="font-family:sans-serif;background:#18181b;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;display:inline-block">
            Gérer ma participation
          </a>
        </p>
      </div>
    `
  );
}

export async function sendAdventPublishedEmail(
  to: string,
  dayNumber: number,
  addressLabel: string
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  await sendEmail(
    to,
    `Calendrier de l'Avent publié — Votre fenêtre du ${dayNumber} décembre`,
    `Bonjour,\n\nLe Calendrier de l'Avent de Vufflens-la-Ville est désormais en ligne !\nVotre foyer (${addressLabel}) anime la fenêtre du ${dayNumber} décembre.\n\nConsultez la carte : ${appUrl}`,
    `
      <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:24px;background:#faf8f5;color:#18181b;border:1px solid #dfdbd2;border-radius:8px">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#1b4d3e;margin:0">Calendrier de l'Avent · Vufflens-la-Ville</p>
        <h2 style="margin:6px 0 16px 0">Fenêtre du ${dayNumber} décembre confirmée</h2>
        <p style="font-family:sans-serif;font-size:14px;line-height:1.5">
          Le calendrier communal est publié. Votre adresse (<strong>${addressLabel}</strong>) est programmée pour le <strong>${dayNumber} décembre</strong>.
        </p>
        <p style="margin:20px 0">
          <a href="${appUrl}" style="font-family:sans-serif;background:#1b4d3e;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;display:inline-block">
            Voir le calendrier sur la carte 3D
          </a>
        </p>
      </div>
    `
  );
}

export async function sendAdventEveReminderEmail(
  to: string,
  dayNumber: number,
  addressLabel: string,
  lightingTime?: string | null
) {
  await sendEmail(
    to,
    `Rappel : votre fenêtre de l'Avent s'illumine demain (${dayNumber} décembre)`,
    `Bonjour,\n\nPetit rappel amical : c'est demain (${dayNumber} décembre) dès ${lightingTime?.slice(0, 5) ?? "17h30"} que votre fenêtre au ${addressLabel} s'illumine pour les habitants de Vufflens-la-Ville.\n\nBelle soirée conviviale !`,
    `
      <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:24px;background:#faf8f5;color:#18181b;border:1px solid #dfdbd2;border-radius:8px">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#1b4d3e;margin:0">Rappel J-1 · Vufflens-la-Ville</p>
        <h2 style="margin:6px 0 16px 0">Votre fenêtre du ${dayNumber} décembre</h2>
        <p style="font-family:sans-serif;font-size:14px;line-height:1.5">
          C'est demain dès <strong>${lightingTime?.slice(0, 5) ?? "17h30"}</strong> que votre fenêtre située au <strong>${addressLabel}</strong> s'illumine. Merci pour votre participation à la vie du village !
        </p>
      </div>
    `
  );
}
