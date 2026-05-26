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
  CalendarDays,
  Flag,
  Flame,
  MapPin,
  Skull,
  Sparkles,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

// ─── Types ────────────────────────────────────────────────────────────────────

type CompetitionRow = {
  datum: string
  bana: string | null
  plats: string | null
  major: string | null
  ar: string | null
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
  plats: string | null
  antalGanger: number
  antalRonder: number
  antalMajors: number
  snittMotPar: number | null
  bastaMotPar: number | null
  samstaMotPar: number | null
  snittPoang: number | null
  latestDate: string | null
  latestWinner: string | null
  bestRound: { spelare: string; motPar: number; datum: string } | null
  worstRound: { spelare: string; motPar: number; datum: string } | null
  bastaSpelare: { spelare: string; snittMotPar: number } | null
  samstaSpelare: { spelare: string; snittMotPar: number } | null
}

type CourseRoundRow = {
  rank: number
  datum: string
  bana: string
  spelare: string
  motPar: number | null
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

function formatSigned(n: number | null | undefined, decimals = 1): string {
  if (n === null || n === undefined) return "–"

  // Show "E" for even par (0)
  if (n === 0) return "E"

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

function shortCourseName(name: string) {
  return name.length > 16 ? `${name.slice(0, 14)}…` : name
}

function isMajor(value: string | null | undefined) {
  if (!value) return false
  return ["ja", "true", "1", "major"].includes(value.toLowerCase())
}

function chartColor(index: number) {
  return COLORS[index % COLORS.length]
}

function dateKey(dateStr: string | null | undefined) {
  return String(dateStr ?? "").slice(0, 10)
}

function compareRoundsBestToWorst(
  a: Omit<CourseRoundRow, "rank">,
  b: Omit<CourseRoundRow, "rank">
) {
  const aHasPar = a.motPar !== null && a.motPar !== undefined
  const bHasPar = b.motPar !== null && b.motPar !== undefined

  if (aHasPar && bHasPar && Number(a.motPar) !== Number(b.motPar)) {
    return Number(a.motPar) - Number(b.motPar)
  }

  if (aHasPar !== bHasPar) return aHasPar ? -1 : 1

  const dateCompare = b.datum.localeCompare(a.datum)
  if (dateCompare !== 0) return dateCompare

  return a.spelare.localeCompare(b.spelare, "sv")
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BanorPage() {
  const supabase = useMemo(() => createClient(), [])

  const [competitions, setCompetitions] = useState<CompetitionRow[]>([])
  const [lbRows, setLbRows] = useState<LBRow[]>([])
  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<string>("all")
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
          .select("datum, bana, plats, major, ar:år")
          .order("datum", { ascending: false })
          .returns<CompetitionRow[]>(),

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

      const compYears = comps
        .map((r) => yearFromDate(r.datum))
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
      setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [supabase])

  const dashboard = useMemo(() => {
    const yearFilter =
      selectedYear === "all" ? null : Number.parseInt(selectedYear, 10)

    const filteredCompetitions = competitions.filter((c) => {
      if (!yearFilter) return true
      return yearFromDate(c.datum) === yearFilter
    })

    const filteredRows = lbRows.filter((r) => {
      if (!yearFilter) return true
      return yearFromDate(r.tavling) === yearFilter
    })

    const compLookup = new Map<string, CompetitionRow>()

    for (const c of filteredCompetitions) {
      compLookup.set(dateKey(c.datum), c)
    }

    const byCourse = new Map<string, LBRow[]>()

    for (const r of filteredRows) {
      const comp = compLookup.get(dateKey(r.tavling))
      
      // Skip rows that don't have a matching competition in filteredCompetitions
      // (i.e., skip rows from major competitions)
      if (!comp) continue

      const courseKey = comp.bana ?? `[Okänd] ${r.tavling}`

      const arr = byCourse.get(courseKey) ?? []
      arr.push(r)
      byCourse.set(courseKey, arr)
    }

    const courseStats: CourseStats[] = Array.from(byCourse.entries()).map(
      ([bana, rows]) => {
        const played = rows.filter((r) => Number(r.placering) > 0)
        const withPar = played.filter(
          (r) => r.motPar !== null && r.motPar !== undefined
        )

        const dates = Array.from(new Set(played.map((r) => r.tavling))).sort()
        const latestDate = dates.at(-1) ?? null

        const compsForCourse = dates
          .map((d) => compLookup.get(dateKey(d)))
          .filter(Boolean) as CompetitionRow[]

        const latestWinner =
          latestDate &&
          played.find(
            (r) => r.tavling === latestDate && Number(r.placering) === 1
          )?.spelare

        const playerStats = new Map<
          string,
          { motParSum: number; motParCount: number }
        >()

        for (const r of withPar) {
          const cur = playerStats.get(r.spelare) ?? {
            motParSum: 0,
            motParCount: 0,
          }

          cur.motParSum += Number(r.motPar ?? 0)
          cur.motParCount += 1

          playerStats.set(r.spelare, cur)
        }

        const playerList = Array.from(playerStats.entries())
          .filter(([, p]) => p.motParCount > 0)
          .map(([spelare, p]) => ({
            spelare,
            snittMotPar: p.motParSum / p.motParCount,
          }))
          .sort((a, b) => a.snittMotPar - b.snittMotPar)

        const sortedRounds = withPar
          .map((r) => ({
            spelare: r.spelare,
            motPar: Number(r.motPar ?? 0),
            datum: r.tavling,
          }))
          .sort((a, b) => a.motPar - b.motPar)

        const firstKnownPlace =
          compsForCourse.find((c) => c.plats && c.plats.trim() !== "")?.plats ??
          null

        return {
          bana,
          plats: firstKnownPlace,
          antalGanger: dates.length,
          antalRonder: played.length,
          antalMajors: compsForCourse.filter((c) => isMajor(c.major)).length,
          snittMotPar:
            withPar.length > 0
              ? withPar.reduce((s, r) => s + Number(r.motPar ?? 0), 0) / withPar.length
              : null,
          bastaMotPar:
            sortedRounds.length > 0 ? sortedRounds[0].motPar : null,
          samstaMotPar:
            sortedRounds.length > 0
              ? sortedRounds[sortedRounds.length - 1].motPar
              : null,
          snittPoang:
            played.length > 0
              ? played.reduce((s, r) => s + Number(r.poang ?? 0), 0) / played.length
              : null,
          latestDate,
          latestWinner: latestWinner ?? null,
          bestRound: sortedRounds[0] ?? null,
          worstRound: sortedRounds[sortedRounds.length - 1] ?? null,
          bastaSpelare: playerList[0] ?? null,
          samstaSpelare: playerList[playerList.length - 1] ?? null,
        }
      }
    )

    courseStats.sort((a, b) => {
      if (b.antalGanger !== a.antalGanger) return b.antalGanger - a.antalGanger

      const aPar = a.snittMotPar ?? 999
      const bPar = b.snittMotPar ?? 999

      return aPar - bPar
    })

    const mostPlayed = courseStats[0] ?? null

    const easiestCourse =
      courseStats
        .filter((c) => c.snittMotPar !== null)
        .sort((a, b) => Number(a.snittMotPar) - Number(b.snittMotPar))[0] ?? null

    const hardestCourse =
      courseStats
        .filter((c) => c.snittMotPar !== null)
        .sort((a, b) => Number(b.snittMotPar) - Number(a.snittMotPar))[0] ?? null

    const bestRound =
      courseStats
        .flatMap((c) =>
          c.bestRound
            ? [
                {
                  bana: c.bana,
                  ...c.bestRound,
                },
              ]
            : []
        )
        .sort((a, b) => a.motPar - b.motPar)[0] ?? null

    const totalRounds = courseStats.reduce((s, c) => s + c.antalRonder, 0)
    const totalPlayedCompetitions = courseStats.reduce(
      (s, c) => s + c.antalGanger,
      0
    )

    return {
      courseStats,
      mostPlayed,
      easiestCourse,
      hardestCourse,
      bestRound,
      totalRounds,
      totalPlayedCompetitions,
    }
  }, [competitions, lbRows, selectedYear])

  const chartData = useMemo(() => {
    return dashboard.courseStats
      .filter((c) => c.snittMotPar !== null)
      .map((c) => ({
        name: shortCourseName(c.bana),
        fullName: c.bana,
        snittMotPar: Number(c.snittMotPar?.toFixed(1) ?? 0),
      }))
  }, [dashboard.courseStats])

  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/10" />
        <div className="absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-secondary/70" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Course book
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Banstatistik
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Banor, snitt mot par, bästa rundor, sämsta rundor och vilka spelare
              som presterat bäst per bana.
            </p>
          </div>

          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-full sm:w-44">
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
      ) : dashboard.courseStats.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Banor"
              value={`${dashboard.courseStats.length} st`}
              sub={`${dashboard.totalPlayedCompetitions} spelade deltävlingar`}
              icon={MapPin}
            />

            <StatCard
              title="Mest spelad"
              value={dashboard.mostPlayed?.bana ?? "Saknas"}
              sub={
                dashboard.mostPlayed
                  ? `${dashboard.mostPlayed.antalGanger} gånger`
                  : "Ingen data"
              }
              icon={Flag}
            />

            <StatCard
              title="Lättaste bana"
              value={dashboard.easiestCourse?.bana ?? "Saknas"}
              sub={
                dashboard.easiestCourse
                  ? `${formatSigned(dashboard.easiestCourse.snittMotPar)} i snitt`
                  : "Ingen mot-par-data"
              }
              icon={TrendingUp}
            />

            <StatCard
              title="Tuffaste bana"
              value={dashboard.hardestCourse?.bana ?? "Saknas"}
              sub={
                dashboard.hardestCourse
                  ? `${formatSigned(dashboard.hardestCourse.snittMotPar)} i snitt`
                  : "Ingen mot-par-data"
              }
              icon={TrendingDown}
            />
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-primary" />
                Snitt mot par per bana
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div style={{ height: `${Math.max(300, dashboard.courseStats.length * 40)}px` }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(value) => [
                        formatSigned(Number(value), 1),
                        "Snitt mot par",
                      ]}
                      labelFormatter={(label, payload) => {
                        const item = payload?.[0]?.payload as
                          | { fullName?: string }
                          | undefined
                        return item?.fullName ?? label
                      }}
                    />
                    <Bar dataKey="snittMotPar" radius={[0, 8, 8, 0]}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={chartColor(i)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Star className="h-5 w-5 text-primary" />
                Bästa noteringen
              </CardTitle>
            </CardHeader>

            <CardContent>
              {dashboard.bestRound ? (
                <div className="flex flex-col gap-4">
                  <div className="rounded-2xl bg-primary/10 p-5">
                    <div className="text-sm font-semibold text-primary">
                      Bästa runda all-time
                    </div>
                    <div className="mt-2 text-4xl font-black tracking-tight text-foreground">
                      {formatSigned(dashboard.bestRound.motPar, 0)}
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {dashboard.bestRound.spelare} · {dashboard.bestRound.bana}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(dashboard.bestRound.datum)}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoBox
                      label="Totala ronder"
                      value={dashboard.totalRounds}
                      icon={Target}
                    />
                    <InfoBox
                      label="Filter"
                      value={selectedYear === "all" ? "Alla år" : selectedYear}
                      icon={CalendarDays}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Ingen runda med mot-par-data hittades.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5 text-primary" />
                Banor
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="grid gap-4 lg:grid-cols-2">
                {dashboard.courseStats.map((stats) => (
                  <CourseCard key={stats.bana} stats={stats} />
                ))}
              </div>
            </CardContent>
          </Card>

          <CourseRoundsSection
            courseStats={dashboard.courseStats}
            competitions={competitions}
            lbRows={lbRows}
            selectedYear={selectedYear}
          />
        </>
      )}
    </div>
  )
}

