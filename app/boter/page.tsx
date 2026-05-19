"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
  SelectTrigger,"use client"

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

type FeeRow = {
  spelare: string
  belopp: number
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
  snittPerAr: number
}

const PLAYERS_TABLE = "spelare"
const FEES_TABLE = "fees"
const TOT_TABLE = "tot_böter"

const RULES = [
  { rule: "Streck/0 poäng", amount: "10 kr" },
  { rule: "Kissar på golfbanan", amount: "50 kr" },
  { rule: "Kastar utrustning", amount: "100 kr/gång" },
  { rule: "Kastar boll", amount: "50 kr/boll" },
  { rule: "Tappar bort järnheadcovers", amount: "50 kr/st" },
  { rule: "Inte på golfbanan 30 min innan FÖRSTA starttid", amount: "50 kr" },
  { rule: "Har ej straffutrustning", amount: "1000 kr" },
  { rule: "Inte har minst ett Race to Sand-plagg på sig", amount: "100 kr" },
  { rule: "Bira-boll", amount: "20 kr" },
  { rule: "HIO/Albatross: de andra spelarna böter", amount: "100 kr" },
  { rule: "Ej tillgänglig att scoreföra på Gamebook", amount: "100 kr" },
  { rule: "Ej bötesswish samma dag som tävling", amount: "200 kr" },
  { rule: "Dålig anledning till att inte vara med på tävling", amount: "100 kr" },
  { rule: "Anonymitet", amount: "50 kr" },
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

function playerNickname(p: PlayerRow) {
  return (p.spelarnamn ?? "").trim()
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
  const [fees, setFees] = useState<FeeRow[]>([])
  const [allFees, setAllFees] = useState<FeeRow[]>([])
  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [latestTotal, setLatestTotal] = useState<TotRow | null>(null)
  const [totalHistory, setTotalHistory] = useState<TotRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingFees, setLoadingFees] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formFees, setFormFees] = useState<Record<string, number>>({})
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [regYear, setRegYear] = useState<number | null>(null)
  const [showAdmin, setShowAdmin] = useState(false)

  const loadMeta = useCallback(async () => {
    setError(null)

    const [
      { data: playersData, error: playersError },
      { data: yearsData, error: yearsError },
      { data: totData, error: totError },
      { data: allFeesData, error: allFeesError },
    ] = await Promise.all([
      supabase
        .from(PLAYERS_TABLE)
        .select("spelarnamn, namn_full, aktiv")
        .eq("aktiv", 1)
        .order("spelarnamn", { ascending: true }),

      supabase.from(FEES_TABLE).select("ar").order("ar", { ascending: false }),

      supabase.from(TOT_TABLE).select("datum, tot").order("datum", { ascending: true }),

      supabase.from(FEES_TABLE).select("spelare, belopp:bötesbelopp, ar"),
    ])

    if (playersError) throw playersError
    if (yearsError) throw yearsError
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

    const uniqYears = Array.from(
      new Set(
        (yearsData ?? [])
          .map((r: { ar: number }) => Number(r.ar))
          .filter((x) => Number.isFinite(x))
      )
    ).sort((a, b) => b - a)

    const currentYear = new Date().getFullYear()
    const yearOptions = Array.from(new Set([...uniqYears, currentYear])).sort(
      (a, b) => b - a
    )

    setYears(yearOptions)
    setSelectedYear((prev) => prev ?? yearOptions[0] ?? currentYear)
    setRegYear((prev) => prev ?? currentYear)

    const totalsHistory = ((totData ?? []) as TotRow[]).map((r) => ({
      datum: r.datum,
      tot: Number(r.tot ?? 0),
    }))

    setTotalHistory(totalsHistory)
    setLatestTotal(totalsHistory.length > 0 ? totalsHistory[totalsHistory.length - 1] : null)

    setAllFees(
      ((allFeesData ?? []) as FeeRow[]).map((r) => ({
        spelare: r.spelare,
        belopp: Number(r.belopp ?? 0),
        ar: Number(r.ar),
      }))
    )
  }, [supabase])

  const loadFeesForYear = useCallback(
    async (year: number) => {
      setLoadingFees(true)
      setError(null)

      try {
        const { data, error } = await supabase
          .from(FEES_TABLE)
          .select("spelare, belopp:bötesbelopp, ar")
          .eq("ar", year)

        if (error) throw error

        setFees(
          ((data ?? []) as FeeRow[]).map((r) => ({
            spelare: r.spelare,
            belopp: Number(r.belopp ?? 0),
            ar: Number(r.ar),
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

  const totals = useMemo(() => {
    const map = new Map<string, number>()

    for (const f of fees) {
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
  }, [fees, activePlayers])

  const hallOfShame = useMemo((): ShameRow[] => {
    const totalMap = new Map<string, number>()
    const yearMap = new Map<string, Set<number>>()

    for (const f of allFees) {
      if (f.belopp <= 0) continue

      totalMap.set(f.spelare, (totalMap.get(f.spelare) ?? 0) + f.belopp)

      const yearSet = yearMap.get(f.spelare) ?? new Set<number>()
      yearSet.add(f.ar)
      yearMap.set(f.spelare, yearSet)
    }

    return Array.from(totalMap.entries())
      .map(([spelare, total]) => {
        const antalAr = yearMap.get(spelare)?.size ?? 1

        return {
          spelare,
          total: Math.round(total),
          antalAr,
          snittPerAr: total / antalAr,
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

  async function handleSubmit() {
    if (!regYear) {
      toast.error("Välj vilket år böterna ska registreras på.")
      return
    }

    setSubmitting(true)

    try {
      const payload = activePlayers.map((p) => ({
        spelare: p,
        belopp: Number(formFees[p] ?? 0),
        ar: regYear,
      }))

      const res = await addFees({ fees: payload, password })

      toast.success(`Uppdaterat! (insatt ${res.inserted} rader)`)

      setPassword("")
      setFormFees((prev) => {
        const next = { ...prev }
        for (const p of activePlayers) next[p] = 0
        return next
      })

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
              Följ årets böter, total böteskassa över tid och den historiska Hall of Shame.
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
              title={`År ${selectedYear ?? ""}`}
              value={money(totals.totalAll)}
              sub="Summerat per spelare"
              icon={Banknote}
            />

            <StatCard
              title="Böteskung"
              value={totals.leader?.spelare ?? "Ingen"}
              sub={totals.leader ? money(totals.leader.total) : "Inga böter i år"}
              icon={Crown}
            />

            <StatCard
              title="Fläckfria"
              value={`${totals.cleanPlayers.length} st`}
              sub={
                totals.cleanPlayers.length > 0
                  ? totals.cleanPlayers.slice(0, 3).join(", ")
                  : "Alla har böter"
              }
              icon={Trophy}
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
                  Böter per spelare {selectedYear}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingFees ? (
                  <div className="h-80 animate-pulse rounded-2xl bg-muted" />
                ) : totals.rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Inga böter registrerade för {selectedYear ?? "valt år"}.
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
                      {r.amount}
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
                    Uppdatera böter
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
                  Fyll i böter efter deltävlingen. Lämna 0 om ingen böter.
                  Endast aktiva spelare visas.
                </p>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Registrera böter på år</Label>
                    <Select
                      value={regYear ? String(regYear) : undefined}
                      onValueChange={(v) => setRegYear(Number(v))}
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
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {activePlayers.map((p) => (
                    <div
                      key={p}
                      className="rounded-2xl border border-border bg-secondary/25 p-4"
                    >
                      <Label>Böter för {p}</Label>
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

                  <Button onClick={handleSubmit} disabled={submitting}>
                    {submitting ? "Sparar..." : "Uppdatera böter"}
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
                  ~{money(Math.round(r.snittPerAr))}/år · {r.antalAr} år
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
                  <div className="text-xs text-muted-foreground">{r.antalAr} år</div>
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
  SelectValue,
} from "@/components/ui/select"
import { Banknote, Skull } from "lucide-react"
import { toast } from "sonner"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"

// ─── Types ────────────────────────────────────────────────────────────────────

type PlayerRow = {
  spelarnamn: string
  namn_full: string | null
  aktiv: number | boolean | null
}

type FeeRow = {
  spelare: string
  belopp: number
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
  snittPerAr: number
}

const PLAYERS_TABLE = "spelare"
const FEES_TABLE = "fees"
const TOT_TABLE = "tot_böter"

const RULES = [
  { rule: "Streck/0 poäng", amount: "10 kr" },
  { rule: "Kissar på golfbanan", amount: "50 kr" },
  { rule: "Kastar utrustning", amount: "100 kr/gång" },
  { rule: "Kastar boll", amount: "50 kr/boll" },
  { rule: "Tappar bort järnheadcovers", amount: "50 kr/st" },
  { rule: "Inte på golfbanan 30 min innan FÖRSTA starttid", amount: "50 kr" },
  { rule: "Har ej straffutrustning", amount: "1000 kr" },
  { rule: "Inte har minst ett Race to Sand-plagg på sig", amount: "100 kr" },
  { rule: "Bira-boll", amount: "20 kr" },
  { rule: "HIO/Albatross: de andra spelarna böter", amount: "100 kr" },
  { rule: "Ej tillgänglig att scoreföra på Gamebook", amount: "100 kr" },
  { rule: "Ej bötesswish samma dag som tävling", amount: "200 kr" },
  { rule: "Dålig anledning till att inte vara med på tävling (gruppen bestämmer)", amount: "100 kr" },
  { rule: "Anonymitet", amount: "50 kr" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isActive(v: PlayerRow["aktiv"]) {
  if (typeof v === "boolean") return v
  return Number(v) === 1
}

function playerNickname(p: PlayerRow) {
  return (p.spelarnamn ?? "").trim()
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

const SHAME_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
]

function shameColor(index: number) {
  return SHAME_COLORS[index % SHAME_COLORS.length]
}

const SHAME_MEDALS = ["🥇", "🥈", "🥉"]
const SHAME_LABELS = ["Böteskungen 👑", "🪙", "🟫"]

// ─── Hall of Shame subcomponent ───────────────────────────────────────────────

function HallOfShame({ rows }: { rows: ShameRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ingen böteshistorik hittades.
      </p>
    )
  }

  const chartData = rows.map((r) => ({ name: r.spelare, value: r.total }))

  return (
    <div className="flex flex-col gap-6">
      {/* Top-3 podium */}
      <div className="grid gap-3 sm:grid-cols-3">
        {rows.slice(0, 3).map((r, idx) => (
          <div
            key={r.spelare}
            className={
              "flex flex-col items-center gap-2 rounded-xl border p-5 text-center " +
              (idx === 0
                ? "border-destructive/40 bg-destructive/5"
                : "border-border bg-secondary/30")
            }
          >
            <span className="text-4xl">{SHAME_MEDALS[idx]}</span>
            <div className="text-lg font-bold text-foreground">{r.spelare}</div>
            <div className="text-2xl font-extrabold tabular-nums text-destructive">
              {r.total} kr
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              {SHAME_LABELS[idx]}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              ~{Math.round(r.snittPerAr)} kr/år · {r.antalAr}{" "}
              {r.antalAr === 1 ? "år" : "år"}
            </div>
          </div>
        ))}
      </div>

      {/* Full ranking + bar chart */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2 text-sm">
          {rows.map((r, idx) => (
            <div
              key={r.spelare}
              className="flex items-center gap-3 rounded-md bg-secondary/40 px-3 py-2.5"
            >
              <span className="w-6 text-center text-base">
                {idx < 3 ? (
                  SHAME_MEDALS[idx]
                ) : (
                  <span className="font-medium text-muted-foreground">
                    {idx + 1}
                  </span>
                )}
              </span>
              <span className="flex-1 font-medium text-foreground">
                {r.spelare}
              </span>
              <span className="text-xs text-muted-foreground">
                {r.antalAr} år
              </span>
              <span className="font-semibold tabular-nums text-destructive">
                {r.total} kr
              </span>
            </div>
          ))}
        </div>

        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 80, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} unit=" kr" />
              <YAxis
                type="category"
                dataKey="name"
                width={80}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value) => [`${value} kr`, "Böter (all-time)"]}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={shameColor(i)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BoterPage() {
  const supabase = useMemo(() => createClient(), [])

  const [activePlayers, setActivePlayers] = useState<string[]>([])
  const [fees, setFees] = useState<FeeRow[]>([])
  const [allFees, setAllFees] = useState<FeeRow[]>([])
  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  const [latestTotal, setLatestTotal] = useState<TotRow | null>(null)
  const [totalHistory, setTotalHistory] = useState<TotRow[]>([])

  const [loading, setLoading] = useState(true)
  const [loadingFees, setLoadingFees] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formFees, setFormFees] = useState<Record<string, number>>({})
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [regYear, setRegYear] = useState<number | null>(null)

  // ── Load meta + all fees ───────────────────────────────────────────────────

  const loadMeta = useCallback(async () => {
    setError(null)

    const [
      { data: playersData, error: playersError },
      { data: yearsData, error: yearsError },
      { data: totData, error: totError },
      { data: allFeesData, error: allFeesError },
    ] = await Promise.all([
      supabase
        .from(PLAYERS_TABLE)
        .select("spelarnamn, namn_full, aktiv")
        .eq("aktiv", 1)
        .order("spelarnamn", { ascending: true }),

      supabase.from(FEES_TABLE).select("ar").order("ar", { ascending: false }),

      supabase
        .from(TOT_TABLE)
        .select("datum, tot")
        .order("datum", { ascending: true }),

      // All fees across all years — for Hall of Shame
      supabase.from(FEES_TABLE).select("spelare, belopp:bötesbelopp, ar"),
    ])

    if (playersError) throw playersError
    if (yearsError) throw yearsError
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

    const uniqYears = Array.from(
      new Set(
        (yearsData ?? [])
          .map((r: any) => Number(r.ar))
          .filter((x) => Number.isFinite(x))
      )
    ).sort((a, b) => b - a)

    const currentYear = new Date().getFullYear()
    const yearOptions = Array.from(new Set([...uniqYears, currentYear])).sort(
      (a, b) => b - a
    )

    setYears(yearOptions)
    setSelectedYear((prev) => prev ?? yearOptions[0] ?? currentYear)
    setRegYear((prev) => prev ?? currentYear)

    const totalsHistory = ((totData ?? []) as TotRow[]).map((r) => ({
      datum: r.datum,
      tot: Number(r.tot ?? 0),
    }))
    setTotalHistory(totalsHistory)
    setLatestTotal(
      totalsHistory.length > 0 ? totalsHistory[totalsHistory.length - 1] : null
    )

    setAllFees(
      ((allFeesData ?? []) as FeeRow[]).map((r) => ({
        spelare: r.spelare,
        belopp: Number(r.belopp ?? 0),
        ar: Number(r.ar),
      }))
    )
  }, [supabase])

  // ── Load fees for selected year ────────────────────────────────────────────

  const loadFeesForYear = useCallback(
    async (year: number) => {
      setLoadingFees(true)
      setError(null)
      try {
        const { data, error } = await supabase
          .from(FEES_TABLE)
          .select("spelare, belopp:bötesbelopp, ar")
          .eq("ar", year)

        if (error) throw error

        setFees(
          ((data ?? []) as FeeRow[]).map((r) => ({
            spelare: r.spelare,
            belopp: Number(r.belopp ?? 0),
            ar: Number(r.ar),
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

  // ── Effects ────────────────────────────────────────────────────────────────

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

  // ── Derived data ───────────────────────────────────────────────────────────

  const totals = useMemo(() => {
    const map = new Map<string, number>()
    for (const f of fees) {
      map.set(f.spelare, (map.get(f.spelare) ?? 0) + Number(f.belopp ?? 0))
    }
    const rows = Array.from(map.entries())
      .map(([spelare, total]) => ({ spelare, total: Math.round(total) }))
      .sort((a, b) => b.total - a.total)
    return { rows, totalAll: rows.reduce((s, r) => s + r.total, 0) }
  }, [fees])

  // Hall of Shame: all-time per player
  const hallOfShame = useMemo((): ShameRow[] => {
    const totMap = new Map<string, number>()
    const arMap = new Map<string, Set<number>>()

    for (const f of allFees) {
      if (f.belopp <= 0) continue
      totMap.set(f.spelare, (totMap.get(f.spelare) ?? 0) + f.belopp)
      const arSet = arMap.get(f.spelare) ?? new Set<number>()
      arSet.add(f.ar)
      arMap.set(f.spelare, arSet)
    }

    return Array.from(totMap.entries())
      .map(([spelare, total]) => {
        const antalAr = arMap.get(spelare)?.size ?? 1
        return {
          spelare,
          total: Math.round(total),
          antalAr,
          snittPerAr: total / antalAr,
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

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!regYear) {
      toast.error("Välj vilket år böterna ska registreras på.")
      return
    }
    setSubmitting(true)
    try {
      const payload = activePlayers.map((p) => ({
        spelare: p,
        belopp: Number(formFees[p] ?? 0),
        ar: regYear,
      }))
      const res = await addFees({ fees: payload, password })
      toast.success(`Uppdaterat! (insatt ${res.inserted} rader)`)
      setPassword("")
      setFormFees((prev) => {
        const next = { ...prev }
        for (const p of activePlayers) next[p] = 0
        return next
      })
      await loadMeta()
      if (selectedYear) await loadFeesForYear(selectedYear)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const latestLabel = formatDateSv(latestTotal?.datum)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Title */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">Böteskassa</h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-foreground">
            Total kassa: {latestTotal?.tot ?? "–"} kr
            {latestLabel ? ` (uppd: ${latestLabel})` : ""}
          </span>
          <span className="rounded-full bg-destructive/10 px-3 py-1 text-sm font-semibold text-destructive">
            {selectedYear
              ? `År ${selectedYear}: ${totals.totalAll} kr`
              : "Välj år"}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <Card>
          <CardContent className="py-5">
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <div className="font-medium text-foreground">
                Kunde inte hämta data
              </div>
              <div className="text-muted-foreground">{error}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex flex-col gap-4">
          <div className="h-8 w-40 animate-pulse rounded bg-muted" />
          <div className="h-48 animate-pulse rounded-lg bg-muted" />
        </div>
      ) : (
        <>
          {/* ── Hall of Shame ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Skull className="h-5 w-5 text-destructive" />
                Hall of Shame
                <span className="ml-auto text-sm font-normal text-muted-foreground">
                  All-time totalt
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <HallOfShame rows={hallOfShame} />
            </CardContent>
          </Card>

          {/* ── Bötesregler ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Banknote className="h-5 w-5 text-primary" />
                Bötesregler
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {RULES.map((r) => (
                <div
                  key={r.rule}
                  className="flex items-center justify-between rounded-md bg-secondary/40 px-3 py-2"
                >
                  <span className="text-foreground">{r.rule}</span>
                  <span className="font-medium text-muted-foreground">
                    {r.amount}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ── Böter per spelare (per år) ── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-lg">Böter per spelare</CardTitle>
                <div className="w-full sm:w-56">
                  <Select
                    value={selectedYear ? String(selectedYear) : ""}
                    onValueChange={(v) => setSelectedYear(Number(v))}
                    disabled={years.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          years.length === 0 ? "Inga år" : "Välj år"
                        }
                      />
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
            </CardHeader>
            <CardContent>
              {loadingFees ? (
                <div className="h-40 animate-pulse rounded-lg bg-muted" />
              ) : totals.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Inga böter registrerade för {selectedYear ?? "valt år"}.
                </p>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="flex flex-col gap-2 text-sm">
                    {totals.rows.map((r) => (
                      <div
                        key={r.spelare}
                        className="flex items-center justify-between rounded-md bg-secondary/40 px-3 py-2"
                      >
                        <span className="font-medium text-foreground">
                          {r.spelare}
                        </span>
                        <span className="font-semibold text-destructive">
                          {r.total} kr
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ top: 10, right: 20, left: 80, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          horizontal={false}
                        />
                        <XAxis type="number" tick={{ fontSize: 12 }} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={80}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip
                          formatter={(value) => [`${value} kr`, "Böter"]}
                        />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Total böteskassa över tid ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Total böteskassa över tid
              </CardTitle>
            </CardHeader>
            <CardContent>
              {totalHistoryChartData.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ingen historik finns ännu.
                </p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={totalHistoryChartData}
                      margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="datum" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value) => [
                          `${value} kr`,
                          "Total böteskassa",
                        ]}
                        labelFormatter={(label) => `Datum: ${label}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="tot"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Uppdatera böter ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Uppdatera böter</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Fyll i böter efter deltävlingen. Lämna 0 om ingen böter. Endast
                aktiva spelare visas.
              </p>

              <div className="flex flex-col gap-2">
                <Label>Registrera böter på år</Label>
                <div className="w-full sm:w-56">
                  <Select
                    value={regYear ? String(regYear) : ""}
                    onValueChange={(v) => setRegYear(Number(v))}
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
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {activePlayers.map((p) => (
                  <div key={p} className="flex flex-col gap-2">
                    <Label htmlFor={`fee-${p}`}>Böter för {p}</Label>
                    <Input
                      id={`fee-${p}`}
                      type="number"
                      min={0}
                      step={1}
                      value={formFees[p] ?? 0}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) =>
                        setFormFees((prev) => ({
                          ...prev,
                          [p]: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="adminpass">Lösenord</Label>
                <Input
                  id="adminpass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={submitting || !regYear}
                className="self-start"
              >
                {submitting ? "Sparar..." : "Uppdatera böter"}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
