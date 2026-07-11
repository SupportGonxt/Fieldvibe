// ==================== WEEKLY GOLDRUSH EMAIL ====================
// Pulls report_email_subscriptions, recomputes the same insights data the
// /goldrush-individuals/insights and /goldrush-stores/insights endpoints
// return, formats it as a self-contained HTML email, and sends via
// MailChannels. Runs from the Monday 5am UTC cron tick.

const MAIL_FROM_EMAIL   = 'reports@fieldvibe.vantax.co.za'
const MAIL_FROM_NAME    = 'FieldVibe Reports'
const MAIL_REPLY_TO     = 'support@fieldvibe.vantax.co.za'

async function sendEmailViaMailChannels(env, { to, toName, subject, html, fromEmail, fromName }) {
  const body = {
    personalizations: [{ to: [{ email: to, name: toName || undefined }] }],
    from: { email: fromEmail || MAIL_FROM_EMAIL, name: fromName || MAIL_FROM_NAME },
    reply_to: { email: MAIL_REPLY_TO },
    subject,
    content: [{ type: 'text/html', value: html }],
  };
  const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`MailChannels ${res.status}: ${t.slice(0, 300)}`);
  }
}

function htmlEscape(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function tableHtml(headers, rows) {
  const th = headers.map(h => `<th style="background:#0F172A;color:#fff;padding:8px;text-align:left;font-size:12px;font-weight:600;border-bottom:2px solid #0EA5E9">${htmlEscape(h)}</th>`).join('');
  const trs = rows.map((r, i) => {
    const bg = i % 2 ? '#F8FAFC' : '#FFFFFF';
    const tds = r.map(c => `<td style="padding:8px;border-bottom:1px solid #E2E8F0;font-size:12px;color:#1F2937">${htmlEscape(c)}</td>`).join('');
    return `<tr style="background:${bg}">${tds}</tr>`;
  }).join('');
  return `<table style="border-collapse:collapse;width:100%;margin:8px 0 18px;font-family:Helvetica,Arial,sans-serif"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}
function kpiHtml(rows) {
  return `<table style="border-collapse:collapse;width:100%;margin:8px 0 18px;font-family:Helvetica,Arial,sans-serif">${rows.map(([k, v]) =>
    `<tr><td style="padding:6px 10px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#475569;width:60%">${htmlEscape(k)}</td><td style="padding:6px 10px;border-bottom:1px solid #E2E8F0;font-size:14px;color:#0F172A;font-weight:600;text-align:right">${htmlEscape(v)}</td></tr>`
  ).join('')}</table>`;
}

export { sendEmailViaMailChannels, htmlEscape, tableHtml, kpiHtml };
