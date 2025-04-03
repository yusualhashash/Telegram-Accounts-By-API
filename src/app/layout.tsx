import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { AuthProvider } from "../../lib/auth-context"


export const metadata: Metadata = {
  title: "Telegram Manager",
  description: "Manage your Telegram accounts",
  generator: "v0.dev",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}

