"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen, Trophy, ClipboardList, Flame, Star, Skull, Target, TrendingUp, TrendingDown, Award } from "lucide-react"

// ─── Static data ──────────────────────────────────────────────────────────────

const RESPONSIBILITIES = [
  { area: "Sociala medier",                    who: "Benne & Axel" },
  { area: "Sponsor",                           who: "Alvin & Frasse" },
  { area: "Ekonomi",                           who: "Crille" },
  { area: "IT",                                who: "Crille" },
  { area: "Merch",                             who: "Löken" },
  { area: "Bana final",                        who: "Axel" },
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
  icon: React.ReactNode
  highlight?: "gold" | "bad" | "neutral"
  sub?: string
}

type WinnerRow = {
  spelarnamn: string
  ar: number
  final: string | null
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

// ─── Record card ──────────────────────────────────────────────────────────────

function RecordCard({ item }: { item: RecordItem }) {
  const valueClass =
    item.highlight === "gold"
      ? "text-primary"
      : item.highlight === "bad"
        ? "text-destructive"
        : "text-foreground"

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-secondary/30 p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {item.icon}
        {item.label}
      </div>
      <div className={`text-2xl font-extrabold tabular-nums ${valueClass}`}>
        {item.value}
      </div>
      <div className="font-semibold text-foreground">{item.holder}</div>
      {item.sub && (
        <div className="text-xs text-muted-foreground">{item.sub}</div>
      )}
    </div>
  )
}

// ─── All-time records ─────────────────────────────────────────────────────────

