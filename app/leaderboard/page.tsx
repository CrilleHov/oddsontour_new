"use client"

import { useEffect, useMemo, useState } from "react"
import type { ComponentType, ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { addLeaderboardUpdate } from "@/lib/actions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarDays,
  CircleMinus,
  Crown,
  Flame,
  Lock,
  Medal,
  RefreshCw,
  Settings,
  Skull,
  Sparkles,
  Target,
  Trophy,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

// ─── Types ────────────────────────────────────────────────────────────────────

type LeaderboardRow = {
  tavling: string
  spelare: string
  poang: number
  placering: number
  antal_spelare: number
  motPar: number | null
}

type Competition = {
  datum: string
  bana: string | null
  host: string | null
  major: string | null
  plats: string | null
  ar: string | null
}

type Player = {
  spelarnamn: string
}

type SummaryRow = {
  rank: number
  previousRank: number | null
  rankChange: number | null
  spelare: string
  totalPoang: number
  behindLeader: number
  antalComps: number
  antalVinster: number
  antalSistaplatser: number
  snittPoang: number | null
  snittMotPar: number | null
  latestPlacement: number | null
  latestPoang: number | null
  latestMotPar: number | null
  formPlacements: Array<number | null>
  formPoints: number
}

type BasicSummaryRow = {
  spelare: string
  totalPoang: number
  antalComps: number
  antalVinster: number
  antalSistaplatser: number
  snittPoang: number | null
  snittMotPar: number | null
}

type ChartPoint = {
  datum: string
  _rawDate: string
  [key: string]: string | number
}

type TooltipPayloadItem = {
  name?: string
  value?: string | number
  color?: string
}

const COMP_TABLE = "competitions"
const LB_TABLE = "leaderboard"
const PLAYERS_TABLE = "spelare"

const BASE_COLORS = [
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

function formatDateSv(dateStr: string | null | undefined) {
  if (!dateStr) return "Okänt datum"

  const [year, month, day] = dateStr.slice(0, 10).split("-")

  if (!year || !month || !day) return dateStr

  return `${year}-${month}-${day}`
}

function formatShortDateSv(dateStr: string | null | undefined) {
  if (!dateStr) return "Okänt datum"

  const date = new Date(`${dateStr.slice(0, 10)}T00:00:00`)

  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
  }).format(date)
}

function formatSigned(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined) return "–"

  const n = parseFloat(Number(value).toFixed(decimals))

  if (n > 0) return `+${n}`

  return `${n}`
}

function isMajor(value: string | null | undefined) {
  if (!value) return false

  return ["ja", "true", "1", "major"].includes(value.toLowerCase())
}

function hashString(str: string) {
  let h = 0

  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0
  }

  return Math.abs(h)
}

function colorForPlayer(name: string, index: number) {
  if (index < BASE_COLORS.length) return BASE_COLORS[index]

  const hue = hashString(name) % 360

  return `oklch(0.72 0.17 ${hue})`
}

function parseMotPar(value: string) {
  const trimmed = value.trim()

  if (trimmed === "" || trimmed === "-" || trimmed === "+") return 0

  const parsed = Number(trimmed)

  return Number.isFinite(parsed) ? parsed : 0
}

