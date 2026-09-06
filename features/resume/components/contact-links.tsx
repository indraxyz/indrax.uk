"use client"

import { Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import { GithubIcon } from "@/components/ui/github-icon"
import { LinkedinIcon } from "@/components/ui/linkedin-icon"
import { SOCIAL_LINKS } from "@/features/resume/config"
import { personalInfo } from "@/features/resume/data/resume"
import { captureEvent, type ContactChannel } from "@/lib/analytics"

function trackContact(channel: ContactChannel) {
  captureEvent("contact_clicked", { channel })
}

// The hero's call to action. Until this existed there was nothing on the page to
// act on: the email address lived only inside the generated PDF, and the personal
// card carries name, birth details and address but no way to make contact.
export function ContactLinks() {
  const { email } = personalInfo

  return (
    // A labelled landmark, not a bare row: it gives the outbound profile links a
    // name of their own in a landmark and link-list walk, where three unlabelled
    // links floating in the hero would otherwise sit with no stated purpose.
    <nav
      aria-label="Contact"
      className="flex flex-wrap items-center justify-center gap-3 sm:justify-start"
    >
      {/* `email` is optional on the type, so the row has to survive its absence. */}
      {email ? (
        <Button asChild variant="primary" size="sm">
          <a
            href={`mailto:${email}`}
            aria-label={`Email ${email}`}
            onClick={() => trackContact("email")}
          >
            <Mail aria-hidden="true" />
            {/* The address itself rather than the word "Email": paper has no link
                to follow, and neither the screen nor the printed sheet carried an
                email before this. Lowercase, because an address in the button's
                usual uppercase is a different address. */}
            <span className="normal-case tracking-normal">{email}</span>
          </a>
        </Button>
      ) : null}

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
