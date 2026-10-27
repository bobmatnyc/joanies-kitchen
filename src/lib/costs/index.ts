/** Crawl cost ledger: rate table, `trackCost()`, and LLM usage tracking (#6). */

export { parseLlmUsage, trackLlmResponse, withChatCostTracking } from './llm-usage';
export {
  COST_RATES,
  type CostProvider,
  type CostRate,
  computeLlmCost,
  LLM_TOKEN_PRICES,
  lookupRate,
  UNKNOWN_LLM_REQUEST_FLOOR_USD,
} from './rates';
export {
  COST_LEDGER_WRITE_TIMEOUT_MS,
  type CostEventRow,
  currentCostRunId,
  resolveCost,
  setCostRunId,
  type TrackCostInput,
  trackCost,
  UnknownCostOperationError,
  withCostRun,
} from './tracker';
