"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  Home,
  CalendarDays,
  Trophy,
  Banknote,
  Users,
  BookOpen,
  Images,
  Timer,
  Menu,
  X,
  ClipboardList,
} from "lucide-react"
import { cn } from "@/lib/utils"

const links = [
  { href: "/", label: "Hem", icon: Home },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/spelschema", label: "Spelschema", icon: CalendarDays },
  { href: "/boter", label: "Böteskassa", icon: Banknote },
  { href: "/spelare", label: "Spelare", icon: Users },
  { href: "/bilder", label: "Bilder", icon: Images },
  { href: "/countdown", label: "Countdown", icon: Timer },
  { href: "/historia", label: "Historia & Info", icon: BookOpen },
]

export function Navigation() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-3 whitespace-nowrap">
          <img src="/images/logo.png" alt="Odds on Tour" className="h-10 w-auto" />
          <span className="text-lg font-bold tracking-tight text-foreground">Odds on Tour</span>
        </Link>

        {/* Desktop */}
        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((link) => {
            const Icon = link.icon
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* Mobile toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-lg p-2 text-muted-foreground hover:bg-secondary md:hidden"
          aria-label={mobileOpen ? "Stäng meny" : "Öppna meny"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile */}
      {mobileOpen && (
        <nav className="border-t border-border bg-card px-4 pb-4 md:hidden">
          {links.map((link) => {
            const Icon = link.icon
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            )
          })}
        </nav>
      )}
    </header>
  )
}
