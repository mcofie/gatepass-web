'use client'

import React, { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import Script from 'next/script'

interface TrackingScriptsProps {
    metaPixelId?: string
    ga4Id?: string
}

export function TrackingScripts({ metaPixelId, ga4Id }: TrackingScriptsProps) {
    const pathname = usePathname()
    const searchParams = useSearchParams()

    // track PageViews
    useEffect(() => {
        if (!window) return

        // Meta Pixel PageView
        if (metaPixelId && (window as any).fbq) {
            (window as any).fbq('track', 'PageView')
        }

        // GA4 PageView (usually handled automatically by gtag config, but good to be explicit for SPAs)
        if (ga4Id && (window as any).gtag) {
            (window as any).gtag('config', ga4Id, {
                page_path: pathname + searchParams.toString(),
            })
        }
    }, [pathname, searchParams, metaPixelId, ga4Id])

    return (
        <>
            {/* Meta Pixel Code */}
            {metaPixelId && (
                <>
                    <Script
                        id="fb-pixel"
                        strategy="afterInteractive"
                        dangerouslySetInnerHTML={{
                            __html: `
                                !function(f,b,e,v,n,t,s)
                                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                                n.queue=[];t=b.createElement(e);t.async=!0;
                                t.src=v;s=b.getElementsByTagName(e)[0];
                                s.parentNode.insertBefore(t,s)}(window, document,'script',
                                'https://connect.facebook.net/en_US/fbevents.js');
                                fbq('init', '${metaPixelId}');
                                fbq('track', 'PageView');
                            `,
                        }}
                    />
                    <noscript>
                        <img
                            height="1"
                            width="1"
                            style={{ display: 'none' }}
                            src={`https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`}
                        />
                    </noscript>
                </>
            )}

            {/* Google Analytics 4 Code */}
            {ga4Id && (
                <>
                    <Script
                        strategy="afterInteractive"
                        src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
                    />
                    <Script
                        id="ga4-script"
                        strategy="afterInteractive"
                        dangerouslySetInnerHTML={{
                            __html: `
                                window.dataLayer = window.dataLayer || [];
                                function gtag(){dataLayer.push(arguments);}
                                gtag('js', new Date());
                                gtag('config', '${ga4Id}');
                            `,
                        }}
                    />
                </>
            )}
        </>
    )
}

// Global function to trigger events from anywhere in the client
export const trackConversion = (amount: number, currency: string = 'GHS', conversionId: string) => {
    if (typeof window === 'undefined') return

    // Meta Pixel Purchase
    if ((window as any).fbq) {
        (window as any).fbq('track', 'Purchase', {
            value: amount,
            currency: currency,
            content_ids: [conversionId],
            content_type: 'product'
        })
    }

    // GA4 Purchase
    if ((window as any).gtag) {
        (window as any).gtag('event', 'purchase', {
            transaction_id: conversionId,
            value: amount,
            currency: currency,
            items: [{
                item_id: conversionId,
                item_name: 'Ticket Purchase',
                price: amount,
                quantity: 1
            }]
        })
    }
}
