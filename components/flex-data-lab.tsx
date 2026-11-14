"use client";

import { useState } from "react";
import { flexTestRecords, flexTestSource } from "@/lib/research/corpus";
import {
  assessFlexComparability,
  filterFlexTests,
  getFlexPlotSamples,
  selectFlexTestPair,
  type FlexTestFilters,
} from "@/lib/research/flex-data-lab";
import type { FlexTestRecord } from "@/lib/research/flex-test-data";

const pressures = flexTestRecords.map((record) => record.ambientPressure.value);
const pressureMin = Math.min(...pressures);
const pressureMax = Math.max(...pressures);
const oxygenOptions = [...new Set(flexTestRecords.map((record) => record.ambientComposition.o2))].sort((a, b) => a - b);
const publicationCount = new Set(flexTestRecords.map((record) => record.provenance.ntrsId)).size;
const chart = { left: 66, right: 722, top: 24, bottom: 290, width: 780, height: 360 };
const allSamples = getFlexPlotSamples(flexTestRecords);
const xDomain = [Math.min(...allSamples.map((sample) => sample.initialDiameterMm)), Math.max(...allSamples.map((sample) => sample.initialDiameterMm))] as const;
const yDomain = [Math.min(...allSamples.map((sample) => sample.averageBurningRateMm2PerS)), Math.max(...allSamples.map((sample) => sample.averageBurningRateMm2PerS))] as const;
const initialFilters: FlexTestFilters = { fuel: "all", oxygen: "all", pressureMin, pressureMax, outcome: "all" };

function pointX(value: number) { return chart.left + ((value - xDomain[0]) / (xDomain[1] - xDomain[0])) * (chart.right - chart.left); }
function pointY(value: number) { return chart.bottom - ((value - yDomain[0]) / (yDomain[1] - yDomain[0])) * (chart.bottom - chart.top); }
function fmt(value: number, digits = 2) { return value.toFixed(digits).replace(/0+$/, "").replace(/\.$/, ""); }
const numberWords = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const tensWords = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function countInWords(value: number) {
  if (value >= 0 && value < 20) return numberWords[value];
  if (value < 100) return `${tensWords[Math.floor(value / 10)]}${value % 10 ? `-${numberWords[value % 10]}` : ""}`;
  return new Intl.NumberFormat("en-US").format(value);
}
function displayedValue(record: FlexTestRecord, key: "initialDropletDiameter" | "visibleFlameExtinctionDiameter" | "averageBurningRateConstant" | "burnTime") {
  const value = record[key];
  if (!value) return "— Not reported";
  return `${fmt(value.value, 3)} ${value.unit}`;
}
function selectDescription(record: FlexTestRecord) {
  return `${record.testId} · ${record.flexIdentifier} · ${record.fuel} · D₀ ${displayedValue(record, "initialDropletDiameter")} · average k ${displayedValue(record, "averageBurningRateConstant")}`;
}

