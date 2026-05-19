import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import type { Problem } from '../types';

const DIFF_COLOR: Record<string, string> = {
  easy:   'text-green-500',
  medium: 'text-yellow-500',
  hard:   'text-red-500',
};

const DIFF_FILTERS = ['all', 'easy', 'medium', 'hard'] as const;
type DiffFilter = (typeof DIFF_FILTERS)[number];

export default function Home() {
  const [problems, setProblems]     = useState<Problem[]>([]);
  const [diff, setDiff]             = useState<DiffFilter>('all');
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(true);
  const debounce                    = useRef<ReturnType<typeof setTimeout> | null>(null);

  function load(q: string) {
    setLoading(true);
    const params = new URLSearchParams({ source: 'local' });
    if (q.trim()) params.set('q', q.trim());
    api.get<Problem[]>(`/problems?${params}`)
      .then((r) => setProblems(r.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(''); }, []);

  function handleSearch(v: string) {
    setSearch(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load(v), 350);
  }

  const visible = diff === 'all' ? problems : problems.filter((p) => p.difficulty === diff);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mr-auto">Problems</h1>

        {/* Difficulty filter */}
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-sm">
          {DIFF_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setDiff(f)}
              className={`px-3 py-1.5 capitalize transition-colors ${
                diff === f
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search…"
            className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44"
          />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
        {loading ? (
          <div className="py-20 text-center text-gray-400 text-sm">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-gray-400 text-sm mb-3">No problems yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide text-left">
                <th className="px-5 py-3 font-medium w-12">#</th>
                <th className="px-5 py-3 font-medium">Title</th>
                <th className="px-5 py-3 font-medium">Difficulty</th>
                <th className="px-5 py-3 font-medium hidden sm:table-cell">Tags</th>
                <th className="px-5 py-3 font-medium text-center w-20">Solved</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p, i) => (
                <tr
                  key={p.id}
                  className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <td className="px-5 py-3.5 text-gray-400 text-xs">{i + 1}</td>

                  <td className="px-5 py-3.5">
                    <Link
                      to={`/problems/${p.slug}`}
                      className="font-medium text-gray-900 dark:text-gray-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    >
                      {p.title}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                      <span>{p.timeLimitMs / 1000}s</span>
                      <span>·</span>
                      <span>{p.memoryLimitMb}MB</span>
                    </div>
                  </td>

                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-semibold capitalize ${DIFF_COLOR[p.difficulty] ?? 'text-gray-500'}`}>
                      {p.difficulty}
                    </span>
                  </td>

                  <td className="px-5 py-3.5 hidden sm:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {p.tags.slice(0, 4).map((t) => (
                        <span key={t} className="px-1.5 py-0.5 rounded text-[11px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                          {t}
                        </span>
                      ))}
                      {p.tags.length > 4 && (
                        <span className="px-1.5 py-0.5 rounded text-[11px] bg-gray-100 dark:bg-gray-800 text-gray-500">
                          +{p.tags.length - 4}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-5 py-3.5 text-center">
                    {p.solved ? (
                      <svg className="w-4 h-4 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-gray-300 dark:text-gray-700">–</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-3 text-right">
        {visible.length} problem{visible.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
