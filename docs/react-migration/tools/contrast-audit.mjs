#!/usr/bin/env node
// Colour palette and WCAG 2.x contrast audit for the Vue frontend.
//
// 1. Rebuilds the Bulma 0.9 colour variables the way the app configures them: Bulma's
//    initial-variables defaults, overridden by the `$name: value;` lines at the top of
//    frontend/src/styles/main.scss, then Bulma's derived variables (findColorInvert,
//    findLightColor, findDarkColor) re-implemented here.
// 2. Collects hard-coded colours from .vue files (style blocks, inline styles, script data).
// 3. Computes WCAG 2.x contrast ratios (sRGB linearisation, relative luminance) for the
//    foreground/background pairs the UI actually uses, with pass/fail for AA normal text
//    (4.5:1), AA large text (3:1) and non-text UI (3:1, SC 1.4.11), and suggests the nearest
//    passing colour (same hue and saturation, adjusted lightness) for failures.
// 4. If the `sass` package is resolvable (it is a frontend dependency), compiles main.scss and
//    checks the derived values against the real compiled CSS. Without sass the audit still runs
//    on the re-implemented values.
//
// Run from the repo root:  node docs/react-migration/tools/contrast-audit.mjs
// Output: docs/react-migration/data/contrast-audit.json

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../../..')
const srcRoot = path.join(repoRoot, 'frontend/src')
const mainScss = path.join(srcRoot, 'styles/main.scss')
const outFile = path.join(repoRoot, 'docs/react-migration/data/contrast-audit.json')
const usageFile = path.join(repoRoot, 'docs/react-migration/data/component-usage.json')
const rel = file => path.relative(repoRoot, file).split(path.sep).join('/')

// ---------------------------------------------------------------------------------------------
// Colour maths
// ---------------------------------------------------------------------------------------------

const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

// Returns { r, g, b, a } with r/g/b in 0..255 (may be fractional) and a in 0..1.
function parseColor (input) {
  const s = String(input).trim().toLowerCase()
  if (s === 'white') return { r: 255, g: 255, b: 255, a: 1 }
  if (s === 'black') return { r: 0, g: 0, b: 0, a: 1 }
  if (s === 'red') return { r: 255, g: 0, b: 0, a: 1 }
  let m = /^#([0-9a-f]{3,8})$/.exec(s)
  if (m) {
    let h = m[1]
    if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join('')
    const n = i => parseInt(h.slice(i, i + 2), 16)
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 }
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(s)
  if (m) {
    const a = m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])
    return { r: +m[1], g: +m[2], b: +m[3], a }
  }
  m = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:[\s,/]+([\d.]+))?\s*\)$/.exec(s)
  if (m) return { ...hslToRgb(+m[1], +m[2] / 100, +m[3] / 100), a: m[4] == null ? 1 : +m[4] }
  throw new Error(`Cannot parse colour: ${input}`)
}

function toHex ({ r, g, b }) {
  return '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('')
}
const describe = c => (c.a < 1 ? `rgba(${round(c.r, 1)}, ${round(c.g, 1)}, ${round(c.b, 1)}, ${round(c.a, 3)})` : toHex(c))

// Alpha-composite `fg` over an opaque `bg`.
function over (fg, bg) {
  const a = fg.a ?? 1
  return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 }
}

// WCAG 2.x relative luminance. The sRGB threshold is 0.04045 (WCAG 2.x printed 0.03928; the
// difference cannot change any result for 8-bit colours).
function luminance ({ r, g, b }) {
  const lin = v => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}
function contrast (a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

function rgbToHsl ({ r, g, b }) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b); const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return { h: h * 60, s, l }
}
function hslToRgb (h, s, l) {
  const k = n => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255, a: 1 }
}
const withLightness = (c, l) => { const h = rgbToHsl(c); return hslToRgb(h.h, h.s, l) }

