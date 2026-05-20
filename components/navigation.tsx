"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import {
  Banknote,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Home,
  Images,
  MapPin,
  Menu,
  MoreHorizontal,
  Swords,
  Timer,
  Trophy,
  Users,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

const mainLinks = [
  { href: "/", label: "Hem", icon: Home },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/spelschema", label: "Spelschema", icon: CalendarDays },
  { href: "/boter", label: "Böteskassa", icon: Banknote },
  { href: "/spelare", label: "Spelare", icon: Users },
  { href: "/banor", label: "Banstatistik", icon: MapPin },
  { href: "/hth", label: "Head-to-Head", icon: Swords },
]

const moreLinks = [
  { href: "/bilder", label: "Bilder", icon: Images },
  { href: "/countdown", label: "Countdown", icon: Timer },
  { href: "/historia", label: "Historia & Info", icon: BookOpen },
]

const mobileLinks = [...mainLinks, ...moreLinks]

export function Navigation() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const moreIsActive = useMemo(
    () => moreLinks.some((link) => pathname === link.href),
    [pathname]
  )

  useEffect(() => {
    setMobileOpen(false)
    setMoreOpen(false)
  }, [pathname])

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className="relative h-10 w-14 overflow-hidden rounded-xl bg-card p-1 ring-1 ring-border">
            <Image
              src="/images/logo.png"
              alt="Odds on Tour"
              fill
              className="object-contain"
              priority
            />
          </div>

          <div className="hidden leading-tight sm:block">
            <div className="font-extrabold tracking-tight text-foreground">
              Odds on Tour
            </div>
            <div className="text-xs text-muted-foreground">
              Race to Sand
            </div>
          </div>
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden items-center gap-1 md:flex">
          {mainLinks.map((link) => {
            const Icon = link.icon
            const isActive = pathname === link.href

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            )
          })}

          {/* More dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              onBlur={() => {
                window.setTimeout(() => setMoreOpen(false), 150)
              }}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition-colors",
                moreIsActive || moreOpen
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
              )}
            >
              <MoreHorizontal className="h-4 w-4" />
              Mer
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  moreOpen && "rotate-180"
                )}
              />
            </button>

            {moreOpen && (
              <div className="absolute right-0 top-12 w-64 overflow-hidden rounded-2xl border border-border bg-popover p-2 shadow-xl">
                <div className="mb-1 px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Fler sidor
                </div>

                <div className="flex flex-col gap-1">
                  {moreLinks.map((link) => {
                    const Icon = link.icon
                    const isActive = pathname === link.href

                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-popover-foreground hover:bg-secondary hover:text-secondary-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {link.label}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-xl p-2 text-muted-foreground hover:bg-secondary md:hidden"
          aria-label={mobileOpen ? "Stäng meny" : "Öppna meny"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile navigation */}
      {mobileOpen && (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 sm:px-6">
            {mobileLinks.map((link) => {
              const Icon = link.icon
              const isActive = pathname === link.href

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
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
        </div>
      )}
    </header>
  )
}
