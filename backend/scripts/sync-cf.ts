import 'dotenv/config';
import { syncByProblemset, syncByContest } from '../src/services/codeforces.service';

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === 'contest') {
    const contestId = Number(args[1]);
    if (!contestId) { console.error('Usage: sync-cf contest <contestId>'); process.exit(1); }
    console.log(`Syncing contest ${contestId}…`);
    const result = await syncByContest(contestId);
    console.log(`Done: ${result.synced} synced, ${result.skipped} skipped`);
    result.problems.forEach((p) => console.log(`  [${p.difficulty}] ${p.title} → ${p.slug}`));
  } else {
    const minRating = Number(args[0]) || 800;
    const maxRating = Number(args[1]) || 1600;
    const limit     = Number(args[2]) || 30;
    console.log(`Syncing problemset rating=${minRating}-${maxRating} limit=${limit}…`);
    const result = await syncByProblemset({ minRating, maxRating, limit });
    console.log(`Done: ${result.synced} synced, ${result.skipped} skipped`);
    result.problems.forEach((p) => console.log(`  [${p.difficulty}] ${p.title} → ${p.slug}`));
  }
}

main().catch(console.error);