// Nearest colour (same hue/saturation) to `color` whose contrast against `against` reaches
// `target`, moving lightness in the direction that increases contrast.
function adjustToRatio (color, against, target) {
  if (contrast(color, against) >= target) return color
  const { l } = rgbToHsl(color)
  const goDarker = luminance(against) > 0.18
  let lo = goDarker ? 0 : l; let hi = goDarker ? l : 1
  let best = null
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    const ok = contrast(withLightness(color, mid), against) >= target
    if (ok) { best = mid; if (goDarker) lo = mid; else hi = mid } else if (goDarker) hi = mid; else lo = mid
  }
  if (best == null) return null
  // round to a hex and make sure rounding did not drop below the target
  let candidate = parseColor(toHex(withLightness(color, best)))
  let step = 0
  while (contrast(candidate, against) < target && step++ < 20) candidate = parseColor(toHex(withLightness(candidate, rgbToHsl(candidate).l + (goDarker ? -0.002 : 0.002))))
  return candidate
}

// ---------------------------------------------------------------------------------------------
// Bulma 0.9 functions (utilities/functions.sass), re-implemented
// ---------------------------------------------------------------------------------------------

// Bulma's own luminance: same weights as WCAG but squares instead of ^2.4 and a 0.03928 threshold.
function bulmaLuminance ({ r, g, b }) {
  const lin = v => { const c = v / 255; return c < 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2 }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}
const findColorInvert = c => (bulmaLuminance(c) > 0.55 ? { r: 0, g: 0, b: 0, a: 0.7 } : parseColor('#fff'))
function findLightColor (c) {
  const { l } = rgbToHsl(c)
  return withLightness(c, Math.max(0.96, l))
}
function findDarkColor (c) {
  const delta = 0.53 - bulmaLuminance(c)
  const target = Math.round(29 + delta * 53)
  return withLightness(c, Math.max(29, target) / 100)
}

// ---------------------------------------------------------------------------------------------
// Variables: Bulma defaults + main.scss overrides + derived values
// ---------------------------------------------------------------------------------------------

function readBulmaDefaults () {
  const file = path.join(repoRoot, 'node_modules/bulma/sass/utilities/initial-variables.sass')
  const vars = {}
  for (const m of fs.readFileSync(file, 'utf8').matchAll(/^\$([\w-]+):\s*(hsl\([^)]*\)|#[0-9a-fA-F]+)\s*!default/gm)) {
    vars[m[1]] = { value: m[2], source: `bulma initial-variables ($${m[1]})` }
  }
  return vars
}

function readScssOverrides (file) {
  const text = fs.readFileSync(file, 'utf8')
  const head = text.split(/@import\s+'~bulma/)[0]
  const vars = {}
  const lines = head.split('\n')
  lines.forEach((line, i) => {
    const m = /^\s*\$([\w-]+):\s*([^;]+);/.exec(line)
    if (m) vars[m[1]] = { value: m[2].trim(), source: `${rel(file)}:${i + 1}` }
  })
  return vars
}

const bulmaDefaults = readBulmaDefaults()
const overrides = readScssOverrides(mainScss)
const raw = { ...bulmaDefaults, ...overrides }

function resolve (name, seen = new Set()) {
  const entry = raw[name]
  if (!entry) return null
  if (seen.has(name)) throw new Error(`cycle at $${name}`)
  seen.add(name)
  const v = entry.value
  if (v.startsWith('$')) return resolve(v.slice(1), seen)
  try { return parseColor(v) } catch { return null }
}

// Derived variables as in bulma/sass/utilities/derived-variables.sass, only where the app does
// not override them.
const derivedDefaults = {
  primary: 'turquoise', info: 'cyan', success: 'green', warning: 'yellow', danger: 'red',
  light: 'white-ter', dark: 'grey-darker', 'scheme-main': 'white', 'scheme-main-bis': 'white-bis',
  'scheme-main-ter': 'white-ter', 'scheme-invert': 'black', background: 'white-ter',
  border: 'grey-lighter', 'border-hover': 'grey-light', 'border-light': 'grey-lightest',
  text: 'grey-dark', 'text-light': 'grey', 'text-strong': 'grey-darker', link: 'blue',
  'link-hover': 'grey-darker', 'link-visited': 'purple', 'link-focus-border': 'blue'
}
for (const [name, ref] of Object.entries(derivedDefaults)) {
  if (!raw[name]) raw[name] = { value: `$${ref}`, source: `bulma derived-variables default ($${name}: $${ref})` }
}

const V = {} // resolved colours by variable name
for (const name of Object.keys(raw)) {
  const c = resolve(name)
  if (c) V[name] = c
}
const COLOR_NAMES = ['primary', 'link', 'info', 'success', 'warning', 'danger', 'dark', 'light']
for (const name of COLOR_NAMES) {
  V[`${name}-invert`] = findColorInvert(V[name])
  V[`${name}-light`] = findLightColor(V[name])
  V[`${name}-dark`] = findDarkColor(V[name])
}
V['text-invert'] = findColorInvert(V.text)
V['input-placeholder'] = { ...V['text-strong'], a: 0.3 }
V['focus-shadow'] = { ...V.link, a: 0.25 }
// Buefy: $checkbox-border-color: $grey; switch track: $grey-light
V['checkbox-border'] = V.grey
V['switch-track'] = V['grey-light']

// The page background is set in App.vue / AppMain.vue, not through a Bulma variable.
const PAGE_BG = parseColor('#fafafa')
const WHITE = parseColor('#ffffff')
const BLACK = parseColor('#000000')

// ---------------------------------------------------------------------------------------------
// Hard-coded colours in .vue files
// ---------------------------------------------------------------------------------------------

function walk (dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, acc)
    else if (full.endsWith('.vue')) acc.push(full)
  }
  return acc.sort()
}

