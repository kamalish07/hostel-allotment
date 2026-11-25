// Builds the site and publishes it to the gh-pages branch, which GitHub Pages serves.
// Usage: npm run deploy
import { execSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: 'inherit' });

const remote = execSync('git remote get-url origin', { cwd: root }).toString().trim();
run('npx vite build --base=./');
writeFileSync(join(dist, '.nojekyll'), ''); // serve files as they are

rmSync(join(dist, '.git'), { recursive: true, force: true });
run('git init -q -b gh-pages', dist);
run('git add -A', dist);
run('git commit -q -m "Deploy site" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"', dist);
run(`git push -q -f ${remote} gh-pages`, dist);
rmSync(join(dist, '.git'), { recursive: true, force: true });
console.log('Deployed to the gh-pages branch.');
