import test from 'node:test';
import assert from 'node:assert/strict';
import { getTopics, resolveTopic, topicKey, topicMeta, validateTopic, TOPIC_META } from '../src/domain/topics.js';
import { filterCatalog, topicCounts } from '../src/domain/catalog.js';

test('topic options retain built-ins and include distinct custom topics, including archived names for reuse', () => {
    assert.deepEqual(getTopics([{ topic: 'Spot Trading' }, { topic: ' spot  trading ' }, { topic: 'loan' }, { topic: 'Earn', archivedAt: 'yesterday' }]), [...Object.keys(TOPIC_META), 'Earn', 'Spot Trading']);
});

test('topic names reuse canonical spelling across whitespace, case and Unicode width', () => {
    const items = [{ topic: 'Spot Trading' }];
    assert.equal(resolveTopic('  spot   TRADING  ', items), 'Spot Trading');
    assert.equal(resolveTopic(' loan ', items), 'LOAN');
    assert.equal(resolveTopic('  New   Topic  ', items), 'New Topic');
    assert.equal(topicKey('Ｓｐｏｔ Trading'), topicKey('spot trading'));
    assert.equal(resolveTopic('资金费用', items), '资金费用');
});

test('new topics require a usable name and reject the reserved All filter', () => {
    assert.ok(validateTopic('   '));
    assert.ok(validateTopic(' ALL '));
    assert.ok(validateTopic('x'.repeat(81)));
    assert.equal(validateTopic('Spot Trading'), '');
});

test('custom topic counts and filters agree, with archived and platform filtering preserved', () => {
    const items = [{ id: 1, topic: 'Spot Trading' }, { id: 2, topic: ' spot  trading ' }, { id: 3, topic: 'Spot Trading', platform: 'web' }, { id: 4, topic: 'Spot Trading', archivedAt: 'yesterday' }];
    assert.deepEqual(topicCounts(items), { 'Spot Trading': 2 });
    assert.deepEqual(filterCatalog(items, { topic: 'Spot Trading' }).map((item) => item.id), [2, 1]);
    assert.deepEqual(topicCounts(items, 'web'), { 'Spot Trading': 1 });
});

test('unknown topics get a safe default icon, including names matching Object properties', () => {
    assert.equal(topicMeta('Spot Trading'), TOPIC_META.General);
    assert.equal(topicMeta('__proto__'), TOPIC_META.General);
    assert.equal(topicMeta('constructor'), TOPIC_META.General);
    assert.equal(topicMeta('loan'), TOPIC_META.LOAN);
    assert.deepEqual(topicCounts([{ topic: '__proto__' }, { topic: '__proto__' }]), { ['__proto__']: 2 });
});
