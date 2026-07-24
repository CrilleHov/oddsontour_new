"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getPoints } from "@/lib/points"

type FeeRule = {
  regel: string
  antal: number
  belopp: number
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function assertAdminPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD

  if (!expected) {
    throw new Error("ADMIN_PASSWORD saknas i environment variables")
  }

  if (password !== expected) {
    throw new Error("Felaktigt lösenord")
  }
}

function cleanRules(regler: FeeRule[] | null | undefined): FeeRule[] | null {
  if (!Array.isArray(regler)) return null

  const cleaned = regler
    .filter(
      (r) =>
        typeof r?.regel === "string" &&
        r.regel.trim().length > 0 &&
        Number.isFinite(Number(r.antal)) &&
        Number(r.antal) > 0
    )
    .map((r) => ({
      regel: r.regel.trim(),
      antal: Math.round(Number(r.antal)),
      belopp: Math.round(Number(r.belopp ?? 0)),
    }))

  return cleaned.length > 0 ? cleaned : null
}

export async function addFees(params: {
  fees: Array<{
    spelare: string
    belopp: number
    ar: number
    tavling_datum: string
    regler?: FeeRule[] | null
  }>
  password: string
}) {
  assertAdminPassword(params.password)

  const supabase = createAdminClient()

  const rows = params.fees
    .filter(
      (f) =>
        Number.isFinite(f.belopp) &&
        f.belopp > 0 &&
        typeof f.tavling_datum === "string" &&
        DATE_RE.test(f.tavling_datum)
    )
    .map((f) => {
      const ar = Number.isFinite(f.ar) ? Number(f.ar) : Number(f.tavling_datum.slice(0, 4))

      if (Number(f.tavling_datum.slice(0, 4)) !== ar) {
        throw new Error(
          `Året (${ar}) stämmer inte med tävlingsdatumet (${f.tavling_datum})`
        )
      }

      return {
        spelare: f.spelare,
        "bötesbelopp": Math.round(f.belopp),
        ar,
        tavling_datum: f.tavling_datum,
        regler: cleanRules(f.regler),
      }
    })

  if (rows.length === 0) {
    return { inserted: 0 }
  }

  const { data, error } = await supabase
    .from("fees")
    .upsert(rows, { onConflict: "spelare,tavling_datum" })
    .select("id")

  if (error) throw new Error(error.message)

  return { inserted: data?.length ?? rows.length }
}

export async function deleteFeesForCompetition(params: {
  tavling_datum: string
  password: string
}) {
  assertAdminPassword(params.password)

  if (!DATE_RE.test(params.tavling_datum)) {
    throw new Error("Ogiltigt tävlingsdatum")
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("fees")
    .delete()
    .eq("tavling_datum", params.tavling_datum)
    .select("id")

  if (error) throw new Error(error.message)

  return { deleted: data?.length ?? 0 }
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
