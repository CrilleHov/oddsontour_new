"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Swords, Trophy, Target } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type LBRow = {
  tavling: string
  spelare: string
  poang: number
  placering: number
}

type Matchup = {
  p1: string
  p2: string
  p1Wins: number
  p2Wins: number
  ties: number
}

const LB_TABLE = "leaderboard"
const COMP_TABLE = "competitions"

function yearFromDate(dateStr: string) {
  return Number(dateStr.slice(0, 4))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWinner(p1: LBRow, p2: LBRow): "p1" | "p2" | "tie" {
  const p1Pos = Number(p1.placering)
  const p2Pos = Number(p2.placering)

  // If either didn't play, exclude from head-to-head
  if (p1Pos === 0 || p2Pos === 0) return "tie"

  if (p1Pos < p2Pos) return "p1"
  if (p2Pos < p1Pos) return "p2"
  return "tie"
}

function getMedalEmoji(wins: number, losses: number): string {
  if (wins > losses) return "🔥"
  if (losses > wins) return "❄️"
  return "⚖️"
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HeadToHeadPage() {
  const supabase = useMemo(() => createClient(), [])

  const [lbRows, setLbRows] = useState<LBRow[]>([])
  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<string>("all")
  const [selectedPlayer, setSelectedPlayer] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from(LB_TABLE)
        .select("tavling:tävling, spelare, poang:poäng, placering")
        .returns<LBRow[]>()

      if (cancelled) return

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      const rows = (data ?? []) as LBRow[]
      setLbRows(rows)

      // Extract years
      const uniqYears = Array.from(
        new Set(rows.map((r) => yearFromDate(r.tavling)))
      ).sort((a, b) => b - a)

      setYears(uniqYears)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const { players, matchups } = useMemo(() => {
    let filtered = lbRows

    // Filter by year
    if (selectedYear !== "all") {
      const year = Number(selectedYear)
      filtered = filtered.filter((r) => yearFromDate(r.tavling) === year)
    }

    // Get unique players
    const uniquePlayers = Array.from(new Set(filtered.map((r) => r.spelare))).sort()

    // Build head-to-head matchups
    const matchupMap = new Map<string, Matchup>()

    // Group by competition
    const byCompetition = new Map<string, LBRow[]>()
    for (const r of filtered) {
      const arr = byCompetition.get(r.tavling) ?? []
      arr.push(r)
      byCompetition.set(r.tavling, arr)
    }

    // For each competition, compare all pairs
    for (const comp of byCompetition.values()) {
      for (let i = 0; i < comp.length; i++) {
        for (let j = i + 1; j < comp.length; j++) {
          const p1 = comp[i]
          const p2 = comp[j]

          // Ensure consistent ordering (alphabetical)
          const [first, second] = [p1, p2].sort((a, b) =>
            a.spelare.localeCompare(b.spelare)
          )

          const key = `${first.spelare}:${second.spelare}`
          const result = getWinner(p1, p2)

          const matchup = matchupMap.get(key) ?? {
            p1: first.spelare,
            p2: second.spelare,
            p1Wins: 0,
            p2Wins: 0,
            ties: 0,
          }

          if (result === "tie") matchup.ties += 1
          else if (
            result === "p1"
              ? p1.spelare === first.spelare
              : p1.spelare === second.spelare
          ) {
            matchup.p1Wins += 1
          } else {
            matchup.p2Wins += 1
          }

          matchupMap.set(key, matchup)
        }
      }
    }

    return {
      players: uniquePlayers,
      matchups: Array.from(matchupMap.values()),
    }
  }, [lbRows, selectedYear])

  // Get selected player's matchups
  const playerMatchups = useMemo(() => {
    if (!selectedPlayer) return []
    return matchups
      .filter((m) => m.p1 === selectedPlayer || m.p2 === selectedPlayer)
      .map((m) => {
        const isP1 = m.p1 === selectedPlayer
        return {
          opponent: isP1 ? m.p2 : m.p1,
          wins: isP1 ? m.p1Wins : m.p2Wins,
          losses: isP1 ? m.p2Wins : m.p1Wins,
          ties: m.ties,
        }
      })
      .sort((a, b) => {
        // Sort by win record first (most wins first)
        const aDiff = a.wins - a.losses
        const bDiff = b.wins - b.losses
        return bDiff - aDiff
      })
  }, [selectedPlayer, matchups])

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Head-to-Head</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Rivalitet mellan spelare — vem slår vem?
          </p>
        </div>

        <div className="w-full sm:w-56">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger>
              <SelectValue placeholder="Välj år" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla år</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <Card>
          <CardContent className="py-5">
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <div className="font-medium text-foreground">Kunde inte hämta data</div>
              <div className="text-muted-foreground">{error}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-96 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : players.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-3 text-center">
              <Swords className="h-12 w-12 text-muted-foreground" />
              <div>
                <div className="font-semibold text-foreground">Ingen data</div>
                <p className="text-sm text-muted-foreground mt-1">
                  Säkerställ att det finns resultat för valt år.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Player selector & overview ── */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Left: All matchups matrix */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Swords className="h-5 w-5 text-primary" />
                  Matchup-matris
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="pb-3 pr-3 text-left font-semibold text-muted-foreground">
                          Spelare
                        </th>
                        {players.map((p) => (
                          <th
                            key={p}
                            className="pb-3 px-1 text-center font-semibold text-muted-foreground text-xs"
                            title={p}
                          >
                            {p.slice(0, 3)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {players.map((p1) => (
                        <tr key={p1} className="border-b border-border/50 last:border-0">
                          <td className="py-3 pr-3 font-medium text-foreground">{p1}</td>
                          {players.map((p2) => {
                            if (p1 === p2) {
                              return (
                                <td
                                  key={p2}
                                  className="py-3 px-1 text-center bg-secondary/40 font-semibold text-foreground"
                                >
                                  —
                                </td>
                              )
                            }

                            const matchup = matchups.find(
                              (m) => (m.p1 === p1 && m.p2 === p2) || (m.p1 === p2 && m.p2 === p1)
                            )

                            if (!matchup) {
                              return (
                                <td key={p2} className="py-3 px-1 text-center text-muted-foreground">
                                  —
                                </td>
                              )
                            }

                            const isP1 = matchup.p1 === p1
                            const wins = isP1 ? matchup.p1Wins : matchup.p2Wins
                            const losses = isP1 ? matchup.p2Wins : matchup.p1Wins
                            const record = `${wins}–${losses}`
                            const bgColor = wins > losses ? "bg-primary/10" : losses > wins ? "bg-destructive/10" : "bg-secondary/40"

                            return (
                              <td key={p2} className={`py-3 px-1 text-center font-semibold ${bgColor}`}>
                                <div className="text-xs">{record}</div>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Grön = vinning record, röd = losing record. Läs rader horisontellt.
                </p>
              </CardContent>
            </Card>

            {/* Right: Player selector */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Trophy className="h-5 w-5 text-primary" />
                  Välj spelare
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {players.map((p) => (
                    <button
                      key={p}
                      onClick={() => setSelectedPlayer(selectedPlayer === p ? "" : p)}
                      className={`rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors ${
                        selectedPlayer === p
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-secondary/40 text-foreground hover:bg-secondary/60"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Selected player detail ── */}
          {selectedPlayer && playerMatchups.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="h-5 w-5 text-primary" />
                  {selectedPlayer} vs alla
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {playerMatchups.map((mu) => {
                    const totalGames = mu.wins + mu.losses + mu.ties
                    const winPct =
                      totalGames > 0 ? Math.round((mu.wins / totalGames) * 100) : 0
                    const emoji = getMedalEmoji(mu.wins, mu.losses)

                    return (
                      <div
                        key={mu.opponent}
                        className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-4 py-3"
                      >
                        <div className="flex-1">
                          <div className="font-semibold text-foreground">{mu.opponent}</div>
                          <div className="text-sm text-muted-foreground">
                            {mu.wins}–{mu.losses}
                            {mu.ties > 0 ? ` ({mu.ties} tie)` : ""}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-lg font-bold">{emoji}</div>
                            <div className="text-xs text-muted-foreground">{winPct}%</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Summary stats */}
                <div className="mt-6 grid gap-3 sm:grid-cols-3 border-t border-border pt-4">
                  {(() => {
                    const totalWins = playerMatchups.reduce((s, m) => s + m.wins, 0)
                    const totalLosses = playerMatchups.reduce((s, m) => s + m.losses, 0)
                    const totalTies = playerMatchups.reduce((s, m) => s + m.ties, 0)
                    const winRate =
                      totalWins + totalLosses > 0
                        ? Math.round((totalWins / (totalWins + totalLosses)) * 100)
                        : 0

                    return (
                      <>
                        <div className="rounded-lg bg-primary/10 p-3 text-center">
                          <div className="text-xs text-primary font-medium">Wins</div>
                          <div className="text-2xl font-bold text-primary">{totalWins}</div>
                        </div>
                        <div className="rounded-lg bg-destructive/10 p-3 text-center">
                          <div className="text-xs text-destructive font-medium">Losses</div>
                          <div className="text-2xl font-bold text-destructive">{totalLosses}</div>
                        </div>
                        <div className="rounded-lg bg-secondary/40 p-3 text-center">
                          <div className="text-xs text-muted-foreground font-medium">Win %</div>
                          <div className="text-2xl font-bold text-foreground">{winRate}%</div>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </CardContent>
            </Card>
          )}

          {selectedPlayer && playerMatchups.length === 0 && (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">
                  Ingen head-to-head matchups hittades för {selectedPlayer}.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
