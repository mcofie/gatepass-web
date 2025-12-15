import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { NavBar } from '@/components/common/NavBar'
import { Footer } from '@/components/common/Footer'

import { ToastProvider } from '@/components/ui/Toast'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
    title: 'Gatepass',
    description: 'Top tier ticketing platform.',
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html lang="en">
            <body className={`${inter.variable} font-sans antialiased`}>
                <ToastProvider>
                    <NavBar />
                    <main className="min-h-screen">
                        {children}
                    </main>
                    <Footer />
                </ToastProvider>
            </body>
        </html>
    )
}
