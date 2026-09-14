// workers-api/src/lib/msGraphMail.js
// Sends mail through Microsoft Graph (app-only client-credentials grant, Mail.Send
// application permission) as env.EMAIL_FROM. Separate from cron/email.js's
// MailChannels sender — this is the channel for reports that must go out through
// the gonxt.tech mailbox rather than FieldVibe's own domain.

async function getGraphToken(env) {
  const res = await fetch(`https://login.microsoftonline.com/${env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.MICROSOFT_CLIENT_ID,
      client_secret: env.MICROSOFT_CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Graph token ${res.status}: ${t.slice(0, 300)}`);
  }
  const { access_token } = await res.json();
  return access_token;
}

async function sendEmailViaGraph(env, { to, subject, html }) {
  const recipients = (Array.isArray(to) ? to : String(to || '').split(','))
    .map((e) => e.trim()).filter(Boolean);
  if (!recipients.length) return;
  const token = await getGraphToken(env);
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(env.EMAIL_FROM)}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'HTML', content: html },
        toRecipients: recipients.map((address) => ({ emailAddress: { address } })),
      },
      saveToSentItems: false,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Graph sendMail ${res.status}: ${t.slice(0, 300)}`);
  }
}

export { sendEmailViaGraph };
