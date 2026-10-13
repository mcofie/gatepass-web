import { PaymentWaitClient } from './PaymentWaitClient'

export const metadata = { title: 'Approve payment · GatePass' }

export default async function PaymentWaitPage({ params, searchParams }: {
    params: Promise<{ reference: string }>
    searchParams: Promise<{ return?: string }>
}) {
    const { reference } = await params
    const { return: returnUrl } = await searchParams
    return <PaymentWaitClient reference={reference} returnUrl={returnUrl ?? '/'} />
}
