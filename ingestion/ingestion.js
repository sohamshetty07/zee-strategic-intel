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
    { source: 'AdAge', url: 'https://news.google.com/rss/search?q=site:adage.com+when:1d' },
    { source: 'WARC', url: 'https://news.google.com/rss/search?q=site:warc.com+when:1d' }
];

const getCutoffTime = () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 1);
    cutoff.setHours(12, 0, 0, 0);
    return cutoff;
};

const cleanTitle = (rawTitle) => {
    return rawTitle.split(' - ')[0].trim();
};

// THE RPC PAYLOAD UNWRAPPER (Shifted Left for Database Purity)
const decodeGoogleNewsUrl = async (sourceUrl) => {
    if (!sourceUrl.includes('news.google.com/rss/articles/')) return sourceUrl;
    try {
        const res = await fetch(sourceUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const html = await res.text();
        const match = html.match(/data-p="([^"]+)"/);
        if (!match) return sourceUrl; 

        let dataP = match[1].replace(/&quot;/g, '"'); 
        const obj = JSON.parse(dataP.replace('%.@.', '["garturlreq",'));
        const reqStr = JSON.stringify([[ ['Fbv4je', JSON.stringify([...obj.slice(0, -6), ...obj.slice(-2)]), 'null', 'generic'] ]]);
        const payload = new URLSearchParams({ 'f.req': reqStr }).toString();

        const rpcRes = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: payload
        });

        const rpcText = await rpcRes.text();
        const cleanText = rpcText.replace(")]}'\n\n", "").trim();
        const rpcData = JSON.parse(cleanText);
        const innerData = JSON.parse(rpcData[0][2]);
        
        if (innerData && innerData[1]) return innerData[1];
    } catch (e) {
        // Silent catch, will return original URL if decryption fails
    }
    return sourceUrl;
};

async function ingestNews() {
    const { gotScraping } = await import('got-scraping');
    
    console.log(`🕒 Waking up Elite Intelligence Net...`);
    const cutoffDate = getCutoffTime();
    let insertedCount = 0;
    let skippedCount = 0;

    for (const feed of feeds) {
        try {
            console.log(`\n📡 Scanning: ${feed.source}`);
            const parsedFeed = await parser.parseURL(feed.url);

            for (const item of parsedFeed.items) {
                const pubDate = new Date(item.pubDate);

                if (pubDate >= cutoffDate && !item.title.includes("Latest News About")) {
                    const pristineTitle = cleanTitle(item.title);
                    
                    // 1. Instantly Decrypt to True Publisher URL
                    const trueUrl = await decodeGoogleNewsUrl(item.link);
                    let robustSnippet = item.contentSnippet || "No snippet available.";
                
                    // 2. TLS Spoofed Deep Fetch for Triage Context
                    try {
                        const response = await gotScraping.get(trueUrl, {
                            timeout: { request: 6000 } // Keep it fast so ingestion doesn't stall
                        });
                        
                        if (response.statusCode === 200 && response.body) {
                            const $ = cheerio.load(response.body);
                            $('script, style, noscript, iframe, nav, footer, header, aside').remove();
                            
                            let leadText = $('p').text().replace(/\s+/g, ' ').trim();
                            if (leadText.length > 50) {
                                robustSnippet = leadText.substring(0, 700) + '...';
                            }
                        }
                    } catch (e) {
                        // Silently fallback to basic RSS snippet if WAF block is too aggressive
                    }

                    // 3. Save True URL to SQLite Database
                    const query = `
                        INSERT OR IGNORE INTO articles 
                        (url, title, snippet, source, published_at, status) 
                        VALUES (?, ?, ?, ?, ?, 'pending')
                    `;

                    await new Promise((resolve, reject) => {
                        db.run(query, [trueUrl, pristineTitle, robustSnippet, feed.source, pubDate.toISOString()], function(err) {
                            if (err) reject(err);
                            else {
                                if (this.changes > 0) {
                                    insertedCount++;
                                    console.log(`   ✅ Acquired: ${pristineTitle.substring(0, 40)}...`);
                                } else {
                                    skippedCount++;
                                }
                                resolve();
                            }
                        });
                    });
                    
                    // 400ms buffer to avoid slamming publishers during deep fetch
                    await new Promise(r => setTimeout(r, 400));
                }
            }
        } catch (error) {
            console.error(`⚠️ Failed to parse ${feed.source}: ${error.message}`);
        }
    }

    console.log(`\n==============================================`);
    console.log(`✅ GLOBAL INGESTION COMPLETE`);
    console.log(`📥 New strategic assets secured: ${insertedCount}`);
    console.log(`⏭️  Known duplicates skipped: ${skippedCount}`);
    console.log(`==============================================\n`);
    
    db.close((err) => {
        if (err) console.error('❌ Error closing DB:', err);
        else console.log('🔌 Vault sealed. Awaiting AI Triage.');
        process.exit(0);
    });
}

ingestNews();