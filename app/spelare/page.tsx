"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Users,
  Clock,
  Trophy,
  Target,
  TrendingUp,
  TrendingDown,
  Star,
  Skull,
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
  const val = parseFloat(n.toFixed(decimals))
  return val > 0 ? `+${val}` : `${val}`
}

function calcStats(rows: LBRow[]): PlayerStats {
  const played = rows.filter((r) => Number(r.placering) > 0)
  const withPar = played.filter((r) => r.motPar !== null && r.motPar !== undefined)

  return {
    totalPoang: rows.reduce((s, r) => s + Number(r.poang ?? 0), 0),
    antalTavlingar: played.length,
    antalVinster: played.filter((r) => Number(r.placering) === 1).length,
    antalSista: played.filter(
      (r) => Number(r.placering) === Number(r.antal_spelare)
    ).length,
    snittMotPar:
      withPar.length > 0
        ? withPar.reduce((s, r) => s + Number(r.motPar ?? 0), 0) / withPar.length
        : null,
    snittPoang:
      played.length > 0
        ? played.reduce((s, r) => s + Number(r.poang ?? 0), 0) / played.length
        : null,
    bastaMotPar:
      withPar.length > 0
        ? Math.min(...withPar.map((r) => Number(r.motPar ?? 0)))
        : null,
    samstaMotPar:
      withPar.length > 0
        ? Math.max(...withPar.map((r) => Number(r.motPar ?? 0)))
        : null,
  }
}

// ─── StatBox ──────────────────────────────────────────────────────────────────

function StatBox({
  label,
  value,
  icon,
  highlight = "neutral",
}: {
  label: string
  value: string | number
  icon?: React.ReactNode
  highlight?: "good" | "bad" | "neutral"
}) {
  const valueClass =
    highlight === "good"
      ? "text-primary"
      : highlight === "bad"
        ? "text-destructive"
        : "text-foreground"

  return (
    <div className="flex flex-col gap-1 rounded-lg bg-secondary/40 px-3 py-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`text-lg font-bold ${valueClass}`}>{value}</div>
    </div>
  )
}

// ─── PlayerCard ───────────────────────────────────────────────────────────────

