"use client"

import { useTournament } from "@/components/tournament-provider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Trophy } from "lucide-react"

export function TournamentSelector() {
  const { tournaments, selected, setSelected, loading } = useTournament()

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-3">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }

  if (tournaments.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Ingen tavling skapad annu. Ga till Uppdatera for att skapa en.
        </p>
      </div>
    )
  }

  return (
    <div className="border-b border-border bg-secondary/30">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2">
        <Trophy className="h-4 w-4 text-primary" />
        <Select
          value={selected?.id ?? ""}
          onValueChange={(id) => {
            const t = tournaments.find((t) => t.id === id)
            if (t) setSelected(t)
          }}
        >
          <SelectTrigger className="w-64 bg-card">
            <SelectValue placeholder="Valj tavling" />
          </SelectTrigger>
          <SelectContent>
            {tournaments.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name} - {new Date(t.date).toLocaleDateString("sv-SE")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
