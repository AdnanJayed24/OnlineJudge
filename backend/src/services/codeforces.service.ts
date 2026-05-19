import { prisma } from '../db/prisma';
import { cfAuthGet } from '../lib/cf-session';

const CF_API = 'https://codeforces.com/api';

interface CFProblem {
  contestId:  number;
  index:      string;
  name:       string;
  type:       string;
  rating?:    number;
  tags:       string[];
}

interface CFProblemsetResponse {
  status: string;
  result: { problems: CFProblem[]; problemStatistics: unknown[] };
}

function ratingToDifficulty(rating?: number): string {
  if (!rating) return 'medium';
  if (rating <= 1300) return 'easy';
  if (rating <= 2000) return 'medium';
  return 'hard';
}

function makeSlug(contestId: number, index: string): string {
  return `cf-${contestId}${index.toLowerCase()}`;
}

// Extract the problem-statement div from a CF HTML page
function extractProblemStatement(html: string): string {
  // Flexible search: handles attribute order variations like <div id="..." class="problem-statement">
  const classSearch = 'class="problem-statement"';
  const classIdx = html.indexOf(classSearch);
  if (classIdx === -1) return '';

  // Walk backward to find the opening <
  let divStart = classIdx;
  while (divStart > 0 && html[divStart] !== '<') divStart--;

  // Depth-count from the opening tag to find the matching </div>
  let depth = 0;
  let i = divStart;
  while (i < html.length) {
    if (html[i] === '<') {
      if (html.startsWith('<div', i) && /[\s>]/.test(html[i + 4] ?? '')) {
        depth++;
        i += 4;
        continue;
      }
      if (html.startsWith('</div>', i)) {
        depth--;
        if (depth === 0) {
          let out = html.slice(divStart, i + 6);
          // Rewrite relative CF image/resource paths to absolute URLs
          out = out.replace(/src="\/predownloaded\//g, 'src="https://codeforces.com/predownloaded/');
          out = out.replace(/src="\/espresso\//g,      'src="https://codeforces.com/espresso/');
          out = out.replace(/src="\/[^"]*\.(png|jpg|gif|svg)"/g,
            (m) => m.replace('src="/', 'src="https://codeforces.com/'));
          return out;
        }
        i += 6;
        continue;
      }
    }
    i++;
  }
  return '';
}

// Fetch the problem statement HTML using the authenticated CF session (bypasses Cloudflare)
export async function fetchCFStatementHtml(contestId: number, index: string): Promise<string> {
  const paths = [
    `/contest/${contestId}/problem/${index}`,
    `/problemset/problem/${contestId}/${index}`,
  ];

  for (const path of paths) {
    try {
      const html = await cfAuthGet(path);
      // If CF returned a login/challenge page instead of the problem, skip
      if (html.includes('handle-or-email') || html.includes('cf-turnstile') || !html.includes('problem-statement')) {
        continue;
      }
      const extracted = extractProblemStatement(html);
      if (extracted) return extracted;
    } catch {
      continue;
    }
  }

  return ''; // caller decides what to do on failure
}

function makePlaceholder(contestId: number, index: string, rating?: number): string {
  const url = `https://codeforces.com/contest/${contestId}/problem/${index}`;
  return [
    `<p><strong>Source:</strong> Codeforces — Problem ${contestId}${index}</p>`,
    rating ? `<p><strong>Rating:</strong> ${rating}</p>` : '',
    `<p>View the full problem statement on Codeforces: <a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></p>`,
  ].filter(Boolean).join('\n');
}

export interface SyncResult {
  synced:   number;
  skipped:  number;
  problems: { title: string; slug: string; difficulty: string }[];
}

// Fetch and upsert a single CF problem by contestId + index
export async function syncCFProblem(contestId: number, index: string): Promise<{ slug: string; title: string; difficulty: string }> {
  const res  = await fetch(`${CF_API}/problemset.problems`);
  const data = (await res.json()) as CFProblemsetResponse;
  if (data.status !== 'OK') throw new Error(`CF API error: ${JSON.stringify(data)}`);

  const cfProblem = data.result.problems.find(
    (p) => p.contestId === contestId && p.index.toUpperCase() === index.toUpperCase() && p.type === 'PROGRAMMING',
  );
  if (!cfProblem) throw new Error(`Problem ${contestId}${index} not found on Codeforces`);

  const slug       = makeSlug(contestId, index);
  const difficulty = ratingToDifficulty(cfProblem.rating);
  const statement  = await fetchCFStatementHtml(contestId, index);
  const externalUrl = `https://codeforces.com/contest/${contestId}/problem/${index}`;

  await prisma.problem.upsert({
    where:  { slug },
    update: { title: cfProblem.name, difficulty, tags: cfProblem.tags, statement, rating: cfProblem.rating ?? null, externalUrl },
    create: {
      slug,
      title:        cfProblem.name,
      statement,
      difficulty,
      tags:         cfProblem.tags,
      source:       'codeforces',
      cfContestId:  contestId,
      cfIndex:      index.toUpperCase(),
      rating:       cfProblem.rating ?? null,
      externalUrl,
    },
  });

  return { slug, title: cfProblem.name, difficulty };
}

export async function syncByContest(contestId: number): Promise<SyncResult> {
  const res  = await fetch(`${CF_API}/problemset.problems`);
  const data = (await res.json()) as CFProblemsetResponse;
  if (data.status !== 'OK') throw new Error(`CF API error: ${JSON.stringify(data)}`);

  const problems = data.result.problems.filter(
    (p) => p.contestId === contestId && p.type === 'PROGRAMMING',
  );
  if (problems.length === 0) throw new Error(`No problems found for contest ${contestId}`);

  return upsertProblems(problems);
}

export async function syncByProblemset(opts: {
  tags?:      string[];
  minRating?: number;
  maxRating?: number;
  limit?:     number;
}): Promise<SyncResult> {
  const params = new URLSearchParams();
  if (opts.tags?.length) params.set('tags', opts.tags.join(';'));

  const res  = await fetch(`${CF_API}/problemset.problems?${params}`);
  const data = (await res.json()) as CFProblemsetResponse;
  if (data.status !== 'OK') throw new Error(`CF API error: ${JSON.stringify(data)}`);

  let problems = data.result.problems.filter((p) => p.type === 'PROGRAMMING');
  if (opts.minRating) problems = problems.filter((p) => p.rating != null && p.rating >= opts.minRating!);
  if (opts.maxRating) problems = problems.filter((p) => p.rating != null && p.rating <= opts.maxRating!);

  const limit = Math.min(opts.limit ?? 50, 200);
  return upsertProblems(problems.slice(0, limit));
}

async function upsertProblems(cfProblems: CFProblem[]): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, skipped: 0, problems: [] };

  for (const p of cfProblems) {
    if (!p.contestId || !p.index || !p.name) { result.skipped++; continue; }

    const slug        = makeSlug(p.contestId, p.index);
    const difficulty  = ratingToDifficulty(p.rating);
    const externalUrl = `https://codeforces.com/contest/${p.contestId}/problem/${p.index}`;
    const statement   = makePlaceholder(p.contestId, p.index, p.rating);

    await prisma.problem.upsert({
      where:  { slug },
      update: { title: p.name, difficulty, tags: p.tags, rating: p.rating ?? null, externalUrl },
      create: {
        slug,
        title:       p.name,
        statement,
        difficulty,
        tags:        p.tags,
        source:      'codeforces',
        cfContestId: p.contestId,
        cfIndex:     p.index,
        rating:      p.rating ?? null,
        externalUrl,
      },
    });

    result.synced++;
    result.problems.push({ title: p.name, slug, difficulty });
  }

  return result;
}
