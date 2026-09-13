export type Greeting = 'morning' | 'afternoon' | 'evening'

export function getGreeting(now: Date = new Date()): Greeting {
  const hour = now.getHours()
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

export function formatMemberSince(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function formatTenure(createdAt: string, now: Date = new Date()): string {
  const created = new Date(createdAt)
  let months = (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth())
  if (now.getDate() < created.getDate()) months -= 1
  months = Math.max(months, 0)

  const years = Math.floor(months / 12)
  if (years >= 1) return `${years} year${years === 1 ? '' : 's'} with us`
  if (months >= 1) return `${months} month${months === 1 ? '' : 's'} with us`
  return 'New member'
}
