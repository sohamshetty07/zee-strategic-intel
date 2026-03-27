import Parser from 'rss-parser';
import { MongoClient } from 'mongodb';
import { pipeline } from '@xenova/transformers';
import dotenv from 'dotenv';

dotenv.config();

const parser = new Parser();
const MONGODB_URI = process.env.MONGODB_URI;

// Stage 1: Sector Classification
const VALID_CATEGORIES = [
    "National News", 
    "Business Know How", 
    "International News", 
    "Account/Ppl Movement", 
    "Interesting Read", 
    "Economic Update"
];

// Stage 2: Semantic Impact Analysis
const IMPACT_LABELS = [
    "Major Strategic Move",
    "Market Disruption",
    "Regulatory Shift",
    "Routine Business News"
];

// Entity Radar (Keyword fallback for specific companies)
const IMPACT_TRIGGERS = {
    "⚠️ Competitor Radar": ["reliance", "jio", "disney", "star", "sony", "sun tv", "viacom18"],
    "🚨 Q-Commerce Watch": ["zepto", "blinkit", "instamart", "swiggy", "zomato", "quick commerce"],
    "💰 Ad Revenue Watch": ["groupm", "madison", "fmcg", "ad spend", "festive budget", "dentsu"]
};

// The Expanded Elite Intelligence Net
const feeds = [
    { source: 'Exchange4Media', url: 'https://news.google.com/rss/search?q=site:exchange4media.com+when:1d' },
    { source: 'ET Brand Equity', url: 'https://news.google.com/rss/search?q=site:brandequity.economictimes.indiatimes.com+when:1d' },
    { source: 'Afaqs', url: 'https://news.google.com/rss/search?q=site:afaqs.com+when:1d' },
    { source: 'Indian Television', url: 'https://news.google.com/rss/search?q=site:indiantelevision.com+when:1d' },
    { source: 'MediaNews4U', url: 'https://news.google.com/rss/search?q=site:medianews4u.com+when:1d' },
    { source: 'BestMediaInfo', url: 'https://news.google.com/rss/search?q=site:bestmediainfo.com+when:1d' },
    { source: 'Moneycontrol', url: 'https://news.google.com/rss/search?q=site:moneycontrol.com+media+OR+entertainment+OR+telecom+when:1d' },
    { source: 'Business Standard', url: 'https://news.google.com/rss/search?q=site:business-standard.com+media+when:1d' },
    { source: 'Livemint', url: 'https://news.google.com/rss/search?q=site:livemint.com/industry/media+when:1d' },
    { source: 'Economic Times', url: 'https://news.google.com/rss/search?q=site:economictimes.indiatimes.com+industry+media+when:1d' },
    { source: 'Inc42', url: 'https://news.google.com/rss/search?q=site:inc42.com+media+OR+ott+when:1d' },
    { source: 'Digiday', url: 'https://news.google.com/rss/search?q=site:digiday.com+when:1d' },
    { source: 'Variety', url: 'https://news.google.com/rss/search?q=site:variety.com+global+OR+streaming+when:1d' },
    { source: 'The Drum', url: 'https://news.google.com/rss/search?q=site:thedrum.com+when:1d' },
    { source: 'Campaign Live UK', url: 'https://news.google.com/rss/search?q=site:campaignlive.co.uk+when:1d' },
    { source: 'AdAge', url: 'https://news.google.com/rss/search?q=site:adage.com+when:1d' }
];

function assignEntityTags(text) {
    const lowerText = text.toLowerCase();
    let tags = [];
    for (const [tag, keywords] of Object.entries(IMPACT_TRIGGERS)) {
        if (keywords.some(keyword => lowerText.includes(keyword))) {
            tags.push(tag);
        }
    }
    return tags;
}

async function ingestAndTriage() {
    console.log("🕒 Waking up Intelligence Net & Local AI Classifier...");
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('zee_intel');
    const articlesCollection = db.collection('articles');

    console.log("🧹 Purging intelligence older than 48 hours...");
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await articlesCollection.deleteMany({ published_at: { $lt: twoDaysAgo } });

    // Load the local Zero-Shot Classification Model once
    const classifier = await pipeline('zero-shot-classification', 'Xenova/mobilebert-uncased-mnli');
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 1);

    let insertedCount = 0;
    let duplicateCount = 0;

    for (const feed of feeds) {
        try {
            console.log(`\n📡 Scanning: ${feed.source}`);
            const parsedFeed = await parser.parseURL(feed.url);

            for (const item of parsedFeed.items) {
                const pubDate = new Date(item.pubDate);
                
                if (pubDate >= cutoffDate) {
                    const pristineTitle = item.title.split(' - ')[0].trim();
                    const snippet = item.contentSnippet || "";

                    // Deduplication Filter
                    const exists = await articlesCollection.findOne({ 
                        $or: [{ url: item.link }, { title: pristineTitle }]
                    });

                    if (exists) {
                        duplicateCount++;
                        continue;
                    }

                    const textToAnalyse = `${pristineTitle}. ${snippet}`;
                    
                    // --- STAGE 1: Sector Categorisation (AI) ---
                    const aiResult = await classifier(textToAnalyse, VALID_CATEGORIES);
                    let assignedCategory = aiResult.labels[0];
                    if (aiResult.scores[0] < 0.25) {
                        assignedCategory = "Interesting Read"; 
                    }

                    // --- STAGE 2: Semantic Impact Analysis (AI) ---
                    const impactResult = await classifier(textToAnalyse, IMPACT_LABELS);
                    const topImpact = impactResult.labels[0];
                    const impactScore = impactResult.scores[0];

                    // Gather specific keyword entity tags
                    let impactTags = assignEntityTags(textToAnalyse);

                    // Add semantic AI tags if it's not a routine news story
                    if (topImpact !== "Routine Business News" && impactScore > 0.40) {
                        if (topImpact === "Major Strategic Move") impactTags.push("🔥 Strategic Move");
                        if (topImpact === "Market Disruption") impactTags.push("🚨 Market Disruption");
                        if (topImpact === "Regulatory Shift") impactTags.push("⚖️ Regulatory Shift");
                    }
                    
                    // Combine AI Sector Category with Impact Tags
                    const combinedTags = [assignedCategory, ...impactTags];

                    await articlesCollection.insertOne({
                        url: item.link,
                        title: pristineTitle,
                        snippet: snippet,
                        source: feed.source,
                        category: assignedCategory,
                        strategic_tags: JSON.stringify(combinedTags),
                        published_at: pubDate,
                        created_at: new Date()
                    });

                    console.log(`   ✅ Acquired: ${pristineTitle.substring(0, 40)}...`);
                    if (impactTags.length > 0) {
                        console.log(`      ↳ Flagged High Impact: [${impactTags.join(', ')}]`);
                    }
                    insertedCount++;
                }
            }
        } catch (error) {
            console.error(`⚠️ Failed to parse ${feed.source}: ${error.message}`);
        }
    }

    console.log(`\n==============================================`);
    console.log(`✅ INGESTION & 2-STAGE AI TRIAGE COMPLETE`);
    console.log(`📥 New strategic assets: ${insertedCount}`);
    console.log(`⏭️  Noise reduced (duplicates skipped): ${duplicateCount}`);
    console.log(`==============================================\n`);
    
    await client.close();
    process.exit(0);
}

ingestAndTriage();