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
  CalendarDays,
  CheckCircle2,
  Clock,
  Crown,
  Flag,
  Loader2,
  MapPin,
  Sparkles,
  Target,
  Trophy,
  Users,
} from "lucide-react"

type CompetitionRow = {
  datum: string
  bana: string | null
  host?: string | null
  hosts?: string | null
  major: string | null
  plats: string | null
  ar?: string | null
}

type LBRow = {
  tavling: string
  spelare: string
  poang: number | null
  placering: number | null
  motPar: number | null
}

const COMP_TABLE = "competitions"
const LB_TABLE = "leaderboard"

function yearFromDate(dateStr: string) {
  return Number(dateStr.slice(0, 4))
}

function toDate(value: string | null | undefined) {
  if (!value) return null
  return new Date(`${value.slice(0, 10)}T00:00:00`)
}

function formatDate(value: string | null | undefined) {
  const d = toDate(value)
  if (!d) return "Okänt datum"

  return new Intl.DateTimeFormat("sv-SE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d)
}

function formatLongDate(value: string | null | undefined) {
  const d = toDate(value)
  if (!d) return "Okänt datum"

  return new Intl.DateTimeFormat("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d)
}

function isMajor(value: string | null | undefined) {
  if (!value) return false
  return ["ja", "true", "1", "major"].includes(value.toLowerCase())
}

function getHost(row: CompetitionRow) {
  return row.host ?? row.hosts ?? null
}

function isTodayOrFuture(dateStr: string) {
  const d = toDate(dateStr)
  if (!d) return false

  const today = new Date()
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  return d >= todayDate
}

function daysUntil(dateStr: string | null | undefined) {
  const d = toDate(dateStr)
  if (!d) return null

  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  return Math.ceil((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

export default function SpelschemaPage() {
  const supabase = useMemo(() => createClient(), [])

  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [competitions, setCompetitions] = useState<CompetitionRow[]>([])
  const [lbRows, setLbRows] = useState<LBRow[]>([])
  const [loadingYears, setLoadingYears] = useState(true)
  const [loadingRows, setLoadingRows] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadYears() {
      setLoadingYears(true)
      setError(null)

      const { data, error } = await supabase.from(COMP_TABLE).select("datum")

      if (cancelled) return

      if (error) {
        setError(error.message)
        setYears([])
        setSelectedYear(null)
        setLoadingYears(false)
        return
      }

      const uniq = Array.from(
        new Set(
          (data ?? [])
            .map((r: { datum: string }) => yearFromDate(r.datum))
            .filter((y) => Number.isFinite(y))
        )
      ).sort((a, b) => b - a)

      setYears(uniq)
      setSelectedYear((prev) => prev ?? uniq[0] ?? null)
      setLoadingYears(false)
    }

    loadYears()

    return () => {
      cancelled = true
    }
  }, [supabase])

  useEffect(() => {
    if (!selectedYear) {
      setLoadingRows(false)
      return
    }

    let cancelled = false

    async function loadRows() {
      setLoadingRows(true)
      setError(null)

      const from = `${selectedYear}-01-01`
      const to = `${selectedYear}-12-31`

      let { data: compData, error: compError } = await supabase
        .from(COMP_TABLE)
        .select("datum, bana, host, major, plats, ar:år")
        .gte("datum", from)
        .lte("datum", to)
        .order("datum", { ascending: true })

      if (compError) {
        const retry = await supabase
          .from(COMP_TABLE)
          .select("datum, bana, hosts, major, plats")
          .gte("datum", from)
          .lte("datum", to)
          .order("datum", { ascending: true })

        compData = retry.data
        compError = retry.error
      }

      const { data: leaderboardData, error: leaderboardError } = await supabase
        .from(LB_TABLE)
        .select(
          `
          tavling:tävling,
          spelare,
          poang:poäng,
          placering,
          motPar:mot_par
        `
        )
        .gte("tävling", from)
        .lte("tävling", to)
        .returns<LBRow[]>()

      if (cancelled) return

      if (compError) {
        setError(compError.message)
        setCompetitions([])
        setLbRows([])
        setLoadingRows(false)
        return
      }

      if (leaderboardError) {
        setError(leaderboardError.message)
        setCompetitions((compData ?? []) as CompetitionRow[])
        setLbRows([])
        setLoadingRows(false)
        return
      }

      setCompetitions((compData ?? []) as CompetitionRow[])
      setLbRows((leaderboardData ?? []) as LBRow[])
      setLoadingRows(false)
    }

    loadRows()

    return () => {
      cancelled = true
    }
  }, [supabase, selectedYear])

  const dashboard = useMemo(() => {
    const playedDates = new Set(
      lbRows
        .filter((r) => Number(r.placering ?? 0) > 0)
        .map((r) => r.tavling)
    )

    const winnerByDate = new Map<string, LBRow>()

    for (const r of lbRows) {
      if (Number(r.placering) === 1) {
        winnerByDate.set(r.tavling, r)
      }
    }

    const sorted = [...competitions].sort((a, b) => {
      const da = toDate(a.datum)?.getTime() ?? 0
      const db = toDate(b.datum)?.getTime() ?? 0
      return da - db
    })

    const nextCompetition =
      sorted.find((c) => isTodayOrFuture(c.datum) && !playedDates.has(c.datum)) ?? null

    const latestPlayedDate =
      [...playedDates].sort((a, b) => {
        const da = toDate(a)?.getTime() ?? 0
        const db = toDate(b)?.getTime() ?? 0
        return db - da
      })[0] ?? null

    const latestWinner = latestPlayedDate ? winnerByDate.get(latestPlayedDate) ?? null : null

    const majorCount = sorted.filter((c) => isMajor(c.major)).length
    const playedCount = sorted.filter((c) => playedDates.has(c.datum)).length
    const finalCompetition = sorted.at(-1) ?? null

    return {
      sorted,
      playedDates,
      winnerByDate,
      nextCompetition,
      latestWinner,
      latestPlayedDate,
      majorCount,
      playedCount,
      finalCompetition,
    }
  }, [competitions, lbRows])

  const loading = loadingYears || loadingRows

  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/10" />
        <div className="absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-secondary/70" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Tour schema
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Spelschema
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Årets deltävlingar, värdar, major-status och vägen fram till finalen.
            </p>
          </div>

          <Select
            value={selectedYear ? String(selectedYear) : undefined}
            onValueChange={(v) => setSelectedYear(Number(v))}
            disabled={loadingYears || years.length === 0}
          >
            <SelectTrigger className="w-full sm:w-40">
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
      ) : competitions.length === 0 ? (
        <EmptyState selectedYear={selectedYear} />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Deltävlingar"
              value={`${dashboard.playedCount}/${dashboard.sorted.length}`}
              sub="Spelade av årets schema"
              icon={CalendarDays}
            />

            <StatCard
              title="Nästa tävling"
              value={dashboard.nextCompetition?.bana ?? "Saknas"}
              sub={
                dashboard.nextCompetition
                  ? `${formatDate(dashboard.nextCompetition.datum)} · ${
                      daysUntil(dashboard.nextCompetition.datum) ?? "?"
                    } dagar kvar`
                  : "Ingen kommande tävling hittad"
              }
              icon={Clock}
            />

            <StatCard
              title="Majors"
              value={`${dashboard.majorCount} st`}
              sub="Tävlingar markerade som major"
              icon={Trophy}
            />

            <StatCard
              title="Final"
              value={dashboard.finalCompetition?.bana ?? "Ej satt"}
              sub={
                dashboard.finalCompetition
                  ? formatLongDate(dashboard.finalCompetition.datum)
                  : "Final saknas"
              }
              icon={Flag}
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="h-5 w-5 text-primary" />
                  Nästa deltävling
                </CardTitle>
              </CardHeader>
              <CardContent>
                <NextCompetition competition={dashboard.nextCompetition} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Crown className="h-5 w-5 text-primary" />
                  Senaste vinnare
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard.latestWinner ? (
                  <div className="flex flex-col gap-3">
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Senast spelad tävling
                      </div>
                      <div className="mt-1 text-2xl font-extrabold text-foreground">
                        {dashboard.latestWinner.spelare}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {formatDate(dashboard.latestWinner.tavling)} ·{" "}
                        {dashboard.latestWinner.poang ?? 0} poäng
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Ingen spelad tävling hittades ännu.
                  </p>
                )}
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5 text-primary" />
                Vägen genom säsongen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {dashboard.sorted.map((r, index) => {
                  const played = dashboard.playedDates.has(r.datum)
                  const winner = dashboard.winnerByDate.get(r.datum)
                  const final = index === dashboard.sorted.length - 1
                  const major = isMajor(r.major)

                  return (
                    <div
                      key={`${r.datum}-${r.bana}`}
                      className="flex flex-col gap-3 rounded-2xl border border-border bg-secondary/25 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={
                            played
                              ? "rounded-full bg-primary/10 p-2 text-primary"
                              : final
                                ? "rounded-full bg-primary p-2 text-primary-foreground"
                                : "rounded-full bg-background p-2 text-muted-foreground"
                          }
                        >
                          {played ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : final ? (
                            <Trophy className="h-4 w-4" />
                          ) : (
                            <CalendarDays className="h-4 w-4" />
                          )}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-bold text-foreground">
                              {r.bana ?? "Okänd bana"}
                            </div>

                            {major && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                                Major
                              </span>
                            )}

                            {final && (
                              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                                Final
                              </span>
                            )}
                          </div>

                          <div className="mt-1 text-sm text-muted-foreground">
                            {formatLongDate(r.datum)}
                            {r.plats ? ` · ${r.plats}` : ""}
                          </div>

                          {winner && (
                            <div className="mt-1 text-xs font-medium text-primary">
                              Vinnare: {winner.spelare}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        {getHost(r) ?? "Host saknas"}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
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

function NextCompetition({ competition }: { competition: CompetitionRow | null }) {
  if (!competition) {
    return (
      <p className="text-sm text-muted-foreground">
        Ingen kommande deltävling hittades.
      </p>
    )
  }

  const days = daysUntil(competition.datum)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-2xl font-extrabold text-foreground">
            {competition.bana ?? "Okänd bana"}
          </h3>

          {isMajor(competition.major) && (
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
              Major
            </span>
          )}
        </div>

        <div className="mt-1 text-sm text-muted-foreground">
          {formatLongDate(competition.datum)}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <InfoBox label="Plats" value={competition.plats ?? "Ej angivet"} />
        <InfoBox label="Host" value={getHost(competition) ?? "Ej angivet"} />
        <InfoBox
          label="Tid kvar"
          value={days === null ? "–" : days === 0 ? "Idag" : `${days} dagar`}
        />
      </div>
    </div>
  )
}

function InfoBox({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-secondary/40 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-semibold text-foreground">{value}</div>
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

      <div className="h-80 animate-pulse rounded-2xl bg-muted" />
    </div>
  )
}

function EmptyState({ selectedYear }: { selectedYear: number | null }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="rounded-full bg-secondary p-4">
          <CalendarDays className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <div className="text-lg font-bold text-foreground">
            Inga deltävlingar hittades
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Det finns inget schema för {selectedYear ?? "valt år"}.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
