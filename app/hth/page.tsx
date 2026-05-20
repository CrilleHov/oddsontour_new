"use client"

import { useEffect, useMemo, useState } from "react"
import type { ComponentType, ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertTriangle,
  BarChart3,
  Crown,
  Medal,
  Scale,
  Shield,
  Sparkles,
  Swords,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserRound,
  Users,
} from "lucide-react"

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
  games: number
}

type PlayerMatchup = {
  opponent: string
  wins: number
  losses: number
  ties: number
  games: number
  winPct: number
  diff: number
}

const LB_TABLE = "leaderboard"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function yearFromDate(dateStr: string) {
  return Number(dateStr.slice(0, 4))
}

function formatPct(value: number) {
  return `${Math.round(value)}%`
}

function getResultTone(wins: number, losses: number) {
  if (wins > losses) return "good"
  if (losses > wins) return "bad"
  return "neutral"
}

function getResultLabel(wins: number, losses: number) {
  if (wins > losses) return "Plus"
  if (losses > wins) return "Minus"
  return "Jämnt"
}

function getToneClasses(tone: "good" | "bad" | "neutral") {
  if (tone === "good") {
    return {
      bg: "bg-primary/10",
      text: "text-primary",
      border: "border-primary/30",
    }
  }

  if (tone === "bad") {
    return {
      bg: "bg-destructive/10",
      text: "text-destructive",
      border: "border-destructive/30",
    }
  }

  return {
    bg: "bg-secondary/50",
    text: "text-muted-foreground",
    border: "border-border",
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HeadToHeadPage() {
  const supabase = useMemo(() => createClient(), [])

  const [lbRows, setLbRows] = useState<LBRow[]>([])
  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState("all")
  const [selectedPlayer, setSelectedPlayer] = useState("")
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

      const rows = data ?? []

      setLbRows(rows)

      const uniqYears = Array.from(
        new Set(
          rows
            .map((r) => yearFromDate(r.tavling))
            .filter((y) => Number.isFinite(y))
        )
      ).sort((a, b) => b - a)

      setYears(uniqYears)
      setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [supabase])

  const dashboard = useMemo(() => {
    let filtered = lbRows

    if (selectedYear !== "all") {
      const year = Number(selectedYear)
      filtered = filtered.filter((r) => yearFromDate(r.tavling) === year)
    }

    const playedRows = filtered.filter((r) => Number(r.placering) > 0)

    const players = Array.from(new Set(playedRows.map((r) => r.spelare))).sort(
      (a, b) => a.localeCompare(b, "sv")
    )

    const byCompetition = new Map<string, LBRow[]>()

    for (const r of playedRows) {
      const arr = byCompetition.get(r.tavling) ?? []
      arr.push(r)
      byCompetition.set(r.tavling, arr)
    }

    const matchupMap = new Map<string, Matchup>()

    for (const compRows of byCompetition.values()) {
      const sortedRows = [...compRows].sort((a, b) =>
        a.spelare.localeCompare(b.spelare, "sv")
      )

      for (let i = 0; i < sortedRows.length; i++) {
        for (let j = i + 1; j < sortedRows.length; j++) {
          const first = sortedRows[i]
          const second = sortedRows[j]

          const key = `${first.spelare}:${second.spelare}`

          const matchup =
            matchupMap.get(key) ??
            ({
              p1: first.spelare,
              p2: second.spelare,
              p1Wins: 0,
              p2Wins: 0,
              ties: 0,
              games: 0,
            } satisfies Matchup)

          const firstPos = Number(first.placering)
          const secondPos = Number(second.placering)

          if (firstPos < secondPos) {
            matchup.p1Wins += 1
          } else if (secondPos < firstPos) {
            matchup.p2Wins += 1
          } else {
            matchup.ties += 1
          }

          matchup.games += 1
          matchupMap.set(key, matchup)
        }
      }
    }

    const matchups = Array.from(matchupMap.values())

    const playerMatchups: PlayerMatchup[] = selectedPlayer
      ? matchups
          .filter((m) => m.p1 === selectedPlayer || m.p2 === selectedPlayer)
          .map((m) => {
            const isP1 = m.p1 === selectedPlayer
            const wins = isP1 ? m.p1Wins : m.p2Wins
            const losses = isP1 ? m.p2Wins : m.p1Wins
            const ties = m.ties
            const games = wins + losses + ties
            const winPct = games > 0 ? (wins / games) * 100 : 0

            return {
              opponent: isP1 ? m.p2 : m.p1,
              wins,
              losses,
              ties,
              games,
              winPct,
              diff: wins - losses,
            }
          })
          .sort((a, b) => {
            if (b.diff !== a.diff) return b.diff - a.diff
            if (b.wins !== a.wins) return b.wins - a.wins
            return a.opponent.localeCompare(b.opponent, "sv")
          })
      : []

    const totalWins = playerMatchups.reduce((s, m) => s + m.wins, 0)
    const totalLosses = playerMatchups.reduce((s, m) => s + m.losses, 0)
    const totalTies = playerMatchups.reduce((s, m) => s + m.ties, 0)
    const totalGames = totalWins + totalLosses + totalTies
    const selectedWinPct = totalGames > 0 ? (totalWins / totalGames) * 100 : 0

    const bestRecord =
      playerMatchups.length > 0
        ? [...playerMatchups].sort((a, b) => {
            if (b.diff !== a.diff) return b.diff - a.diff
            return b.winPct - a.winPct
          })[0]
        : null

    const worstRecord =
      playerMatchups.length > 0
        ? [...playerMatchups].sort((a, b) => {
            if (a.diff !== b.diff) return a.diff - b.diff
            return a.winPct - b.winPct
          })[0]
        : null

    const mostPlayedMatchup =
      matchups.length > 0
        ? [...matchups].sort((a, b) => b.games - a.games)[0]
        : null

    const biggestDominance =
      matchups.length > 0
        ? [...matchups].sort((a, b) => {
            const aDiff = Math.abs(a.p1Wins - a.p2Wins)
            const bDiff = Math.abs(b.p1Wins - b.p2Wins)
            return bDiff - aDiff
          })[0]
        : null

    return {
      filtered,
      playedRows,
      players,
      matchups,
      playerMatchups,
      totalWins,
      totalLosses,
      totalTies,
      totalGames,
      selectedWinPct,
      bestRecord,
      worstRecord,
      mostPlayedMatchup,
      biggestDominance,
      competitionsCount: byCompetition.size,
    }
  }, [lbRows, selectedYear, selectedPlayer])

  return (
    <div className="flex flex-col gap-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/10" />
        <div className="absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-secondary/70" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Rivalitet
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Head-to-Head
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Se vem som slår vem över tid. Head-to-head räknas per tävling där
              båda spelarna har en registrerad placering.
            </p>
          </div>

          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-full sm:w-40">
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
      </section>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Kunde inte hämta data
          </div>
          <div className="mt-1 text-muted-foreground">{error}</div>
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : dashboard.players.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Stats */}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Spelare"
              value={`${dashboard.players.length} st`}
              sub="Med registrerad placering"
              icon={Users}
            />

            <StatCard
              title="Deltävlingar"
              value={`${dashboard.competitionsCount} st`}
              sub="Med head-to-head-data"
              icon={Target}
            />

            <StatCard
              title="Matchups"
              value={`${dashboard.matchups.length} st`}
              sub="Unika spelardueller"
              icon={Swords}
            />

            <StatCard
              title="Mest spelad duell"
              value={
                dashboard.mostPlayedMatchup
                  ? `${dashboard.mostPlayedMatchup.p1}–${dashboard.mostPlayedMatchup.p2}`
                  : "Saknas"
              }
              sub={
                dashboard.mostPlayedMatchup
                  ? `${dashboard.mostPlayedMatchup.games} möten`
                  : "Ingen data"
              }
              icon={Trophy}
            />
          </section>

          {/* Main area */}
          <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Matchup-matris
                </CardTitle>
              </CardHeader>

              <CardContent>
                <MatchupMatrix
                  players={dashboard.players}
                  matchups={dashboard.matchups}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <UserRound className="h-5 w-5 text-primary" />
                  Välj spelare
                </CardTitle>
              </CardHeader>

              <CardContent>
                <PlayerSelector
                  players={dashboard.players}
                  selectedPlayer={selectedPlayer}
                  onSelect={setSelectedPlayer}
                />
              </CardContent>
            </Card>
          </section>

          {/* Selected player */}
          {selectedPlayer && (
            <SelectedPlayerSection
              selectedPlayer={selectedPlayer}
              playerMatchups={dashboard.playerMatchups}
              totalWins={dashboard.totalWins}
              totalLosses={dashboard.totalLosses}
              totalTies={dashboard.totalTies}
              totalGames={dashboard.totalGames}
              selectedWinPct={dashboard.selectedWinPct}
              bestRecord={dashboard.bestRecord}
              worstRecord={dashboard.worstRecord}
            />
          )}

          {!selectedPlayer && (
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                  <div className="font-semibold text-foreground">
                    Välj en spelare för detaljerad vy.
                  </div>
                  <p>
                    Då visas spelarens record mot varje motståndare, total
                    vinstprocent, bästa matchup och tuffaste matchup.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

// ─── Components ───────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
}: {
  title: string
  value: ReactNode
  sub: string
  icon: ComponentType<{ className?: string }>
}) {
  return (
    <Card>
      <CardContent className="flex h-full flex-col justify-between gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-muted-foreground">
            {title}
          </div>

          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        </div>

        <div>
          <div className="text-2xl font-extrabold tracking-tight text-foreground">
            {value}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">{sub}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function MatchupMatrix({
  players,
  matchups,
}: {
  players: string[]
  matchups: Matchup[]
}) {
  function getMatchup(p1: string, p2: string) {
    return matchups.find(
      (m) => (m.p1 === p1 && m.p2 === p2) || (m.p1 === p2 && m.p2 === p1)
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40">
              <th className="sticky left-0 z-10 bg-secondary px-3 py-3 text-left font-bold text-foreground">
                Spelare
              </th>

              {players.map((p) => (
                <th
                  key={p}
                  className="px-3 py-3 text-center text-xs font-bold text-muted-foreground"
                >
                  {p.slice(0, 4)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {players.map((p1) => (
              <tr key={p1} className="border-b border-border/60 last:border-0">
                <td className="sticky left-0 z-10 bg-card px-3 py-3 font-bold text-foreground">
                  {p1}
                </td>

                {players.map((p2) => {
                  if (p1 === p2) {
                    return (
                      <td key={p2} className="px-2 py-2 text-center">
                        <span className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-secondary/40 text-muted-foreground">
                          —
                        </span>
                      </td>
                    )
                  }

                  const matchup = getMatchup(p1, p2)

                  if (!matchup) {
                    return (
                      <td key={p2} className="px-2 py-2 text-center">
                        <span className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-muted/40 text-muted-foreground">
                          –
                        </span>
                      </td>
                    )
                  }

                  const isP1 = matchup.p1 === p1
                  const wins = isP1 ? matchup.p1Wins : matchup.p2Wins
                  const losses = isP1 ? matchup.p2Wins : matchup.p1Wins
                  const tone = getResultTone(wins, losses)
                  const classes = getToneClasses(tone)

                  return (
                    <td key={p2} className="px-2 py-2 text-center">
                      <span
                        className={`inline-flex h-9 w-full items-center justify-center rounded-lg border text-xs font-black tabular-nums ${classes.bg} ${classes.text} ${classes.border}`}
                        title={`${p1} mot ${p2}: ${wins}–${losses}${
                          matchup.ties > 0 ? `, ${matchup.ties} oavgjorda` : ""
                        }`}
                      >
                        {wins}–{losses}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Läs rader horisontellt. Grönt betyder plusrecord, rött betyder
        minusrecord och grått betyder jämnt.
      </p>
    </div>
  )
}

function PlayerSelector({
  players,
  selectedPlayer,
  onSelect,
}: {
  players: string[]
  selectedPlayer: string
  onSelect: (player: string) => void
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      {players.map((p) => {
        const selected = selectedPlayer === p

        return (
          <button
            key={p}
            type="button"
            onClick={() => onSelect(selected ? "" : p)}
            className={
              selected
                ? "rounded-xl border border-primary bg-primary/10 px-3 py-3 text-left font-bold text-primary transition-colors"
                : "rounded-xl border border-border bg-secondary/40 px-3 py-3 text-left font-semibold text-foreground transition-colors hover:bg-secondary/70"
            }
          >
            {p}
          </button>
        )
      })}
    </div>
  )
}

function SelectedPlayerSection({
  selectedPlayer,
  playerMatchups,
  totalWins,
  totalLosses,
  totalTies,
  totalGames,
  selectedWinPct,
  bestRecord,
  worstRecord,
}: {
  selectedPlayer: string
  playerMatchups: PlayerMatchup[]
  totalWins: number
  totalLosses: number
  totalTies: number
  totalGames: number
  selectedWinPct: number
  bestRecord: PlayerMatchup | null
  worstRecord: PlayerMatchup | null
}) {
  if (playerMatchups.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">
            Ingen head-to-head-data hittades för {selectedPlayer}.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-primary" />
            {selectedPlayer} vs alla
          </CardTitle>
        </CardHeader>

        <CardContent>
          <section className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MiniStat
              title="Record"
              value={`${totalWins}–${totalLosses}`}
              sub={totalTies > 0 ? `${totalTies} oavgjorda` : "Inga oavgjorda"}
              icon={Swords}
            />

            <MiniStat
              title="Win rate"
              value={formatPct(selectedWinPct)}
              sub={`${totalGames} spelade head-to-heads`}
              icon={TrendingUp}
            />

            <MiniStat
              title="Bäst mot"
              value={bestRecord?.opponent ?? "–"}
              sub={
                bestRecord
                  ? `${bestRecord.wins}–${bestRecord.losses}${
                      bestRecord.ties > 0 ? `, ${bestRecord.ties} oavgjorda` : ""
                    }`
                  : "Ingen data"
              }
              icon={Crown}
            />

            <MiniStat
              title="Tuffast mot"
              value={worstRecord?.opponent ?? "–"}
              sub={
                worstRecord
                  ? `${worstRecord.wins}–${worstRecord.losses}${
                      worstRecord.ties > 0 ? `, ${worstRecord.ties} oavgjorda` : ""
                    }`
                  : "Ingen data"
              }
              icon={TrendingDown}
            />
          </section>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {playerMatchups.map((mu) => (
              <PlayerMatchupCard key={mu.opponent} matchup={mu} />
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

function MiniStat({
  title,
  value,
  sub,
  icon: Icon,
}: {
  title: string
  value: ReactNode
  sub: string
  icon: ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/30 p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>

      <div className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">
        {value}
      </div>

      <div className="mt-1 text-sm text-muted-foreground">{sub}</div>
    </div>
  )
}

function PlayerMatchupCard({ matchup }: { matchup: PlayerMatchup }) {
  const tone = getResultTone(matchup.wins, matchup.losses)
  const classes = getToneClasses(tone)

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-4 shadow-sm ${classes.border} ${classes.bg}`}
    >
      <div className="absolute right-3 top-3 text-5xl font-black leading-none text-muted-foreground/10">
        {matchup.diff > 0 ? "+" : ""}
        {matchup.diff}
      </div>

      <div className="relative flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-extrabold text-foreground">
              {matchup.opponent}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="font-bold tabular-nums text-foreground">
                {matchup.wins}–{matchup.losses}
              </span>

              {matchup.ties > 0 && (
                <span className="rounded-full bg-background/70 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                  {matchup.ties} oavgjorda
                </span>
              )}
            </div>
          </div>

          <span
            className={`rounded-full bg-background/80 px-2.5 py-1 text-xs font-bold ${classes.text}`}
          >
            {getResultLabel(matchup.wins, matchup.losses)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-background/70 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Trophy className="h-3.5 w-3.5 text-primary" />
              Win rate
            </div>
            <div className={`mt-1 text-xl font-black ${classes.text}`}>
              {formatPct(matchup.winPct)}
            </div>
          </div>

          <div className="rounded-xl bg-background/70 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Scale className="h-3.5 w-3.5 text-primary" />
              Möten
            </div>
            <div className="mt-1 text-xl font-black text-foreground">
              {matchup.games}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="h-96 animate-pulse rounded-2xl bg-muted" />
        <div className="h-96 animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="rounded-full bg-secondary p-4">
          <Swords className="h-8 w-8 text-muted-foreground" />
        </div>

        <div>
          <div className="text-lg font-bold text-foreground">Ingen data</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Säkerställ att det finns leaderboard-resultat med placeringar för
            valt år.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
