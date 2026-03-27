import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

let client;
let clientPromise;

if (!global._mongoClientPromise) {
    client = new MongoClient(MONGODB_URI);
    global._mongoClientPromise = client.connect();
}
clientPromise = global._mongoClientPromise;

export async function GET() {
    try {
        const dbClient = await clientPromise;
        const db = dbClient.db('zee_intel');
        
        const articles = await db.collection('articles')
            .find({})
            .sort({ published_at: -1 })
            .toArray();

        const formattedArticles = articles.map(a => ({
            id: a._id.toString(),
            url: a.url,
            title: a.title,
            snippet: a.snippet,
            source: a.source,
            // We are now passing the full array of tags (Category + Impact)
            strategic_tags: a.strategic_tags || JSON.stringify(["Uncategorised"]),
            published_at: a.published_at
        }));

        return NextResponse.json(formattedArticles);
    } catch (error) {
        console.error("MongoDB Connection Error:", error);
        return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }
}