const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

// ====== KONFIG CORS / BODY ======
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// ====== ZMIENNE ŚRODOWISKOWE SMTP ======
const SMTP_HOST = process.env.SMTP_HOST;      // np. mail.poczta.pl
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;      // np. nazwa@serwer.pl
const SMTP_PASS = process.env.SMTP_PASS;      // hasło do skrzynki
const RECEIVER_EMAIL = process.env.RECEIVER_EMAIL; // gdzie mają iść zamówienia

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !RECEIVER_EMAIL) {
  console.warn('[WARN] Brakuje którejś ze zmiennych: SMTP_HOST, SMTP_USER, SMTP_PASS, RECEIVER_EMAIL');
}

// ====== TRANSPORTER SMTP ======
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

// ====== FUNKCJA GENERUJĄCA PDF ======
async function generatePDF(html, width, height, css) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const content = `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
      <meta charset="UTF-8" />
      <style>
        ${css}
        body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
        .stamp { border: none !important; margin: 0 !important; }
      </style>
    </head>
    <body>${html}</body>
    </html>
  `;

  await page.setContent(content, { waitUntil: 'networkidle0' });
  await page.evaluateHandle('document.fonts.ready');

  const pdfBuffer = await page.pdf({
    width,
    height,
    printBackground: true,
    pageRanges: '1'
  });

  await browser.close();
  return pdfBuffer;
}

// ====== ENDPOINT: tylko pobranie PDF ======
app.post('/generate-pdf', async (req, res) => {
  const { html, width, height, css } = req.body;

  try {
    const pdfBuffer = await generatePDF(html, width, height, css);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuffer.length
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error('[PDF ERROR]', err);
    res.status(500).send('Błąd generowania PDF');
  }
});

// ====== ENDPOINT: wysyłka zamówienia mailem ======
app.post('/send-order', async (req, res) => {
  const { html, width, height, css, meta, orderDetails, externalId } = req.body;

  console.log(`[INFO] Wysyłka zamówienia ${orderDetails?.id} z ${SMTP_USER} na ${RECEIVER_EMAIL}`);

  try {
    // 1. PDF
    const pdfBuffer = await generatePDF(html, width, height, css);

    // 2. Treść maila
    const mailText = `
NOWE ZAMÓWIENIE STEMPLA

Numer wewnętrzny: ${orderDetails?.id || 'brak'}
ID zewnętrzne (Allegro/inne): ${externalId || 'brak'}

DANE ZAMAWIAJĄCEGO:
--------------------------------------
Firma:       ${orderDetails?.companyName || ''}
Miasto:      ${orderDetails?.city || ''}
Adres:       ${orderDetails?.address || ''}
Email:       ${orderDetails?.contactEmail || ''}

SZCZEGÓŁY PRODUKTU:
--------------------------------------
Model:       ${meta?.modelName || meta?.size || ''}
ID modelu:   ${meta?.size || ''}
Ilość sztuk: ${orderDetails?.quantity || ''}
Kolor obud.: ${orderDetails?.color || ''}
Fonty:       ${meta?.fonts || ''}

--------------------------------------
Plik produkcyjny PDF znajduje się w załączniku.
Wiadomość wygenerowana automatycznie z Kreatora Stempli.
    `.trim();

    // 3. Wysyłka
    await transporter.sendMail({
      from: `"Kreator pieczątek" <${SMTP_USER}>`,
      to: RECEIVER_EMAIL,
      replyTo: orderDetails?.contactEmail || undefined,
      subject: `[PRZEKAZANO] Stempel zamówienie – ${orderDetails?.id || ''}`,
      text: mailText,
      attachments: [
        {
          filename: `stempel-${orderDetails?.id || 'zamowienie'}.pdf`,
          content: pdfBuffer
        }
      ]
    });

    console.log('[SUCCESS] E-mail z zamówieniem wysłany.');
    res.json({ ok: true, message: 'Wysłano pomyślnie' });

  } catch (err) {
    console.error('[CRITICAL ERROR] Błąd wysyłki:', err);
    res.status(500).send('Błąd wysyłki zamówienia');
  }
});

// ====== START SERWERA ======
app.listen(PORT, () => {
  console.log('--- KREATOR STEMPLI – backend ---');
  console.log('Port:      ', PORT);
  console.log('SMTP host: ', SMTP_HOST);
  console.log('SMTP user: ', SMTP_USER);
  console.log('Odbiorca:  ', RECEIVER_EMAIL);
  console.log('---------------------------------');
});