const hardCoded = {}
for (const full of walk(srcRoot)) {
  const text = fs.readFileSync(full, 'utf8')
  const lines = text.split('\n')
  let block = 'template'
  lines.forEach((line, i) => {
    if (/^<script/.test(line)) block = 'script'
    else if (/^<style/.test(line)) block = 'style'
    else if (/^<template/.test(line)) block = 'template'
    if (block === 'style' && /rainbow|@keyframes/.test(line)) return
    for (const m of line.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|var\(--[\w-]+\)/g)) {
      const key = m[0].startsWith('var(') ? m[0] : toHex(parseColor(m[0]))
      hardCoded[key] ||= { count: 0, where: [] }
      hardCoded[key].count++
      const loc = `${rel(full)}:${i + 1} (${block})`
      if (!hardCoded[key].where.includes(loc)) hardCoded[key].where.push(loc)
    }
  })
}

// ---------------------------------------------------------------------------------------------
// Pairs to check
// ---------------------------------------------------------------------------------------------

// kind: 'text'      -> requirement AA normal text 4.5:1 (large text 3:1 reported too)
//       'large'     -> text that is >= 24px or >= 18.66px bold; requirement 3:1
//       'ui'        -> non-text contrast (SC 1.4.11), requirement 3:1
// css:  optional [selector, fgProperty, bgProperty] checked against the compiled CSS.
const pairs = []
const add = (id, fg, bg, kind, usedIn, extra = {}) => pairs.push({ id, fg, bg, kind, usedIn, ...extra })

add('body text ($text) on page background #fafafa', V.text, PAGE_BG, 'text', 'all pages (App.vue sets #fafafa)')
add('body text ($text) on white (box, card, sidebar)', V.text, WHITE, 'text', '.box wraps every route (AppMain.vue)')
add('title/label ($text-strong) on white', V['text-strong'], WHITE, 'text', '.title, .label, table headers, input text', { css: ['.label', 'color', null] })
add('link ($link) on white', V.link, WHITE, 'text', 'all links', { css: ['a', 'color', null] })
add('link ($link) on page background #fafafa', V.link, PAGE_BG, 'text', 'footer links, levelbar')
add('link ($link) vs surrounding body text ($text), links are not underlined', V.link, V.text, 'ui', 'SC 1.4.1: colour-only link identification needs 3:1 against body text (technique G183)')
add('link hover ($link-hover) on white', V['link-hover'], WHITE, 'text', 'hovered links')
add('.has-text-grey ($grey) on white', V.grey, WHITE, 'text', 'EmptyTableStub "Nothing here." (48 uses)', { css: ['.has-text-grey', 'color', null] })
add('.menu-label ($text-light) on white sidebar', V['text-light'], WHITE, 'text', 'Sidebar category headings', { css: ['.menu-label', 'color', null] })
add('.has-text-danger / .help.is-danger ($danger) on white', V.danger, WHITE, 'text', 'required-field asterisks (133 has-text-danger), field errors', { css: ['.has-text-danger', 'color', null] })
add('.help.is-success ($success) on white', V.success, WHITE, 'text', 'Buefy field success messages', { css: ['.help.is-success', 'color', null] })
add('.help.is-warning ($warning) on white', V.warning, WHITE, 'text', 'Buefy field warnings', { css: ['.help.is-warning', 'color', null] })
add('.help.is-info ($info) on white', V.info, WHITE, 'text', 'help text with is-info', { css: ['.help.is-info', 'color', null] })
add('input placeholder (rgba($text-strong, .3)) on white', V['input-placeholder'], WHITE, 'text', 'every input with a placeholder (often the only label)')
add('disabled input text ($text-light) on $background', V['text-light'], V.background, 'text', 'disabled inputs (exempt from 1.4.3, listed for information)', { exempt: true })
add('default .tag ($text on $background)', V.text, V.background, 'text', '.tag without colour modifier', { css: ['.tag:not(body)', 'color', 'background-color'] })
add('default .notification ($text on $background)', V.text, V.background, 'text', '.notification without colour modifier', { css: ['.notification', null, 'background-color'] })
add('.has-background-grey-light with body text', V.text, V['grey-light'], 'text', 'has-background-grey-light (4 uses)')
add('navbar item ($text) on white navbar', V.text, WHITE, 'text', 'Navbar.vue')
add('tooltip text (white) on $blue-standard', WHITE, V['blue-standard'], 'text', 'v-tooltip (main.scss .tooltip-inner)')

