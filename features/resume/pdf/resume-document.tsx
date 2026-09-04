import { Document, Image, Link, Page, Text, View } from "@react-pdf/renderer"

import { RESUME_CONFIG, SECTION_COPY, SITE_URL, SOCIAL_LINKS } from "@/features/resume/config"
import {
  achievements,
  bio,
  education,
  experiences,
  organizations,
  personalInfo,
  portfolioItems,
  techSkills,
} from "@/features/resume/data/resume"
import { certificationGroups, techStackGroups } from "@/features/resume/utils/groups"
import { formatBirthDetails, getCurrentAge } from "@/features/resume/utils/personal-info"
import { PDF_PHOTO_SRC, registerPdfFonts, styles } from "@/features/resume/pdf/theme"
import { formatDate } from "@/lib/utils"

const SITE_HOST = new URL(SITE_URL).host

function Card({
  title,
  subtitle,
  children,
  tone = "tertiary",
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  tone?: "primary" | "tertiary"
}) {
  const header =
    tone === "primary"
      ? { backgroundColor: styles.chipPrimary.backgroundColor }
      : { backgroundColor: "#e1e100" }

  return (
    <View style={styles.card} wrap minPresenceAhead={48}>
      <View style={[styles.cardHeader, header]}>
        <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bullet} wrap={false}>
      <View style={styles.bulletMark} />
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  )
}

function Labelled({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={styles.itemMeta}>{label.toUpperCase()}</Text>
      <Text style={styles.itemTitle}>{value}</Text>
    </View>
  )
}

