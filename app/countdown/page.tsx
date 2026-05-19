"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import type { ComponentType, ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Crown,
  Flag,
  Loader2,
  MapPin,
  Medal,
  Sparkles,
  Target,
  Timer,
  Trophy,
  Users,
} from "lucide-react"

const SEASON_YEAR = 2026
const FALLBACK_FINAL_DATE = "2026-09-12"

type CompetitionRow = {
  datum: string
  bana: string | null
  host: string | null
  major: string | null
  plats: string | null
  ar: string | null
}

type LBRow = {
  tavling: string
  spelare: string
  poang: number | null
  placering: number | null
  antal_spelare: number | null
  motPar: number | null
}

type WinnerRow = {
  spelarnamn: string
  ar: number
  final: string | null
}

type StandingRow = {
  spelare: string
  poang: number
  tavlingar: number
  vinster: number
}

const shortDateFormatter = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "short",
})

const longDateFormatter = new Intl.DateTimeFormat("sv-SE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
})

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null
  return new Date(`${value}T00:00:00`)
}

function formatShortDate(value: string | null | undefined) {
  const date = toDate(value)
  return date ? shortDateFormatter.format(date) : "Okänt datum"
}

function formatLongDate(value: string | null | undefined) {
  const date = toDate(value)
  return date ? longDateFormatter.format(date) : "Okänt datum"
}

function isDateInSeason(value: string | null | undefined, year: number) {
  const date = toDate(value)
  return date ? date.getFullYear() === year : false
}

function isMajor(value: string | null | undefined) {
  if (!value) return false
  return ["ja", "true", "1", "major"].includes(value.toLowerCase())
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getCountdownParts(now: Date | null, finalDate: Date | null) {
  if (!now || !finalDate) return null

  const diffMs = finalDate.getTime() - now.getTime()
  const hasPassed = diffMs < 0
  const safeDiffMs = Math.max(diffMs, 0)

  const totalMinutes = Math.floor(safeDiffMs / (1000 * 60))
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes - days * 60 * 24) / 60)
  const minutes = totalMinutes % 60

  return {
    days,
    hours,
    minutes,
    hasPassed,
  }
}

function getSeasonProgress(
  seasonStart: Date | null,
  finalDate: Date | null,
  now: Date | null
) {
  if (!seasonStart || !finalDate || !now) return 0

  const total = finalDate.getTime() - seasonStart.getTime()
  const elapsed = now.getTime() - seasonStart.getTime()

  if (total <= 0) return 0

  return Math.round(clamp((elapsed / total) * 100, 0, 100))
}

