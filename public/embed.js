/*!
 * GatePass embed loader
 *
 * Inline widget:  <div data-gatepass-event="your-event"></div>
 * Button:         <button data-gatepass-button="your-event">Buy tickets</button>
 * Options (data-*): theme="light|dark", view="tickets", ref="your-campaign"
 *
 * JavaScript:     GatePass.open('your-event', { theme: 'dark' })
 *                 GatePass.on('purchase_completed', function (e) { ... })
 * DOM events:     window.addEventListener('gatepass:checkout_started', function (e) { e.detail })
 */
(function () {
    'use strict'
    if (window.GatePass && window.GatePass.__loaded) {
        window.GatePass.mount()
        return
    }

    var script = document.currentScript
    var ORIGIN = (function () {
        try { return new URL(script && script.src ? script.src : '/embed.js', window.location.href).origin } catch { return 'https://gatepass.so' }
    })()
    var listeners = {}
    var frames = [] // { iframe, autosize }
    var modal = null

    function embedUrl(slug, opts, mode) {
        var params = new URLSearchParams()
        if (opts.theme === 'dark') params.set('theme', 'dark')
        if (opts.view === 'tickets' || mode === 'modal') params.set('view', 'tickets')
        if (opts.ref) params.set('ref', opts.ref)
        params.set('autosize', '1')
        params.set('host', window.location.hostname)
        return ORIGIN + '/embed/' + encodeURIComponent(slug) + '?' + params.toString()
    }

    function optionsFrom(el) {
        return { theme: el.getAttribute('data-theme') || undefined, view: el.getAttribute('data-view') || undefined, ref: el.getAttribute('data-ref') || undefined }
    }

    function createFrame(slug, opts, mode) {
        var iframe = document.createElement('iframe')
        iframe.src = embedUrl(slug, opts, mode)
        iframe.title = 'Tickets'
        iframe.loading = mode === 'modal' ? 'eager' : 'lazy'
        iframe.setAttribute('allow', 'payment; clipboard-write')
        iframe.style.cssText = 'display:block;width:100%;border:0;background:transparent;color-scheme:normal;' +
            (mode === 'modal' ? 'height:100%;' : 'height:640px;max-width:520px;margin:0 auto;border-radius:24px;overflow:hidden;transition:height .2s ease;')
        frames.push({ iframe: iframe, autosize: mode !== 'modal' })
        return iframe
    }

    /* Inline widgets */
    function mount(root) {
        var scope = root || document
        var nodes = scope.querySelectorAll('[data-gatepass-event]:not([data-gatepass-mounted])')
        for (var i = 0; i < nodes.length; i++) {
            var el = nodes[i]
            el.setAttribute('data-gatepass-mounted', 'true')
            el.innerHTML = ''
            el.appendChild(createFrame(el.getAttribute('data-gatepass-event'), optionsFrom(el), 'inline'))
        }
        var buttons = scope.querySelectorAll('[data-gatepass-button]:not([data-gatepass-mounted])')
        for (var j = 0; j < buttons.length; j++) {
            (function (btn) {
                btn.setAttribute('data-gatepass-mounted', 'true')
                btn.addEventListener('click', function (e) {
                    e.preventDefault()
                    open(btn.getAttribute('data-gatepass-button'), optionsFrom(btn))
                })
            })(buttons[j])
        }
    }

    /* Pop-up checkout */
    function open(slug, opts) {
        if (!slug) return
        close()
        opts = opts || {}
        var previousFocus = document.activeElement
        var previousOverflow = document.documentElement.style.overflow

        var overlay = document.createElement('div')
        overlay.setAttribute('role', 'dialog')
        overlay.setAttribute('aria-modal', 'true')
        overlay.setAttribute('aria-label', 'Buy tickets')
        overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;display:flex;align-items:flex-end;justify-content:center;' +
            'background:rgba(0,0,0,.55);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);opacity:0;transition:opacity .2s ease;'

        var wide = window.matchMedia('(min-width: 640px)').matches
        // The close button sits above the panel so it never covers the widget's own controls
        var wrap = document.createElement('div')
        wrap.style.cssText = 'position:relative;width:100%;max-width:440px;' + (wide ? 'margin:auto;' : '') +
            'transform:translateY(16px);transition:transform .25s cubic-bezier(.32,.72,0,1);'

        var panel = document.createElement('div')
        panel.style.cssText = 'width:100%;height:' + (wide ? 'min(760px,calc(100vh - 96px))' : 'calc(100vh - 64px)') + ';' +
            'background:' + (opts.theme === 'dark' ? '#18181b' : '#fff') + ';overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.35);' +
            (wide ? 'border-radius:28px;' : 'border-radius:24px 24px 0 0;')

        var closeBtn = document.createElement('button')
        closeBtn.type = 'button'
        closeBtn.setAttribute('aria-label', 'Close')
        closeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
        closeBtn.style.cssText = 'position:absolute;top:-48px;right:' + (wide ? '0' : '12px') + ';width:36px;height:36px;border:0;border-radius:999px;cursor:pointer;' +
            'display:flex;align-items:center;justify-content:center;padding:0;background:#fff;color:#111;box-shadow:0 4px 16px rgba(0,0,0,.2);'
        closeBtn.addEventListener('click', close)

        panel.appendChild(createFrame(slug, opts, 'modal'))
        wrap.appendChild(panel)
        wrap.appendChild(closeBtn)
        overlay.appendChild(wrap)
        overlay.addEventListener('click', function (e) { if (e.target === overlay) close() })
        document.body.appendChild(overlay)
        document.documentElement.style.overflow = 'hidden'
        requestAnimationFrame(function () { overlay.style.opacity = '1'; wrap.style.transform = 'none' })
        closeBtn.focus()

        modal = { overlay: overlay, previousFocus: previousFocus, previousOverflow: previousOverflow, slug: slug }
        emit('open', { event: slug })
    }

    function close() {
        if (!modal) return
        var current = modal
        modal = null
        frames = frames.filter(function (f) { return current.overlay.contains(f.iframe) === false })
        current.overlay.remove()
        document.documentElement.style.overflow = current.previousOverflow
        if (current.previousFocus && current.previousFocus.focus) current.previousFocus.focus()
        emit('close', { event: current.slug })
    }

    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal) close() })

    /* Messages from the embed */
    window.addEventListener('message', function (e) {
        if (e.origin !== ORIGIN || !e.data || e.data.source !== 'gatepass') return
        var frame = null
        for (var i = 0; i < frames.length; i++) if (frames[i].iframe.contentWindow === e.source) frame = frames[i]
        if (!frame) return
        if (e.data.type === 'resize') {
            if (frame.autosize && e.data.height > 0) frame.iframe.style.height = Math.ceil(e.data.height) + 'px'
            return
        }
        var detail = {}
        for (var key in e.data) if (key !== 'source' && key !== 'type') detail[key] = e.data[key]
        emit(e.data.type, detail)
    })

    function emit(type, detail) {
        var handlers = (listeners[type] || []).concat(listeners['*'] || [])
        for (var i = 0; i < handlers.length; i++) {
            try { handlers[i]({ type: type, detail: detail }) } catch (err) { console.error('[GatePass]', err) }
        }
        try { window.dispatchEvent(new CustomEvent('gatepass:' + type, { detail: detail })) } catch { /* very old browsers */ }
    }

    function on(type, handler) {
        (listeners[type] = listeners[type] || []).push(handler)
        return function off() { listeners[type] = (listeners[type] || []).filter(function (h) { return h !== handler }) }
    }

    window.GatePass = { __loaded: true, origin: ORIGIN, mount: mount, open: open, close: close, on: on }

    // Pages that render content later (Webflow interactions, SPAs) get mounted as nodes appear
    function start() {
        mount()
        if (window.MutationObserver) {
            new MutationObserver(function () { mount() }).observe(document.body, { childList: true, subtree: true })
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
    else start()
})()
