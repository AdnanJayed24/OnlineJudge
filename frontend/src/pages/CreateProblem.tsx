import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

type Difficulty = 'easy' | 'medium' | 'hard';

interface Testcase {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

const SECTION_CLS = 'rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5';
const LABEL_CLS   = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';
const INPUT_CLS   = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
const TEXTAREA_CLS = `${INPUT_CLS} font-mono resize-y`;

function MarkdownField({
  label,
  hint,
  value,
  onChange,
  rows = 5,
  required = false,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  required?: boolean;
}) {
  const [preview, setPreview] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <button
          type="button"
          onClick={() => setPreview((v) => !v)}
          className="text-xs px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          {preview ? 'Edit' : 'Preview'}
        </button>
      </div>
      {hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}
      {preview ? (
        <div className="min-h-[6rem] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 prose prose-sm dark:prose-invert max-w-none">
          {value.trim() ? <ReactMarkdown>{value}</ReactMarkdown> : <span className="text-gray-400 text-sm italic">Nothing to preview.</span>}
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className={TEXTAREA_CLS}
          placeholder="Supports Markdown…"
        />
      )}
    </div>
  );
}

function TestcaseRow({
  tc,
  index,
  onChange,
  onRemove,
}: {
  tc: Testcase;
  index: number;
  onChange: (t: Testcase) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
          Test case {index + 1}
          {tc.isHidden
            ? <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">Hidden</span>
            : <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Sample</span>
          }
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange({ ...tc, isHidden: !tc.isHidden })}
            className="text-[11px] px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {tc.isHidden ? 'Make sample' : 'Make hidden'}
          </button>
          <button type="button" onClick={onRemove} className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
        </div>
      </div>
      <div className="grid grid-cols-2 divide-x divide-gray-200 dark:divide-gray-700">
        <div className="p-3">
          <p className="text-[11px] text-gray-400 mb-1 uppercase tracking-wide font-medium">Input</p>
          <textarea
            value={tc.input}
            onChange={(e) => onChange({ ...tc, input: e.target.value })}
            rows={3}
            className="w-full text-xs font-mono px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="stdin"
          />
        </div>
        <div className="p-3">
          <p className="text-[11px] text-gray-400 mb-1 uppercase tracking-wide font-medium">Expected Output</p>
          <textarea
            value={tc.expectedOutput}
            onChange={(e) => onChange({ ...tc, expectedOutput: e.target.value })}
            rows={3}
            className="w-full text-xs font-mono px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="stdout"
          />
        </div>
      </div>
    </div>
  );
}

