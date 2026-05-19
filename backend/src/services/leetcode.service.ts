import { prisma } from '../db/prisma';

const LC_GRAPHQL = 'https://leetcode.com/graphql';

interface LCQuestion {
  questionFrontendId: string;
  title: string;
  titleSlug: string;
  difficulty: string;
  content: string;
  topicTags: { name: string; slug: string }[];
}

const QUERY = `
query q($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionFrontendId title titleSlug difficulty content
    topicTags { name slug }
  }
}`;

function lcDiff(d: string): string {
  if (d.toLowerCase() === 'easy') return 'easy';
  if (d.toLowerCase() === 'hard') return 'hard';
  return 'medium';
}

export async function syncLCProblem(titleSlug: string) {
  const res = await fetch(LC_GRAPHQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Referer': 'https://leetcode.com',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    body: JSON.stringify({ query: QUERY, variables: { titleSlug } }),
  });

  if (!res.ok) throw new Error(`LeetCode API error: ${res.status}`);

  const data = (await res.json()) as { data?: { question?: LCQuestion } };
  const q = data.data?.question;
  if (!q || !q.content) throw new Error(`Problem not found on LeetCode: ${titleSlug}`);

  const slug = `lc-${q.questionFrontendId}`;
  const difficulty = lcDiff(q.difficulty);
  const tags = q.topicTags.map((t) => t.name);
  const externalUrl = `https://leetcode.com/problems/${q.titleSlug}/`;
  const frontendId = parseInt(q.questionFrontendId, 10);

  await prisma.problem.upsert({
    where: { slug },
    update: { title: q.title, difficulty, tags, statement: q.content, externalUrl },
    create: {
      slug,
      title: q.title,
      statement: q.content,
      difficulty,
      tags,
      source: 'leetcode',
      externalUrl,
      lcSlug: q.titleSlug,
      lcFrontendId: frontendId,
    },
  });

  return { slug, title: q.title, difficulty, frontendId };
}

// Resolve LC problem by number (e.g. "1") to titleSlug then fetch
export async function syncLCProblemById(id: number) {
  // Use the problems API to find the slug
  const res = await fetch(`https://leetcode.com/api/problems/all/`, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Referer': 'https://leetcode.com',
    },
  });
  if (!res.ok) throw new Error('Failed to fetch LeetCode problem list');
  const data = (await res.json()) as { stat_status_pairs: { stat: { question_id: number; question__title_slug: string } }[] };
  const pair = data.stat_status_pairs.find((p) => p.stat.question_id === id);
  if (!pair) throw new Error(`LeetCode problem #${id} not found`);
  return syncLCProblem(pair.stat.question__title_slug);
}