// ─── Components ───────────────────────────────────────────────────────────────

function CourseRoundsSection({
  courseStats,
  competitions,
  lbRows,
  selectedYear,
}: {
  courseStats: CourseStats[]
  competitions: CompetitionRow[]
  lbRows: LBRow[]
  selectedYear: string
}) {
  const courseNames = useMemo(
    () => courseStats.map((course) => course.bana),
    [courseStats]
  )

  const [selectedCourse, setSelectedCourse] = useState<string | null>(
    courseNames[0] ?? null
  )

  useEffect(() => {
    if (courseNames.length === 0) {
      if (selectedCourse !== null) setSelectedCourse(null)
      return
    }

    if (!selectedCourse || !courseNames.includes(selectedCourse)) {
      setSelectedCourse(courseNames[0])
    }
  }, [courseNames, selectedCourse])

  const effectiveSelectedCourse =
    selectedCourse && courseNames.includes(selectedCourse)
      ? selectedCourse
      : courseNames[0] ?? null

  const rounds = useMemo<CourseRoundRow[]>(() => {
    if (!effectiveSelectedCourse) return []

    const yearFilter =
      selectedYear === "all" ? null : Number.parseInt(selectedYear, 10)

    const competitionByDate = new Map<string, CompetitionRow>()

    for (const competition of competitions) {
      if (yearFilter && yearFromDate(competition.datum) !== yearFilter) continue
      competitionByDate.set(dateKey(competition.datum), competition)
    }

    return lbRows
      .filter((row) => Number(row.placering) > 0)
      .filter((row) => {
        if (!yearFilter) return true
        return yearFromDate(row.tavling) === yearFilter
      })
      .map<Omit<CourseRoundRow, "rank"> | null>((row) => {
        const competition = competitionByDate.get(dateKey(row.tavling))
        if (!competition) return null

        const bana = competition.bana ?? `[Okänd] ${row.tavling}`
        if (bana !== effectiveSelectedCourse) return null

        return {
          datum: row.tavling,
          bana,
          spelare: row.spelare,
          motPar:
            row.motPar !== null && row.motPar !== undefined
              ? Number(row.motPar)
              : null,
        }
      })
      .filter((row): row is Omit<CourseRoundRow, "rank"> => row !== null)
      .sort(compareRoundsBestToWorst)
      .map((row, index) => ({
        ...row,
        rank: index + 1,
      }))
  }, [competitions, effectiveSelectedCourse, lbRows, selectedYear])

  if (courseNames.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5 text-primary" />
          Alla ronder per bana
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Välj bana
            </div>

            <div className="flex flex-wrap gap-2">
              {courseNames.map((course) => {
                const isSelected = course === effectiveSelectedCourse

                return (
                  <button
                    key={course}
                    type="button"
                    onClick={() => setSelectedCourse(course)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-secondary"
                    }`}
                  >
                    {course}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-secondary/20 p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Vald bana
                </div>
                <div className="mt-1 text-xl font-extrabold tracking-tight text-foreground">
                  {effectiveSelectedCourse}
                </div>
              </div>

              <div className="text-sm font-semibold text-muted-foreground">
                {rounds.length} registrerade {rounds.length === 1 ? "rond" : "ronder"}
              </div>
            </div>
          </div>

          {rounds.length === 0 ? (
            <p className="rounded-2xl bg-secondary/30 p-4 text-sm text-muted-foreground">
              Inga registrerade ronder hittades för vald bana och valt år.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead className="bg-secondary/60 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Rank</th>
                      <th className="px-4 py-3 text-left">Datum</th>
                      <th className="px-4 py-3 text-left">Bana</th>
                      <th className="px-4 py-3 text-left">Spelare</th>
                      <th className="px-4 py-3 text-right">Mot par</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-border bg-card">
                    {rounds.map((round) => (
                      <tr key={`${round.datum}-${round.spelare}`}>
                        <td className="px-4 py-3 font-black tabular-nums text-foreground">
                          #{round.rank}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(round.datum)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-foreground">
                          {round.bana}
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          {round.spelare}
                        </td>
                        <td className="px-4 py-3 text-right font-black tabular-nums text-foreground">
                          {formatSigned(round.motPar, 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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

function CourseCard({ stats }: { stats: CourseStats }) {
  const snittClass =
    stats.snittMotPar !== null && stats.snittMotPar <= 0
      ? "text-primary"
      : "text-destructive"

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/10" />

      <div className="relative flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-extrabold tracking-tight text-foreground">
              {stats.bana}
            </h3>

            <div className="mt-1 text-sm text-muted-foreground">
              {stats.plats ?? "Plats saknas"} · spelad {stats.antalGanger}{" "}
              {stats.antalGanger === 1 ? "gång" : "gånger"}
            </div>

            {stats.latestDate && (
              <div className="mt-1 text-xs text-muted-foreground">
                Senast: {formatDate(stats.latestDate)}
                {stats.latestWinner ? ` · Vinnare: ${stats.latestWinner}` : ""}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <MapPin className="h-6 w-6" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat
            label="Snitt"
            value={formatSigned(stats.snittMotPar)}
            icon={BarChart3}
            valueClass={snittClass}
          />
          <MiniStat
            label="Bästa"
            value={formatSigned(stats.bastaMotPar, 0)}
            icon={Trophy}
            valueClass="text-primary"
          />
          <MiniStat
            label="Sämsta"
            value={formatSigned(stats.samstaMotPar, 0)}
            icon={Skull}
            valueClass="text-destructive"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <PlayerBox
            label="Bästa spelare"
            player={stats.bastaSpelare?.spelare ?? "–"}
            value={
              stats.bastaSpelare
                ? `${formatSigned(stats.bastaSpelare.snittMotPar)} i snitt`
                : "Ingen data"
            }
            icon={Flame}
            positive
          />

          <PlayerBox
            label="Sämsta spelare"
            player={stats.samstaSpelare?.spelare ?? "–"}
            value={
              stats.samstaSpelare
                ? `${formatSigned(stats.samstaSpelare.snittMotPar)} i snitt`
                : "Ingen data"
            }
            icon={TrendingDown}
            negative
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <RoundBox
            label="Bästa runda"
            round={stats.bestRound}
            positive
          />

          <RoundBox
            label="Sämsta runda"
            round={stats.worstRound}
            negative
          />
        </div>
      </div>
    </div>
  )
}

function MiniStat({
  label,
  value,
  icon: Icon,
  valueClass = "text-foreground",
}: {
  label: string
  value: ReactNode
  icon: ComponentType<{ className?: string }>
  valueClass?: string
}) {
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

function PlayerBox({
  label,
  player,
  value,
  icon: Icon,
  positive = false,
  negative = false,
}: {
  label: string
  player: string
  value: ReactNode
  icon: ComponentType<{ className?: string }>
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
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      <div className="mt-2 font-bold text-foreground">{player}</div>
      <div className={`mt-1 text-sm font-semibold ${valueClass}`}>{value}</div>
    </div>
  )
}

function RoundBox({
  label,
  round,
  positive = false,
  negative = false,
}: {
  label: string
  round: { spelare: string; motPar: number; datum: string } | null
  positive?: boolean
  negative?: boolean
}) {
  const valueClass = positive
    ? "text-primary"
    : negative
      ? "text-destructive"
      : "text-foreground"

  return (
    <div className="rounded-xl bg-secondary/30 p-3">
      <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>

      {round ? (
        <>
          <div className={`mt-1 text-xl font-black tabular-nums ${valueClass}`}>
            {formatSigned(round.motPar, 0)}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {round.spelare} · {formatDate(round.datum)}
          </div>
        </>
      ) : (
        <div className="mt-1 text-sm text-muted-foreground">Ingen data</div>
      )}
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

      <div className="h-96 animate-pulse rounded-2xl bg-muted" />

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
          <MapPin className="h-8 w-8 text-muted-foreground" />
        </div>

        <div>
          <div className="text-lg font-bold text-foreground">
            Inga banor hittades
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Kontrollera att tävlingarna har bannamn i competitions-tabellen och
            att leaderboarden innehåller resultat.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
