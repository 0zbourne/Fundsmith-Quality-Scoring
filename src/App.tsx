import React, { useState } from 'react';
import { Search, TrendingUp, Info, AlertCircle, CheckCircle2, XCircle, Loader2, BarChart3, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { fetchStockData, StockMetrics, SP500_AVERAGES } from './services/geminiService';

export default function App() {
  const [ticker, setTicker] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StockMetrics | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const result = await fetchStockData(ticker);
      setData(result);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch stock data. Please check the ticker and try again.');
    } finally {
      setLoading(false);
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
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center">
              <TrendingUp className="text-black w-5 h-5" />
            </div>
            <span className="font-mono font-bold tracking-tighter text-xl">EQUITY<span className="text-emerald-500">INSIGHT</span></span>
          </div>
          
          <form onSubmit={handleSearch} className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-emerald-500 transition-colors" />
            <input
              type="text"
              placeholder="Enter Ticker (e.g. AAPL, GAW.L)"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all font-mono text-sm"
            />
          </form>
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
              <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
              <p className="text-white/50 font-mono animate-pulse">ANALYZING FINANCIAL DATA...</p>
            </motion.div>
          )}

          {error && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-xl flex items-start gap-4 max-w-2xl mx-auto"
            >
              <AlertCircle className="w-6 h-6 text-rose-500 shrink-0" />
              <div>
                <h3 className="font-bold text-rose-500 mb-1">Search Error</h3>
                <p className="text-rose-200/70">{error}</p>
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
                        Note: S&P 500 averages are used as a general quality benchmark. Industry-specific benchmarks may vary significantly. Data is retrieved via AI-driven research and should be verified with official filings.
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
      <footer className="mt-auto py-12 border-t border-white/10 text-center text-white/20 font-mono text-[10px] uppercase tracking-[0.3em]">
        &copy; 2026 EquityInsight Research Tool • Personal Research MVP
      </footer>
    </div>
  );
}
