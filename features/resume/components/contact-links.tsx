import { Button } from "@/components/ui/button"
import { GithubIcon } from "@/components/ui/github-icon"
import { LinkedinIcon } from "@/components/ui/linkedin-icon"
import { SOCIAL_LINKS } from "@/features/resume/config"
import { captureEvent, type ContactChannel } from "@/lib/analytics"

function trackContact(channel: ContactChannel) {
  captureEvent("contact_clicked", { channel })
}

// Public profile links in the hero. The email address lives in the personal drawer.
export function ContactLinks() {
  return (
    // A labelled landmark, not a bare row: it gives the outbound profile links a
    // name of their own in a landmark and link-list walk, where unlabelled
    // links floating in the hero would otherwise sit with no stated purpose.
    <nav
      aria-label="Contact"
      className="flex flex-wrap items-center justify-center gap-3 sm:justify-start"
    >
      <Button asChild variant="secondary" size="sm" className="print:hidden">
        <a
          href={SOCIAL_LINKS.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="LinkedIn profile"
          onClick={() => trackContact("linkedin")}
        >
          <LinkedinIcon aria-hidden="true" />
          LinkedIn
        </a>
      </Button>

      <Button asChild variant="secondary" size="sm" className="print:hidden">
        <a
          href={SOCIAL_LINKS.github}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub profile"
          onClick={() => trackContact("github")}
        >
          <GithubIcon aria-hidden="true" />
          GitHub
        </a>
      </Button>
    </nav>
  )
}
