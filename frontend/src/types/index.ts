export interface User {
  id: number;
  email: string;
  username: string;
  role: string;
}

export interface SampleTestcase {
  id: number;
  input: string;
  expectedOutput: string;
}

export interface Problem {
  id: number;
  title: string;
  slug: string;
  statement: string;
  inputFormat: string;
  outputFormat: string;
  note: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  source: string;
  cfContestId?: number;
  cfIndex?: string;
  rating?: number;
  externalUrl?: string;
  lcFrontendId?: number;
  timeLimitMs: number;
  memoryLimitMb: number;
  solved?: boolean;
  testcases?: SampleTestcase[];
  _count?: { submissions: number };
}

export interface TestDetail {
  index: number;
  status: 'QUEUED' | 'RUNNING' | 'PASSED' | 'FAILED' | 'RUNTIME_ERROR' | 'COMPILATION_ERROR';
}

export interface SubmissionResult {
  verdict: string;
  runtimeMs: number | null;
  detailsJson: TestDetail[] | null;
}

export interface Submission {
  id: number;
  userId: number;
  problemId: number;
  language: string;
  sourceCode: string;
  status: string;
  createdAt: string;
  result: SubmissionResult | null;
  problem?: { title: string; slug: string };
}

export type Language = 'python' | 'cpp' | 'c' | 'java' | 'javascript';