export default function CreateProblem() {
  const { user }   = useAuth();
  const navigate   = useNavigate();

  const [title, setTitle]               = useState('');
  const [slug, setSlug]                 = useState('');
  const [difficulty, setDifficulty]     = useState<Difficulty>('medium');
  const [timeLimitMs, setTimeLimitMs]   = useState(2000);
  const [memoryLimitMb, setMemLimitMb]  = useState(256);
  const [tags, setTags]                 = useState('');
  const [statement, setStatement]       = useState('');
  const [inputFormat, setInputFormat]   = useState('');
  const [outputFormat, setOutputFormat] = useState('');
  const [note, setNote]                 = useState('');
  const [testcases, setTestcases]       = useState<Testcase[]>([
    { input: '', expectedOutput: '', isHidden: false },
    { input: '', expectedOutput: '', isHidden: true  },
  ]);
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState('');

  if (!user || user.role !== 'admin') {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <p className="text-gray-500 dark:text-gray-400 text-sm">Admin access required.</p>
      </div>
    );
  }

  function autoSlug(t: string) {
    return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function handleTitleChange(v: string) {
    setTitle(v);
    if (!slug || slug === autoSlug(title)) setSlug(autoSlug(v));
  }

  function addTestcase(hidden: boolean) {
    setTestcases((prev) => [...prev, { input: '', expectedOutput: '', isHidden: hidden }]);
  }

  function updateTestcase(i: number, tc: Testcase) {
    setTestcases((prev) => prev.map((x, j) => j === i ? tc : x));
  }

  function removeTestcase(i: number) {
    setTestcases((prev) => prev.filter((_, j) => j !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!title.trim())     { setError('Title is required.'); return; }
    if (!slug.trim())      { setError('Slug is required.'); return; }
    if (!statement.trim()) { setError('Problem statement is required.'); return; }
    if (testcases.length === 0) { setError('Add at least one test case.'); return; }
    if (testcases.some((t) => !t.input.trim() || !t.expectedOutput.trim())) {
      setError('All test cases must have input and expected output.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post<{ slug: string }>('/problems', {
        title:        title.trim(),
        slug:         slug.trim(),
        statement:    statement.trim(),
        inputFormat:  inputFormat.trim(),
        outputFormat: outputFormat.trim(),
        note:         note.trim(),
        difficulty,
        timeLimitMs:   Number(timeLimitMs),
        memoryLimitMb: Number(memoryLimitMb),
        tags: tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
        testcases,
      });
      navigate(`/problems/${res.data.slug}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      setError(msg ?? 'Something went wrong. Check for duplicate slug.');
    } finally {
      setSubmitting(false);
    }
  }

  const sampleCount = testcases.filter((t) => !t.isHidden).length;
  const hiddenCount = testcases.filter((t) => t.isHidden).length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Create Problem</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Write the statement in Markdown. Sample test cases are shown to users; hidden ones are used for judging.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Basic info ── */}
        <div className={SECTION_CLS}>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Basic Info</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="sm:col-span-2">
              <label className={LABEL_CLS}>Title <span className="text-red-500">*</span></label>
              <input type="text" value={title} onChange={(e) => handleTitleChange(e.target.value)} className={INPUT_CLS} placeholder="e.g. Two Sum" />
            </div>

            <div>
              <label className={LABEL_CLS}>Slug (URL) <span className="text-red-500">*</span></label>
              <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} className={INPUT_CLS} placeholder="e.g. two-sum" />
              <p className="text-xs text-gray-400 mt-1">Used in the URL: /problems/<strong>{slug || 'slug'}</strong></p>
            </div>

            <div>
              <label className={LABEL_CLS}>Difficulty</label>
              <div className="flex gap-2">
                {(['easy','medium','hard'] as Difficulty[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className={`flex-1 py-1.5 rounded-lg text-sm capitalize font-medium border transition-colors ${
                      difficulty === d
                        ? d === 'easy'   ? 'bg-green-500 border-green-500 text-white'
                        : d === 'medium' ? 'bg-yellow-500 border-yellow-500 text-white'
                                         : 'bg-red-500 border-red-500 text-white'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={LABEL_CLS}>Time Limit (ms)</label>
              <input type="number" value={timeLimitMs} onChange={(e) => setTimeLimitMs(Number(e.target.value))} min={100} max={10000} step={100} className={INPUT_CLS} />
            </div>

            <div>
              <label className={LABEL_CLS}>Memory Limit (MB)</label>
              <input type="number" value={memoryLimitMb} onChange={(e) => setMemLimitMb(Number(e.target.value))} min={16} max={1024} step={16} className={INPUT_CLS} />
            </div>

            <div className="sm:col-span-2">
              <label className={LABEL_CLS}>Tags <span className="text-gray-400 font-normal">(comma-separated)</span></label>
              <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} className={INPUT_CLS} placeholder="e.g. array, two pointers, binary search" />
            </div>
          </div>
        </div>

        {/* ── Statement ── */}
        <div className={SECTION_CLS}>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Problem Statement</h2>
          <div className="space-y-4">
            <MarkdownField label="Statement" value={statement} onChange={setStatement} rows={8} required
              hint="Describe the problem. Markdown supported: **bold**, *italic*, `code`, math with $x$, etc." />
            <MarkdownField label="Input Format" value={inputFormat} onChange={setInputFormat} rows={3} />
            <MarkdownField label="Output Format" value={outputFormat} onChange={setOutputFormat} rows={3} />
            <MarkdownField label="Note / Hints" value={note} onChange={setNote} rows={3} hint="Optional. Shown in a highlighted box." />
          </div>
        </div>

        {/* ── Test cases ── */}
        <div className={SECTION_CLS}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Test Cases</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {sampleCount} sample · {hiddenCount} hidden
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => addTestcase(false)} className="text-xs px-3 py-1.5 rounded-lg border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">
                + Sample
              </button>
              <button type="button" onClick={() => addTestcase(true)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                + Hidden
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {testcases.map((tc, i) => (
              <TestcaseRow
                key={i}
                tc={tc}
                index={i}
                onChange={(t) => updateTestcase(i, t)}
                onRemove={() => removeTestcase(i)}
              />
            ))}
          </div>
        </div>

        {/* ── Submit ── */}
        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <button type="button" onClick={() => navigate('/')} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            ← Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {submitting && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            )}
            {submitting ? 'Creating…' : 'Create Problem'}
          </button>
        </div>
      </form>
    </div>
  );
}
