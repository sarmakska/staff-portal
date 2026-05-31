// Leave-balance accrual tests. Exercise the monthly top-up logic end
// to end across a calendar year, including the annual cap and the
// idempotency guard that stops the cron double-counting.

import test from 'node:test'
import assert from 'node:assert/strict'
import { computeAccrual, monthsElapsed, accrualStamp } from '../lib/leave-accrual.ts'
import { annualBalance } from './fixtures/staff.mjs'

test('monthsElapsed counts whole calendar months only', () => {
    assert.equal(monthsElapsed(new Date('2026-01-01'), new Date('2026-01-31')), 0)
    assert.equal(monthsElapsed(new Date('2026-01-01'), new Date('2026-02-01')), 1)
    assert.equal(monthsElapsed(new Date('2026-01-15'), new Date('2026-03-14')), 1)
    assert.equal(monthsElapsed(new Date('2026-01-15'), new Date('2026-03-15')), 2)
    assert.equal(monthsElapsed(new Date('2026-06-01'), new Date('2026-01-01')), 0)
})

test('first run anchors to 1 January and grants elapsed months', () => {
    const result = computeAccrual({
        accrualRate: 2,
        accruedToDate: 0,
        lastAccruedOn: null,
        asOf: new Date('2026-04-01T00:00:00Z'),
        annualCap: 24,
    })
    // Jan to Apr = 3 full months at 2 days each = 6 days.
    assert.equal(result.daysToGrant, 6)
    assert.equal(result.newAccruedToDate, 6)
    assert.equal(result.monthsCredited, 3)
})

test('subsequent run grants only the newly elapsed months', () => {
    const result = computeAccrual({
        accrualRate: 2,
        accruedToDate: 6,
        lastAccruedOn: '2026-04-01',
        asOf: new Date('2026-06-01T00:00:00Z'),
        annualCap: 24,
    })
    // Apr to Jun = 2 months at 2 days = 4 days.
    assert.equal(result.daysToGrant, 4)
    assert.equal(result.newAccruedToDate, 10)
})

test('accrual is capped at the annual entitlement', () => {
    const result = computeAccrual({
        accrualRate: 2,
        accruedToDate: 22,
        lastAccruedOn: '2026-11-01',
        asOf: new Date('2027-02-01T00:00:00Z'),
        annualCap: 24,
    })
    // Only 2 days of headroom remain regardless of months elapsed.
    assert.equal(result.daysToGrant, 2)
    assert.equal(result.newAccruedToDate, 24)
})

test('re-running on the same day grants nothing (idempotent)', () => {
    const result = computeAccrual({
        accrualRate: 2,
        accruedToDate: 10,
        lastAccruedOn: '2026-06-01',
        asOf: new Date('2026-06-01T12:00:00Z'),
        annualCap: 24,
    })
    assert.equal(result.daysToGrant, 0)
    assert.equal(result.newAccruedToDate, 10)
})

test('a zero accrual rate never grants leave', () => {
    const result = computeAccrual({
        accrualRate: 0,
        accruedToDate: 0,
        lastAccruedOn: null,
        asOf: new Date('2026-12-01T00:00:00Z'),
        annualCap: 24,
    })
    assert.equal(result.daysToGrant, 0)
})

test('rolling the cron monthly accrues steadily and respects the cap', () => {
    // Walk month by month as the cron would, first of each month.
    let accrued = 0
    let last = null
    const rate = annualBalance.accrual_rate
    const cap = annualBalance.total
    const run = (asOf) => {
        const r = computeAccrual({ accrualRate: rate, accruedToDate: accrued, lastAccruedOn: last, asOf, annualCap: cap })
        accrued = r.newAccruedToDate
        if (r.daysToGrant > 0) last = accrualStamp(asOf)
    }
    // The 1 January run anchors but grants nothing yet; Feb to Dec
    // each credit one elapsed month at 2 days = 11 * 2 = 22 days.
    for (let month = 0; month < 12; month++) run(new Date(Date.UTC(2026, month, 1)))
    assert.equal(accrued, 22)
    // The first run of the following year tops up the final month and
    // is then held at the annual cap.
    run(new Date(Date.UTC(2027, 0, 1)))
    assert.equal(accrued, 24)
    run(new Date(Date.UTC(2027, 1, 1)))
    assert.equal(accrued, 24)
})
