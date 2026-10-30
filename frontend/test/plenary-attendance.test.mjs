import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  attendanceTag,
  explainAttendance,
  formatPercent,
  lowestFirst
} from '../src/plenaryAttendance.js'

const local = (name, averagePercent, belowThreshold = averagePercent < 80, plenaries = [{ plenary_id: 1 }]) => ({
  name, average_percent: averagePercent, below_threshold: belowThreshold, plenaries
})

describe('formatPercent', () => {
  it('shows two decimals like the export', () => {
    assert.equal(formatPercent(83.33333), '83.33%')
    assert.equal(formatPercent(100), '100.00%')
    assert.equal(formatPercent(0), '0.00%')
  })
})

describe('lowestFirst', () => {
  it('puts the lowest attendance on top, by name for equal attendance, without changing the input', () => {
    const locals = [local('C', 90), local('B', 20), local('A', 20), local('D', 50)]
    assert.deepEqual(lowestFirst(locals).map(l => l.name), ['A', 'B', 'D', 'C'])
    assert.deepEqual(locals.map(l => l.name), ['C', 'B', 'A', 'D'])
  })
})

describe('attendanceTag', () => {
  it('marks a Local below the threshold', () => {
    assert.deepEqual(attendanceTag(local('A', 79.9), 80), { label: 'Below 80%', type: 'is-danger' })
  })

  it('marks a Local at or above the threshold', () => {
    assert.deepEqual(attendanceTag(local('A', 80), 80), { label: 'At least 80%', type: 'is-success' })
  })

  it('gives no mark when no plenary of the Local has started', () => {
    assert.equal(attendanceTag(local('A', 0, false, []), 80), null)
  })
})

describe('explainAttendance', () => {
  it('names the rule, the union of the delegates and the equal weight', () => {
    const text = explainAttendance(80)
    assert.match(text, /at least 80% of plenary time/)
    assert.match(text, /at least one delegate/)
    assert.match(text, /same weight/)
    assert.match(text, /plenaries that have started/)
  })
})
