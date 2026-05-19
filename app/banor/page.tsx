"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Cell,
} from "recharts"
import {
  MapPin,
  TrendingUp,
  TrendingDown,
  Trophy,
  Skull,
  Target,
  BarChart3,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type CompetitionRow = {
  datum: string
  bana: string | null
}

type LBRow = {
  tavling: string
  spelare: string
  poang: number
  placering: number
  antal_spelare: number
  motPar: number | null
}

type CourseStats = {
  bana: string
  antalGanger: number
  snittMotPar: number
  bastaMotPar: number
  samstaMotPar: number
  bastaSpelare: { spelare: string; snittMotPar: number }
  samstaSpelare: { spelare: string; snittMotPar: number }
  snittPoang: number
}

const COMP_TABLE = "competitions"
const LB_TABLE = "leaderboard"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSigned(n: number | null | undefined, decimals = 1): string {
  if (n === null || n === undefined) return "–"
  const val = parseFloat(n.toFixed(decimals))
  return val > 0 ? `+${val}` : `${val}`
}

// ─── Course card ──────────────────────────────────────────────────────────────

function CourseCard({ stats }: { stats: CourseStats }) {
  const baseColor = stats.snittMotPar <= 0 ? "text-primary" : "text-destructive"

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{stats.bana}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Spelad {stats.antalGanger} {stats.antalGanger === 1 ? "gång" : "gånger"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className={`text-2xl font-extrabold tabular-nums ${baseColor}`}>
              {formatSigned(stats.snittMotPar)}
            </span>
            <span className="text-xs text-muted-foreground">snitt</span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg bg-secondary/40 p-3">
            <div className="text-xs text-muted-foreground">Snitt poäng/runda</div>
            <div className="mt-1 text-lg font-bold text-foreground">
              {stats.snittPoang.toFixed(1)} p
            </div>
          </div>

          <div className="rounded-lg bg-secondary/40 p-3">
            <div className="text-xs text-muted-foreground">Bästa runda</div>
            <div className={`mt-1 text-lg font-bold ${stats.bastaMotPar <= 0 ? "text-primary" : "text-destructive"}`}>
              {formatSigned(stats.bastaMotPar, 0)}
            </div>
          </div>

          <div className="rounded-lg bg-secondary/40 p-3">
            <div className="text-xs text-muted-foreground">Sämsta runda</div>
            <div className={`mt-1 text-lg font-bold ${stats.samstaMotPar <= 0 ? "text-primary" : "text-destructive"}`}>
              {formatSigned(stats.samstaMotPar, 0)}
            </div>
          </div>
        </div>

        {/* Player stats */}
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-lg bg-primary/5 px-3 py-2.5">
            <Trophy className="h-4 w-4 text-primary" />
            <div className="flex-1">
              <div className="text-xs font-medium text-muted-foreground">Bästa spelare</div>
              <div className="text-sm font-semibold text-foreground">
                {stats.bastaSpelare.spelare}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatSigned(stats.bastaSpelare.snittMotPar)} i snitt
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-destructive/5 px-3 py-2.5">
            <Skull className="h-4 w-4 text-destructive" />
            <div className="flex-1">
              <div className="text-xs font-medium text-muted-foreground">Sämsta spelare</div>
              <div className="text-sm font-semibold text-foreground">
                {stats.samstaSpelare.spelare}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatSigned(stats.samstaSpelare.snittMotPar)} i snitt
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BanorPage() {
  const supabase = useMemo(() => createClient(), [])

  const [competitions, setCompetitions] = useState<CompetitionRow[]>([])
  const [lbRows, setLbRows] = useState<LBRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const [
        { data: compData, error: compError },
        { data: lbData, error: lbError },
      ] = await Promise.all([
        supabase
          .from(COMP_TABLE)
          .select("datum, bana")
          .order("datum", { ascending: false }),

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
      ])

      if (cancelled) return

      if (compError) {
        setError(compError.message)
        setLoading(false)
        return
      }
      if (lbError) {
        setError(lbError.message)
        setLoading(false)
        return
      }

      setCompetitions((compData ?? []) as CompetitionRow[])
      setLbRows((lbData ?? []) as LBRow[])
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [supabase])

  // ── Derived data ───────────────────────────────────────────────────────────

  const courseStats = useMemo((): CourseStats[] => {
    if (lbRows.length === 0 || competitions.length === 0) return []

    // Build lookup: date → course name
    const compLookup = new Map<string, string | null>()
    for (const c of competitions) {
      compLookup.set(c.datum, c.bana)
    }

    // Group leaderboard by course
    const byCourse = new Map<string, LBRow[]>()
    for (const r of lbRows) {
      const bana = compLookup.get(r.tavling)
      const courseKey = bana ?? `[Okänd] ${r.tavling}`

      const arr = byCourse.get(courseKey) ?? []
      arr.push(r)
      byCourse.set(courseKey, arr)
    }

    // Calculate stats per course
    const stats: CourseStats[] = Array.from(byCourse.entries()).map(
      ([bana, rows]) => {
        const withPar = rows.filter((r) => r.motPar !== null && r.motPar !== undefined)
        const played = rows.filter((r) => Number(r.placering) > 0)

        // Aggregate per player on this course
        const playerStats = new Map<string, { motParSum: number; motParCount: number; poangSum: number; poangCount: number }>()
        for (const r of rows) {
          const cur = playerStats.get(r.spelare) ?? {
            motParSum: 0,
            motParCount: 0,
            poangSum: 0,
            poangCount: 0,
          }
          if (r.motPar !== null && r.motPar !== undefined) {
            cur.motParSum += Number(r.motPar)
            cur.motParCount += 1
          }
          if (Number(r.placering) > 0) {
            cur.poangSum += Number(r.poang ?? 0)
            cur.poangCount += 1
          }
          playerStats.set(r.spelare, cur)
        }

        // Find best and worst players
        let bastaSpelare = { spelare: "–", snittMotPar: 0 }
        let samstaSpelare = { spelare: "–", snittMotPar: 0 }

        if (playerStats.size > 0) {
          const playerList = Array.from(playerStats.entries())
            .filter(([, p]) => p.motParCount > 0)
            .map(([spelare, p]) => ({
              spelare,
              snittMotPar: p.motParSum / p.motParCount,
            }))
            .sort((a, b) => a.snittMotPar - b.snittMotPar)

          if (playerList.length > 0) {
            bastaSpelare = playerList[0]
            samstaSpelare = playerList[playerList.length - 1]
          }
        }

        return {
          bana,
          antalGanger: new Set(rows.map((r) => r.tavling)).size,
          snittMotPar:
            withPar.length > 0
              ? withPar.reduce((s, r) => s + Number(r.motPar ?? 0), 0) /
                withPar.length
              : 0,
          bastaMotPar:
            withPar.length > 0
              ? Math.min(...withPar.map((r) => Number(r.motPar ?? 0)))
              : 0,
          samstaMotPar:
            withPar.length > 0
              ? Math.max(...withPar.map((r) => Number(r.motPar ?? 0)))
              : 0,
          bastaSpelare,
          samstaSpelare,
          snittPoang:
            played.length > 0
              ? played.reduce((s, r) => s + Number(r.poang ?? 0), 0) /
                played.length
              : 0,
        }
      }
    )

    // Sort by times played (descending)
    return stats.sort((a, b) => b.antalGanger - a.antalGanger)
  }, [lbRows, competitions])

  // Chart data: distribution of vs par per course
  const chartData = useMemo(() => {
    return courseStats.map((c) => ({
      name: c.bana.length > 12 ? c.bana.slice(0, 10) + "…" : c.bana,
      snittMotPar: parseFloat(c.snittMotPar.toFixed(1)),
    }))
  }, [courseStats])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Banstatistik</h1>
        <span className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-muted-foreground">
          {loading ? "Laddar…" : `${courseStats.length} banor`}
        </span>
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
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : courseStats.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <MapPin className="h-12 w-12 text-muted-foreground" />
            <p className="text-center text-muted-foreground">
              Inga banor hittades. Se till att tävlingarna har bannamn i
              competitions-tabellen.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Snitt mot par chart ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-primary" />
                Snitt mot par per bana
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 20, left: 10, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value) => [formatSigned(Number(value)), "Snitt mot par"]}
                    />
                    <Bar dataKey="snittMotPar" radius={[6, 6, 0, 0]}>
                      {chartData.map((d, i) => (
                        <Cell
                          key={i}
                          fill={
                            Number(d.snittMotPar) <= 0
                              ? "var(--color-chart-2)"
                              : "var(--color-chart-1)"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* ── Individual course cards ── */}
          <div className="grid gap-4 sm:grid-cols-2">
            {courseStats.map((stats) => (
              <CourseCard key={stats.bana} stats={stats} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
