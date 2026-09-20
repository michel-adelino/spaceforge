// Fills in your GitHub details (README links, LICENSE holder, landing-page footer).
//
//   node scripts/set-github.mjs <github-username> "<Your Name>" [repo-name]
//
// Example: node scripts/set-github.mjs ivan-petrov "Ivan Petrov" spaceforge
import fs from 'node:fs';

const [user, name = user, repo = 'spaceforge'] = process.argv.slice(2);
if (!user) {
  console.error('Usage: node scripts/set-github.mjs <github-username> "<Your Name>" [repo-name]');
  process.exit(1);
}

const edit = (file, change) => {
  const before = fs.readFileSync(file, 'utf8');
  const after = change(before);
  fs.writeFileSync(file, after);
  console.log(`${before === after ? 'unchanged' : 'updated  '} ${file}`);
};

edit('README.md', (s) => s.replaceAll('YOUR_USERNAME', user).replaceAll('YOUR_REPO', repo));
edit('LICENSE', (s) => s.replaceAll('YOUR NAME', name));
edit('src/ui/siteConfig.ts', (s) =>
  s
    .replace(/repoUrl: '[^']*'/, `repoUrl: 'https://github.com/${user}/${repo}'`)
    .replace(/author: '[^']*'/, `author: '${name.replace(/'/g, "\\'")}'`),
);

console.log(`\nLive demo will be at https://${user}.github.io/${repo}/ once GitHub Pages is enabled.`);
