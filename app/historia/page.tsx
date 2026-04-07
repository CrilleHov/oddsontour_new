import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen, Trophy } from "lucide-react"
import { ClipboardList } from "lucide-react"

const WINNERS = [
  { year: 2019, final: "Race to Sand", winner: "Alvin Andersson" },
  { year: 2020, final: "Race to Hooks", winner: "Christian Hovstadius" },
  { year: 2021, final: "Race to Sand", winner: "Jesper Fransson" },
  { year: 2022, final: "Race to Sand", winner: "Lukas Hafström" },
  { year: 2023, final: "Race to Sand", winner: "Alvin Andersson" },
  { year: 2024, final: "Race to Hills", winner: "Jesper Fransson" },
  { year: 2025, final: "Race to Hills", winner: "Viktor Andersson" },
]

const RESPONSIBILITIES = [
  { area: "Sociala medier", who: "Benne & Axel" },
  { area: "Sponsor", who: "Alvin & Frasse" },
  { area: "Ekonomi", who: "Crille" },
  { area: "IT", who: "Crille" },
  { area: "Merch", who: "Löken" },
  { area: "Bana final", who: "Axel" },
  { area: "Hotell och restaurang till finalen", who: "Vigge, Johan & Jojo" },
]

export default function HistoriaPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">Historia & Info</h1>

      {/* Info */}
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
            Odds on Tour (tidigare Race to Sand) drog igång 2019 och har sedan dess växt och
            cementerats till en av de mest prestigefyllda tävlingarna inom golfvärlden. Varje år
            består vanligtvis av strax under 10 deltävlingar där poäng samlas ihop inför finalen där
            allt ska avgöras. Väl mött!
          </p>
        </CardContent>
      </Card>

      {/* Historiska vinnare */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="h-5 w-5 text-primary" />
            Tidigare vinnare
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <div className="flex flex-col gap-2">
            {WINNERS.map((w) => (
              <div
                key={w.year}
                className="flex items-center justify-between rounded-md bg-secondary/40 px-3 py-2"
              >
                <div className="flex items-baseline gap-3">
                  <span className="font-medium text-foreground">{w.year}</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {w.final}
                  </span>
                </div>
                <span>{w.winner}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5 text-primary" />
            Ansvarsområden
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {RESPONSIBILITIES.map((r) => (
            <div key={r.area} className="flex items-center justify-between rounded-md bg-secondary/40 px-3 py-2">
              <span className="font-medium text-foreground">{r.area}</span>
              <span className="text-muted-foreground">{r.who}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}