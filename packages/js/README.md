# @gatepass/js

Add GatePass ticket checkout to any website, and read public event data.

```sh
npm install @gatepass/js
```

```ts
import { openCheckout, onGatePassEvent, getEvent } from '@gatepass/js'

// Open checkout in a pop-up over your page
button.addEventListener('click', () => openCheckout('your-event', { theme: 'dark' }))

// Track checkouts in your analytics
onGatePassEvent('checkout_started', e => console.log(e.detail)) // { event, amount, currency, tickets }

// Event data: title, dates, venue, ticket prices and availability
const event = await getEvent('your-event')
```

For an inline widget, render `<div data-gatepass-event="your-event"></div>` and call `loadGatePass()`.
Options: `theme` (`'light' | 'dark'`), `view: 'tickets'` (open on ticket selection), `ref` (a referral tag that shows in your Marketing page).

No package needed? Paste this anywhere:

```html
<div data-gatepass-event="your-event"></div>
<script src="https://gatepass.so/embed.js" async></script>
```
