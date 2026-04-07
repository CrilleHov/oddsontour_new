"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"

type Score = {
  id: string
  player_id: string
  tournament_id: string
  total_points: number
  updated_at: string
  players: { name: string; handicap: number }
}

const COLORS = [
  "oklch(0.82 0.10 85)",    // gold
  "oklch(0.75 0.02 250)",   // silver
  "oklch(0.65 0.10 55)",    // bronze
  "oklch(0.45 0.12 155)",   // primary green
  "oklch(0.55 0.08 200)",   // blue-ish
]

export function LeaderboardChart({ scores }: { scores: Score[] }) {
  const chartData = scores.map((s) => ({
    name: s.players.name,
    points: s.total_points,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Poängställning</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="oklch(0.88 0.03 145)" />
              <XAxis type="number" tick={{ fontSize: 10 }} stroke="oklch(0.50 0.03 150)" />
              <YAxis
                type="category"
                dataKey="name"
                width={100}
                tick={{ fontSize: 12 }}
                stroke="oklch(0.50 0.03 150)"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "oklch(0.995 0.002 145)",
                  border: "1px solid oklch(0.88 0.03 145)",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
              />
              <Bar dataKey="points" radius={[0, 6, 6, 0]} name="Poang">
                {chartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index] || COLORS[3]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
