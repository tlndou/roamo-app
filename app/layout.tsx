import type React from "react"
import type { Metadata } from "next"
import { Geist } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { AuthProvider } from "@/components/providers/auth-provider"
import { Header } from "@/components/layout/header"
import { OnboardingDialog } from "@/components/profile/onboarding-dialog"
import { Toaster } from "sonner"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Travel Spots - Save Your Favorite Places",
  description: "Organize and discover your favorite restaurants, cafes, and attractions around the world",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <AuthProvider>
          <Header />
          {children}
          <OnboardingDialog />
          <Toaster />
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