for (const name of ['primary', 'link', 'info', 'success', 'warning', 'danger', 'dark']) {
  const bg = V[name]; const inv = V[`${name}-invert`]
  add(`.is-${name} solid (invert on $${name})`, inv, bg, 'text',
    `buttons, tags, notifications, b-message headers, dialog buttons, toasts with is-${name}`,
    { css: [`.button.is-${name}`, 'color', 'background-color'], colorName: name })
  // Bulma only generates .is-light variants for colours with light/dark shades (not $dark).
  if (name !== 'dark') {
    add(`.is-${name}.is-light (dark on light)`, V[`${name}-dark`], V[`${name}-light`], 'text',
      `tag/button/notification is-${name} is-light, b-message body`,
      { css: [`.button.is-${name}.is-light`, 'color', 'background-color'], colorName: name })
  }
  add(`toast .is-${name} (opacity .92 over page)`, inv, over({ ...bg, a: 0.92 }, PAGE_BG), 'text', `$buefy.toast via showError/showSuccess/... (type is-${name})`, { colorName: name })
}
add('.tag.is-light / .button.is-light ($light-invert on $light)', V['light-invert'], V.light, 'text', '"Applications are closed" tags, dialog.alert type is-light', { css: ['.button.is-light', 'color', 'background-color'] })
add('table selected row ($primary-invert on $primary)', V['primary-invert'], V.primary, 'text', 'b-table :selected rows')
add('menu active item ($link-invert on $link)', V['link-invert'], V.link, 'text', 'Sidebar active route', { css: ['.menu-list a.is-active', 'color', 'background-color'] })

// Hard-coded fg/bg combinations
const EVENT_TYPE_COLORS = {
  'training #A0C514': '#A0C514', 'conference #931991': '#931991', 'nwm #FBBA00': '#FBBA00',
  'cultural #C51C13': '#C51C13', 'thematic var(--purple-light) #c44bc2': V['purple-light'] ? toHex(V['purple-light']) : '#c44bc2',
  'statutory #1468C5': '#1468C5', 'summer university / pilot #00BBD8': '#00BBD8', 'online event #898989': '#898989'
}
for (const [label, hex] of Object.entries(EVENT_TYPE_COLORS)) {
  add(`white text on event-type colour ${label}`, WHITE, parseColor(hex), 'text',
    'events/List.vue:122, summeruniversity/List.vue:148, dashboard/Calendar.vue tags and calendar events', { hardCoded: true })
}
for (const [label, hex] of Object.entries(EVENT_TYPE_COLORS)) {
  add(`event-type colour ${label} as calendar block / swatch on white`, parseColor(hex), WHITE, 'ui',
    'dashboard/Calendar.vue (FullCalendar events), colour legend tags', { hardCoded: true })
}
add('"Applications are open!" #647A16 on white', parseColor('#647A16'), WHITE, 'text', 'summeruniversity/List.vue:91', { hardCoded: true })
add('error text #C51C13 on white', parseColor('#C51C13'), WHITE, 'text', 'summeruniversity/Apply.vue:345,351', { hardCoded: true })

