"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Clock } from "lucide-react"

type PlayerRow = {
  id: number | string
  spelarnamn: string
  namn_full: string | null
  golfid: string | null
  aktiv: number | boolean | null
}

const PLAYERS_TABLE = "spelare"

function isActive(v: PlayerRow["aktiv"]) {
  if (typeof v === "boolean") return v
  return Number(v) === 1
}

function displayName(p: PlayerRow) {
  const full = (p.namn_full ?? "").trim()
  if (full.length > 0) return full
  return p.spelarnamn
}

function PlayerGrid({ players }: { players: PlayerRow[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {players.map((p) => (
        <Card key={String(p.id)}>
          <CardContent className="flex flex-col gap-2 py-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-foreground">{displayName(p)}</h3>
                <p className="text-sm text-muted-foreground">
                  Golf-ID: {p.golfid && p.golfid.trim() !== "" ? p.golfid : "-"}
                </p>
              </div>

              <span
                className={
                  "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium " +
                  (isActive(p.aktiv)
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground")
                }
              >
                {isActive(p.aktiv) ? "Aktiv" : "Pensionerad"}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function SpelarePage() {
  const supabase = useMemo(() => createClient(), [])

  const [activePlayers, setActivePlayers] = useState<PlayerRow[]>([])
  const [historicalPlayers, setHistoricalPlayers] = useState<PlayerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadPlayers() {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from(PLAYERS_TABLE)
        .select("id, spelarnamn, golfid, aktiv, namn_full")
        .order("aktiv", { ascending: false })
        .order("namn_full", { ascending: true, nullsFirst: false })

      if (cancelled) return

      if (error) {
        setError(error.message)
        setActivePlayers([])
        setHistoricalPlayers([])
        setLoading(false)
        return
      }

      const rows = (data ?? []) as PlayerRow[]
      setActivePlayers(rows.filter((p) => isActive(p.aktiv)))
      setHistoricalPlayers(rows.filter((p) => !isActive(p.aktiv)))
      setLoading(false)
    }

    loadPlayers()
    return () => {
      cancelled = true
    }
  }, [supabase])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Spelare</h1>
        <span className="text-sm text-muted-foreground">
          {loading ? "Laddar..." : `${activePlayers.length} aktiva`}
        </span>
      </div>

      {error && (
        <Card>
          <CardContent className="py-5">
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <div className="font-medium text-foreground">Kunde inte hämta spelare</div>
              <div className="text-muted-foreground">{error}</div>
              <div className="mt-2 text-muted-foreground">
                Kolla RLS/policies för tabellen{" "}
                <code className="rounded bg-secondary px-1">{PLAYERS_TABLE}</code>.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-primary" />
                Aktiva spelare
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activePlayers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Inga aktiva spelare (aktiv = 1).</p>
              ) : (
                <PlayerGrid players={activePlayers} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-primary" />
                Pensionerade spelare
              </CardTitle>
            </CardHeader>
            <CardContent>
              {historicalPlayers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Inga pensionerade spelare (aktiv = 0).</p>
              ) : (
                <PlayerGrid players={historicalPlayers} />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}