export function FlexDataLab() {
  const [filters, setFilters] = useState<FlexTestFilters>(initialFilters);
  const [selectedIds, setSelectedIds] = useState<[string, string]>(["FLEX-001", "FLEX-002"]);
  const [activePointId, setActivePointId] = useState<string | null>(null);
  const filteredTests = filterFlexTests(flexTestRecords, filters);
  const plotSamples = getFlexPlotSamples(filteredTests);
  const eligibleIds = filteredTests.map((record) => record.testId);
  const selectedA = filteredTests.find((record) => record.testId === selectedIds[0]) ?? filteredTests[0];
  const selectedB = filteredTests.find((record) => record.testId === selectedIds[1] && record.testId !== selectedA?.testId)
    ?? filteredTests.find((record) => record.testId !== selectedA?.testId);
  const activePoint = plotSamples.find((sample) => sample.record.testId === activePointId);
  const comparability = assessFlexComparability(selectedA, selectedB);
  const canCompare = Boolean(selectedA && selectedB && selectedA.testId !== selectedB.testId);

  function setPair(side: 0 | 1, testId: string) {
    if (side === 0) {
      if (testId === selectedB?.testId && selectedA) setSelectedIds([testId, selectedA.testId]);
      else setSelectedIds([testId, selectedB?.testId ?? filteredTests.find((record) => record.testId !== testId)?.testId ?? ""]);
    } else {
      if (testId === selectedA?.testId && selectedB) setSelectedIds([selectedB.testId, testId]);
      else setSelectedIds([selectedA?.testId ?? "", testId]);
    }
  }

  function pointSelect(testId: string) {
    const pair: [string, string] = [selectedA?.testId ?? "", selectedB?.testId ?? ""];
    setSelectedIds(selectFlexTestPair(pair, testId, eligibleIds));
    setActivePointId(testId);
  }

  return <section className="flex-data-lab" aria-label="NASA FLEX Data Lab">
    <header className="flex-data-header">
      <span className="flex-data-kicker">FLAME / NASA DATA LAB</span>
      <h2>{countInWords(flexTestRecords.length)} tests.<br />One source.</h2>
      <p>Explore reported FLEX run summaries. Points are individual tests, not independent publications.</p>
      <div className="flex-data-metrics" aria-label="Dataset counts">
        <div><strong>{flexTestRecords.length}</strong><span>Imported tests</span></div>
        <div><strong>{publicationCount}</strong><span>NASA publication</span></div>
        <div><strong>{plotSamples.length}</strong><span>Plotted now</span></div>
      </div>
      <p className="flex-data-fields"><span>AVAILABLE VARIABLES</span>Date / GMT · fuel · ambient pressure · O₂ / N₂ / CO₂ / He · D₀ · visible-flame Dext · fitted average k · burn time · test end</p>
      <a className="flex-data-source" href={flexTestSource.url} target="_blank" rel="noreferrer">
        <span><strong>{flexTestSource.documentId}</strong><small>{flexTestSource.table} · printed page {flexTestSource.printedPage}</small></span>
        <span aria-hidden="true">Open NASA report ↗</span>
      </a>
    </header>

    <section className="flex-chart-section" aria-label="Exploratory data comparison">
      <div className="flex-chart-heading">
        <div><span className="flex-data-kicker">EXPLORATORY COMPARISON</span><h3>Initial droplet size × average burning rate</h3></div>
        <span className="flex-chart-count">{plotSamples.length} / {filteredTests.length} points</span>
      </div>
      <p className="flex-chart-note">Each point is a source-reported test row. The average rate is a fitted D²-versus-time constant, not an instantaneous rate. No trend line or causal inference.</p>
      <div className="flex-filter-grid" aria-label="Filter tests">
        <label><span>Fuel</span><select value={filters.fuel} onChange={(event) => setFilters({ ...filters, fuel: event.target.value as FlexTestFilters["fuel"] })}><option value="all">All fuels</option><option value="Methanol">Methanol</option><option value="Heptane">Heptane</option></select></label>
        <label><span>O₂ mole fraction</span><select value={filters.oxygen} onChange={(event) => setFilters({ ...filters, oxygen: event.target.value === "all" ? "all" : Number(event.target.value) })}><option value="all">All reported</option>{oxygenOptions.map((value) => <option key={value} value={value}>{fmt(value * 100, 1)}%</option>)}</select></label>
        <label><span>Pressure min · mmHg</span><input type="number" aria-label="Minimum pressure in mmHg" min={pressureMin} max={pressureMax} step="any" value={filters.pressureMin} onChange={(event) => setFilters({ ...filters, pressureMin: event.target.value === "" ? pressureMin : Number(event.target.value) })} /></label>
        <label><span>Pressure max · mmHg</span><input type="number" aria-label="Maximum pressure in mmHg" min={pressureMin} max={pressureMax} step="any" value={filters.pressureMax} onChange={(event) => setFilters({ ...filters, pressureMax: event.target.value === "" ? pressureMax : Number(event.target.value) })} /></label>
        <label><span>Test end</span><select value={filters.outcome} onChange={(event) => setFilters({ ...filters, outcome: event.target.value as FlexTestFilters["outcome"] })}><option value="all">All outcomes</option><option value="Extinction">Extinction</option><option value="Disruption">Disruption</option><option value="Completion">Completion</option></select></label>
      </div>
      <div className="flex-chart-legend"><span><i className="methanol-dot" /> Methanol</span><span><i className="heptane-dot" /> Heptane</span><span>{filteredTests.length} tests match filters</span></div>
      <div className="flex-chart-scroll">
        {plotSamples.length > 0 ? <svg className="flex-scatterplot" viewBox={`0 0 ${chart.width} ${chart.height}`} role="group" aria-labelledby="flex-chart-title flex-chart-desc">
          <title id="flex-chart-title">Exploratory comparison of initial droplet diameter and fitted average burning-rate constant</title>
          <desc id="flex-chart-desc">{plotSamples.length} individual NASA FLEX test points from one publication. Points with either value missing are omitted. Select a point to use it as comparison test B. The plot has no trend line.</desc>
          {[0,1,2,3,4].map((index) => {
            const fraction = index / 4;
            const y = chart.bottom - fraction * (chart.bottom - chart.top);
            const value = yDomain[0] + fraction * (yDomain[1] - yDomain[0]);
            return <g key={`y-${index}`}><line className="flex-grid-line" x1={chart.left} x2={chart.right} y1={y} y2={y} /><text className="flex-axis-tick" x={chart.left - 10} y={y + 4} textAnchor="end">{fmt(value, 2)}</text></g>;
          })}
          {[0,1,2,3,4].map((index) => {
            const fraction = index / 4;
            const x = chart.left + fraction * (chart.right - chart.left);
            const value = xDomain[0] + fraction * (xDomain[1] - xDomain[0]);
            return <g key={`x-${index}`}><line className="flex-grid-line vertical" x1={x} x2={x} y1={chart.top} y2={chart.bottom} /><text className="flex-axis-tick" x={x} y={chart.bottom + 20} textAnchor="middle">{fmt(value, 1)}</text></g>;
          })}
          <line className="flex-axis-line" x1={chart.left} x2={chart.left} y1={chart.top} y2={chart.bottom} />
          <line className="flex-axis-line" x1={chart.left} x2={chart.right} y1={chart.bottom} y2={chart.bottom} />
          <text className="flex-axis-label" x={(chart.left + chart.right) / 2} y={chart.height - 7} textAnchor="middle">Initial droplet diameter · mm</text>
          <text className="flex-axis-label" x="15" y={(chart.top + chart.bottom) / 2} textAnchor="middle" transform={`rotate(-90 15 ${(chart.top + chart.bottom) / 2})`}>Average burning-rate constant · mm²/s</text>
          {plotSamples.map(({ record, initialDiameterMm, averageBurningRateMm2PerS }) => {
            const selected = record.testId === selectedA?.testId || record.testId === selectedB?.testId;
            return <circle
              key={record.testId}
              className={`flex-data-point ${record.fuel === "Methanol" ? "fuel-methanol" : "fuel-heptane"}${selected ? " selected" : ""}`}
              cx={pointX(initialDiameterMm)} cy={pointY(averageBurningRateMm2PerS)} r={selected ? 7 : 5.5}
              role="button" tabIndex={0} aria-pressed={selected} aria-label={`${selectDescription(record)}. Select this test for comparison.`}
              onPointerEnter={() => setActivePointId(record.testId)} onPointerLeave={() => setActivePointId(null)} onFocus={() => setActivePointId(record.testId)} onBlur={() => setActivePointId(null)}
              onClick={() => pointSelect(record.testId)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); pointSelect(record.testId); } }}>
              <title>{selectDescription(record)}</title>
            </circle>;
          })}
        </svg> : <div className="flex-data-empty" role="status"><strong>No plottable test rows for these filters.</strong><span>Rows missing either initial diameter or fitted average burning rate are excluded, never filled with zero.</span></div>}
      </div>
      <p className="flex-point-inspection" role="status" aria-live="polite">{activePoint ? <><strong>{activePoint.record.testId} · {activePoint.record.flexIdentifier}</strong> — {activePoint.initialDiameterMm} mm × {fmt(activePoint.averageBurningRateMm2PerS, 3)} mm²/s</> : "Hover, focus, or select a point to inspect its source row. Click a point to set comparison B."}</p>
    </section>

    <section className="flex-compare-section" aria-labelledby="flex-compare-title">
      <div className="flex-chart-heading"><div><span className="flex-data-kicker">TWO-TEST COMPARISON</span><h3 id="flex-compare-title">Inspect the source rows</h3></div><span className="flex-chart-count">{canCompare ? "2 selected" : `${filteredTests.length} available`}</span></div>
      <div className="flex-pair-selectors">
        {[0,1].map((side) => {
          const selected = side === 0 ? selectedA : selectedB;
          return <label key={side} className="flex-pair-select"><span>TEST {side === 0 ? "A" : "B"}</span><select aria-label={`Select comparison test ${side === 0 ? "A" : "B"}`} value={selected?.testId ?? ""} disabled={filteredTests.length < 2} onChange={(event) => setPair(side as 0 | 1, event.target.value)}>
            {filteredTests.length < 2 ? <option value="">At least two matching tests required</option> : filteredTests.map((record) => <option key={record.testId} value={record.testId} disabled={side === 0 ? record.testId === selectedB?.testId : record.testId === selectedA?.testId}>{record.testId} · {record.flexIdentifier}</option>)}
          </select></label>;
        })}
      </div>
      <div className={`flex-comparability ${comparability.status}`} role="status"><span>{comparability.title}</span>{comparability.differences.length > 0 && <ul>{comparability.differences.map((difference) => <li key={difference}>{difference}</li>)}</ul>}<p>{comparability.note}</p></div>
      {canCompare ? <div className="flex-test-comparison" aria-label="Selected NASA test comparison">
        {[selectedA, selectedB].map((record, index) => record && <article className="flex-test-column" key={`${index}-${record.testId}`}>
          <header><span>TEST {index === 0 ? "A" : "B"}</span><h4>{record.testId}</h4><p>NASA identifier · {record.flexIdentifier}</p></header>
          <dl>
            <div><dt>Test date / GMT</dt><dd>{record.testDateReported}{record.testTimeGmt ? ` · ${record.testTimeGmt} GMT` : " · GMT not reported"}</dd></div>
            <div><dt>Fuel</dt><dd>{record.fuel} · source-reported</dd></div>
            <div><dt>Ambient pressure</dt><dd>{fmt(record.ambientPressure.value, 1)} mmHg</dd></div>
            <div><dt>Ambient gas · mole fraction</dt><dd>O₂ {fmt(record.ambientComposition.o2, 2)} · N₂ {fmt(record.ambientComposition.n2, 2)} · CO₂ {fmt(record.ambientComposition.co2, 2)} · He {fmt(record.ambientComposition.he, 2)}</dd></div>
            <div><dt>Initial droplet diameter</dt><dd>{displayedValue(record, "initialDropletDiameter")} <small>Source-reported measurement</small></dd></div>
            <div><dt>Visible-flame extinction diameter</dt><dd>{displayedValue(record, "visibleFlameExtinctionDiameter")} <small>Source-reported measurement or estimate; dash meaning may be unresolved</small></dd></div>
            <div><dt>Average burning-rate constant</dt><dd>{displayedValue(record, "averageBurningRateConstant")} <small>Source-reported fitted average; not instantaneous</small></dd></div>
            <div><dt>Burn time</dt><dd>{displayedValue(record, "burnTime")}</dd></div>
            <div><dt>Test end</dt><dd>{record.terminationCategory} · source-reported</dd></div>
          </dl>
          {record.missingData.length > 0 && <p className="flex-missing-note"><strong>Missing in source row:</strong> {record.missingData.map(({ field }) => field.replaceAll(/([A-Z])/g, " $1").toLowerCase()).join(", ")}. Printed dash retained as missing.</p>}
          <a className="flex-row-source" href={record.provenance.sourceUrl} target="_blank" rel="noreferrer"><strong>{record.provenance.sourceDocumentId}</strong><span>{record.provenance.table} · printed page {record.provenance.printedPage} · row {record.provenance.row}</span><span>Open NASA source ↗</span></a>
        </article>)}
      </div> : <p className="flex-data-empty" role="status">Adjust filters to include at least two tests before comparing source rows.</p>}
      <p className="flex-data-footnote">The report describes 284 tests; FLAME has imported 30 rows from this single publication. A pair of test records is not a pair of publications or independent confirmation.</p>
    </section>
  </section>;
}
