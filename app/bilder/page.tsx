import Image from "next/image"
import Link from "next/link"
import type { ComponentType, ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ArrowRight,
  Camera,
  Grid3X3,
  Images,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react"

const PHOTOS = [
  { src: "/images/bild1.jpg", alt: "Odds on Tour bild 1" },
  { src: "/images/bild2.jpeg", alt: "Odds on Tour bild 2" },
  { src: "/images/bild3.jpeg", alt: "Odds on Tour bild 3" },
  { src: "/images/bild4.jpeg", alt: "Odds on Tour bild 4" },
  { src: "/images/bild5.jpg", alt: "Odds on Tour bild 5" },
  { src: "/images/bild6.jpg", alt: "Odds on Tour bild 6" },
]

function getPhotoClass(index: number) {
  if (index === 0) {
    return "md:col-span-2 md:row-span-2"
  }

  if (index === 3) {
    return "md:col-span-2"
  }

  return ""
}

export default function BilderPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/10" />
        <div className="absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-secondary/70" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Tour memories
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Bilder
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Samlade bilder från Odds on Tour. Lagbilder, tävlingsminnen och
              ögonblick från säsongerna.
            </p>
          </div>

          <Link
            href="/historia"
            className="inline-flex w-fit items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground hover:bg-secondary/80"
          >
            Se historik
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Bilder"
          value={`${PHOTOS.length} st`}
          sub="Uppladdade i galleriet"
          icon={Images}
        />

        <StatCard
          title="Galleri"
          value="Odds on Tour"
          sub="Bilder från touren"
          icon={Camera}
        />

        <StatCard
          title="Kategori"
          value="Minnen"
          sub="Lagbilder och tävlingar"
          icon={Users}
        />

        <StatCard
          title="Status"
          value={PHOTOS.length > 0 ? "Aktivt" : "Tomt"}
          sub={PHOTOS.length > 0 ? "Bilder hittades" : "Inga bilder hittades"}
          icon={Trophy}
        />
      </section>

      {/* Gallery */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Grid3X3 className="h-5 w-5 text-primary" />
            Galleri
          </CardTitle>
        </CardHeader>

        <CardContent>
          {PHOTOS.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid auto-rows-[230px] gap-4 md:grid-cols-3 xl:grid-cols-4">
              {PHOTOS.map((photo, index) => (
                <div
                  key={photo.src}
                  className={`group relative overflow-hidden rounded-2xl border border-border bg-secondary shadow-sm ${getPhotoClass(
                    index
                  )}`}
                >
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    fill
                    sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"
                    className="object-cover transition duration-300 group-hover:scale-105"
                    priority={index === 0}
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-background/20 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
}: {
  title: string
  value: ReactNode
  sub: string
  icon: ComponentType<{ className?: string }>
}) {
  return (
    <Card>
      <CardContent className="flex h-full flex-col justify-between gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-muted-foreground">
            {title}
          </div>

          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        </div>

        <div>
          <div className="text-2xl font-extrabold tracking-tight text-foreground">
            {value}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">{sub}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border p-10 text-center">
      <div className="rounded-full bg-secondary p-4">
        <Images className="h-8 w-8 text-muted-foreground" />
      </div>

      <div>
        <div className="text-lg font-bold text-foreground">
          Inga bilder hittades
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Lägg bilder i public/images och uppdatera listan PHOTOS.
        </p>
      </div>
    </div>
  )
}
