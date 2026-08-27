import { formatDate } from "@/lib/utils"

export function getCurrentAge(birthDate?: string) {
  if (!birthDate) return undefined

  // The birth date is a calendar date parsed as UTC midnight, so compare it in
  // UTC too rather than mixing it with the runtime's local calendar.
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getUTCFullYear() - birth.getUTCFullYear()
  const monthDiff = today.getUTCMonth() - birth.getUTCMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birth.getUTCDate())) {
    age -= 1
  }

  return age
}

export function formatBirthDetails(birthPlace?: string, birthDate?: string) {
  if (!birthDate) return birthPlace ?? ""

  const formattedDate = formatDate(birthDate, {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return birthPlace ? `${birthPlace}, ${formattedDate}` : formattedDate
}
