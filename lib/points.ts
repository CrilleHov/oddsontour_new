export function getPoints(placering: number, antalSpelare: number, majorFlag: "Ja" | "Nej") {
  if (!placering || placering <= 0) return 0
  if (!antalSpelare || antalSpelare <= 0) return 0
  if (placering > antalSpelare) return 0

  // Grund: n - place + 1
  let points = antalSpelare - placering + 1

  if (majorFlag === "Ja") {
    // Matchar din Streamlit-matris: vinnare +2, tvåa +0.5
    if (placering === 1) points += 2
    else if (placering === 2) points += 0.5
  } else {
    // Non-major: vinnare +1
    if (placering === 1) points += 1
  }

  return points
}