import { gotScraping } from 'got-scraping';
import * as cheerio from 'cheerio';

export async function POST(req) {
    const { selectedArticles } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || !selectedArticles || selectedArticles.length === 0) {
        return new Response("Invalid request or missing API Key.", { status: 400 });
    }

    const dateString = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    const headerHtml = `
        <div style="font-family: 'Aptos Narrow', sans-serif; font-size: 12pt; color: #000000;">
        <h3 style="margin-bottom: 5px; font-size: 16pt;"><strong>Zee Strategic Intelligence Brief</strong></h3>
        <p style="margin-top: 0; margin-bottom: 20px;"><strong>Date:</strong> ${dateString}</p>
    `;

    // THE RPC PAYLOAD UNWRAPPER (Active Decryption)
    const decodeGoogleNewsUrl = async (sourceUrl) => {
        if (!sourceUrl.includes('news.google.com/rss/articles/')) return sourceUrl;
        try {
            const res = await fetch(sourceUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            const html = await res.text();
            const match = html.match(/data-p="([^"]+)"/);
            if (!match) return sourceUrl; 

            let dataP = match[1].replace(/&quot;/g, '"'); 
            const obj = JSON.parse(dataP.replace('%.@.', '["garturlreq",'));
            const reqStr = JSON.stringify([[ ['Fbv4je', JSON.stringify([...obj.slice(0, -6), ...obj.slice(-2)]), 'null', 'generic'] ]]);
            const payload = new URLSearchParams({ 'f.req': reqStr }).toString();

            const rpcRes = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                body: payload
            });

            const rpcText = await rpcRes.text();
            const cleanText = rpcText.replace(")]}'\n\n", "").trim();
            const rpcData = JSON.parse(cleanText);
            const innerData = JSON.parse(rpcData[0][2]);
            
            if (innerData && innerData[1]) return innerData[1];
        } catch (e) {
            console.error("   ↳ RPC Unwrapper Failed:", e.message);
        }
        return sourceUrl;
    };

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode(headerHtml));

            const categorisedArticles = selectedArticles.reduce((acc, article) => {
                let category = "Uncategorised";
                try { category = JSON.parse(article.strategic_tags)[0]; } 
                catch (e) { category = "Other News"; }
                if (!acc[category]) acc[category] = [];
                acc[category].push(article);
                return acc;
            }, {});

            let batchPayload = "";
            
            console.log("\n==============================================");
            console.log("🔍 X-RAY PROTOCOL: TLS SPOOF EXTRACTION");
            console.log("==============================================");

            for (const [category, articles] of Object.entries(categorisedArticles)) {
                batchPayload += `\n### CATEGORY: ${category} ###\n`;
                
                for (const article of articles) {
                    let fullText = article.snippet || "No snippet available."; 
                    let activeUrl = await decodeGoogleNewsUrl(article.url);
                    let sourceStatus = "DB Snippet (Fallback)";

                    // AI SEARCH APPROACH: got-scraping TLS spoofing + Cheerio parser
                    try {
                        const response = await gotScraping.get(activeUrl, {
                            timeout: { request: 10000 } // 10 second limit to protect Next.js runtime
                        });

                        if (response.statusCode === 200 && response.body) {
                            // Load HTML and strip out navigation, ads, and scripts
                            const $ = cheerio.load(response.body);
                            $('script, style, noscript, iframe, nav, footer, header, aside').remove();
                            
                            // Extract raw paragraph text
                            const cleanText = $('p').text().replace(/\s+/g, ' ').trim();
                            
                            if (cleanText.length > 500) {
                                fullText = cleanText.substring(0, 6000);  
                                sourceStatus = "got-scraping TLS Spoof (Success)";
                            }
                        }
                    } catch (e) {
                        console.log(`   ↳ got-scraping blocked/failed on ${activeUrl.substring(0, 30)}...`);
                    }

                    console.log(`📍 [${category}] ${article.title.substring(0, 40)}...`);
                    console.log(`   ↳ Source: ${sourceStatus} | Vol: ${fullText.length} chars`);

                    batchPayload += `ARTICLE TITLE: ${article.title}\nRAW TEXT: ${fullText}\n---\n`;
                    // Brief pause to simulate human timing
                    await new Promise(r => setTimeout(r, 600)); 
                }
            }

            console.log("🚀 SENDING PAYLOAD TO GEMINI COMPILER...");

            // STRICT EDITORIAL PROMPT
            const prompt = `
            You are the Editor-in-Chief for a high-stakes commercial intelligence newsletter.
            Below is a batch of daily news articles. You must format ALL of them into a cohesive HTML newsletter.

            ARTICLES BATCH:
            ${batchPayload}

            TASK & FORMATTING (CRITICAL):
            1. For EACH category provided in the batch, output this exact header:
               <div style="margin-top: 30px; margin-bottom: 12px;">
                   <span style="font-size: 13pt; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 2px;">
                       [INSERT CATEGORY NAME]
                   </span>
               </div>

            2. For EACH article, write exactly TWO sentences using STRICT EXTRACTIVE SUMMARISATION:
               Sentence 1 (The Factual Core): Extract the most critical event, deal, or announcement directly from the text. Retain the exact original meaning, names, and metrics. Do not editorialize.
               Sentence 2 (The Commercial Reality): State the direct, factual consequence of this event on market share, ad-yields, consumer behaviour, or industry competition. If the text does not state a consequence, do not invent one.

            3. Format each article exactly like this (NO HYPERLINKS):
               <p style="margin-bottom: 16px;">
                 <strong>[INSERT ARTICLE TITLE]</strong><br>
                 [Sentence 1] [Sentence 2]
               </p>

            TAGUCHI CONSTRAINTS:
            - ZERO CREATIVE LIBERTY. You must preserve the strict factual integrity of the original text.
            - If the raw text states "revenues grew 13%", you must say "revenues grew 13%".
            - Output ONLY the raw HTML. Do not wrap in \`\`\`html.
            `;

            try {
                const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: "user", parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.1 }
                    })
                });

                const data = await geminiRes.json();
                
                if (data.candidates && data.candidates[0].content) {
                    const finalHtml = data.candidates[0].content.parts[0].text.replace(/```html/gi, '').replace(/```/g, '').trim();
                    controller.enqueue(encoder.encode(finalHtml));
                }
            } catch (err) {
                controller.enqueue(encoder.encode(`<p><em>System Failure: Could not reach AI compiler.</em></p>`));
            }

            controller.enqueue(encoder.encode('</div>'));
            controller.close();
        }
    });

    return new Response(stream, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}