import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
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

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

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

        // 2. Load Certificates (Priority: File System (Dev) -> Supabase Storage (Prod))
        let signerCert: Buffer, signerKey: Buffer, wwdr: Buffer;

        const certPath = path.resolve(process.cwd(), 'certs')
        const hasLocalCerts = fs.existsSync(path.join(certPath, 'signerCert.pem'))

        if (hasLocalCerts) {
            console.log('Loading Apple Wallet certificates from Local Filesystem')
            signerCert = fs.readFileSync(path.join(certPath, 'signerCert.pem'))
            signerKey = fs.readFileSync(path.join(certPath, 'signerKey.pem'))
            wwdr = fs.readFileSync(path.join(certPath, 'wwdr.pem'))
        } else {
            console.log('Loading Apple Wallet certificates from Supabase Storage (certificates bucket)')
            // Fetch from Supabase Storage
            const [certData, keyData, wwdrData] = await Promise.all([
                supabase.storage.from('certificates').download('signerCert.pem'),
                supabase.storage.from('certificates').download('signerKey.pem'),
                supabase.storage.from('certificates').download('wwdr.pem')
            ])

            if (certData.error || keyData.error || wwdrData.error) {
                console.error('Storage Download Error:', certData.error || keyData.error || wwdrData.error)
                return NextResponse.json({
                    error: 'Server Misconfiguration: Missing Certificates. Please upload .pem files to "certificates" bucket in Supabase OR add to /certs locally.'
                }, { status: 501 })
            }

            signerCert = Buffer.from(await certData.data.arrayBuffer())
            signerKey = Buffer.from(await keyData.data.arrayBuffer())
            wwdr = Buffer.from(await wwdrData.data.arrayBuffer())
        }

        // 3. Create Pass (Requires Certificates)
        const pass = new PKPass({}, {
            signerCert,
            signerKey,
            wwdr
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
        return new NextResponse(buffer as any, {
            headers: {
                'Content-Type': 'application/vnd.apple.pkpass',
                'Content-Disposition': `attachment; filename="${event.title.replace(/[^a-z0-9]/gi, '_')}.pkpass"`
            }
        })

    } catch (error: any) {
        console.error('Wallet Generation Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
