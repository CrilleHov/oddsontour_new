"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { ComponentType, ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { addFees } from "@/lib/actions"
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
  Banknote,
  BarChart3,
  CalendarDays,
  Crown,
  Flame,
  Lock,
  PiggyBank,
  RefreshCw,
  ScrollText,
  Settings,
  Skull,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

type PlayerRow = {
  spelarnamn: string
  namn_full: string | null
  aktiv: number | boolean | null
}

type FeeRule = {
  regel: string
  antal: number
  belopp: number
}

type FeeRow = {
  spelare: string
  belopp: number
  ar: number
  tavling_datum: string | null
  regler: FeeRule[] | null
}

type CompetitionRow = {
  datum: string
  bana: string | null
  host: string | null
  major: number | boolean | null
  plats: string | null
  ar: number
}

type TotRow = {
  datum: string
  tot: number
}

type ShameRow = {
  spelare: string
  total: number
  antalAr: number
  antalTavlingar: number
  snittPerAr: number
  snittPerTavling: number
}

const PLAYERS_TABLE = "spelare"
const FEES_TABLE = "fees"
const TOT_TABLE = "tot_böter"
const COMPETITIONS_TABLE = "competitions"

const ALLA_TAVLINGAR = "alla"

type Rule = {
  rule: string
  belopp: number
  per?: string
  gemensam?: boolean
}

const RULES: Rule[] = [
  { rule: "Streck/0 poäng", belopp: 10 },
  { rule: "Kissar på golfbanan", belopp: 50 },
  { rule: "Kastar utrustning", belopp: 100, per: "gång" },
  { rule: "Kastar boll", belopp: 50, per: "boll" },
  { rule: "Tappar bort järnheadcovers", belopp: 50, per: "st" },
  { rule: "Inte på golfbanan 30 min innan FÖRSTA starttid", belopp: 50 },
  { rule: "Har ej straffutrustning", belopp: 1000 },
  { rule: "Inte har minst ett Race to Sand-plagg på sig", belopp: 100 },
  { rule: "Bira-boll", belopp: 20 },
  { rule: "HIO/Albatross: de andra spelarna böter", belopp: 100, gemensam: true },
  { rule: "Ej tillgänglig att scoreföra på Gamebook", belopp: 100 },
  { rule: "Ej bötesswish samma dag som tävling", belopp: 200 },
  { rule: "Dålig anledning till att inte vara med på tävling", belopp: 100 },
  { rule: "Anonymitet", belopp: 50 },
]

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
]

function isActive(v: PlayerRow["aktiv"]) {
  if (typeof v === "boolean") return v
  return Number(v) === 1
}

function isMajor(v: CompetitionRow["major"]) {
  if (typeof v === "boolean") return v
  return Number(v) === 1
}

function playerNickname(p: PlayerRow) {
  return (p.spelarnamn ?? "").trim()
}

function ruleLabel(r: Rule) {
  return r.per ? `${r.belopp} kr/${r.per}` : `${r.belopp} kr`
}

function formatDateSv(dateString: string | null | undefined) {
  if (!dateString) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [y, m, d] = dateString.split("-")
    return `${y}-${m}-${d}`
  }

  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return dateString

  return d.toLocaleDateString("sv-SE")
}

function shortDateSv(dateString: string | null | undefined) {
  if (!dateString) return ""
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString.slice(5)
  return formatDateSv(dateString) ?? ""
}

function competitionLabel(c: CompetitionRow) {
  const namn = c.bana ?? c.plats ?? "Okänd bana"
  return `${formatDateSv(c.datum)} · ${namn}${isMajor(c.major) ? " ★" : ""}`
}

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0))
}

function chartColor(index: number) {
  return COLORS[index % COLORS.length]
}

