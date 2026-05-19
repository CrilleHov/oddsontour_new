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
}

type PlayerWithStats = {
  player: PlayerRow
  stats: PlayerStats
  rank: number
}

const PLAYERS_TABLE = "spelare"
const LB_TABLE = "leaderboard"

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

function calcStats(rows: LBRow[]): PlayerStats {
  const played = rows
    .filter((r) => Number(r.placering) > 0)
    .sort((a, b) => a.tavling.localeCompare(b.tavling))

  const withPar = played.filter(
    (r) => r.motPar !== null && r.motPar !== undefined
  )

  const latestRow = played.at(-1) ?? null
  const latest3Dates = Array.from(new Set(played.map((r) => r.tavling))).slice(-3)

  const rowByDate = new Map<string, LBRow>()

  for (const r of played) {
    rowByDate.set(r.tavling, r)
  }

  const antalVinster = played.filter((r) => Number(r.placering) === 1).length
  const antalTavlingar = played.length

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
      withPar.length > 0
        ? Math.min(...withPar.map((r) => Number(r.motPar ?? 0)))
        : null,
    samstaMotPar:
      withPar.length > 0
        ? Math.max(...withPar.map((r) => Number(r.motPar ?? 0)))
        : null,
    winRate:
      antalTavlingar > 0 ? Math.round((antalVinster / antalTavlingar) * 100) : null,
    latestPlacement: latestRow ? Number(latestRow.placering) : null,
    latestPoang: latestRow ? Number(latestRow.poang ?? 0) : null,
    latestMotPar: latestRow ? latestRow.motPar : null,
    latestDate: latestRow?.tavling ?? null,
    formPlacements: latest3Dates.map((date) => rowByDate.get(date)?.placering ?? null),
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SpelarePage() {
  const supabase = useMemo(() => createClient(), [])

  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [lbRows, setLbRows] = useState<LBRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const [
        { data: playerData, error: playerErr },
        { data: lbData, error: lbErr },
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
          )
          .returns<LBRow[]>(),
      ])

      if (cancelled) return

      if (playerErr) {
        setError(playerErr.message)
        setLoading(false)
        return
      }

      if (lbErr) {
        setError(lbErr.message)
        setLoading(false)
        return
      }

      setPlayers((playerData ?? []) as PlayerRow[])
      setLbRows((lbData ?? []) as LBRow[])
      setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [supabase])

  const dashboard = useMemo(() => {
    const rowsByPlayer = new Map<string, LBRow[]>()

    for (const r of lbRows) {
      const arr = rowsByPlayer.get(r.spelare) ?? []
      arr.push(r)
      rowsByPlayer.set(r.spelare, arr)
    }

    const statsByPlayer = new Map<string, PlayerStats>()

    for (const p of players) {
      statsByPlayer.set(p.spelarnamn, calcStats(rowsByPlayer.get(p.spelarnamn) ?? []))
    }

    const activePlayers = players
      .filter((p) => isActive(p.aktiv))
      .map((p) => ({
        player: p,
        stats: statsByPlayer.get(p.spelarnamn) ?? calcStats([]),
        rank: 0,
      }))
      .sort((a, b) => {
        if (b.stats.totalPoang !== a.stats.totalPoang) {
          return b.stats.totalPoang - a.stats.totalPoang
        }

        if (b.stats.antalVinster !== a.stats.antalVinster) {
          return b.stats.antalVinster - a.stats.antalVinster
        }

        return displayName(a.player).localeCompare(displayName(b.player), "sv")
      })
      .map((row, idx) => ({ ...row, rank: idx + 1 }))

    const retiredPlayers = players
      .filter((p) => !isActive(p.aktiv))
      .map((p) => ({
        player: p,
        stats: statsByPlayer.get(p.spelarnamn) ?? calcStats([]),
        rank: 0,
      }))
      .sort((a, b) => displayName(a.player).localeCompare(displayName(b.player), "sv"))

    const allPlayerStats = [...activePlayers, ...retiredPlayers]

    const allTimeLeader = activePlayers[0] ?? null

    const mostWins =
      allPlayerStats
        .filter((p) => p.stats.antalVinster > 0)
        .sort((a, b) => b.stats.antalVinster - a.stats.antalVinster)[0] ?? null

    const bestAvgPar =
      allPlayerStats
        .filter((p) => p.stats.snittMotPar !== null && p.stats.antalTavlingar >= 3)
        .sort((a, b) => Number(a.stats.snittMotPar) - Number(b.stats.snittMotPar))[0] ??
      null

    const mostPlayed =
      allPlayerStats
        .filter((p) => p.stats.antalTavlingar > 0)
        .sort((a, b) => b.stats.antalTavlingar - a.stats.antalTavlingar)[0] ??
      null

    const totalCompetitions = new Set(
      lbRows.filter((r) => Number(r.placering) > 0).map((r) => r.tavling)
    ).size

    return {
      activePlayers,
      retiredPlayers,
      allTimeLeader,
      mostWins,
      bestAvgPar,
      mostPlayed,
      totalCompetitions,
    }
  }, [players, lbRows])

  return (
    <div className="flex flex-col gap-6">
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
                    value={
                      dashboard.activePlayers
                        .filter((p) => p.stats.antalTavlingar >= 3 && p.stats.winRate !== null)
                        .sort((a, b) => Number(b.stats.winRate) - Number(a.stats.winRate))[0]
                        ? `${
                            dashboard.activePlayers
                              .filter(
                                (p) => p.stats.antalTavlingar >= 3 && p.stats.winRate !== null
                              )
                              .sort(
                                (a, b) => Number(b.stats.winRate) - Number(a.stats.winRate)
                              )[0].player.spelarnamn
                          } · ${
                            dashboard.activePlayers
                              .filter(
                                (p) => p.stats.antalTavlingar >= 3 && p.stats.winRate !== null
                              )
                              .sort(
                                (a, b) => Number(b.stats.winRate) - Number(a.stats.winRate)
                              )[0].stats.winRate
                          }%`
                        : "–"
                    }
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-primary" />
                Aktiva spelare
              </CardTitle>
            </CardHeader>

            <CardContent>
              {dashboard.activePlayers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Inga aktiva spelare hittades.
                </p>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {dashboard.activePlayers.map((row) => (
                    <PlayerCard key={row.player.id} row={row} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

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
          <div className="text-sm font-medium text-muted-foreground">{title}</div>
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
            <div className="font-extrabold tabular-nums text-foreground">
              {row.stats.totalPoang}
            </div>
            <div className="text-xs text-muted-foreground">poäng</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function PlayerCard({ row }: { row: PlayerWithStats }) {
  const { player, stats, rank } = row
  const name = displayName(player)

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/10" />
      <div className="absolute right-4 top-4 text-6xl font-black leading-none text-muted-foreground/10">
        #{rank}
      </div>

      <div className="relative flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <RankBadge rank={rank} />
              <h3 className="text-xl font-extrabold tracking-tight text-foreground">
                {player.spelarnamn}
              </h3>
            </div>

            <div className="mt-2 text-sm text-muted-foreground">
              {name !== player.spelarnamn ? name : "Namn saknas"}
            </div>

            <div className="mt-1 text-xs text-muted-foreground">
              Golf-ID: {player.golfid && player.golfid.trim() !== "" ? player.golfid : "–"}
            </div>
          </div>

          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <UserRound className="h-6 w-6" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat
            label="Poäng"
            value={stats.totalPoang}
            icon={Trophy}
            highlight="good"
          />
          <MiniStat
            label="Tävlingar"
            value={stats.antalTavlingar}
            icon={Target}
          />
          <MiniStat
            label="Vinster"
            value={stats.antalVinster}
            icon={Star}
            highlight={stats.antalVinster > 0 ? "good" : "neutral"}
          />
          <MiniStat
            label="Sistaplatser"
            value={stats.antalSista}
            icon={Skull}
            highlight={stats.antalSista > 0 ? "bad" : "neutral"}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <DetailBox
            label="Snitt mot par"
            value={formatSigned(stats.snittMotPar)}
            positive={stats.snittMotPar !== null && stats.snittMotPar <= 0}
          />
          <DetailBox
            label="Bästa runda"
            value={formatSigned(stats.bastaMotPar, 0)}
            positive
          />
          <DetailBox
            label="Sämsta runda"
            value={formatSigned(stats.samstaMotPar, 0)}
            negative
          />
        </div>

        <div className="flex flex-col gap-3 rounded-2xl bg-secondary/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Senaste start
            </div>
            <div className="mt-1 text-sm font-semibold text-foreground">
              {stats.latestDate
                ? `#${stats.latestPlacement}, ${stats.latestPoang} p · ${formatDate(
                    stats.latestDate
                  )}`
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
      </div>
    </div>
  )
}

function RetiredPlayerCard({ row }: { row: PlayerWithStats }) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/25 p-4">
      <div className="font-bold text-foreground">{row.player.spelarnamn}</div>
      <div className="mt-1 text-sm text-muted-foreground">
        {displayName(row.player)}
      </div>

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
    highlight === "good"
      ? "text-primary"
      : highlight === "bad"
        ? "text-destructive"
        : "text-foreground"

  return (
    <div className="rounded-xl bg-secondary/40 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {label}
      </div>
      <div className={`mt-1 text-xl font-extrabold tabular-nums ${valueClass}`}>
        {value}
      </div>
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
  const valueClass = positive
    ? "text-primary"
    : negative
      ? "text-destructive"
      : "text-foreground"

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 text-lg font-black tabular-nums ${valueClass}`}>
        {value}
      </div>
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
    <div
      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black shadow-sm ${className}`}
    >
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
          <div className="text-lg font-bold text-foreground">
            Inga spelare hittades
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Kontrollera att tabellen spelare innehåller data.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
