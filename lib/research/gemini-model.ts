/**
 * Gemini 4 Hydrogen ignores sampling temperature. Omitting it avoids sending a
 * setting the model does not honor while leaving the configured model unchanged.
 */
export function samplingTemperatureForModel(modelId: string): number | undefined {
  if (/(^|[/.])gemini-4-hydrogen(?:-|$)/i.test(modelId)) return undefined;
  return 0.1;
}
