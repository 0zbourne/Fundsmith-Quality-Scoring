import React, { useState, useEffect, useRef } from 'react';
import { Search, TrendingUp, Info, AlertCircle, CheckCircle2, XCircle, Loader2, BarChart3, Target, Trash2, RefreshCcw, ChevronRight, Settings, FlaskConical, Globe, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { fetchStockData, StockMetrics, SP500_AVERAGES, fetchSP500Benchmarks } from './services/stockService';

const cleanCompanyName = (name: any) => {
  if (!name) return "";
  if (typeof name !== 'string') name = String(name);
  return name
    .replace(/[,.]?\s+(Inc|Incorporated|Group\s+PLC|Group\s+Plc|PLC|Plc|Corp|Corporation|Ltd|Limited|Co|Company|S\.A\.|AG|NV|SE|ADR|Holdings?|Class\s+[A-Z]|Group)\.?$/gi, '')
    .trim();
};

export default function App() {
  const [ticker, setTicker] = useState('');
  const [exchange, setExchange] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StockMetrics | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [benchmarks, setBenchmarks] = useState(SP500_AVERAGES);
  const [refreshingTickers, setRefreshingTickers] = useState<Set<string>>(new Set());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [aiFallbackEnabled, setAiFallbackEnabled] = useState(() => {
    return localStorage.getItem('ai_fallback_enabled') === 'true';
  });

  const [watchlist, setWatchlist] = useState<StockMetrics[]>(() => {
    const saved = localStorage.getItem('quality_watchlist');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return parsed.map((item: any) => ({
        ...item,
        fcfYield: item.fcfYield ?? 0,
        fcfGrowthRate: item.fcfGrowthRate ?? 0,
        historicalFcfYield: item.historicalFcfYield ?? 0,
      }));
    } catch (e) {
      console.error("Failed to parse watchlist", e);
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('quality_watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    localStorage.setItem('ai_fallback_enabled', aiFallbackEnabled.toString());
  }, [aiFallbackEnabled]);

  useEffect(() => {
    const loadBenchmarks = async () => {
      try {
        const liveBenchmarks = await fetchSP500Benchmarks();
        setBenchmarks(liveBenchmarks);
      } catch (err) {
        console.error("Failed to load benchmarks:", err);
      }
    };
    loadBenchmarks();
  }, []);

  const isError = error !== null;

  const addToWatchlist = (stock: StockMetrics) => {
    if (!watchlist.find(s => s.ticker === stock.ticker)) {
      setWatchlist(prev => [stock, ...prev]);
    }
  };

  const removeFromWatchlist = (ticker: string) => {
    setWatchlist(prev => prev.filter(s => s.ticker !== ticker));
  };

  const refreshWatchlistItem = async (ticker: string) => {
    setRefreshingTickers(prev => new Set(prev).add(ticker));
    try {
      const result = await fetchStockData(ticker, undefined, benchmarks, aiFallbackEnabled);
      setWatchlist(prev => prev.map(s => s.ticker === ticker ? result : s));
    } catch (err) {
      console.error(`Failed to refresh ${ticker}:`, err);
    } finally {
      setRefreshingTickers(prev => {
        const next = new Set(prev);
        next.delete(ticker);
        return next;
      });
    }
  };

  const refreshAllWatchlist = async () => {
    if (watchlist.length === 0) return;
    
    // Refresh items sequentially to avoid rate limits
    for (const stock of watchlist) {
      await refreshWatchlistItem(stock.ticker);
    }
  };



  const exchanges = [
    { label: 'US (NYSE/NASDAQ)', value: '' },
    { label: 'UK (London)', value: '.L' },
    { label: 'Germany (XETRA)', value: '.DE' },
    { label: 'France (Paris)', value: '.PA' },
    { label: 'Canada (Toronto)', value: '.TO' },
  ];

  const loadingMessages = [
    "Connecting to financial data providers...",
    "Retrieving TTM financial ratios...",
    "Analyzing return on capital employed...",
    "Cross-referencing industry benchmarks...",
    "Evaluating historical capital allocation...",
    "Checking interest coverage ratios...",
    "Assessing free cash flow generation...",
    "Calculating proprietary quality score...",
    "Finalizing research report..."
  ];

  const loadingIntervalRef = useRef<number | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim() || loading) return;

    const fullTicker = ticker.trim().toUpperCase() + exchange;
    setLoading(true);
    setError(null);
    setData(null);

    // Cycle through loading messages for better UX
    let messageIndex = 0;
    setLoadingMessage(loadingMessages[0]);
    
    if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
    
    loadingIntervalRef.current = window.setInterval(() => {
      messageIndex = (messageIndex + 1) % loadingMessages.length;
      setLoadingMessage(loadingMessages[messageIndex]);
    }, 3500);

    try {
      if (isDemoMode) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        const demoData: StockMetrics = {
          ticker: fullTicker || "DEMO",
          name: "Sample Quality Corp (Demo)",
          description: "This is high-quality sample data demonstrating the app's analysis capabilities. In a real scenario, this data is fetched from Financial Modeling Prep.",
          roce: 28.4,
          grossMargin: 62.1,
          operatingMargin: 31.5,
          cashConversion: 105.2,
          interestCover: 45.8,
          fcfYield: 4.2,
          fcfGrowthRate: 12.5,
          historicalFcfYield: 3.8,
          score: 4.8,
          source: "Demo Mode (Mock Data)"
        };
        setData(demoData);
      } else {
        const result = await fetchStockData(fullTicker, undefined, benchmarks, aiFallbackEnabled);
        setData(result);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch stock data. Ensure your FMP API key is set.');
    } finally {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
        loadingIntervalRef.current = null;
      }
      setLoading(false);
    }
  };



  const MetricCard = ({ 
    label, 
    value, 
    benchmark, 
    suffix = '%', 
    isRatio = false,
    subValue,
    subLabel
  }: { 
    label: string; 
    value: number; 
    benchmark: number; 
    suffix?: string;
    isRatio?: boolean;
    subValue?: number;
    subLabel?: string;
  }) => {
    const beats = value > benchmark;
    return (
      <div className="bg-white/5 border border-white/10 p-4 rounded-lg flex flex-col gap-2 hover:bg-white/[0.08] transition-all">
        <div className="flex justify-between items-center">
          <span className="text-xs font-mono uppercase tracking-wider text-white/50">{label}</span>
          {beats ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <XCircle className="w-4 h-4 text-rose-400" />
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-mono font-bold text-white">
              {value.toFixed(isRatio ? 2 : 1)}{suffix}
            </span>
            <span className="text-[10px] font-mono text-white/30">
              vs {benchmark}{suffix} avg
            </span>
          </div>
          {subValue !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-white/60">
                {subValue.toFixed(isRatio ? 2 : 1)}{suffix}
              </span>
              <span className="text-[9px] font-mono text-white/30 uppercase tracking-tighter">{subLabel || "20Y Avg"}</span>
            </div>
          )}
        </div>
        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-2">
          <div 
            className={cn(
              "h-full transition-all duration-500",
              beats ? "bg-emerald-500" : "bg-rose-500"
            )}
            style={{ width: `${Math.min((value / (benchmark * 2)) * 100, 100)}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-emerald-500/30">


      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-8 relative">
          <div 
            className="flex items-center gap-2 cursor-pointer group shrink-0"
            onClick={() => {
              setData(null);
              setError(null);
              setTicker('');
              setLoading(false);
            }}
          >
            <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center group-hover:scale-110 transition-transform">
              <TrendingUp className="text-black w-5 h-5" />
            </div>
            <span className="font-mono font-bold tracking-tighter text-xl">FUNDSMITH<span className="text-emerald-500">SCORER</span></span>
          </div>

          <div className="flex items-center gap-4 flex-1 justify-end">
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-emerald-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Ticker (e.g. AAPL, GAW)"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 w-40 lg:w-48 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all font-mono text-sm"
                />
              </div>
              <select
                value={exchange}
                onChange={(e) => setExchange(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-full py-2 px-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all font-mono text-sm text-white/70 cursor-pointer"
              >
                {exchanges.map((ex) => (
                  <option key={ex.value} value={ex.value} className="bg-[#0a0a0a]">
                    {ex.label}
                  </option>
                ))}
              </select>
              <button 
                type="submit" 
                disabled={loading}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-mono font-bold py-2 px-6 rounded-full transition-all text-sm shrink-0 flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                ANALYZE
              </button>
            </form>

            <div className="h-6 w-px bg-white/10 mx-2 hidden md:block" />

            <div className="flex items-center gap-3">
              {isDemoMode && (
                <div className="hidden sm:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest">Demo</span>
                  <button 
                    onClick={() => setIsDemoMode(false)}
                    className="ml-1 text-[10px] text-white/30 hover:text-white transition-colors"
                  >
                    <XCircle className="w-3 h-3" />
                  </button>
                </div>
              )}
              
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 rounded-full border border-white/10 hover:bg-white/5 transition-colors text-white/50 hover:text-white"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {!data && !loading && !error && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              {/* S&P 500 Benchmarks */}
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Target className="w-5 h-5 text-emerald-500" />
                    <h2 className="font-mono font-bold uppercase tracking-widest text-sm text-white/50">S&P 500 Quality Benchmarks</h2>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-white/20 uppercase">
                    Source: Fundsmith Equity
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-white/5 border border-white/10 p-4 rounded-xl">
                    <p className="text-[10px] font-mono text-white/30 uppercase mb-1">ROCE</p>
                    <p className="text-xl font-mono font-bold text-white">{benchmarks.roce}%</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 p-4 rounded-xl">
                    <p className="text-[10px] font-mono text-white/30 uppercase mb-1">Gross Margin</p>
                    <p className="text-xl font-mono font-bold text-white">{benchmarks.grossMargin}%</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 p-4 rounded-xl">
                    <p className="text-[10px] font-mono text-white/30 uppercase mb-1">Op. Margin</p>
                    <p className="text-xl font-mono font-bold text-white">{benchmarks.operatingMargin}%</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 p-4 rounded-xl">
                    <p className="text-[10px] font-mono text-white/30 uppercase mb-1">Cash Conv.</p>
                    <p className="text-xl font-mono font-bold text-white">{benchmarks.cashConversion}%</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 p-4 rounded-xl">
                    <p className="text-[10px] font-mono text-white/30 uppercase mb-1">Int. Cover</p>
                    <p className="text-xl font-mono font-bold text-white">{benchmarks.interestCover}x</p>
                  </div>
                </div>
                <div className="text-[10px] font-mono text-white/20 italic text-right">
                  * Excludes financial stocks. Interest Cover is median.
                </div>
              </section>

              {/* Watchlist */}
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-5 h-5 text-emerald-500" />
                    <h2 className="font-mono font-bold uppercase tracking-widest text-sm text-white/50">Quality Watchlist</h2>
                  </div>
                  <div className="flex items-center gap-4">
                    {watchlist.length > 0 && (
                      <button
                        onClick={refreshAllWatchlist}
                        disabled={refreshingTickers.size > 0}
                        className="flex items-center gap-2 text-[10px] font-mono text-emerald-500 hover:text-emerald-400 uppercase tracking-widest transition-colors disabled:opacity-50"
                      >
                        <RefreshCcw className={cn("w-3 h-3", refreshingTickers.size > 0 && "animate-spin")} />
                        Refresh All
                      </button>
                    )}
                    <span className="text-[10px] font-mono text-white/20 uppercase tracking-widest">{watchlist.length} Companies</span>
                  </div>
                </div>

                {watchlist.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3">
                    {watchlist.map((stock) => (
                      <motion.div 
                        key={stock.ticker}
                        layout
                        className="group bg-white/5 border border-white/10 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between hover:bg-white/[0.08] transition-all gap-4"
                      >
                        <div className="flex items-center gap-4 min-w-[200px]">
                          <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center font-mono font-bold text-emerald-500 shrink-0">
                            {stock.ticker.split('.')[0]}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-sm truncate">{cleanCompanyName(stock.name)}</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-mono font-bold text-emerald-500/70">{stock.ticker}</span>
                              {stock.country && (
                                <>
                                  <span className="text-[10px] opacity-10">|</span>
                                  <span className="text-[10px] font-mono text-white/30 uppercase">{stock.country}</span>
                                </>
                              )}
                              <span className="text-[10px] opacity-10">|</span>
                              <span className="text-[10px] font-mono text-white/40 uppercase tracking-tighter">Score: {stock.score.toFixed(1)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 flex-1 px-4 overflow-x-auto min-w-0 pb-2 md:pb-0 hide-scrollbar">
                          
                          {/* Quality Metrics Group */}
                          <div className="flex flex-col items-center border-r border-white/10 pr-6 hidden md:flex shrink-0">
                            <span className="text-[7px] text-white/30 uppercase tracking-widest mb-1.5">Score</span>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map((i) => (
                                <div 
                                  key={i} 
                                  className={cn(
                                    "w-1.5 h-4 rounded-full",
                                    i <= stock.score ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-white/10"
                                  )}
                                />
                              ))}
                            </div>
                          </div>

                          <div className="flex flex-col shrink-0">
                              <span className="text-[9px] font-mono text-white/30 uppercase tracking-tighter">ROCE</span>
                              <div className="flex items-center gap-1">
                                <span className={cn("text-xs font-mono font-bold", stock.roce > benchmarks.roce ? "text-emerald-400" : "text-rose-400")}>
                                  {stock.roce.toFixed(1)}%
                                </span>
                                {stock.averageRoce !== undefined && (
                                  <span className="text-[8px] font-mono text-white/20">({stock.averageRoce.toFixed(1)}%)</span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col shrink-0">
                              <span className="text-[9px] font-mono text-white/30 uppercase tracking-tighter">Gross</span>
                              <span className={cn("text-xs font-mono font-bold", stock.grossMargin > benchmarks.grossMargin ? "text-emerald-400" : "text-rose-400")}>
                                {stock.grossMargin.toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex flex-col shrink-0">
                              <span className="text-[9px] font-mono text-white/30 uppercase tracking-tighter">Op.</span>
                              <span className={cn("text-xs font-mono font-bold", stock.operatingMargin > benchmarks.operatingMargin ? "text-emerald-400" : "text-rose-400")}>
                                {stock.operatingMargin.toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex flex-col shrink-0">
                              <span className="text-[9px] font-mono text-white/30 uppercase tracking-tighter">Cash</span>
                              <span className={cn("text-xs font-mono font-bold", stock.cashConversion > benchmarks.cashConversion ? "text-emerald-400" : "text-rose-400")}>
                                {stock.cashConversion.toFixed(0)}%
                              </span>
                            </div>
                            <div className="flex flex-col shrink-0">
                              <span className="text-[9px] font-mono text-white/30 uppercase tracking-tighter">Int.</span>
                              <span className={cn("text-xs font-mono font-bold", stock.interestCover > benchmarks.interestCover ? "text-emerald-400" : "text-rose-400")}>
                                {stock.interestCover.toFixed(1)}x
                              </span>
                            </div>
                          {/* Valuation Group */}
                          <div className="flex flex-col pl-6 border-l border-white/10 shrink-0">
                            <span className="text-[9px] font-mono text-blue-400/70 uppercase tracking-tighter">FCF Yield</span>
                            <div className="flex items-center gap-1">
                              <span className={cn("text-xs font-mono font-bold", stock.fcfYield > stock.historicalFcfYield ? "text-emerald-400" : "text-rose-400")}>
                                {stock.fcfYield.toFixed(1)}%
                              </span>
                              <span className="text-[8px] font-mono text-white/20">({stock.historicalFcfYield.toFixed(1)}%)</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between md:justify-end gap-2 pt-4 md:pt-0 border-t md:border-t-0 border-white/5">
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => refreshWatchlistItem(stock.ticker)}
                              disabled={refreshingTickers.has(stock.ticker)}
                              className={cn(
                                "p-2 rounded-lg hover:bg-white/10 text-white/30 hover:text-emerald-500 transition-colors",
                                refreshingTickers.has(stock.ticker) && "animate-spin text-emerald-500"
                              )}
                              title="Refresh Data"
                            >
                              <RefreshCcw className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => removeFromWatchlist(stock.ticker)}
                              className="p-2 rounded-lg hover:bg-white/10 text-white/30 hover:text-rose-500 transition-colors"
                              title="Remove"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => {
                                setTicker(stock.ticker.split('.')[0]);
                                // Trigger search manually
                                handleSearch({ preventDefault: () => {} } as any);
                              }}
                              className="ml-2 p-2 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black transition-all"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="py-20 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-4">
                      <BarChart3 className="w-6 h-6 text-white/10" />
                    </div>
                    <p className="text-sm text-white/30 max-w-xs">
                      Your watchlist is empty. Analyze some companies and add them here to track their quality metrics.
                    </p>
                  </div>
                )}
              </section>
            </motion.div>
          )}

          {loading && (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-32"
            >
              <div className="relative w-20 h-20 mb-8">
                <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full" />
                <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <TrendingUp className="absolute inset-0 m-auto w-8 h-8 text-emerald-500 animate-pulse" />
              </div>
              <p className="text-white/50 font-mono text-sm tracking-widest uppercase">{loadingMessage}</p>
              <div className="mt-4 flex gap-1">
                <div className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce" />
              </div>
            </motion.div>
          )}

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 rounded-2xl border flex items-start gap-4 max-w-2xl mx-auto bg-rose-500/10 border-rose-500/20 text-rose-200"
            >
              <div className="p-2 rounded-lg shrink-0 bg-rose-500/20">
                <AlertCircle className="w-5 h-5 text-rose-500" />
              </div>
              <div className="space-y-2">
                <p className="font-bold">Search Error</p>
                <p className="text-sm opacity-70 leading-relaxed">{error}</p>
                
                <div className="pt-2 flex flex-wrap gap-4 items-center">
                  <button 
                    onClick={() => {
                      setIsDemoMode(true);
                      setError(null);
                    }}
                    className="text-xs font-mono uppercase tracking-wider text-emerald-500 hover:underline flex items-center gap-1"
                  >
                    Switch to Demo Mode <CheckCircle2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {data && !loading && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* Stock Header */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-8">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-emerald-500 text-black font-mono font-bold px-2 py-0.5 rounded text-sm">
                      {data.ticker}
                    </span>
                    <h2 className="text-4xl font-bold tracking-tight">{cleanCompanyName(data.name)}</h2>
                    {data.country && (
                      <span className="text-xs font-mono text-white/30 border border-white/10 px-2 py-0.5 rounded-full uppercase">
                        {data.country}
                      </span>
                    )}
                    <button 
                      onClick={() => addToWatchlist(data)}
                      disabled={watchlist.some(s => s.ticker === data.ticker)}
                      className={cn(
                        "ml-4 p-2 rounded-full border transition-all",
                        watchlist.some(s => s.ticker === data.ticker)
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-500 opacity-50 cursor-not-allowed"
                          : "bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10"
                      )}
                      title={watchlist.some(s => s.ticker === data.ticker) ? "In Watchlist" : "Add to Watchlist"}
                    >
                      <BarChart3 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-white/50 max-w-2xl italic leading-relaxed">
                    "{data.description}"
                  </p>
                </div>
                
                <div className="flex flex-col items-center md:items-end">
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30 mb-1">Quality Score</span>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div 
                          key={i} 
                          className={cn(
                            "w-2 h-8 rounded-full transition-all duration-1000",
                            i <= data.score ? "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]" : "bg-white/10"
                          )}
                        />
                      ))}
                    </div>
                    <span className="text-5xl font-mono font-bold ml-4">
                      {data.score.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <MetricCard 
                  label="ROCE" 
                  value={data.roce} 
                  benchmark={benchmarks.roce} 
                  subValue={data.averageRoce}
                  subLabel="20Y Avg"
                />
                <MetricCard 
                  label="Gross Margin" 
                  value={data.grossMargin} 
                  benchmark={benchmarks.grossMargin} 
                />
                <MetricCard 
                  label="Operating Margin" 
                  value={data.operatingMargin} 
                  benchmark={benchmarks.operatingMargin} 
                />
                <MetricCard 
                  label="Cash Conversion" 
                  value={data.cashConversion} 
                  benchmark={benchmarks.cashConversion} 
                />
                <MetricCard 
                  label="Interest Cover" 
                  value={data.interestCover} 
                  benchmark={benchmarks.interestCover} 
                  suffix="x"
                  isRatio
                />
              </div>

              {/* Valuation Section */}
              <div className="mt-12 space-y-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                  <h3 className="font-mono font-bold uppercase tracking-wider">Valuation & FCF Analysis</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white/5 border border-white/10 p-6 rounded-2xl space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono uppercase tracking-wider text-white/50">Current FCF Yield</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                        data.fcfYield > data.historicalFcfYield ? "bg-emerald-500/20 text-emerald-500" : "bg-rose-500/20 text-rose-500"
                      )}>
                        {data.fcfYield > data.historicalFcfYield ? "Above Avg" : "Below Avg"}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-mono font-bold text-white">{data.fcfYield.toFixed(1)}%</span>
                      <span className="text-xs text-white/30">Yield</span>
                    </div>
                    <p className="text-xs text-white/40 leading-relaxed">
                      Current free cash flow yield relative to market price. Higher is generally better for valuation.
                    </p>
                  </div>

                  <div className="bg-white/5 border border-white/10 p-6 rounded-2xl space-y-4 relative overflow-hidden">
                    {data.isAiUsed && (
                      <div className="absolute top-0 right-0 bg-emerald-500 text-black text-[8px] font-bold px-2 py-0.5 rounded-bl-lg flex items-center gap-1">
                        <FlaskConical className="w-2 h-2" /> AI RESEARCH
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono uppercase tracking-wider text-white/50">
                        FCF Growth ({data.isAiUsed ? '10Y' : '3-4Y'})
                      </span>
                      {data.volatileFcf ? (
                        <AlertCircle className="w-4 h-4 text-amber-500 animate-pulse" title="High Volatility Detected" />
                      ) : (
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                      )}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-mono font-bold text-white">{data.fcfGrowthRate.toFixed(1)}%</span>
                      <span className="text-xs text-white/30 text-nowrap">CAGR</span>
                    </div>
                    <p className="text-xs text-white/40 leading-relaxed">
                      {data.volatileFcf 
                        ? "Warning: Cash flows are inconsistent. CAGR may be misleading due to significant year-over-year variance."
                        : "Compounded annual growth rate of free cash flow over the available history."}
                    </p>
                    {data.historicalBreakdown && (
                        <div className="pt-2 border-t border-white/10">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-mono text-white/30 uppercase">Annual FCF</span>
                            <span className="text-[9px] font-mono text-white/20">{data.historicalBreakdown.length} Periods</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            {data.historicalBreakdown.slice(0, 10).map((b: any) => (
                              <div key={b.year} className="flex justify-between items-center group/item">
                                <span className={cn(
                                  "text-[10px] font-mono",
                                  b.source === 'AI Research' ? "text-emerald-500/70" : "text-white/40"
                                )}>
                                  {b.year}
                                </span>
                                <span className="text-[10px] font-mono text-white/60">
                                  {b.fcfValue ? (Math.abs(b.fcfValue) >= 1e9 ? `${(b.fcfValue / 1e9).toFixed(1)}B` : Math.abs(b.fcfValue) >= 1e6 ? `${(b.fcfValue / 1e6).toFixed(1)}M` : b.fcfValue.toLocaleString()) : 'N/A'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>

                  <div className="bg-white/5 border border-white/10 p-6 rounded-2xl space-y-4 relative overflow-hidden">
                    {data.isAiUsed && (
                      <div className="absolute top-0 right-0 bg-emerald-500 text-black text-[8px] font-bold px-2 py-0.5 rounded-bl-lg flex items-center gap-1">
                        <FlaskConical className="w-2 h-2" /> AI RESEARCH
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono uppercase tracking-wider text-white/50">Hist. Avg Yield</span>
                      <BarChart3 className="w-4 h-4 text-white/30" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-mono font-bold text-white">{data.historicalFcfYield.toFixed(1)}%</span>
                      <span className="text-xs text-white/30">Average</span>
                    </div>
                    <div className="space-y-4">
                      <p className="text-xs text-white/40 leading-relaxed">
                        The 10-year average FCF yield. {data.isAiUsed ? "Includes research from AI fallback." : "Based on historical API data."}
                      </p>
                      
                      {data.historicalBreakdown && (
                        <div className="pt-2 border-t border-white/10">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-mono text-white/30 uppercase">Annual Breakdown</span>
                            <span className="text-[9px] font-mono text-white/20">{data.historicalBreakdown.length} Periods</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            {data.historicalBreakdown.slice(0, 10).map((b: any) => (
                              <div key={b.year} className="flex justify-between items-center group/item">
                                <span className={cn(
                                  "text-[10px] font-mono",
                                  b.source === 'AI Research' ? "text-emerald-500/70" : "text-white/40"
                                )}>
                                  {b.year}
                                </span>
                                <span className="text-[10px] font-mono text-white/60">
                                  {b.fcfYield.toFixed(1)}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-emerald-500/5 border border-emerald-500/10 p-6 rounded-2xl">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center shrink-0">
                      <Target className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm mb-1">Valuation Verdict</h4>
                      <p className="text-sm text-white/60 leading-relaxed">
                        {data.fcfYield > data.historicalFcfYield 
                          ? `The current yield of ${data.fcfYield.toFixed(1)}% is higher than the historical average of ${data.historicalFcfYield.toFixed(1)}%, suggesting the stock might be undervalued relative to its own history.`
                          : `The current yield of ${data.fcfYield.toFixed(1)}% is lower than the historical average of ${data.historicalFcfYield.toFixed(1)}%, suggesting the stock might be trading at a premium compared to its historical norms.`}
                        {data.fcfGrowthRate > 10 && " Combined with double-digit FCF growth, this indicates a potentially attractive compounder."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Analysis Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
                <div className="md:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-8">
                  <div className="flex items-center gap-2 mb-6">
                    <Target className="w-5 h-5 text-emerald-500" />
                    <h3 className="font-mono font-bold uppercase tracking-wider">Quality Analysis</h3>
                  </div>
                  <div className="space-y-4 text-white/70 leading-relaxed">
                    <p>
                      {data.score >= 4 
                        ? "This company exhibits exceptional quality characteristics, outperforming the S&P 500 average in almost all key metrics. This typically suggests a strong competitive moat and efficient capital allocation."
                        : data.score >= 2
                        ? "The company shows mixed quality signals. While it outperforms in some areas, there are specific metrics where it falls behind the broader market average, warranting deeper investigation into its cost structure or capital efficiency."
                        : "The company currently ranks below the S&P 500 average on most quality metrics. This could indicate a challenging industry environment, operational inefficiencies, or a different stage in the business lifecycle."}
                    </p>
                    <div className="pt-4 border-t border-white/10 flex items-start gap-3">
                      <Info className="w-5 h-5 text-white/30 shrink-0 mt-0.5" />
                      <p className="text-xs text-white/40 italic">
                        Note: S&P 500 averages are used as a general quality benchmark. Data source: <span className="text-emerald-500/60 font-mono">{data.source}</span>.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-8 flex flex-col justify-center text-center">
                  <h4 className="text-emerald-500 font-mono text-xs uppercase tracking-widest mb-4">Verdict</h4>
                  <div className="text-6xl mb-4">
                    {data.score >= 4 ? "💎" : data.score >= 2 ? "⚖️" : "⚠️"}
                  </div>
                  <p className="font-bold text-xl mb-2">
                    {data.score >= 4 ? "High Quality" : data.score >= 2 ? "Average Quality" : "Low Quality"}
                  </p>
                  <p className="text-white/40 text-sm">
                    Based on fundamental metrics relative to market averages.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-12 border-t border-white/10 text-center space-y-4">
        <div className="text-white/20 font-mono text-[10px] uppercase tracking-[0.3em]">
          &copy; 2026 Fundsmith Quality Scorer • Personal Research MVP
        </div>

      </footer>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-[#121212] border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-white/10 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-emerald-500" />
                  <h2 className="font-mono font-bold uppercase tracking-widest text-sm">Application Settings</h2>
                </div>
                <button onClick={() => setIsSettingsOpen(false)} className="text-white/30 hover:text-white transition-colors">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm">AI Research Fallback</h3>
                      <p className="text-xs text-white/40">Use Gemini to fill the 10-year historical gap</p>
                    </div>
                    <button 
                      onClick={() => setAiFallbackEnabled(!aiFallbackEnabled)}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        aiFallbackEnabled ? "bg-emerald-500" : "bg-white/10"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-md",
                        aiFallbackEnabled ? "right-1" : "left-1"
                      )} />
                    </button>
                  </div>

                  <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl space-y-2">
                    <div className="flex items-center gap-2">
                      <Info className="w-3 h-3 text-emerald-500" />
                      <span className="text-[10px] font-mono text-emerald-500 uppercase font-bold tracking-widest">Research Note</span>
                    </div>
                    <p className="text-[10px] text-emerald-500/70 leading-relaxed font-mono">
                      Free APIs are limited to 5 years. Enabling this uses Gemini to research years 6-10. Requires GOOGLE_API_KEY in server environment.
                    </p>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <h3 className="font-bold text-sm">Metric Methodology</h3>
                  <div className="bg-white/5 p-4 rounded-xl space-y-3">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-white/30">ROCE</span>
                      <span className="text-white/60">Traditional (Conservative)</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-white/30">FCF Yield</span>
                      <span className="text-white/60">OCF + CapEx / Market Cap</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-white/30">History</span>
                      <span className="text-white/60">{aiFallbackEnabled ? "10 Year (Hybrid)" : "5 Year (API only)"}</span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-mono font-bold text-sm transition-all"
                >
                  CLOSE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