function PlayerCard({
  player,
  stats,
  rank,
}: {
  player: PlayerRow
  stats: PlayerStats
  rank: number
}) {
  const name = displayName(player)
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null
  const isTopThree = rank <= 3

  const winRate =
    stats.antalTavlingar > 0
      ? Math.round((stats.antalVinster / stats.antalTavlingar) * 100)
      : 0

  return (
    <Card className={isTopThree ? "ring-1 ring-primary/30" : ""}>
      <CardContent className="flex flex-col gap-4 py-5">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {medal && <span className="text-xl leading-none">{medal}</span>}
              <h3 className="text-lg font-semibold text-foreground">{name}</h3>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Golf-ID:{" "}
              {player.golfid && player.golfid.trim() !== "" ? player.golfid : "–"}
            </p>
          </div>

          <div className="flex flex-col items-end gap-0.5">
            <span className="text-3xl font-bold tabular-nums text-primary">
              {stats.totalPoang}
            </span>
            <span className="text-xs text-muted-foreground">poäng (all-time)</span>
          </div>
        </div>

        {/* ── Primary stats ── */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatBox
            label="Tävlingar"
            value={stats.antalTavlingar}
            icon={<Target className="h-3 w-3" />}
          />
          <StatBox
            label="Vinster"
            value={stats.antalVinster}
            icon={<Trophy className="h-3 w-3" />}
            highlight={stats.antalVinster > 0 ? "good" : "neutral"}
          />
          <StatBox
            label="Snitt mot par"
            value={formatSigned(stats.snittMotPar)}
            icon={<TrendingUp className="h-3 w-3" />}
            highlight={
              stats.snittMotPar === null
                ? "neutral"
                : stats.snittMotPar <= 0
                  ? "good"
                  : "bad"
            }
          />
          <StatBox
            label="Sistaplatser 💀"
            value={stats.antalSista}
            icon={<Skull className="h-3 w-3" />}
            highlight={stats.antalSista > 0 ? "bad" : "neutral"}
          />
        </div>

        {/* ── Secondary stats ── */}
        <div className="grid grid-cols-2 gap-2">
          <StatBox
            label="Bästa runda"
            value={formatSigned(stats.bastaMotPar, 0)}
            icon={<Star className="h-3 w-3" />}
            highlight="good"
          />
          <StatBox
            label="Sämsta runda"
            value={formatSigned(stats.samstaMotPar, 0)}
            icon={<TrendingDown className="h-3 w-3" />}
            highlight="bad"
          />
        </div>

        {/* ── Footer bar ── */}
        <div className="flex items-center justify-between rounded-md bg-primary/5 px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Snittpoäng / tävling:{" "}
            <span className="font-semibold text-foreground">
              {stats.snittPoang !== null ? stats.snittPoang.toFixed(1) : "–"} p
            </span>
          </span>
          <span className="text-muted-foreground">
            Vinst%:{" "}
            <span className="font-semibold text-foreground">
              {stats.antalTavlingar > 0 ? `${winRate}%` : "–"}
            </span>
          </span>
        </div>
      </CardContent>
    </Card>
  )
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

  // ── Derived data ──────────────────────────────────────────────────────────

  const { activePlayers, retiredPlayers, statsByPlayer } = useMemo(() => {
    // Build a lookup: spelarnamn → rows
    const rowsByPlayer = new Map<string, LBRow[]>()
    for (const r of lbRows) {
      const arr = rowsByPlayer.get(r.spelare) ?? []
      arr.push(r)
      rowsByPlayer.set(r.spelare, arr)
    }

    // Calculate stats for every player
    const statsByPlayer = new Map<string, PlayerStats>()
    for (const p of players) {
      statsByPlayer.set(
        p.spelarnamn,
        calcStats(rowsByPlayer.get(p.spelarnamn) ?? [])
      )
    }

    // Sort active players by all-time total points (descending)
    const active = players
      .filter((p) => isActive(p.aktiv))
      .sort(
        (a, b) =>
          (statsByPlayer.get(b.spelarnamn)?.totalPoang ?? 0) -
          (statsByPlayer.get(a.spelarnamn)?.totalPoang ?? 0)
      )

    const retired = players.filter((p) => !isActive(p.aktiv))

    return { activePlayers: active, retiredPlayers: retired, statsByPlayer }
  }, [players, lbRows])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Spelare</h1>
        <span className="text-sm text-muted-foreground">
          {loading ? "Laddar..." : `${activePlayers.length} aktiva`}
        </span>
      </div>

      {/* Error */}
      {error && (
        <Card>
          <CardContent className="py-5">
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <div className="font-medium text-foreground">
                Kunde inte hämta spelare
              </div>
              <div className="text-muted-foreground">{error}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading skeleton */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <>
          {/* ── Aktiva spelare ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-primary" />
                Aktiva spelare
                <span className="ml-auto text-sm font-normal text-muted-foreground">
                  Sorterat på totala poäng (all-time)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activePlayers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Inga aktiva spelare hittades.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {activePlayers.map((p, idx) => (
                    <PlayerCard
                      key={String(p.id)}
                      player={p}
                      stats={
                        statsByPlayer.get(p.spelarnamn) ?? calcStats([])
                      }
                      rank={idx + 1}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Pensionerade spelare ── */}
          {retiredPlayers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5 text-primary" />
                  Pensionerade spelare
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  {retiredPlayers.map((p) => (
                    <PlayerCard
                      key={String(p.id)}
                      player={p}
                      stats={
                        statsByPlayer.get(p.spelarnamn) ?? calcStats([])
                      }
                      rank={99}
                    />
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
