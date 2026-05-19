import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Navigation } from "@/components/navigation"
import { Toaster } from "sonner"
import "./globals.css"

const _inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "Odds on Tour",
  description: "Leaderboard, spelschema, böter och historik för Odds on Tour.",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="sv">
      <body className="font-sans antialiased">
        <Navigation />
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        <Toaster richColors position="top-center" />
        <Analytics />
      </body>
    </html>
  )
}
