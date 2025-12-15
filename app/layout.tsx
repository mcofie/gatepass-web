import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { NavBar } from '@/components/common/NavBar'
import { Footer } from '@/components/common/Footer'

import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
    title: {
        template: '%s | GatePass',
        default: 'GatePass | Experience Curated Events',
    },
    description: 'The premium platform for modern experiences and exclusive event reservations.',
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html lang="en">
            <body className={`${inter.variable} font-sans antialiased`}>
                <NavBar />
                <main className="min-h-screen">
                    {children}
                </main>
                <Footer />
                <Toaster position="bottom-right" />
            </body>
        </html>
    )
}
