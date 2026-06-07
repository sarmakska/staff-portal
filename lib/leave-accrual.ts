// ============================================================
// Leave-balance accruals — pure calculation logic.
// Kept free of database and network calls so it can be unit
// tested directly and reused by both the cron route and the
// admin preview screen.
// ============================================================

export interface AccrualInput {
    // Days that accrue per calendar month for this balance.
    accrualRate: number
    // Running total already granted by the accrual job this year.
    accruedToDate: number
    // Date the job last topped this balance up, or null if never.
    lastAccruedOn: string | null
    // The date the job is running on (defaults to today).
    asOf: Date
    // Annual cap. The accrued total never exceeds this.
    annualCap: number
}

export interface AccrualResult {
    // Whole or fractional days to add to leave_balances.total now.
    daysToGrant: number
    // The new running accrued_to_date after this grant.
    newAccruedToDate: number
    // Number of whole months credited in this run.
    monthsCredited: number
}

// Returns the zero-based month index difference between two dates,
// counting only fully elapsed calendar months. A balance accrued on
// 31 Jan and evaluated on 1 Mar has one full month elapsed.
export function monthsElapsed(from: Date, to: Date): number {
    if (to <= from) return 0
    let months =
        (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
        (to.getUTCMonth() - from.getUTCMonth())
    // Only count a month once the day-of-month has been reached.
    if (to.getUTCDate() < from.getUTCDate()) months -= 1
    return Math.max(0, months)
}

// Compute how much leave to grant for a single balance.
// Accrual only ever moves forward and is capped at annualCap.
export function computeAccrual(input: AccrualInput): AccrualResult {
    const { accrualRate, accruedToDate, lastAccruedOn, asOf, annualCap } = input

    if (accrualRate <= 0) {
        return { daysToGrant: 0, newAccruedToDate: accruedToDate, monthsCredited: 0 }
    }

    // First run of the year: anchor to 1 January so a new starter
    // begins accruing from the start of the leave year.
    const anchor = lastAccruedOn
        ? new Date(`${lastAccruedOn}T00:00:00Z`)
        : new Date(Date.UTC(asOf.getUTCFullYear(), 0, 1))

    const months = monthsElapsed(anchor, asOf)
    if (months === 0) {
        return { daysToGrant: 0, newAccruedToDate: accruedToDate, monthsCredited: 0 }
    }

    const rawGrant = round2(months * accrualRate)
    // Never let the running accrued total exceed the annual cap.
    const headroom = Math.max(0, round2(annualCap - accruedToDate))
    const daysToGrant = Math.min(rawGrant, headroom)
    const monthsCredited = daysToGrant === rawGrant ? months : creditableMonths(daysToGrant, accrualRate)

    return {
        daysToGrant,
        newAccruedToDate: round2(accruedToDate + daysToGrant),
        monthsCredited,
    }
}

function creditableMonths(days: number, rate: number): number {
    if (rate <= 0) return 0
    return Math.floor(days / rate)
}

export function round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100
}

// Derive the date string (YYYY-MM-DD, UTC) the balance should record
// as its new last_accrued_on after a successful grant.
export function accrualStamp(asOf: Date): string {
    return asOf.toISOString().slice(0, 10)
}

// ============================================================
// Year-end carry-forward — pure calculation logic.
// Drives the annual rollover cron: unused leave from the closing
// year is carried into the new year, capped per employee. Kept
// pure so the rollover route and the admin preview share one
// source of truth and the arithmetic can be unit tested.
// ============================================================

export interface CarryForwardInput {
    // The closing year's total entitlement (including any leave that
    // was itself carried into the closing year).
    total: number
    // Days already taken in the closing year.
    used: number
    // Days requested but not yet taken at year end.
    pending: number
    // Days that were carried into the closing year. Stripped out so
    // carry-forward never compounds year on year.
    carriedForward: number
    // The most this employee may carry into the new year.
    maxCarryForward: number
}

export interface CarryForwardResult {
    // Unused, unpending days left at year end (never negative).
    remaining: number
    // Days actually carried into the new year after the cap.
    willCarry: number
    // The new year's opening total entitlement.
    nextYearTotal: number
}

// Compute the new year's opening balance from a closing-year balance.
// Unused days are capped at the employee's carry limit, and the base
// entitlement is taken net of any prior carry-forward so the carried
// amount never compounds.
export function computeCarryForward(input: CarryForwardInput): CarryForwardResult {
    const total = Number(input.total) || 0
    const used = Number(input.used) || 0
    const pending = Number(input.pending) || 0
    const carriedForward = Number(input.carriedForward) || 0
    const cap = Math.max(0, Number(input.maxCarryForward) || 0)

    const remaining = Math.max(0, round2(total - used - pending))
    const willCarry = round2(Math.min(remaining, cap))
    const nextYearBase = round2(total - carriedForward)
    const nextYearTotal = round2(nextYearBase + willCarry)

    return { remaining, willCarry, nextYearTotal }
}
