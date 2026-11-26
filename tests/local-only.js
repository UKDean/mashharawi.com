/* Folders that exist only on a developer's machine, never in the published site.
   Not a test file itself.

   The tests walk the repository folder on disk, so on a working machine they
   would also read Claude Code worktrees and preserved session files, the site
   team's private notes, research reports and a local Python environment. All of
   them are git-ignored, so GitHub Actions and Cloudflare Pages never see them;
   locally they hold old copies of pages and quotes of withdrawn wording, which
   made the suite fail on a clean, correct site.

   Paths are relative to the repository root and match that exact folder only,
   so a site folder with the same name deeper in the tree is still tested. */
'use strict';
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

const LOCAL_ONLY = new Set([
  '.claude',                    // Claude Code worktrees, preserved session files
  '.site-team',                 // site team plans, logs and charter (.gitignore)
  'research/seo-intelligence',  // SEO research reports (.gitignore)
  '.venv',                      // local Python environment (.gitignore)
  'Claude outputs',             // local drafts and exports
  '_proto',                     // local design prototypes (.git/info/exclude)
]);

/* true when an absolute folder path is one of the local-only folders */
function isLocalOnly(absDir) {
  return LOCAL_ONLY.has(path.relative(ROOT, absDir).split(path.sep).join('/'));
}

module.exports = { LOCAL_ONLY, isLocalOnly };
