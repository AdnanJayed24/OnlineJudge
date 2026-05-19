import { useTheme } from '../context/ThemeContext';

const options = [
  { value: 'light',  label: '☀ Light'  },
  { value: 'dark',   label: '◑ Dark'   },
  { value: 'system', label: '⊙ System' },
] as const;

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 text-xs">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => setTheme(o.value)}
          className={`px-3 py-1.5 transition-colors ${
            theme === o.value
              ? 'bg-indigo-600 text-white'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
