import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from "@/components/providers/theme-provider"
import { LayoutShell } from '@/components/layouts/LayoutShell'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://gatepass.so'),
    title: {
        template: '%s | GatePass',
        default: 'GatePass | Experience Curated Events',
    },
    description: 'The premium platform for modern experiences and exclusive event reservations.',
    openGraph: {
        siteName: 'GatePass',
        type: 'website',
        locale: 'en_US',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'GatePass',
    },
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${inter.variable} font-sans antialiased`}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    <LayoutShell>
                        {children}
                    </LayoutShell>
                    <Toaster position="bottom-right" />
                </ThemeProvider>
            </body>
        </html>
    )
}
