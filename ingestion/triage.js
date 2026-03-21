const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to the local SQLite database
const dbPath = path.resolve(__dirname, '../db/intel.db');
const db = new sqlite3.Database(dbPath);

// The exact categories demanded by the Zee SPS Memo
const VALID_CATEGORIES = [
    "National News", 
    "Business Know How", 
    "International News", 
    "Account/Ppl Movement", 
    "Interesting Read", 
    "Economic Update",
    "Discard" 
];

async function askOllama(title, snippet) {
    const prompt = `
    You are the Lead Commercial Intelligence Analyst for Zee Entertainment Enterprises (Sales Planning & Strategy).
    Your job is to triage daily media news to identify threats and opportunities in the Indian broadcast and digital landscape.
    
    Article Title: ${title}
    Lead Paragraph: ${snippet}

    TASK 1: Categorise the article into EXACTLY ONE of these categories: ${VALID_CATEGORIES.join(", ")}. 
    (Use "Discard" for minor channel PR, irrelevant industries, or generic fluff).

    TASK 2: MULTI-AXIS SCORING (Rate each vector from 0 to 10)
    Evaluate the text against these four specific media industry vectors:
    1. competitor_threat (0-10): Does this involve Reliance, Jio, Disney, Star, Sony, Sun TV, or major OTT platforms expanding footprint or merging?
    2. regulatory_risk (0-10): Mentions of MIB, TRAI, CCI, Broadcasting Services Regulation Bill, or tariff orders.
    3. ad_revenue_impact (0-10): Shifts in FMCG ad-spending, festive season budgets, or agency (GroupM, Dentsu, Madison) forecasts.
    4. disruption_risk (0-10): Rise of CTV, sports rights monopolies, or Quick Commerce (Zepto, Blinkit, Instamart) siphoning traditional ad-dollars.

    TASK 3: CALCULATE MASTER SCORE (1-100)
    Calculate the 'relevance_score'. If any single vector above scores 8 or higher, the master score MUST be 80+. Otherwise, estimate a general relevance out of 100 based on the vectors.

    TASK 4: EXTRACT ENTITIES & SYNOPSIS
    - Extract an array of up to 3 key companies, agencies, or regulators mentioned.
    - Write a sharp, purely factual ONE-SENTENCE synopsis.

    TAGUCHI CONSTRAINTS:
    - ZERO CREATIVE GUESSING. If a vector is not mentioned in the text, score it 0.
    - Output strictly valid JSON.

    You MUST respond in strictly valid JSON format matching this structure:
    {
        "category": "Selected Category",
        "vectors": {
            "competitor_threat": 0,
            "regulatory_risk": 0,
            "ad_revenue_impact": 0,
            "disruption_risk": 0
        },
        "relevance_score": 85,
        "entities": ["Reliance", "GroupM"],
        "synopsis": "Your factual one-sentence synopsis."
    }
    `;

    try {
        const response = await fetch('http://127.0.0.1:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama3.2',
                prompt: prompt,
                format: 'json',
                stream: false,
                options: { temperature: 0.0 } // 0.0 forces absolute determinism
            })
        });

        const data = await response.json();
        return JSON.parse(data.response);
    } catch (error) {
        console.error(`⚠️ Ollama API Error:`, error.message);
        return null;
    }
}

async function runTriage() {
    console.log("🧠 Waking up local Ollama AI for Multi-Axis Triage...\n");

    db.all("SELECT id, title, snippet FROM articles WHERE status = 'pending'", async (err, rows) => {
        if (err) {
            console.error("❌ DB Read Error:", err.message);
            return db.close();
        }

        if (rows.length === 0) {
            console.log("✅ No pending articles to triage.");
            return db.close();
        }

        console.log(`📥 Found ${rows.length} pending articles. Beginning analysis...\n`);

        for (const row of rows) {
            console.log(`Processing: "${row.title.substring(0, 50)}..."`);
            
            const aiResult = await askOllama(row.title, row.snippet);
            
            if (aiResult) {
                // Stricter Discard Logic: It must score well on at least one vector, or have a decent master score.
                const isIrrelevant = (
                    aiResult.category === 'Discard' || 
                    aiResult.relevance_score < 15 || 
                    (aiResult.vectors.competitor_threat === 0 && aiResult.vectors.regulatory_risk === 0 && aiResult.vectors.ad_revenue_impact === 0 && aiResult.vectors.disruption_risk === 0 && aiResult.relevance_score < 40)
                );

                const newStatus = isIrrelevant ? 'discarded' : 'triaged';
                
                // We stringify the tags and the new entities array together for the frontend
                const combinedTags = JSON.stringify([
                    aiResult.category, 
                    ...aiResult.entities.map(e => `Entity: ${e}`)
                ]);

                // We can store the vector breakdown in the snippet column temporarily, or if you add a 'metadata' column to SQLite later.
                // For now, appending the vectors to the synopsis makes it visible in the dashboard.
                const vectorString = `[Threat: ${aiResult.vectors.competitor_threat}/10 | Reg: ${aiResult.vectors.regulatory_risk}/10 | Ad: ${aiResult.vectors.ad_revenue_impact}/10 | Disruption: ${aiResult.vectors.disruption_risk}/10]`;
                const enhancedSynopsis = `${aiResult.synopsis} ${vectorString}`;

                const updateQuery = `
                    UPDATE articles 
                    SET relevance_score = ?, strategic_tags = ?, snippet = ?, status = ?
                    WHERE id = ?
                `;
                
                await new Promise((resolve) => {
                    db.run(updateQuery, [aiResult.relevance_score, combinedTags, enhancedSynopsis, newStatus, row.id], resolve);
                });
            }
        }

        console.log("\n✅ Multi-Axis Triage Complete! Intelligence vectors updated.");
        
        db.close((err) => {
            if (err) console.error('❌ Error closing DB:', err);
            process.exit(0); 
        });
    });
}

runTriage();