import nextEnv from '@next/env';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText, Output } from 'ai';
import { searchEvidence } from '../lib/research/engine.ts';
import { groundedAnswerSchema, validateGroundedAnswer } from '../lib/research/grounding.ts';
nextEnv.loadEnvConfig(process.cwd());
if (!process.env.OPENROUTER_API_KEY) {
  console.log('AI unavailable: OPENROUTER_API_KEY is not configured.');
  process.exitCode = 1;
} else {
  const question = 'What is the methanol extinction diameter?';
  const records = searchEvidence(question, { experimentId: 'flex' }).hits.map(hit => hit.record);
  try {
    const provider = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY, compatibility: 'strict' });
    const { output } = await generateText({
      model: provider(process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'),
      output: Output.object({ schema: groundedAnswerSchema(records) }),
      temperature: .1, maxOutputTokens: 1000, maxRetries: 0, abortSignal: AbortSignal.timeout(45000),
      system: 'Answer only from the supplied evidence. Cite IDs only in evidenceIds, never in prose. No links or bracket citations. Distinguish facts from interpretation. Include the slide conflict and missing uncertainty. Do not invent numbers. Evidence: ' + JSON.stringify(records),
      prompt: question,
    });
    const answer = validateGroundedAnswer(output, records);
    console.log(JSON.stringify({ liveProviderResponded: true, validationPassed: true, model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini', claims: answer.claims, citations: answer.sources, limitations: answer.limitations }, null, 2));
  } catch (error) {
    // Never serialize SDK error objects: they may include request headers.
    const e = error as { name?: string; statusCode?: number };
    console.log(JSON.stringify({ liveProviderResponded: false, validationPassed: false, errorType: e.name || 'Error', httpStatus: e.statusCode ?? null }));
    process.exitCode = 1;
  }
}
