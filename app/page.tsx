"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import type { ComponentType, ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Instagram,
  Trophy,
  CalendarDays,
  Banknote,
  Images,
  Timer,
  Users,
  BookOpen,
  MapPin,
  Crown,
  Medal,
  Flag,
  TrendingUp,
  ArrowRight,
  AlertTriangle,
  Loader2,
} from "lucide-react"

const SEASON_YEAR = 2026

type LBRow = {
  tavling: string
  spelare: string
  poang: number | null
  placering: number | null
  antal_spelare: number | null
  motPar: number | null
}

type CompetitionRow = {
  datum: string
  bana: string | null
  host: string | null
  major: string | null
  plats: string | null
  ar: string | null
}

type FineRow = {
  spelare: string | null
  botesbelopp: number | null
  ar: number | null
}

type FineTotalRow = {
  datum: string
  tot: number | null
}

type WinnerRow = {
  spelarnamn: string
  ar: number
  final: string | null
}

type PlayerRow = {
  spelarnamn: string
  aktiv: number | null
}

type StandingRow = {
  spelare: string
  poang: number
  tavlingar: number
  vinster: number
  senastePlacering: number | null
}

const moneyFormatter = new Intl.NumberFormat("sv-SE", {
  style: "currency",
  currency: "SEK",
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "short",
})

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null
  return new Date(`${value}T00:00:00`)
}

function isDateInSeason(value: string | null | undefined, year: number) {
  const d = toDate(value)
  return d ? d.getFullYear() === year : false
}

function formatDate(value: string | null | undefined) {
  const d = toDate(value)
  if (!d) return "Okänt datum"
  return dateFormatter.format(d)
}

