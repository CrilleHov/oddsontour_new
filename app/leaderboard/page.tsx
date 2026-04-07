"use client"

import { useEffect, useMemo, useState } from "react"
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
import { Trophy, Settings, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

type LeaderboardRow = {
  tavling: string // YYYY-MM-DD
  spelare: string
  poang: number
  placering: number
  antal_spelare: number
  motPar: number | null
}

type SummaryRow = {
  spelare: string
  totalPoang: number
  antalComps: number
  antalVinster: number
  antalSistaplatser: number
}

type Competition = {
  datum: string
  bana: string | null
}

type Player = {
  spelarnamn: string
}

const COMP_TABLE = "competitions"
const LB_TABLE = "leaderboard"
const PLAYERS_TABLE = "spelare"

function yearFromDate(dateStr: string) {
  return Number(dateStr.slice(0, 4))
}

function formatDateSv(dateStr: string) {
  const [year, month, day] = dateStr.slice(0, 10).split("-")
  if (!year || !month || !day) return dateStr
  return `${year}-${month}-${day}`
}

const BASE_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
]

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
  const light = 0.72
  const chroma = 0.17
  return `oklch(${light} ${chroma} ${hue})`
}

function formatSigned(value: number | null | undefined) {
  const n = Number(value ?? 0)
  if (n > 0) return `+${n}`
  return `${n}`
}

function parseMotPar(value: string) {
  const trimmed = value.trim()

  if (trimmed === "" || trimmed === "-" || trimmed === "+") return 0

  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : 0
}

