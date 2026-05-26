"use client"

import { useEffect, useMemo, useState } from "react"
import type { ComponentType, ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Crown,
  Flame,
  Medal,
  Skull,
  Sparkles,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserRound,
  Users,
  Swords,
  Rabbit,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type PlayerRow = {
  id: number | string
  spelarnamn: string
  namn_full: string | null
  golfid: string | null
  aktiv: number | boolean | null
}

type LBRow = {
  spelare: string
  poang: number
  placering: number
  antal_spelare: number
  motPar: number | null
  tavling: string
  bana: string | null
}

type CompetitionRow = {
  datum: string
  bana: string | null
}

type PlayerStats = {
  totalPoang: number
  antalTavlingar: number
  antalVinster: number
  antalSista: number
  snittMotPar: number | null
  snittPoang: number | null
  bastaMotPar: number | null
  samstaMotPar: number | null
  winRate: number | null
  latestPlacement: number | null
  latestPoang: number | null
  latestMotPar: number | null
  latestDate: string | null
  formPlacements: Array<number | null>
  streak: { type: "win" | "top3" | "last" | null; count: number }
  nemesis: { spelare: string; wins: number; losses: number } | null
  offer: { spelare: string; wins: number; losses: number } | null
}

type PlayerWithStats = {
  player: PlayerRow
  stats: PlayerStats
  rank: number
}

const PLAYERS_TABLE = "spelare"
const LB_TABLE = "leaderboard"
const COMPETITIONS_TABLE = "competitions"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isActive(v: PlayerRow["aktiv"]) {
  if (typeof v === "boolean") return v
  return Number(v) === 1
}

function displayName(p: PlayerRow) {
  const full = (p.namn_full ?? "").trim()
  return full.length > 0 ? full : p.spelarnamn
}

function formatSigned(n: number | null | undefined, decimals = 1): string {
  if (n === null || n === undefined) return "–"
  const val = parseFloat(Number(n).toFixed(decimals))
  return val > 0 ? `+${val}` : `${val}`
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "–"
  const date = new Date(`${dateStr.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateStr
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date)
}

function formatCourse(course: string | null | undefined) {
  const value = (course ?? "").trim()
  return value.length > 0 ? value : "–"
}

// Build head-to-head map: for each pair, how many times did each win?
function buildH2H(lbRows: LBRow[]): Map<string, Map<string, { wins: number; losses: number }>> {
  // Group by competition
  const byComp = new Map<string, LBRow[]>()
  for (const r of lbRows) {
    if (Number(r.placering) <= 0) continue
    const arr = byComp.get(r.tavling) ?? []
    arr.push(r)
    byComp.set(r.tavling, arr)
  }

  // result[p1][p2] = { wins: p1 beat p2, losses: p2 beat p1 }
  const result = new Map<string, Map<string, { wins: number; losses: number }>>()

  for (const comp of byComp.values()) {
    for (let i = 0; i < comp.length; i++) {
      for (let j = i + 1; j < comp.length; j++) {
        const a = comp[i]
        const b = comp[j]

        // Lower placering = better
        const aWon = Number(a.placering) < Number(b.placering)
        const bWon = Number(b.placering) < Number(a.placering)

        if (!aWon && !bWon) continue // tie, skip

        const updateFor = (p1: string, p2: string, won: boolean) => {
          if (!result.has(p1)) result.set(p1, new Map())
          const inner = result.get(p1)!
          const cur = inner.get(p2) ?? { wins: 0, losses: 0 }
          if (won) cur.wins += 1
          else cur.losses += 1
          inner.set(p2, cur)
        }

        updateFor(a.spelare, b.spelare, aWon)
        updateFor(b.spelare, a.spelare, bWon)
      }
    }
  }

  return result
}

function calcStreak(rows: LBRow[]): { type: "win" | "top3" | "last" | null; count: number } {
  const played = rows
    .filter((r) => Number(r.placering) > 0)
    .sort((a, b) => a.tavling.localeCompare(b.tavling))

  if (played.length === 0) return { type: null, count: 0 }

  const last = played[played.length - 1]

  // Check win streak
  let winStreak = 0
  for (let i = played.length - 1; i >= 0; i--) {
    if (Number(played[i].placering) === 1) winStreak++
    else break
  }
  if (winStreak >= 2) return { type: "win", count: winStreak }

  // Check top3 streak
  let top3Streak = 0
  for (let i = played.length - 1; i >= 0; i--) {
    if (Number(played[i].placering) <= 3) top3Streak++
    else break
  }
  if (top3Streak >= 2) return { type: "top3", count: top3Streak }

  // Check last-place streak
  let lastStreak = 0
  for (let i = played.length - 1; i >= 0; i--) {
    if (Number(played[i].placering) === Number(played[i].antal_spelare)) lastStreak++
    else break
  }
  if (lastStreak >= 2) return { type: "last", count: lastStreak }

  return { type: null, count: 0 }
}

function calcStats(
  rows: LBRow[],
  h2h: Map<string, { wins: number; losses: number }>
): PlayerStats {
  const played = rows
    .filter((r) => Number(r.placering) > 0)
    .sort((a, b) => a.tavling.localeCompare(b.tavling))

  const withPar = played.filter((r) => r.motPar !== null && r.motPar !== undefined)
  const latestRow = played.at(-1) ?? null
  const latest3Dates = Array.from(new Set(played.map((r) => r.tavling))).slice(-3)
  const rowByDate = new Map<string, LBRow>()
  for (const r of played) rowByDate.set(r.tavling, r)

  const antalVinster = played.filter((r) => Number(r.placering) === 1).length
  const antalTavlingar = played.length

  // Nemesis: person I lose to most (min 2 encounters)
  const h2hEntries = Array.from(h2h.entries())
    .filter(([, v]) => v.wins + v.losses >= 2)

  const nemesis = h2hEntries
    .filter(([, v]) => v.losses > v.wins)
    .sort((a, b) => {
      const aDiff = a[1].losses - a[1].wins
      const bDiff = b[1].losses - b[1].wins
      return bDiff - aDiff
    })[0]

  // Offer: person I beat most (min 2 encounters)
  const offer = h2hEntries
    .filter(([, v]) => v.wins > v.losses)
    .sort((a, b) => {
      const aDiff = a[1].wins - a[1].losses
      const bDiff = b[1].wins - b[1].losses
      return bDiff - aDiff
    })[0]

  return {
    totalPoang: played.reduce((s, r) => s + Number(r.poang ?? 0), 0),
    antalTavlingar,
    antalVinster,
    antalSista: played.filter(
      (r) => Number(r.placering) === Number(r.antal_spelare)
    ).length,
    snittMotPar:
      withPar.length > 0
        ? withPar.reduce((s, r) => s + Number(r.motPar ?? 0), 0) / withPar.length
        : null,
    snittPoang:
      antalTavlingar > 0
        ? played.reduce((s, r) => s + Number(r.poang ?? 0), 0) / antalTavlingar
        : null,
    bastaMotPar:
      withPar.length > 0 ? Math.min(...withPar.map((r) => Number(r.motPar ?? 0))) : null,
    samstaMotPar:
      withPar.length > 0 ? Math.max(...withPar.map((r) => Number(r.motPar ?? 0))) : null,
    winRate:
      antalTavlingar > 0 ? Math.round((antalVinster / antalTavlingar) * 100) : null,
    latestPlacement: latestRow ? Number(latestRow.placering) : null,
    latestPoang: latestRow ? Number(latestRow.poang ?? 0) : null,
    latestMotPar: latestRow ? latestRow.motPar : null,
    latestDate: latestRow?.tavling ?? null,
    formPlacements: latest3Dates.map((date) => rowByDate.get(date)?.placering ?? null),
    streak: calcStreak(rows),
    nemesis: nemesis
      ? { spelare: nemesis[0], wins: nemesis[1].wins, losses: nemesis[1].losses }
      : null,
    offer: offer
      ? { spelare: offer[0], wins: offer[1].wins, losses: offer[1].losses }
      : null,
  }
}

function hasValidMotPar(round: LBRow) {
  return round.motPar !== null && round.motPar !== undefined && !Number.isNaN(Number(round.motPar))
}

function compareRoundsBestToWorst(a: LBRow, b: LBRow) {
  const aHasPar = hasValidMotPar(a)
  const bHasPar = hasValidMotPar(b)

  // Primary sort: lower motPar = better round
  if (aHasPar && bHasPar && Number(a.motPar) !== Number(b.motPar)) {
    return Number(a.motPar) - Number(b.motPar)
  }

  // Rounds with motPar should be shown before rounds without motPar
  if (aHasPar && !bHasPar) return -1
  if (!aHasPar && bHasPar) return 1

  // Fallbacks if motPar is tied/missing
  if (Number(a.placering) !== Number(b.placering)) {
    return Number(a.placering) - Number(b.placering)
  }

  if (Number(a.poang ?? 0) !== Number(b.poang ?? 0)) {
    return Number(b.poang ?? 0) - Number(a.poang ?? 0)
  }

  return b.tavling.localeCompare(a.tavling)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SpelarePage() {
  const supabase = useMemo(() => createClient(), [])

  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [lbRows, setLbRows] = useState<LBRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRoundsPlayer, setSelectedRoundsPlayer] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const [
        { data: playerData, error: playerErr },
        { data: lbData, error: lbErr },
        { data: competitionData, error: competitionErr },
      ] = await Promise.all([
        supabase
          .from(PLAYERS_TABLE)
          .select("id, spelarnamn, golfid, aktiv, namn_full")
          .order("aktiv", { ascending: false })
          .order("namn_full", { ascending: true, nullsFirst: false }),

        supabase
          .from(LB_TABLE)
          .select(
            `
            tavling:tävling,
            spelare,
            poang:poäng,
            placering,
            antal_spelare,
            motPar:mot_par
          `
          ),

        supabase
          .from(COMPETITIONS_TABLE)
          .select("datum, bana"),
      ])

      if (cancelled) return

      if (playerErr) { setError(playerErr.message); setLoading(false); return }
      if (lbErr) { setError(lbErr.message); setLoading(false); return }
      if (competitionErr) { setError(competitionErr.message); setLoading(false); return }

      const courseByDate = new Map(
        ((competitionData ?? []) as CompetitionRow[]).map((competition) => [
          String(competition.datum).slice(0, 10),
          competition.bana,
        ])
      )

      const lbRowsWithCourse = ((lbData ?? []) as Omit<LBRow, "bana">[]).map((row) => ({
        ...row,
        bana: courseByDate.get(String(row.tavling).slice(0, 10)) ?? null,
      }))

      setPlayers((playerData ?? []) as PlayerRow[])
      setLbRows(lbRowsWithCourse)
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [supabase])

  const dashboard = useMemo(() => {
    const rowsByPlayer = new Map<string, LBRow[]>()
    for (const r of lbRows) {
      const arr = rowsByPlayer.get(r.spelare) ?? []
      arr.push(r)
      rowsByPlayer.set(r.spelare, arr)
    }

    // Build global H2H map
    const globalH2H = buildH2H(lbRows)

    const statsByPlayer = new Map<string, PlayerStats>()
    for (const p of players) {
      const h2h = globalH2H.get(p.spelarnamn) ?? new Map()
      statsByPlayer.set(
        p.spelarnamn,
        calcStats(rowsByPlayer.get(p.spelarnamn) ?? [], h2h)
      )
    }

    const activePlayers = players
      .filter((p) => isActive(p.aktiv))
      .map((p) => ({
        player: p,
        stats: statsByPlayer.get(p.spelarnamn) ?? calcStats([], new Map()),
        rank: 0,
      }))
      .sort((a, b) => {
        if (b.stats.totalPoang !== a.stats.totalPoang) return b.stats.totalPoang - a.stats.totalPoang
        if (b.stats.antalVinster !== a.stats.antalVinster) return b.stats.antalVinster - a.stats.antalVinster
        return displayName(a.player).localeCompare(displayName(b.player), "sv")
      })
      .map((row, idx) => ({ ...row, rank: idx + 1 }))

    const retiredPlayers = players
      .filter((p) => !isActive(p.aktiv))
      .map((p) => ({
        player: p,
        stats: statsByPlayer.get(p.spelarnamn) ?? calcStats([], new Map()),
        rank: 0,
      }))
      .sort((a, b) => displayName(a.player).localeCompare(displayName(b.player), "sv"))

    const allPlayerStats = [...activePlayers, ...retiredPlayers]

    const allTimeLeader = activePlayers[0] ?? null
    const mostWins = allPlayerStats.filter((p) => p.stats.antalVinster > 0)
      .sort((a, b) => b.stats.antalVinster - a.stats.antalVinster)[0] ?? null
    const bestAvgPar = allPlayerStats
      .filter((p) => p.stats.snittMotPar !== null && p.stats.antalTavlingar >= 3)
      .sort((a, b) => Number(a.stats.snittMotPar) - Number(b.stats.snittMotPar))[0] ?? null
    const mostPlayed = allPlayerStats
      .filter((p) => p.stats.antalTavlingar > 0)
      .sort((a, b) => b.stats.antalTavlingar - a.stats.antalTavlingar)[0] ?? null
    const totalCompetitions = new Set(
      lbRows.filter((r) => Number(r.placering) > 0).map((r) => r.tavling)
    ).size

    return {
      activePlayers,
      retiredPlayers,
      allPlayerStats,
      allTimeLeader,
      mostWins,
      bestAvgPar,
      mostPlayed,
      totalCompetitions,
    }
  }, [players, lbRows])

  return (
    <div className="flex flex-col gap-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/10" />
        <div className="absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-secondary/70" />

        <div className="relative flex flex-col gap-3">
          <div className="mb-1 inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Player profiles
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Spelare
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Spelarprofiler, all-time-statistik, form, vinster och snitt mot par.
            Aktiva spelare sorteras efter totala poäng.
          </p>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Kunde inte hämta spelare
          </div>
          <div className="mt-1 text-muted-foreground">{error}</div>
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : players.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Stat cards */}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Aktiva spelare"
              value={`${dashboard.activePlayers.length} st`}
              sub={`${players.length} spelare totalt`}
              icon={Users}
            />
            <StatCard
              title="All-time ledare"
              value={dashboard.allTimeLeader?.player.spelarnamn ?? "Saknas"}
              sub={
                dashboard.allTimeLeader
                  ? `${dashboard.allTimeLeader.stats.totalPoang} poäng`
                  : "Ingen data"
              }
              icon={Crown}
            />
            <StatCard
              title="Flest vinster"
              value={dashboard.mostWins?.player.spelarnamn ?? "Saknas"}
              sub={
                dashboard.mostWins
                  ? `${dashboard.mostWins.stats.antalVinster} vinster`
                  : "Ingen vinnare"
              }
              icon={Trophy}
            />
            <StatCard
              title="Bäst snitt mot par"
              value={dashboard.bestAvgPar?.player.spelarnamn ?? "Saknas"}
              sub={
                dashboard.bestAvgPar
                  ? `${formatSigned(dashboard.bestAvgPar.stats.snittMotPar)} · minst 3 rundor`
                  : "För lite data"
              }
              icon={TrendingUp}
            />
          </section>

          {/* Top 5 + overview */}
          <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Medal className="h-5 w-5 text-primary" />
                  Topp 5 all-time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TopFive players={dashboard.activePlayers} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Snabböversikt
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoBox
                    label="Registrerade deltävlingar"
                    value={dashboard.totalCompetitions}
                    icon={CalendarDays}
                  />
                  <InfoBox
                    label="Flest starter"
                    value={
                      dashboard.mostPlayed
                        ? `${dashboard.mostPlayed.player.spelarnamn} · ${dashboard.mostPlayed.stats.antalTavlingar}`
                        : "–"
                    }
                    icon={Target}
                  />
                  <InfoBox
                    label="Högst vinstprocent"
                    value={(() => {
                      const top = dashboard.activePlayers
                        .filter((p) => p.stats.antalTavlingar >= 3 && p.stats.winRate !== null)
                        .sort((a, b) => Number(b.stats.winRate) - Number(a.stats.winRate))[0]
                      return top ? `${top.player.spelarnamn} · ${top.stats.winRate}%` : "–"
                    })()}
                    icon={Flame}
                  />
                  <InfoBox
                    label="Pensionerade"
                    value={`${dashboard.retiredPlayers.length} st`}
                    icon={UserRound}
                  />
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Player cards */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-primary" />
                Aktiva spelare
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard.activePlayers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Inga aktiva spelare hittades.</p>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {dashboard.activePlayers.map((row) => (
                    <PlayerCard key={row.player.id} row={row} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Retired */}
          {dashboard.retiredPlayers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <UserRound className="h-5 w-5 text-primary" />
                  Pensionerade spelare
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {dashboard.retiredPlayers.map((row) => (
                    <RetiredPlayerCard key={row.player.id} row={row} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Registered rounds */}
          <PlayerRoundsSection
            players={dashboard.allPlayerStats}
            lbRows={lbRows}
            selectedPlayer={selectedRoundsPlayer}
            onSelectPlayer={setSelectedRoundsPlayer}
          />
        </>
      )}
    </div>
  )
}

// ─── Components ───────────────────────────────────────────────────────────────

function PlayerCard({ row }: { row: PlayerWithStats }) {
  const { player, stats, rank } = row
  const name = displayName(player)

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/10" />
      <div className="absolute right-4 top-4 text-6xl font-black leading-none text-muted-foreground/10">
        #{rank}
      </div>

      <div className="relative flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <RankBadge rank={rank} />
              <h3 className="text-xl font-extrabold tracking-tight text-foreground">
                {player.spelarnamn}
              </h3>
              {/* Streak badge */}
              <StreakBadge streak={stats.streak} />
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              {name !== player.spelarnamn ? name : "Namn saknas"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Golf-ID: {player.golfid && player.golfid.trim() !== "" ? player.golfid : "–"}
            </div>
          </div>

          <div className="rounded-2xl bg-primary/10 p-3 text-primary shrink-0">
            <UserRound className="h-6 w-6" />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Poäng" value={stats.totalPoang} icon={Trophy} highlight="good" />
          <MiniStat label="Tävlingar" value={stats.antalTavlingar} icon={Target} />
          <MiniStat label="Vinster" value={stats.antalVinster} icon={Star} highlight={stats.antalVinster > 0 ? "good" : "neutral"} />
          <MiniStat label="Sistaplatser" value={stats.antalSista} icon={Skull} highlight={stats.antalSista > 0 ? "bad" : "neutral"} />
        </div>

        {/* Par details */}
        <div className="grid gap-3 sm:grid-cols-3">
          <DetailBox label="Snitt mot par" value={formatSigned(stats.snittMotPar)} positive={stats.snittMotPar !== null && stats.snittMotPar <= 0} />
          <DetailBox label="Bästa runda" value={formatSigned(stats.bastaMotPar, 0)} positive />
          <DetailBox label="Sämsta runda" value={formatSigned(stats.samstaMotPar, 0)} negative />
        </div>

        {/* Latest + form */}
        <div className="flex flex-col gap-3 rounded-2xl bg-secondary/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Senaste start
            </div>
            <div className="mt-1 text-sm font-semibold text-foreground">
              {stats.latestDate
                ? `#${stats.latestPlacement}, ${stats.latestPoang} p · ${formatDate(stats.latestDate)}`
                : "Ingen start registrerad"}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {stats.formPlacements.length > 0 ? (
              stats.formPlacements.map((placement, idx) => (
                <FormBadge key={idx} placement={placement} />
              ))
            ) : (
              <span className="text-sm text-muted-foreground">Ingen formdata</span>
            )}
          </div>
        </div>

        {/* Nemesis & Offer — only show if data exists */}
        {(stats.nemesis || stats.offer) && (
          <div className="grid gap-2 sm:grid-cols-2">
            {stats.nemesis && (
              <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5">
                <Swords className="h-4 w-4 text-destructive shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase tracking-wide text-destructive">
                    Nemesis
                  </div>
                  <div className="text-sm font-semibold text-foreground truncate">
                    {stats.nemesis.spelare}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stats.nemesis.wins}–{stats.nemesis.losses} mot dem
                  </div>
                </div>
              </div>
            )}

            {stats.offer && (
              <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
                <Rabbit className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase tracking-wide text-primary">
                    Offer
                  </div>
                  <div className="text-sm font-semibold text-foreground truncate">
                    {stats.offer.spelare}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stats.offer.wins}–{stats.offer.losses} mot dem
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StreakBadge({
  streak,
}: {
  streak: { type: "win" | "top3" | "last" | null; count: number }
}) {
  if (!streak.type || streak.count < 2) return null

  if (streak.type === "win") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
        🔥 {streak.count} raka vinster
      </span>
    )
  }

  if (streak.type === "top3") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
        ⬆️ {streak.count} raka topp-3
      </span>
    )
  }

  if (streak.type === "last") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-bold text-destructive">
        💀 {streak.count} raka sistaplatser
      </span>
    )
  }

  return null
}

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
          <div className="text-sm font-medium text-muted-foreground">{title}</div>
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-extrabold tracking-tight text-foreground">{value}</div>
          <div className="mt-1 text-sm text-muted-foreground">{sub}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function InfoBox({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: ReactNode
  icon: ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/30 p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      <div className="mt-2 font-bold text-foreground">{value}</div>
    </div>
  )
}

