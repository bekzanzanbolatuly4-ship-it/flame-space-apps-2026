import { flexTestRecords, flexTestSource } from './flex-test-data.ts';
import { evidenceSchema, type Evidence } from './schema.ts';

/** Read-only projection: the typed Data Lab remains the sole measurement store. */
export function retrieveIndividualTests(query: string): Evidence[] {
  const ids: string[] = query.toUpperCase().match(/\bFLEX-\d{3}\b/g) ?? [];
  const rows = flexTestRecords.filter(row => ids.includes(row.testId) || query.toUpperCase().includes(row.flexIdentifier));
  return rows.map(row => {
    const fields = [
      ['Initial droplet diameter', row.initialDropletDiameter],
      ['Visible-flame extinction diameter', row.visibleFlameExtinctionDiameter],
      ['Fitted average burning-rate constant', row.averageBurningRateConstant],
      ['Recorded burning duration', row.burnTime],
    ] as const;
    const finding = fields.map(([label, value]) => `${label}: ${value ? `${value.value} ${value.unit}` : 'not reported (source dash; no value inferred)'}.`).join(' ');
    const conditions = [
      { label: 'Test', value: `${row.testId} / ${row.flexIdentifier}`, role: 'reported-condition' as const },
      { label: 'Fuel', value: row.fuel, role: 'reported-condition' as const },
      { label: 'Ambient pressure', value: `${row.ambientPressure.value} mmHg`, role: 'reported-condition' as const },
      { label: 'Composition (mole fraction)', value: `O2 ${row.ambientComposition.o2}; N2 ${row.ambientComposition.n2}; CO2 ${row.ambientComposition.co2}; He ${row.ambientComposition.he}`, role: 'reported-condition' as const },
      { label: 'Termination', value: row.terminationCategory, role: 'reported-condition' as const },
    ];
    return evidenceSchema.parse({
      id: `${row.testId}-SUMMARY`, experimentId: 'flex', experimentName: 'FLEX individual NASA test',
      title: `${row.testId} / ${row.flexIdentifier} · individual test summary`,
      objective: 'Inspect source-reported individual test results', summary: finding, finding,
      platform: 'International Space Station', apparatus: 'FLEX', fuel: row.fuel, materialCategory: 'liquid-droplet',
      topics: ['flex', 'droplet', 'diameter', 'burning', 'rate', 'duration', 'numerical', 'measurement'], conditions,
      context: { runId: row.testId, stage: 'whole-run', gravity: 'microgravity', pressurePa: null, gasComposition: conditions[3].value, flow: null, support: null },
      evidenceType: row.initialDropletDiameter ? 'measurement' : 'experiment-description',
      measurement: row.initialDropletDiameter ? { quantity: 'droplet-diameter', value: row.initialDropletDiameter.value, unit: 'mm', kind: 'measured', statistic: 'single-run', method: 'Source-reported initial diameter in test summary', uncertainty: null, uncertaintyNote: 'Not supplied in the summary table' } : null,
      source: { id: `NTRS-${flexTestSource.ntrsId}`, title: flexTestSource.title, url: row.provenance.sourceUrl, locator: `${row.provenance.sourceDocumentId}; ${row.provenance.table}; printed page ${row.provenance.printedPage}; row ${row.testId} / ${row.flexIdentifier}`, verifiedOn: '2026-11-14' },
      limitations: [...row.qualifiers, 'Separate Table IX dataset; no identity with the FLEX-145 presentation is assumed. Matching a few conditions does not establish comparability.'],
      missingParameters: row.missingData.map(item => `${item.field}: ${item.interpretation}`), availability: 'published-run-summary',
    });
  });
}
