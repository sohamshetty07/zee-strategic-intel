"use client";
import { useState, useEffect, useRef } from 'react';

export default function StrategyDesk() {
    const [articles, setArticles] = useState([]);
    
    // Filters & Views
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [dataView, setDataView] = useState("all"); 
    const [viewMode, setViewMode] = useState("grid");
    const [sortOrder, setSortOrder] = useState("date_desc");
    
    // Selection & Export
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [isExporting, setIsExporting] = useState(false);
    
    // Performance: Lazy Loading
    const [visibleCount, setVisibleCount] = useState(40);
    const loaderRef = useRef(null);
    
    // Theme & Hydration
    const [theme, setTheme] = useState("dark");
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        const savedTheme = localStorage.getItem("desk-theme") || "dark";
        setTheme(savedTheme);
        if (savedTheme === "dark") document.documentElement.classList.add("dark");
        else document.documentElement.classList.remove("dark");

        fetch('/api/articles')
            .then(res => res.json())
            .then(data => setArticles(data))
            .catch(err => console.error("Failed to fetch:", err));
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === "dark" ? "light" : "dark";
        setTheme(newTheme);
        localStorage.setItem("desk-theme", newTheme);
        if (newTheme === "dark") document.documentElement.classList.add("dark");
        else document.documentElement.classList.remove("dark");
    };

    const toggleSelection = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const parseTags = (tagString) => {
        try {
            const parsed = JSON.parse(tagString);
            return {
                category: parsed[0] || "Uncategorised",
                impactTags: parsed.slice(1) || []
            };
        } catch {
            return { category: "Uncategorised", impactTags: [] };
        }
    };

    const safeFormatDate = (dateString) => {
        if (!dateString) return "";
        return new Date(dateString).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
        });
    };

    // Reset visible count when filters change
    useEffect(() => {
        setVisibleCount(40);
    }, [selectedCategory, dataView]);

    // Intersection Observer for Infinite Scroll
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                setVisibleCount(prev => prev + 40);
            }
        }, { threshold: 0.1 });

        if (loaderRef.current) observer.observe(loaderRef.current);
        return () => observer.disconnect();
    }, [articles]);

    // Outlook Export Engine (Grouped Headlines)
    const exportToOutlook = async () => {
        if (selectedIds.size === 0) return;
        setIsExporting(true);
        
        let selectedArticlesRaw = articles.filter(a => selectedIds.has(a.id));
        selectedArticlesRaw.sort((a, b) => {
            const catA = parseTags(a.strategic_tags).category;
            const catB = parseTags(b.strategic_tags).category;
            return catA.localeCompare(catB);
        });
        
        const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        let htmlContent = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; color: #171717; line-height: 1.6;">
                <h2 style="margin-bottom: 4px; font-size: 22px; color: #000; letter-spacing: -0.7px;">Strategic Intelligence Briefing</h2>
                <p style="margin-top: 0; color: #666; font-size: 13px; margin-bottom: 32px; text-transform: uppercase; letter-spacing: 1px;">Generated on ${dateStr}</p>
        `;

        let currentCategory = "";

        selectedArticlesRaw.forEach(article => {
            const { category } = parseTags(article.strategic_tags);
            if (category !== currentCategory) {
                if (currentCategory !== "") htmlContent += `<br/>`; 
                htmlContent += `
                    <p style="font-size: 14px; font-weight: bold; color: #666; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 12px; border-bottom: 1px solid #e5e5e5; padding-bottom: 4px;">
                        ${category}
                    </p>
                `;
                currentCategory = category;
            }
            htmlContent += `
                <p style="margin: 0 0 8px 0; font-size: 15px;">
                    • <a href="${article.url}" style="color: #0056b3; text-decoration: none;">${article.title}</a> 
                    <span style="color: #888; font-size: 11px; margin-left: 6px;">(${article.source})</span>
                </p>
            `;
        });

        htmlContent += `</div>`;

        try {
            const blobHtml = new Blob([htmlContent], { type: 'text/html' });
            const blobText = new Blob([htmlContent.replace(/<[^>]*>?/gm, '')], { type: 'text/plain' });
            await navigator.clipboard.write([
                new window.ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })
            ]);
            
            setTimeout(() => setIsExporting(false), 2000);
            setSelectedIds(new Set());
            setDataView("all");
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (err) {
            console.error("Failed to copy:", err);
            setIsExporting(false);
        }
    };

    const uniqueCategories = ["All", ...new Set(articles.map(a => parseTags(a.strategic_tags).category))];

    // Master Filter Engine
    let processedArticles = articles.filter(a => {
        const tags = parseTags(a.strategic_tags);
        const matchesCategory = selectedCategory === "All" || tags.category === selectedCategory;
        if (dataView === "impact") return matchesCategory && tags.impactTags.length > 0;
        if (dataView === "selected") return matchesCategory && selectedIds.has(a.id);
        return matchesCategory;
    });

    processedArticles.sort((a, b) => {
        if (sortOrder === "date_desc") return new Date(b.published_at) - new Date(a.published_at);
        if (sortOrder === "date_asc") return new Date(a.published_at) - new Date(b.published_at);
        return 0;
    });

    // Lazy loading slice
    const displayedArticles = processedArticles.slice(0, visibleCount);

    if (!isMounted) return null;

    return (
        <main className="min-h-screen bg-[#fafafa] dark:bg-[#050505] text-zinc-900 dark:text-zinc-200 font-sans transition-colors duration-200 selection:bg-blue-500/30">
            
            <header className="sticky top-0 z-50 flex flex-col transition-colors duration-200">
                {/* Top Control Bar */}
                <div className="bg-[#fafafa]/85 dark:bg-[#050505]/85 backdrop-blur-2xl px-8 py-4 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    
                    {/* Left: Branding */}
                    <div className="flex items-center gap-6">
                        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white flex items-center gap-3">
                            <span className="bg-zinc-900 dark:bg-white text-white dark:text-black px-2 py-0.5 rounded-[4px] text-[11px] font-bold tracking-widest uppercase">Zee</span>
                            Strategic Intel
                        </h1>
                        <div className="hidden md:flex items-center gap-2 text-[11px] font-semibold tracking-widest uppercase px-3 py-1.5 rounded-full bg-zinc-200/50 dark:bg-white/5 text-zinc-500 border border-zinc-300/50 dark:border-white/5 transition-colors">
                            {articles.length} Total Assets
                        </div>
                    </div>

                    {/* Center: Segmented Control View */}
                    <div className="flex items-center bg-zinc-200/50 dark:bg-white/5 p-1 rounded-full border border-zinc-300/50 dark:border-white/5 transition-colors w-full xl:w-auto overflow-x-auto hide-scrollbar">
                        <button 
                            onClick={() => setDataView("all")}
                            className={`px-5 py-1.5 rounded-full text-xs font-semibold tracking-wide whitespace-nowrap transition-all duration-200 ${dataView === "all" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"}`}
                        >
                            All Feed
                        </button>
                        <button 
                            onClick={() => setDataView("impact")}
                            className={`px-5 py-1.5 rounded-full text-xs font-semibold tracking-wide whitespace-nowrap transition-all duration-200 ${dataView === "impact" ? "bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 shadow-sm" : "text-zinc-500 hover:text-red-600 dark:hover:text-red-400"}`}
                        >
                            High Impact
                        </button>
                        <button 
                            onClick={() => setDataView("selected")}
                            className={`px-5 py-1.5 rounded-full text-xs font-semibold tracking-wide whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 ${dataView === "selected" ? "bg-blue-600 text-white shadow-sm" : "text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400"}`}
                        >
                            Selected
                            {selectedIds.size > 0 && (
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${dataView === "selected" ? "bg-white/20 text-white" : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"}`}>
                                    {selectedIds.size}
                                </span>
                            )}
                        </button>
                    </div>
                    
                    {/* Right: Toggles & Export */}
                    <div className="flex items-center gap-3">
                        {/* Layout Toggles */}
                        <div className="flex items-center gap-1 bg-zinc-200/50 dark:bg-white/5 p-1 rounded-full border border-zinc-300/50 dark:border-white/5 transition-colors">
                            <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-full transition-all ${viewMode === "list" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-300"}`}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                            </button>
                            <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-full transition-all ${viewMode === "grid" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-300"}`}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                            </button>
                        </div>

                        {/* Theme Toggle */}
                        <button 
                            onClick={toggleTheme}
                            className="p-2 rounded-full text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-white/5 transition-all"
                        >
                            {theme === "dark" ? (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                            ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                            )}
                        </button>
                        
                        {/* Export Button */}
                        <button 
                            onClick={exportToOutlook}
                            disabled={selectedIds.size === 0}
                            className={`text-[11px] tracking-widest uppercase font-bold px-5 py-2.5 rounded-full transition-all flex items-center gap-2 ${
                                selectedIds.size > 0 
                                ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 cursor-pointer" 
                                : "bg-zinc-200 dark:bg-white/10 text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
                            }`}
                        >
                            {isExporting ? "Copied!" : `Copy Briefing ${selectedIds.size > 0 ? `(${selectedIds.size})` : ''}`}
                        </button>
                    </div>
                </div>

                {/* Thin Categories Ribbon */}
                <div className="bg-[#fafafa]/95 dark:bg-[#050505]/95 backdrop-blur-xl border-b border-zinc-200 dark:border-white/5 px-8 py-2.5">
                    <div className="max-w-7xl mx-auto flex overflow-x-auto hide-scrollbar gap-1.5">
                        {uniqueCategories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`whitespace-nowrap px-3 py-1 rounded-full text-[12px] font-medium transition-all duration-200 ${
                                    selectedCategory === cat 
                                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm" 
                                    : "bg-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-8 py-10">
                <div className={`grid gap-5 ${viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1 max-w-4xl mx-auto"}`}>
                    {displayedArticles.map((article) => {
                        const { category, impactTags } = parseTags(article.strategic_tags);
                        const isSelected = selectedIds.has(article.id);

                        return (
                            <article 
                                key={article.id} 
                                className={`relative rounded-2xl p-5 transition-all flex flex-col justify-between group cursor-default
                                    ${isSelected 
                                        ? "bg-blue-50/50 dark:bg-blue-950/20 border border-blue-300 dark:border-blue-500/50 shadow-md ring-1 ring-blue-500/20" 
                                        : "bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-white/5 hover:shadow-xl hover:border-zinc-300 dark:hover:border-white/10"}
                                `}
                            >
                                <button 
                                    onClick={() => toggleSelection(article.id)}
                                    className={`absolute top-4 right-4 w-5 h-5 rounded-full border flex items-center justify-center transition-all z-10 duration-150
                                        ${isSelected ? "bg-blue-600 border-blue-600 text-white scale-110 shadow-lg shadow-blue-500/30" : "bg-transparent border-zinc-300 dark:border-zinc-700 text-transparent hover:border-blue-500 hover:text-blue-200"}
                                    `}
                                >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
                                </button>

                                <div>
                                    <div className="flex justify-between items-start mb-4 pr-6">
                                        <div className="flex flex-wrap gap-1.5">
                                            <span className="text-[9px] font-bold tracking-widest uppercase text-zinc-400 dark:text-zinc-500">{category}</span>
                                            {impactTags.map((tag, idx) => (
                                                <span key={idx} className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-[3px] text-[8px] font-bold tracking-widest uppercase">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-[16px] font-medium text-zinc-900 dark:text-zinc-100 mb-2 leading-snug hover:text-blue-600 dark:hover:text-blue-400 transition-colors block">
                                        {article.title}
                                    </a>
                                    <p className="text-zinc-500 dark:text-zinc-400 text-[12px] leading-relaxed mb-5 line-clamp-3">
                                        {article.snippet || "No additional context provided."}
                                    </p>
                                </div>
                                <div className="flex justify-between items-center text-[10px] font-medium text-zinc-400 dark:text-zinc-600 pt-3 border-t border-zinc-100 dark:border-white/5">
                                    <span className="uppercase tracking-wider">{article.source}</span>
                                    <span>{safeFormatDate(article.published_at)}</span>
                                </div>
                            </article>
                        );
                    })}
                </div>

                {/* Invisible element to trigger the lazy loader */}
                {visibleCount < processedArticles.length && (
                    <div ref={loaderRef} className="h-20 w-full mt-8 flex justify-center items-center opacity-50">
                        <svg className="w-5 h-5 animate-spin text-zinc-400" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="32" strokeLinecap="round"></circle></svg>
                    </div>
                )}

                {processedArticles.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-32 text-zinc-400 dark:text-zinc-600">
                        <p className="text-lg font-medium">No assets match your criteria.</p>
                    </div>
                )}
            </div>
        </main>
    );
}