// Stats.vue legend cells: colors[i] background with backgroundColors[i] text
const statsColors = ['#3E95CD', '#8E5EA2', '#3CBA9F', '#E8C3B9', '#C45850', '#FFB6B2', '#E5E6BB', '#E6BDE5', '#FFF0B2', '#B2D6FF', '#FF5543', '#C2DE5D', '#C44BC2', '#FFDB4C', '#4CA0FF', '#C51C13', '#A0C514', '#931991', '#FBBA00', '#1468C5', '#7A1E16', '#647A16', '#70086E', '#CF9800', '#163E7A']
const statsText = ['#FFFFFF', '#FFFFFF', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#000000', '#FFFFFF', '#000000', '#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF', '#000000', '#FFFFFF']
statsColors.forEach((hex, i) => {
  add(`Stats legend cell ${statsText[i]} on ${hex}`, parseColor(statsText[i]), parseColor(hex), 'text', 'statutory/Stats.vue:69 (colors / backgroundColors arrays)', { hardCoded: true, group: 'stats-legend' })
  add(`Stats chart colour ${hex} on white (pie slice / line)`, parseColor(hex), WHITE, 'ui', 'statutory/Stats.vue chart datasets', { hardCoded: true, group: 'stats-chart' })
})

// Non-text UI
add('input / select border ($border) on white', V.border, WHITE, 'ui', 'every .input, .select, .textarea (SC 1.4.11 control boundary)', { css: ['.input', 'border-color', null] })
add('default .button border ($border) on white', V.border, WHITE, 'ui', '.button without colour; its dark label identifies it, so the boundary is listed for information only', { informational: true })
add('Buefy checkbox border ($grey) on white', V['checkbox-border'], WHITE, 'ui', 'b-checkbox')
add('Buefy switch track off ($grey-light) on white', V['switch-track'], WHITE, 'ui', 'b-switch (events list view toggle)')
add('Buefy switch track on ($primary) on white', V.primary, WHITE, 'ui', 'b-switch checked')
add('focus ring rgba($primary, .25) on white (vs unfocused white)', over(V['focus-shadow'], WHITE), WHITE, 'ui', 'coloured .button:focus, where the faint box-shadow is the only focus indicator (SC 1.4.11 / 2.4.7). .input:focus also turns the border $link, which passes.')
add('.input:focus border ($link) on white', V.link, WHITE, 'ui', '.input/.textarea/.select focus border')
add('.is-warning button/tag background on white page', V.warning, WHITE, 'ui', 'boundary of yellow buttons/tags; the dark label identifies them, listed for information only', { informational: true })

// ---------------------------------------------------------------------------------------------
// Optional: compile main.scss with sass and verify
// ---------------------------------------------------------------------------------------------

async function compileCss () {
  try {
    const require = createRequire(path.join(repoRoot, 'package.json'))
    const sassPath = require.resolve('sass')
    const sass = await import(pathToFileURL(sassPath).href)
    const res = (sass.default || sass).compile(mainScss, {
      logger: (sass.default || sass).Logger.silent,
      importers: [{
        findFileUrl (url) {
          if (!url.startsWith('~')) return null
          return pathToFileURL(path.join(repoRoot, 'node_modules', url.slice(1)))
        }
      }]
    })
    return res.css
  } catch (err) {
    return { error: String(err.message || err).split('\n')[0] }
  }
}

function cssRules (css) {
  const rules = new Map()
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decls = {}
    for (const d of m[2].split(';')) {
      const i = d.indexOf(':')
      if (i > 0) decls[d.slice(0, i).trim()] = d.slice(i + 1).trim().replace(/\s*!important$/, '')
    }
    for (const sel of m[1].split(',').map(s => s.trim().replace(/\s+/g, ' '))) {
      if (!rules.has(sel)) rules.set(sel, decls)
      else rules.set(sel, { ...decls, ...rules.get(sel) }) // keep first value, add missing props
    }
  }
  return rules
}

