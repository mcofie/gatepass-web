import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/client'
import { PKPass } from 'passkit-generator'
import path from 'path'
import fs from 'fs'

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const ticketId = searchParams.get('ticketId')

        if (!ticketId) {
            return NextResponse.json({ error: 'Missing ticketId' }, { status: 400 })
        }

        const supabase = createClient()

        // 1. Fetch Ticket & Event Details
        const { data: ticket, error } = await supabase
            .schema('gatepass')
            .from('tickets')
            .select('*, reservations(*, events(*), ticket_tiers(*), profiles(*))')
            .eq('id', ticketId)
            .single()

        if (error || !ticket) {
            console.error('Ticket Fetch Error:', error)
            return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
        }

        const event = ticket.reservations?.events
        const tier = ticket.reservations?.ticket_tiers
        const profile = ticket.reservations?.profiles

        if (!event || !tier) {
            return NextResponse.json({ error: 'Incomplete event data' }, { status: 500 })
        }

        // 2. Load Certificates (Mocking checking for existence)
        // In production, these should be secure paths or env vars
        const certPath = path.resolve(process.cwd(), 'certs')
        // const signerCert = fs.readFileSync(path.join(certPath, 'signerCert.pem'))
        // const signerKey = fs.readFileSync(path.join(certPath, 'signerKey.pem'))
        // const wwdr = fs.readFileSync(path.join(certPath, 'wwdr.pem'))

        // MOCK MODE: If certs are missing, we can't generate a valid pass.
        // For this demo, we will fail gracefully or return a mockup if possible, but passkit-generator requires keys.
        // I will assume for now we just want the CODE structure ready.

        // checking if certs exist to avoid crash
        if (!fs.existsSync(path.join(certPath, 'signerCert.pem'))) {
            console.warn('Missing Apple Certificates. Returning 501.')
            return NextResponse.json({
                error: 'Server Misconfiguration: Missing Apple Developer Certificates. Please add signerCert.pem, signerKey.pem, and wwdr.pem to /certs.'
            }, { status: 501 })
        }


        // 3. Create Pass
        // 3. Create Pass (Requires Certificates)
        /*
        const pass = new PKPass({}, {
            // signerCert,
            // signerKey,
            // wwdr
        }, {
            // bridge
        })

        // Configure Pass
        pass.type = 'eventTicket'
        pass.primaryFields.push({
            key: 'event',
            label: 'Event',
            value: event.title
        })
        pass.secondaryFields.push({
            key: 'venue',
            label: 'Venue',
            value: event.venue_name
        })
        pass.auxiliaryFields.push({
            key: 'date',
            label: 'Date',
            value: new Date(event.starts_at).toLocaleDateString(),
            dateStyle: 'PKDateStyleMedium',
            timeStyle: 'PKDateStyleShort'
        })
        pass.headerFields.push({
            key: 'tier',
            label: 'Ticket Type',
            value: tier.name
        })

        pass.setBarcodes({
            format: 'PKBarcodeFormatQR',
            message: ticket.qr_code_hash,
            messageEncoding: 'iso-8859-1'
        })

        // 4. Generate Buffer
        const buffer = pass.getAsBuffer()

        // 5. Return Stream
        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/vnd.apple.pkpass',
                'Content-Disposition': `attachment; filename="${event.title.replace(/[^a-z0-9]/gi, '_')}.pkpass"`
            }
        })
        */

        return NextResponse.json({
            error: 'Server Misconfiguration: Missing Apple Developer Certificates. Please add signerCert.pem, signerKey.pem, and wwdr.pem to /certs.'
        }, { status: 501 })

    } catch (error: any) {
        console.error('Wallet Generation Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