function TopFive({ players }: { players: PlayerWithStats[] }) {
  if (players.length === 0) {
    return <p className="text-sm text-muted-foreground">Ingen data hittades.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {players.slice(0, 5).map((row) => (
        <div
          key={row.player.id}
          className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2"
        >
          <div className="flex items-center gap-3">
            <RankBadge rank={row.rank} />
            <div>
              <div className="font-bold text-foreground">{row.player.spelarnamn}</div>
              <div className="text-xs text-muted-foreground">
                {row.stats.antalVinster} vinster · {row.stats.antalTavlingar} tävlingar
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-extrabold tabular-nums text-foreground">{row.stats.totalPoang}</div>
            <div className="text-xs text-muted-foreground">poäng</div>
          </div>
        </div>
      ))}
    </div>
  )
}


function PlayerRoundsSection({
  players,
  lbRows,
  selectedPlayer,
  onSelectPlayer,
}: {
  players: PlayerWithStats[]
  lbRows: LBRow[]
  selectedPlayer: string | null
  onSelectPlayer: (player: string) => void
}) {
  const availablePlayers = players
    .filter((row) => row.stats.antalTavlingar > 0)
    .sort((a, b) => {
      const activeDiff = Number(isActive(b.player.aktiv)) - Number(isActive(a.player.aktiv))
      if (activeDiff !== 0) return activeDiff
      return displayName(a.player).localeCompare(displayName(b.player), "sv")
    })

  const selectedName =
    selectedPlayer && availablePlayers.some((row) => row.player.spelarnamn === selectedPlayer)
      ? selectedPlayer
      : availablePlayers[0]?.player.spelarnamn ?? null

  const selectedRow = selectedName
    ? availablePlayers.find((row) => row.player.spelarnamn === selectedName) ?? null
    : null

  const rounds = useMemo(() => {
    if (!selectedName) return []

    return lbRows
      .filter((round) => round.spelare === selectedName && Number(round.placering) > 0)
      .sort(compareRoundsBestToWorst)
  }, [lbRows, selectedName])

  const bestRound = rounds[0] ?? null
  const worstRound = rounds.at(-1) ?? null

  if (availablePlayers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarDays className="h-5 w-5 text-primary" />
            Registrerade ronder
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Inga registrerade ronder hittades.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5 text-primary" />
              Registrerade ronder per spelare
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Klicka på en spelare för att se alla registrerade ronder, sorterade från bästa till sämsta rond.
            </p>
          </div>

          {selectedRow && (
            <div className="w-fit rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
              {selectedRow.stats.antalTavlingar} ronder
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-2">
          {availablePlayers.map((row) => {
            const isSelected = row.player.spelarnamn === selectedName

            return (
              <button
                key={row.player.id}
                type="button"
                onClick={() => onSelectPlayer(row.player.spelarnamn)}
                className={`rounded-full border px-3 py-1.5 text-sm font-bold transition ${
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-background text-foreground hover:bg-secondary/60"
                }`}
              >
                {row.player.spelarnamn}
              </button>
            )
          })}
        </div>

        {selectedRow ? (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <InfoBox
                label="Bästa rond"
                value={
                  bestRound
                    ? `${formatSigned(bestRound.motPar, 0)} · ${formatCourse(bestRound.bana)}`
                    : "–"
                }
                icon={TrendingUp}
              />
              <InfoBox
                label="Sämsta rond"
                value={
                  worstRound
                    ? `${formatSigned(worstRound.motPar, 0)} · ${formatCourse(worstRound.bana)}`
                    : "–"
                }
                icon={TrendingDown}
              />
              <InfoBox
                label="Snitt mot par"
                value={formatSigned(selectedRow.stats.snittMotPar)}
                icon={Target}
              />
            </div>

            <div className="overflow-hidden rounded-2xl border border-border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold">Rank</th>
                      <th className="px-4 py-3 text-left font-bold">Tävling</th>
                      <th className="px-4 py-3 text-left font-bold">Bana</th>
                      <th className="px-4 py-3 text-right font-bold">Mot par</th>
                      <th className="px-4 py-3 text-right font-bold">Placering</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {rounds.map((round, idx) => (
                      <tr key={`${round.spelare}-${round.tavling}-${idx}`} className="hover:bg-secondary/30">
                        <td className="px-4 py-3 font-black text-foreground">#{idx + 1}</td>
                        <td className="px-4 py-3 font-semibold text-foreground">
                          {formatDate(round.tavling)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatCourse(round.bana)}
                        </td>
                        <td className="px-4 py-3 text-right font-black tabular-nums text-foreground">
                          {formatSigned(round.motPar, 0)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          #{round.placering} av {round.antal_spelare}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Välj en spelare för att visa registrerade ronder.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function RetiredPlayerCard({ row }: { row: PlayerWithStats }) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/25 p-4">
      <div className="font-bold text-foreground">{row.player.spelarnamn}</div>
      <div className="mt-1 text-sm text-muted-foreground">{displayName(row.player)}</div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-background p-3">
          <div className="text-xs text-muted-foreground">Poäng</div>
          <div className="font-bold text-foreground">{row.stats.totalPoang}</div>
        </div>
        <div className="rounded-xl bg-background p-3">
          <div className="text-xs text-muted-foreground">Tävlingar</div>
          <div className="font-bold text-foreground">{row.stats.antalTavlingar}</div>
        </div>
      </div>
    </div>
  )
}

function MiniStat({
  label,
  value,
  icon: Icon,
  highlight = "neutral",
}: {
  label: string
  value: ReactNode
  icon: ComponentType<{ className?: string }>
  highlight?: "good" | "bad" | "neutral"
}) {
  const valueClass =
    highlight === "good" ? "text-primary" : highlight === "bad" ? "text-destructive" : "text-foreground"

  return (
    <div className="rounded-xl bg-secondary/40 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {label}
      </div>
      <div className={`mt-1 text-xl font-extrabold tabular-nums ${valueClass}`}>{value}</div>
    </div>
  )
}

function DetailBox({
  label,
  value,
  positive = false,
  negative = false,
}: {
  label: string
  value: ReactNode
  positive?: boolean
  negative?: boolean
}) {
  const valueClass = positive ? "text-primary" : negative ? "text-destructive" : "text-foreground"

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-black tabular-nums ${valueClass}`}>{value}</div>
    </div>
  )
}

function RankBadge({ rank }: { rank: number }) {
  const className =
    rank === 1
      ? "bg-primary text-primary-foreground"
      : rank === 2
        ? "bg-secondary text-secondary-foreground"
        : rank === 3
          ? "bg-secondary/70 text-secondary-foreground"
          : "bg-background text-foreground"

  return (
    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black shadow-sm ${className}`}>
      {rank}
    </div>
  )
}

function FormBadge({ placement }: { placement: number | null }) {
  if (!placement) {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-background text-xs font-bold text-muted-foreground">
        –
      </span>
    )
  }

  const className =
    placement === 1
      ? "bg-primary text-primary-foreground"
      : placement <= 3
        ? "bg-primary/10 text-primary"
        : "bg-background text-foreground"

  return (
    <span
      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${className}`}
      title={`Placering ${placement}`}
    >
      {placement}
    </span>
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
      <div className="grid gap-4 lg:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-80 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="rounded-full bg-secondary p-4">
          <Users className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <div className="text-lg font-bold text-foreground">Inga spelare hittades</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Kontrollera att tabellen spelare innehåller data.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
