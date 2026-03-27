import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function hardReset() {
    console.log("🧹 Connecting to MongoDB...");
    const client = new MongoClient(process.env.MONGODB_URI);
    
    try {
        await client.connect();
        const db = client.db('zee_intel');
        const articlesCollection = db.collection('articles');
        
        const result = await articlesCollection.deleteMany({});
        console.log(`💥 SUCCESS: Wiped ${result.deletedCount} articles from the database.`);
        console.log("✨ The Strategic Vault is now completely empty and ready for a fresh run.");
    } catch (error) {
        console.error("❌ Error wiping database:", error);
    } finally {
        await client.close();
        process.exit(0);
    }
}

hardReset();