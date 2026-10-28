// #24: google/gemini-2.0-flash-exp:free was retired by OpenRouter (404). Every AI call site
// must import this constant; never write a model id literal at a call site.
// Retired: google/gemini-2.0-flash-exp:free ($0 in / $0 out per 1M tokens).
// Then: google/gemini-2.5-flash-lite has no ZDR-compliant endpoint, so the account's Zero
// Data Retention guardrail (a deliberate privacy setting) returns 404 for it.
// Now: google/gemini-3.1-flash-lite ($0.25 in / $1.50 out per 1M tokens; cheapest Google
// endpoint in https://openrouter.ai/api/v1/endpoints/zdr, read 2026-10-28; supports
// response_format and structured_outputs).
export const DEFAULT_AI_MODEL = 'google/gemini-3.1-flash-lite';
