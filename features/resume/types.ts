export interface ExperienceItem {
  period: string
  company: string
  timing: string
  role: string
  description: string[]
}

export interface PortfolioItem {
  title: string
  description: string
  year: string
  link?: string
}

export interface TechStack {
  category: string
  items: string
  group?: string
}

export interface PersonalInfo {
  name: string
  title: string
  birthDate?: string
  birthPlace?: string
  gender: string
  status: string
  address: string
  highlightSkills?: string[]
}

export interface Education {
  degree: string
  field: string
  institution: string
  period: string
  gpa?: string
  thesis?: string
  description?: string
  organization?: string[]
}

export interface Certification {
  title: string
  issuer: string
  // Optional: course certificates listed under a group often carry no date.
  period?: string
  link?: string
  // Falls back to `issuer` when unset, so every certificate lands in a group.
  group?: string
}

export interface Achievement {
  title: string
  description: string
  period?: string
}

export interface Organization {
  title: string
  period: string
  description?: string
}
