// What the plenaries list shows about the attendance of a Local, from the API of the statutory service
// (GET /events/:id/plenaries/local-attendance, built in statutory/lib/local_attendance.js).
// The service decides the numbers and the 80% mark; these functions only put them into words.

export const formatPercent = (percent) => `${percent.toFixed(2)}%`

// The Locals with the lowest attendance first, so the Locals below the threshold are on top.
export const lowestFirst = (locals) => [...locals].sort((a, b) => a.average_percent - b.average_percent || a.name.localeCompare(b.name))

// The mark of a Local, or nothing when no plenary has started yet.
export function attendanceTag (local, threshold) {
  if (local.plenaries.length === 0) return null
  if (local.below_threshold) return { label: `Below ${threshold}%`, type: 'is-danger' }
  return { label: `At least ${threshold}%`, type: 'is-success' }
}

// The rule behind the numbers, for the line above the table.
export function explainAttendance (threshold) {
  return [
    `An Antenna must be represented by its delegates in at least ${threshold}% of plenary time (General Rules, art. 6(1)(d)).`,
    'A moment counts when at least one delegate of the Local is in the hall.',
    'The attendance of a Local is the average over the plenaries that have started, and every plenary has the same weight.',
    'A running plenary counts until now.'
  ].join(' ')
}