// ---------------------------------------------------------------------------------------------
// Evaluate and write
// ---------------------------------------------------------------------------------------------

const css = await compileCss()
const compiled = typeof css === 'string' ? cssRules(css) : null
const verification = { compiled: Boolean(compiled), error: compiled ? undefined : css.error, checks: [] }

function colorFromCss (selector, prop) {
  if (!compiled || !prop) return null
  const decl = compiled.get(selector)
  if (!decl || !decl[prop]) return null
  try { return parseColor(decl[prop]) } catch { return null }
}
const same = (a, b) => Math.abs(a.r - b.r) < 1.5 && Math.abs(a.g - b.g) < 1.5 && Math.abs(a.b - b.b) < 1.5 && Math.abs((a.a ?? 1) - (b.a ?? 1)) < 0.02

const results = pairs.map(p => {
  let { fg, bg } = p
  if (p.css && compiled) {
    const [sel, fgProp, bgProp] = p.css
    const cf = colorFromCss(sel, fgProp); const cb = colorFromCss(sel, bgProp)
    const check = { selector: sel }
    if (fgProp) {
      check.expectedFg = describe(fg); check.compiledFg = cf ? describe(cf) : 'not found'
      if (cf && !same(cf, fg)) { check.mismatch = true; fg = cf }
    }
    if (bgProp) {
      check.expectedBg = describe(bg); check.compiledBg = cb ? describe(cb) : 'not found'
      if (cb && !same(cb, bg)) { check.mismatch = true; bg = cb }
    }
    verification.checks.push(check)
  }
  const bgOpaque = bg.a < 1 ? over(bg, PAGE_BG) : bg
  const fgOpaque = fg.a < 1 ? over(fg, bgOpaque) : fg
  const ratio = contrast(fgOpaque, bgOpaque)
  const requirement = p.kind === 'text' ? 4.5 : 3
  const passes = ratio >= requirement
  const out = {
    pair: p.id,
    kind: p.kind,
    usedIn: p.usedIn,
    foreground: describe(fg),
    background: describe(bg),
    effectiveForeground: toHex(fgOpaque),
    effectiveBackground: toHex(bgOpaque),
    ratio: round(ratio),
    aaNormalText: ratio >= 4.5,
    aaLargeText: ratio >= 3,
    nonTextUi: ratio >= 3,
    requirement: `${requirement}:1 (${p.kind === 'text' ? 'AA normal text' : p.kind === 'large' ? 'AA large text' : 'non-text, SC 1.4.11'})`,
    passesRequirement: passes
  }
  if (p.exempt) out.note = 'disabled controls are exempt from SC 1.4.3'
  if (p.informational) out.note = 'informational: not required by SC 1.4.11 in this context'
  if (p.hardCoded) out.hardCoded = true
  if (p.group) out.group = p.group
  if (!passes && !p.exempt) {
    const suggestions = {}
    const fgIsNeutral = rgbToHsl(fgOpaque).s < 0.05 && (luminance(fgOpaque) > 0.9 || luminance(fgOpaque) < 0.02)
    if (fgIsNeutral) {
      const adj = adjustToRatio(bgOpaque, fgOpaque, requirement)
      if (adj) suggestions.darkenBackgroundTo = `${toHex(adj)} (${round(contrast(fgOpaque, adj))}:1 with ${toHex(fgOpaque)})`
    } else {
      const adj = adjustToRatio(fgOpaque, bgOpaque, requirement)
      if (adj) suggestions.adjustForegroundTo = `${toHex(adj)} (${round(contrast(adj, bgOpaque))}:1 on ${toHex(bgOpaque)})`
    }
    const best = contrast(WHITE, bgOpaque) >= contrast(BLACK, bgOpaque) ? WHITE : BLACK
    if (p.kind !== 'ui') suggestions.bestOfBlackOrWhiteText = `${toHex(best)} (${round(contrast(best, bgOpaque))}:1)`
    out.suggestions = suggestions
  }
  return out
})

