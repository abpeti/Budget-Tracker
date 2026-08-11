// Pénzösszeg-kezelés kizárólag egész számokkal (fillér, azaz századok).
// Sosem parseFloat / lebegőpontos aritmetika — csak string-műveletek és
// egész osztás/maradék, a specifikáció 8. fejezete szerint.

const huGroupFormatter = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 })

/** A numpad nyers bevitelét (pl. "12450" vagy "12.5") fillérré (egész szám) alakítja. */
export function parseAmountInputToCents(raw: string): number {
  const [wholePart, fractionPart = ""] = raw.split(".")
  const whole = wholePart.replace(/\D/g, "") || "0"
  const fraction = (fractionPart.replace(/\D/g, "") + "00").slice(0, 2)
  const digits = `${whole}${fraction}`.replace(/^0+(?=\d)/, "")
  return parseInt(digits, 10) || 0
}

/** Fillérből (egész szám) HUF megjelenítési string, szóközös ezreselválasztóval. */
export function formatCentsAsHuf(cents: number): string {
  const majorUnits = Math.trunc(cents / 100)
  return `${huGroupFormatter.format(majorUnits)} Ft`
}

/** Fillérből a Supabase felé küldendő decimális string ("12450.00"). */
export function centsToDecimalString(cents: number): string {
  const negative = cents < 0
  const abs = Math.abs(cents)
  const whole = Math.trunc(abs / 100)
  const fraction = (abs % 100).toString().padStart(2, "0")
  return `${negative ? "-" : ""}${whole}.${fraction}`
}

/** A numpad bevitel élő formázása gépelés közben (ezreselválasztó az egész részen). */
export function formatAmountInputDisplay(raw: string): string {
  const [wholePart, fractionPart] = raw.split(".")
  const wholeDigits = wholePart.replace(/\D/g, "") || "0"
  const formattedWhole = huGroupFormatter.format(parseInt(wholeDigits, 10) || 0)
  if (fractionPart === undefined) return formattedWhole
  return `${formattedWhole},${fractionPart}`
}

/** Fillérből a Supabase felé küldött JS number — egyetlen, nem-aritmetikai konverzió a hívás határán. */
export function centsToAmount(cents: number): number {
  return Number(centsToDecimalString(cents))
}

/** Számjegy(ek) hozzáfűzése a numpad bufferhez, a tizedesjegyeket 2-re korlátozva. */
export function appendToAmountInput(raw: string, insert: string): string {
  const hasDecimal = raw.includes(".")
  const [wholePart, fractionPart = ""] = raw.split(".")
  let whole = wholePart
  let fraction = fractionPart

  for (const ch of insert) {
    if (hasDecimal) {
      if (fraction.length < 2) fraction += ch
    } else {
      whole = whole === "0" ? ch : whole + ch
    }
  }

  whole = whole.slice(0, 12)
  return hasDecimal ? `${whole}.${fraction}` : whole
}

/** Tizedesvessző hozzáadása a bufferhez, ha még nincs benne. */
export function appendDecimalPoint(raw: string): string {
  return raw.includes(".") ? raw : `${raw}.`
}

/** Az utolsó karakter törlése a numpad bufferből. */
export function backspaceAmountInput(raw: string): string {
  if (raw.length <= 1) return "0"
  const next = raw.slice(0, -1)
  return next === "" ? "0" : next
}
