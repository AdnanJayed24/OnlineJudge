import { env } from '../config/env';

export const SUPPORTED_LANGUAGES = ['python', 'cpp', 'c', 'java', 'javascript'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const PISTON_MAP: Record<Language, { language: string; version: string; filename: string }> = {
  python:     { language: 'python',     version: '*', filename: 'main.py'   },
  cpp:        { language: 'c++',        version: '*', filename: 'main.cpp'  },
  c:          { language: 'c',          version: '*', filename: 'main.c'    },
  java:       { language: 'java',       version: '*', filename: 'Main.java' },
  javascript: { language: 'javascript', version: '*', filename: 'main.js'   },
};

export interface PistonResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  compilationError: boolean;
  timedOut: boolean;
}

export async function pistonRun(
  language: Language,
  sourceCode: string,
  stdin: string,
  timeLimitMs = 5000,
): Promise<PistonResult> {
  const map = PISTON_MAP[language];

  const res = await fetch(`${env.PISTON_URL}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: map.language,
      version: map.version,
      files: [{ name: map.filename, content: sourceCode }],
      stdin,
      run_timeout: timeLimitMs,
    }),
  });

  if (!res.ok) throw new Error(`Piston API error: ${res.status}`);

  const data = (await res.json()) as {
    run: { stdout: string; stderr: string; code: number | null; signal: string | null };
    compile?: { stdout: string; stderr: string; code: number | null };
  };

  const compileError = !!data.compile && (data.compile.code ?? 0) !== 0;
  const timedOut = !compileError && data.run?.signal === 'SIGKILL' && data.run?.code === null;

  return {
    stdout:           data.run?.stdout ?? '',
    stderr:           compileError ? (data.compile?.stderr ?? '') : (data.run?.stderr ?? ''),
    exitCode:         data.run?.code ?? 1,
    compilationError: compileError,
    timedOut,
  };
}
