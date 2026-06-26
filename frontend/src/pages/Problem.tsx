import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import api from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useSubmissionSocket } from '../hooks/useSocket';
import VerdictBadge from '../components/VerdictBadge';
import type { Problem, Submission, Language, TestDetail, SampleTestcase } from '../types';

// ── Languages ────────────────────────────────────────────────────────────────
const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'cpp',        label: 'C++ 17'     },
  { value: 'c',          label: 'C'          },
  { value: 'java',       label: 'Java'       },
  { value: 'python',     label: 'Python 3'   },
  { value: 'javascript', label: 'JavaScript' },
];

const STARTER: Record<Language, string> = {
  cpp:        '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    \n    return 0;\n}\n',
  c:          '#include <stdio.h>\n\nint main() {\n    \n    return 0;\n}\n',
  java:       'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        \n    }\n}\n',
  python:     '# Read input\n\n',
  javascript: 'const lines = require("fs").readFileSync("/dev/stdin","utf8").split("\\n");\n\n',
};

const DIFF_COLOR: Record<string, string> = {
  easy:   'text-green-500',
  medium: 'text-yellow-500',
  hard:   'text-red-500',
};

type Panel =
  | { type: 'idle' }
  | { type: 'running' }
  | { type: 'run-result'; stdout: string; stderr: string; exitCode: number }
  | { type: 'judging'; submission: Submission };

type Tab = 'editor' | 'submissions';

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button
      onClick={copy}
      className="text-[10px] px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

