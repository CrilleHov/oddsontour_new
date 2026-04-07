import Image from "next/image"
import Link from "next/link"
import type { ComponentType } from "react"

import { Card, CardContent } from "@/components/ui/card"
import { Instagram, Trophy, CalendarDays, Banknote, Images, Timer, Users, Settings, BookOpen } from "lucide-react"

export default function HomePage() {
  return (
    <div className="flex flex-col gap-8">
      {/* Hero */}
      <section className="flex flex-col items-center gap-4 pt-4 text-center">
        <div className="rounded-2xl bg-card p-4 ring-1 ring-border shadow-sm">
          <div className="relative h-32 w-48">
            <Image
              src="/images/logo.png"
              alt="Odds on Tour logotyp"
              fill
              className="object-contain '[filter:contrast(1.6)_brightness(0.75)_drop-shadow(0px_2px_2px_rgba(0,0,0,0.25))]'"
              priority
            />
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground text-balance">Odds on Tour</h1>
          <p className="mt-1 text-muted-foreground">Race to Sand 2026</p>
        </div>

        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Välkomna till en ny rafflande upplaga av Odds on Tour. Under året kör vi flera deltävlingar där poäng samlas
          ihop inför finalen där allt ska avgöras.
        </p>

        <div className="flex items-center justify-center gap-3">
          <a
            href="https://www.instagram.com/oddsontour/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
          >
            <Instagram className="h-4 w-4" />
            Instagram
          </a>
        
          <a
            href="https://www.tiktok.com/@oddsontour"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
          >
            TikTok
          </a>
        </div>
      </section>

      {/* Quick links */}
      <section className="grid gap-4 sm:grid-cols-2">
        <QuickLink href="/leaderboard" icon={Trophy} title="Leaderboard" desc="Poängställning och utveckling" />
        <QuickLink href="/spelschema" icon={CalendarDays} title="Spelschema" desc="Deltävlingar per år" />
        <QuickLink href="/boter" icon={Banknote} title="Böteskassa" desc="Böter, total och per spelare" />
        <QuickLink href="/bilder" icon={Images} title="Bilder" desc="Lagbilder och minnen" />
        <QuickLink href="/countdown" icon={Timer} title="Countdown" desc="Nedräkning till finalen" />
        <QuickLink href="/spelare" icon={Users} title="Spelare" desc="Aktiva + historiska" />
        <QuickLink href="/historia" icon={BookOpen} title="Historia & Info" desc="Historiska vinnare och ansvarsområden" />
      </section>
    </div>
  )
}

function QuickLink({
  href,
  icon: Icon,
  title,
  desc,
}: {
  href: string
  icon: ComponentType<{ className?: string }>
  title: string
  desc: string
}) {
  return (
    <Link href={href} className="group">
      <Card className="transition-colors group-hover:bg-secondary/40">
        <CardContent className="flex items-start gap-3 py-5">
          <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-foreground">{title}</div>
            <div className="text-sm text-muted-foreground">{desc}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