function buildBasicSummary(rows: LeaderboardRow[]): BasicSummaryRow[] {
  type Acc = {
    spelare: string
    totalPoang: number
    antalComps: number
    antalVinster: number
    antalSistaplatser: number
    motParSum: number
    motParCount: number
  }

  const byPlayer = new Map<string, Acc>()

  for (const r of rows) {
    if (Number(r.placering) <= 0) continue

    const cur = byPlayer.get(r.spelare) ?? {
      spelare: r.spelare,
      totalPoang: 0,
      antalComps: 0,
      antalVinster: 0,
      antalSistaplatser: 0,
      motParSum: 0,
      motParCount: 0,
    }

    cur.totalPoang += Number(r.poang ?? 0)
    cur.antalComps += 1

    if (Number(r.placering) === 1) {
      cur.antalVinster += 1
    }

    if (Number(r.placering) === Number(r.antal_spelare)) {
      cur.antalSistaplatser += 1
    }

    if (r.motPar !== null && r.motPar !== undefined) {
      cur.motParSum += Number(r.motPar)
      cur.motParCount += 1
    }

    byPlayer.set(r.spelare, cur)
  }

  return Array.from(byPlayer.values())
    .map((r) => ({
      spelare: r.spelare,
      totalPoang: r.totalPoang,
      antalComps: r.antalComps,
      antalVinster: r.antalVinster,
      antalSistaplatser: r.antalSistaplatser,
      snittPoang: r.antalComps > 0 ? r.totalPoang / r.antalComps : null,
      snittMotPar: r.motParCount > 0 ? r.motParSum / r.motParCount : null,
    }))
    .sort((a, b) => {
      if (b.totalPoang !== a.totalPoang) return b.totalPoang - a.totalPoang
      if (b.antalVinster !== a.antalVinster) return b.antalVinster - a.antalVinster

      const aPar = a.snittMotPar ?? 999
      const bPar = b.snittMotPar ?? 999

      if (aPar !== bPar) return aPar - bPar

      return a.spelare.localeCompare(b.spelare, "sv")
    })
}

function competitionLabel(date: string, competitions: Competition[]) {
  const comp = competitions.find((c) => c.datum === date)

  if (!comp?.bana) return formatDateSv(date)

  return `${formatDateSv(date)} · ${comp.bana}`
}

// ─── Chart helpers ────────────────────────────────────────────────────────────

function LineEndLabel(props: {
  x?: number
  y?: number
  value?: string
  fill?: string
  index?: number
  dataLength: number
}) {
  const { x, y, value, fill, index, dataLength } = props

  if (
    index !== dataLength - 1 ||
    !value ||
    x === undefined ||
    y === undefined
  ) {
    return null
  }

  return (
    <text
      x={x + 8}
      y={y + 4}
      fill={fill}
      fontSize={12}
      fontWeight={700}
      textAnchor="start"
    >
      {value}
    </text>
  )
}

