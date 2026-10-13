# @gatepass/nuxt

GatePass ticket checkout for Nuxt 3. Components and composables are auto-imported; checkout renders client-side.

```sh
npm install @gatepass/nuxt
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@gatepass/nuxt'],
})
```

```vue
<script setup>
const { data: event } = useGatePassEvent('your-event')
</script>

<template>
  <GatePassWidget event="your-event" />
  <GatePassButton event="your-event">Buy tickets</GatePassButton>
</template>
```

Auto-imported: `GatePassWidget`, `GatePassButton`, `useGatePassEvent`, `useGatePassListener`, `openCheckout`.
