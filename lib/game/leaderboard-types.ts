export interface LeaderboardRow {
  id: string;
  wallet_address: string;
  score: number;
  run_completed: boolean;
  display_name: string | null;
  twitter_handle: string | null;
  chain_id: number;
  created_at: string;
  questions_answered: number;
  correct_count: number;
  pyth_iq: number;
  mean_latency_ms: number | null;
  median_latency_ms: number | null;
  bosses_reached: number;
  power_ups_used: number;
  /** Set when row was submitted from a persisted game session (Postgres). */
  session_id?: string | null;
}
