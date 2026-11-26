import { performance } from 'node:perf_hooks';
import { protect } from '../packages/core/index.ts';
import { corpus, type Case } from './corpus.ts';

function fraction(value: number, total: number) {
  return total ? Math.round((value / total) * 10_000) / 10_000 : null;
}

function measure(samples: Case[]) {
  let maskPredictions = 0;
  let masksMatched = 0;
  let structured = 0;
  let structuredMatched = 0;
  let strong = 0;
  let strongMatched = 0;
  let benign = 0;
  let benignModified = 0;
  let benignBlocked = 0;
  let reviews = 0;
  let unexpectedLeaks = 0;
  const types = new Map<string, { expected: number; matched: number; predicted: number }>();
  const times: number[] = [];
  function get(type: string) {
    if (!types.has(type)) types.set(type, { expected: 0, matched: 0, predicted: 0 });
    return types.get(type)!;
  }

  for (const sample of samples) {
    const start = performance.now();
    const result = protect(sample.text);
    times.push(performance.now() - start);
    if (result.status === 'review') reviews++;
    if (!sample.labels.length) {
      benign++;
      if (result.status === 'blocked') benignBlocked++;
      if (result.status === 'ok' && result.sanitizedText !== sample.text) benignModified++;
    }
    for (const finding of result.findings) {
      get(finding.type).predicted++;
      if (finding.action === 'mask') maskPredictions++;
    }
    for (const label of sample.labels) {
      // Password regex may include terminal punctuation in the blocked span.
      const matching = result.findings.some(finding => finding.type === label.type && finding.action === label.action &&
        finding.start === label.start && (label.action === 'block' ? finding.end >= label.end : finding.end === label.end));
      const enforced = matching && (label.action === 'block' ? result.status === 'blocked' : result.status === 'ok');
      get(label.type).expected++;
      if (enforced) get(label.type).matched++;
      if (label.action === 'mask') {
        structured++;
        if (enforced) { structuredMatched++; masksMatched++; }
      } else {
        strong++;
        if (enforced) strongMatched++;
      }
      if (result.status === 'ok' && result.sanitizedText.includes(sample.text.slice(label.start, label.end))) unexpectedLeaks++;
    }
  }

  times.sort((a, b) => a - b);
  const percentile = (p: number) => Math.round((times[Math.ceil(times.length * p) - 1] ?? 0) * 1000) / 1000;
  return {
    prompts: samples.length,
    families: new Set(samples.map(sample => sample.family)).size,
    benign,
    structuredRecall: fraction(structuredMatched, structured),
    strongSecretRecall: fraction(strongMatched, strong),
    maskPrecision: fraction(masksMatched, maskPredictions),
    benignModification: fraction(benignModified, benign),
    benignBlock: fraction(benignBlocked, benign),
    reviewRate: fraction(reviews, samples.length),
    syntheticMarkerLeaks: unexpectedLeaks,
    p50Ms: percentile(0.50),
    p95Ms: percentile(0.95),
    entities: Object.fromEntries(types),
  };
}

const results = measure(corpus);
const passed = results.prompts >= 500 && results.benign >= 200 &&
  (results.structuredRecall ?? 0) >= 0.95 && (results.strongSecretRecall ?? 0) >= 0.98 &&
  (results.maskPrecision ?? 0) >= 0.95 && (results.benignModification ?? 1) <= 0.02 &&
  (results.benignBlock ?? 1) <= 0.01 && results.syntheticMarkerLeaks === 0;

console.log(JSON.stringify({
  corpus: 'Synthetic context and template coverage; no claim of independent real-world validation.',
  node: process.version,
  platform: process.platform,
  mode: 'balanced',
  passed,
  results,
  languages: Object.fromEntries(['en', 'mixed'].map(language => [language, measure(corpus.filter(sample => sample.language === language))])),
}, null, 2));
if (!passed) process.exitCode = 1;
