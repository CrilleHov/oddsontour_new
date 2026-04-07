"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Timer } from "lucide-react"

// Ändra till datumet för finalen
const FINAL_DATE = "2026-09-12" // YYYY-MM-DD

export default function CountdownPage() {
  const { daysLeft, finalDateStr } = useMemo(() => {
    const today = new Date()
    const finalDate = new Date(`${FINAL_DATE}T00:00:00`)

    const diffMs = finalDate.getTime() - new Date(today.toDateString()).getTime()
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    return {
      daysLeft,
      finalDateStr: finalDate.toLocaleDateString("sv-SE"),
    }
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">Countdown</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Timer className="h-5 w-5 text-primary" />
            Nedräkning till finalen
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">Finaldatum: {finalDateStr}</p>
          <div className="rounded-2xl bg-secondary/40 p-6 text-center">
            <div className="text-5xl font-black tracking-tight text-foreground">{daysLeft}</div>
            <div className="mt-1 text-sm text-muted-foreground">dagar kvar</div>
          </div>


        </CardContent>
      </Card>
    </div>
  )
}
