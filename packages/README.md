# GatePass SDKs

| Package | For |
|---|---|
| [`@gatepass/js`](./js) | Any site or framework. Loads checkout, opens it from code, reads public event data. |
| [`@gatepass/react`](./react) | React and Next.js |
| [`@gatepass/vue`](./vue) | Vue 3 |
| [`@gatepass/nuxt`](./nuxt) | Nuxt 3 (auto-imported components and composables) |

All of them load `https://gatepass.so/embed.js`, so checkout fixes ship without anyone upgrading a package.

## Publishing

Publish in dependency order. The first time, create the `gatepass` organization on npmjs.com and run `npm login`.

```sh
cd packages/js    && npm install && npm run build && npm publish --access public
cd ../react       && npm install && npm run build && npm publish --access public
cd ../vue         && npm install && npm run build && npm publish --access public
cd ../nuxt        && npm install && npm run build && npm publish --access public
```

To work on `react`, `vue` or `nuxt` before `@gatepass/js` is published, link the local build:
`npm install --no-save ../js` (and `../vue` for nuxt).

`nuxt/playground` is a small Nuxt app for trying the module: `npx nuxi dev playground`.
