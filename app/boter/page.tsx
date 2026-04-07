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
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Banknote } from "lucide-react"
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

function isActive(v: PlayerRow["aktiv"]) {
  if (typeof v === "boolean") return v
  return Number(v) === 1
}

function playerNickname(p: PlayerRow) {
  return (p.spelarnamn ?? "").trim()
}

function formatDateSv(dateString: string | null | undefined) {
  if (!dateString) return null

  // Säker mot timezone-problem för datumsträngar som YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [y, m, d] = dateString.split("-")
    return `${y}-${m}-${d}`
  }

  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return dateString
  return d.toLocaleDateString("sv-SE")
}

export default function BoterPage() {
  const supabase = useMemo(() => createClient(), [])

  const [activePlayers, setActivePlayers] = useState<string[]>([])
  const [fees, setFees] = useState<FeeRow[]>([])
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

  const loadMeta = useCallback(async () => {
    setError(null)

    const [
      { data: playersData, error: playersError },
      { data: yearsData, error: yearsError },
      { data: totData, error: totError },
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
    ])

    if (playersError) throw playersError
    if (yearsError) throw yearsError
    if (totError) throw totError

    const active = ((playersData ?? []) as PlayerRow[])
      .filter((p) => isActive(p.aktiv))
      .map(playerNickname)
      .filter(Boolean)

    setActivePlayers(active)

    setFormFees((prev) => {
      const next: Record<string, number> = {}
      for (const player of active) {
        next[player] = prev[player] ?? 0
      }
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
    const yearOptions = Array.from(new Set([...uniqYears, currentYear])).sort((a, b) => b - a)

    setYears(yearOptions)
    setSelectedYear((prev) => prev ?? yearOptions[0] ?? currentYear)
    setRegYear((prev) => prev ?? currentYear)

    const totalsHistory = ((totData ?? []) as TotRow[]).map((r) => ({
      datum: r.datum,
      tot: Number(r.tot ?? 0),
    }))

    setTotalHistory(totalsHistory)
    setLatestTotal(totalsHistory.length > 0 ? totalsHistory[totalsHistory.length - 1] : null)
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
      .map(([spelare, total]) => ({
        spelare,
        total: Math.round(total),
      }))
      .sort((a, b) => b.total - a.total)

    const totalAll = rows.reduce((sum, row) => sum + row.total, 0)

    return { rows, totalAll }
  }, [fees])

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
        spelare: p, // använder smeknamn/spelarnamn
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

      if (selectedYear) {
        await loadFeesForYear(selectedYear)
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const latestLabel = formatDateSv(latestTotal?.datum)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">Böteskassa</h1>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-foreground">
            Total kassa: {latestTotal?.tot ?? "-"} kr{latestLabel ? ` (uppd: ${latestLabel})` : ""}
          </span>

          <span className="rounded-full bg-destructive/10 px-3 py-1 text-sm font-semibold text-destructive">
            {selectedYear ? `År ${selectedYear}: ${totals.totalAll} kr` : "Välj år"}
          </span>
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="py-5">
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <div className="font-medium text-foreground">Kunde inte hämta data</div>
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Banknote className="h-5 w-5 text-primary" />
                Bötesregler
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {RULES.map((r) => (
                <div key={r.rule} className="flex items-center justify-between rounded-md bg-secondary/40 px-3 py-2">
                  <span className="text-foreground">{r.rule}</span>
                  <span className="font-medium text-muted-foreground">{r.amount}</span>
                </div>
              ))}
            </CardContent>
          </Card>

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
                      <SelectValue placeholder={years.length === 0 ? "Inga år" : "Välj år"} />
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
                      <div key={r.spelare} className="flex items-center justify-between rounded-md bg-secondary/40 px-3 py-2">
                        <span className="font-medium text-foreground">{r.spelare}</span>
                        <span className="font-semibold text-destructive">{r.total} kr</span>
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
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 12 }} />
                        <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value) => [`${value} kr`, "Böter"]} />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Total böteskassa över tid</CardTitle>
            </CardHeader>
            <CardContent>
              {totalHistoryChartData.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ingen historik finns ännu.</p>
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
                        formatter={(value) => [`${value} kr`, "Total böteskassa"]}
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

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Uppdatera böter</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Fyll i böter efter deltävlingen. Lämna 0 om ingen böter. Endast aktiva spelare visas.
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

              <Button onClick={handleSubmit} disabled={submitting || !regYear} className="self-start">
                {submitting ? "Sparar..." : "Uppdatera böter"}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