export function ResumeDocument() {
  registerPdfFonts()

  const firstName = personalInfo.name.trim().split(/\s+/)[0]
  const age = getCurrentAge(personalInfo.birthDate)
  const birthDetails = formatBirthDetails(personalInfo.birthPlace, personalInfo.birthDate)
  const skills = personalInfo.highlightSkills ?? []

  return (
    <Document
      title={`${personalInfo.name} - ${personalInfo.title}`}
      author={personalInfo.name}
      subject={personalInfo.title}
      creator={SITE_HOST}
    >
      <Page size="A4" style={styles.page}>
        {/* Hero */}
        <View style={[styles.card, { backgroundColor: styles.chipPrimary.backgroundColor }]}>
          <View style={[styles.cardBody, styles.hero]}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image takes no alt */}
            <Image src={PDF_PHOTO_SRC} style={styles.heroPhoto} />
            <View style={{ flex: 1 }}>
              <Text style={styles.heroName}>{firstName.toUpperCase()}</Text>
              <Text style={styles.heroRole}>{personalInfo.title.toUpperCase()}</Text>
              <View style={styles.chipRow}>
                {skills.map((skill) => (
                  <Text key={skill} style={[styles.chip, { backgroundColor: "#ffffff" }]}>
                    {skill.toUpperCase()}
                  </Text>
                ))}
              </View>
              <Text style={styles.heroBio}>{bio}</Text>
            </View>
          </View>
        </View>

        {/* Personal-side cards, two columns */}
        <View style={styles.columns}>
          <View style={styles.column}>
            <Card title="Personal">
              <Labelled label="Name" value={personalInfo.name} />
              <Labelled label="Date of Birth" value={birthDetails} />
              <Labelled
                label="Age / Gender / Status"
                value={`${age ?? "-"} years / ${personalInfo.gender} / ${personalInfo.status}`}
              />
              <Labelled label="Address" value={personalInfo.address} />
              {personalInfo.phone ? <Labelled label="Phone" value={personalInfo.phone} /> : null}
              {personalInfo.email ? <Labelled label="Email" value={personalInfo.email} /> : null}
              <Labelled label="GitHub" value={SOCIAL_LINKS.github} />
              <Labelled label="LinkedIn" value={SOCIAL_LINKS.linkedin} />
            </Card>

            <Card title="Education">
              {education.map((item, index) => (
                <View key={`${item.institution}-${item.period}`} wrap={false}>
                  {index > 0 ? <View style={styles.divider} /> : null}
                  <Text style={[styles.itemTitle, { letterSpacing: 0.5 }]}>
                    {item.degree.toUpperCase()}
                  </Text>
                  <Text>{item.institution}</Text>
                  <Text style={styles.itemMeta}>{item.field}</Text>
                  <Text style={[styles.chip, styles.chipTertiary, { alignSelf: "flex-start" }]}>
                    {item.period.toUpperCase()}
                    {item.gpa ? ` - GPA: ${item.gpa}` : ""}
                  </Text>
                  {item.thesis ? (
                    <Text style={[styles.itemMeta, { marginTop: 2 }]}>Thesis: {item.thesis}</Text>
                  ) : null}
                  {item.organization?.length ? (
                    <Text style={[styles.itemMeta, { marginTop: 2 }]}>
                      Organizations: {item.organization.join(", ")}
                    </Text>
                  ) : null}
                  {item.description ? (
                    <Text style={[styles.itemMeta, { marginTop: 2 }]}>{item.description}</Text>
                  ) : null}
                </View>
              ))}
            </Card>

            <Card title="Capabilities">
              {techSkills.map((skill) => (
                <Bullet key={skill}>{skill}</Bullet>
              ))}
            </Card>
          </View>

          <View style={styles.column}>
            <Card title="Achievements">
              {achievements.map((achievement, index) => (
                <View key={achievement.title} wrap={false}>
                  {index > 0 ? <View style={styles.divider} /> : null}
                  <Text style={styles.itemTitle}>{achievement.title}</Text>
                  <Text style={styles.itemMeta}>{achievement.description}</Text>
                  {achievement.period ? (
                    <Text style={[styles.chip, styles.chipTertiary, { alignSelf: "flex-start" }]}>
                      {achievement.period.toUpperCase()}
                    </Text>
                  ) : null}
                </View>
              ))}
            </Card>

            {organizations.length ? (
              <Card title="Organizations">
                {organizations.map((organization, index) => (
                  <View key={`${organization.title}-${organization.period}`} wrap={false}>
                    {index > 0 ? <View style={styles.divider} /> : null}
                    <Text style={styles.itemTitle}>{organization.title}</Text>
                    {organization.description ? (
                      <Text style={styles.itemMeta}>{organization.description}</Text>
                    ) : null}
                    <Text style={[styles.chip, styles.chipTertiary, { alignSelf: "flex-start" }]}>
                      {organization.period.toUpperCase()}
                    </Text>
                  </View>
                ))}
              </Card>
            ) : null}

            <Card title="Certifications">
              {certificationGroups.map(([groupName, items], groupIndex) => (
                <View key={groupName} wrap={false}>
                  {groupIndex > 0 ? <View style={styles.divider} /> : null}
                  <Text style={styles.groupLabel}>{groupName.toUpperCase()}</Text>
                  {items.map((certification) => (
                    <View key={`${groupName}-${certification.title}`} style={{ marginBottom: 2.5 }}>
                      <Text style={styles.itemTitle}>{certification.title}</Text>
                      {certification.period ? (
                        <Text style={styles.itemMeta}>{certification.period}</Text>
                      ) : null}
                      {certification.link ? (
                        <Link src={certification.link} style={styles.link}>
                          View certificate
                        </Link>
                      ) : null}
                    </View>
                  ))}
                </View>
              ))}
            </Card>
          </View>
        </View>

        {/* Experience */}
        <Card title="Experiences" subtitle={SECTION_COPY.experiences} tone="primary">
          {experiences.map((experience, index) => (
            <View key={`${experience.company}-${experience.period}`} wrap={false}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <View style={styles.chipRow}>
                <Text style={[styles.chip, styles.chipTertiary]}>
                  {experience.period.toUpperCase()}
                </Text>
                <Text style={styles.badge}>{experience.role.toUpperCase()}</Text>
                <Text style={[styles.chip, { borderColor: "#ffffff" }]}>
                  ({experience.timing.toUpperCase()})
                </Text>
              </View>
              <Text
                style={[
                  styles.itemTitle,
                  { fontSize: 9, lineHeight: 1.25, fontWeight: 800, marginTop: 3 },
                ]}
              >
                {experience.company.toUpperCase()}
              </Text>
              <View style={{ marginTop: 3 }}>
                {experience.description.map((line) => (
                  <Bullet key={line}>{line}</Bullet>
                ))}
              </View>
            </View>
          ))}
        </Card>

        {/* Tech stack */}
        <Card title="Tech Stack" subtitle={SECTION_COPY.techStack} tone="primary">
          {techStackGroups.map(([groupName, stacks]) => (
            <View key={groupName} style={{ marginBottom: 5 }} wrap={false}>
              <Text style={styles.groupLabel}>{groupName.toUpperCase()}</Text>
              {stacks.map((stack) => (
                <View key={`${groupName}-${stack.category}`} style={{ marginBottom: 2.5 }}>
                  <Text style={[styles.chip, styles.chipTertiary, { alignSelf: "flex-start" }]}>
                    {stack.category.toUpperCase()}
                  </Text>
                  <Text style={{ marginTop: 1.5 }}>{stack.items}</Text>
                </View>
              ))}
            </View>
          ))}
        </Card>

        {/* Portfolio */}
        <Card title="Portfolio" subtitle={SECTION_COPY.portfolio} tone="primary">
          {portfolioItems.map((item, index) => (
            <View key={`${item.title}-${item.year}`} wrap={false}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <Text style={[styles.itemTitle, { letterSpacing: 0.4 }]}>
                {item.title.toUpperCase()}
              </Text>
              <Text style={{ marginTop: 1.5 }}>{item.description}</Text>
              {item.link ? <Text style={styles.itemMeta}>{item.link}</Text> : null}
            </View>
          ))}
        </Card>

        <Text style={styles.footer}>
          {`UPDATED ${formatDate(RESUME_CONFIG.updatedAt).toUpperCase()} - ${SITE_HOST.toUpperCase()}`}
        </Text>
      </Page>
    </Document>
  )
}
