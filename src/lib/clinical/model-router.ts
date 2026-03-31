/**
 * Shared clinical model routing for decision APIs.
 * Text JSON: {@link runClinicalTextJsonChain} (MedGemma -> Gemini).
 * Vision + text: use `huatuoInterpretImage` / `medgemmaInterpretFallback` / `geminiInterpretForTriage` from `@/lib/health/model-router` for imaging-heavy flows (see scan-analysis).
 */
export { runClinicalTextJsonChain } from "@/lib/clinical/clinical-json-fallback";
