import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, Globe, Flame, Users, Landmark, Zap, Sparkles, Rocket, TrendingUp, TrendingDown, ArrowUpRight, RefreshCw, Share2, Copy, CheckCircle, X, Filter } from 'lucide-react';

/* ==========================================================================
 * [1] 常數與靜態設定
 * ========================================================================== */

// 靜態排行名單 (用於呈現受益人、規模等非報價類排行，報價會從 API 自動同步)
const RANKING_DATA = {
  beneficiaries: ['00878', '0056', '00919', '00929', '00940', '0050', '00713', '00679B', '00687B', '00939'],
  aum: ['0050', '0056', '00878', '00679B', '00687B', '00919', '00929', '00981A', '00713', '00692'],
  active: ['00981A', '00980A', '00982A', '00984A', '00985A', '00993A', '00986A'], 
  new_raising: [
    { id: '00995A', name: '中信台灣卓越成長', category: '主動式', market: '上市', price: 10.00, isRaising: true, date: '本月 18日 - 22日', feature: '精選台股MVP 季配息', prospectusUrl: 'https://www.ctbcinvestments.com/act/202512_00995A/Prospectus_00995A.pdf' },
    { id: '009817', name: '國泰大和日本不動產', category: '海外型', market: '上市', price: 10.00, isRaising: true, date: '下月 02日 - 06日', feature: '鎖定日本REITs收息', prospectusUrl: 'https://www.cathaysite.com.tw/uploads/jreitsdividend_prospectus_202601.pdf' },
    { id: '009816', name: '凱基台灣TOP 50', category: '市值型', market: '上市', price: 10.00, isRaising: true, date: '下月 01日 - 03日', feature: 'AI供應鏈護國群山', prospectusUrl: 'https://www.kgifund.com.tw/Upload/Files/ManageFileUploadProspectus/J023.pdf' }
  ]
};

const CATEGORIES = [
  { id: 'all', label: '全部ETF', icon: Globe },
  { id: 'volume', label: '高買氣', icon: Flame },
  { id: 'beneficiaries', label: '受益人', icon: Users },
  { id: 'aum', label: '資產規模', icon: Landmark },
  { id: 'active', label: '主動式', icon: Zap },
  { id: 'new_raising', label: '新募集', icon: Rocket },
];

const MARKET_DATA_FALLBACK = [
  { id: '0050', name: '元大台灣50', category: '市值型', market: '上市', price: 198.5, change: 2.2, changePercent: 1.12, volume: 15000 },
  { id: '0056', name: '元大高股息', category: '高股息', market: '上市', price: 41.2, change: -0.15, changePercent: -0.36, volume: 32000 },
  { id: '00878', name: '國泰永續高股息', category: '高股息', market: '上市', price: 23.4, change: 0.05, changePercent: 0.21, volume: 45000 },
  { id: '00919', name: '群益台灣精選高息', category: '高股息', market: '上市', price: 26.5, change: 0.1, changePercent: 0.38, volume: 38000 },
  { id: '00929', name: '復華台灣科技優息', category: '高股息', market: '上市', price: 20.8, change: -0.05, changePercent: -0.24, volume: 55000 },
  { id: '00679B', name: '元大美債20年', category: '債券型', market: '上櫃', price: 29.5, change: 0.1, changePercent: 0.34, volume: 45000 },
  { id: '00687B', name: '國泰20年美債', category: '債券型', market: '上櫃', price: 31.2, change: 0.15, changePercent: 0.48, volume: 42000 },
  { id: '00713', name: '元大台灣高息低波', category: '高股息', market: '上市', price: 58.4, change: 0.3, changePercent: 0.52, volume: 12000 },
  { id: '00940', name: '元大台灣價值高息', category: '高股息', market: '上市', price: 9.8, change: 0.0, changePercent: 0.00, volume: 85000 },
  { id: '006208', name: '富邦台50', category: '市值型', market: '上市', price: 112.5, change: 1.5, changePercent: 1.35, volume: 18000 }
];

