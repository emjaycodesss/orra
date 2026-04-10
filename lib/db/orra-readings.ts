import { withRlsContext } from "@/lib/db/with-rls-context";

/**
 * Row shape for `orra_readings` (see migrations/002_orra_readings.sql).
 * Server fills chain-verified fields; client may supply interpretation + question path + raw_snapshot.
 */
type OrraReadingRowInput = {
  id: string;
  chainId: number;
  walletAddress: string;
  sequenceNumber: string;
  cardIndex: number;
  isReversed: boolean;
  feedId: number;
  oracleSnapshotHash: string;
  randomNumber: string;
  blockNumber: string;
  blockTimestamp: Date | null;
  callbackTxHash: string;
  requestTxHash: string | null;
  realm: string | null;
  stance: string | null;
  timeframe: string | null;
  truth: string | null;
  interpretation: string | null;
  rawSnapshot: Record<string, unknown> | null;
};

/**
 * Insert or merge enrichment for the same (chain_id, sequence_number).
 * Core draw fields must match the first verified insert; upsert refreshes copy + JSON snapshot.
 */
export async function upsertOrraReading(row: OrraReadingRowInput): Promise<void> {
  const wallet = row.walletAddress.toLowerCase();
  await withRlsContext({ wallet_address: wallet }, async (client) => {
    await client.query("SET LOCAL statement_timeout = '20000'");
    await client.query(
      `INSERT INTO orra_readings (
        id, chain_id, wallet_address, sequence_number, card_index, is_reversed, feed_id,
        oracle_snapshot_hash, random_number, block_number, block_timestamp, callback_tx_hash,
        request_tx_hash, realm, stance, timeframe, truth, interpretation, raw_snapshot
      ) VALUES (
        $1, $2, $3, $4::numeric, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19::jsonb
      )
      ON CONFLICT (chain_id, sequence_number) DO UPDATE SET
        interpretation = COALESCE(EXCLUDED.interpretation, orra_readings.interpretation),
        realm = COALESCE(EXCLUDED.realm, orra_readings.realm),
        stance = COALESCE(EXCLUDED.stance, orra_readings.stance),
        timeframe = COALESCE(EXCLUDED.timeframe, orra_readings.timeframe),
        truth = COALESCE(EXCLUDED.truth, orra_readings.truth),
        raw_snapshot = COALESCE(EXCLUDED.raw_snapshot, orra_readings.raw_snapshot),
        request_tx_hash = COALESCE(orra_readings.request_tx_hash, EXCLUDED.request_tx_hash),
        block_timestamp = COALESCE(orra_readings.block_timestamp, EXCLUDED.block_timestamp)`,
      [
        row.id,
        row.chainId,
        wallet,
        row.sequenceNumber,
        row.cardIndex,
        row.isReversed,
        row.feedId,
        row.oracleSnapshotHash,
        row.randomNumber,
        row.blockNumber,
        row.blockTimestamp,
        row.callbackTxHash,
        row.requestTxHash,
        row.realm,
        row.stance,
        row.timeframe,
        row.truth,
        row.interpretation,
        row.rawSnapshot,
      ],
    );
  });
}
