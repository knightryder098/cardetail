import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function validateSource({ branch, commit, gitCommit, dirty }) {
 if (branch !== 'master') throw new Error('Production builds and deployments are allowed only from master.');
 if (!/^[a-f0-9]{40}$/i.test(commit) || commit !== gitCommit) throw new Error('Release commit does not match the checked-out source.');
 if (dirty) throw new Error('Commit source changes to master before building a production release.');
 return { branch, commit };
}
function source() {
 const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
 const gitCommit = git('rev-parse', 'HEAD');
 return validateSource({ branch: process.env.WORKERS_CI_BRANCH || git('branch', '--show-current'), commit: process.env.WORKERS_CI_COMMIT_SHA || gitCommit, gitCommit, dirty: !!git('status', '--porcelain', '--untracked-files=all') });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
 const current = source();
 const manifest = '.open-next/balaji-release.json';
 if (process.argv[2] === 'record') fs.writeFileSync(manifest, JSON.stringify(current));
 if (process.argv[2] === 'deploy') {
  const built = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  if (built.branch !== current.branch || built.commit !== current.commit) throw new Error('Rebuild the Worker from the current master commit before deploying.');
 }
 console.log(`Production source verified: ${current.branch} ${current.commit.slice(0, 8)}`);
}
