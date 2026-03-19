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
    "Discard" // For PR fluff and irrelevant noise
];

async function askOllama(title, snippet) {
    const prompt = `
    You are a strictly factual Data Analyst filtering daily news.
    
    Article Title: ${title}
    Lead Paragraph: ${snippet}

    Task:
    1. Categorise this article into EXACTLY ONE of these categories: ${VALID_CATEGORIES.join(", ")}. 
       - If it is minor channel PR, or a weird URL slug, categorise it as "Discard".
    2. Assign a "Zee Relevancy Score" from 1 to 100 based strictly on this rubric:
       - 90-100: Direct financial impact on Zee, major competitor (Jio/Disney) merger, or new MIB/TRAI broadcasting law.
       - 70-89: Broad ad-yield trends, shift in streaming behaviour, or major leadership change at a competitor.
       - 40-69: General economic updates, minor tech launches, or generic marketing surveys.
       - 1-39: Unrelated industries, minor PR, or irrelevant news.
    3. Write a sharp, ONE-SENTENCE synopsis of the facts.

    TAGUCHI CONSTRAINTS:
    - DO NOT invent connections to Zee Entertainment. 
    - You must output a number between 1 and 100 for the score.

    You MUST respond in strictly valid JSON format matching this structure:
    {
        "category": "Selected Category",
        "score": 85,
        "synopsis": "Your purely factual one-sentence synopsis."
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
                options: { temperature: 0.0 } // 0.0 forces absolute determinism (no creative guessing)
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
    console.log("🧠 Waking up local Ollama AI for triage...\n");

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
                // If Ollama marks it as 'Discard' or scores it below 5, we change status to 'discarded'
                const newStatus = (aiResult.category === 'Discard' || aiResult.score < 5) ? 'discarded' : 'triaged';
                
                // Update the database with the AI's intelligence
                const updateQuery = `
                    UPDATE articles 
                    SET relevance_score = ?, strategic_tags = ?, snippet = ?, status = ?
                    WHERE id = ?
                `;
                
                await new Promise((resolve) => {
                    db.run(updateQuery, [aiResult.score, JSON.stringify([aiResult.category]), aiResult.synopsis, newStatus, row.id], resolve);
                });
            }
        }

        console.log("\n✅ Triage Complete! The noise has been filtered.");
        
        db.close((err) => {
            if (err) console.error('❌ Error closing DB:', err);
            process.exit(0); 
        });
    });
}

runTriage();