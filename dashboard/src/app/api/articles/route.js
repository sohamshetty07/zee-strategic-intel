import { NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import path from 'path';

export async function GET() {
    const dbPath = path.resolve(process.cwd(), '../db/intel.db');

    return new Promise((resolve) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error("DB Connection Error:", err.message);
                return resolve(NextResponse.json({ error: 'Database connection failed' }, { status: 500 }));
            }
        });

        // FIXED: Explicitly added 'url' to the SELECT statement
        const query = `
            SELECT id, url, title, snippet, source, relevance_score, strategic_tags, status, published_at 
            FROM articles 
            ORDER BY published_at DESC, relevance_score DESC
        `;

        db.all(query, [], (err, rows) => {
            db.close();
            if (err) {
                return resolve(NextResponse.json({ error: err.message }, { status: 500 }));
            }
            resolve(NextResponse.json(rows));
        });
    });
}