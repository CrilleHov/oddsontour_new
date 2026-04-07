"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { getTournaments } from "@/lib/actions"

type Tournament = {
  id: string
  name: string
  date: string
  location: string
  rules: string
  password: string
  created_at: string
}

type TournamentContextType = {
  tournaments: Tournament[]
  selected: Tournament | null
  setSelected: (t: Tournament | null) => void
  refresh: () => Promise<void>
  loading: boolean
}

const TournamentContext = createContext<TournamentContextType>({
  tournaments: [],
  selected: null,
  setSelected: () => { },
  refresh: async () => { },
  loading: true,
})

export const useTournament = () => useContext(TournamentContext)

export function TournamentProvider({ children }: { children: ReactNode }) {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [selected, setSelected] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await getTournaments()
      setTournaments(data)
      if (data.length > 0 && !selected) {
        setSelected(data[0])
      }
    } catch (err) {
      console.error("Failed to load tournaments:", err)
    } finally {
      setLoading(false)
    }
  }, [selected])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <TournamentContext.Provider value={{ tournaments, selected, setSelected, refresh, loading }}>
      {children}
    </TournamentContext.Provider>
  )
}