export default function LeaderboardPage() {
  const supabase = useMemo(() => createClient(), [])

  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [loadingLB, setLoadingLB] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [updateYear, setUpdateYear] = useState<number | null>(null)

  const [tavling, setTavling] = useState<string>("")
  const [antalSpelare, setAntalSpelare] = useState<string>("")
  const [major, setMajor] = useState<"Ja" | "Nej" | "">("")

  const [placeringar, setPlaceringar] = useState<Record<string, number>>({})
  const [motParValues, setMotParValues] = useState<Record<string, string>>({})

  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function loadMeta() {
    setLoadingMeta(true)
    setError(null)

    const [{ data: compDates, error: compErr }, { data: playerData, error: playerErr }] =
      await Promise.all([
        supabase.from(COMP_TABLE).select("datum"),
        supabase
          .from(PLAYERS_TABLE)
          .select("spelarnamn")
          .eq("aktiv", 1)
          .order("spelarnamn"),
      ])

    if (compErr) {
      setError(compErr.message)
      setYears([])
      setSelectedYear(null)
      setUpdateYear(null)
      setPlayers([])
      setLoadingMeta(false)
      setLoadingLB(false)
      return
    }

    if (playerErr) {
      setError(playerErr.message)
      setPlayers([])
      setLoadingMeta(false)
      setLoadingLB(false)
      return
    }

    const uniqYears = Array.from(
      new Set((compDates ?? []).map((r: { datum: string }) => yearFromDate(r.datum)))
    ).sort((a, b) => b - a)

    setYears(uniqYears)
    setSelectedYear((prev) => prev ?? uniqYears[0] ?? null)
    setUpdateYear((prev) => prev ?? uniqYears[0] ?? null)

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

    const from = `${year}-01-01`
    const to = `${year}-12-31`

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
      .gte("tävling", from)
      .lte("tävling", to)
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
    const from = `${year}-01-01`
    const to = `${year}-12-31`

    const { data, error } = await supabase
      .from(COMP_TABLE)
      .select("datum, bana")
      .gte("datum", from)
      .lte("datum", to)
      .order("datum", { ascending: true })

    if (error) {
      setError(error.message)
      setCompetitions([])
      return
    }

    setCompetitions((data ?? []) as Competition[])
    setTavling((prev) => prev || (data?.[0]?.datum ?? ""))
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
      return
    }

    let cancelled = false

    loadLeaderboard(selectedYear).catch((e) => {
      if (!cancelled) setError(String(e))
    })

    return () => {
      cancelled = true
    }
  }, [selectedYear])

  useEffect(() => {
    if (!updateYear) return

    let cancelled = false

    loadCompetitionsForYear(updateYear).catch((e) => {
      if (!cancelled) setError(String(e))
    })

    return () => {
      cancelled = true
    }
  }, [updateYear])

  const { summary, chartData, parChartData, playersInChart } = useMemo(() => {
    const byPlayer = new Map<string, SummaryRow>()

    for (const r of rows) {
      const name = r.spelare
      const cur =
        byPlayer.get(name) ?? {
          spelare: name,
          totalPoang: 0,
          antalComps: 0,
          antalVinster: 0,
          antalSistaplatser: 0,
        }

      const points = Number(r.poang ?? 0)
      cur.totalPoang += points
      if (points !== 0) cur.antalComps += 1
      if (Number(r.placering) === 1) cur.antalVinster += 1
      if (Number(r.placering) === Number(r.antal_spelare)) cur.antalSistaplatser += 1

      byPlayer.set(name, cur)
    }

    const summary = Array.from(byPlayer.values()).sort((a, b) => b.totalPoang - a.totalPoang)

    const dates = Array.from(new Set(rows.map((r) => r.tavling))).sort()
    const playersInChart = Array.from(new Set(rows.map((r) => r.spelare))).sort()

    const rowsByDate = new Map<string, LeaderboardRow[]>()
    for (const r of rows) {
      const arr = rowsByDate.get(r.tavling) ?? []
      arr.push(r)
      rowsByDate.set(r.tavling, arr)
    }

    const cumulativePoints = new Map(playersInChart.map((p) => [p, 0]))
    const cumulativePar = new Map(playersInChart.map((p) => [p, 0]))

    const chartData = dates.map((d) => {
      const bucket = rowsByDate.get(d) ?? []

      for (const r of bucket) {
        cumulativePoints.set(r.spelare, (cumulativePoints.get(r.spelare) ?? 0) + Number(r.poang ?? 0))
      }

      const point: Record<string, number | string> = {
        datum: formatDateSv(d),
        _rawDate: d,
      }

      for (const p of playersInChart) {
        point[p] = cumulativePoints.get(p) ?? 0
      }

      return point
    })

    const parChartData = dates.map((d) => {
      const bucket = rowsByDate.get(d) ?? []

      for (const r of bucket) {
        cumulativePar.set(r.spelare, (cumulativePar.get(r.spelare) ?? 0) + Number(r.motPar ?? 0))
      }

      const point: Record<string, number | string> = {
        datum: formatDateSv(d),
        _rawDate: d,
      }

      for (const p of playersInChart) {
        point[p] = cumulativePar.get(p) ?? 0
      }

      return point
    })

    return { summary, chartData, parChartData, playersInChart }
  }, [rows])

  async function handleLeaderboardSubmit() {
    if (!tavling || !antalSpelare || !major) {
      toast.error("Välj tävling, antal spelare och major-flagga")
      return
    }

    const antal = Number(antalSpelare)
    const spelade = Object.values(placeringar).filter((p) => Number(p) > 0).length

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
        toast.warning(`Du angav ${antal} spelare men du har fyllt i ${spelade} placeringar > 0.`)
      }

      setPassword("")

      setPlaceringar((prev) => {
        const next = { ...prev }
        for (const p of players) next[p.spelarnamn] = 0
        return next
      })

      setMotParValues((prev) => {
        const next = { ...prev }
        for (const p of players) next[p.spelarnamn] = "0"
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">Leaderboard</h1>

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

      {error && (
        <Card>
          <CardContent className="py-5">
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <div className="font-medium text-foreground">Kunde inte ladda data</div>
              <div className="text-muted-foreground">{error}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {loadingMeta || loadingLB ? (
        <div className="flex flex-col gap-4">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="h-64 animate-pulse rounded-lg bg-muted" />
        </div>
      ) : summary.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Trophy className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Inga resultat hittades för {selectedYear}.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Poängutveckling</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="datum" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      labelFormatter={(label) => `Datum: ${label}`}
                      formatter={(value, name) => [formatSigned(Number(value)), String(name)]}
                      itemSorter="value"
                    />
                    <Legend />
                    {playersInChart.map((p, i) => (
                      <Line
                        key={p}
                        type="monotone"
                        dataKey={p}
                        name={p}
                        stroke={colorForPlayer(p, i)}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ställning (inför finalen)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-3 pr-4 font-semibold text-muted-foreground">#</th>
                      <th className="pb-3 pr-4 font-semibold text-muted-foreground">Spelare</th>
                      <th className="pb-3 pr-4 font-semibold text-muted-foreground">Totala poäng</th>
                      <th className="pb-3 pr-4 font-semibold text-muted-foreground">Tävlingar</th>
                      <th className="pb-3 pr-4 font-semibold text-muted-foreground">Vinster</th>
                      <th className="pb-3 font-semibold text-muted-foreground">Sistaplatser</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((s, idx) => (
                      <tr key={s.spelare} className="border-b border-border/50 last:border-0">
                        <td className="py-3 pr-4">
                          <span
                            className={
                              idx === 0
                                ? "inline-flex h-7 w-7 items-center justify-center rounded-full bg-chart-2 font-bold text-accent-foreground"
                                : idx === 1
                                  ? "inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted font-bold text-muted-foreground"
                                  : idx === 2
                                    ? "inline-flex h-7 w-7 items-center justify-center rounded-full bg-chart-5 font-bold text-foreground"
                                    : "inline-flex h-7 w-7 items-center justify-center font-medium text-muted-foreground"
                            }
                          >
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-3 pr-4 font-medium text-foreground">{s.spelare}</td>
                        <td className="py-3 pr-4 font-bold text-foreground">{s.totalPoang}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{s.antalComps}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{s.antalVinster}</td>
                        <td className="py-3 text-muted-foreground">{s.antalSistaplatser}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Kumulativ utveckling mot par</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={parChartData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="datum" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                        labelFormatter={(label) => `Datum: ${label}`}
                        formatter={(value, name) => [formatSigned(Number(value)), String(name)]}
                        itemSorter="value"
                      />
                    <Legend />
                    {playersInChart.map((p, i) => (
                      <Line
                        key={p}
                        type="monotone"
                        dataKey={p}
                        name={p}
                        stroke={colorForPlayer(p, i)}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="h-5 w-5 text-primary" />
              Uppdatera leaderboard
            </CardTitle>

            <Button
              variant="secondary"
              onClick={() => loadMeta()}
              disabled={loadingMeta}
              className="shrink-0"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Ladda om
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Fyll i tävling, placering och mot par för respektive spelare. Om någon inte spelade, fyll i{" "}
            <strong>0</strong> i placering.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>År</Label>
              <Select
                value={updateYear ? String(updateYear) : ""}
                onValueChange={(v) => setUpdateYear(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={years.length ? "Välj år" : "Inga år"} />
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

            <div className="flex flex-col gap-2">
              <Label>Deltävling</Label>
              <Select value={tavling} onValueChange={setTavling}>
                <SelectTrigger>
                  <SelectValue placeholder={competitions.length ? "Välj tävling" : "Inga tävlingar"} />
                </SelectTrigger>
                <SelectContent>
                  {competitions.map((c) => (
                    <SelectItem key={c.datum} value={c.datum}>
                      {formatDateSv(c.datum)} {c.bana ? `– ${c.bana}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Hur många spelare var med?</Label>
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

            <div className="flex flex-col gap-2">
              <Label>Var tävlingen en major?</Label>
              <Select value={major} onValueChange={(v) => setMajor(v as "Ja" | "Nej")}>
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

          <div className="grid gap-6 sm:grid-cols-2">
            {players.map((p) => (
              <div key={p.spelarnamn} className="rounded-lg border border-border p-4">
                <div className="mb-3 font-medium text-foreground">{p.spelarnamn}</div>

                <div className="grid gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`pl-${p.spelarnamn}`}>Placering</Label>
                    <Input
                      id={`pl-${p.spelarnamn}`}
                      type="number"
                      min={0}
                      step={1}
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

                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`mp-${p.spelarnamn}`}>Mot par</Label>
                    <Input
                      id={`mp-${p.spelarnamn}`}
                      type="number"
                      step={1}
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

          <div className="flex flex-col gap-2">
            <Label htmlFor="adminpass">Lösenord</Label>
            <Input
              id="adminpass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <Button onClick={handleLeaderboardSubmit} disabled={submitting} className="self-start">
            <Trophy className="mr-2 h-4 w-4" />
            {submitting ? "Sparar..." : "Uppdatera leaderboard"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