/* ==========================================================================
 * [2] 資料邏輯 Hook (取得上市 + 上櫃 全部 ETF)
 * ========================================================================== */

function useETFData() {
  const [etfData, setEtfData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isOffline, setIsOffline] = useState(false);

  const fetchAllMarkets = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsOffline(false);
      
      // 建立支援雙重代理的抓取函式，提升跨網域請求成功率
      const fetchWithProxy = async (url) => {
        try {
          const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
          if (res.ok) return await res.json();
        } catch(e) { console.warn("AllOrigins 代理失敗，嘗試備援線路..."); }
        
        try {
          const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
          if (res.ok) return await res.json();
        } catch(e) { console.warn("CorsProxy 備援失敗"); }
        
        return [];
      };
      
      const twseUrl = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL';
      const tpexUrl = 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes';

      // 同步等待兩個市場的 API 回應
      const [twse, tpex] = await Promise.all([
        fetchWithProxy(twseUrl),
        fetchWithProxy(tpexUrl)
      ]);
      
      // 格式化上市資料 (TWSE)
      const normalizedTWSE = (Array.isArray(twse) ? twse : [])
        .filter(i => i.Code && i.Code.startsWith('00'))
        .map(i => ({
          id: i.Code, name: i.Name, price: i.ClosingPrice, change: i.Change, volume: i.TradeVolume, market: '上市'
        }));

      // 格式化上櫃資料 (TPEx)
      const normalizedTPEx = (Array.isArray(tpex) ? tpex : [])
        .filter(i => i.SecuritiesCompanyCode && i.SecuritiesCompanyCode.startsWith('00'))
        .map(i => ({
          id: i.SecuritiesCompanyCode, name: i.CompanyName, price: i.Close, change: i.Change, volume: i.TradingShares, market: '上櫃'
        }));

      // 合併所有來源並計算細節
      const combined = [...normalizedTWSE, ...normalizedTPEx].map(item => {
        // 安全轉換數字，去除千分位逗號，避免解析錯誤
        const price = parseFloat(String(item.price).replace(/,/g, '')) || 0;
        const changeVal = parseFloat(String(item.change).replace(/,/g, '').replace('+', '').trim()) || 0;
        const prev = price - changeVal;
        const percent = prev !== 0 ? (changeVal / prev) * 100 : 0;
        const vol = parseInt(String(item.volume).replace(/,/g, '') || '0', 10) / 1000; 
        
        let cat = '台股ETF';
        if (item.id.endsWith('A') || item.name.includes('主動')) cat = '主動式';
        else if (item.name.includes('債')) cat = '債券型';
        else if (item.name.includes('正2')) cat = '槓桿型';
        else if (item.name.includes('反1')) cat = '反向型';
        else if (item.name.includes('高息') || item.name.includes('優息')) cat = '高股息';

        return { 
          id: item.id, 
          name: item.name, 
          category: cat, 
          market: item.market,
          price, 
          change: changeVal, 
          changePercent: percent, 
          volume: vol 
        };
      });

      // 代碼去重 (以防萬一跨市場重複出現)
      const unique = Array.from(new Map(combined.map(i => [i.id, i])).values());
      
      // 驗證：如果抓取到的資料筆數大於 50 檔，才視為成功抓取全市場
      if (unique.length > 50) {
        setEtfData(unique);
      } else {
        setEtfData(MARKET_DATA_FALLBACK);
        setIsOffline(true);
      }
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("API 抓取失敗", err);
      setEtfData(MARKET_DATA_FALLBACK);
      setIsOffline(true);
      setLastUpdate(new Date().toLocaleTimeString());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAllMarkets(); }, [fetchAllMarkets]);

  return { etfData, isLoading, lastUpdate, isOffline, refetch: fetchAllMarkets };
}

/* ==========================================================================
 * [3] UI 子元件
 * ========================================================================== */

