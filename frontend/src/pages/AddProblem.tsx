import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

type Platform = 'codeforces' | 'leetcode';

const PLATFORM_INFO = {
  codeforces: {
    label: 'Codeforces',
    short: 'CF',
    cls: 'bg-blue-600',
    placeholder: 'e.g. 1A, 1234B1',
    hint: 'Contest ID + Problem Index, e.g. "1A" (contest 1, problem A) or "1234B1"',
  },
  leetcode: {
    label: 'LeetCode',
    short: 'LC',
    cls: 'bg-orange-500',
    placeholder: 'e.g. two-sum or 1',
    hint: 'Problem slug (e.g. "two-sum") or problem number (e.g. "1")',
  },
} as const;

export default function AddProblem() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [platform, setPlatform] = useState<Platform>('codeforces');
  const [problemId, setProblemId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ slug: string; title: string } | null>(null);

  if (!user || user.role !== 'admin') {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <p className="text-gray-500 dark:text-gray-400 text-sm">Admin access required.</p>
        <Link to="/" className="text-indigo-500 hover:underline text-sm mt-2 inline-block">Back to problems</Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(null);

    const id = problemId.trim();
    if (!id) { setError('Problem ID is required.'); return; }

    setLoading(true);
    try {
      const res = await api.post<{ slug: string; title: string; difficulty: string }>('/problems/fetch', {
        platform,
        problemId: id,
      });
      setSuccess({ slug: res.data.slug, title: res.data.title });
      setProblemId('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      setError(msg ?? 'Failed to fetch problem. Check the ID and try again.');
    } finally {
      setLoading(false);
    }
  }

  const info = PLATFORM_INFO[platform];

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="mb-6">
        <Link to="/" className="text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to problems
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">Add Problem</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
        Fetch a problem from an external judge and add it to the problem set.
      </p>

      {/* Platform selector */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {(Object.keys(PLATFORM_INFO) as Platform[]).map((p) => {
          const inf = PLATFORM_INFO[p];
          return (
            <button
              key={p}
              type="button"
              onClick={() => { setPlatform(p); setProblemId(''); setError(''); setSuccess(null); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-colors ${
                platform === p
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold text-white uppercase ${inf.cls}`}>
                {inf.short}
              </span>
              <span className={`text-sm font-medium ${platform === p ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'}`}>
                {inf.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Problem ID
          </label>
          <input
            type="text"
            value={problemId}
            onChange={(e) => setProblemId(e.target.value)}
            placeholder={info.placeholder}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{info.hint}</p>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="px-4 py-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm flex items-center justify-between">
            <span>
              Added: <strong>{success.title}</strong>
            </span>
            <button
              type="button"
              onClick={() => navigate(`/problems/${success.slug}`)}
              className="ml-3 text-green-700 dark:text-green-300 underline text-xs"
            >
              View →
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !problemId.trim()}
          className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Fetching…
            </>
          ) : (
            'Fetch & Add Problem'
          )}
        </button>
      </form>

      {/* Quick examples */}
      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">Quick examples</p>
        <div className="flex flex-wrap gap-2">
          {platform === 'codeforces' ? (
            ['1A', '1234B', '1900C', '2000D2'].map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setProblemId(ex)}
                className="px-3 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-mono"
              >
                {ex}
              </button>
            ))
          ) : (
            ['two-sum', 'add-two-numbers', 'longest-substring-without-repeating-characters', '1'].map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setProblemId(ex)}
                className="px-3 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                {ex}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
