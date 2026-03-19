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

    // THE ZERO-NETWORK PROTOBUF DECODER
    const decodeGoogleNewsUrl = (url) => {
        if (!url.includes('news.google.com/rss/articles/')) return url;
        try {
            // 1. Isolate the Base64 payload
            const encodedId = url.split('articles/')[1].split('?')[0];
            
            // 2. Convert Base64URL to standard Base64
            let base64 = encodedId.replace(/-/g, '+').replace(/_/g, '/');
            while (base64.length % 4 !== 0) base64 += '=';
            
            // 3. Decode into binary latin1 string
            const decodedString = Buffer.from(base64, 'base64').toString('latin1');
            
            // 4. RFC 3986 Regex to slice the true URL out of the binary junk
            const match = decodedString.match(/https?:\/\/[a-zA-Z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+/);
            if (match && match[0]) {
                return match[0]; // Instantly returns the true publisher URL
            }
        } catch (e) {
            console.error("Binary decode failed:", e);
        }
        return url;
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
            console.log("🔍 X-RAY PROTOCOL: BINARY DECODE & EXTRACT");
            console.log("==============================================");

            for (const [category, articles] of Object.entries(categorisedArticles)) {
                batchPayload += `\n### CATEGORY: ${category} ###\n`;
                
                for (const article of articles) {
                    let fullText = article.snippet || "No snippet available."; 
                    
                    // Decodes locally without any network requests
                    let activeUrl = decodeGoogleNewsUrl(article.url);
                    let sourceStatus = "DB Snippet (Fallback)";

                    // Fetch the clean URL via Jina Reader
                    try {
                        const jinaRes = await fetch(`https://r.jina.ai/${activeUrl}`, {
                            headers: { 
                                'X-Return-Format': 'markdown',
                                'User-Agent': 'Zee-Strategic-Intel-App/1.0'
                            },
                            signal: AbortSignal.timeout(10000)
                        });
                        
                        if (jinaRes.ok) {
                            const markdownText = await jinaRes.text();
                            if (markdownText && markdownText.length > 200) {
                                fullText = markdownText.substring(0, 6000);  
                                sourceStatus = "Jina AI Markdown Extract";
                            }
                        }
                    } catch (e) {
                        // Silent fallback
                    }

                    console.log(`📍 [${category}] ${article.title.substring(0, 40)}...`);
                    console.log(`   ↳ Clean Target: ${activeUrl.substring(0, 70)}...`);
                    console.log(`   ↳ Source: ${sourceStatus}`);
                    console.log(`   ↳ Payload Volume: ${fullText.length} characters extracted.\n`);

                    batchPayload += `ARTICLE TITLE: ${article.title}\nRAW TEXT: ${fullText}\n---\n`;
                    
                    // 500ms pacing to protect API limits
                    await new Promise(r => setTimeout(r, 500));
                }
            }

            console.log("🚀 SENDING MASTER PAYLOAD TO GEMINI...");
            console.log(`Total Batch Size: ${batchPayload.length} characters.`);

            const prompt = `
            You are the Editor-in-Chief for Zee Entertainment Sales Strategy.
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

            2. For EACH article, write exactly TWO sentences:
               Sentence 1 (The Hard Fact): State exactly what happened. YOU MUST extract specific numbers, deal sizes, growth percentages, or names mentioned in the raw text. Do not just rephrase the headline.
               Sentence 2 (The Commercial Impact): State exactly how this impacts ad-yields, streaming competition, consumer behaviour, or market share in India. Be highly specific.

            3. Format each article exactly like this (NO HYPERLINKS):
               <p style="margin-bottom: 16px;">
                 <strong>[INSERT ARTICLE TITLE]</strong><br>
                 [Sentence 1] [Sentence 2]
               </p>

            TAGUCHI CONSTRAINTS:
            - DO NOT output generic summaries. If the text says "revenues grew 13%", you must say "revenues grew 13%".
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
                
                if (data.error) {
                    console.error("❌ Gemini API Error:", data.error.message);
                    controller.enqueue(encoder.encode(`<p><em>API Error: ${data.error.message}</em></p>`));
                } else if (data.candidates && data.candidates[0].content) {
                    const finalHtml = data.candidates[0].content.parts[0].text.replace(/```html/gi, '').replace(/```/g, '').trim();
                    controller.enqueue(encoder.encode(finalHtml));
                    console.log("✅ COMPILATION SUCCESSFUL. Streaming to dashboard.");
                }
            } catch (err) {
                console.error("Fetch Error:", err);
                controller.enqueue(encoder.encode(`<p><em>System Failure: Could not reach AI compiler.</em></p>`));
            }

            controller.enqueue(encoder.encode('</div>'));
            controller.close();
        }
    });

    return new Response(stream, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}