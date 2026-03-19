const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Define the path to the local database file
const dbPath = path.resolve(__dirname, 'intel.db');

// Connect to SQLite (this will create the file if it doesn't exist)
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error connecting to the database:', err.message);
        process.exit(1);
    }
    console.log('✅ Connected to the local SQLite database.');
});

// Run the schema creation serially
db.serialize(() => {
    console.log('🏗️ Building the database schema...');

    // 1. The Relational Table (For Daily Triage)
    db.run(`
        CREATE TABLE IF NOT EXISTS articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            snippet TEXT,
            source TEXT,
            relevance_score INTEGER DEFAULT 0,
            strategic_tags TEXT, -- Stored as JSON string (e.g., '["Jio", "Sports Rights"]')
            status TEXT DEFAULT 'pending', -- 'pending', 'selected', 'discarded', 'published'
            published_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('❌ Error creating articles table:', err.message);
        else console.log('✅ [articles] table ready.');
    });

    // 2. The Vector Memory Table (For Historical AI Recall)
    // Note: We use 768 dimensions, which is standard for local Ollama embedding models like 'nomic-embed-text'
    db.run(`
        CREATE VIRTUAL TABLE IF NOT EXISTS vector_memory USING vec0(
            article_id INTEGER,
            embedding float[768]
        )
    `, (err) => {
        if (err) {
            // If sqlite-vec isn't natively loaded by the OS yet, we log it, but don't break the standard relational setup
            console.log('⚠️ Note: Vector extension (vec0) requires runtime loading. Relational DB is intact.');
        } else {
            console.log('✅ [vector_memory] virtual table ready.');
        }
    });
});

db.close((err) => {
    if (err) console.error('❌ Error closing database:', err.message);
    else console.log('🏁 Schema initialization complete.');
});