function AllTimeRecords({ rows, winners }: { rows: LBRow[]; winners: WinnerRow[] }) {
  const records = useMemo((): RecordItem[] => {
    if (rows.length === 0) return []

    const played = rows.filter((r) => Number(r.placering) > 0)
    const withPar = played.filter(
      (r) => r.motPar !== null && r.motPar !== undefined
    )

    // ── Aggregate per player ──
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
        if (Number(r.placering) === 1) cur.antalVinster += 1
        if (Number(r.placering) === Number(r.antal_spelare))
          cur.antalSista += 1
      }
      if (r.motPar !== null && r.motPar !== undefined) {
        cur.motParSum += Number(r.motPar)
        cur.motParCount += 1
      }
      byPlayer.set(r.spelare, cur)
    }

    const players = Array.from(byPlayer.entries())

    // ── 1. Mest totala poäng ──
    const mostPoints = players
      .map(([spelare, a]) => ({ spelare, v: a.totalPoang }))
      .sort((a, b) => b.v - a.v)[0]

    // ── 2. Flest deltävlingsvinster ──
    const mostWins = players
      .map(([spelare, a]) => ({ spelare, v: a.antalVinster }))
      .sort((a, b) => b.v - a.v)[0]

    // ── 3. Bäst snitt mot par ──
    const bestAvgPar = players
      .filter(([, a]) => a.motParCount >= 3) // minst 3 rundor för att räknas
      .map(([spelare, a]) => ({ spelare, v: a.motParSum / a.motParCount }))
      .sort((a, b) => a.v - b.v)[0]

    // ── 4. Flest tävlingar spelade ──
    const mostPlayed = players
      .map(([spelare, a]) => ({ spelare, v: a.antalTavlingar }))
      .sort((a, b) => b.v - a.v)[0]

    // ── 5. Bästa enskilda runda (lägst mot par) ──
    const bestRound = withPar
      .map((r) => ({ spelare: r.spelare, v: Number(r.motPar), tavling: r.tavling }))
      .sort((a, b) => a.v - b.v)[0]

    // ── 6. Sämsta enskilda runda (högst mot par) ──
    const worstRound = withPar
      .map((r) => ({ spelare: r.spelare, v: Number(r.motPar), tavling: r.tavling }))
      .sort((a, b) => b.v - a.v)[0]

    // ── 7. Flest sistaplatser ──
    const mostLast = players
      .map(([spelare, a]) => ({ spelare, v: a.antalSista }))
      .sort((a, b) => b.v - a.v)[0]

    // ── 8. Flest tourvinster (från Supabase) ──
    const twMap = calcTourWins(winners)
    const mostTourWins = Array.from(twMap.entries())
      .map(([spelare, v]) => ({ spelare, v }))
      .sort((a, b) => b.v - a.v)[0]

    const result: RecordItem[] = []

    if (mostTourWins) {
      result.push({
        label: "Flest tourvinster",
        holder: mostTourWins.spelare,
        value: `${mostTourWins.v} st`,
        icon: <Trophy className="h-4 w-4" />,
        highlight: "gold",
        sub: winners
          .filter((w) => w.spelarnamn === mostTourWins.spelare)
          .map((w) => w.ar)
          .sort()
          .join(", "),
      })
    }

    if (mostPoints) {
      result.push({
        label: "Mest totala poäng (all-time)",
        holder: mostPoints.spelare,
        value: `${mostPoints.v} p`,
        icon: <Flame className="h-4 w-4" />,
        highlight: "gold",
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
        sub: bestRound.tavling.slice(0, 10),
      })
    }

    if (worstRound) {
      result.push({
        label: "Sämsta enskilda runda",
        holder: worstRound.spelare,
        value: formatSigned(worstRound.v, 0),
        icon: <TrendingDown className="h-4 w-4" />,
        highlight: "bad",
        sub: worstRound.tavling.slice(0, 10),
      })
    }

    if (mostLast) {
      result.push({
        label: "Flest sistaplatser 💀",
        holder: mostLast.spelare,
        value: `${mostLast.v} st`,
        icon: <Skull className="h-4 w-4" />,
        highlight: "bad",
      })
    }

    return result
  }, [rows])

  if (rows.length === 0 && winners.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ingen data hittades i leaderboard.
      </p>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {records.map((item) => (
        <RecordCard key={item.label} item={item} />
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
          .order("ar", { ascending: false }),
      ])

      if (cancelled) return

      if (lbError) { setError(lbError.message); setLoading(false); return }
      if (winnersError) { setError(winnersError.message); setLoading(false); return }

      setLbRows((lbData ?? []) as LBRow[])
      setWinners((winnersData ?? []) as WinnerRow[])
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [supabase])

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">Historia & Info</h1>

      {/* ── Om Odds on Tour ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5 text-primary" />
            Om Odds on Tour
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
          <p>Välkommen till samlingssidan för Odds on Tour.</p>
          <p>
            Odds on Tour (tidigare Race to Sand) drog igång 2019 och har sedan
            dess växt och cementerats till en av de mest prestigefyllda
            tävlingarna inom golfvärlden. Varje år består vanligtvis av strax
            under 10 deltävlingar där poäng samlas ihop inför finalen där allt
            ska avgöras. Väl mött!
          </p>
        </CardContent>
      </Card>

      {/* ── All-time Records ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Flame className="h-5 w-5 text-primary" />
            All-time Records
            {loading && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                Laddar...
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <div className="font-medium text-foreground">
                Kunde inte ladda statistik
              </div>
              <div className="text-muted-foreground">{error}</div>
            </div>
          ) : loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div
                  key={i}
                  className="h-28 animate-pulse rounded-xl bg-muted"
                />
              ))}
            </div>
          ) : (
            <AllTimeRecords rows={lbRows} winners={winners} />
          )}
        </CardContent>
      </Card>

      {/* ── Tidigare vinnare ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="h-5 w-5 text-primary" />
            Tidigare vinnare
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {winners.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {loading ? "Laddar..." : "Inga vinnare registrerade ännu."}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {winners.map((w) => {
                const wins = tourWinCounts.get(w.spelarnamn) ?? 0
                return (
                  <div
                    key={w.ar}
                    className="flex items-center justify-between rounded-md bg-secondary/40 px-3 py-2"
                  >
                  <div className="flex items-center gap-3">
                      <span className="font-medium text-foreground">{w.ar}</span>
                      {w.final && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {w.final}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground">{w.spelarnamn}</span>
                      {wins >= 2 && (
                        <span
                          className="rounded-full bg-chart-2/20 px-1.5 py-0.5 text-xs font-semibold text-primary"
                          title={`${wins} tourvinster`}
                        >
                          ×{wins}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Ansvarsområden ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5 text-primary" />
            Ansvarsområden
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {RESPONSIBILITIES.map((r) => (
            <div
              key={r.area}
              className="flex items-center justify-between rounded-md bg-secondary/40 px-3 py-2"
            >
              <span className="font-medium text-foreground">{r.area}</span>
              <span className="text-muted-foreground">{r.who}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
