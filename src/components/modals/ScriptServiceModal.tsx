// components/modals/ScriptServiceModal.tsx
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  LogIn,
  LogOut,
  RefreshCw,
  Server,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY_TOKEN = 'script_service_token';
const STORAGE_KEY_BASE_URL = 'script_service_base_url';

interface LoginResponse {
  token: string;
  user: { id: number; username: string };
}

interface ScriptItem {
  id: number;
  user_id: number;
  topic: string;
  outline: string;
  status: string;
  username: string;
  created_at: string;
}

interface ScriptsResponse {
  data: ScriptItem[];
  total: number;
  page: number;
  pageSize: number;
}

interface ChapterItem {
  chapter_number: number;
  chapter_title: string;
  chapter_content: string;
  created_at: string;
}

interface ChaptersResponse {
  scriptId: number;
  chapters: ChapterItem[];
}

type ViewType = 'login' | 'list' | 'chapters';

interface ScriptServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ScriptServiceModal: React.FC<ScriptServiceModalProps> = ({ isOpen, onClose }) => {
  const [view, setView] = useState<ViewType>('login');
  const [baseUrl, setBaseUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  // List state
  const [scripts, setScripts] = useState<ScriptItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(false);

  // Chapters state
  const [selectedScript, setSelectedScript] = useState<ScriptItem | null>(null);
  const [chapters, setChapters] = useState<ChapterItem[]>([]);

  const getBaseUrl = () => baseUrl.replace(/\/+$/, '');

  // Load saved credentials on open
  useEffect(() => {
    if (isOpen) {
      const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
      const savedUrl = localStorage.getItem(STORAGE_KEY_BASE_URL) || '';
      setBaseUrl(savedUrl);
      if (savedToken && savedUrl) {
        setToken(savedToken);
        setView('list');
      } else {
        resetToLogin();
        setBaseUrl(savedUrl);
      }
    }
  }, [isOpen]);

  const resetToLogin = useCallback(() => {
    setView('login');
    setToken(null);
    setUsername('');
    setPassword('');
    setScripts([]);
    setTotal(0);
    setPage(1);
    setSelectedScript(null);
    setChapters([]);
    setLoading(false);
  }, []);

  const handleLogin = async () => {
    const url = getBaseUrl();
    if (!url || !username.trim() || !password.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`${url}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || '登录失败');
        return;
      }

      localStorage.setItem(STORAGE_KEY_TOKEN, data.token);
      localStorage.setItem(STORAGE_KEY_BASE_URL, url);
      setToken(data.token);
      setView('list');
    } catch (err: any) {
      alert('网络错误：' + (err.message || '无法连接服务器'));
    } finally {
      setLoading(false);
    }
  };

  const handleRelogin = () => {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    resetToLogin();
  };

  const fetchScripts = async (pageNum: number = page) => {
    if (!token) return;
    const url = getBaseUrl();
    setLoading(true);
    try {
      const res = await fetch(
        `${url}/api/scripts/all?status=completed&page=${pageNum}&pageSize=${pageSize}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.status === 401) {
        handleRelogin();
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '获取剧本列表失败');
      }
      const data: ScriptsResponse = await res.json();
      setScripts(data.data || []);
      setTotal(data.total || 0);
      setPage(data.page || pageNum);
    } catch (err: any) {
      alert(err.message || '获取剧本列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'list' && token) {
      fetchScripts(1);
    }
  }, [view, token]);

  const fetchChapters = async (script: ScriptItem) => {
    if (!token) return;
    const url = getBaseUrl();
    setLoading(true);
    try {
      const res = await fetch(`${url}/api/scripts/${script.id}/chapters`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        handleRelogin();
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '获取章节失败');
      }
      const data: ChaptersResponse = await res.json();
      setSelectedScript(script);
      setChapters(data.chapters || []);
      setView('chapters');
    } catch (err: any) {
      alert(err.message || '获取章节失败');
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  if (!isOpen) return null;

  /* ---------- Login View ---------- */
  if (view === 'login') {
    return (
      <div className="fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 select-text">
        <div className="w-full max-w-md bg-slate-600/80 border border-slate-600 p-8 rounded-2xl shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-300">
          <button onClick={onClose} className="p-2 absolute top-4 right-4 text-slate-400 bg-slate-700 hover:bg-slate-800 rounded-full transition-colors cursor-pointer">
            <X className="w-5 h-5 text-slate-500" />
          </button>

          <div className="flex items-center gap-3 mb-8 border-b border-slate-900 pb-6">
            <div className="w-10 h-10 bg-slate-800 text-slate-50 flex items-center justify-center">
              <LogIn className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-50 tracking-wide">剧本服务登录</h1>
            </div>
          </div>

          <div className="space-y-6 max-h-[55vh] overflow-y-auto rounded-lg px-1">
            <div>
              <label className="block text-[12px] font-bold text-slate-500 tracking-widest mb-2">服务地址</label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://127.0.0.1:3000"
                className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-4 py-2.5 text-sm rounded-lg focus:border-slate-500 focus:outline-none transition-all font-mono placeholder:text-slate-400"
              />
              <p className="mt-1.5 text-[12px] text-slate-400 leading-relaxed">剧本编写服务的 API 基础地址</p>
            </div>

            <div>
              <label className="block text-[12px] font-bold text-slate-500 tracking-widest mb-2">用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-4 py-2.5 text-sm rounded-lg focus:border-slate-500 focus:outline-none transition-all placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-[12px] font-bold text-slate-500 tracking-widest mb-2">密码</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-4 py-2.5 pr-10 text-sm rounded-lg focus:border-slate-500 focus:outline-none transition-all placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading || !baseUrl.trim() || !username.trim() || !password.trim()}
            className="w-full mt-7 py-3 bg-slate-800 text-slate-300 font-bold tracking-widest text-xs rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <>
                <span className="animate-spin w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full inline-block" />
                登录中...
              </>
            ) : (
              <>登录 <ArrowRight className="w-3 h-3" /></>
            )}
          </button>

          <div className="flex items-center justify-center gap-2 text-[12px] text-slate-400 font-mono mt-3">
            <Server className="w-3 h-3" />
            Token 仅保存在浏览器本地
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Chapters View ---------- */
  if (view === 'chapters' && selectedScript) {
    return (
      <div className="fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 select-text">
        <div className="w-full max-w-3xl max-h-[85vh] bg-slate-600/80 border border-slate-600 p-8 rounded-2xl shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-300 flex flex-col">
          <button onClick={onClose} className="p-2 absolute top-4 right-4 text-slate-400 bg-slate-700 hover:bg-slate-800 rounded-full transition-colors cursor-pointer z-10">
            <X className="w-5 h-5 text-slate-500" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 border-b border-slate-900 pb-4 shrink-0">
            <button
              onClick={() => { setView('list'); setSelectedScript(null); setChapters([]); }}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 bg-blue-900/40 text-blue-300 flex items-center justify-center shrink-0">
              <BookOpen className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-slate-50 truncate">{selectedScript.topic}</h1>
              <p className="text-xs text-slate-400 truncate">{selectedScript.outline}</p>
            </div>
          </div>

          {/* Chapter list */}
          <div className="flex-1 overflow-y-auto mt-4 space-y-3 pr-1 min-h-0">
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
                <span className="animate-spin w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full inline-block" />
                加载中...
              </div>
            ) : chapters.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                <FileText className="w-10 h-10 opacity-30" />
                <span>暂无章节数据</span>
              </div>
            ) : (
              chapters.map((ch) => (
                <div key={ch.chapter_number} className="bg-slate-800/70 border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 w-7 h-7 rounded-lg bg-blue-900/30 text-blue-300 flex items-center justify-center text-xs font-bold">
                      {ch.chapter_number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-slate-100 mb-1">{ch.chapter_title}</h3>
                      <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 whitespace-pre-wrap">{ch.chapter_content}</p>
                      <p className="text-[11px] text-slate-500 mt-2">{ch.created_at}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- List View (default) ---------- */
  return (
    <div className="fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 select-text">
      <div className="w-full max-w-3xl max-h-[80vh] bg-slate-600/80 border border-slate-600 p-8 rounded-2xl shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-300 flex flex-col">
        <button onClick={onClose} className="p-2 absolute top-4 right-4 text-slate-400 bg-slate-700 hover:bg-slate-800 rounded-full transition-colors cursor-pointer z-10">
          <X className="w-5 h-5 text-slate-500" />
        </button>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-900 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-800 text-slate-50 flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-50 tracking-wide">已完成剧本</h1>
              <p className="text-xs text-slate-400 mt-0.5">共 {total} 条记录</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchScripts(page)}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-700 text-slate-300 text-xs font-medium hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />刷新
            </button>
            <button
              onClick={handleRelogin}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-700 text-slate-300 text-xs font-medium hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />重新登录
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto mt-4 space-y-2.5 pr-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-slate-400">
              <span className="animate-spin w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full inline-block" />
              加载中...
            </div>
          ) : scripts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
              <BookOpen className="w-12 h-12 opacity-25" />
              <span>暂无已完成的剧本</span>
            </div>
          ) : (
            scripts.map((script) => (
              <div
                key={script.id}
                onClick={() => fetchChapters(script)}
                className="bg-slate-800/70 border border-slate-700 rounded-xl p-4 hover:border-slate-500 hover:bg-slate-750 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-slate-100 group-hover:text-white transition-colors truncate">
                      {script.topic}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{script.outline}</p>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />{script.username}</span>
                      <span>{script.created_at}</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 shrink-0 mt-1 transition-colors" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {total > pageSize && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-700 shrink-0">
            <span className="text-xs text-slate-500">
              第 {page}/{totalPages} 页，共 {total} 条
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => { const p = Math.max(1, page - 1); setPage(p); fetchScripts(p); }}
                disabled={page <= 1 || loading}
                className="px-2.5 py-1.5 rounded-lg text-xs text-slate-300 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); fetchScripts(p); }}
                disabled={page >= totalPages || loading}
                className="px-2.5 py-1.5 rounded-lg text-xs text-slate-300 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScriptServiceModal;
