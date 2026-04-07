"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type CompetitionRow = {
  datum: string // YYYY-MM-DD
  bana: string | null
  host?: string | null
  hosts?: string | null
  major: string | null // Ja/Nej
  plats: string | null
}

const TABLE = "competitions"

function yearFromDate(dateStr: string) {
  return Number(dateStr.slice(0, 4))
}

export default function SpelschemaPage() {
  const supabase = useMemo(() => createClient(), [])

  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  const [rows, setRows] = useState<CompetitionRow[]>([])
  const [loadingYears, setLoadingYears] = useState(true)
  const [loadingRows, setLoadingRows] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadYears() {
      setLoadingYears(true)
      setError(null)

      const { data, error } = await supabase.from(TABLE).select("datum")
      if (cancelled) return

      if (error) {
        setError(error.message)
        setYears([])
        setSelectedYear(null)
        setLoadingYears(false)
        return
      }

      const uniq = Array.from(new Set((data ?? []).map((r: { datum: string }) => yearFromDate(r.datum)))).sort(
        (a, b) => b - a
      )

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
    if (!selectedYear) return

    let cancelled = false

    async function loadRows() {
      setLoadingRows(true)
      setError(null)

      const from = `${selectedYear}-01-01`
      const to = `${selectedYear}-12-31`

      // För att tåla både kolumnnamn "host" och "hosts" kör vi en fallback.
      let { data, error } = await supabase
        .from(TABLE)
        .select("datum, bana, host, major, plats")
        .gte("datum", from)
        .lte("datum", to)
        .order("datum", { ascending: true })

      if (error) {
        const retry = await supabase
          .from(TABLE)
          .select("datum, bana, hosts, major, plats")
          .gte("datum", from)
          .lte("datum", to)
          .order("datum", { ascending: true })

        data = retry.data
        error = retry.error
      }

      if (cancelled) return

      if (error) {
        setError(error.message)
        setRows([])
        setLoadingRows(false)
        return
      }

      setRows((data ?? []) as CompetitionRow[])
      setLoadingRows(false)
    }

    loadRows()
    return () => {
      cancelled = true
    }
  }, [supabase, selectedYear])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">Spelschema</h1>

        <div className="w-full sm:w-56">
          <Select
            value={selectedYear ? String(selectedYear) : ""}
            onValueChange={(v) => setSelectedYear(Number(v))}
            disabled={loadingYears || years.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={loadingYears ? "Laddar år..." : "Välj år"} />
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{selectedYear ? `Schema ${selectedYear}` : "Schema"}</CardTitle>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">
              <div className="font-medium">Kunde inte hämta data</div>
              <div className="text-muted-foreground">{error}</div>
              <div className="mt-2 text-muted-foreground">
                Tips: kontrollera tabellnamn ({TABLE}), kolumnnamn och RLS/policies i Supabase.
              </div>
            </div>
          )}

          {loadingRows ? (
            <div className="h-40 animate-pulse rounded-lg bg-muted" />
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">Inga deltävlingar hittades för {selectedYear}.</div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Bana</TableHead>
                    <TableHead>Host</TableHead>
                    <TableHead>Major</TableHead>
                    <TableHead>Plats</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const hostValue = (r.host ?? r.hosts) ?? "-"
                    const majorYes = (r.major ?? "").toLowerCase() === "ja"
                    return (
                      <TableRow key={`${r.datum}-${r.bana ?? ""}-${hostValue}`}>
                        <TableCell className="whitespace-nowrap">{new Date(r.datum).toLocaleDateString("sv-SE")}</TableCell>
                        <TableCell>{r.bana ?? "-"}</TableCell>
                        <TableCell>{hostValue}</TableCell>
                        <TableCell>
                          <span
                            className={
                              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
                              (majorYes ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")
                            }
                          >
                            {r.major ?? "-"}
                          </span>
                        </TableCell>
                        <TableCell>{r.plats ?? "-"}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
