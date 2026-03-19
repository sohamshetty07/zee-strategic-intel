"use client";
import { useState, useEffect } from 'react';

export default function StrategyDesk() {
    const [articles, setArticles] = useState([]);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [isCompiling, setIsCompiling] = useState(false);
    const [finalHtml, setFinalHtml] = useState("");
    
    // Master Filters
    const [activeTab, setActiveTab] = useState("all"); 
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [sortOrder, setSortOrder] = useState("score_desc");
    const [showOnlySelected, setShowOnlySelected] = useState(false);

    useEffect(() => {
        fetch('/api/articles')
            .then(res => res.json())
            .then(data => setArticles(data))
            .catch(err => console.error("Failed to fetch:", err));
    }, []);

    const toggleSelection = (id) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedIds(newSelected);
    };

    const compileNewsletter = async () => {
        setIsCompiling(true);
        setFinalHtml(""); 
        const selectedArticles = articles.filter(a => selectedIds.has(a.id));
        
        try {
            const res = await fetch('/api/compile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ selectedArticles })
            });

            if (!res.body) throw new Error("ReadableStream not supported by browser.");

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let done = false;

            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;
                if (value) {
                    const chunk = decoder.decode(value, { stream: true });
                    setFinalHtml((prev) => prev + chunk);
                }
            }
        } catch (error) {
            console.error("Error compiling:", error);
            alert("Compilation failed. Check console.");
        }
        setIsCompiling(false);
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(finalHtml);
        alert("Copied to clipboard! Ready to paste into Outlook.");
    };

    const getCategory = (tags) => {
        try {
            return JSON.parse(tags)[0];
        } catch {
            return "Uncategorised";
        }
    };

    const getScoreColour = (score) => {
        if (score >= 80) return "bg-blue-500";
        if (score >= 50) return "bg-yellow-500";
        return "bg-gray-500";
    };

    const safeFormatDate = (dateString) => {
        if (!dateString) return "";
        return dateString.split('T')[0];
    };

    const uniqueCategories = ["All", ...new Set(articles.map(a => getCategory(a.strategic_tags)).filter(c => c !== "Uncategorised" && c !== "Discard"))];

    let processedArticles = articles.filter(a => {
        const matchesTab = activeTab === "all" || a.status === activeTab;
        const matchesCategory = selectedCategory === "All" || getCategory(a.strategic_tags) === selectedCategory;
        const matchesSelection = showOnlySelected ? selectedIds.has(a.id) : true;
        return matchesTab && matchesCategory && matchesSelection;
    });

    processedArticles.sort((a, b) => {
        if (sortOrder === "score_desc") return b.relevance_score - a.relevance_score;
        if (sortOrder === "score_asc") return a.relevance_score - b.relevance_score;
        if (sortOrder === "date_desc") return new Date(b.published_at) - new Date(a.published_at);
        return 0;
    });

    const isAllSelected = processedArticles.length > 0 && processedArticles.every(a => selectedIds.has(a.id));
    const toggleSelectAll = (e) => {
        const newSelected = new Set(selectedIds);
        if (e.target.checked) {
            processedArticles.forEach(a => newSelected.add(a.id));
        } else {
            processedArticles.forEach(a => newSelected.delete(a.id));
        }
        setSelectedIds(newSelected);
    };

    return (
        <main className="min-h-screen bg-gray-950 text-gray-200 p-8 font-sans">
            <header className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Zee Strategy Desk</h1>
                    <p className="text-gray-400 text-sm mt-1">AI-Augmented Commercial Intelligence</p>
                </div>
                <div className="flex space-x-4 items-center">
                    <span className="text-gray-400 text-sm border-r border-gray-700 pr-4">
                        {selectedIds.size} Articles Selected
                    </span>
                    <button 
                        onClick={compileNewsletter}
                        disabled={selectedIds.size === 0 || isCompiling}
                        className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-semibold py-2 px-6 rounded-md transition-all shadow-lg"
                    >
                        {isCompiling ? "Compiling Brief..." : `Compile Newsletter`}
                    </button>
                </div>
            </header>

            {finalHtml ? (
                <section className="bg-white text-black p-8 rounded-lg shadow-xl relative max-w-4xl mx-auto">
                    <button 
                        onClick={copyToClipboard}
                        className="absolute top-4 right-4 bg-gray-800 text-white text-xs px-3 py-1 rounded hover:bg-gray-700 transition-colors"
                    >
                        Copy HTML
                    </button>
                    <button 
                        onClick={() => setFinalHtml("")}
                        className="absolute top-4 right-24 bg-red-100 text-red-800 text-xs px-3 py-1 rounded hover:bg-red-200 transition-colors"
                    >
                        Close
                    </button>
                    <div dangerouslySetInnerHTML={{ __html: finalHtml }} />
                </section>
            ) : (
                <>
                    <div className="flex flex-col lg:flex-row justify-between items-center mb-6 bg-gray-900 p-4 rounded-lg border border-gray-800 shadow-sm gap-4">
                        <div className="flex space-x-2 items-center">
                            <select 
                                value={activeTab}
                                onChange={(e) => { setActiveTab(e.target.value); setShowOnlySelected(false); }}
                                className="bg-gray-800 border border-gray-700 text-white text-sm rounded focus:ring-blue-500 focus:border-blue-500 block p-2"
                            >
                                <option value="all">Vault: All Database</option>
                                <option value="triaged">AI Triaged Only</option>
                                <option value="pending">Pending Triage</option>
                                <option value="discarded">AI Discarded</option>
                            </select>
                            
                            <button
                                onClick={() => setShowOnlySelected(!showOnlySelected)}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors border ${
                                    showOnlySelected 
                                    ? "bg-blue-900/50 border-blue-500 text-blue-300" 
                                    : "bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200"
                                }`}
                            >
                                {showOnlySelected ? "Exit Review Mode" : "Review Selected"}
                            </button>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                            <select 
                                value={sortOrder}
                                onChange={(e) => setSortOrder(e.target.value)}
                                className="bg-gray-800 border border-gray-700 text-white text-sm rounded focus:ring-blue-500 focus:border-blue-500 block p-2"
                            >
                                <option value="score_desc">Sort: Highest Relevancy</option>
                                <option value="score_asc">Sort: Lowest Relevancy</option>
                                <option value="date_desc">Sort: Most Recent</option>
                            </select>

                            <select 
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="bg-gray-800 border border-gray-700 text-white text-sm rounded focus:ring-blue-500 focus:border-blue-500 block p-2"
                            >
                                {uniqueCategories.map(cat => (
                                    <option key={cat} value={cat}>Sector: {cat}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto border border-gray-800 rounded-lg shadow-xl bg-gray-900">
                        <table className="w-full text-left text-sm table-fixed">
                            <thead className="bg-gray-950 text-gray-400 uppercase text-xs border-b border-gray-800">
                                <tr>
                                    <th className="p-4 w-16 text-center">
                                        <input 
                                            type="checkbox" 
                                            checked={isAllSelected}
                                            onChange={toggleSelectAll}
                                            className="w-4 h-4 accent-blue-600 cursor-pointer rounded bg-gray-700 border-gray-600"
                                            title="Select All Visible"
                                        />
                                    </th>
                                    <th className="p-4 w-32">Relevancy</th>
                                    <th className="p-4 w-48">Sector Focus</th>
                                    <th className="p-4">Strategic Intelligence</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {processedArticles.map((article) => (
                                    <tr key={article.id} className={`${selectedIds.has(article.id) ? 'bg-blue-900/20' : 'hover:bg-gray-800/40'} transition-colors`}>
                                        <td className="p-4 align-top text-center">
                                            <input 
                                                type="checkbox" 
                                                className="w-5 h-5 accent-blue-600 cursor-pointer rounded bg-gray-700 border-gray-600 mt-1"
                                                checked={selectedIds.has(article.id)}
                                                onChange={() => toggleSelection(article.id)}
                                            />
                                        </td>
                                        <td className="p-4 align-top">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-bold text-gray-200 text-base">{article.relevance_score}</span>
                                                <span className="text-xs text-gray-500">/ 100</span>
                                            </div>
                                            <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                                                <div 
                                                    className={`${getScoreColour(article.relevance_score)} h-1.5 rounded-full`} 
                                                    style={{ width: `${Math.min(Math.max(article.relevance_score, 0), 100)}%` }}
                                                ></div>
                                            </div>
                                        </td>
                                        <td className="p-4 align-top text-gray-400">
                                            <span className="bg-gray-800 border border-gray-700 px-2 py-1 rounded text-xs text-blue-300">
                                                {getCategory(article.strategic_tags)}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <a 
                                                href={article.url} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="text-lg font-semibold text-white mb-2 leading-tight hover:text-blue-400 transition-colors inline-flex items-start gap-2"
                                                title="Open original article in new tab"
                                            >
                                                <span>{article.title}</span>
                                                <svg className="w-4 h-4 mt-1 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                            </a>
                                            <p className="text-gray-400 leading-relaxed mb-3 mt-1">{article.snippet}</p>
                                            <div className="flex justify-between items-center text-xs text-gray-500 uppercase tracking-wider">
                                                <span className="bg-gray-800 px-2 py-1 rounded">{article.source}</span>
                                                <span>{safeFormatDate(article.published_at)}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        
                        {processedArticles.length === 0 && (
                            <div className="p-16 text-center text-gray-500 bg-gray-900/50">
                                <p className="text-lg font-medium">No intelligence found</p>
                                <p className="text-sm mt-1">Try adjusting your category or relevancy filters.</p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </main>
    );
}