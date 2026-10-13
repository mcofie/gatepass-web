<script setup lang="ts">
const { data } = useGatePassEvent('99-problems')
const log = ref<string[]>([])
useGatePassListener('*', e => log.value.push(e.type))
</script>

<template>
    <main style="font-family: system-ui; padding: 24px; background: #f5f0ff; min-height: 100vh">
        <h2>{{ data ? `${data.title} · ${data.tickets.length} ticket types (Nuxt)` : 'Loading…' }}</h2>
        <pre>events: {{ log.join(', ') }}</pre>
        <GatePassButton event="99-problems">Buy tickets</GatePassButton>
        <div style="margin-top: 16px"><GatePassWidget event="99-problems" referral="nuxt-sdk" /></div>
    </main>
</template>
