import { expect, it } from 'vitest';
import { validateSource } from '../scripts/check-release-source.mjs';
const commit = 'a'.repeat(40);
it('rejects deployment from another branch even with a valid commit', () => {
 expect(() => validateSource({ branch: 'dev', commit, gitCommit: commit, dirty: false })).toThrow(/only from master/);
});
it('rejects a source revision that differs from the build event', () => {
 expect(() => validateSource({ branch: 'master', commit, gitCommit: 'b'.repeat(40), dirty: false })).toThrow(/does not match/);
});
it('rejects uncommitted release source and accepts clean master', () => {
 expect(() => validateSource({ branch: 'master', commit, gitCommit: commit, dirty: true })).toThrow(/Commit source changes/);
 expect(validateSource({ branch: 'master', commit, gitCommit: commit, dirty: false })).toEqual({ branch: 'master', commit });
});