export default function CountdownPage() {
  const supabase = useMemo(() => createClient(), [])

  const [now, setNow] = useState<Date | null>(null)
  const [competitions, setCompetitions] = useState<CompetitionRow[]>([])
  const [lbRows, setLbRows] = useState<LBRow[]>([])
  const [winners, setWinners] = useState<WinnerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    setNow(new Date())

    const interval = window.setInterval(() => {
      setNow(new Date())
    }, 60 * 1000)

    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setErrors([])

      const [competitionsRes, leaderboardRes, winnersRes] = await Promise.all([
        supabase
          .from("competitions")
          .select("datum, bana, host, major, plats, ar:år")
          .order("datum", { ascending: true })
          .returns<CompetitionRow[]>(),

        supabase
          .from("leaderboard")
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

        supabase
          .from("historiska_vinnare")
          .select("spelarnamn, ar, final")
          .order("ar", { ascending: false })
          .returns<WinnerRow[]>(),
      ])

      if (cancelled) return

      const nextErrors: string[] = []

      if (competitionsRes.error) {
        nextErrors.push(`Spelschema: ${competitionsRes.error.message}`)
      }

      if (leaderboardRes.error) {
        nextErrors.push(`Leaderboard: ${leaderboardRes.error.message}`)
      }

      if (winnersRes.error) {
        nextErrors.push(`Historiska vinnare: ${winnersRes.error.message}`)
      }

      setCompetitions((competitionsRes.data ?? []) as CompetitionRow[])
      setLbRows((leaderboardRes.data ?? []) as LBRow[])
      setWinners((winnersRes.data ?? []) as WinnerRow[])
      setErrors(nextErrors)
      setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [supabase])

  const dashboard = useMemo(() => {
    const today = now ?? new Date()

    const competitionsThisSeason = competitions
      .filter((c) => {
        if (c.ar) return Number(c.ar) === SEASON_YEAR
        return isDateInSeason(c.datum, SEASON_YEAR)
      })
      .sort((a, b) => {
        const da = toDate(a.datum)?.getTime() ?? 0
        const db = toDate(b.datum)?.getTime() ?? 0
        return da - db
      })

    const rowsThisSeason = lbRows.filter(
      (r) => isDateInSeason(r.tavling, SEASON_YEAR) && Number(r.placering ?? 0) > 0
    )

    const playedDates = Array.from(new Set(rowsThisSeason.map((r) => r.tavling))).sort(
      (a, b) => {
        const da = toDate(a)?.getTime() ?? 0
        const db = toDate(b)?.getTime() ?? 0
        return da - db
      }
    )

    const finalCompetition = competitionsThisSeason.at(-1) ?? null
    const finalDateString = finalCompetition?.datum ?? FALLBACK_FINAL_DATE
    const finalDate = toDate(finalDateString)

    const seasonStart =
      toDate(competitionsThisSeason[0]?.datum) ??
      new Date(`${SEASON_YEAR}-01-01T00:00:00`)

    const todayAtMidnight = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    )

    const nextCompetition =
      competitionsThisSeason.find((c) => {
        const date = toDate(c.datum)
        if (!date) return false

        const alreadyPlayed = playedDates.includes(c.datum)

        return date >= todayAtMidnight && !alreadyPlayed
      }) ?? null

    const byPlayer = new Map<string, StandingRow>()

    for (const r of rowsThisSeason) {
      const current = byPlayer.get(r.spelare) ?? {
        spelare: r.spelare,
        poang: 0,
        tavlingar: 0,
        vinster: 0,
      }

      current.poang += Number(r.poang ?? 0)
      current.tavlingar += 1

      if (Number(r.placering) === 1) {
        current.vinster += 1
      }

      byPlayer.set(r.spelare, current)
    }

    const standings = Array.from(byPlayer.values()).sort((a, b) => {
      if (b.poang !== a.poang) return b.poang - a.poang
      if (b.vinster !== a.vinster) return b.vinster - a.vinster
      return a.spelare.localeCompare(b.spelare, "sv")
    })

    const leader = standings[0] ?? null

    const reigningChampion =
      winners.find((w) => Number(w.ar) < SEASON_YEAR) ?? winners[0] ?? null

    const progress = getSeasonProgress(seasonStart, finalDate, now)

    return {
      competitionsThisSeason,
      playedDates,
      finalCompetition,
      finalDateString,
      finalDate,
      nextCompetition,
      leader,
      reigningChampion,
      progress,
      playedCount: playedDates.length,
      totalCount: competitionsThisSeason.length,
    }
  }, [competitions, lbRows, winners, now])

  const countdown = getCountdownParts(now, dashboard.finalDate)
  const pageLoading = loading || !now

  return (
    <div className="flex flex-col gap-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/10" />
        <div className="absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-secondary/70" />

        <div className="relative grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Final Countdown
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl">
              Nedräkning till finalen
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Vägen mot finalen är igång. Här visas hur långt det är kvar,
              vilken bana som väntar och hur säsongen ligger till.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/spelschema"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Se spelschema
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/leaderboard"
                className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground hover:bg-secondary/80"
              >
                Se leaderboard
              </Link>
            </div>
          </div>

          <CountdownBox loading={pageLoading} countdown={countdown} />
        </div>
      </section>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Några delar kunde inte laddas
          </div>

          <ul className="mt-2 list-inside list-disc text-muted-foreground">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Stat cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          loading={pageLoading}
          title="Finaldatum"
          value={formatShortDate(dashboard.finalDateString)}
          sub={formatLongDate(dashboard.finalDateString)}
          icon={CalendarDays}
        />

        <StatCard
          loading={pageLoading}
          title="Finalbana"
          value={dashboard.finalCompetition?.bana ?? "Ej satt"}
          sub={dashboard.finalCompetition?.plats ?? "Plats saknas"}
          icon={Flag}
        />

        <StatCard
          loading={pageLoading}
          title="Nuvarande ledare"
          value={dashboard.leader?.spelare ?? "Ingen ledare"}
          sub={
            dashboard.leader
              ? `${dashboard.leader.poang} poäng · ${dashboard.leader.vinster} vinster`
              : "Ingen leaderboard registrerad"
          }
          icon={Crown}
        />

        <StatCard
          loading={pageLoading}
          title="Regerande mästare"
          value={dashboard.reigningChampion?.spelarnamn ?? "Saknas"}
          sub={
            dashboard.reigningChampion
              ? `${dashboard.reigningChampion.ar} · ${dashboard.reigningChampion.final ?? "Final"}`
              : "Ingen historisk vinnare registrerad"
          }
          icon={Trophy}
        />
      </section>

      {/* Progress + next */}
      <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5 text-primary" />
              Säsongsprogress
            </CardTitle>
          </CardHeader>

          <CardContent>
            <SeasonProgress
              loading={pageLoading}
              progress={dashboard.progress}
              playedCount={dashboard.playedCount}
              totalCount={dashboard.totalCount}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5 text-primary" />
              Nästa deltävling
            </CardTitle>
          </CardHeader>

          <CardContent>
            <NextCompetition
              loading={pageLoading}
              competition={dashboard.nextCompetition}
              finalDateString={dashboard.finalDateString}
            />
          </CardContent>
        </Card>
      </section>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-primary" />
            Vägen till finalen
          </CardTitle>
        </CardHeader>

        <CardContent>
          <CompetitionTimeline
            loading={pageLoading}
            competitions={dashboard.competitionsThisSeason}
            playedDates={dashboard.playedDates}
            finalDateString={dashboard.finalDateString}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function CountdownBox({
  loading,
  countdown,
}: {
  loading: boolean
  countdown: ReturnType<typeof getCountdownParts>
}) {
  if (loading || !countdown) {
    return (
      <div className="rounded-3xl border border-border bg-background/70 p-6 shadow-sm">
        <div className="mb-4 h-5 w-32 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (countdown.hasPassed) {
    return (
      <div className="rounded-3xl border border-primary/30 bg-primary/10 p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Trophy className="h-4 w-4" />
          Finalen är här
        </div>

        <div className="mt-3 text-4xl font-black tracking-tight text-foreground">
          Avgörandet är igång
        </div>

        <p className="mt-2 text-sm text-muted-foreground">
          Countdownen har nått finaldatumet.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-border bg-background/70 p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Timer className="h-4 w-4 text-primary" />
        Tid kvar
      </div>

      <div className="grid grid-cols-3 gap-3">
        <CountdownUnit label="Dagar" value={countdown.days} featured />
        <CountdownUnit label="Timmar" value={countdown.hours} />
        <CountdownUnit label="Minuter" value={countdown.minutes} />
      </div>
    </div>
  )
}

function CountdownUnit({
  label,
  value,
  featured = false,
}: {
  label: string
  value: number
  featured?: boolean
}) {
  return (
    <div
      className={
        featured
          ? "rounded-2xl bg-primary p-4 text-primary-foreground"
          : "rounded-2xl bg-secondary/60 p-4 text-foreground"
      }
    >
      <div className="text-3xl font-black tabular-nums tracking-tight sm:text-4xl">
        {value}
      </div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-wide opacity-80">
        {label}
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  loading,
}: {
  title: string
  value: ReactNode
  sub: string
  icon: ComponentType<{ className?: string }>
  loading: boolean
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

        {loading ? (
          <div className="space-y-2">
            <div className="h-7 w-28 animate-pulse rounded bg-muted" />
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <div>
            <div className="text-2xl font-extrabold tracking-tight text-foreground">
              {value}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">{sub}</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SeasonProgress({
  loading,
  progress,
  playedCount,
  totalCount,
}: {
  loading: boolean
  progress: number
  playedCount: number
  totalCount: number
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-3xl font-black tracking-tight text-foreground">
          {progress}%
        </div>
        <div className="text-sm text-muted-foreground">
          av perioden fram till finaldatumet
        </div>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-secondary/40 p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Spelade deltävlingar
          </div>
          <div className="mt-1 text-xl font-bold text-foreground">
            {playedCount}
          </div>
        </div>

        <div className="rounded-xl bg-secondary/40 p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Totalt på schema
          </div>
          <div className="mt-1 text-xl font-bold text-foreground">
            {totalCount}
          </div>
        </div>
      </div>
    </div>
  )
}

function NextCompetition({
  loading,
  competition,
  finalDateString,
}: {
  loading: boolean
  competition: CompetitionRow | null
  finalDateString: string
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Laddar kommande tävling...
      </div>
    )
  }

  if (!competition) {
    return (
      <div className="rounded-xl bg-secondary/40 p-4">
        <div className="font-semibold text-foreground">
          Ingen kommande deltävling hittades
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Kontrollera att spelschemat har datum för {SEASON_YEAR}.
        </p>
      </div>
    )
  }

  const isFinal = competition.datum === finalDateString

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-2xl font-extrabold text-foreground">
            {competition.bana ?? "Okänd bana"}
          </h3>

          {isFinal && (
            <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">
              Final
            </span>
          )}

          {isMajor(competition.major) && !isFinal && (
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
              Major
            </span>
          )}
        </div>

        <div className="mt-1 text-sm text-muted-foreground">
          {formatLongDate(competition.datum)}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-secondary/40 p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Plats
          </div>
          <div className="mt-1 font-semibold text-foreground">
            {competition.plats ?? "Ej angivet"}
          </div>
        </div>

        <div className="rounded-xl bg-secondary/40 p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Host
          </div>
          <div className="mt-1 font-semibold text-foreground">
            {competition.host ?? "Ej angivet"}
          </div>
        </div>
      </div>

      <Link
        href="/spelschema"
        className="inline-flex w-fit items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        Öppna spelschema
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

function CompetitionTimeline({
  loading,
  competitions,
  playedDates,
  finalDateString,
}: {
  loading: boolean
  competitions: CompetitionRow[]
  playedDates: string[]
  finalDateString: string
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    )
  }

  if (competitions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Inga tävlingar hittades i spelschemat för {SEASON_YEAR}.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {competitions.map((competition) => {
        const hasBeenPlayed = playedDates.includes(competition.datum)
        const isFinal = competition.datum === finalDateString
        const major = isMajor(competition.major)

        return (
          <div
            key={`${competition.datum}-${competition.bana}`}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-secondary/25 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <div
                className={
                  hasBeenPlayed
                    ? "rounded-full bg-primary/10 p-2 text-primary"
                    : isFinal
                      ? "rounded-full bg-primary p-2 text-primary-foreground"
                      : "rounded-full bg-background p-2 text-muted-foreground"
                }
              >
                {hasBeenPlayed ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : isFinal ? (
                  <Trophy className="h-4 w-4" />
                ) : (
                  <CalendarDays className="h-4 w-4" />
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-bold text-foreground">
                    {competition.bana ?? "Okänd bana"}
                  </div>

                  {isFinal && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                      Final
                    </span>
                  )}

                  {major && !isFinal && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                      Major
                    </span>
                  )}
                </div>

                <div className="mt-1 text-sm text-muted-foreground">
                  {formatShortDate(competition.datum)}
                  {competition.plats ? ` · ${competition.plats}` : ""}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              {competition.host ?? "Host saknas"}
            </div>
          </div>
        )
      })}
    </div>
  )
}
