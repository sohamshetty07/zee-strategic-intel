const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const cors = require('cors');

puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json());
app.use(cors());

console.log("🦞 Booting OpenClaw Deep Extraction Engine (M-Series Silicon Optimised)...");

app.post('/extract', async (req, res) => {
    const { url } = req.body;
    
    if (!url) return res.status(400).json({ error: "No URL provided" });
    
    console.log(`\n🎯 OpenClaw received target: ${url}`);
    let browser;
    
    try {
        // M4 Silicon Fix: Uses native Chrome instead of the bundled x86 Chromium
        browser = await puppeteer.launch({ 
            headless: "new",
            executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
        });
        
        const page = await browser.newPage();
        
        // Emulate a standard Mac user
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // networkidle2 ensures we wait for Google News JS redirects to finish
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
        
        const finalUrl = page.url();
        console.log(`📍 Redirect resolved to: ${finalUrl}`);
        
        const html = await page.content();
        const $ = cheerio.load(html);
        
        $('script, style, nav, footer, aside, .ad, .sponsor, header, iframe').remove();
        
        const text = $('p, article').map((i, el) => $(el).text().trim()).get().join('\n');
        
        await browser.close();
        
        if (text.length < 150) {
            throw new Error("Extracted text too short, likely blocked by publisher paywall.");
        }
        
        console.log(`✅ Extraction successful: ${text.length} characters retrieved.`);
        res.json({ text: text.substring(0, 5000), finalUrl });

    } catch (error) {
        console.error(`❌ OpenClaw failed: ${error.message}`);
        if (browser) await browser.close();
        res.status(500).json({ error: error.message });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`🚀 OpenClaw Service live and listening on http://localhost:${PORT}`);
});