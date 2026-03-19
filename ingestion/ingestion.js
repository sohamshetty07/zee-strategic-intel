const Parser = require('rss-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cheerio = require('cheerio');

const parser = new Parser();

// Connect to our local vault
const dbPath = path.resolve(__dirname, '../db/intel.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
        process.exit(1);
    }
});

// The Expanded Elite Intelligence Net (Targeting Content, Distribution, and Monetisation)
const feeds = [
    // 🇮🇳 Tier 1: Core Indian Media & Broadcasting
    { source: 'Exchange4Media', url: 'https://news.google.com/rss/search?q=site:exchange4media.com+when:1d' },
    { source: 'ET Brand Equity', url: 'https://news.google.com/rss/search?q=site:brandequity.economictimes.indiatimes.com+when:1d' },
    { source: 'Afaqs', url: 'https://news.google.com/rss/search?q=site:afaqs.com+when:1d' },
    { source: 'Indian Television', url: 'https://news.google.com/rss/search?q=site:indiantelevision.com+when:1d' }, // Crucial for domestic broadcast metrics
    { source: 'MediaNews4U', url: 'https://news.google.com/rss/search?q=site:medianews4u.com+when:1d' },
    { source: 'BestMediaInfo', url: 'https://news.google.com/rss/search?q=site:bestmediainfo.com+when:1d' },
    
    // 📈 Tier 2: Indian Financial & Tech (The Money & The Platforms)
    { source: 'Moneycontrol', url: 'https://news.google.com/rss/search?q=site:moneycontrol.com+media+OR+entertainment+OR+telecom+when:1d' }, // Filtered for corporate media finance
    { source: 'Business Standard', url: 'https://news.google.com/rss/search?q=site:business-standard.com+media+when:1d' }, // Elite economic impact analysis
    { source: 'Livemint', url: 'https://news.google.com/rss/search?q=site:livemint.com/industry/media+when:1d' },
    { source: 'Economic Times', url: 'https://news.google.com/rss/search?q=site:economictimes.indiatimes.com+industry+media+when:1d' },
    { source: 'Inc42', url: 'https://news.google.com/rss/search?q=site:inc42.com+media+OR+ott+when:1d' }, // Essential for tracking digital streaming startups and quick commerce ad-spend
    
    // 🌍 Tier 3: Global Media, Ad-Tech & Streaming Strategy
    { source: 'Digiday', url: 'https://news.google.com/rss/search?q=site:digiday.com+when:1d' }, // The absolute gold standard for digital ad-yield and programmatic trends
    { source: 'Variety', url: 'https://news.google.com/rss/search?q=site:variety.com+global+OR+streaming+when:1d' }, // Global streaming M&A and structural shifts
    { source: 'The Drum', url: 'https://news.google.com/rss/search?q=site:thedrum.com+when:1d' },
    { source: 'Campaign Live UK', url: 'https://news.google.com/rss/search?q=site:campaignlive.co.uk+when:1d' },
    { source: 'AdAge', url: 'https://news.google.com/rss/search?q=site:adage.com+when:1d' },
    { source: 'WARC', url: 'https://news.google.com/rss/search?q=site:warc.com+when:1d' }
];

// Calculate the 12:00 PM yesterday cutoff
const getCutoffTime = () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 1);
    cutoff.setHours(12, 0, 0, 0);
    return cutoff;
};

// Helper function to strip out the messy "- SiteName" suffix from Google RSS titles
const cleanTitle = (rawTitle) => {
    return rawTitle.split(' - ')[0].trim();
};

async function ingestNews() {
    console.log(`🕒 Starting intelligence ingestion from full global network...`);
    const cutoffDate = getCutoffTime();
    let insertedCount = 0;
    let skippedCount = 0;

    for (const feed of feeds) {
        try {
            console.log(`📡 Fetching from: ${feed.source}`);
            const parsedFeed = await parser.parseURL(feed.url);

            for (const item of parsedFeed.items) {
                const pubDate = new Date(item.pubDate);

                if (pubDate >= cutoffDate && !item.title.includes("Latest News About")) {
                    const pristineTitle = cleanTitle(item.title);
                    let robustSnippet = item.contentSnippet;
                
                    // Inverted Pyramid Fetch: Grab the actual lead paragraph silently
                    try {
                        const res = await fetch(item.link);
                        const html = await res.text();
                        const $ = cheerio.load(html);

                        // Find the first substantive paragraph
                        let leadPara = $('p').first().text().trim();
                        if (leadPara.length < 50) leadPara = $('p').eq(1).text().trim(); 
            
                        if (leadPara && leadPara.length > 50) {
                            robustSnippet = leadPara.substring(0, 600) + '...';
                        }
                    } catch (e) {
                        // Silently fallback to RSS snippet if fetch fails
                    }

                    const query = `
                        INSERT OR IGNORE INTO articles 
                        (url, title, snippet, source, published_at, status) 
                        VALUES (?, ?, ?, ?, ?, 'pending')
                    `;

                    await new Promise((resolve, reject) => {
                        db.run(query, [item.link, pristineTitle, robustSnippet, feed.source, pubDate.toISOString()], function(err) {
                            if (err) reject(err);
                            else {
                                if (this.changes > 0) insertedCount++;
                                else skippedCount++;
                                resolve();
                            }
                        });
                    });
                }
            }

        } catch (error) {
            console.error(`⚠️ Failed to parse ${feed.source}: ${error.message}`);
        }
    }

    console.log(`\n✅ Global Ingestion Complete!`);
    console.log(`📥 New articles added to 'pending' queue: ${insertedCount}`);
    console.log(`⏭️  Duplicates skipped: ${skippedCount}`);
    
    db.close((err) => {
        if (err) console.error('❌ Error closing DB:', err);
        else console.log('🔌 Database connection closed cleanly.');
        process.exit(0);
    });
}

ingestNews();