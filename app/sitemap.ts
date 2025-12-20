import { MetadataRoute } from 'next'
import { createClient } from '@/utils/supabase/server'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://gatepass.so'
    const supabase = await createClient()

    // Base routes
    const routes = [
        '',
        '/login',
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 1,
    }))

    // Fetch Published Events
    const { data: events } = await supabase
        .schema('gatepass')
        .from('events')
        .select('slug, updated_at')
        .eq('is_published', true)

    const eventRoutes = events?.map((event) => ({
        url: `${baseUrl}/events/${event.slug}`,
        lastModified: new Date(event.updated_at),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
    })) || []

    return [...routes, ...eventRoutes]
}
