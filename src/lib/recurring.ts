// Ismétlődési szabályok dátumaritmetikája és címkéi.
//
// A következő előfordulást MINDIG a horgonyból (day_of_period) számoljuk, nem az
// előző dátum egyszerű eltolásával — különben a rövidebb hónapok elcsúsztatnák a
// sorozatot (jan. 31. → febr. 28. → márc. 28. helyett márc. 31. a helyes).

import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  format,
  getDate,
  getDay,
  getDaysInMonth,
  parseISO,
  setDate,
  startOfMonth,
} from "date-fns"
import type { RecurringFrequency } from "@/lib/database.types"

export interface RecurrenceSpec {
  frequency: RecurringFrequency
  interval_count: number
  /** monthly/yearly: a hónap napja (31 = a hónap utolsó napja). weekly: ISO hétnap. */
  day_of_period: number
}

/** Egy naptári nap ISO (yyyy-MM-dd) alakban — időzóna-eltolás nélkül. */
export function toIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

export function todayIso(): string {
  return toIsoDate(new Date())
}

/** A megadott előfordulás UTÁNI következő esedékesség. */
export function nextOccurrenceAfter(spec: RecurrenceSpec, isoDate: string): string {
  const date = parseISO(isoDate)
  const step = Math.max(1, spec.interval_count)

  switch (spec.frequency) {
    case "daily":
      return toIsoDate(addDays(date, step))
    case "weekly":
      return toIsoDate(addWeeks(date, step))
    case "monthly":
      return toIsoDate(withAnchorDay(addMonths(startOfMonth(date), step), spec.day_of_period))
    case "yearly":
      return toIsoDate(withAnchorDay(addYears(startOfMonth(date), step), spec.day_of_period))
  }
}

/** A hónapon belüli horgonynap, a hónap hosszához vágva (31 → febr. 28./29.). */
function withAnchorDay(monthStart: Date, day: number): Date {
  return setDate(monthStart, Math.min(Math.max(day, 1), getDaysInMonth(monthStart)))
}

/** Legfeljebb ennyi elmaradt előfordulást ajánlunk fel egyszerre. */
export const MAX_CATCH_UP = 24

export interface DueRule extends RecurrenceSpec {
  next_run: string
  end_date: string | null
  is_active: boolean
}

/**
 * A ma (bezárólag) esedékes, még nem rögzített előfordulások dátumai.
 * Ha az app hetekig nem indult el, több elmaradt tétel is visszajön — mindegyik
 * külön sorként, hogy a felhasználó egyesével dönthessen róluk.
 */
export function dueOccurrences(
  rule: DueRule,
  today = todayIso(),
  max = MAX_CATCH_UP
): string[] {
  if (!rule.is_active) return []

  const dates: string[] = []
  let current = rule.next_run

  while (current <= today && dates.length < max) {
    if (rule.end_date && current > rule.end_date) break
    dates.push(current)
    current = nextOccurrenceAfter(rule, current)
  }

  return dates
}

/** Az első `count` előfordulás a megadott kezdőnaptól — előnézethez az űrlapon. */
export function occurrencesFrom(spec: RecurrenceSpec, startIso: string, count: number): string[] {
  const dates = [startIso]
  while (dates.length < count) {
    dates.push(nextOccurrenceAfter(spec, dates[dates.length - 1]))
  }
  return dates
}

/** A szabály lejárt-e: a következő futás túlmutat a végdátumon. */
export function isFinished(rule: { next_run: string; end_date: string | null }): boolean {
  return !!rule.end_date && rule.next_run > rule.end_date
}

/**
 * A kezdődátumból levezetett horgony. Havi/éves ismétlődésnél a hónap napja
 * (vagy 31, ha a "hónap utolsó napja" opció aktív), hetinél az ISO hétnap.
 */
export function deriveDayOfPeriod(
  frequency: RecurringFrequency,
  startIso: string,
  lastDayOfMonth = false
): number {
  const date = parseISO(startIso)
  switch (frequency) {
    case "daily":
      return 1
    case "weekly":
      return ((getDay(date) + 6) % 7) + 1 // vasárnap=0 → ISO 7
    case "monthly":
    case "yearly":
      return lastDayOfMonth ? 31 : getDate(date)
  }
}

const PERIOD_NOUNS: Record<RecurringFrequency, string> = {
  daily: "naponta",
  weekly: "hetente",
  monthly: "havonta",
  yearly: "évente",
}

/** Emberi címke: "havonta", "negyedévente", "2 hetente", "3 évente". */
export function describeSchedule(frequency: RecurringFrequency, intervalCount: number): string {
  const n = Math.max(1, intervalCount)
  if (n === 1) return PERIOD_NOUNS[frequency]
  if (frequency === "monthly" && n === 3) return "negyedévente"
  if (frequency === "monthly" && n === 6) return "félévente"
  if (frequency === "weekly" && n === 2) return "kéthetente"
  return `${n} ${PERIOD_NOUNS[frequency]}`
}

/** A "hányadikán" kiegészítés a listához: "havonta · 15-én". */
export function describeAnchor(spec: RecurrenceSpec): string | null {
  switch (spec.frequency) {
    case "monthly":
      return spec.day_of_period >= 31 ? "a hónap utolsó napján" : `${spec.day_of_period}-án/-én`
    case "weekly":
      return WEEKDAY_NAMES[spec.day_of_period - 1] ?? null
    default:
      return null
  }
}

const WEEKDAY_NAMES = [
  "hétfőn",
  "kedden",
  "szerdán",
  "csütörtökön",
  "pénteken",
  "szombaton",
  "vasárnap",
]
