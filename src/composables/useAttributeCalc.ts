import type { AttributeAllocation } from '@/types'

// Cumulative attribute point costs by rank (index = rank)
export const ATTR_COST = [0, 1, 3, 6, 10, 15, 21, 28, 37, 48, 61, 77, 97] as const

export const MAX_POINTS = 200
export const MAX_BASE_RANK = 12
export const MAX_EFFECTIVE_RANK = 16

export function useAttributeCalc() {
  /** Cumulative point cost to reach `rank` from 0 */
  function costForRank(rank: number): number {
    if (rank <= 0) return 0
    if (rank > MAX_BASE_RANK) return ATTR_COST[MAX_BASE_RANK]
    return ATTR_COST[rank]
  }

  /** Marginal cost to go from `from` to `to` */
  function costDelta(from: number, to: number): number {
    return costForRank(to) - costForRank(from)
  }

  /** Total points used across all allocations */
  function totalPointsUsed(allocations: AttributeAllocation[]): number {
    return allocations.reduce((sum, a) => sum + costForRank(a.rank), 0)
  }

  /** Whether rank can be incremented by 1 given current allocations */
  function canIncrement(attributeId: number, allocations: AttributeAllocation[]): boolean {
    const alloc = allocations.find(a => a.attributeId === attributeId)
    const currentRank = alloc?.rank ?? 0
    if (currentRank >= MAX_BASE_RANK) return false
    const used = totalPointsUsed(allocations)
    const delta = costDelta(currentRank, currentRank + 1)
    return used + delta <= MAX_POINTS
  }

  /** Whether rank can be decremented by 1 */
  function canDecrement(attributeId: number, allocations: AttributeAllocation[]): boolean {
    const alloc = allocations.find(a => a.attributeId === attributeId)
    return (alloc?.rank ?? 0) > 0
  }

  /** Effective rank including rune and headgear bonuses, capped at 16 */
  function effectiveRank(allocation: AttributeAllocation): number {
    const total = allocation.rank + allocation.runeBonus + allocation.headgearBonus
    return Math.min(total, MAX_EFFECTIVE_RANK)
  }

  /** Remaining points available */
  function remainingPoints(allocations: AttributeAllocation[]): number {
    return MAX_POINTS - totalPointsUsed(allocations)
  }

  /** Highest rank achievable given remaining points and current rank */
  function maxAchievableRank(remaining: number, currentRank: number): number {
    let rank = currentRank
    while (rank < MAX_BASE_RANK) {
      if (costDelta(rank, rank + 1) > remaining) break
      rank++
    }
    return rank
  }

  return {
    ATTR_COST,
    MAX_POINTS,
    MAX_BASE_RANK,
    MAX_EFFECTIVE_RANK,
    costForRank,
    costDelta,
    totalPointsUsed,
    canIncrement,
    canDecrement,
    effectiveRank,
    remainingPoints,
    maxAchievableRank,
  }
}
