import type { LeaderboardRow } from "@/lib/game/leaderboard-types";

/**
 * Extended leaderboard row with deduplication metadata
 */
interface DedupedLeaderboardRow extends LeaderboardRow {
  /** Number of times this player appears in the raw leaderboard */
  appearances: number;
}

/**
 * Pagination result object
 */
interface PaginationResult<T> {
  rows: T[];
  totalPages: number;
  totalRows: number;
  currentPage: number;
  pageSize: number;
}

/**
 * Deduplicates leaderboard rows by player wallet address, keeping only the highest score.
 * Tracks the number of appearances for each player.
 *
 * @param rows - Array of leaderboard rows to deduplicate
 * @returns Array of deduped rows sorted by score descending, with appearance count
 *
 * @example
 * const rows = [
 *   { wallet_address: "0x123", score: 1000, ... },
 *   { wallet_address: "0x123", score: 800, ... },
 *   { wallet_address: "0x456", score: 900, ... },
 * ];
 * const deduped = deduplicateLeaderboard(rows);
 * // Returns 2 rows: 0x123 with 1000 (appearances: 2), 0x456 with 900 (appearances: 1)
 */
export function deduplicateLeaderboard(
  rows: LeaderboardRow[],
): DedupedLeaderboardRow[] {
  const playerMap = new Map<string, { row: LeaderboardRow; count: number }>();

  for (const row of rows) {
    const existing = playerMap.get(row.wallet_address);

    const shouldUpdate = !existing || row.score > existing.row.score;
    const newCount = (existing?.count ?? 0) + 1;
    playerMap.set(row.wallet_address, {
      row: shouldUpdate ? row : existing!.row,
      count: newCount,
    });
  }

  const dedupedRows = Array.from(playerMap.values()).map(({ row, count }) => ({
    ...row,
    appearances: count,
  }));

  dedupedRows.sort((a, b) => b.score - a.score);

  return dedupedRows;
}

/**
 * Paginates an array of leaderboard rows.
 *
 * @param rows - Array of leaderboard rows to paginate
 * @param page - 0-indexed page number
 * @param pageSize - Number of rows per page (default: 15)
 * @returns Pagination result with rows, totalPages, totalRows, and currentPage
 *
 * @example
 * const rows = [... 50 rows ...];
 * const page0 = paginateLeaderboard(rows, 0, 15);
 * // Returns first 15 rows, totalPages: 4, totalRows: 50, currentPage: 0
 */
export function paginateLeaderboard<T extends LeaderboardRow>(
  rows: T[],
  page: number,
  pageSize: number = 15,
): PaginationResult<T> {
  if (pageSize <= 0) {
    throw new Error(`pageSize must be positive, got ${pageSize}`);
  }
  if (page < 0) {
    throw new Error(`page must be non-negative, got ${page}`);
  }

  const totalRows = rows.length;
  const totalPages = Math.ceil(totalRows / pageSize);

  const validPage = Math.max(0, Math.min(page, Math.max(0, totalPages - 1)));

  const startIndex = validPage * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedRows = rows.slice(startIndex, endIndex);

  return {
    rows: paginatedRows,
    totalPages,
    totalRows,
    currentPage: validPage,
    pageSize,
  };
}
