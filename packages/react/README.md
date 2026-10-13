# @gatepass/react

GatePass ticket checkout for React and Next.js (App Router ready).

```sh
npm install @gatepass/react
```

```tsx
import { GatePassWidget, GatePassButton, useGatePassEvent, useGatePassListener } from '@gatepass/react'

export function Tickets() {
  const { data: event } = useGatePassEvent('your-event')
  useGatePassListener('checkout_started', e => analytics.track('checkout', e.detail))

  return (
    <>
      <h2>{event?.title}</h2>
      <GatePassWidget event="your-event" />                 {/* inline, sizes itself */}
      <GatePassButton event="your-event" theme="dark" className="btn">Buy tickets</GatePassButton>
    </>
  )
}
```

Props: `event` (slug), `theme`, `view="tickets"`, `referral` (shows as a source in Marketing).
Wrap your app in `<GatePassProvider origin="...">` only to point at a non-production GatePass.
