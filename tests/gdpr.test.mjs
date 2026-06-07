// GDPR export tests. Exercise the bundle assembly the data-export
// endpoint returns to a subject under their right to data portability.

import test from 'node:test'
import assert from 'node:assert/strict'
import { buildGdprBundle, gdprFilename, GDPR_SCHEMA_VERSION, GDPR_TABLES, gdprCoverageGaps, assertGdprCoverage } from '../lib/gdpr.ts'
import { gdprSources, gdprExportTables } from './fixtures/staff.mjs'

test('buildGdprBundle assembles every section and counts records', () => {
    const bundle = buildGdprBundle({
        userId: 'user-1',
        email: 'ada@acme.com',
        fullName: 'Ada Lovelace',
        generatedAt: new Date('2026-05-31T09:00:00Z'),
        sources: gdprSources,
    })

    assert.equal(bundle.schemaVersion, GDPR_SCHEMA_VERSION)
    assert.equal(bundle.subject.userId, 'user-1')
    assert.equal(bundle.subject.email, 'ada@acme.com')
    assert.equal(bundle.sections.length, 3)
    // 1 profile + 2 attendance + 0 leave = 3 records.
    assert.equal(bundle.recordCount, 3)
    assert.equal(bundle.generatedAt, '2026-05-31T09:00:00.000Z')
})

test('buildGdprBundle tolerates null and undefined record sets', () => {
    const bundle = buildGdprBundle({
        userId: 'user-2',
        email: 'bob@acme.com',
        fullName: null,
        sources: [
            { table: 'attendance', description: 'x', records: null },
            { table: 'leave_requests', description: 'y', records: undefined },
        ],
    })
    assert.equal(bundle.recordCount, 0)
    assert.equal(bundle.sections[0].records.length, 0)
    assert.equal(bundle.subject.fullName, null)
})

test('the bundle serialises to valid JSON', () => {
    const bundle = buildGdprBundle({
        userId: 'user-1',
        email: 'ada@acme.com',
        fullName: 'Ada Lovelace',
        sources: gdprSources,
    })
    const round = JSON.parse(JSON.stringify(bundle))
    assert.equal(round.recordCount, 3)
})

test('gdprFilename is filesystem safe and dated', () => {
    const name = gdprFilename('ada@acme.com', new Date('2026-05-31T00:00:00Z'))
    assert.equal(name, 'staff-portal-export-ada-acme-com-2026-05-31.json')
    assert.match(name, /^staff-portal-export-[a-z0-9-]+-\d{4}-\d{2}-\d{2}\.json$/)
})

test('GDPR_TABLES covers the core personal-data tables', () => {
    for (const required of ['user_profiles', 'attendance', 'leave_requests', 'expenses', 'audit_logs']) {
        assert.ok(GDPR_TABLES.includes(required), `expected ${required} in GDPR_TABLES`)
    }
})

test('the export route covers every canonical personal-data table', () => {
    // Pins the live route's SOURCES (mirrored in the fixture) against
    // the canonical list. If a table is added to GDPR_TABLES but not
    // wired into the route, this fails before it ships an incomplete
    // export to a data subject.
    assert.deepEqual(gdprCoverageGaps(gdprExportTables), [])
    assert.doesNotThrow(() => assertGdprCoverage(gdprExportTables))
})

test('gdprCoverageGaps reports a forgotten table by name', () => {
    const withoutVisitors = gdprExportTables.filter(t => t !== 'visitors')
    assert.deepEqual(gdprCoverageGaps(withoutVisitors), ['visitors'])
    assert.throws(() => assertGdprCoverage(withoutVisitors), /visitors/)
})
