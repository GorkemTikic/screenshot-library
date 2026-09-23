export type TopicRecord = Record<string, unknown> & { topic?: unknown };
export type TopicMeta = { icon: string; tone: string };
export const TOPIC_META: Record<string, TopicMeta>;
export function topicKey(value: unknown): string;
export function getTopics(items?: TopicRecord[]): string[];
export function resolveTopic(value: unknown, items?: TopicRecord[]): string;
export function validateTopic(value: unknown): string;
export function topicMeta(value: unknown): TopicMeta;
