// Merge-safety rehearsal: proves the fork still merges cleanly with upstream.
// Creates a disposable DETACHED-HEAD worktree (so it never fights the branch
// checked out here), attempts a no-commit merge of upstream/main, and fails on
// conflict. If upstream is unreachable/unresolvable, it SKIPS (never a false
// CI failure when offline). Never touches the real working tree.
// Run: node test/listing-agent-merge-rehearsal.test.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const UPSTREAM_REF = process.env.LISTING_AGENT_UPSTREAM_REF || 'upstream/main';

function git(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}
function gitQuiet(args) {
  try {
    return { ok: true, out: git(args) };
  } catch (e) {
    return { ok: false, out: (e.stdout || '') + (e.stderr || ''), status: e.status };
  }
}

let failed = 0;
function fail(msg) {
  failed++;
  console.error('✗ ' + msg);
}
function pass(msg) {
  console.log('✓ ' + msg);
}

// Best-effort fetch; offline is fine as long as a local remote-tracking ref exists.
const fetched = gitQuiet(['fetch', '--quiet', 'upstream', 'main']);
if (!fetched.ok) {
  console.warn('  (warning) could not fetch upstream/main; will use local remote-tracking ref if present');
}

const head = gitQuiet(['rev-parse', 'HEAD']);
if (!head.ok) {
  fail('cannot resolve HEAD');
  console.log('\n1 failed');
  process.exit(1);
}

const upstream = gitQuiet(['rev-parse', '--verify', UPSTREAM_REF]);
if (!upstream.ok) {
  console.warn(`  (skip) ${UPSTREAM_REF} not available; merge rehearsal skipped`);
  console.log('\n0 failed (skipped)');
  process.exit(0);
}

const dir = mkdtempSync(path.join(os.tmpdir(), 'la-merge-'));
let added = false;
try {
  git(['worktree', 'add', '--detach', dir, head.out]);
  added = true;
  // May leave staged changes (clean) or unmerged paths (conflict).
  gitQuiet(['-C', dir, 'merge', '--no-commit', '--no-ff', UPSTREAM_REF]);
  const conflicts = gitQuiet(['-C', dir, 'ls-files', '-u']);
  const hasConflict = conflicts.ok && conflicts.out.trim().length > 0;
  // Always unwind the in-progress merge before removing the worktree.
  gitQuiet(['-C', dir, 'merge', '--abort']);
  gitQuiet(['-C', dir, 'reset', '--hard']);
  if (hasConflict) {
    fail(`merge with ${UPSTREAM_REF} conflicts (unmerged paths):\n${conflicts.out}`);
  } else {
    pass(`merges cleanly with ${UPSTREAM_REF}`);
  }
} catch (e) {
  fail(`merge rehearsal error: ${e && e.message ? e.message : e}`);
} finally {
  if (added) gitQuiet(['worktree', 'remove', '--force', dir]);
  else rmSync(dir, { recursive: true, force: true });
  gitQuiet(['worktree', 'prune']);
}

console.log(`\n${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
