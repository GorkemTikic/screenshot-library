import test from 'node:test';
import assert from 'node:assert/strict';
import { beginCopyRun, commitCopyOutcome, invalidateCopyRun } from '../src/domain/copyRun.js';

test('changing items aborts the old run and prevents stale reporting', () => {
  const oldRun = beginCopyRun(null, 'old-item');
  const activeRun = beginCopyRun(oldRun, 'new-item');
  let presentations = 0;
  let reports = 0;

  const committed = commitCopyOutcome(oldRun, activeRun, 'old-item', {
    present: () => { presentations += 1; },
    report: () => { reports += 1; },
  });

  assert.equal(oldRun.controller.signal.aborted, true);
  assert.equal(committed, false);
  assert.equal(presentations, 0);
  assert.equal(reports, 0);
});

test('visible outcome commits even when synchronous reporting fails', () => {
  const activeRun = beginCopyRun(null, 'current-item');
  let visibleState = 'pending';

  assert.doesNotThrow(() => {
    commitCopyOutcome(activeRun, activeRun, 'current-item', {
      present: () => { visibleState = 'success'; },
      report: () => { throw new Error('analytics unavailable'); },
    });
  });
  assert.equal(visibleState, 'success');

  invalidateCopyRun(activeRun);
  assert.equal(activeRun.controller.signal.aborted, true);
});
