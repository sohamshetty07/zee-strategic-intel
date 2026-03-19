const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'intel.db');
const db = new sqlite3.Database(dbPath);

console.log("📊 Reviewing AI Triaged Intelligence (Top 20)...\n");

const query = `
    SELECT 
        relevance_score as Score, 
        strategic_tags as Category, 
        title as Headline, 
        snippet as Synopsis 
    FROM articles 
    WHERE status = 'triaged' 
    ORDER BY relevance_score DESC 
    LIMIT 20
`;

db.all(query, [], (err, rows) => {
    if (err) {
        console.error("❌ DB Error:", err.message);
    } else {
        console.table(rows);
    }
    db.close();
});