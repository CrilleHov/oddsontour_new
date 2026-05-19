"use client"

import { useEffect, useMemo, useState } from "react"
import type { ComponentType, ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Award,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Crown,
  Flame,
  History,
  Medal,
  Shield,
  Skull,
  Sparkles,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react"

// ─── Static data ──────────────────────────────────────────────────────────────

const RESPONSIBILITIES = [
  { area: "Sociala medier", who: "Benne & Axel" },
  { area: "Sponsor", who: "Alvin & Frasse" },
  { area: "Ekonomi", who: "Crille" },
  { area: "IT", who: "Crille" },
  { area: "Merch", who: "Löken" },
  { area: "Bana final", who: "Axel" },
  { area: "Hotell och restaurang till finalen", who: "Vigge, Johan & Jojo" },
]

// ─── Types ────────────────────────────────────────────────────────────────────

type LBRow = {
  spelare: string
  poang: number
  placering: number
  antal_spelare: number
  motPar: number | null
  tavling: string
}

type RecordItem = {
  label: string
  holder: string
  value: string
  icon: ReactNode
  highlight?: "gold" | "bad" | "neutral"
  sub?: string
}

type WinnerRow = {
  spelarnamn: string
  ar: number
  final: string | null
}

type HallOfFameWinner = WinnerRow & {
  wins: number
  isLatest: boolean
}

const LB_TABLE = "leaderboard"
const WINNERS_TABLE = "historiska_vinnare"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSigned(n: number, decimals = 1): string {
  const val = parseFloat(n.toFixed(decimals))
  return val > 0 ? `+${val}` : `${val}`
}

function calcTourWins(winners: WinnerRow[]): Map<string, number> {
  const map = new Map<string, number>()

  for (const w of winners) {
    map.set(w.spelarnamn, (map.get(w.spelarnamn) ?? 0) + 1)
  }

  return map
}

function getYearRange(winners: WinnerRow[]) {
  if (winners.length === 0) return null

  const years = winners
    .map((w) => Number(w.ar))
    .filter((y) => !Number.isNaN(y))
    .sort((a, b) => a - b)

  if (years.length === 0) return null

  const first = years[0]
  const last = years[years.length - 1]

  return first === last ? `${first}` : `${first}–${last}`
}

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function SectionTitle({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  description?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
      </div>

      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  )
}

function StatPill({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/70 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">
        {value}
      </div>
    </div>
  )
}

// ─── Record card ──────────────────────────────────────────────────────────────

function RecordCard({ item, index }: { item: RecordItem; index: number }) {
  const valueClass =
    item.highlight === "gold"
      ? "text-primary"
      : item.highlight === "bad"
        ? "text-destructive"
        : "text-foreground"

  const bgClass =
    item.highlight === "gold"
      ? "bg-primary/5"
      : item.highlight === "bad"
        ? "bg-destructive/5"
        : "bg-secondary/30"

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border p-4 shadow-sm ${bgClass}`}
    >
      <div className="absolute right-3 top-3 text-5xl font-black leading-none text-muted-foreground/10">
        {index + 1}
      </div>

      <div className="relative flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span className="rounded-lg bg-background p-2 text-primary shadow-sm">
            {item.icon}
          </span>
          {item.label}
        </div>

        <div className={`text-3xl font-extrabold tabular-nums ${valueClass}`}>
          {item.value}
        </div>

        <div>
          <div className="font-bold text-foreground">{item.holder}</div>
          {item.sub && (
            <div className="mt-1 text-xs text-muted-foreground">{item.sub}</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── All-time records ─────────────────────────────────────────────────────────

function AllTimeRecords({
  rows,
  winners,
}: {
  rows: LBRow[]
  winners: WinnerRow[]
}) {
  const records = useMemo((): RecordItem[] => {
    const played = rows.filter((r) => Number(r.placering) > 0)
    const withPar = played.filter(
      (r) => r.motPar !== null && r.motPar !== undefined
    )

    type Acc = {
      totalPoang: number
      antalTavlingar: number
      antalVinster: number
      antalSista: number
      motParSum: number
      motParCount: number
    }

    const byPlayer = new Map<string, Acc>()

    for (const r of rows) {
      const cur = byPlayer.get(r.spelare) ?? {
        totalPoang: 0,
        antalTavlingar: 0,
        antalVinster: 0,
        antalSista: 0,
        motParSum: 0,
        motParCount: 0,
      }

      cur.totalPoang += Number(r.poang ?? 0)

      if (Number(r.placering) > 0) {
        cur.antalTavlingar += 1

        if (Number(r.placering) === 1) {
          cur.antalVinster += 1
        }

        if (Number(r.placering) === Number(r.antal_spelare)) {
          cur.antalSista += 1
        }
      }

      if (r.motPar !== null && r.motPar !== undefined) {
        cur.motParSum += Number(r.motPar)
        cur.motParCount += 1
      }

      byPlayer.set(r.spelare, cur)
    }

    const players = Array.from(byPlayer.entries())

    const mostPoints = players
      .map(([spelare, a]) => ({ spelare, v: a.totalPoang }))
      .sort((a, b) => b.v - a.v)[0]

    const mostWins = players
      .map(([spelare, a]) => ({ spelare, v: a.antalVinster }))
      .sort((a, b) => b.v - a.v)[0]

    const bestAvgPar = players
      .filter(([, a]) => a.motParCount >= 3)
      .map(([spelare, a]) => ({ spelare, v: a.motParSum / a.motParCount }))
      .sort((a, b) => a.v - b.v)[0]

    const mostPlayed = players
      .map(([spelare, a]) => ({ spelare, v: a.antalTavlingar }))
      .sort((a, b) => b.v - a.v)[0]

    const bestRound = withPar
      .map((r) => ({
        spelare: r.spelare,
        v: Number(r.motPar),
        tavling: r.tavling,
      }))
      .sort((a, b) => a.v - b.v)[0]

    const worstRound = withPar
      .map((r) => ({
        spelare: r.spelare,
        v: Number(r.motPar),
        tavling: r.tavling,
      }))
      .sort((a, b) => b.v - a.v)[0]

    const mostLast = players
      .map(([spelare, a]) => ({ spelare, v: a.antalSista }))
      .sort((a, b) => b.v - a.v)[0]

    const tourWinMap = calcTourWins(winners)

    const mostTourWins = Array.from(tourWinMap.entries())
      .map(([spelare, v]) => ({ spelare, v }))
      .sort((a, b) => b.v - a.v)[0]

    const result: RecordItem[] = []

    if (mostTourWins) {
      result.push({
        label: "Flest tourvinster",
        holder: mostTourWins.spelare,
        value: `${mostTourWins.v} st`,
        icon: <Crown className="h-4 w-4" />,
        highlight: "gold",
        sub: winners
          .filter((w) => w.spelarnamn === mostTourWins.spelare)
          .map((w) => w.ar)
          .sort((a, b) => a - b)
          .join(", "),
      })
    }

    if (mostPoints) {
      result.push({
        label: "Mest totala poäng",
        holder: mostPoints.spelare,
        value: `${mostPoints.v} p`,
        icon: <Flame className="h-4 w-4" />,
        highlight: "gold",
        sub: "Summerat över alla registrerade deltävlingar",
      })
    }

    if (mostWins) {
      result.push({
        label: "Flest deltävlingsvinster",
        holder: mostWins.spelare,
        value: `${mostWins.v} st`,
        icon: <Award className="h-4 w-4" />,
        highlight: "gold",
      })
    }

    if (bestAvgPar) {
      result.push({
        label: "Bäst snitt mot par",
        holder: bestAvgPar.spelare,
        value: formatSigned(bestAvgPar.v),
        icon: <TrendingUp className="h-4 w-4" />,
        highlight: "gold",
        sub: "Minst 3 rundor",
      })
    }

    if (mostPlayed) {
      result.push({
        label: "Flest tävlingar spelade",
        holder: mostPlayed.spelare,
        value: `${mostPlayed.v} st`,
        icon: <Target className="h-4 w-4" />,
        highlight: "neutral",
      })
    }

    if (bestRound) {
      result.push({
        label: "Bästa enskilda runda",
        holder: bestRound.spelare,
        value: formatSigned(bestRound.v, 0),
        icon: <Star className="h-4 w-4" />,
        highlight: "gold",
        sub: bestRound.tavling,
      })
    }

    if (worstRound) {
      result.push({
        label: "Sämsta enskilda runda",
        holder: worstRound.spelare,
        value: formatSigned(worstRound.v, 0),
        icon: <TrendingDown className="h-4 w-4" />,
        highlight: "bad",
        sub: worstRound.tavling,
      })
    }

    if (mostLast) {
      result.push({
        label: "Flest sistaplatser",
        holder: mostLast.spelare,
        value: `${mostLast.v} st`,
        icon: <Skull className="h-4 w-4" />,
        highlight: "bad",
      })
    }

    return result
  }, [rows, winners])

  if (records.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ingen rekorddata hittades ännu.
      </p>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {records.map((item, index) => (
        <RecordCard key={item.label} item={item} index={index} />
      ))}
    </div>
  )
}

// ─── Hall of Fame ─────────────────────────────────────────────────────────────

function HallOfFame({
  winners,
  loading,
}: {
  winners: WinnerRow[]
  loading: boolean
}) {
  const tourWinCounts = useMemo(() => calcTourWins(winners), [winners])

  const decoratedWinners = useMemo((): HallOfFameWinner[] => {
    if (winners.length === 0) return []

    const latestYear = Math.max(...winners.map((w) => Number(w.ar)))

    return winners
      .map((w) => ({
        ...w,
        wins: tourWinCounts.get(w.spelarnamn) ?? 1,
        isLatest: Number(w.ar) === latestYear,
      }))
      .sort((a, b) => Number(b.ar) - Number(a.ar))
  }, [winners, tourWinCounts])

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    )
  }

  if (decoratedWinners.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Inga vinnare registrerade ännu.
      </p>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {decoratedWinners.map((w) => (
        <div
          key={`${w.ar}-${w.spelarnamn}`}
          className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm"
        >
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/10" />
          <div className="absolute right-4 top-4 text-6xl font-black leading-none text-muted-foreground/10">
            {w.ar}
          </div>

          <div className="relative flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <Trophy className="h-6 w-6" />
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                {w.isLatest && (
                  <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">
                    Regerande
                  </span>
                )}

                {w.wins >= 2 && (
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground">
                    ×{w.wins} vinnare
                  </span>
                )}
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-muted-foreground">
                {w.ar}
              </div>
              <div className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">
                {w.spelarnamn}
              </div>
            </div>

            <div className="rounded-xl bg-secondary/40 px-3 py-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Final
              </div>
              <div className="font-semibold text-foreground">
                {w.final ?? "Ej angiven"}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Responsibilities ─────────────────────────────────────────────────────────

function Responsibilities() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {RESPONSIBILITIES.map((r) => (
        <div
          key={r.area}
          className="flex items-center justify-between gap-4 rounded-xl border border-border bg-secondary/30 px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-background p-2 text-primary shadow-sm">
              <Shield className="h-4 w-4" />
            </div>
            <span className="font-semibold text-foreground">{r.area}</span>
          </div>

          <span className="text-right text-sm font-medium text-muted-foreground">
            {r.who}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HistoriaPage() {
  const supabase = useMemo(() => createClient(), [])

  const [lbRows, setLbRows] = useState<LBRow[]>([])
  const [winners, setWinners] = useState<WinnerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const tourWinCounts = useMemo(() => calcTourWins(winners), [winners])

  const historyStats = useMemo(() => {
    const uniqueChampions = new Set(winners.map((w) => w.spelarnamn)).size
    const yearRange = getYearRange(winners)

    const mostDecorated = Array.from(tourWinCounts.entries())
      .map(([spelare, wins]) => ({ spelare, wins }))
      .sort((a, b) => b.wins - a.wins)[0]

    const playedRows = lbRows.filter((r) => Number(r.placering) > 0)
    const uniqueCompetitions = new Set(playedRows.map((r) => r.tavling)).size

    return {
      totalSeasons: winners.length,
      uniqueChampions,
      yearRange,
      mostDecorated,
      uniqueCompetitions,
    }
  }, [winners, tourWinCounts, lbRows])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const [
        { data: lbData, error: lbError },
        { data: winnersData, error: winnersError },
      ] = await Promise.all([
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

        supabase
          .from(WINNERS_TABLE)
          .select("spelarnamn, ar, final")
          .order("ar", { ascending: false })
          .returns<WinnerRow[]>(),
      ])

      if (cancelled) return

      if (lbError) {
        setError(lbError.message)
        setLoading(false)
        return
      }

      if (winnersError) {
        setError(winnersError.message)
        setLoading(false)
        return
      }

      setLbRows((lbData ?? []) as LBRow[])
      setWinners((winnersData ?? []) as WinnerRow[])
      setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [supabase])

  return (
    <div className="flex flex-col gap-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10" />
        <div className="absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-secondary/60" />

        <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Hall of Fame
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Historia & Info
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Odds on Tour, tidigare Race to Sand, drog igång 2019 och har
              sedan dess växt till en årlig tour med deltävlingar, poängjakt,
              final och intern prestige. Här samlas vinnare, rekord och
              ansvarsområden.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <StatPill
              icon={History}
              label="Säsonger"
              value={
                loading ? (
                  <span className="block h-7 w-16 animate-pulse rounded bg-muted" />
                ) : (
                  historyStats.totalSeasons
                )
              }
            />

            <StatPill
              icon={Users}
              label="Unika mästare"
              value={
                loading ? (
                  <span className="block h-7 w-16 animate-pulse rounded bg-muted" />
                ) : (
                  historyStats.uniqueChampions
                )
              }
            />

            <StatPill
              icon={CalendarDays}
              label="Period"
              value={
                loading ? (
                  <span className="block h-7 w-24 animate-pulse rounded bg-muted" />
                ) : (
                  historyStats.yearRange ?? "Saknas"
                )
              }
            />

            <StatPill
              icon={Crown}
              label="Flest titlar"
              value={
                loading ? (
                  <span className="block h-7 w-24 animate-pulse rounded bg-muted" />
                ) : historyStats.mostDecorated ? (
                  `${historyStats.mostDecorated.spelare} ×${historyStats.mostDecorated.wins}`
                ) : (
                  "Saknas"
                )
              }
            />
          </div>
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <div className="font-semibold text-foreground">
            Kunde inte ladda historiksidan
          </div>
          <div className="mt-1 text-muted-foreground">{error}</div>
        </div>
      )}

      {/* All-time records */}
      <Card>
        <CardHeader>
          <SectionTitle
            icon={Flame}
            title="All-time Records"
            description="Rekord baserat på alla registrerade leaderboard-rader."
          />
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div
                  key={i}
                  className="h-40 animate-pulse rounded-2xl bg-muted"
                />
              ))}
            </div>
          ) : error ? (
            <p className="text-sm text-muted-foreground">
              Rekord kunde inte visas eftersom data inte kunde laddas.
            </p>
          ) : (
            <AllTimeRecords rows={lbRows} winners={winners} />
          )}
        </CardContent>
      </Card>

      {/* Hall of Fame */}
      <Card>
        <CardHeader>
          <SectionTitle
            icon={Trophy}
            title="Tidigare vinnare"
            description="Tourens mästare genom åren."
          />
        </CardHeader>

        <CardContent>
          {error ? (
            <p className="text-sm text-muted-foreground">
              Tidigare vinnare kunde inte visas eftersom data inte kunde laddas.
            </p>
          ) : (
            <HallOfFame winners={winners} loading={loading} />
          )}
        </CardContent>
      </Card>

      {/* Info + responsibilities */}
      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-primary" />
              Om Odds on Tour
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Varje år består vanligtvis av strax under tio deltävlingar där
              poäng samlas in inför finalen. Säsongen avgörs inte bara av en bra
              runda, utan av kontinuitet, topprestationer och förmågan att hålla
              ihop spelet när det gäller.
            </p>

            <div className="rounded-2xl border border-border bg-secondary/30 p-4">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Medal className="h-4 w-4 text-primary" />
                Historisk omfattning
              </div>

              <div className="mt-2 text-muted-foreground">
                {loading ? (
                  <span className="block h-5 w-48 animate-pulse rounded bg-muted" />
                ) : (
                  <>
                    {historyStats.uniqueCompetitions} registrerade deltävlingar
                    och {historyStats.totalSeasons} registrerade säsongsvinnare.
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionTitle
              icon={ClipboardList}
              title="Ansvarsområden"
              description="Vem som ansvarar för vad runt touren."
            />
          </CardHeader>

          <CardContent>
            <Responsibilities />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
