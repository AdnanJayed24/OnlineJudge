const COLORS: Record<string, string> = {
  ACCEPTED:               'bg-green-100  text-green-700  dark:bg-green-900/40  dark:text-green-400',
  WRONG_ANSWER:           'bg-red-100    text-red-700    dark:bg-red-900/40    dark:text-red-400',
  RUNTIME_ERROR:          'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  COMPILATION_ERROR:      'bg-red-100    text-red-700    dark:bg-red-900/40    dark:text-red-400',
  TIME_LIMIT_EXCEEDED:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  MEMORY_LIMIT_EXCEEDED:  'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
  QUEUED:                 'bg-gray-100   text-gray-500   dark:bg-gray-800      dark:text-gray-400',
  RUNNING:                'bg-blue-100   text-blue-700   dark:bg-blue-900/40   dark:text-blue-400',
  PASSED:                 'bg-green-100  text-green-700  dark:bg-green-900/40  dark:text-green-400',
  FAILED:                 'bg-red-100    text-red-700    dark:bg-red-900/40    dark:text-red-400',
};

const LABELS: Record<string, string> = {
  ACCEPTED:               'Accepted',
  WRONG_ANSWER:           'Wrong Answer',
  RUNTIME_ERROR:          'Runtime Error',
  COMPILATION_ERROR:      'Compilation Error',
  TIME_LIMIT_EXCEEDED:    'Time Limit Exceeded',
  MEMORY_LIMIT_EXCEEDED:  'Memory Limit Exceeded',
  QUEUED:                 'Queued',
  RUNNING:                'Running…',
  PASSED:                 'Passed',
  FAILED:                 'Failed',
};

export default function VerdictBadge({ verdict, size = 'sm' }: { verdict: string; size?: 'sm' | 'lg' }) {
  const color = COLORS[verdict] ?? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
  const label = LABELS[verdict] ?? verdict.replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${color} ${size === 'lg' ? 'px-4 py-1.5 text-sm' : 'px-2.5 py-0.5 text-xs'}`}>
      {label}
    </span>
  );
}
