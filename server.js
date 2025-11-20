const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// Render wymaga nasłuchiwania na zmiennej środowiskowej:
const PORT = process.env.PORT || 3080;

// CORS – pozwalamy na połączenia z dowolnej domeny
app.use(cors());

// Zwiększamy limit JSON (potrzebne dla obrazów base64)
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Serwowanie plików statycznych (opcjonalnie)
app.use(express.static(__dirname));

// Strona główna (opcjonalnie, Render i tak serwuje tylko API)
app.get('/', (req, res) => {
    res.send("PDF Generator API działa poprawnie.");
});

// Endpoint generowania PDF
app.post('/generate-pdf', async (req, res) => {
    const { html, width, height, css } = req.body;

    console.log(`Otrzymano żądanie PDF: ${width} x ${height}`);

    try {
        const browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        const content = `
            <!DOCTYPE html>
            <html lang="pl">
            <head>
                <meta charset="UTF-8">
                <style>
                    ${css}
                    body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
                </style>
            </head>
            <body>
                ${html}
            </body>
            </html>
        `;

        await page.setContent(content, { waitUntil: 'networkidle0' });

        // Czekamy na załadowanie fontów
        await page.evaluateHandle('document.fonts.ready');

        const pdfBuffer = await page.pdf({
            width: width,
            height: height,
            printBackground: true,
            pageRanges: '1'
        });

        await browser.close();

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Length': pdfBuffer.length
        });

        res.send(pdfBuffer);
        console.log("PDF wygenerowany i wysłany.");

    } catch (error) {
        console.error('Błąd Puppeteer:', error);
        res.status(500).send('Błąd generowania PDF');
    }
});

// NAJWAŻNIEJSZA ZMIANA dla RENDER:
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});
