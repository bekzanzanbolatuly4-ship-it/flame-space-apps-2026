import type { SearchResult } from './engine.ts';

/** Deterministic evidence only; never impersonates a provider response. */
export function evidenceFallback(result: SearchResult, reason: string) {
  const records = result.hits.map(hit => hit.record);
  return {
    kind: 'evidence-brief', providerError: reason,
    answer: [
      'Evidence Brief · no AI answer generated.', reason,
      ...(result.coverage === 'insufficient' ? ['The question cannot be fully answered from these records. Related evidence follows.'] : []),
      ...records.map(record => `${record.title}\n${record.finding}\nLimitations: ${record.limitations.join(' ')}`),
      `Evidence gaps: ${result.gaps.join(' ')}`,
    ].join('\n\n'),
    sources: records.map(record => ({ id: record.id, label: `${record.id} · ${record.source.title}`, href: record.source.url, locator: record.source.locator })),
    gaps: result.gaps,
  };
}