function daysBetween(from: Date, to: Date) {
  const start = new Date(from)
  start.setHours(0, 0, 0, 0)

  const end = new Date(to)
  end.setHours(0, 0, 0, 0)

  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

function isMajor(value: string | null | undefined) {
  if (!value) return false
  return ["ja", "true", "1", "major"].includes(value.toLowerCase())
}

export default function HomePage() {
  const supabase = useMemo(() => createClient(), [])

  const [lbRows, setLbRows] = useState<LBRow[]>([])
  const [competitions, setCompetitions] = useState<CompetitionRow[]>([])
  const [fines, setFines] = useState<FineRow[]>([])
  const [fineTotals, setFineTotals] = useState<FineTotalRow[]>([])
  const [winners, setWinners] = useState<WinnerRow[]>([])
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false

    async function loadDashboard() {
      setLoading(true)
      setErrors([])

      const [
        leaderboardRes,
        competitionsRes,
        finesRes,
        fineTotalsRes,
        winnersRes,
        playersRes,
      ] = await Promise.all([
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
          .from("competitions")
          .select("datum, bana, host, major, plats, ar:år")
          .order("datum", { ascending: true })
          .returns<CompetitionRow[]>(),

        supabase
          .from("böter")
          .select("spelare, botesbelopp:bötesbelopp, ar")
          .returns<FineRow[]>(),

        supabase
          .from("tot_böter")
          .select("datum, tot")
          .order("datum", { ascending: false })
          .returns<FineTotalRow[]>(),

        supabase
          .from("historiska_vinnare")
          .select("spelarnamn, ar, final")
          .order("ar", { ascending: false })
          .returns<WinnerRow[]>(),

        supabase
          .from("spelare")
          .select("spelarnamn, aktiv")
          .returns<PlayerRow[]>(),
      ])

      if (cancelled) return

      const nextErrors: string[] = []

      if (leaderboardRes.error) nextErrors.push(`Leaderboard: ${leaderboardRes.error.message}`)
      if (competitionsRes.error) nextErrors.push(`Spelschema: ${competitionsRes.error.message}`)
      if (finesRes.error) nextErrors.push(`Böter: ${finesRes.error.message}`)
      if (fineTotalsRes.error) nextErrors.push(`Total böteskassa: ${fineTotalsRes.error.message}`)
      if (winnersRes.error) nextErrors.push(`Historiska vinnare: ${winnersRes.error.message}`)
      if (playersRes.error) nextErrors.push(`Spelare: ${playersRes.error.message}`)

      setLbRows((leaderboardRes.data ?? []) as LBRow[])
      setCompetitions((competitionsRes.data ?? []) as CompetitionRow[])
      setFines((finesRes.data ?? []) as FineRow[])
      setFineTotals((fineTotalsRes.data ?? []) as FineTotalRow[])
      setWinners((winnersRes.data ?? []) as WinnerRow[])
      setPlayers((playersRes.data ?? []) as PlayerRow[])
      setErrors(nextErrors)
      setLoading(false)
    }

    loadDashboard()

    return () => {
      cancelled = true
    }
  }, [supabase])

  const dashboard = useMemo(() => {
    const today = new Date()

    const rowsThisSeason = lbRows.filter(
      (r) => isDateInSeason(r.tavling, SEASON_YEAR) && Number(r.placering ?? 0) > 0
    )

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

    const playedDates = Array.from(new Set(rowsThisSeason.map((r) => r.tavling))).sort(
      (a, b) => {
        const da = toDate(a)?.getTime() ?? 0
        const db = toDate(b)?.getTime() ?? 0
        return da - db
      }
    )

    const latestCompetitionDate = playedDates.at(-1) ?? null

    const latestRows = latestCompetitionDate
      ? rowsThisSeason
          .filter((r) => r.tavling === latestCompetitionDate)
          .sort((a, b) => Number(a.placering ?? 999) - Number(b.placering ?? 999))
      : []

    const latestWinner = latestRows.find((r) => Number(r.placering) === 1) ?? null

    const byPlayer = new Map<string, StandingRow>()

    for (const r of rowsThisSeason) {
      const current = byPlayer.get(r.spelare) ?? {
        spelare: r.spelare,
        poang: 0,
        tavlingar: 0,
        vinster: 0,
        senastePlacering: null,
      }

      current.poang += Number(r.poang ?? 0)
      current.tavlingar += 1

      if (Number(r.placering) === 1) {
        current.vinster += 1
      }

      if (latestCompetitionDate && r.tavling === latestCompetitionDate) {
        current.senastePlacering = r.placering ?? null
      }

      byPlayer.set(r.spelare, current)
    }

    const standings = Array.from(byPlayer.values()).sort((a, b) => {
      if (b.poang !== a.poang) return b.poang - a.poang
      if (b.vinster !== a.vinster) return b.vinster - a.vinster
      return a.spelare.localeCompare(b.spelare, "sv")
    })

    const leader = standings[0] ?? null

    const nextCompetition =
      competitionsThisSeason.find((c) => {
        const d = toDate(c.datum)
        if (!d) return false

        const hasBeenPlayed = playedDates.includes(c.datum)
        return d >= new Date(today.getFullYear(), today.getMonth(), today.getDate()) && !hasBeenPlayed
      }) ?? null

    const finalCompetition = competitionsThisSeason.at(-1) ?? null
    const finalDate = toDate(finalCompetition?.datum)
    const daysToFinal = finalDate ? daysBetween(today, finalDate) : null

    const latestFineTotal = fineTotals
      .filter((r) => isDateInSeason(r.datum, SEASON_YEAR))
      .sort((a, b) => {
        const da = toDate(a.datum)?.getTime() ?? 0
        const db = toDate(b.datum)?.getTime() ?? 0
        return db - da
      })[0]

    const finesThisSeason = fines.filter((f) => {
      if (f.ar === null || f.ar === undefined) return true
      return Number(f.ar) === SEASON_YEAR
    })

    const calculatedFineTotal = finesThisSeason.reduce(
      (sum, f) => sum + Number(f.botesbelopp ?? 0),
      0
    )

    const totalFines = Number(latestFineTotal?.tot ?? calculatedFineTotal)

    const finesByPlayer = new Map<string, number>()

    for (const f of finesThisSeason) {
      if (!f.spelare) continue
      finesByPlayer.set(f.spelare, (finesByPlayer.get(f.spelare) ?? 0) + Number(f.botesbelopp ?? 0))
    }

    const mostFined =
      Array.from(finesByPlayer.entries())
        .map(([spelare, belopp]) => ({ spelare, belopp }))
        .sort((a, b) => b.belopp - a.belopp)[0] ?? null

    const reigningChampion =
      winners.find((w) => Number(w.ar) < SEASON_YEAR) ?? winners[0] ?? null

    const activePlayers = players.filter((p) => Number(p.aktiv ?? 0) === 1).length

    return {
      standings,
      leader,
      rowsThisSeason,
      competitionsThisSeason,
      playedDates,
      latestCompetitionDate,
      latestRows,
      latestWinner,
      nextCompetition,
      finalCompetition,
      daysToFinal,
      totalFines,
      mostFined,
      reigningChampion,
      activePlayers,
    }
  }, [lbRows, competitions, fines, fineTotals, winners, players])

  return (
    <div className="flex flex-col gap-6">
      {/* Hero + leaderboard preview */}
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="w-fit rounded-2xl bg-card p-4 ring-1 ring-border shadow-sm">
                <div className="relative h-28 w-40 sm:h-32 sm:w-48">
                  <Image
                    src="/images/logo.png"
                    alt="Odds on Tour logotyp"
                    fill
                    className="object-contain drop-shadow-md"
                    priority
                  />
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-4">
                <div>
                  <div className="mb-2 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    Race to Sand {SEASON_YEAR}
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                    Odds on Tour
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    Leaderboard, spelschema, böteskassa och historik för årets tour.
                    Följ ställningen, nästa deltävling och vägen mot finalen.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href="https://www.instagram.com/oddsontour/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
                  >
                    <Instagram className="h-4 w-4" />
                    Instagram
                  </a>

                  <a
                    href="https://www.tiktok.com/@oddsontour"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
                  >
                    TikTok
                  </a>

                  <Link
                    href="/leaderboard"
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Se leaderboard
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="h-5 w-5 text-primary" />
              Topp 5 just nu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MiniLeaderboard loading={loading} standings={dashboard.standings} />
          </CardContent>
        </Card>
      </section>

      {/* Error info */}
      {errors.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Några delar av dashboarden kunde inte laddas
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
          loading={loading}
          title="Ledare"
          value={dashboard.leader?.spelare ?? "Ingen ledare"}
          sub={
            dashboard.leader
              ? `${dashboard.leader.poang} poäng · ${dashboard.leader.vinster} vinster`
              : "Ingen leaderboard registrerad"
          }
          icon={Crown}
          href="/leaderboard"
        />

        <StatCard
          loading={loading}
          title="Nästa deltävling"
          value={dashboard.nextCompetition?.bana ?? "Ej satt"}
          sub={
            dashboard.nextCompetition
              ? `${formatDate(dashboard.nextCompetition.datum)} · ${dashboard.nextCompetition.plats ?? "Okänd plats"}`
              : "Ingen kommande tävling hittad"
          }
          icon={CalendarDays}
          href="/spelschema"
        />

        <StatCard
          loading={loading}
          title="Böteskassa"
          value={moneyFormatter.format(dashboard.totalFines)}
          sub={
            dashboard.mostFined
              ? `Mest böter: ${dashboard.mostFined.spelare}, ${moneyFormatter.format(dashboard.mostFined.belopp)}`
              : "Ingen bötesdata registrerad"
          }
          icon={Banknote}
          href="/boter"
        />

        <StatCard
          loading={loading}
          title="Till finalen"
          value={
            dashboard.daysToFinal === null
              ? "Ej satt"
              : dashboard.daysToFinal < 0
                ? "Avgjord"
                : `${dashboard.daysToFinal} dagar`
          }
          sub={
            dashboard.finalCompetition
              ? `${dashboard.finalCompetition.bana ?? "Final"} · ${formatDate(dashboard.finalCompetition.datum)}`
              : "Finaldatum saknas"
          }
          icon={Timer}
          href="/countdown"
        />

        <StatCard
          loading={loading}
          title="Spelade deltävlingar"
          value={`${dashboard.playedDates.length}/${dashboard.competitionsThisSeason.length}`}
          sub="Registrerade resultat av årets schema"
          icon={Flag}
          href="/spelschema"
        />

        <StatCard
          loading={loading}
          title="Senaste vinnare"
          value={dashboard.latestWinner?.spelare ?? "Ingen ännu"}
          sub={
            dashboard.latestCompetitionDate
              ? `Vann ${formatDate(dashboard.latestCompetitionDate)}`
              : "Inget resultat registrerat"
          }
          icon={Medal}
          href="/leaderboard"
        />

        <StatCard
          loading={loading}
          title="Regerande mästare"
          value={dashboard.reigningChampion?.spelarnamn ?? "Saknas"}
          sub={
            dashboard.reigningChampion
              ? `${dashboard.reigningChampion.ar} · ${dashboard.reigningChampion.final ?? "Final"}`
              : "Ingen historisk vinnare registrerad"
          }
          icon={Trophy}
          href="/historia"
        />

        <StatCard
          loading={loading}
          title="Aktiva spelare"
          value={dashboard.activePlayers > 0 ? `${dashboard.activePlayers} st` : "Saknas"}
          sub="Spelare markerade som aktiva"
          icon={Users}
          href="/spelare"
        />
      </section>

      {/* Recent + next */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
              Senaste deltävlingen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LatestCompetition
              loading={loading}
              date={dashboard.latestCompetitionDate}
              rows={dashboard.latestRows}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5 text-primary" />
              Kommande på schemat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NextCompetition loading={loading} competition={dashboard.nextCompetition} />
          </CardContent>
        </Card>
      </section>

      {/* Quick links */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Gå vidare</h2>
          <span className="text-sm text-muted-foreground">Alla tourens sidor</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink href="/leaderboard" icon={Trophy} title="Leaderboard" desc="Poängställning och utveckling" />
          <QuickLink href="/spelschema" icon={CalendarDays} title="Spelschema" desc="Deltävlingar per år" />
          <QuickLink href="/boter" icon={Banknote} title="Böteskassa" desc="Böter, total och per spelare" />
          <QuickLink href="/banor" icon={MapPin} title="Banor" desc="Statistik per golfbana" />
          <QuickLink href="/bilder" icon={Images} title="Bilder" desc="Lagbilder och minnen" />
          <QuickLink href="/countdown" icon={Timer} title="Countdown" desc="Nedräkning till finalen" />
          <QuickLink href="/spelare" icon={Users} title="Spelare" desc="Aktiva och historiska" />
          <QuickLink href="/historia" icon={BookOpen} title="Historia & Info" desc="Vinnare och ansvarsområden" />
        </div>
      </section>
    </div>
  )
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  href,
  loading,
}: {
  title: string
  value: ReactNode
  sub: string
  icon: ComponentType<{ className?: string }>
  href: string
  loading: boolean
}) {
  return (
    <Link href={href} className="group">
      <Card className="h-full transition-colors group-hover:bg-secondary/40">
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
    </Link>
  )
}

function MiniLeaderboard({
  loading,
  standings,
}: {
  loading: boolean
  standings: StandingRow[]
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    )
  }

  if (standings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ingen leaderboard registrerad för {SEASON_YEAR}.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {standings.slice(0, 5).map((row, index) => (
        <div
          key={row.spelare}
          className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-background text-sm font-bold text-foreground">
              {index + 1}
            </div>
            <div>
              <div className="font-semibold text-foreground">{row.spelare}</div>
              <div className="text-xs text-muted-foreground">
                {row.vinster} vinster · {row.tavlingar} tävlingar
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="font-extrabold tabular-nums text-foreground">
              {row.poang}
            </div>
            <div className="text-xs text-muted-foreground">poäng</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function LatestCompetition({
  loading,
  date,
  rows,
}: {
  loading: boolean
  date: string | null
  rows: LBRow[]
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Laddar senaste resultat...
      </div>
    )
  }

  if (!date || rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Inget resultat är registrerat ännu.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-sm text-muted-foreground">Senast spelad</div>
        <div className="text-xl font-bold text-foreground">{formatDate(date)}</div>
      </div>

      <div className="flex flex-col gap-2">
        {rows.slice(0, 3).map((r) => (
          <div
            key={`${r.tavling}-${r.spelare}`}
            className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-background text-sm font-bold text-foreground">
                {r.placering}
              </div>
              <div className="font-semibold text-foreground">{r.spelare}</div>
            </div>

            <div className="text-sm text-muted-foreground">
              {r.poang ?? 0} p
              {r.motPar !== null && r.motPar !== undefined ? ` · ${r.motPar > 0 ? "+" : ""}${r.motPar}` : ""}
            </div>
          </div>
        ))}
      </div>

      <Link
        href="/leaderboard"
        className="inline-flex w-fit items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        Se hela resultatet
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

function NextCompetition({
  loading,
  competition,
}: {
  loading: boolean
  competition: CompetitionRow | null
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
      <p className="text-sm text-muted-foreground">
        Ingen kommande deltävling hittades i spelschemat.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-2xl font-extrabold text-foreground">
            {competition.bana ?? "Okänd bana"}
          </h3>

          {isMajor(competition.major) && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              Major
            </span>
          )}
        </div>

        <div className="mt-1 text-sm text-muted-foreground">
          {formatDate(competition.datum)}
          {competition.plats ? ` · ${competition.plats}` : ""}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-secondary/40 p-3">
          <div className="text-xs text-muted-foreground">Host</div>
          <div className="font-semibold text-foreground">
            {competition.host ?? "Ej angivet"}
          </div>
        </div>

        <div className="rounded-lg bg-secondary/40 p-3">
          <div className="text-xs text-muted-foreground">År</div>
          <div className="font-semibold text-foreground">
            {competition.ar ?? SEASON_YEAR}
          </div>
        </div>
      </div>

      <Link
        href="/spelschema"
        className="inline-flex w-fit items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        Se spelschema
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

function QuickLink({
  href,
  icon: Icon,
  title,
  desc,
}: {
  href: string
  icon: ComponentType<{ className?: string }>
  title: string
  desc: string
}) {
  return (
    <Link href={href} className="group">
      <Card className="h-full transition-colors group-hover:bg-secondary/40">
        <CardContent className="flex items-start gap-3 p-5">
          <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
            <Icon className="h-5 w-5" />
          </div>

          <div>
            <div className="font-semibold text-foreground">{title}</div>
            <div className="text-sm text-muted-foreground">{desc}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
