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
import { Zap, TrendingUp, Target, Trophy, AlertCircle } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"

// ─── Types ────────────────────────────────────────────────────────────────────

type CompetitionRow = {
  datum: string
  ar: string | null
}

type LBRow = {
  tavling: string
  spelare: string
  poang: number
  placering: number
}

type PlayerPrognosis = {
  spelare: string
  currentPoints: number
  gamesPlayed: number
  avgPointsPerGame: number
  estimatedRemainingPoints: number
  estimatedFinalPoints: number
  estimatedFinalRank: number
}

const COMP_TABLE = "competitions"
const LB_TABLE = "leaderboard"

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function yearFromDate(dateStr: string) {
  return Number(dateStr.slice(0, 4))
}

function chartColor(index: number) {
  return COLORS[index % COLORS.length]
}

// ─── Prognosis Card ───────────────────────────────────────────────────────────

function PrognosisCard({ data }: { data: PlayerPrognosis; rank: number }) {
  const medals = ["🥇", "🥈", "🥉"]
  const medal = rank <= 3 ? medals[rank - 1] : null

  return (
    <Card className={rank <= 3 ? "ring-1 ring-primary/30" : ""}>
      <CardContent className="flex flex-col gap-4 py-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {medal && <span className="text-2xl">{medal}</span>}
              <h3 className="text-lg font-semibold text-foreground">{data.spelare}</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Rank #{rank}
            </p>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-3xl font-extrabold tabular-nums text-primary">
              {Math.round(data.estimatedFinalPoints)}
            </span>
            <span className="text-xs text-muted-foreground">poäng (prognos)</span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          <div className="rounded-lg bg-secondary/40 p-3">
            <div className="text-xs text-muted-foreground">Nuvarande</div>
            <div className="mt-1 font-bold text-foreground">{data.currentPoints}</div>
          </div>

          <div className="rounded-lg bg-secondary/40 p-3">
            <div className="text-xs text-muted-foreground">Snitt/spel</div>
            <div className="mt-1 font-bold text-foreground">
              {data.avgPointsPerGame.toFixed(1)}
            </div>
          </div>

          <div className="rounded-lg bg-secondary/40 p-3">
            <div className="text-xs text-muted-foreground">Spelade</div>
            <div className="mt-1 font-bold text-foreground">{data.gamesPlayed}</div>
          </div>

          <div className="rounded-lg bg-primary/10 p-3">
            <div className="text-xs text-primary font-medium">Prognos rest</div>
            <div className="mt-1 font-bold text-primary">
              +{Math.round(data.estimatedRemainingPoints)}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Framsteg mot måltal</span>
            <span className="font-semibold text-foreground">
              {Math.round((data.currentPoints / data.estimatedFinalPoints) * 100)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-secondary/50 overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: `${Math.min(100, (data.currentPoints / data.estimatedFinalPoints) * 100)}%`,
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PrognosisPage() {
  const supabase = useMemo(() => createClient(), [])

  const [competitions, setCompetitions] = useState<CompetitionRow[]>([])
  const [lbRows, setLbRows] = useState<LBRow[]>([])
  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<string>("")
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
          .select("datum, ar:år")
          .order("datum", { ascending: false }),

        supabase
          .from(LB_TABLE)
          .select("tavling:tävling, spelare, poang:poäng, placering")
          .returns<LBRow[]>(),
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

      const comps = (compData ?? []) as CompetitionRow[]
      const rows = (lbData ?? []) as LBRow[]

      // Extract years
      const compYears = comps
        .map((c) => {
          if (c.ar) return Number(c.ar)
          return yearFromDate(c.datum)
        })
        .filter((y) => Number.isFinite(y))

      const lbYears = rows
        .map((r) => yearFromDate(r.tavling))
        .filter((y) => Number.isFinite(y))

      const uniqYears = Array.from(new Set([...compYears, ...lbYears])).sort(
        (a, b) => b - a
      )

      setCompetitions(comps)
      setLbRows(rows)
      setYears(uniqYears)

      // Set default year to current year or latest
      const currentYear = new Date().getFullYear()
      if (uniqYears.includes(currentYear)) {
        setSelectedYear(String(currentYear))
      } else {
        setSelectedYear(String(uniqYears[0] ?? currentYear))
      }

      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const prognosis = useMemo(() => {
    if (!selectedYear) return { data: [], totalComps: 0, playedComps: 0 }

    const year = Number(selectedYear)

    // Get competitions for this year
    const yearComps = competitions.filter((c) => {
      const compYear = c.ar ? Number(c.ar) : yearFromDate(c.datum)
      return compYear === year
    })

    // Get leaderboard rows for this year
    const yearRows = lbRows.filter((r) => yearFromDate(r.tavling) === year)

    if (yearRows.length === 0) {
      return { data: [], totalComps: yearComps.length, playedComps: 0 }
    }

    // Build per-player statistics
    const playerStats = new Map<
      string,
      { currentPoints: number; gamesPlayed: number; points: number[] }
    >()

    for (const r of yearRows) {
      const cur = playerStats.get(r.spelare) ?? {
        currentPoints: 0,
        gamesPlayed: 0,
        points: [],
      }
      cur.currentPoints += Number(r.poang ?? 0)
      if (Number(r.placering) > 0) {
        cur.gamesPlayed += 1
        cur.points.push(Number(r.poang ?? 0))
      }
      playerStats.set(r.spelare, cur)
    }

    // Count unique dates (competitions played)
    const playedDates = Array.from(new Set(yearRows.map((r) => r.tavling)))
    const playedComps = playedDates.length

    // Generate prognosis
    const prognosisData: PlayerPrognosis[] = Array.from(playerStats.entries())
      .map(([spelare, stats]) => {
        const avgPointsPerGame =
          stats.gamesPlayed > 0 ? stats.currentPoints / stats.gamesPlayed : 0
        const remainingComps = Math.max(0, yearComps.length - playedComps)
        const estimatedRemainingPoints = avgPointsPerGame * remainingComps

        return {
          spelare,
          currentPoints: stats.currentPoints,
          gamesPlayed: stats.gamesPlayed,
          avgPointsPerGame,
          estimatedRemainingPoints,
          estimatedFinalPoints: stats.currentPoints + estimatedRemainingPoints,
          estimatedFinalRank: 0, // Will be set after sorting
        }
      })
      .sort((a, b) => b.estimatedFinalPoints - a.estimatedFinalPoints)
      .map((p, idx) => ({ ...p, estimatedFinalRank: idx + 1 }))

    return {
      data: prognosisData,
      totalComps: yearComps.length,
      playedComps,
    }
  }, [competitions, lbRows, selectedYear])

  const chartData = useMemo(() => {
    return prognosis.data
      .slice(0, 8) // Top 8 for chart readability
      .map((p) => ({
        name: p.spelare,
        current: p.currentPoints,
        remaining: p.estimatedRemainingPoints,
        final: p.estimatedFinalPoints,
      }))
  }, [prognosis.data])

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Poäng-prognos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Prognostiserad slutställning baserad på snittpoäng hittills
          </p>
        </div>
        <div className="w-full sm:w-56">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger>
              <SelectValue placeholder="Välj år" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Info banner */}
      {!loading && prognosis.data.length > 0 && (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
          <div className="flex gap-3">
            <Zap className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-foreground">
                {prognosis.playedComps} av {prognosis.totalComps} deltävlingar spelade
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Prognoserna baseras på varje spelares snittpoäng ({prognosis.totalComps - prognosis.playedComps}{" "}
                deltävling{prognosis.totalComps - prognosis.playedComps !== 1 ? "ar" : ""} kvar). 
                Högre snitt = högre slutpoäng.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="py-5">
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm flex gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              <div>
                <div className="font-medium text-foreground">Kunde inte hämta data</div>
                <div className="text-muted-foreground">{error}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : prognosis.data.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-3 text-center">
              <Target className="h-12 w-12 text-muted-foreground" />
              <div>
                <div className="font-semibold text-foreground">Ingen data för året</div>
                <p className="text-sm text-muted-foreground mt-1">
                  Säkerställ att det finns resultat i leaderboarden för valt år.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
                Prognostiserad slutpoäng (Top 8)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(value) => Math.round(Number(value))}
                      labelFormatter={(label) => `${label}`}
                    />
                    <Bar dataKey="final" radius={[0, 8, 8, 0]}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={chartColor(i)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Prognosis cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            {prognosis.data.map((p) => (
              <PrognosisCard key={p.spelare} data={p} rank={p.estimatedFinalRank} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