// 一般報價卡片
const ETFCard = ({ etf, index, isRanking, activeCategory, showVolume }: any) => {
  const isUp = etf.change > 0;
  const isDown = etf.change < 0;
  const color = isUp ? 'text-red-500' : isDown ? 'text-green-600' : 'text-gray-900';
  const bgColor = isUp ? 'bg-red-50' : isDown ? 'bg-green-50' : 'bg-gray-50';

  return (
    <div className="group bg-white p-5 rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 relative transform hover:-translate-y-1">
      {isRanking && (
        <div className={`absolute -left-3 -top-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black border-2 border-white shadow-md z-10 ${index === 0 ? 'bg-yellow-400 text-yellow-900' : index === 1 ? 'bg-gray-300 text-gray-800' : index === 2 ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
          {index + 1}
        </div>
      )}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <a href="https://www.pocket.tw/" target="_blank" rel="noopener noreferrer" className="text-xl font-black text-gray-900 hover:text-blue-600 hover:underline truncate max-w-[200px] transition-colors">
            {etf.name}
          </a>
          <div className="flex gap-1">
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 font-bold rounded border border-gray-200 whitespace-nowrap">
              {etf.market}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 font-bold rounded border border-blue-100 whitespace-nowrap">
              {etf.category}
            </span>
          </div>
        </div>
        <span className="text-sm font-bold text-gray-400 tracking-tight">{etf.id}</span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <span className="text-[10px] text-gray-400 font-bold mb-0.5 uppercase tracking-tighter block">市價</span>
          <div className={`font-black text-2xl ${color}`}>{etf.price.toFixed(2)}</div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className={`text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1 ${bgColor} ${color}`}>
            {isUp ? <TrendingUp size={14}/> : isDown ? <TrendingDown size={14}/> : null}
            {isUp ? '+' : ''}{etf.change.toFixed(2)} ({isUp ? '+' : ''}{etf.changePercent.toFixed(2)}%)
          </div>
          {showVolume && etf.volume !== undefined && (
            <div className="text-[10px] font-bold text-gray-500 flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded">
              <Flame size={12} className="text-orange-500" /> {Math.round(etf.volume).toLocaleString()} 張
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 新募集卡片
const RaisingCard = ({ etf }: any) => (
  <div className="bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden relative group hover:shadow-xl transition-all transform hover:-translate-y-1 flex flex-col">
    <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-bl-xl shadow-md z-10">申購中</div>
    <div className="p-5 flex-1">
      <div className="mb-4">
        <a href={etf.prospectusUrl || "https://mops.twse.com.tw/mops/web/t146sb05"} target="_blank" rel="noopener noreferrer" className="text-xl font-black text-gray-900 hover:text-blue-600 hover:underline transition-colors block mb-1 truncate max-w-[220px]">
          {etf.name}
        </a>
        <span className="text-sm font-bold text-gray-400">{etf.id}</span>
      </div>
      <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-50 mb-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-blue-600 font-bold uppercase">預計發行價</span>
          <span className="font-black text-2xl text-blue-700">${etf.price.toFixed(2)}</span>
        </div>
        <div className="text-[11px] text-gray-500 font-medium">期間: {etf.date}</div>
        <div className="text-[11px] text-amber-600 font-bold mt-2 bg-amber-50 inline-block px-2 py-0.5 rounded">★ {etf.feature}</div>
      </div>
    </div>
    <div className="px-5 pb-5">
      <a href={etf.prospectusUrl || "https://mops.twse.com.tw/mops/web/t146sb05"} target="_blank" rel="noopener noreferrer" className="w-full py-3 bg-gray-900 text-white text-center font-bold text-sm rounded-xl hover:bg-gray-800 transition-colors flex justify-center items-center gap-2 shadow-md">
        查看公開說明書 <ArrowUpRight size={16} />
      </a>
    </div>
  </div>
);

/* ==========================================================================
 * [4] App 主程式
 * ========================================================================== */

export default function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const { etfData, isLoading, lastUpdate, isOffline, refetch } = useETFData();
  const [sortOption, setSortOption] = useState('default');
  
  const [activeCategory, setActiveCategory] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search).get('category');
      return CATEGORIES.some(c => c.id === p) ? p : 'volume';
    } catch(e) {
      return 'volume';
    }
  });

  const [showShareModal, setShowShareModal] = useState(false);
  const [isLinkActive, setIsLinkActive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  // 支援瀏覽器「上一頁/下一頁」事件
  useEffect(() => {
    const handlePopState = () => {
      try {
        const p = new URLSearchParams(window.location.search).get('category');
        if (p) setActiveCategory(CATEGORIES.some(c => c.id === p) ? p : 'volume');
      } catch (e) {
        // Ignore errors in environments that restrict URLSearchParams
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 初始化時，如果網址列沒有參數，嘗試自動補上預設的分類網址 (加入防呆，避免預覽環境崩潰)
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.location.search.includes('category=')) {
       try {
         const href = window.location.href.split('?')[0];
         window.history.replaceState({}, '', `${href}?category=${activeCategory}`);
       } catch (error) {
         console.warn("History API is restricted in this environment.");
       }
    }
    // 只在掛載時執行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 單純同步供「分享按鈕」使用的分享網址
  useEffect(() => {
    const baseUrl = "https://elegant-blancmange-329c44.netlify.app/";
    setShareUrl(`${baseUrl}?category=${activeCategory}`);
  }, [activeCategory]);

  // 點擊標籤時的切換處理 (更新畫面與網址列，但不重新整理網頁)
  const handleTabClick = (e, id) => {
    e.preventDefault();
    if (activeCategory === id) return;
    setActiveCategory(id);
    setSortOption('default'); // 切換標籤時重置排序狀態
    if (typeof window !== 'undefined') {
      try {
        const href = window.location.href.split('?')[0];
        window.history.pushState({}, '', `${href}?category=${id}`);
      } catch (error) {
        console.warn("History API is restricted in this environment.");
      }
    }
  };

  // 過濾與名次限制邏輯 (除「全部ETF」外皆限制前 10 名)
  const displayList = useMemo(() => {
    let list = [];
    if (activeCategory === 'new_raising') {
      list = RANKING_DATA.new_raising.slice(0, 10);
    } else if (activeCategory === 'all') {
      list = [...etfData]; // 複製陣列以便後續排序
    } else if (activeCategory === 'volume') {
      list = [...etfData].sort((a, b) => b.volume - a.volume).slice(0, 10);
    } else {
      const targetIds = RANKING_DATA[activeCategory] || [];
      list = targetIds.map(id => etfData.find(e => e.id === id)).filter(Boolean).slice(0, 10);
    }

    if (searchTerm) {
      const low = searchTerm.toLowerCase();
      list = list.filter(e => e.id.includes(low) || e.name.toLowerCase().includes(low));
    }

    // 針對「全部ETF」套用排序功能
    if (activeCategory === 'all') {
      if (sortOption === 'gainers') {
        list.sort((a, b) => b.changePercent - a.changePercent);
      } else if (sortOption === 'losers') {
        list.sort((a, b) => a.changePercent - b.changePercent);
      } else if (sortOption === 'volume') {
        list.sort((a, b) => b.volume - a.volume);
      } else {
        list.sort((a, b) => a.id.localeCompare(b.id)); // 預設依代碼排序
      }
    }

    return list;
  }, [etfData, activeCategory, searchTerm, sortOption]);

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] font-sans text-gray-900 selection:bg-blue-200">
      
      {/* 導覽列 Navbar (最大寬度 1440px) */}
      <nav className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-black text-xl shadow-lg">E</div>
            <span className="font-black text-xl tracking-tight hidden sm:block">台股ETF排行</span>
          </div>
          <div className="flex-1 max-w-md mx-6 hidden md:block relative group">
            <input type="text" placeholder="搜尋代碼或名稱..." className="w-full pl-10 pr-4 py-2 bg-gray-100 border-transparent rounded-full text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all shadow-inner" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            <Search className="absolute left-3 top-2.5 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={16} />
          </div>
          <button onClick={() => setShowShareModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 font-bold rounded-full text-sm hover:bg-blue-100 active:scale-95 transition-all">
            <Share2 size={16} /> <span className="hidden sm:inline">分享連結</span>
          </button>
        </div>
      </nav>

      {/* 主內容 Main Content (最大寬度 1440px) */}
      <main className="flex-1 max-w-[1440px] mx-auto w-full px-4 py-6">
        {/* 手機版搜尋列 */}
        <div className="md:hidden mb-6 relative">
          <input type="text" placeholder="搜尋代碼或名稱..." className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <Search className="absolute left-3 top-3.5 text-gray-400" size={20} />
        </div>

        {/* 標籤分類區 (一行 3 個 Tag) */}
        <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2 mb-6">
          {CATEGORIES.map(c => {
            const Icon = c.icon;
            return (
              <a 
                key={c.id} 
                href={`?category=${c.id}`}
                onClick={(e) => handleTabClick(e, c.id)} 
                className={`flex items-center justify-center gap-1.5 px-1 sm:px-5 py-2.5 rounded-full text-xs sm:text-sm font-black transition-all ${activeCategory === c.id ? 'bg-gray-900 text-white shadow-lg scale-105 transform' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-100'}`}
              >
                {Icon && <Icon size={14} className={activeCategory === c.id ? 'text-blue-400' : 'text-gray-400'} />}
                <span className="truncate">{c.label}</span>
              </a>
            );
          })}
        </div>

        {/* 排序功能區 (僅在「全部ETF」顯示) */}
        {activeCategory === 'all' && (
          <div className="flex items-center gap-2 mb-8 overflow-x-auto scrollbar-hide pb-2">
            <span className="text-xs font-bold text-gray-500 whitespace-nowrap flex items-center gap-1 mr-1">
              <Filter size={14} /> 排序方式
            </span>
            <button onClick={() => setSortOption('gainers')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${sortOption === 'gainers' ? 'bg-red-500 text-white shadow-md' : 'bg-white border border-red-100 text-red-600 hover:bg-red-50'}`}>漲幅最高</button>
            <button onClick={() => setSortOption('losers')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${sortOption === 'losers' ? 'bg-green-600 text-white shadow-md' : 'bg-white border border-green-100 text-green-700 hover:bg-green-50'}`}>跌幅最深</button>
            <button onClick={() => setSortOption('volume')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${sortOption === 'volume' ? 'bg-orange-500 text-white shadow-md' : 'bg-white border border-orange-100 text-orange-600 hover:bg-orange-50'}`}>成交量最多</button>
          </div>
        )}

        {/* 排行標題與重整按鈕 */}
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 flex items-center gap-2">
              {CATEGORIES.find(c => c.id === activeCategory)?.label}
              <span className="text-sm font-bold text-gray-400 ml-2">共 {displayList.length} 檔</span>
            </h2>
            {lastUpdate && (
              <p className={`text-[10px] mt-1 italic tracking-wider font-bold ${isOffline ? 'text-red-500' : 'text-gray-400'}`}>
                {isOffline ? `⚠️ API連線異常，目前顯示離線備用資料 (${lastUpdate})` : `全市場 (上市/上櫃) 同步時間：${lastUpdate}`}
              </p>
            )}
          </div>
          <button 
            onClick={refetch} 
            disabled={isLoading} 
            className={`p-2.5 bg-white border border-gray-200 rounded-full shadow-sm hover:text-blue-600 transition-all ${isLoading ? 'opacity-50 cursor-not-allowed' : 'active:scale-90'}`}
            title="重新抓取全市場資料"
          >
            <RefreshCw size={20} className={isLoading ? 'animate-spin text-blue-500' : ''} />
          </button>
        </div>

        {/* 資料呈現區 Grid */}
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-5 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="font-extrabold text-gray-500 animate-pulse text-lg">正在從證交所與櫃買中心獲取最新報價...</p>
          </div>
        ) : displayList.length === 0 ? (
          <div className="py-24 text-center bg-white rounded-3xl border border-gray-100 text-gray-400">
            <Search size={54} className="mx-auto mb-4 opacity-10" />
            <p className="text-xl font-extrabold text-gray-500">查無符合搜尋條件的 ETF</p>
            <p className="text-sm mt-2">請更換搜尋關鍵字或分類標籤</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 pb-12">
            {displayList.map((e, i) => e.isRaising ? <RaisingCard key={e.id} etf={e} /> : <ETFCard key={e.id} etf={e} index={i} isRanking={['volume','beneficiaries','aum','active'].includes(activeCategory)} activeCategory={activeCategory} showVolume={activeCategory === 'volume' || (activeCategory === 'all' && sortOption === 'volume')} />)}
          </div>
        )}
      </main>

      {/* 頁尾 Footer (最大寬度 1440px) */}
      <footer className="bg-white border-t border-gray-200 py-12 px-4 mt-auto">
        <div className="max-w-[1440px] mx-auto text-center space-y-4">
          <span className="font-black text-gray-700 text-xs tracking-widest uppercase bg-gray-100 px-4 py-1.5 rounded-full">免責聲明</span>
          <div className="text-xs sm:text-sm text-gray-400 font-bold leading-relaxed space-y-1.5">
            <p>資料來源：台灣證券交易所、證券櫃檯買賣中心（延遲報價）</p>
            <p>投資人交易時以證券商交易平台報價為主，本公司網站或APP僅供參考。</p>
          </div>
        </div>
      </footer>

      {/* 分享 Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-gray-900/40 animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setShowShareModal(false)}></div>
          <div className="bg-white rounded-[32px] p-8 w-full max-w-md relative shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black flex items-center gap-2"><Share2 className="text-blue-600"/> 分享排行榜</h3>
              <button onClick={() => setShowShareModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"><X size={20} /></button>
            </div>
            
            <div className={`p-6 rounded-3xl mb-8 border transition-all ${isLinkActive ? 'bg-blue-50 border-blue-100 shadow-inner' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl transition-all ${isLinkActive ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 text-gray-500'}`}><Globe size={24}/></div>
                <div className="flex-1">
                  <p className="font-black text-sm">{isLinkActive ? '分享連結已產生' : '啟用動態分享網址'}</p>
                  <p className="text-[11px] text-gray-500 mt-1">開啟開關，將目前的分類排名分享給朋友。</p>
                </div>
                <button onClick={() => setIsLinkActive(!isLinkActive)} className={`w-14 h-8 rounded-full relative transition-all duration-300 ${isLinkActive ? 'bg-blue-600' : 'bg-gray-300'}`}>
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${isLinkActive ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>
            </div>

            {isLinkActive && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <input readOnly value={shareUrl} className={`w-full text-xs border rounded-2xl px-4 py-4 font-mono focus:outline-none ${shareUrl.includes('⚠️') ? 'bg-red-50 border-red-200 text-red-600 font-bold' : 'bg-gray-50 border-gray-200 text-gray-600'}`} />
                <button 
                  onClick={() => {
                    if(shareUrl.includes('⚠️')) return; 
                    navigator.clipboard.writeText(shareUrl).then(()=>{setCopied(true); setTimeout(()=>setCopied(false), 2000);});
                  }} 
                  className={`w-full py-4 rounded-2xl font-black text-sm transition-all shadow-xl shadow-gray-200 ${copied ? 'bg-green-500 text-white' : (shareUrl.includes('⚠️') ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-black active:scale-[0.98]')}`}
                >
                  {copied ? <div className="flex items-center justify-center gap-2"><CheckCircle size={18}/> 網址已複製！</div> : '複製分享網址'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
