"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getPoints } from "@/lib/points"

function assertAdminPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) {
    throw new Error("ADMIN_PASSWORD saknas i environment variables")
  }
  if (password !== expected) {
    throw new Error("Felaktigt lösenord")
  }
}

export async function addFees(params: {
  fees: Array<{ spelare: string; belopp: number; ar: number }>
  password: string
}) {
  assertAdminPassword(params.password)
  const supabase = createAdminClient()

  const rows = params.fees
    .filter((f) => Number.isFinite(f.belopp) && f.belopp > 0 && Number.isFinite(f.ar))
    .map((f) => ({
      spelare: f.spelare,
      "bötesbelopp": Math.round(f.belopp),
      ar: Number(f.ar),
    }))

  if (rows.length === 0) {
    return { inserted: 0 }
  }

  const { error } = await supabase.from("fees").insert(rows)
  if (error) throw new Error(error.message)

  return { inserted: rows.length }
}

export async function addLeaderboardUpdate(params: {
  tavling: string // YYYY-MM-DD
  antalSpelare: number
  major: "Ja" | "Nej"
  placeringar: Array<{ spelare: string; placering: number; motPar: number }>
  password: string
}) {
  assertAdminPassword(params.password)
  const supabase = createAdminClient()

  const antal = Number(params.antalSpelare)
  if (!Number.isFinite(antal) || antal < 3 || antal > 12) {
    throw new Error("Antal spelare måste vara mellan 3 och 12")
  }

  const rows = params.placeringar.map((p) => {
    const placering = Number(p.placering)
    const motPar = Number(p.motPar ?? 0)
    const poang = getPoints(placering, antal, params.major)

    return {
      "tävling": params.tavling,
      spelare: p.spelare,
      "poäng": poang,
      placering: placering,
      antal_spelare: antal,
      mot_par: motPar,
    }
  })

  const { error } = await supabase.from("leaderboard").insert(rows)
  if (error) throw new Error(error.message)

  const spelade = rows.filter((r) => (r.placering ?? 0) > 0).length

  return {
    inserted: rows.length,
    spelade,
    antalSpelare: antal,
  }
}
