// #24: google/gemini-2.0-flash-exp:free was retired by OpenRouter (404). Every AI call site
// must import this constant; never write a model id literal at a call site.
// Retired: google/gemini-2.0-flash-exp:free ($0 in / $0 out per 1M tokens).
// Successor: google/gemini-2.5-flash-lite ($0.10 in / $0.40 out per 1M tokens;
// source: https://openrouter.ai/api/v1/models, read 2026-10-28).
export const DEFAULT_AI_MODEL = 'google/gemini-2.5-flash-lite';