export default function BoterPage() {
  const supabase = useMemo(() => createClient(), [])

  const [activePlayers, setActivePlayers] = useState<string[]>([])
  const [competitions, setCompetitions] = useState<CompetitionRow[]>([])
  const [fees, setFees] = useState<FeeRow[]>([])
  const [allFees, setAllFees] = useState<FeeRow[]>([])
  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [selectedTavling, setSelectedTavling] = useState<string>(ALLA_TAVLINGAR)
  const [latestTotal, setLatestTotal] = useState<TotRow | null>(null)
  const [totalHistory, setTotalHistory] = useState<TotRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingFees, setLoadingFees] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formFees, setFormFees] = useState<Record<string, number>>({})
  const [formRules, setFormRules] = useState<Record<string, Record<string, number>>>({})
  const [detailPlayer, setDetailPlayer] = useState<string | null>(null)
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [regTavling, setRegTavling] = useState<string | null>(null)
  const [showAdmin, setShowAdmin] = useState(false)

  const loadMeta = useCallback(async () => {
    setError(null)

    const [
      { data: playersData, error: playersError },
      { data: compData, error: compError },
      { data: totData, error: totError },
      { data: allFeesData, error: allFeesError },
    ] = await Promise.all([
      supabase
        .from(PLAYERS_TABLE)
        .select("spelarnamn, namn_full, aktiv")
        .eq("aktiv", 1)
        .order("spelarnamn", { ascending: true }),

      supabase
        .from(COMPETITIONS_TABLE)
        .select("datum, bana, host, major, plats, ar:år")
        .order("datum", { ascending: false }),

      supabase.from(TOT_TABLE).select("datum, tot").order("datum", { ascending: true }),

      supabase
        .from(FEES_TABLE)
        .select("spelare, belopp:bötesbelopp, ar, tavling_datum, regler"),
    ])

    if (playersError) throw playersError
    if (compError) throw compError
    if (totError) throw totError
    if (allFeesError) throw allFeesError

    const active = ((playersData ?? []) as PlayerRow[])
      .filter((p) => isActive(p.aktiv))
      .map(playerNickname)
      .filter(Boolean)

    setActivePlayers(active)

    setFormFees((prev) => {
      const next: Record<string, number> = {}
      for (const player of active) next[player] = prev[player] ?? 0
      return next
    })

    const comps = ((compData ?? []) as CompetitionRow[]).map((c) => ({
      ...c,
      ar: Number(c.ar ?? c.datum?.slice(0, 4)),
    }))

    setCompetitions(comps)

    const mappedAllFees = ((allFeesData ?? []) as FeeRow[]).map((r) => ({
      spelare: r.spelare,
      belopp: Number(r.belopp ?? 0),
      ar: Number(r.ar),
      tavling_datum: r.tavling_datum ?? null,
      regler: (r.regler ?? null) as FeeRule[] | null,
    }))

    setAllFees(mappedAllFees)

    const currentYear = new Date().getFullYear()

    const yearOptions = Array.from(
      new Set([
        ...comps.map((c) => c.ar),
        ...mappedAllFees.map((f) => f.ar),
        currentYear,
      ])
    )
      .filter((x) => Number.isFinite(x))
      .sort((a, b) => b - a)

    setYears(yearOptions)
    setSelectedYear((prev) => prev ?? yearOptions[0] ?? currentYear)

    setRegTavling((prev) => prev ?? comps[0]?.datum ?? null)

    const totalsHistory = ((totData ?? []) as TotRow[]).map((r) => ({
      datum: r.datum,
      tot: Number(r.tot ?? 0),
    }))

    setTotalHistory(totalsHistory)
    setLatestTotal(
      totalsHistory.length > 0 ? totalsHistory[totalsHistory.length - 1] : null
    )
  }, [supabase])

  const loadFeesForYear = useCallback(
    async (year: number) => {
      setLoadingFees(true)
      setError(null)

      try {
        const { data, error } = await supabase
          .from(FEES_TABLE)
          .select("spelare, belopp:bötesbelopp, ar, tavling_datum, regler")
          .eq("ar", year)
          .order("tavling_datum", { ascending: true })

        if (error) throw error

        setFees(
          ((data ?? []) as FeeRow[]).map((r) => ({
            spelare: r.spelare,
            belopp: Number(r.belopp ?? 0),
            ar: Number(r.ar),
            tavling_datum: r.tavling_datum ?? null,
            regler: (r.regler ?? null) as FeeRule[] | null,
          }))
        )
      } catch (e: any) {
        setError(e?.message ?? String(e))
        setFees([])
      } finally {
        setLoadingFees(false)
      }
    },
    [supabase]
  )

  useEffect(() => {
    let mounted = true

    async function init() {
      setLoading(true)

      try {
        await loadMeta()
      } catch (e: any) {
        if (mounted) setError(e?.message ?? String(e))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    init()

    return () => {
      mounted = false
    }
  }, [loadMeta])

  useEffect(() => {
    if (!selectedYear) return
    loadFeesForYear(selectedYear)
  }, [selectedYear, loadFeesForYear])

  useEffect(() => {
    setSelectedTavling(ALLA_TAVLINGAR)
  }, [selectedYear])

  const compsForYear = useMemo(
    () => competitions.filter((c) => c.ar === selectedYear),
    [competitions, selectedYear]
  )

  const visibleFees = useMemo(
    () =>
      selectedTavling === ALLA_TAVLINGAR
        ? fees
        : fees.filter((f) => f.tavling_datum === selectedTavling),
    [fees, selectedTavling]
  )

  const totals = useMemo(() => {
    const map = new Map<string, number>()

    for (const f of visibleFees) {
      map.set(f.spelare, (map.get(f.spelare) ?? 0) + Number(f.belopp ?? 0))
    }

    const rows = Array.from(map.entries())
      .map(([spelare, total]) => ({ spelare, total: Math.round(total) }))
      .sort((a, b) => b.total - a.total)

    return {
      rows,
      totalAll: rows.reduce((s, r) => s + r.total, 0),
      leader: rows[0] ?? null,
      cleanPlayers: activePlayers.filter((p) => !map.has(p) || (map.get(p) ?? 0) === 0),
    }
  }, [visibleFees, activePlayers])

  const perTavling = useMemo(() => {
    const map = new Map<
      string,
      { summa: number; antalSpelare: number; antalBoter: number }
    >()

    for (const f of fees) {
      if (!f.tavling_datum || f.belopp <= 0) continue

      const rad = map.get(f.tavling_datum) ?? {
        summa: 0,
        antalSpelare: 0,
        antalBoter: 0,
      }

      rad.summa += f.belopp
      rad.antalSpelare += 1
      rad.antalBoter += (f.regler ?? []).reduce((s, r) => s + Number(r.antal ?? 0), 0)

      map.set(f.tavling_datum, rad)
    }

    return Array.from(map.entries())
      .map(([datum, v]) => {
        const comp = competitions.find((c) => c.datum === datum)

        return {
          datum,
          label: shortDateSv(datum),
          bana: comp?.bana ?? comp?.plats ?? "Okänd bana",
          major: comp ? isMajor(comp.major) : false,
          summa: Math.round(v.summa),
          antalSpelare: v.antalSpelare,
          antalBoter: v.antalBoter,
        }
      })
      .sort((a, b) => a.datum.localeCompare(b.datum))
  }, [fees, competitions])

  const perRegel = useMemo(() => {
    const map = new Map<string, { antal: number; summa: number }>()

    for (const f of visibleFees) {
      for (const r of f.regler ?? []) {
        const rad = map.get(r.regel) ?? { antal: 0, summa: 0 }
        rad.antal += Number(r.antal ?? 0)
        rad.summa += Number(r.belopp ?? 0)
        map.set(r.regel, rad)
      }
    }

    return Array.from(map.entries())
      .map(([regel, v]) => ({ regel, ...v }))
      .sort((a, b) => b.summa - a.summa)
  }, [visibleFees])

  const varstaTavling = useMemo(
    () =>
      perTavling.length === 0
        ? null
        : perTavling.reduce((max, t) => (t.summa > max.summa ? t : max), perTavling[0]),
    [perTavling]
  )

  const hallOfShame = useMemo((): ShameRow[] => {
    const totalMap = new Map<string, number>()
    const yearMap = new Map<string, Set<number>>()
    const compMap = new Map<string, Set<string>>()

    for (const f of allFees) {
      if (f.belopp <= 0) continue

      totalMap.set(f.spelare, (totalMap.get(f.spelare) ?? 0) + f.belopp)

      const yearSet = yearMap.get(f.spelare) ?? new Set<number>()
      yearSet.add(f.ar)
      yearMap.set(f.spelare, yearSet)

      if (f.tavling_datum) {
        const compSet = compMap.get(f.spelare) ?? new Set<string>()
        compSet.add(f.tavling_datum)
        compMap.set(f.spelare, compSet)
      }
    }

    return Array.from(totalMap.entries())
      .map(([spelare, total]) => {
        const antalAr = yearMap.get(spelare)?.size ?? 1
        const antalTavlingar = compMap.get(spelare)?.size ?? 0

        return {
          spelare,
          total: Math.round(total),
          antalAr,
          antalTavlingar,
          snittPerAr: total / antalAr,
          snittPerTavling: antalTavlingar > 0 ? total / antalTavlingar : 0,
        }
      })
      .sort((a, b) => b.total - a.total)
  }, [allFees])

  const chartData = useMemo(
    () => totals.rows.map((r) => ({ name: r.spelare, value: r.total })),
    [totals.rows]
  )

  const totalHistoryChartData = useMemo(
    () =>
      totalHistory.map((r) => ({
        datum: formatDateSv(r.datum) ?? r.datum,
        tot: Number(r.tot ?? 0),
      })),
    [totalHistory]
  )

  const periodLabel = useMemo(() => {
    if (selectedTavling === ALLA_TAVLINGAR) return `År ${selectedYear ?? ""}`

    const comp = competitions.find((c) => c.datum === selectedTavling)
    return comp?.bana ?? formatDateSv(selectedTavling) ?? "Vald tävling"
  }, [selectedTavling, selectedYear, competitions])

  function setRuleCount(player: string, rule: Rule, antal: number) {
    setFormRules((prev) => {
      const next = { ...(prev[player] ?? {}), [rule.rule]: Math.max(0, antal) }

      const summa = RULES.reduce((s, x) => s + (next[x.rule] ?? 0) * x.belopp, 0)
      setFormFees((f) => ({ ...f, [player]: summa }))

      return { ...prev, [player]: next }
    })
  }

  async function handleSubmit() {
    if (!regTavling) {
      toast.error("Välj vilken tävling böterna ska registreras på.")
      return
    }

    setSubmitting(true)

    try {
      const payload = activePlayers
        .filter((p) => Number(formFees[p] ?? 0) > 0)
        .map((p) => {
          const valda = formRules[p] ?? {}

          const regler = RULES.filter((r) => (valda[r.rule] ?? 0) > 0).map((r) => ({
            regel: r.rule,
            antal: valda[r.rule],
            belopp: valda[r.rule] * r.belopp,
          }))

          return {
            spelare: p,
            belopp: Number(formFees[p]),
            ar: Number(regTavling.slice(0, 4)),
            tavling_datum: regTavling,
            regler: regler.length > 0 ? regler : null,
          }
        })

      if (payload.length === 0) {
        toast.error("Inga böter att registrera – alla belopp är 0.")
        return
      }

      const res = await addFees({ fees: payload, password })

      toast.success(`Böter sparade (${res.inserted} rader)`)

      setPassword("")
      setFormFees(Object.fromEntries(activePlayers.map((p) => [p, 0])))
      setFormRules({})
      setDetailPlayer(null)

      await loadMeta()
      if (selectedYear) await loadFeesForYear(selectedYear)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const latestLabel = formatDateSv(latestTotal?.datum)

  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/10" />
        <div className="absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-secondary/70" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Böteskassa
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Böter & Hall of Shame
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Följ böterna tävling för tävling, total böteskassa över tid och den
              historiska Hall of Shame.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select
              value={selectedYear ? String(selectedYear) : undefined}
              onValueChange={(v) => setSelectedYear(Number(v))}
              disabled={years.length === 0}
            >
              <SelectTrigger className="w-full sm:w-32">
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

            <Select
              value={selectedTavling}
              onValueChange={setSelectedTavling}
              disabled={compsForYear.length === 0}
            >
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Alla tävlingar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALLA_TAVLINGAR}>Alla tävlingar</SelectItem>
                {compsForYear.map((c) => (
                  <SelectItem key={c.datum} value={c.datum}>
                    {competitionLabel(c)}
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
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total kassa"
              value={latestTotal ? money(latestTotal.tot) : "–"}
              sub={latestLabel ? `Uppdaterad ${latestLabel}` : "Ingen historik"}
              icon={PiggyBank}
            />

            <StatCard
              title={periodLabel}
              value={money(totals.totalAll)}
              sub="Summerat per spelare"
              icon={Banknote}
            />

            <StatCard
              title="Böteskung"
              value={totals.leader?.spelare ?? "Ingen"}
              sub={totals.leader ? money(totals.leader.total) : "Inga böter registrerade"}
              icon={Crown}
            />

            <StatCard
              title="Dyraste tävlingen"
              value={varstaTavling ? money(varstaTavling.summa) : "–"}
              sub={
                varstaTavling
                  ? `${varstaTavling.bana} ${formatDateSv(varstaTavling.datum)}`
                  : "Ingen tävlingsdata i år"
              }
              icon={Flame}
            />
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Skull className="h-5 w-5 text-primary" />
                Hall of Shame
              </CardTitle>
            </CardHeader>
            <CardContent>
              <HallOfShame rows={hallOfShame} />
            </CardContent>
          </Card>

          <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Böter per spelare · {periodLabel}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingFees ? (
                  <div className="h-80 animate-pulse rounded-2xl bg-muted" />
                ) : totals.rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Inga böter registrerade för {periodLabel.toLowerCase()}.
                  </p>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
                    <div className="flex flex-col gap-2">
                      {totals.rows.map((r, idx) => (
                        <div
                          key={r.spelare}
                          className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-background text-sm font-black text-foreground">
                              {idx + 1}
                            </div>
                            <div className="font-semibold text-foreground">{r.spelare}</div>
                          </div>
                          <div className="font-bold tabular-nums text-foreground">
                            {money(r.total)}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip formatter={(value) => [money(Number(value)), "Böter"]} />
                          <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                            {chartData.map((_, i) => (
                              <Cell key={i} fill={chartColor(i)} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  Böter per tävling {selectedYear}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {perTavling.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Inga böter är ännu registrerade på enskilda tävlingar detta år.
                  </p>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={perTavling}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip
                            formatter={(value) => [money(Number(value)), "Böter"]}
                            labelFormatter={(label) => `Tävling: ${label}`}
                          />
                          <Bar
                            dataKey="summa"
                            radius={[8, 8, 0, 0]}
                            fill="var(--color-chart-2)"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="flex flex-col gap-2">
                      {perTavling
                        .slice()
                        .reverse()
                        .map((t) => (
                          <button
                            key={t.datum}
                            type="button"
                            onClick={() => setSelectedTavling(t.datum)}
                            className="flex items-center justify-between rounded-xl bg-secondary/30 px-3 py-2 text-left transition hover:bg-secondary/60"
                          >
                            <div>
                              <div className="font-semibold text-foreground">
                                {t.bana}
                                {t.major && (
                                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                                    Major
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Users className="h-3 w-3" />
                                {t.antalSpelare} spelare
                                {t.antalBoter > 0 && ` · ${t.antalBoter} böter`}
                                {" · "}
                                {formatDateSv(t.datum)}
                              </div>
                            </div>

                            <div className="font-bold tabular-nums text-foreground">
                              {money(t.summa)}
                            </div>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Flame className="h-5 w-5 text-primary" />
                  Total böteskassa över tid
                </CardTitle>
              </CardHeader>
              <CardContent>
                {totalHistoryChartData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Ingen historik finns ännu.
                  </p>
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={totalHistoryChartData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                        <XAxis dataKey="datum" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip
                          formatter={(value) => [money(Number(value)), "Total böteskassa"]}
                          labelFormatter={(label) => `Datum: ${label}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="tot"
                          stroke="var(--color-chart-1)"
                          strokeWidth={3}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Trophy className="h-5 w-5 text-primary" />
                  Vanligaste böterna · {periodLabel}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {perRegel.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Ingen böter är specificerad med regel ännu. Använd &quot;Specificera&quot;
                    i adminläget så byggs statistiken upp härifrån.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {perRegel.map((r, idx) => (
                      <div
                        key={r.regel}
                        className="flex items-center justify-between gap-4 rounded-xl bg-secondary/30 px-3 py-2"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background text-sm font-black text-foreground">
                            {idx + 1}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground">{r.regel}</div>
                            <div className="text-xs text-muted-foreground">
                              {r.antal} gånger
                            </div>
                          </div>
                        </div>

                        <div className="font-bold tabular-nums text-foreground">
                          {money(r.summa)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ScrollText className="h-5 w-5 text-primary" />
                Bötesregler
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {RULES.map((r) => (
                  <div
                    key={r.rule}
                    className="flex items-center justify-between gap-4 rounded-xl border border-border bg-secondary/30 px-4 py-3"
                  >
                    <span className="font-medium text-foreground">{r.rule}</span>
                    <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
                      {ruleLabel(r)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {showAdmin && (
            <Card className="border-primary/30">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Lock className="h-5 w-5 text-primary" />
                    Registrera böter
                  </CardTitle>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void loadMeta()
                      if (selectedYear) void loadFeesForYear(selectedYear)
                    }}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Ladda om
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-5">
                <p className="text-sm text-muted-foreground">
                  Välj tävling och fyll i böter per spelare. Spelare med 0 kr sparas inte.
                  Vill du specificera vad böterna kommer från räknas beloppet ut
                  automatiskt.
                </p>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tävling</Label>
                    <Select
                      value={regTavling ?? undefined}
                      onValueChange={setRegTavling}
                      disabled={competitions.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Välj tävling" />
                      </SelectTrigger>
                      <SelectContent>
                        {competitions.map((c) => (
                          <SelectItem key={c.datum} value={c.datum}>
                            {competitionLabel(c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {activePlayers.map((p) => {
                    const rules = formRules[p] ?? {}
                    const beraknat = RULES.reduce(
                      (s, r) => s + (rules[r.rule] ?? 0) * r.belopp,
                      0
                    )

                    return (
                      <div
                        key={p}
                        className="rounded-2xl border border-border bg-secondary/25 p-4"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Label>Böter för {p}</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetailPlayer((v) => (v === p ? null : p))}
                          >
                            {detailPlayer === p ? "Dölj" : "Specificera"}
                          </Button>
                        </div>

                        <Input
                          className="mt-2"
                          type="number"
                          value={formFees[p] ?? 0}
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) =>
                            setFormFees((prev) => ({
                              ...prev,
                              [p]: Number(e.target.value),
                            }))
                          }
                        />

                        {detailPlayer === p && (
                          <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                            {RULES.map((r) => (
                              <div
                                key={r.rule}
                                className="flex items-center justify-between gap-2"
                              >
                                <span className="text-sm leading-tight text-muted-foreground">
                                  {r.rule}{" "}
                                  <span className="text-xs font-semibold text-foreground">
                                    ({ruleLabel(r)})
                                  </span>
                                </span>

                                <Input
                                  type="number"
                                  min={0}
                                  className="w-20 shrink-0"
                                  value={rules[r.rule] ?? 0}
                                  onFocus={(e) => e.currentTarget.select()}
                                  onChange={(e) =>
                                    setRuleCount(p, r, Number(e.target.value))
                                  }
                                />
                              </div>
                            ))}

                            <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-bold text-foreground">
                              <span>Beräknat belopp</span>
                              <span className="tabular-nums">{money(beraknat)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
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

                  <Button onClick={handleSubmit} disabled={submitting}>
                    {submitting ? "Sparar..." : "Spara böter"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
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

function shameSubtitle(r: ShameRow) {
  if (r.antalTavlingar > 0) {
    return `~${money(Math.round(r.snittPerTavling))}/tävling · ${r.antalTavlingar} tävlingar`
  }

  return `~${money(Math.round(r.snittPerAr))}/år · ${r.antalAr} år`
}

function HallOfShame({ rows }: { rows: ShameRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Ingen böteshistorik hittades.</p>
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="grid gap-3">
        {rows.slice(0, 3).map((r, idx) => (
          <div
            key={r.spelare}
            className="relative overflow-hidden rounded-2xl border border-border bg-secondary/30 p-4"
          >
            <div className="absolute right-3 top-3 text-5xl font-black leading-none text-muted-foreground/10">
              {idx + 1}
            </div>

            <div className="relative flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {idx === 0 ? "Böteskungen" : "Hall of Shame"}
                </div>
                <div className="mt-1 text-xl font-extrabold text-foreground">
                  {r.spelare}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {shameSubtitle(r)}
                </div>
              </div>

              <div className="text-right">
                <div className="text-2xl font-black tabular-nums text-primary">
                  {money(r.total)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border p-4">
        <div className="mb-3 font-semibold text-foreground">All-time ranking</div>
        <div className="flex flex-col gap-2">
          {rows.map((r, idx) => (
            <div
              key={r.spelare}
              className="flex items-center justify-between rounded-xl bg-secondary/30 px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-background text-sm font-black text-foreground">
                  {idx + 1}
                </div>
                <div>
                  <div className="font-semibold text-foreground">{r.spelare}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.antalTavlingar > 0
                      ? `${r.antalTavlingar} tävlingar`
                      : `${r.antalAr} år`}
                  </div>
                </div>
              </div>

              <div className="font-bold tabular-nums text-foreground">
                {money(r.total)}
              </div>
            </div>
          ))}
        </div>
      </div>
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
      <div className="h-80 animate-pulse rounded-2xl bg-muted" />
    </div>
  )
}
