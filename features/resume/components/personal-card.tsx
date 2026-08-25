import { Separator } from "@/components/ui/separator"
import { personalInfo } from "@/features/resume/data/resume"
import { InfoItem } from "@/features/resume/components/info-item"
import { SectionCard } from "@/components/ui/section-card"
import { formatBirthDetails, getCurrentAge } from "@/features/resume/utils/personal-info"
import { Calendar, MapPin, User, UserSearch } from "lucide-react"

export function PersonalCard() {
  const currentAge = getCurrentAge(personalInfo.birthDate)
  const birthDetails = formatBirthDetails(personalInfo.birthPlace, personalInfo.birthDate)

  return (
    <SectionCard icon={<User className="h-5 w-5" />} title="Personal" tone="tertiary">
      <div className="space-y-1">
        <InfoItem icon={<User className="h-4 w-4" />} label="Name" value={personalInfo.name} />
        <Separator className="my-2" />
        <InfoItem
          icon={<Calendar className="h-4 w-4" />}
          label="Date of Birth"
          value={birthDetails}
        />
        <Separator className="my-2" />
        <InfoItem
          icon={<UserSearch className="h-4 w-4" />}
          label="Age/ Gender/ Status"
          value={`${currentAge ?? "-"} years / ${personalInfo.gender} / ${personalInfo.status}`}
        />
        <Separator className="my-2" />
        <InfoItem
          icon={<MapPin className="h-4 w-4" />}
          label="Address"
          value={personalInfo.address}
        />
      </div>
    </SectionCard>
  )
}
