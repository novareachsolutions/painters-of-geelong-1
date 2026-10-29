import { Resend } from 'resend';

/**
 * Vercel serverless function — Painters of Geelong quote form handler.
 *
 * Front-end forms (index.html, contact-us.html) POST JSON here. We re-validate
 * server-side and deliver the enquiry by email via Resend.
 *
 * Environment variables (set in Vercel → Settings → Environment Variables):
 *   RESEND_API_KEY    — required. Without it the function returns 500.
 *   RESEND_FROM_EMAIL — optional verified sender, e.g.
 *                       "Painters of Geelong <quotes@paintersofgeelong.com.au>".
 *                       Defaults to onboarding@resend.dev (test only — delivers
 *                       just to your own Resend account until the domain is verified).
 */

const resend = new Resend(process.env.RESEND_API_KEY);

const TO_EMAIL = 'Paintersofgeelong@outlook.com';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

// These rules mirror assets/js/quote-form.js.
const NAME_RE = /^\p{L}+(?: \p{L}+)*$/u;
const PHONE_RE = /^(?:0[2-478]\d{8}|\+61[2-478]\d{8})$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
const SUBURB_RE = /^[\p{L}0-9' -]+$/u;
const MAX_DETAILS = 1000;

const SERVICES = [
  'Interior Painting',
  'Exterior Painting',
  'Commercial Painting',
  'Deck & Timber Staining',
  'Pressure Cleaning',
  'Multiple Services',
  'Other',
];
const TIMEFRAMES = ['ASAP', 'Within 2 Weeks', 'Within a Month', 'Flexible', 'Exploring Options'];

// Photos arrive base64-encoded (already resized in the browser) and go out as
// email attachments. Vercel caps the whole request at 4.5 MB.
const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function validSuburb(v) {
  if (v.length < 3 || v.length > 60 || !SUBURB_RE.test(v)) return false;
  const digits = v.match(/\d+/g) || [];
  if (digits.length > 1 || (digits.length === 1 && digits[0].length !== 4)) return false;
  return /\p{L}{2,}/u.test(v) || digits.length === 1;
}

// Identify the image type from its first bytes rather than trusting the client.
function sniffImage(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.toString('hex', 0, 8) === '89504e470d0a1a0a') return 'image/png';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function photoAttachments(list) {
  if (list == null) return { attachments: [] };
  if (!Array.isArray(list)) return { error: 'The photos could not be read. Please try again.' };
  if (list.length > MAX_PHOTOS) return { error: 'You can upload up to 5 photos.' };
  const attachments = [];
  for (let i = 0; i < list.length; i++) {
    const p = list[i] || {};
    const data = typeof p.data === 'string' ? p.data : '';
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
      return { error: 'One of the photos could not be read. Please remove it and try again.' };
    }
    const buf = Buffer.from(data, 'base64');
    const type = sniffImage(buf);
    if (!type || buf.length > MAX_PHOTO_BYTES) {
      return { error: 'Photos must be JPG, PNG or WebP images of 5 MB or less.' };
    }
    const base = String(p.name || '')
      .replace(/\.[^.]*$/, '')
      .replace(/[^A-Za-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'photo';
    attachments.push({ filename: `${i + 1}-${base}.${PHOTO_EXT[type]}`, content: buf });
  }
  return { attachments };
}

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return {}; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ ok: false, error: 'Email service is not configured.' });
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {});

  // Honeypot — bots fill the hidden "company" field; pretend success.
  if (typeof body.company === 'string' && body.company.trim() !== '') {
    return res.status(200).json({ ok: true });
  }

  const v = (s) => String(s || '').trim();
  const f = {
    name: v(body.name).replace(/ {2,}/g, ' '),
    phone: v(body.phone).replace(/[\s().-]/g, '').replace(/^\+610/, '+61'),
    email: v(body.email),
    suburb: v(body.suburb).replace(/ {2,}/g, ' '),
    service: v(body.service),
    timeframe: v(body.timeframe),
    message: v(body.message),
  };
  const source = v(body.source) || '—';
  const fail = (error, field) => res.status(400).json({ ok: false, error, field });

  // Server-side validation (mirrors the client):
  // required = name, phone, suburb, service; optional = email, timeframe, message, photos.
  if (!f.name) return fail('Please enter your name.', 'name');
  if (!NAME_RE.test(f.name) || f.name.length > 60) {
    return fail('Your name can only contain letters and spaces.', 'name');
  }
  if (f.name.length < 2) return fail('Please enter your full name.', 'name');
  if (!f.phone) return fail('Please enter your phone number.', 'phone');
  if (!PHONE_RE.test(f.phone)) {
    return fail('Please enter a valid Australian phone number, e.g. 0431261281 or +61431261281.', 'phone');
  }
  if (f.email && (f.email.length > 254 || !EMAIL_RE.test(f.email))) {
    return fail('Please enter a valid email address.', 'email');
  }
  if (!f.suburb) return fail('Please enter your suburb or postcode.', 'suburb');
  if (!validSuburb(f.suburb)) return fail('Please enter a suburb name and/or a 4-digit postcode.', 'suburb');
  if (!SERVICES.includes(f.service)) return fail('Please choose a service.', 'service');
  if (f.timeframe && !TIMEFRAMES.includes(f.timeframe)) return fail('Please choose a timeframe from the list.', 'timeframe');
  if (f.message.length > MAX_DETAILS) return fail('Please keep project details under 1,000 characters.', 'message');

  const photos = photoAttachments(body.photos);
  if (photos.error) return fail(photos.error, 'photos');

  const rows = [
    ['Name', f.name],
    ['Phone', f.phone],
    ['Email', f.email || '—'],
    ['Suburb / Postcode', f.suburb],
    ['Service', f.service],
    ['Preferred Timeframe', f.timeframe || '—'],
    ['Project Details', f.message || '—'],
    ['Photos', photos.attachments.length ? `${photos.attachments.length} attached` : '—'],
    ['Source', source],
  ];

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1b2030">
    <h2 style="color:#e8762d;margin:0 0 16px">New Quote Request — Painters of Geelong</h2>
    <table cellpadding="8" style="border-collapse:collapse;font-size:15px">
      ${rows
        .map(
          ([k, val]) =>
            `<tr><td style="font-weight:bold;vertical-align:top;border-bottom:1px solid #eee;white-space:nowrap">${esc(k)}</td><td style="vertical-align:top;border-bottom:1px solid #eee">${esc(val).replace(/\n/g, '<br>')}</td></tr>`
        )
        .join('')}
    </table>
  </div>`;

  const text = rows.map(([k, val]) => `${k}: ${val}`).join('\n');

  try {
    const payload = {
      from: FROM_EMAIL,
      to: [TO_EMAIL],
      subject: `New Quote Request — ${f.name}`,
      html,
      text,
    };
    // Let staff reply straight to the customer when they left an email.
    if (f.email) payload.replyTo = f.email;
    if (photos.attachments.length) payload.attachments = photos.attachments;

    const { data, error } = await resend.emails.send(payload);
    if (error) {
      // Surfaced in Vercel → Deployments → Functions → api/send-email logs.
      console.error('Resend send failed:', JSON.stringify(error), '| from:', FROM_EMAIL, '| to:', TO_EMAIL);
      return res.status(502).json({
        ok: false,
        error: 'The email service could not send your message. Please call us or try again.',
      });
    }
    console.log('Resend send ok:', data && data.id);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send-email unexpected error:', err && (err.stack || err.message || err));
    return res.status(500).json({
      ok: false,
      error: 'Unexpected error sending your message. Please call us or try again.',
    });
  }
}
