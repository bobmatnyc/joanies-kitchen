/** Crawl cost ledger: rate table, `trackCost()`, and LLM usage tracking (#6). */

// #57: daily cost ceiling guard.
export {
  assertWithinDailyCap,
  COST_ALERT_TAG,
  COST_ALERT_THRESHOLDS,
  DAILY_COST_CAP_USD,
  isPaidCallBlocked,
  type PaidCallBlockedCode,
  PaidCallBlockedError,
} from './daily-cap';
export { parseLlmUsage, trackLlmResponse, withChatCostTracking } from './llm-usage';
export {
  COST_RATES,
  type CostProvider,
  type CostRate,
  computeLlmCost,
  FIRECRAWL_CRAWL_FLOOR_CREDITS,
  JINA_READER_FLOOR_TOKENS,
  jinaReaderCost,
  LEDGER_USD_RESOLUTION,
  LLM_FLOOR_COMPLETION_TOKENS,
  LLM_FLOOR_PROMPT_TOKENS,
  LLM_TOKEN_PRICES,
  lookupRate,
  TAVILY_EXTRACT_FLOOR_URLS,
  UNKNOWN_LLM_REQUEST_FLOOR_USD,
  unitsOrFloor,
} from './rates';
export {
  DEFAULT_RUN_BUDGET_USD,
  formatBudgetExceeded,
  isBudgetExhausted,
  MAX_RUN_BUDGET_USD,
  resolveRunBudget,
} from './run-budget';
export {
  COST_LEDGER_WRITE_TIMEOUT_MS,
  type CostEventRow,
  currentCostRunId,
  currentRunSpend,
  type RunSpend,
  resolveCost,
  setCostRunId,
  type TrackCostInput,
  trackCost,
  UnknownCostOperationError,
  withCostRun,
} from './tracker';
