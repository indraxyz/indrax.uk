import { formatDate } from "@/lib/utils"

export function getCurrentAge(birthDate?: string) {
  if (!birthDate) return undefined

  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
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
