import React, { useState, useEffect } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line, BarChart, Bar, Cell
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Activity, Search, RefreshCw, AlertTriangle,
  BarChart3, PieChart, Zap, ShieldAlert
} from 'lucide-react';
import { standardDeviation } from 'simple-statistics';
import * as finance from './services/financeService';
import * as api from './services/apiService';
import * as hill from './services/hillEstimatorService';

// --- Types ---
interface AssetData {
  date: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

// --- Components ---

const Card = ({ title, children, className = "" }: any) => (
  <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
    {title && (
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">{title}</h3>
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

const StatBox = ({ label, value, trend, icon: Icon }: any) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
    <div className="flex justify-between items-start mb-4">
      <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
        <Icon size={24} />
      </div>
      {trend !== undefined && (
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
          parseFloat(trend) >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
        }`}>
          {parseFloat(trend) >= 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <p className="text-sm font-medium text-slate-500 mb-1">{label}</p>
    <p className="text-2xl font-bold text-slate-900">{value}</p>
  </div>
);

// --- Main App ---

export default function App() {
  const [ticker, setTicker] = useState('BTC');
  const [activeTicker, setActiveTicker] = useState('BTC');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AssetData[]>([]);
  const [quote, setQuote] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'price' | 'technical' | 'hill'>('price');
  const [macroAlpha, setMacroAlpha] = useState<{ alpha: number; observations: number; k: number } | null>(null);
  const [macroLoading, setMacroLoading] = useState(false);

  console.log('App rendering, loading:', loading, 'data length:', data.length);

  const fetchData = async (t: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const [rawData, qData] = await Promise.all([
        api.fetchBinanceCandles(t),
        api.fetchBinanceQuote(t).catch(err => {
          console.warn('Quote fetch failed, will derive from history:', err);
          return null;
        })
      ]);
      
      const formattedData = rawData.map((d: any) => ({
        date: new Date(d.date).toLocaleDateString(),
        close: d.close,
        open: d.open,
        high: d.high,
        low: d.low,
        volume: d.volume
      }));
      
      setData(formattedData);
      setActiveTicker(t);

      if (qData) {
        setQuote(qData);
      } else if (formattedData.length > 0) {
        const latest = rawData[rawData.length - 1];
        const prev = rawData.length > 1 ? rawData[rawData.length - 2] : latest;
        const change = latest.close - prev.close;
        const changePercent = (change / prev.close) * 100;

        setQuote({
          regularMarketPrice: latest.close,
          regularMarketChange: change,
          regularMarketChangePercent: changePercent,
          currency: 'USD'
        });
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(ticker);
  }, []);

  const handleTickerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData(ticker);
  };

  const fetchMacroData = async () => {
    if (macroAlpha || macroLoading) return;
    setMacroLoading(true);
    try {
      const results = await Promise.all(
        api.MACRO_TICKERS.map(t => 
          api.fetchBinanceCandles(t, 360).catch(() => [] as api.AssetData[])
        )
      );
      const multiReturns = results
        .filter(r => r.length > 200)
        .map(r => hill.calculateReturns(r.map(d => d.close), true));
      
      const macro = hill.calculateMacroHill(multiReturns);
      setMacroAlpha(macro);
    } catch (err) {
      console.error('Macro data fetch error:', err);
    } finally {
      setMacroLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'hill') {
      fetchMacroData();
    }
  }, [activeTab]);

  const prices = data.map(d => d.close);
  
  // Technical Indicators Calculation
  const sma50 = finance.calculateSMA(prices, 50);
  const sma200 = finance.calculateSMA(prices, 200);
  const ema50 = finance.calculateEMA(prices, 50);
  const ema200 = finance.calculateEMA(prices, 200);
  const rsi = finance.calculateRSI(prices);
  const { macd: macdLine, signal: signalLine, histogram } = finance.calculateMACD(prices);

  // Cross Detection
  const crossStatus = (() => {
    if (sma50.length < 2 || sma200.length < 2) return null;
    const lastIdx = sma50.length - 1;
    const prevIdx = lastIdx - 1;
    
    const s50_curr = sma50[lastIdx];
    const s200_curr = sma200[lastIdx];
    const s50_prev = sma50[prevIdx];
    const s200_prev = sma200[prevIdx];

    if (isNaN(s50_curr) || isNaN(s200_curr) || isNaN(s50_prev) || isNaN(s200_prev)) return null;

    if (s50_prev <= s200_prev && s50_curr > s200_curr) return { type: 'Golden Cross', color: 'text-emerald-600', icon: Zap };
    if (s50_prev >= s200_prev && s50_curr < s200_curr) return { type: 'Death Cross', color: 'text-rose-600', icon: ShieldAlert };
    
    return s50_curr > s200_curr ? { type: 'Bullish Trend', color: 'text-indigo-600', icon: TrendingUp } : { type: 'Bearish Trend', color: 'text-slate-600', icon: TrendingDown };
  })();

  // Hill Estimator Calculation
  const allReturns = hill.calculateReturns(prices, true);
  
  const microReturns = allReturns.slice(-180); // Precise 180-day current risk window
  const microHill = hill.calculateMicroHill(microReturns);
  
  const hillPlotData = microHill.ks.map((k, i) => ({
    k,
    alpha: microHill.alphas[i]
  }));
  
  const rollingAlphaSeries = hill.calculateRollingHill(allReturns, 180);
  
  const rollingHillData = rollingAlphaSeries.map(r => ({
    date: data[r.dateIndex]?.date,
    alpha: r.alpha
  }));

  const technicalData = data.map((d, i) => ({
    ...d,
    sma50: sma50[i],
    sma200: sma200[i],
    ema50: ema50[i],
    ema200: ema200[i],
    rsi: rsi[i],
    macd: macdLine[i],
    signal: signalLine[i],
    hist: histogram[i]
  })).slice(-365); // Only show the last year on the chart for professional scale

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Top Navigation / Search Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md">
              <Activity size={20} />
            </div>
            <h1 className="text-lg font-bold tracking-tight uppercase tracking-widest text-indigo-700">Financial Modelling Pro</h1>
          </div>

          <form onSubmit={handleTickerSubmit} className="relative w-64">
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              className="w-full bg-slate-100 border-transparent rounded-full py-2 pl-4 pr-10 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
              placeholder="Search pairs (e.g. BTC, ETH)..."
            />
            <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600">
              <Search size={16} />
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-96 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="text-slate-500 font-medium animate-pulse">Fetching market data...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-6 rounded-2xl flex items-center space-x-4 max-w-2xl mx-auto">
            <AlertTriangle size={24} />
            <div>
              <p className="font-bold">Error loading data</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Header Stats */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold text-slate-900">{activeTicker} Price Movement</h2>
                <p className="text-slate-500 font-medium">Historical performance over the last {data.length} days</p>
              </div>
              
              <div className="flex items-center space-x-6 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Current Price</p>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-2xl font-bold text-slate-900">
                      ${(quote?.regularMarketPrice || prices[prices.length - 1] || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className={`text-sm font-bold ${
                      (quote?.regularMarketChangePercent || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {(quote?.regularMarketChangePercent || 0) >= 0 ? '+' : ''}{(quote?.regularMarketChangePercent || 0).toFixed(2)}%
                    </span>
                  </div>
                </div>
                <div className="w-px h-10 bg-slate-100"></div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">52W Range</p>
                  <p className="text-sm font-bold text-slate-700">
                    ${(quote?.fiftyTwoWeekLow || Math.min(...prices)).toLocaleString()} - ${(quote?.fiftyTwoWeekHigh || Math.max(...prices)).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Tab Switcher */}
            <div className="flex items-center space-x-4">
              <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-xl w-fit">
                <button
                  onClick={() => setActiveTab('price')}
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                    activeTab === 'price' 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Price Movement
                </button>
                <button
                  onClick={() => setActiveTab('technical')}
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                    activeTab === 'technical' 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Technical Indicators
                </button>
                <button
                  onClick={() => setActiveTab('hill')}
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                    activeTab === 'hill' 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Hill Estimator
                </button>
              </div>
            </div>

            {activeTab === 'price' && (
              <>
                {/* Main Chart */}
                <Card>
                  <div className="h-[500px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.slice(-365)}>
                        <defs>
                          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fontSize: 10, fill: '#94a3b8'}}
                          minTickGap={50}
                        />
                        <YAxis 
                          domain={['auto', 'auto']} 
                          tick={{fontSize: 12, fill: '#64748b'}} 
                          axisLine={false} 
                          tickLine={false} 
                          tickFormatter={(val) => `$${val.toLocaleString()}`}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          formatter={(val: number) => [`$${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 'Price']}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="close" 
                          stroke="#6366f1" 
                          strokeWidth={3} 
                          fillOpacity={1} 
                          fill="url(#colorPrice)" 
                          animationDuration={1500}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <StatBox 
                    label="Year High" 
                    value={`$${(quote?.fiftyTwoWeekHigh || Math.max(...prices)).toLocaleString()}`} 
                    icon={TrendingUp} 
                  />
                  <StatBox 
                    label="Year Low" 
                    value={`$${(quote?.fiftyTwoWeekLow || Math.min(...prices)).toLocaleString()}`} 
                    icon={TrendingDown} 
                  />
                  <StatBox 
                    label="Average Price" 
                    value={prices.length > 0 ? `$${(prices.reduce((a, b) => a + b, 0) / prices.length).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : 'N/A'} 
                    icon={Activity} 
                  />
                  <StatBox 
                    label="Volatility (StdDev)" 
                    value={prices.length > 1 ? `${(standardDeviation(prices) / (prices.reduce((a, b) => a + b, 0) / prices.length) * 100).toFixed(2)}%` : 'N/A'} 
                    icon={RefreshCw} 
                  />
                </div>
              </>
            )}

            {activeTab === 'technical' && (
              <div className="space-y-8">
                {/* Technical Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                        <Activity size={24} />
                      </div>
                      <span className="text-xs font-bold text-slate-400 uppercase">Current Price</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">Close</span>
                        <span className="font-bold">${prices[prices.length - 1]?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">Date</span>
                        <span className="font-bold">{data[data.length - 1]?.date || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">Source</span>
                        <span className="font-bold text-indigo-600">
                          Binance Live
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">Ticker</span>
                        <span className="font-bold">{ticker}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                        <BarChart3 size={24} />
                      </div>
                      <span className="text-xs font-bold text-slate-400 uppercase">Moving Averages</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">SMA 50</span>
                        <span className="font-bold">
                          {isNaN(sma50[sma50.length - 1]) ? 'N/A' : `$${sma50[sma50.length - 1].toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">SMA 200</span>
                        <span className="font-bold">
                          {isNaN(sma200[sma200.length - 1]) ? 'N/A' : `$${sma200[sma200.length - 1].toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">EMA 50</span>
                        <span className="font-bold text-indigo-500">
                          {isNaN(ema50[ema50.length - 1]) ? 'N/A' : `$${ema50[ema50.length - 1].toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">EMA 200</span>
                        <span className="font-bold text-amber-500">
                          {isNaN(ema200[ema200.length - 1]) ? 'N/A' : `$${ema200[ema200.length - 1].toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                        <PieChart size={24} />
                      </div>
                      <span className="text-xs font-bold text-slate-400 uppercase">Momentum</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">RSI (14)</span>
                        <span className={`font-bold ${
                          isNaN(rsi[rsi.length - 1]) ? 'text-slate-900' : (rsi[rsi.length - 1] > 70 ? 'text-rose-600' : (rsi[rsi.length - 1] < 30 ? 'text-emerald-600' : 'text-slate-900'))
                        }`}>
                          {isNaN(rsi[rsi.length - 1]) ? 'N/A' : rsi[rsi.length - 1].toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">MACD</span>
                        <span className="font-bold">
                          {isNaN(macdLine[macdLine.length - 1]) ? 'N/A' : macdLine[macdLine.length - 1].toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {crossStatus && (
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div className={`p-2 rounded-lg ${crossStatus.color.replace('text', 'bg').replace('600', '50')} ${crossStatus.color}`}>
                          <crossStatus.icon size={24} />
                        </div>
                        <span className="text-xs font-bold text-slate-400 uppercase">Signal</span>
                      </div>
                      <p className={`text-xl font-bold ${crossStatus.color}`}>{crossStatus.type}</p>
                      <p className="text-xs text-slate-500 mt-1">Based on SMA 50/200 crossover</p>
                    </div>
                  )}
                </div>

                {/* Moving Averages Chart */}
                <Card title="Moving Averages: SMA vs EMA">
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={technicalData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fontSize: 10, fill: '#94a3b8'}}
                          minTickGap={50}
                        />
                        <YAxis 
                          domain={['auto', 'auto']} 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fontSize: 10, fill: '#64748b'}}
                          tickFormatter={(val) => `$${val.toLocaleString()}`}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                        />
                        <Line type="monotone" dataKey="close" stroke="#94a3b8" strokeWidth={1} dot={false} name="Price" />
                        <Line type="monotone" dataKey="sma50" stroke="#6366f1" strokeWidth={2} dot={false} name="SMA 50" strokeDasharray="5 5" />
                        <Line type="monotone" dataKey="sma200" stroke="#f59e0b" strokeWidth={2} dot={false} name="SMA 200" strokeDasharray="5 5" />
                        <Line type="monotone" dataKey="ema50" stroke="#4f46e5" strokeWidth={3} dot={false} name="EMA 50" />
                        <Line type="monotone" dataKey="ema200" stroke="#d97706" strokeWidth={3} dot={false} name="EMA 200" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* RSI Chart */}
                  <Card title="RSI (Relative Strength Index)">
                    <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={technicalData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fontSize: 8, fill: '#94a3b8'}}
                            minTickGap={100}
                          />
                          <YAxis domain={[0, 100]} ticks={[0, 30, 70, 100]} tick={{fontSize: 10}} />
                          <Tooltip contentStyle={{ borderRadius: '12px' }} />
                          <Line type="monotone" dataKey="rsi" stroke="#8b5cf6" strokeWidth={2} dot={false} name="RSI" />
                          {/* Overbought/Oversold lines */}
                          <Line type="monotone" dataKey={() => 70} stroke="#ef4444" strokeDasharray="5 5" dot={false} name="Overbought" />
                          <Line type="monotone" dataKey={() => 30} stroke="#10b981" strokeDasharray="5 5" dot={false} name="Oversold" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  {/* MACD Chart */}
                  <Card title="MACD (Moving Average Convergence Divergence)">
                    <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={technicalData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fontSize: 8, fill: '#94a3b8'}}
                            minTickGap={100}
                          />
                          <YAxis tick={{fontSize: 10}} />
                          <Tooltip contentStyle={{ borderRadius: '12px' }} />
                          <Bar dataKey="hist" name="Histogram">
                            {technicalData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={(entry.hist || 0) >= 0 ? '#10b981' : '#ef4444'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {activeTab === 'hill' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Micro Hill Info */}
                  <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                        <Zap size={28} />
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Micro Estimator</span>
                        <h4 className="text-lg font-bold text-slate-900">{activeTicker} Specific</h4>
                        <p className="text-[10px] font-bold text-indigo-500 uppercase">180-Day Window</p>
                      </div>
                    </div>
                    
                    <div className="flex items-baseline space-x-3 mb-6">
                      <span className="text-5xl font-black text-slate-900">{microHill.alpha.toFixed(3)}</span>
                      <span className="text-lg font-bold text-slate-400">α</span>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-sm text-slate-600 leading-relaxed italic">
                        "The micro estimator focuses on the last 180 trading days to avoid the 'blurring effect' 
                        of structural market shifts and captures risk 'here and now'."
                      </p>
                    </div>
                  </div>

                  {/* Macro Hill Info */}
                  <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                    {macroLoading && (
                      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center space-y-3">
                        <RefreshCw size={32} className="text-indigo-600 animate-spin" />
                        <p className="text-sm font-bold text-slate-600 uppercase tracking-widest animate-pulse">Aggregating Market Data...</p>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between mb-6">
                      <div className="p-3 bg-rose-50 rounded-xl text-rose-600">
                        <ShieldAlert size={28} />
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Macro Estimator</span>
                        <h4 className="text-lg font-bold text-slate-900">Total Crypto Market</h4>
                        <p className="text-[10px] font-bold text-rose-500 uppercase">365-Day Window</p>
                      </div>
                    </div>

                    {macroAlpha ? (
                      <>
                        <div className="flex items-baseline space-x-3 mb-6">
                          <span className="text-5xl font-black text-rose-600">{macroAlpha.alpha.toFixed(4)}</span>
                          <span className="text-lg font-bold text-rose-300">α</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Observations</p>
                            <p className="text-lg font-bold text-slate-900">{macroAlpha.observations}</p>
                          </div>
                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Tail Size (k)</p>
                            <p className="text-lg font-bold text-slate-900">{macroAlpha.k}</p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="h-32 flex items-center justify-center border-2 border-dashed border-slate-100 rounded-xl">
                        <p className="text-slate-400 font-medium">Data not initialized</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Rolling Hill Chart */}
                <Card title={`Rolling Hill Alpha (180-Day Window): ${activeTicker}`}>
                  <div className="space-y-6">
                    <p className="text-sm text-slate-500 max-w-3xl">
                      Tracking structural shifts: Monitoring how Alpha evolves over time helps identify 
                      regime changes where market tails are becoming heavier or thinner.
                    </p>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={rollingHillData}>
                          <defs>
                            <linearGradient id="colorAlpha" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fontSize: 10, fill: '#94a3b8'}}
                            minTickGap={60}
                          />
                          <YAxis 
                            domain={['auto', 'auto']} 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fontSize: 10, fill: '#64748b'}}
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="alpha" 
                            stroke="#10b981" 
                            strokeWidth={2} 
                            fillOpacity={1} 
                            fill="url(#colorAlpha)" 
                            name="Rolling Alpha"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </Card>

                {/* Hill Plot */}
                <Card title={`Hill Plot: ${activeTicker} Tail Index Stability`}>
                  <div className="space-y-6">
                    <p className="text-sm text-slate-500 max-w-3xl">
                      The stability of α across different tail sizes (k) indicates the robustness of the estimator. 
                      A flat region suggests a reliable tail index estimate.
                    </p>
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={hillPlotData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="k" 
                            label={{ value: 'Tail Size (k)', position: 'insideBottom', offset: -10, fontSize: 12, fontWeight: 'bold' }}
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fontSize: 10, fill: '#94a3b8'}}
                          />
                          <YAxis 
                            label={{ value: 'Hill α', angle: -90, position: 'insideLeft', fontSize: 12, fontWeight: 'bold' }}
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fontSize: 10, fill: '#64748b'}}
                            domain={['auto', 'auto']}
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            formatter={(val: number) => [val.toFixed(4), 'Alpha']}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="alpha" 
                            stroke="#6366f1" 
                            strokeWidth={3} 
                            dot={false}
                            animationDuration={1500}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </Card>

                {/* Market Basket Info */}
                <Card title="Macro Estimator Universe">
                  <div className="flex flex-wrap gap-2">
                    {api.MACRO_TICKERS.map(t => (
                      <span key={t} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold border border-slate-200">
                        {t}/USDT
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 uppercase tracking-widest font-bold">
                    Aggregated logarithmic returns across top {api.MACRO_TICKERS.length} Binance pairs
                  </p>
                </Card>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
