// Re-enrollment / retention math, computed from customer enrollment rows.
// A customer is "retained" into year Y if their master_customer_id appears in
// both year Y-1 and year Y. Rate(Y) = retained / (distinct customers in Y-1).

function distinctMasters(rows) {
  return new Set(rows.map((r) => r.master_customer_id))
}

// Re-enrollment rate for each year transition present in the data.
export function yearOverYear(customers) {
  const years = [...new Set(customers.map((c) => c.enrolled_year))].sort()
  const out = []
  for (let i = 1; i < years.length; i++) {
    const prevYear = years[i - 1]
    const year = years[i]
    const prev = distinctMasters(customers.filter((c) => c.enrolled_year === prevYear))
    const curr = distinctMasters(customers.filter((c) => c.enrolled_year === year))
    let retained = 0
    prev.forEach((id) => {
      if (curr.has(id)) retained += 1
    })
    out.push({
      year,
      prevYear,
      base: prev.size,
      retained,
      rate: prev.size ? retained / prev.size : null,
    })
  }
  return out
}

// Re-enrollment rate for the latest transition, broken down by a field.
export function latestBreakdown(customers, field) {
  const years = [...new Set(customers.map((c) => c.enrolled_year))].sort()
  if (years.length < 2) return { year: years[0], prevYear: null, rows: [] }
  const year = years[years.length - 1]
  const prevYear = years[years.length - 2]

  const groups = [...new Set(customers.map((c) => c[field]).filter(Boolean))].sort()
  const rows = groups.map((g) => {
    const prev = distinctMasters(
      customers.filter((c) => c.enrolled_year === prevYear && c[field] === g),
    )
    const curr = distinctMasters(
      customers.filter((c) => c.enrolled_year === year && c[field] === g),
    )
    let retained = 0
    prev.forEach((id) => {
      if (curr.has(id)) retained += 1
    })
    return { group: g, base: prev.size, retained, rate: prev.size ? retained / prev.size : null }
  })
  return { year, prevYear, rows }
}

export const pct = (rate) => (rate == null ? '—' : `${Math.round(rate * 100)}%`)
