import { ConsentControl } from "@/components/consent-banner"
import { SITE_CONTAINER_CLASS } from "@/components/site-container"
import { RESUME_CONFIG } from "@/features/resume/config"
import { formatDate } from "@/lib/utils"

export function PublicFooter() {
  return (
    <footer className={SITE_CONTAINER_CLASS}>
      <div className="mt-12 flex items-center justify-center gap-3 border-t-2 border-border py-10 text-center print:mt-4 print:py-3">
        <p className="text-sm font-black uppercase tracking-[0.14em] text-muted-foreground">
          Updated {formatDate(RESUME_CONFIG.updatedAt)}
        </p>
        <ConsentControl separator />
      </div>
    </footer>
  )
}
