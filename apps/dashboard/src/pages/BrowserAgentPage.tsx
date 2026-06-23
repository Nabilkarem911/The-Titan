import { useState, useEffect, useCallback } from 'react';
import { Globe, Loader2, RefreshCw, Search, MousePointer } from 'lucide-react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { PageHeader } from '../components/PageHeader';

interface WebIntelStats {
  totalSearches: number;
  totalScrapes: number;
  totalCrawls: number;
  totalInteractions: number;
  successCount: number;
  failureCount: number;
  avgLoadTime: number;
  recentUrls: string[];
}

interface BrowserStats {
  totalSessions: number;
  activeSessions: number;
  totalActions: number;
  totalTasks: number;
  successRate: number;
}

export default function BrowserAgentPage() {
  const [webStats, setWebStats] = useState<WebIntelStats | null>(null);
  const [browserStats, setBrowserStats] = useState<BrowserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<unknown[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [web, browser] = await Promise.all([
        api.get<WebIntelStats>('/web/stats').catch(() => null),
        api.get<BrowserStats>('/browser/stats').catch(() => null),
      ]);
      setWebStats(web);
      setBrowserStats(browser);
    } catch {
      toast.error('Failed to load browser agent data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await api.post<{ results: unknown[] }>('/web/search', { query });
      setResults(res.results ?? []);
      toast.success(`Found ${res.results?.length ?? 0} results`);
    } catch {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <PageHeader
        icon={Globe}
        title="Browser Agent"
        subtitle="Web intelligence, browser automation, and screen monitoring"
        description="The Browser Agent lets Titan interact with the web — search the internet, scrape pages, fill forms, click buttons, and take screenshots. It combines Web Intelligence (search + scrape + crawl) with Browser Automation (Playwright sessions). Use this page to search the web, view browser session stats, and monitor web interactions."
        tips={[
          'Use the search box below to search the web directly from the dashboard',
          'Browser sessions show active and completed web automation tasks',
          'From chat: titan chat "go to example.com and fill the contact form"',
        ]}
        actions={
          <button onClick={load} className="btn-ghost flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {webStats && (
          <>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-2"><Search className="w-4 h-4 text-accent-primary" /><span className="text-small text-text-secondary">Searches</span></div>
              <p className="text-h2 font-bold text-text-primary tabular-nums">{webStats.totalSearches}</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-2"><Globe className="w-4 h-4 text-accent-secondary" /><span className="text-small text-text-secondary">Scrapes</span></div>
              <p className="text-h2 font-bold text-text-primary tabular-nums">{webStats.totalScrapes}</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-2"><MousePointer className="w-4 h-4 text-accent-tertiary" /><span className="text-small text-text-secondary">Interactions</span></div>
              <p className="text-h2 font-bold text-text-primary tabular-nums">{webStats.totalInteractions}</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-2"><RefreshCw className="w-4 h-4 text-success" /><span className="text-small text-text-secondary">Success Rate</span></div>
              <p className="text-h2 font-bold text-text-primary tabular-nums">{webStats.successCount + webStats.failureCount > 0 ? ((webStats.successCount / (webStats.successCount + webStats.failureCount)) * 100).toFixed(0) : 0}%</p>
            </div>
          </>
        )}
      </div>

      <div className="card p-5">
        <h2 className="text-h3 text-text-primary mb-4">Web Search</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search query..."
            className="input flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} disabled={searching || !query.trim()} className="btn-primary flex items-center gap-2">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
        </div>
        {results.length > 0 && (
          <div className="mt-4 divide-y divide-border-subtle max-h-80 overflow-y-auto">
            {results.map((r, i) => (
              <div key={i} className="py-2">
                <pre className="text-small text-text-secondary overflow-x-auto">{JSON.stringify(r, null, 2)}</pre>
              </div>
            ))}
          </div>
        )}
      </div>

      {browserStats && (
        <div className="card p-5">
          <h2 className="text-h3 text-text-primary mb-3">Browser Sessions</h2>
          <div className="grid grid-cols-3 gap-4">
            <div><span className="text-small text-text-secondary">Total Sessions</span><p className="text-h2 font-bold text-text-primary">{browserStats.totalSessions}</p></div>
            <div><span className="text-small text-text-secondary">Active</span><p className="text-h2 font-bold text-success">{browserStats.activeSessions}</p></div>
            <div><span className="text-small text-text-secondary">Success Rate</span><p className="text-h2 font-bold text-text-primary">{browserStats.successRate}%</p></div>
          </div>
        </div>
      )}
    </div>
  );
}