function ChartTooltip({
  active,
  payload,
  label,
  sortDirection,
  valueFormatter,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
  sortDirection: "asc" | "desc"
  valueFormatter: (value: number) => string
}) {
  if (!active || !payload || payload.length === 0) return null

  const sorted = [...payload]
    .filter((item) => item.value !== undefined && item.value !== null)
    .sort((a, b) => {
      const av = Number(a.value ?? 0)
      const bv = Number(b.value ?? 0)

      return sortDirection === "asc" ? av - bv : bv - av
    })

  return (
    <div className="rounded-xl border border-border bg-background/95 p-3 shadow-lg">
      <div className="mb-2 text-xs font-medium text-muted-foreground">
        Datum: {label}
      </div>

      <div className="flex flex-col gap-1">
        {sorted.map((item) => (
          <div
            key={String(item.name)}
            className="flex min-w-40 items-center justify-between gap-4 text-sm"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="font-medium text-foreground">{item.name}</span>
            </div>

            <span className="font-bold tabular-nums text-foreground">
              {valueFormatter(Number(item.value ?? 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const supabase = useMemo(() => createClient(), [])

  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [players, setPlayers] = useState<Player[]>([])

  const [loadingMeta, setLoadingMeta] = useState(true)
  const [loadingLB, setLoadingLB] = useState(true)
  const [loadingCompetitions, setLoadingCompetitions] = useState(true)

  const [error, setError] = useState<string | null>(null)
  const [showAdmin, setShowAdmin] = useState(false)

  const [tavling, setTavling] = useState("")
  const [antalSpelare, setAntalSpelare] = useState("")
  const [major, setMajor] = useState<"Ja" | "Nej" | "">("")
  const [placeringar, setPlaceringar] = useState<Record<string, number>>({})
  const [motParValues, setMotParValues] = useState<Record<string, string>>({})
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // ── Data fetching ──────────────────────────────────────────────────────────

  async function loadMeta() {
    setLoadingMeta(true)
    setError(null)

    const [
      { data: compDates, error: compErr },
      { data: lbDates, error: lbDateErr },
      { data: playerData, error: playerErr },
    ] = await Promise.all([
      supabase.from(COMP_TABLE).select("datum"),
      supabase.from(LB_TABLE).select("tävling"),
      supabase
        .from(PLAYERS_TABLE)
        .select("spelarnamn")
        .eq("aktiv", 1)
        .order("spelarnamn"),
    ])

    const nextErrors = [compErr?.message, lbDateErr?.message, playerErr?.message]
      .filter(Boolean)
      .join(" | ")

    if (nextErrors) {
      setError(nextErrors)
    }

    const compYears = (compDates ?? [])
      .map((r: { datum: string }) => yearFromDate(r.datum))
      .filter((y) => Number.isFinite(y))

    const leaderboardYears = (lbDates ?? [])
      .map((r: { tävling: string }) => yearFromDate(r.tävling))
      .filter((y) => Number.isFinite(y))

    const uniqYears = Array.from(new Set([...compYears, ...leaderboardYears]))
      .sort((a, b) => b - a)

    setYears(uniqYears)
    setSelectedYear((prev) => prev ?? uniqYears[0] ?? null)

    const p = (playerData ?? []) as Player[]

    setPlayers(p)

    const names = p.map((x) => x.spelarnamn)

    setPlaceringar((prev) => {
      const next: Record<string, number> = {}

      for (const n of names) {
        next[n] = prev[n] ?? 0
      }

      return next
    })

    setMotParValues((prev) => {
      const next: Record<string, string> = {}

      for (const n of names) {
        next[n] = prev[n] ?? "0"
      }

      return next
    })

    setLoadingMeta(false)
  }

  async function loadLeaderboard(year: number) {
    setLoadingLB(true)
    setError(null)

    const { data, error } = await supabase
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
      .gte("tävling", `${year}-01-01`)
      .lte("tävling", `${year}-12-31`)
      .order("tävling", { ascending: true })
      .returns<LeaderboardRow[]>()

    if (error) {
      setError(error.message)
      setRows([])
      setLoadingLB(false)
      return
    }

    setRows(data ?? [])
    setLoadingLB(false)
  }

  async function loadCompetitionsForYear(year: number) {
    setLoadingCompetitions(true)

    const { data, error } = await supabase
      .from(COMP_TABLE)
      .select("datum, bana, host, major, plats, ar:år")
      .gte("datum", `${year}-01-01`)
      .lte("datum", `${year}-12-31`)
      .order("datum", { ascending: true })
      .returns<Competition[]>()

    if (error) {
      setError(error.message)
      setCompetitions([])
      setLoadingCompetitions(false)
      return
    }

    const comps = data ?? []

    setCompetitions(comps)

    setTavling((prev) => {
      const prevExists = comps.some((c) => c.datum === prev)

      return prevExists ? prev : comps[0]?.datum ?? ""
    })

    setLoadingCompetitions(false)
  }

  useEffect(() => {
    let cancelled = false

    loadMeta()
      .catch((e) => {
        if (!cancelled) setError(String(e))
      })
      .finally(() => {
        if (!cancelled) setLoadingMeta(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedYear) {
      setLoadingLB(false)
      setLoadingCompetitions(false)
      return
    }

    let cancelled = false

    Promise.all([
      loadLeaderboard(selectedYear),
      loadCompetitionsForYear(selectedYear),
    ]).catch((e) => {
      if (!cancelled) setError(String(e))
    })

    return () => {
      cancelled = true
    }
  }, [selectedYear])

  // ── Derived data ───────────────────────────────────────────────────────────

  const {
    summary,
    chartData,
    parChartData,
    playersInChart,
    dates,
    latestDate,
    latestRows,
    latestWinner,
    latestCompetition,
    nextCompetition,
    topMover,
    bestForm,
    mostWins,
  } = useMemo(() => {
    const playedRows = rows.filter((r) => Number(r.placering) > 0)

    const dates = Array.from(new Set(playedRows.map((r) => r.tavling))).sort()

    const latestDate = dates.at(-1) ?? null
    const latest3Dates = dates.slice(-3)

    const rowsByDate = new Map<string, LeaderboardRow[]>()
    const rowByPlayerDate = new Map<string, LeaderboardRow>()

    for (const r of rows) {
      const arr = rowsByDate.get(r.tavling) ?? []
      arr.push(r)
      rowsByDate.set(r.tavling, arr)
      rowByPlayerDate.set(`${r.spelare}|${r.tavling}`, r)
    }

    const latestRows = latestDate
      ? (rowsByDate.get(latestDate) ?? [])
          .filter((r) => Number(r.placering) > 0)
          .sort(
            (a, b) =>
              Number(a.placering ?? 999) - Number(b.placering ?? 999)
          )
      : []

    const latestWinner =
      latestRows.find((r) => Number(r.placering) === 1) ?? null

    const previousRows = latestDate
      ? playedRows.filter((r) => r.tavling < latestDate)
      : []

    const previousSummary = buildBasicSummary(previousRows)
    const previousRankMap = new Map<string, number>()

    previousSummary.forEach((s, index) => {
      previousRankMap.set(s.spelare, index + 1)
    })

    const basicSummary = buildBasicSummary(playedRows)

    let summary: SummaryRow[] = basicSummary.map((s, index) => {
      const rank = index + 1
      const previousRank = previousRankMap.get(s.spelare) ?? null
      const rankChange = previousRank === null ? null : previousRank - rank

      const latestRow = latestDate
        ? rowByPlayerDate.get(`${s.spelare}|${latestDate}`)
        : null

      const formPlacements = latest3Dates.map((date) => {
        const row = rowByPlayerDate.get(`${s.spelare}|${date}`)

        if (!row || Number(row.placering) <= 0) return null

        return Number(row.placering)
      })

      const formPoints = latest3Dates.reduce((sum, date) => {
        const row = rowByPlayerDate.get(`${s.spelare}|${date}`)

        if (!row || Number(row.placering) <= 0) return sum

        return sum + Number(row.poang ?? 0)
      }, 0)

      return {
        ...s,
        rank,
        previousRank,
        rankChange,
        behindLeader: 0,
        latestPlacement:
          latestRow && Number(latestRow.placering) > 0
            ? Number(latestRow.placering)
            : null,
        latestPoang:
          latestRow && Number(latestRow.placering) > 0
            ? Number(latestRow.poang ?? 0)
            : null,
        latestMotPar:
          latestRow && Number(latestRow.placering) > 0
            ? latestRow.motPar
            : null,
        formPlacements,
        formPoints,
      }
    })

    const leaderPoints = summary[0]?.totalPoang ?? 0

    summary = summary.map((s) => ({
      ...s,
      behindLeader: leaderPoints - s.totalPoang,
    }))

    const playersInChart = summary.map((s) => s.spelare)

    const cumulativePoints = new Map(playersInChart.map((p) => [p, 0]))
    const cumulativePar = new Map(playersInChart.map((p) => [p, 0]))

    const chartData: ChartPoint[] = dates.map((d) => {
      const bucket = rowsByDate.get(d) ?? []

      for (const r of bucket) {
        if (Number(r.placering) <= 0) continue

        cumulativePoints.set(
          r.spelare,
          (cumulativePoints.get(r.spelare) ?? 0) + Number(r.poang ?? 0)
        )
      }

      const point: ChartPoint = {
        datum: formatDateSv(d),
        _rawDate: d,
      }

      for (const p of playersInChart) {
        point[p] = cumulativePoints.get(p) ?? 0
      }

      return point
    })

    const parChartData: ChartPoint[] = dates.map((d) => {
      const bucket = rowsByDate.get(d) ?? []

      for (const r of bucket) {
        if (Number(r.placering) <= 0) continue

        cumulativePar.set(
          r.spelare,
          (cumulativePar.get(r.spelare) ?? 0) + Number(r.motPar ?? 0)
        )
      }

      const point: ChartPoint = {
        datum: formatDateSv(d),
        _rawDate: d,
      }

      for (const p of playersInChart) {
        point[p] = cumulativePar.get(p) ?? 0
      }

      return point
    })

    const latestCompetition = latestDate
      ? competitions.find((c) => c.datum === latestDate) ?? null
      : null

    const playedDateSet = new Set(dates)

    const today = new Date()
    const todayDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    )

    const nextCompetition =
      competitions.find((c) => {
        const d = new Date(`${c.datum}T00:00:00`)

        return d >= todayDate && !playedDateSet.has(c.datum)
      }) ?? null

    const topMover =
      summary
        .filter((s) => s.rankChange !== null && s.rankChange > 0)
        .sort((a, b) => Number(b.rankChange) - Number(a.rankChange))[0] ??
      null

    const bestForm =
      summary
        .filter((s) => s.formPoints > 0)
        .sort((a, b) => {
          if (b.formPoints !== a.formPoints) return b.formPoints - a.formPoints
          return a.rank - b.rank
        })[0] ?? null

    const mostWins =
      summary
        .filter((s) => s.antalVinster > 0)
        .sort((a, b) => b.antalVinster - a.antalVinster)[0] ?? null

    return {
      summary,
      chartData,
      parChartData,
      playersInChart,
      dates,
      latestDate,
      latestRows,
      latestWinner,
      latestCompetition,
      nextCompetition,
      topMover,
      bestForm,
      mostWins,
    }
  }, [rows, competitions])

  const loading = loadingMeta || loadingLB || loadingCompetitions

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleLeaderboardSubmit() {
    if (!tavling || !antalSpelare || !major) {
      toast.error("Välj tävling, antal spelare och major-flagga")
      return
    }

    const antal = Number(antalSpelare)

    const spelade = Object.values(placeringar).filter(
      (p) => Number(p) > 0
    ).length

    setSubmitting(true)

    try {
      const res = await addLeaderboardUpdate({
        tavling,
        antalSpelare: antal,
        major: major as "Ja" | "Nej",
        placeringar: players.map((p) => ({
          spelare: p.spelarnamn,
          placering: Number(placeringar[p.spelarnamn] ?? 0),
          motPar: parseMotPar(motParValues[p.spelarnamn] ?? "0"),
        })),
        password,
      })

      toast.success(`Leaderboard uppdaterad! (insatt ${res.inserted} rader)`)

      if (spelade !== antal) {
        toast.warning(
          `Du angav ${antal} spelare men fyllde i ${spelade} placeringar > 0.`
        )
      }

      setPassword("")

      setPlaceringar((prev) => {
        const next = { ...prev }

        for (const p of players) {
          next[p.spelarnamn] = 0
        }

        return next
      })

      setMotParValues((prev) => {
        const next = { ...prev }

        for (const p of players) {
          next[p.spelarnamn] = "0"
        }

        return next
      })

      if (selectedYear && tavling.startsWith(String(selectedYear))) {
        await loadLeaderboard(selectedYear)
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

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
              Race to Sand {selectedYear ?? ""}
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Leaderboard
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Aktuell ställning, formkurva, senaste resultat och utveckling mot
              par. Tabellen visar även trend jämfört med föregående deltävling.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select
              value={selectedYear ? String(selectedYear) : undefined}
              onValueChange={(v) => setSelectedYear(Number(v))}
              disabled={years.length === 0}
            >
              <SelectTrigger className="w-full sm:w-36">
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

            <Button
              variant={showAdmin ? "default" : "secondary"}
              onClick={() => setShowAdmin((v) => !v)}
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              {showAdmin ? "Dölj admin" : "Adminläge"}
            </Button>
          </div>
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Kunde inte ladda data
          </div>
          <div className="mt-1 text-muted-foreground">{error}</div>
        </div>
      )}

      {/* Loading / empty / content */}
      {loading ? (
        <LoadingState />
      ) : summary.length === 0 ? (
        <EmptyState selectedYear={selectedYear} />
      ) : (
        <>
          {/* Top stats */}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Ledare"
              value={summary[0]?.spelare ?? "Saknas"}
              sub={
                summary[0]
                  ? `${summary[0].totalPoang} poäng · ${summary[0].antalVinster} vinster`
                  : "Ingen ledare"
              }
              icon={Crown}
            />

            <StatCard
              title="Senaste vinnare"
              value={latestWinner?.spelare ?? "Saknas"}
              sub={
                latestDate
                  ? `${formatShortDateSv(latestDate)}${
                      latestCompetition?.bana ? ` · ${latestCompetition.bana}` : ""
                    }`
                  : "Inget resultat"
              }
              icon={Medal}
            />

            <StatCard
              title="Formstarkast"
              value={bestForm?.spelare ?? "Saknas"}
              sub={
                bestForm
                  ? `${bestForm.formPoints} poäng senaste ${Math.min(
                      3,
                      dates.length
                    )} tävlingarna`
                  : "Ingen formdata"
              }
              icon={Flame}
            />

            <StatCard
              title="Största klättring"
              value={topMover?.spelare ?? "Ingen"}
              sub={
                topMover?.rankChange
                  ? `+${topMover.rankChange} placeringar sedan senast`
                  : "Oförändrat i toppen"
              }
              icon={TrendingUp}
            />
          </section>

          {/* Latest + next */}
          <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  Senaste deltävlingen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LatestCompetition
                  date={latestDate}
                  competition={latestCompetition}
                  rows={latestRows}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="h-5 w-5 text-primary" />
                  Säsongsläge
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SeasonStatus
                  selectedYear={selectedYear}
                  playedCount={dates.length}
                  competitionCount={competitions.length}
                  nextCompetition={nextCompetition}
                  mostWins={mostWins}
                />
              </CardContent>
            </Card>
          </section>

          {/* Points chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-primary" />
                Poängutveckling
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[430px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 20, right: 80, left: 0, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="datum" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip
                    content={
                      <ChartTooltip
                        sortDirection="desc"
                        valueFormatter={(v) => `${v} p`}
                      />
                    }
                  />

                  {playersInChart.map((p, i) => {
                    const color = colorForPlayer(p, i)

                    return (
                      <Line
                        key={p}
                        type="monotone"
                        dataKey={p}
                        stroke={color}
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        connectNulls
                      >
                        <LabelList
                          content={(props) => (
                            <LineEndLabel
                              {...props}
                              value={p}
                              fill={color}
                              dataLength={chartData.length}
                            />
                          )}
                        />
                      </Line>
                    )
                  })}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Standings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="h-5 w-5 text-primary" />
                Ställning
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StandingsTable summary={summary} />
            </CardContent>
          </Card>

          {/* Par chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingDown className="h-5 w-5 text-primary" />
                Kumulativ utveckling mot par
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[430px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={parChartData}
                  margin={{ top: 20, right: 80, left: 0, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="datum" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip
                    content={
                      <ChartTooltip
                        sortDirection="asc"
                        valueFormatter={(v) => formatSigned(v, 0)}
                      />
                    }
                  />

                  {playersInChart.map((p, i) => {
                    const color = colorForPlayer(p, i)

                    return (
                      <Line
                        key={p}
                        type="monotone"
                        dataKey={p}
                        stroke={color}
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        connectNulls
                      >
                        <LabelList
                          content={(props) => (
                            <LineEndLabel
                              {...props}
                              value={p}
                              fill={color}
                              dataLength={parChartData.length}
                            />
                          )}
                        />
                      </Line>
                    )
                  })}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}

      {/* Admin */}
      {showAdmin && (
        <Card className="border-primary/30">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lock className="h-5 w-5 text-primary" />
                Uppdatera leaderboard
              </CardTitle>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void loadMeta()
                  if (selectedYear) {
                    void loadLeaderboard(selectedYear)
                    void loadCompetitionsForYear(selectedYear)
                  }
                }}
                disabled={loadingMeta}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Ladda om
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Fyll i tävling, placering och mot par för respektive spelare. Om
              någon inte spelade, fyll i 0 i placering.
            </p>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>År</Label>
                <Select
                  value={selectedYear ? String(selectedYear) : undefined}
                  onValueChange={(v) => setSelectedYear(Number(v))}
                >
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

              <div className="space-y-2 md:col-span-2">
                <Label>Deltävling</Label>
                <Select value={tavling} onValueChange={setTavling}>
                  <SelectTrigger>
                    <SelectValue placeholder="Välj tävling" />
                  </SelectTrigger>
                  <SelectContent>
                    {competitions.map((c) => (
                      <SelectItem key={c.datum} value={c.datum}>
                        {competitionLabel(c.datum, competitions)}
                        {isMajor(c.major) ? " · Major" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Antal spelare</Label>
                <Select value={antalSpelare} onValueChange={setAntalSpelare}>
                  <SelectTrigger>
                    <SelectValue placeholder="Välj antal" />
                  </SelectTrigger>
                  <SelectContent>
                    {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Major?</Label>
                <Select
                  value={major}
                  onValueChange={(v) => setMajor(v as "Ja" | "Nej")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Ja/Nej" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ja">Ja</SelectItem>
                    <SelectItem value="Nej">Nej</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {players.map((p) => (
                <div
                  key={p.spelarnamn}
                  className="rounded-2xl border border-border bg-secondary/25 p-4"
                >
                  <div className="mb-3 font-semibold text-foreground">
                    {p.spelarnamn}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Placering</Label>
                      <Input
                        type="number"
                        min={0}
                        value={placeringar[p.spelarnamn] ?? 0}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) =>
                          setPlaceringar((prev) => ({
                            ...prev,
                            [p.spelarnamn]: Number(e.target.value),
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Mot par</Label>
                      <Input
                        inputMode="numeric"
                        value={motParValues[p.spelarnamn] ?? "0"}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) =>
                          setMotParValues((prev) => ({
                            ...prev,
                            [p.spelarnamn]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <div className="space-y-2">
                <Label>Lösenord</Label>
                <Input
                  type="password"
                  placeholder="Lösenord"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <Button
                onClick={handleLeaderboardSubmit}
                disabled={submitting}
                className="h-10"
              >
                {submitting ? "Sparar..." : "Uppdatera leaderboard"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Components ───────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
        ))}
      </section>

      <div className="h-[430px] animate-pulse rounded-2xl bg-muted" />
      <div className="h-96 animate-pulse rounded-2xl bg-muted" />
    </div>
  )
}

function EmptyState({ selectedYear }: { selectedYear: number | null }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="rounded-full bg-secondary p-4">
          <Trophy className="h-8 w-8 text-muted-foreground" />
        </div>

        <div>
          <div className="text-lg font-bold text-foreground">
            Inga resultat hittades
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Det finns inga registrerade leaderboard-rader för{" "}
            {selectedYear ?? "valt år"}.
          </p>
        </div>
      </CardContent>
    </Card>
  )
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

function LatestCompetition({
  date,
  competition,
  rows,
}: {
  date: string | null
  competition: Competition | null
  rows: LeaderboardRow[]
}) {
  if (!date || rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Inget resultat är registrerat ännu.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-2xl font-extrabold text-foreground">
            {competition?.bana ?? formatDateSv(date)}
          </h3>

          {competition && isMajor(competition.major) && (
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
              Major
            </span>
          )}
        </div>

        <div className="mt-1 text-sm text-muted-foreground">
          {formatDateSv(date)}
          {competition?.plats ? ` · ${competition.plats}` : ""}
          {competition?.host ? ` · Host: ${competition.host}` : ""}
        </div>
      </div>

      <div className="grid gap-2">
        {rows.slice(0, 5).map((r) => (
          <div
            key={`${r.tavling}-${r.spelare}`}
            className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2"
          >
            <div className="flex items-center gap-3">
              <RankBadge rank={Number(r.placering)} />
              <div className="font-semibold text-foreground">{r.spelare}</div>
            </div>

            <div className="text-right text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {Number(r.poang ?? 0)} p
              </span>
              {r.motPar !== null && r.motPar !== undefined && (
                <span> · {formatSigned(r.motPar, 0)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SeasonStatus({
  selectedYear,
  playedCount,
  competitionCount,
  nextCompetition,
  mostWins,
}: {
  selectedYear: number | null
  playedCount: number
  competitionCount: number
  nextCompetition: Competition | null
  mostWins: SummaryRow | null
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-secondary/40 p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <CalendarDays className="h-4 w-4 text-primary" />
            Spelade tävlingar
          </div>
          <div className="mt-2 text-2xl font-extrabold text-foreground">
            {playedCount}/{competitionCount || "?"}
          </div>
        </div>

        <div className="rounded-xl bg-secondary/40 p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Users className="h-4 w-4 text-primary" />
            Flest vinster
          </div>
          <div className="mt-2 text-2xl font-extrabold text-foreground">
            {mostWins ? `${mostWins.spelare} ×${mostWins.antalVinster}` : "–"}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Nästa deltävling
        </div>

        {nextCompetition ? (
          <div className="mt-2">
            <div className="font-bold text-foreground">
              {nextCompetition.bana ?? "Okänd bana"}
            </div>
            <div className="text-sm text-muted-foreground">
              {formatDateSv(nextCompetition.datum)}
              {nextCompetition.plats ? ` · ${nextCompetition.plats}` : ""}
            </div>
          </div>
        ) : (
          <div className="mt-2 text-sm text-muted-foreground">
            Ingen kommande tävling hittades för {selectedYear ?? "valt år"}.
          </div>
        )}
      </div>
    </div>
  )
}

function StandingsTable({ summary }: { summary: SummaryRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-3 pr-3">#</th>
            <th className="py-3 pr-3">Trend</th>
            <th className="py-3 pr-3">Spelare</th>
            <th className="py-3 pr-3 text-right">Totalt</th>
            <th className="py-3 pr-3 text-right">Bakom</th>
            <th className="py-3 pr-3">Form</th>
            <th className="py-3 pr-3 text-right">Snitt p/tävl</th>
            <th className="py-3 pr-3 text-right">Snitt mot par</th>
            <th className="py-3 pr-3 text-right">Tävlingar</th>
            <th className="py-3 pr-3 text-right">Vinster</th>
            <th className="py-3 text-right">Sista</th>
          </tr>
        </thead>

        <tbody>
          {summary.map((s) => (
            <tr
              key={s.spelare}
              className="border-b border-border/60 last:border-0"
            >
              <td className="py-3 pr-3">
                <RankBadge rank={s.rank} />
              </td>

              <td className="py-3 pr-3">
                <RankChangeBadge change={s.rankChange} />
              </td>

              <td className="py-3 pr-3">
                <div className="font-bold text-foreground">{s.spelare}</div>
                {s.latestPlacement && (
                  <div className="text-xs text-muted-foreground">
                    Senast: #{s.latestPlacement}, {s.latestPoang ?? 0} p
                    {s.latestMotPar !== null &&
                    s.latestMotPar !== undefined
                      ? `, ${formatSigned(s.latestMotPar, 0)}`
                      : ""}
                  </div>
                )}
              </td>

              <td className="py-3 pr-3 text-right text-lg font-extrabold tabular-nums text-foreground">
                {s.totalPoang}
              </td>

              <td className="py-3 pr-3 text-right tabular-nums text-muted-foreground">
                {s.behindLeader === 0 ? "Leder" : `-${s.behindLeader}`}
              </td>

              <td className="py-3 pr-3">
                <FormBadges placements={s.formPlacements} />
              </td>

              <td className="py-3 pr-3 text-right tabular-nums">
                {s.snittPoang !== null ? s.snittPoang.toFixed(1) : "–"}
              </td>

              <td className="py-3 pr-3 text-right tabular-nums">
                {formatSigned(s.snittMotPar, 1)}
              </td>

              <td className="py-3 pr-3 text-right tabular-nums">
                {s.antalComps}
              </td>

              <td className="py-3 pr-3 text-right tabular-nums">
                {s.antalVinster}
              </td>

              <td className="py-3 text-right tabular-nums">
                {s.antalSistaplatser}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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

function RankChangeBadge({ change }: { change: number | null }) {
  if (change === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs font-semibold text-muted-foreground">
        <CircleMinus className="h-3.5 w-3.5" />
        Ny
      </span>
    )
  }

  if (change > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
        <ArrowUp className="h-3.5 w-3.5" />+{change}
      </span>
    )
  }

  if (change < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-xs font-bold text-destructive">
        <ArrowDown className="h-3.5 w-3.5" />
        {change}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs font-semibold text-muted-foreground">
      <CircleMinus className="h-3.5 w-3.5" />
      0
    </span>
  )
}

function FormBadges({ placements }: { placements: Array<number | null> }) {
  if (placements.length === 0) {
    return <span className="text-muted-foreground">–</span>
  }

  return (
    <div className="flex items-center gap-1.5">
      {placements.map((placement, index) => {
        if (!placement) {
          return (
            <span
              key={index}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-bold text-muted-foreground"
            >
              –
            </span>
          )
        }

        const className =
          placement === 1
            ? "bg-primary text-primary-foreground"
            : placement <= 3
              ? "bg-primary/10 text-primary"
              : "bg-secondary text-secondary-foreground"

        return (
          <span
            key={index}
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${className}`}
            title={`Placering ${placement}`}
          >
            {placement}
          </span>
        )
      })}
    </div>
  )
}
