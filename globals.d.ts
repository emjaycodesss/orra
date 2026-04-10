/** Patch `IteratorObject` so `ReactNode`'s `Iterable` typing matches TS + Node compat libs. */
interface IteratorObject<T, TReturn = unknown, TNext = unknown> {
  next(...[value]: [] | [TNext]): IteratorResult<T, TReturn>;
  return?(value?: TReturn): IteratorResult<T, TReturn>;
  throw?(e?: any): IteratorResult<T, TReturn>;
  [Symbol.iterator](): IteratorObject<T, TReturn, TNext>;
}

interface AsyncIteratorObject<T, TReturn = unknown, TNext = unknown> {
  next(...[value]: [] | [TNext]): Promise<IteratorResult<T, TReturn>>;
  return?(value?: TReturn): Promise<IteratorResult<T, TReturn>>;
  throw?(e?: any): Promise<IteratorResult<T, TReturn>>;
  [Symbol.asyncIterator](): AsyncIteratorObject<T, TReturn, TNext>;
}

declare namespace NodeJS {
  interface ProcessEnv {
    [key: string]: string | undefined;
    NEXT_PUBLIC_ORRA_CONTRACT_ADDRESS?: string;
    NEXT_PUBLIC_ORRA_TRIVIA_CONTRACT_ADDRESS?: string;
    NEXT_PUBLIC_BASE_RPC_URL?: string;
    NEXT_PUBLIC_ENTROPY_ADDRESS?: string;
    NEXT_PUBLIC_ORRA_TRIVIA_DEV_MOCK?: string;
    ORRA_TRIVIA_DEV_MOCK?: string;
    BLUESMINDS_BASE_URL?: string;
    BLUESMINDS_API_KEY?: string;
    BLUESMINDS_MODEL?: string;
    BLUESMINDS_CHAT_URL?: string;
    GITHUB_TOKEN?: string;
    GITHUB_MODELS_TOKEN?: string;
    GITHUB_MODELS_MODEL?: string;
    OPENROUTER_API_KEY?: string;
    OPENROUTER_APP_TITLE?: string;
    OPENROUTER_FALLBACK_MODEL?: string;
    OPENROUTER_FALLBACK_MODELS?: string;
    OPENROUTER_HTTP_REFERER?: string;
    PYTH_PRO_TOKEN?: string;
    ORRA_DATABASE_URL?: string;
    DATABASE_URL?: string;
    ORRA_PG_POOL_MAX?: string;
    /** When "1", emit structured API timing lines in production (see lib/api-observability). */
    ORRA_API_TIMING_LOG?: string;
  }
}
