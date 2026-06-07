// Year-end carry-forward tests. Exercise the pure rollover logic the
// annual cron uses to open each employee's new leave year: unused days
// carry over, capped per employee, and the carried amount never
// compounds from one year to the next.

import test from 'node:test'
import assert from 'node:assert/strict'
import { computeCarryForward } from '../lib/leave-accrual.ts'

test('unused days carry over up to the per-employee cap', () => {
    const r = computeCarryForward({
        total: 24,
        used: 10,
        pending: 2,
        carriedForward: 0,
        maxCarryForward: 5,
    })
    // 24 - 10 - 2 = 12 remaining, capped at 5.
    assert.equal(r.remaining, 12)
    assert.equal(r.willCarry, 5)
    // Base 24 (no prior carry) plus 5 carried = 29.
    assert.equal(r.nextYearTotal, 29)
})

test('remaining below the cap carries in full', () => {
    const r = computeCarryForward({
        total: 24,
        used: 21,
        pending: 0,
        carriedForward: 0,
        maxCarryForward: 5,
    })
    assert.equal(r.remaining, 3)
    assert.equal(r.willCarry, 3)
    assert.equal(r.nextYearTotal, 27)
})

test('a fully spent balance carries nothing', () => {
    const r = computeCarryForward({
        total: 24,
        used: 24,
        pending: 0,
        carriedForward: 0,
        maxCarryForward: 5,
    })
    assert.equal(r.remaining, 0)
    assert.equal(r.willCarry, 0)
    assert.equal(r.nextYearTotal, 24)
})

test('over-spending never produces negative carry', () => {
    const r = computeCarryForward({
        total: 24,
        used: 26,
        pending: 1,
        carriedForward: 0,
        maxCarryForward: 5,
    })
    assert.equal(r.remaining, 0)
    assert.equal(r.willCarry, 0)
    assert.equal(r.nextYearTotal, 24)
})

test('prior carry-forward is stripped so it never compounds', () => {
    // Closing year had a 24 base plus 5 carried in = 29 total.
    // The new base must be 24, not 29, before this year's carry.
    const r = computeCarryForward({
        total: 29,
        used: 25,
        pending: 0,
        carriedForward: 5,
        maxCarryForward: 5,
    })
    assert.equal(r.remaining, 4)
    assert.equal(r.willCarry, 4)
    // Base 29 - 5 prior carry = 24, plus 4 carried now = 28.
    assert.equal(r.nextYearTotal, 28)
})

test('rolling two years steadily holds the base entitlement', () => {
    // Year one: take nothing, carry the cap.
    const y1 = computeCarryForward({ total: 24, used: 0, pending: 0, carriedForward: 0, maxCarryForward: 5 })
    assert.equal(y1.willCarry, 5)
    assert.equal(y1.nextYearTotal, 29)
    // Year two opens at 29 (24 + 5 carried). Take nothing again: the
    // base stays 24 and the carry is still capped at 5, never 10.
    const y2 = computeCarryForward({ total: 29, used: 0, pending: 0, carriedForward: 5, maxCarryForward: 5 })
    assert.equal(y2.willCarry, 5)
    assert.equal(y2.nextYearTotal, 29)
})

test('fractional balances round to two places', () => {
    const r = computeCarryForward({
        total: 25.5,
        used: 20.25,
        pending: 0,
        carriedForward: 0,
        maxCarryForward: 10,
    })
    assert.equal(r.remaining, 5.25)
    assert.equal(r.willCarry, 5.25)
    assert.equal(r.nextYearTotal, 30.75)
})

test('a zero cap carries nothing even with days remaining', () => {
    const r = computeCarryForward({
        total: 24,
        used: 0,
        pending: 0,
        carriedForward: 0,
        maxCarryForward: 0,
    })
    assert.equal(r.willCarry, 0)
    assert.equal(r.nextYearTotal, 24)
})
