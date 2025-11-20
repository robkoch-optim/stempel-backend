const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path'); // Dodajemy moduł path do obsługi ścieżek

const app = express();
const PORT = 3080;

// Pozwól na dostęp zewsząd (rozwiązuje problemy CORS)
app.use(cors());

// Zwiększamy limit danych (dla obrazków)
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// WAŻNE: Serwowanie plików statycznych (HTML, CSS, JS) z tego samego folderu
app.use(express.static(__dirname));

// Obsługa głównej strony - gdy wejdziesz na localhost:3000
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Generowanie PDF
app.post('/generate-pdf', async (req, res) => {
    const { html, width, height, css } = req.body;

    console.log(`Otrzymano żądanie generowania PDF: ${width}x${height}`);

    try {
        const browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox']
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
                    .stamp { border: none !important; margin: 0 !important; }
                </style>
            </head>
            <body>
                ${html}
            </body>
            </html>
        `;

        await page.setContent(content, { waitUntil: 'networkidle0' });
        
        // Czekamy na fonty
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

app.listen(PORT, () => {
    console.log(`\n--- SERWER URUCHOMIONY ---`);
    console.log(`1. Nie otwieraj pliku index.html dwuklikiem.`);
    console.log(`2. Wejdź w przeglądarce na adres: http://localhost:${PORT}`);
    console.log(`--------------------------\n`);
});