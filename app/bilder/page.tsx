import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Images } from "lucide-react"

const PHOTOS = [
  { src: "/images/bild1.jpg", alt: "Lagbild 1" },
  { src: "/images/bild2.jpeg", alt: "Lagbild 2" },
  { src: "/images/bild3.jpeg", alt: "Lagbild 3" },
  { src: "/images/bild4.jpeg", alt: "Lagbild 3" },
  { src: "/images/bild5.jpg", alt: "Lagbild 3" },
  { src: "/images/bild6.jpg", alt: "Lagbild 3" },
  // Lägg till fler...
]

export default function BilderPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">Bilder</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Images className="h-5 w-5 text-primary" />
            Galleri
          </CardTitle>
        </CardHeader>

        <CardContent>
          {PHOTOS.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Lägg in bilder i <code className="rounded bg-secondary px-1">public/images/photos</code> och uppdatera listan PHOTOS.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PHOTOS.map((p) => (
                <a
                  key={p.src}
                  href={p.src}
                  target="_blank"
                  rel="noreferrer"
                  className="group overflow-hidden rounded-xl border bg-card"
                >
                  <div className="relative aspect-[4/3]">
                    <Image
                      src={p.src}
                      alt={p.alt}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      priority={false}
                    />
                  </div>
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    {p.alt}
                  </div>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}