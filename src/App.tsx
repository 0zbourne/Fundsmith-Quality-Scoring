import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, Info, AlertCircle, CheckCircle2, XCircle, Loader2, BarChart3, Target, Activity, Settings, Save, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { fetchStockData, StockMetrics, SP500_AVERAGES } from './services/stockService';

export default function App() {
  const [ticker, setTicker] = useState('');
  const [exchange, setExchange] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StockMetrics | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ status: 'ok' | 'error', message: string } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [fmpApiKey, setFmpApiKey] = useState(() => localStorage.getItem('fmp_api_key') || '');

  const isApiKeyError = error?.includes("403") || debugInfo?.includes("403") || error?.includes("configured");

  const saveApiKey = () => {
    localStorage.setItem('fmp_api_key', fmpApiKey.trim());
    setIsSettingsOpen(false);
    setTestResult(null);
  };

  const clearApiKey = () => {
    localStorage.removeItem('fmp_api_key');
    setFmpApiKey('');
    setTestResult(null);
  };

  const testApiKey = async () => {
    setIsTestingKey(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/debug/fmp', {
        headers: {
          'X-FMP-API-Key': fmpApiKey.trim()
        }
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ status: 'error', message: `Connection failed: ${err.message}` });
    } finally {
      setIsTestingKey(false);
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
    "Connecting to Financial Modeling Prep...",
    "Retrieving TTM ratios...",
    "Analyzing capital efficiency...",
    "Calculating quality score...",
    "Finalizing report..."
  ];

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim()) return;

    const fullTicker = ticker.trim().toUpperCase() + exchange;
    setLoading(true);
    setError(null);
    setData(null);

    // Cycle through loading messages for better UX
    let messageIndex = 0;
    setLoadingMessage(loadingMessages[0]);
    const interval = setInterval(() => {
      messageIndex = (messageIndex + 1) % loadingMessages.length;
      setLoadingMessage(loadingMessages[messageIndex]);
    }, 1500);

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
          score: 4.8,
          source: "Demo Mode (Mock Data)"
        };
        setData(demoData);
      } else {
        const result = await fetchStockData(fullTicker, fmpApiKey.trim());
        setData(result);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch stock data. Ensure your FMP API key is set.');
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  const checkFmpStatus = async () => {
    setDebugInfo("Checking FMP API status...");
    try {
      const res = await fetch("/api/debug/fmp", {
        headers: {
          'X-FMP-API-Key': fmpApiKey.trim()
        }
      });
      const data = await res.json();
      setDebugInfo(data.message);
    } catch (err: any) {
      setDebugInfo(`Error: ${err.message}`);
    }
  };

  const MetricCard = ({ 
    label, 
    value, 
    benchmark, 
    suffix = '%', 
    isRatio = false 
  }: { 
    label: string; 
    value: number; 
    benchmark: number; 
    suffix?: string;
    isRatio?: boolean;
  }) => {
    const beats = value > benchmark;
    return (
      <div className="bg-white/5 border border-white/10 p-4 rounded-lg flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-xs font-mono uppercase tracking-wider text-white/50">{label}</span>
          {beats ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <XCircle className="w-4 h-4 text-rose-400" />
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-mono font-bold text-white">
            {value.toFixed(isRatio ? 2 : 1)}{suffix}
          </span>
          <span className="text-[10px] font-mono text-white/30">
            vs {benchmark}{suffix} avg
          </span>
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
      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-emerald-500" />
                  <h2 className="font-mono font-bold uppercase tracking-wider">API Configuration</h2>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="text-white/30 hover:text-white transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-white/40">Financial Modeling Prep API Key</label>
                  <div className="relative">
                    <input 
                      type="password"
                      placeholder="Paste your API key here..."
                      value={fmpApiKey}
                      onChange={(e) => setFmpApiKey(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all font-mono text-sm"
                    />
                    {fmpApiKey && (
                      <button 
                        onClick={clearApiKey}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-white/30 leading-relaxed italic">
                    Your key is stored locally in your browser and is used to fetch real-time financial data.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={saveApiKey}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" /> SAVE API KEY
                  </button>
                  <button 
                    onClick={testApiKey}
                    disabled={isTestingKey || !fmpApiKey}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-white font-mono font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 border border-white/10 disabled:opacity-50"
                  >
                    {isTestingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />} TEST
                  </button>
                </div>

                {testResult && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "p-4 rounded-lg text-xs font-mono border flex items-start gap-3",
                      testResult.status === 'ok' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                    )}
                  >
                    {testResult.status === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                    <div>
                      <p className="font-bold uppercase mb-1">{testResult.status === 'ok' ? "Connection Successful" : "Connection Failed"}</p>
                      <p className="opacity-70">{testResult.message}</p>
                    </div>
                  </motion.div>
                )}
              </div>
              
              <div className="p-4 bg-black/30 border-t border-white/5 flex justify-center">
                <a 
                  href="https://site.financialmodelingprep.com/developer/docs/dashboard" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[10px] font-mono uppercase tracking-widest text-white/30 hover:text-emerald-500 transition-colors flex items-center gap-1"
                >
                  Get a free API key at Financial Modeling Prep <TrendingUp className="w-3 h-3" />
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center">
              <TrendingUp className="text-black w-5 h-5" />
            </div>
            <span className="font-mono font-bold tracking-tighter text-xl">EQUITY<span className="text-emerald-500">INSIGHT</span></span>
          </div>

          <div className="flex items-center gap-4">
            {isDemoMode && (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest">Demo Mode Active</span>
                <button 
                  onClick={() => setIsDemoMode(false)}
                  className="ml-2 text-[10px] text-white/30 hover:text-white transition-colors"
                >
                  Exit
                </button>
              </div>
            )}
            
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-full hover:bg-white/5 transition-colors text-white/50 hover:text-white"
              title="API Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
          
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-emerald-500 transition-colors" />
              <input
                type="text"
                placeholder="Ticker (e.g. AAPL, GAW)"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 w-48 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all font-mono text-sm"
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
              className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-mono font-bold py-2 px-6 rounded-full transition-all text-sm shrink-0"
            >
              ANALYZE
            </button>
          </form>
          <div className="absolute -bottom-6 right-0 text-[10px] text-white/20 font-mono italic">
            Tip: You can search by ticker (GAW.L) or company name (Games Workshop)
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {!data && !loading && !error && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center py-32 text-center"
            >
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6">
                <BarChart3 className="w-8 h-8 text-white/20" />
              </div>
              <h1 className="text-3xl font-bold mb-4 tracking-tight">Investment Research Tool</h1>
              <p className="text-white/50 max-w-md">
                Search for any ticker symbol to analyze its fundamental quality metrics against S&P 500 benchmarks.
              </p>
            </motion.div>
          )}

          {loading && (
            <motion.div 
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
              className={cn(
                "p-6 rounded-2xl border flex items-start gap-4 max-w-2xl mx-auto",
                isApiKeyError ? "bg-amber-500/10 border-amber-500/20 text-amber-200" : "bg-rose-500/10 border-rose-500/20 text-rose-200"
              )}
            >
              <div className={cn(
                "p-2 rounded-lg shrink-0",
                isApiKeyError ? "bg-amber-500/20" : "bg-rose-500/20"
              )}>
                <AlertCircle className={cn("w-5 h-5", isApiKeyError ? "text-amber-500" : "text-rose-500")} />
              </div>
              <div className="space-y-2">
                <p className="font-bold">{isApiKeyError ? "API Key Issue Detected" : "Search Error"}</p>
                <p className="text-sm opacity-70 leading-relaxed">{error}</p>
                {isApiKeyError && (
                  <div className="pt-2 flex flex-wrap gap-4 items-center">
                    <a 
                      href="https://site.financialmodelingprep.com/developer/docs/dashboard" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs font-mono uppercase tracking-wider text-amber-500 hover:underline flex items-center gap-1"
                    >
                      Check FMP Dashboard <TrendingUp className="w-3 h-3" />
                    </a>
                    <span className="text-xs opacity-40">|</span>
                    <button 
                      onClick={testApiKey}
                      disabled={isTestingKey}
                      className="text-xs font-mono uppercase tracking-wider text-amber-400 hover:underline flex items-center gap-1 disabled:opacity-50"
                    >
                      {isTestingKey ? "Testing..." : "Test Connection"} <Activity className="w-3 h-3" />
                    </button>
                    <span className="text-xs opacity-40">|</span>
                    <button 
                      onClick={() => {
                        setIsDemoMode(true);
                        setError(null);
                      }}
                      className="text-xs font-mono uppercase tracking-wider text-emerald-500 hover:underline flex items-center gap-1"
                    >
                      Switch to Demo Mode <CheckCircle2 className="w-3 h-3" />
                    </button>
                    <span className="text-xs opacity-40">|</span>
                    <span className="text-xs opacity-60 italic font-mono">Tip: Try a US stock (e.g. AAPL) to verify your key works.</span>
                  </div>
                )}
                {testResult && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className={cn(
                      "mt-3 p-3 rounded-lg text-xs font-mono border",
                      testResult.status === 'ok' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {testResult.status === 'ok' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      <span className="uppercase font-bold">{testResult.status === 'ok' ? "Success" : "Error"}:</span>
                      <span>{testResult.message}</span>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {data && !loading && (
            <motion.div
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
                    <h2 className="text-4xl font-bold tracking-tight">{data.name}</h2>
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
                  benchmark={SP500_AVERAGES.roce} 
                />
                <MetricCard 
                  label="Gross Margin" 
                  value={data.grossMargin} 
                  benchmark={SP500_AVERAGES.grossMargin} 
                />
                <MetricCard 
                  label="Operating Margin" 
                  value={data.operatingMargin} 
                  benchmark={SP500_AVERAGES.operatingMargin} 
                />
                <MetricCard 
                  label="Cash Conversion" 
                  value={data.cashConversion} 
                  benchmark={SP500_AVERAGES.cashConversion} 
                />
                <MetricCard 
                  label="Interest Cover" 
                  value={data.interestCover} 
                  benchmark={SP500_AVERAGES.interestCover} 
                  suffix="x"
                  isRatio
                />
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
          &copy; 2026 EquityInsight Research Tool • Personal Research MVP
        </div>
        <div className="flex flex-col items-center gap-2">
          <button 
            onClick={checkFmpStatus}
            className="text-[10px] font-mono text-white/30 hover:text-emerald-500 transition-colors border border-white/10 px-3 py-1 rounded-full"
          >
            DEBUG FMP API STATUS
          </button>
          {debugInfo && (
            <div className={cn(
              "text-[10px] font-mono p-2 rounded border",
              debugInfo.includes("ok") ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-rose-500/10 border-rose-500/20 text-rose-500"
            )}>
              {debugInfo}
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
