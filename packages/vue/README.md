# @gatepass/vue

GatePass ticket checkout for Vue 3.

```sh
npm install @gatepass/vue
```

```ts
import { createApp } from 'vue'
import GatePass from '@gatepass/vue'

createApp(App).use(GatePass).mount('#app') // registers <GatePassWidget> and <GatePassButton>
```

```vue
<script setup>
import { useGatePassEvent, useGatePassListener } from '@gatepass/vue'
const { data: event } = useGatePassEvent('your-event')
useGatePassListener('checkout_started', e => console.log(e.detail))
</script>

<template>
  <h2>{{ event?.title }}</h2>
  <GatePassWidget event="your-event" />
  <GatePassButton event="your-event" theme="dark">Buy tickets</GatePassButton>
</template>
```

Props: `event`, `theme`, `view="tickets"`, `referral`.