// ── Markdown renderer ─────────────────────────────────────────────────────────
function Md({ children }: { children: string }) {
  if (!children?.trim()) return null;
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800 prose-code:text-indigo-600 dark:prose-code:text-indigo-400">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ProblemPage() {
  const { slug }     = useParams<{ slug: string }>();
  const navigate     = useNavigate();
  const { resolved } = useTheme();
  const { user }     = useAuth();

  const [problem, setProblem]             = useState<Problem | null>(null);
  const [lang, setLang]                   = useState<Language>('cpp');
  const [code, setCode]                   = useState(STARTER['cpp']);
  const [tab, setTab]                     = useState<Tab>('editor');
  const [panel, setPanel]                 = useState<Panel>({ type: 'idle' });
  const [stdin, setStdin]                 = useState('');
  const [showStdin, setShowStdin]         = useState(false);
  const [deleting, setDeleting]           = useState(false);
  const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);
  const [loadingSubs, setLoadingSubs]     = useState(false);

  useEffect(() => {
    if (!slug) return;
    api.get<Problem>(`/problems/${slug}`).then((r) => setProblem(r.data)).catch(() => navigate('/'));
  }, [slug, navigate]);

  function handleLangChange(l: Language) {
    setLang(l);
    setCode(STARTER[l]);
  }

  async function handleRun() {
    if (!user) { navigate('/login'); return; }
    setPanel({ type: 'running' });
    try {
      const r = await api.post<{ stdout: string; stderr: string; exitCode: number }>('/run', {
        language: lang, sourceCode: code, stdin,
      });
      setPanel({ type: 'run-result', ...r.data });
    } catch (err: unknown) {
      if ((err as { response?: { status?: number } }).response?.status === 401) { navigate('/login'); return; }
      setPanel({ type: 'run-result', stdout: '', stderr: 'Connection error.', exitCode: 1 });
    }
  }

  async function handleSubmit() {
    if (!user) { navigate('/login'); return; }
    if (!problem) return;
    setPanel({ type: 'running' });
    try {
      const r = await api.post<Submission>('/submissions', {
        problemId: problem.id, language: lang, sourceCode: code,
      });
      setPanel({ type: 'judging', submission: r.data });
    } catch (err: unknown) {
      if ((err as { response?: { status?: number } }).response?.status === 401) { navigate('/login'); return; }
      setPanel({ type: 'idle' });
    }
  }

  const onSocketUpdate = useCallback((sub: Submission) => {
    setPanel((prev) => prev.type === 'judging' ? { type: 'judging', submission: sub } : prev);
  }, []);

  const activeSubId = panel.type === 'judging' ? panel.submission.id : null;
  useSubmissionSocket(activeSubId, onSocketUpdate);

  async function loadSubmissions() {
    if (!problem) return;
    setLoadingSubs(true);
    try {
      const r = await api.get<Submission[]>(`/submissions?problemId=${problem.id}`);
      setMySubmissions(r.data);
    } finally {
      setLoadingSubs(false);
    }
  }

  if (!problem) {
    return <div className="flex items-center justify-center h-[80vh] text-gray-400 text-sm">Loading…</div>;
  }

  const judging  = panel.type === 'judging' ? panel.submission : null;
  const details  = (judging?.result?.detailsJson ?? []) as TestDetail[];
  const samples  = (problem.testcases ?? []) as SampleTestcase[];

  return (
    <div className="h-[calc(100vh-56px)] flex overflow-hidden">

      {/* ── LEFT: Statement ── */}
      <div className="w-[45%] min-w-72 border-r border-gray-200 dark:border-gray-800 overflow-y-auto bg-white dark:bg-gray-950">
        <div className="px-6 py-5">

          {/* Title + limits */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{problem.title}</h1>
            {user?.role === 'admin' && (
              <button
                disabled={deleting}
                onClick={async () => {
                  if (!window.confirm(`Delete "${problem.title}"? This cannot be undone.`)) return;
                  setDeleting(true);
                  try {
                    await api.delete(`/problems/${problem.slug}`);
                    navigate('/');
                  } catch {
                    setDeleting(false);
                  }
                }}
                className="shrink-0 text-xs px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-5">
            <span className={`font-semibold capitalize ${DIFF_COLOR[problem.difficulty] ?? ''}`}>
              {problem.difficulty}
            </span>
            <span>·</span>
            <span>Time limit: <strong>{problem.timeLimitMs / 1000}s</strong></span>
            <span>·</span>
            <span>Memory: <strong>{problem.memoryLimitMb} MB</strong></span>
          </div>

          {/* Tags */}
          {problem.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {problem.tags.map((t) => (
                <span key={t} className="px-2 py-0.5 rounded-full text-[11px] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Statement */}
          {problem.statement && (
            <div className="mb-5">
              <Md>{problem.statement}</Md>
            </div>
          )}

          {/* Input format */}
          {problem.inputFormat && (
            <div className="mb-5">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1.5">Input</h3>
              <Md>{problem.inputFormat}</Md>
            </div>
          )}

          {/* Output format */}
          {problem.outputFormat && (
            <div className="mb-5">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1.5">Output</h3>
              <Md>{problem.outputFormat}</Md>
            </div>
          )}

          {/* Sample test cases */}
          {samples.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">
                Example{samples.length > 1 ? 's' : ''}
              </h3>
              <div className="space-y-4">
                {samples.map((tc, i) => (
                  <div key={tc.id} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="grid grid-cols-2 divide-x divide-gray-200 dark:divide-gray-700">
                      {/* Input */}
                      <div>
                        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            Input {samples.length > 1 ? i + 1 : ''}
                          </span>
                          <CopyBtn text={tc.input} />
                        </div>
                        <pre className="px-3 py-2.5 text-xs font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-all min-h-[2.5rem]">
                          {tc.input}
                        </pre>
                      </div>
                      {/* Output */}
                      <div>
                        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            Output {samples.length > 1 ? i + 1 : ''}
                          </span>
                          <CopyBtn text={tc.expectedOutput} />
                        </div>
                        <pre className="px-3 py-2.5 text-xs font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-all min-h-[2.5rem]">
                          {tc.expectedOutput}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Note */}
          {problem.note && (
            <div className="mb-5 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40">
              <h3 className="text-sm font-bold text-amber-800 dark:text-amber-400 mb-1.5">Note</h3>
              <div className="text-sm text-amber-900 dark:text-amber-300">
                <Md>{problem.note}</Md>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Editor ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-gray-900">

        {/* Tabs */}
        <div className="flex items-center border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4">
          {(['editor', 'submissions'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); if (t === 'submissions') loadSubmissions(); }}
              className={`px-4 py-3 text-sm border-b-2 transition-colors ${
                tab === t
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 font-medium'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t === 'editor' ? 'Code' : 'My Submissions'}
            </button>
          ))}
        </div>

        {tab === 'editor' ? (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
              <select
                value={lang}
                onChange={(e) => handleLangChange(e.target.value as Language)}
                className="text-sm px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>

              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => setShowStdin((v) => !v)}
                  className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  {showStdin ? 'Hide Input' : 'Custom Input'}
                </button>
                <button
                  onClick={handleRun}
                  disabled={panel.type === 'running'}
                  className="text-sm px-4 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  Run
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={panel.type === 'running' || (panel.type === 'judging' && !['ACCEPTED','WRONG_ANSWER','RUNTIME_ERROR','COMPILATION_ERROR','TIME_LIMIT_EXCEEDED'].includes(judging?.status ?? ''))}
                  className="text-sm px-4 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors font-medium"
                >
                  Submit
                </button>
              </div>
            </div>

            {/* Editor */}
            <div className="flex-1 min-h-0">
              <Editor
                height="100%"
                language={lang === 'cpp' ? 'cpp' : lang}
                value={code}
                onChange={(v) => setCode(v ?? '')}
                theme={resolved === 'dark' ? 'vs-dark' : 'light'}
                options={{
                  fontSize: 14,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  lineNumbers: 'on',
                  tabSize: lang === 'python' ? 4 : 2,
                  wordWrap: 'on',
                  padding: { top: 12 },
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  automaticLayout: true,
                }}
              />
            </div>

            {/* Custom stdin */}
            {showStdin && (
              <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Custom Input</p>
                <textarea
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  rows={3}
                  placeholder="Enter stdin for your program…"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            {/* Results */}
            {panel.type !== 'idle' && (
              <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4 max-h-60 overflow-y-auto">
                {panel.type === 'running' && (
                  <div className="flex items-center gap-2 text-sm text-blue-500">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Running…
                  </div>
                )}

                {panel.type === 'run-result' && (
                  <div className="space-y-2">
                    <p className={`text-xs font-semibold ${panel.exitCode === 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {panel.exitCode === 0 ? '✓ Exit 0' : `✗ Exit ${panel.exitCode}`}
                    </p>
                    {panel.stdout && (
                      <pre className="text-xs text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-900 rounded p-3 font-mono whitespace-pre-wrap">{panel.stdout}</pre>
                    )}
                    {panel.stderr && (
                      <pre className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded p-3 font-mono whitespace-pre-wrap">{panel.stderr}</pre>
                    )}
                  </div>
                )}

                {panel.type === 'judging' && judging && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <VerdictBadge verdict={judging.status} size="lg" />
                      {judging.result?.runtimeMs != null && judging.result.runtimeMs > 0 && (
                        <span className="text-sm text-gray-500">{judging.result.runtimeMs} ms</span>
                      )}
                    </div>

                    {details.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {details.map((d) => (
                          <div
                            key={d.index}
                            title={`Test #${d.index}: ${d.status}`}
                            className={`w-6 h-6 rounded flex items-center justify-center text-[10px] text-white font-bold ${
                              d.status === 'PASSED'              ? 'bg-green-500'              :
                              d.status === 'FAILED'              ? 'bg-red-500'                :
                              d.status === 'RUNNING'             ? 'bg-blue-400 animate-pulse' :
                              d.status === 'RUNTIME_ERROR'       ? 'bg-orange-500'             :
                              d.status === 'COMPILATION_ERROR'   ? 'bg-red-700'                :
                              d.status === 'TIME_LIMIT_EXCEEDED' ? 'bg-yellow-500'             :
                              'bg-gray-300 dark:bg-gray-600'
                            }`}
                          >
                            {d.index}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-4">
            {!user ? (
              <p className="text-sm text-gray-400 text-center mt-10">
                <a href="/login" className="text-indigo-500 hover:underline">Sign in</a> to see your submissions.
              </p>
            ) : loadingSubs ? (
              <p className="text-sm text-gray-400 text-center mt-10">Loading…</p>
            ) : mySubmissions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center mt-10">No submissions yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800 uppercase tracking-wide">
                    <th className="pb-2 font-medium">When</th>
                    <th className="pb-2 font-medium">Lang</th>
                    <th className="pb-2 font-medium">Verdict</th>
                    <th className="pb-2 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {mySubmissions.map((s) => (
                    <tr key={s.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                      <td className="py-2.5 text-gray-500 dark:text-gray-400 text-xs">
                        {new Date(s.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2.5 text-gray-700 dark:text-gray-300 uppercase text-xs font-medium">{s.language}</td>
                      <td className="py-2.5"><VerdictBadge verdict={s.status} /></td>
                      <td className="py-2.5 text-gray-500 dark:text-gray-400 text-xs">
                        {s.result?.runtimeMs != null ? `${s.result.runtimeMs}ms` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