// Palette: brand colours, Bulma semantic colours with Bulma's invert choice vs WCAG's best choice.
function paletteEntry (name, c) {
  const inv = findColorInvert(c)
  const invEffective = over(inv, c)
  const whiteRatio = contrast(WHITE, c)
  const blackRatio = contrast(BLACK, c)
  return {
    variable: `$${name}`,
    value: toHex(c),
    source: raw[name]?.source,
    wcagLuminance: round(luminance(c), 4),
    bulmaLuminance: round(bulmaLuminance(c), 4),
    bulmaInvert: inv.a < 1 ? 'rgba(0,0,0,0.7)' : '#ffffff',
    bulmaInvertRatio: round(contrast(invEffective, c)),
    whiteTextRatio: round(whiteRatio),
    blackTextRatio: round(blackRatio),
    wcagBetterText: whiteRatio >= blackRatio ? '#ffffff' : '#000000',
    light: toHex(findLightColor(c)),
    dark: toHex(findDarkColor(c))
  }
}
const palette = {
  brand: Object.fromEntries(Object.keys(overrides).filter(n => /-(light|standard|dark)$/.test(n)).map(n => [n, paletteEntry(n, V[n])])),
  semantic: Object.fromEntries(['primary', 'link', 'info', 'success', 'warning', 'danger', 'dark', 'light', 'text', 'text-light', 'text-strong', 'background', 'border', 'grey', 'grey-light', 'grey-lighter', 'scheme-main'].map(n => [n, paletteEntry(n, V[n])])),
  notes: [
    'Bulma 0.9 picks the invert with its own luminance (squares instead of ^2.4) and a 0.55 threshold. The WCAG crossover where black and white text give equal contrast is a luminance of about 0.18, so colours between roughly 0.18 and 0.55 get white text although dark text would contrast better.',
    '$grey-light, $grey-dark, $black and $white are overridden in main.scss, which also changes Bulma values derived from them ($background = $grey-light #c5c6c6 is the default tag/notification background; $text = $grey-dark #434242).',
    'Navbar.vue, Sidebar.vue, AppMain.vue and FooterBar.vue import Bulma utilities without main.scss, so any colour variable used in their <style> blocks would be Bulma defaults. Today they only use mixins and hard-coded values.'
  ]
}

const failing = results.filter(r => !r.passesRequirement && !r.note)
const summary = {
  pairsChecked: results.length,
  failingRequirement: failing.length,
  failingPairs: failing.filter(r => !r.group).map(r => `${r.pair}: ${r.ratio}:1`),
  failingStatsLegendCells: results.filter(r => r.group === 'stats-legend' && !r.passesRequirement).length,
  failingStatsChartColours: results.filter(r => r.group === 'stats-chart' && !r.passesRequirement).length,
  compiledCssVerified: verification.compiled,
  compiledCssMismatches: verification.checks.filter(c => c.mismatch).length
}

let usageNote
if (fs.existsSync(usageFile)) {
  const usage = JSON.parse(fs.readFileSync(usageFile, 'utf8'))
  const v = usage.bulma?.button?.variants || {}
  usageNote = { buttonColourVariants: Object.fromEntries(Object.entries(v).filter(([k]) => /^is-(primary|link|info|success|warning|danger|dark|light)$/.test(k))) }
}

const output = {
  summary,
  method: {
    luminance: 'WCAG 2.x relative luminance with sRGB linearisation ((c+0.055)/1.055)^2.4, threshold 0.04045',
    alpha: 'semi-transparent colours are composited over their background (and toasts over the #fafafa page) before measuring',
    thresholds: { aaNormalText: 4.5, aaLargeText: 3, nonTextUi: 3 },
    suggestions: 'nearest colour with the same hue and saturation (HSL lightness moved) that meets the requirement'
  },
  palette,
  hardCodedColours: Object.fromEntries(Object.entries(hardCoded).sort((a, b) => b[1].count - a[1].count)),
  usage: usageNote,
  results,
  verification
}
fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, JSON.stringify(output, null, 2) + '\n')

console.log(`Wrote ${rel(outFile)}`)
console.log(`  ${summary.pairsChecked} pairs, ${summary.failingRequirement} below their requirement`)
console.log(`  compiled CSS check: ${verification.compiled ? `${verification.checks.length} selectors, ${summary.compiledCssMismatches} mismatches` : `skipped (${verification.error})`}`)
for (const f of summary.failingPairs) console.log('  FAIL ' + f)
