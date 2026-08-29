import { cn } from "@/lib/utils"
import { AchievementsCard } from "@/features/resume/components/achievements-card"
import { CertificationsCard } from "@/features/resume/components/certifications-card"
import { CapabilitiesCard } from "@/features/resume/components/capabilities-card"
import { EducationCard } from "@/features/resume/components/education-card"
import { OrganizationsCard } from "@/features/resume/components/organizations-card"
import { PersonalCard } from "@/features/resume/components/personal-card"

interface SidebarInfoProps {
  className?: string
}

export function SidebarInfo({ className }: SidebarInfoProps) {
  return (
    <div data-print-columns className={cn("space-y-8 print:space-y-4", className)}>
      <PersonalCard />
      <CapabilitiesCard />
      <EducationCard />
      <CertificationsCard />
      <AchievementsCard />
      <OrganizationsCard />
    </div>
  )
}
