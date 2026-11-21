#!/usr/bin/env node
// Component usage inventory for the Vue frontend.
//
// Scans frontend/src/**/*.vue (templates and scripts) plus frontend/src/**/*.js and writes
// docs/react-migration/data/component-usage.json with:
//   - buefy:            <b-*> components (props, variants, files)
//   - buefyProgrammatic: this.$buefy.toast/dialog/modal/loading calls and the showError/... helpers
//   - thirdParty:       non-Buefy libraries (tags, directives, imports)
//   - local:            components from frontend/src/components/** and chart wrappers
//   - bulma:            raw Bulma CSS patterns (class families with their modifiers)
//   - a11ySignals:      simple markup heuristics (anchors used as buttons, labels not tied to a
//                       control, icon-only buttons, v-html, images without alt, headings ...)
//
// No dependencies; the template scan is a small tag tokenizer, not a full Vue parser, so treat
// the numbers as a close approximation. Run from the repo root:
//
//   node docs/react-migration/tools/component-usage.mjs
//
// The output has no timestamp so re-running on unchanged sources gives an identical file.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../../..')
const srcRoot = path.join(repoRoot, 'frontend/src')
const outFile = path.join(repoRoot, 'docs/react-migration/data/component-usage.json')
const EXAMPLES_PER_ITEM = 12

// ---------------------------------------------------------------------------------------------
// What to look for
// ---------------------------------------------------------------------------------------------

// Third-party libraries: how each one shows up in the code.
const THIRD_PARTY = {
  'vue-mapbox / mapbox-gl': {
    packages: ['vue-mapbox', 'mapbox-gl'],
    tags: ['mgl-map', 'mgl-marker', 'mgl-popup', 'mgl-navigation-control', 'mgl-geolocate-control']
  },
  '@fullcalendar/vue': { packages: ['@fullcalendar/vue', '@fullcalendar/core', '@fullcalendar/daygrid'], tags: ['full-calendar'] },
  'vue-chartjs / chart.js': { packages: ['vue-chartjs', 'chart.js'], tags: [] },
  'vue-multiselect': { packages: ['vue-multiselect'], tags: ['multiselect'] },
  'vue-flatpickr-component (flatpickr)': { packages: ['vue-flatpickr-component', 'flatpickr'], tags: ['flat-pickr'] },
  'vue-input-tag': { packages: ['vue-input-tag'], tags: ['input-tag'] },
  'vue-infinite-loading': { packages: ['vue-infinite-loading'], tags: ['infinite-loading'] },
  'vue-bulma-collapse': { packages: ['vue-bulma-collapse'], tags: ['collapse', 'collapse-item'] },
  'v-tooltip': { packages: ['v-tooltip'], tags: ['v-popover'], directives: ['v-tooltip'] },
  'vue2-touch-events': { packages: ['vue2-touch-events'], directives: ['v-touch'] },
  nprogress: { packages: ['nprogress'], tags: [], programmatic: /\$nprogress\b|\bnprogress\.(start|done|inc|set)\(/g },
  'animate.css': { packages: ['animate.css'], classes: /^(animate__\w+|animated|slideIn\w*|slideOut\w*|fadeIn\w*|fadeOut\w*|bounce\w*)$/ },
  moment: { packages: ['moment'], tags: [] },
  '@fortawesome/vue-fontawesome': { packages: ['@fortawesome/vue-fontawesome', '@fortawesome/fontawesome-svg-core'], tags: ['font-awesome-icon'] },
  'ical': { packages: ['ical', 'ical/ical'], tags: [] },
  'marked + dompurify (markdown filter)': { packages: ['marked', 'dompurify'], tags: [], programmatic: /filters\.markdown\(|\|\s*markdown\b/g },
  'vue-router': { packages: ['vue-router'], tags: ['router-link', 'router-view'] }
}

// Raw Bulma class families. The key is the family; `root` lists the classes that count as one use
// of the pattern, `parts` lists sub-element classes that are recorded but not counted as uses.
const BULMA = {
  button: { root: ['button'], parts: ['buttons'] },
  table: { root: ['table'], parts: ['table-container'] },
  card: { root: ['card'], parts: ['card-header', 'card-header-title', 'card-header-icon', 'card-content', 'card-footer', 'card-footer-item', 'card-image'] },
  modal: { root: ['modal', 'modal-card'], parts: ['modal-background', 'modal-content', 'modal-close', 'modal-card-head', 'modal-card-title', 'modal-card-body', 'modal-card-foot'] },
  notification: { root: ['notification'], parts: [] },
  tag: { root: ['tag'], parts: ['tags'] },
  tabs: { root: ['tabs'], parts: [] },
  dropdown: { root: ['dropdown'], parts: ['dropdown-trigger', 'dropdown-menu', 'dropdown-content', 'dropdown-item', 'dropdown-divider'] },
  pagination: { root: ['pagination'], parts: ['pagination-link', 'pagination-list', 'pagination-previous', 'pagination-next', 'pagination-ellipsis'] },
  select: { root: ['select'], parts: [] },
  textarea: { root: ['textarea'], parts: [] },
  input: { root: ['input'], parts: [] },
  checkbox: { root: ['checkbox'], parts: [] },
  radio: { root: ['radio'], parts: [] },
  file: { root: ['file'], parts: ['file-label', 'file-input', 'file-cta', 'file-icon', 'file-name'] },
  field: { root: ['field'], parts: ['control', 'label', 'help', 'field-label', 'field-body'] },
  level: { root: ['level'], parts: ['level-left', 'level-right', 'level-item'] },
  tile: { root: ['tile'], parts: [] },
  columns: { root: ['columns'], parts: ['column'] },
  message: { root: ['message'], parts: ['message-header', 'message-body'] },
  box: { root: ['box'], parts: [] },
  navbar: { root: ['navbar'], parts: ['navbar-brand', 'navbar-item', 'navbar-menu', 'navbar-end', 'navbar-start', 'navbar-link', 'navbar-dropdown', 'navbar-burger', 'navbar-divider'] },
  menu: { root: ['menu'], parts: ['menu-label', 'menu-list'] },
  breadcrumb: { root: ['breadcrumb'], parts: [] },
  panel: { root: ['panel'], parts: ['panel-heading', 'panel-block', 'panel-tabs', 'panel-icon'] },
  progress: { root: ['progress'], parts: [] },
  media: { root: ['media'], parts: ['media-left', 'media-content', 'media-right'] },
  content: { root: ['content'], parts: [] },
  title: { root: ['title', 'subtitle'], parts: [] },
  icon: { root: ['icon'], parts: [] },
  image: { root: ['image'], parts: [] },
  hero: { root: ['hero'], parts: ['hero-body', 'hero-head', 'hero-foot'] },
  section: { root: ['section'], parts: [] },
  container: { root: ['container'], parts: [] },
  delete: { root: ['delete'], parts: [] }
}

// Helper classes are reported as one bucket each (counts only).
const HELPER_PREFIXES = ['has-text-', 'has-background-', 'is-size-', 'has-text-weight-', 'is-hidden', 'is-pulled-', 'is-flex', 'is-clearfix']

const HTML_VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])
const FORM_CONTROLS = new Set(['input', 'select', 'textarea', 'b-input', 'b-select', 'b-checkbox', 'b-radio', 'b-switch', 'b-autocomplete', 'b-datepicker', 'b-timepicker', 'b-taginput', 'b-upload', 'flat-pickr', 'multiselect', 'input-tag', 'b-radio-button', 'select-or-custom', 'password-toggle'])
const ICON_TAGS = new Set(['font-awesome-icon', 'b-icon', 'i'])
const BUILTIN_DIRECTIVES = new Set(['v-if', 'v-else', 'v-else-if', 'v-for', 'v-show', 'v-model', 'v-bind', 'v-on', 'v-html', 'v-text', 'v-slot', 'v-once', 'v-pre', 'v-cloak'])
// Buefy props whose values are the "variant" of a component.
const BUEFY_VARIANT_PROPS = new Set(['type', 'size', 'variant', 'position', 'icon-pack', 'native-type', 'tag', 'pack'])

// ---------------------------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------------------------

function walk (dir, filter, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, filter, acc)
    else if (filter(full)) acc.push(full)
  }
  return acc.sort()
}

const rel = file => path.relative(repoRoot, file).split(path.sep).join('/')
const kebab = name => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase()
const lineAt = (text, index) => text.slice(0, index).split('\n').length

function bump (obj, key, n = 1) { obj[key] = (obj[key] || 0) + n }

function sortObject (obj) {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)))
}
function sortByCount (obj) {
  return Object.fromEntries(Object.entries(obj).sort(([ka, a], [kb, b]) => b - a || ka.localeCompare(kb)))
}

// A usage bucket: total count, per-file counts, a few example locations and variant histograms.
function newBucket () {
  return { uses: 0, perFile: {}, examples: [], variants: {}, props: {}, elements: {} }
}
function record (bucket, file, line) {
  bucket.uses++
  bump(bucket.perFile, file)
  if (bucket.examples.length < EXAMPLES_PER_ITEM) bucket.examples.push(`${file}:${line}`)
}
function finalize (bucket) {
  const files = Object.keys(bucket.perFile).sort()
  const out = { uses: bucket.uses, fileCount: files.length, files }
  if (Object.keys(bucket.variants).length) out.variants = sortByCount(bucket.variants)
  if (Object.keys(bucket.props).length) out.props = sortByCount(bucket.props)
  if (Object.keys(bucket.elements).length) out.elements = sortByCount(bucket.elements)
  if (bucket.extra) Object.assign(out, bucket.extra)
  out.examples = bucket.examples
  return out
}

// ---------------------------------------------------------------------------------------------
// SFC splitting and template tokenizing
// ---------------------------------------------------------------------------------------------

// Returns the top-level <template>, <script> and <style> blocks with their starting offsets.
// The top-level template is closed by the last "</template>" at column 0.
function splitSfc (source) {
  const blocks = { template: null, script: null, styles: [] }
  const tpl = /^<template[^>]*>/m.exec(source)
  if (tpl) {
    const start = tpl.index + tpl[0].length
    const closeRe = /^<\/template>/gm
    let end = -1
    let m
    while ((m = closeRe.exec(source))) end = m.index
    if (end > start) blocks.template = { text: source.slice(start, end), offset: start }
  }
  const script = /^<script[^>]*>([\s\S]*?)^<\/script>/m.exec(source)
  if (script) blocks.script = { text: script[1], offset: script.index + script[0].indexOf(script[1]) }
  const styleRe = /^<style[^>]*>([\s\S]*?)^<\/style>/gm
  let s
  while ((s = styleRe.exec(source))) blocks.styles.push({ text: s[1], offset: s.index + s[0].indexOf(s[1]) })
  return blocks
}

// Parses an attribute string into [{ name, value }]. Values keep their raw text.
function parseAttributes (raw) {
  const attrs = []
  const re = /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g
  let m
  while ((m = re.exec(raw))) {
    attrs.push({ name: m[1], value: m[2] ?? m[3] ?? m[4] ?? null })
  }
  return attrs
}

// Tokenizes a template into open/close/text events. Quoted attribute values may contain ">".
function * tokenize (html) {
  let i = 0
  while (i < html.length) {
    if (html.startsWith('<!--', i)) {
      const end = html.indexOf('-->', i)
      i = end === -1 ? html.length : end + 3
      continue
    }
    if (html[i] === '<' && /[A-Za-z/]/.test(html[i + 1] || '')) {
      const closing = html[i + 1] === '/'
      let j = i + (closing ? 2 : 1)
      const nameMatch = /^[A-Za-z][\w.:-]*/.exec(html.slice(j))
      if (!nameMatch) { i++; continue }
      const name = nameMatch[0]
      j += name.length
      let quote = null
      const attrStart = j
      while (j < html.length) {
        const c = html[j]
        if (quote) { if (c === quote) quote = null } else if (c === '"' || c === "'") quote = c
        else if (c === '>') break
        j++
      }
      let attrText = html.slice(attrStart, j)
      const selfClosing = attrText.trimEnd().endsWith('/')
      if (selfClosing) attrText = attrText.trimEnd().slice(0, -1)
      yield { kind: closing ? 'close' : 'open', name, attrs: closing ? [] : parseAttributes(attrText), selfClosing, index: i }
      i = j + 1
      continue
    }
    const next = html.indexOf('<', i + 1)
    const end = next === -1 ? html.length : next
    yield { kind: 'text', text: html.slice(i, end), index: i }
    i = end
  }
}

// Collects class names from class="..." and from string literals inside :class="...".
function classesOf (attrs) {
  const out = new Set()
  for (const { name, value } of attrs) {
    if (!value) continue
    if (name === 'class') value.split(/\s+/).filter(Boolean).forEach(c => out.add(c))
    if (name === ':class' || name === 'v-bind:class') {
      // object keys ('is-loading': cond) and plain string literals
      for (const m of value.matchAll(/'([^']+)'|"([^"]+)"|`([^`]+)`/g)) {
        (m[1] || m[2] || m[3]).split(/\s+/).filter(c => /^[a-z][\w-]*$/.test(c)).forEach(c => out.add(c))
      }
      for (const m of value.matchAll(/[{,]\s*([a-z][\w]*)\s*:/g)) out.add(m[1])
    }
  }
  return out
}

const attrNames = attrs => new Set(attrs.map(a => a.name))
const hasAny = (names, list) => list.some(n => names.has(n))
const attr = (attrs, ...names) => attrs.find(a => names.includes(a.name))

// ---------------------------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------------------------

const result = {
  buefy: {},
  buefyProgrammatic: {},
  thirdParty: {},
  local: {},
  bulma: {},
  bulmaHelpers: {},
  a11ySignals: {},
  directives: {},
  headings: {},
  htmlElements: {}
}
const buckets = { buefy: {}, buefyProgrammatic: {}, thirdParty: {}, local: {}, bulma: {}, a11y: {} }
const getBucket = (group, key) => (buckets[group][key] ||= newBucket())

// Local components: everything under src/components plus the chart wrappers in Stats.vue.
const localComponentFiles = walk(path.join(srcRoot, 'components'), f => f.endsWith('.vue'))
const localNames = new Map() // tag (kebab) -> component file
for (const file of localComponentFiles) {
  const base = path.basename(file, '.vue')
  localNames.set(kebab(base), rel(file))
  localNames.set(base.toLowerCase(), rel(file)) // e.g. URLTooltip -> urltooltip
}
// globally registered names from app.js / App.vue
localNames.set('nprogress-container', 'frontend/src/components/NProgress.vue')
localNames.set('pie-chart', 'frontend/src/views/statutory/Stats.vue (vue-chartjs Pie wrapper)')
localNames.set('line-chart', 'frontend/src/views/statutory/Stats.vue (vue-chartjs Line wrapper)')

const thirdPartyTags = new Map()
const thirdPartyDirectives = new Map()
for (const [lib, def] of Object.entries(THIRD_PARTY)) {
  for (const t of def.tags || []) thirdPartyTags.set(t, lib)
  for (const d of def.directives || []) thirdPartyDirectives.set(d, lib)
}
const bulmaRootClass = new Map()
const bulmaPartClass = new Map()
for (const [family, def] of Object.entries(BULMA)) {
  def.root.forEach(c => bulmaRootClass.set(c, family))
  def.parts.forEach(c => bulmaPartClass.set(c, family))
}

function normalizeTag (name) {
  // PascalCase components (MglMap, FullCalendar, URLTooltip) -> kebab-case
  if (/[A-Z]/.test(name)) {
    const k = kebab(name)
    if (localNames.has(name.toLowerCase()) && !localNames.has(k)) return name.toLowerCase()
    return k
  }
  return name
}

function scanTemplate (file, template, fileText) {
  const stack = []
  const line = idx => lineAt(fileText, template.offset + idx)

  for (const tok of tokenize(template.text)) {
    if (tok.kind === 'text') {
      if (/\S/.test(tok.text.replace(/&nbsp;/g, ''))) stack.forEach(el => { el.hasText = true })
      continue
    }
    if (tok.kind === 'close') {
      const name = normalizeTag(tok.name)
      const at = stack.map(e => e.name).lastIndexOf(name)
      if (at === -1) continue
      while (stack.length > at) closeElement(file, stack.pop(), stack)
      continue
    }

    const name = normalizeTag(tok.name)
    const attrs = tok.attrs
    const names = attrNames(attrs)
    const classes = classesOf(attrs)
    const ln = line(tok.index)
    const el = { name, attrs, names, classes, line: ln, hasText: false, hasIcon: false, hasControl: false }

    bump(result.htmlElements, name)
    if (/^h[1-6]$/.test(name)) bump(result.headings, name)

    // mustache / v-text / label-ish props count as text content for the element itself
    if (hasAny(names, ['v-text', ':v-text', 'v-html', 'aria-label', ':aria-label', 'title', ':title', 'label', ':label'])) el.hasText = true
    if (ICON_TAGS.has(name) || classes.has('icon')) stack.forEach(e => { e.hasIcon = true })
    if (FORM_CONTROLS.has(name)) stack.forEach(e => { e.hasControl = true })

    // Directives
    for (const a of attrs) {
      if (!a.name.startsWith('v-')) continue
      const dir = a.name.split(/[:.]/)[0]
      if (BUILTIN_DIRECTIVES.has(dir)) continue
      bump(result.directives, dir)
      if (thirdPartyDirectives.has(dir)) {
        const b = getBucket('thirdParty', thirdPartyDirectives.get(dir))
        record(b, file, ln)
        bump(b.variants, `directive ${a.name}`)
      }
    }
    if (names.has('v-html')) record(getBucket('a11y', 'v-html (raw HTML injection)'), file, ln)

    // Buefy components
    if (name.startsWith('b-')) {
      const b = getBucket('buefy', name)
      record(b, file, ln)
      for (const a of attrs) {
        const prop = a.name.replace(/^(:|v-bind:)/, '')
        if (/^(v-|@|#|key$|ref$|class$|style$)/.test(a.name) || prop === 'key') continue
        bump(b.props, prop)
        if (BUEFY_VARIANT_PROPS.has(prop) && a.value != null) {
          bump(b.variants, a.name.startsWith(':') ? `${prop}=<bound: ${a.value.slice(0, 40)}>` : `${prop}=${a.value}`)
        }
        if (a.value == null && !a.name.startsWith(':')) bump(b.variants, prop) // boolean props like `rounded`
      }
      for (const c of classes) if (/^(is|has)-/.test(c)) bump(b.variants, `class ${c}`)
    }

    // Third-party tags
    if (thirdPartyTags.has(name)) {
      const b = getBucket('thirdParty', thirdPartyTags.get(name))
      record(b, file, ln)
      bump(b.variants, `<${name}>`)
      for (const a of attrs) if (/^:?(config|options|position|placeholder|multiple|taggable|searchable|map-style|zoom|center)$/.test(a.name)) bump(b.props, a.name.replace(/^:/, ''))
    }

    // Local components
    if (localNames.has(name)) {
      const b = getBucket('local', name)
      record(b, file, ln)
      b.extra = { definedIn: localNames.get(name) }
      for (const a of attrs) if (!/^(v-|@|key$|:key$)/.test(a.name)) bump(b.props, a.name.replace(/^:/, ''))
    }

    // animate.css-style class names
    for (const c of classes) {
      if (THIRD_PARTY['animate.css'].classes.test(c)) {
        const b = getBucket('thirdParty', 'animate.css')
        record(b, file, ln)
        bump(b.variants, `class ${c}`)
      }
    }

    // Raw Bulma patterns
    const modifiers = [...classes].filter(c => /^(is|has)-/.test(c))
    for (const c of classes) {
      if (bulmaRootClass.has(c)) {
        const family = bulmaRootClass.get(c)
        const b = getBucket('bulma', family)
        record(b, file, ln)
        bump(b.elements, name)
        if (c !== family) bump(b.variants, `root ${c}`)
        modifiers.forEach(m => bump(b.variants, m))
      } else if (bulmaPartClass.has(c)) {
        const b = getBucket('bulma', bulmaPartClass.get(c))
        bump(b.props, `part ${c}`)
      }
      for (const prefix of HELPER_PREFIXES) {
        if (c.startsWith(prefix)) { bump(result.bulmaHelpers, c); break }
      }
    }

    // a11y heuristics at open time
    const hasHref = hasAny(names, ['href', ':href', 'v-bind:href'])
    const hasClick = [...names].some(n => /^(@click|v-on:click)/.test(n))
    if (name === 'a' && !hasHref && hasClick) {
      record(getBucket('a11y', '<a> with click handler and no href (should be <button>)'), file, ln)
    }
    if (name === 'a' && !hasHref && !hasClick && !names.has('v-tooltip') && !names.has('name')) {
      record(getBucket('a11y', '<a> without href or click handler'), file, ln)
    }
    if (name === 'img' && !hasAny(names, ['alt', ':alt'])) record(getBucket('a11y', '<img> without alt'), file, ln)
    if ((name === 'div' || name === 'span' || name === 'p') && hasClick) {
      record(getBucket('a11y', 'click handler on non-interactive element (div/span/p)'), file, ln)
    }
    if (hasAny(names, ['role', 'aria-label', ':aria-label', 'aria-labelledby', 'aria-describedby', ':aria-describedby', 'aria-hidden', 'aria-expanded', ':aria-expanded', 'aria-live'])) {
      for (const n of names) if (/^:?(role|aria-)/.test(n)) bump(getBucket('a11y', 'ARIA attributes present (inventory)').variants, n.replace(/^:/, ''))
      record(getBucket('a11y', 'ARIA attributes present (inventory)'), file, ln)
    }
    const isHeadingRole = attrs.some(a => a.name === 'role' && a.value === 'heading')
    if ((classes.has('title') || classes.has('subtitle')) && !/^h[1-6]$/.test(name) && !isHeadingRole) {
      const b = getBucket('a11y', '.title/.subtitle on a non-heading element')
      record(b, file, ln)
      bump(b.elements, name)
    }
    if (classes.has('tile')) {
      /* counted in bulma.tile */
    }
    if (name === 'b-field' && hasAny(names, ['label', ':label']) && !hasAny(names, ['label-for', ':label-for'])) {
      record(getBucket('a11y', '<b-field label> without label-for (label not programmatically tied)'), file, ln)
    }
    if (name === 'font' || name === 'center') record(getBucket('a11y', 'obsolete presentational element'), file, ln)
    const tabindex = attr(attrs, 'tabindex')
    if (tabindex && Number(tabindex.value) > 0) record(getBucket('a11y', 'positive tabindex'), file, ln)
    if (names.has('autofocus')) record(getBucket('a11y', 'autofocus'), file, ln)
    if (attrs.some(a => a.name === 'target' && a.value === '_blank')) record(getBucket('a11y', 'target=_blank links (need "opens in new tab" hint)'), file, ln)
    if (name === 'table' && !classes.has('table')) record(getBucket('a11y', '<table> without Bulma .table class (likely layout table)'), file, ln)
    if (attrs.some(a => a.name.startsWith('ng-'))) record(getBucket('a11y', 'leftover AngularJS attribute (ng-*) - no effect'), file, ln)

    if (HTML_VOID.has(name) || tok.selfClosing) {
      closeElement(file, el, stack)
    } else {
      stack.push(el)
    }
  }
  while (stack.length) closeElement(file, stack.pop(), stack)
}

function closeElement (file, el, stack) {
  const { name, names, classes } = el
  const isButtonLike = name === 'button' || name === 'b-button' || (name === 'a' && classes.has('button')) ||
    (name === 'router-link' && classes.has('button')) || names.has('role') && el.attrs.some(a => a.name === 'role' && a.value === 'button')
  const named = hasAny(names, ['aria-label', ':aria-label', 'aria-labelledby', 'title', ':title', 'label', ':label'])
  if (isButtonLike && !el.hasText && !named && (el.hasIcon || hasAny(names, ['icon-left', 'icon-right', ':icon-left', ':icon-right']))) {
    record(getBucket('a11y', 'icon-only button/link without accessible name'), file, el.line)
  }
  if (name === 'a' && !el.hasText && !named && el.hasIcon) {
    record(getBucket('a11y', 'icon-only <a> without accessible name'), file, el.line)
  }
  if (name === 'label' && !hasAny(names, ['for', ':for']) && !el.hasControl) {
    record(getBucket('a11y', '<label> not associated with a control (no for=, no nested control)'), file, el.line)
  }
  if (name === 'label' && hasAny(names, ['for', ':for'])) record(getBucket('a11y', '<label for> (associated, for comparison)'), file, el.line)
  if (['input', 'select', 'textarea'].includes(name)) {
    const inLabel = stack.some(e => e.name === 'label')
    const labelled = hasAny(names, ['id', ':id', 'aria-label', ':aria-label', 'aria-labelledby', ':aria-labelledby', 'title', ':title'])
    const type = (attr(el.attrs, 'type') || {}).value
    if (!inLabel && !labelled && !['hidden', 'submit', 'button'].includes(type)) {
      record(getBucket('a11y', 'native input/select/textarea with no id, aria-label or wrapping label'), file, el.line)
    }
  }
  if (name === 'input' && classes.has('checkbox')) {
    record(getBucket('a11y', 'Bulma .checkbox class put on <input> (Bulma expects it on the <label>)'), file, el.line)
  }
}

// Script-level scan: imports, $buefy calls, toast helper calls, programmatic patterns.
function scanScript (file, text, offsetText, offset) {
  const line = idx => lineAt(offsetText, offset + idx)

  for (const m of text.matchAll(/import\s+(?:([\s\S]*?)\s+from\s+)?['"]([^'"]+)['"]/g)) {
    const pkg = m[2]
    for (const [lib, def] of Object.entries(THIRD_PARTY)) {
      if (def.packages.some(p => pkg === p || pkg.startsWith(p + '/'))) {
        const b = getBucket('thirdParty', lib)
        b.imports ||= {}
        bump(b.imports, file)
        bump(b.variants, `import from '${pkg}'`)
        if (!b.examples.includes(`${file}:${line(m.index)}`) && b.examples.length < EXAMPLES_PER_ITEM) b.examples.push(`${file}:${line(m.index)}`)
        b.perFile[file] = b.perFile[file] || 0
      }
    }
  }

  for (const m of text.matchAll(/\$buefy\.(toast|dialog|modal|loading|notification|snackbar)\.(\w+)\(/g)) {
    const key = `$buefy.${m[1]}.${m[2]}`
    const b = getBucket('buefyProgrammatic', key)
    record(b, file, line(m.index))
    const options = balancedObject(text, m.index + m[0].length)
    for (const k of topLevelKeys(options)) bump(b.props, k)
    const t = /\btype:\s*['"]([^'"]+)['"]/.exec(options)
    if (t) bump(b.variants, `type=${t[1]}`)
    const comp = /\bcomponent:\s*([A-Za-z]\w*)/.exec(options)
    if (comp) bump(b.variants, `component=${comp[1]}`)
    if (/\bmessage:\s*`[^`]*\$\{/.test(options)) bump(b.variants, 'message is a template string with interpolation')
  }

  for (const m of text.matchAll(/\b(?:this\.\$root|this|vm|self|\$root)\.(showError|showDanger|showWarning|showSuccess|showInfo|showNotification)\(/g)) {
    const b = getBucket('buefyProgrammatic', `toast helper ${m[1]}() (methods/index.js -> $buefy.toast.open)`)
    record(b, file, line(m.index))
  }

  for (const [lib, def] of Object.entries(THIRD_PARTY)) {
    if (!def.programmatic) continue
    for (const m of text.matchAll(def.programmatic)) {
      const b = getBucket('thirdParty', lib)
      record(b, file, line(m.index))
      bump(b.variants, `call ${m[0].replace(/\($/, '')}`)
    }
  }
}

// From an index just after "(", returns the text of the first {...} argument, if any.
function balancedObject (text, from) {
  const start = text.indexOf('{', from)
  if (start === -1 || /\S/.test(text.slice(from, start))) return ''
  let depth = 0
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') { depth--; if (depth === 0) return text.slice(start, i + 1) }
  }
  return ''
}
function topLevelKeys (obj) {
  const keys = []
  let depth = 0
  for (let i = 0; i < obj.length; i++) {
    const c = obj[i]
    if ('{[('.includes(c)) depth++
    else if ('}])'.includes(c)) depth--
    else if (depth === 1) {
      const m = /^([A-Za-z_]\w*)\s*:/.exec(obj.slice(i))
      if (m && /[{,\s]/.test(obj[i - 1])) { keys.push(m[1]); i += m[0].length - 1 }
    }
  }
  return keys
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------

const vueFiles = walk(srcRoot, f => f.endsWith('.vue'))
const jsFiles = walk(srcRoot, f => f.endsWith('.js'))

for (const full of vueFiles) {
  const file = rel(full)
  const text = fs.readFileSync(full, 'utf8')
  const sfc = splitSfc(text)
  if (sfc.template) scanTemplate(file, sfc.template, text)
  if (sfc.script) scanScript(file, sfc.script.text, text, sfc.script.offset)
  // template-side markdown filter calls are also "programmatic" uses of marked/dompurify
  if (sfc.template) {
    for (const m of sfc.template.text.matchAll(THIRD_PARTY['marked + dompurify (markdown filter)'].programmatic)) {
      const b = getBucket('thirdParty', 'marked + dompurify (markdown filter)')
      record(b, file, lineAt(text, sfc.template.offset + m.index))
      bump(b.variants, 'template filters.markdown')
    }
  }
  for (const style of sfc.styles) {
    for (const m of style.text.matchAll(/@import\s+['"]([^'"]+)['"]/g)) bump(result.directives, `(style @import ${m[1]})`)
  }
}
for (const full of jsFiles) {
  const file = rel(full)
  const text = fs.readFileSync(full, 'utf8')
  scanScript(file, text, text, 0)
}

// Packages declared but never imported. Build tooling is skipped, and peer dependencies that are
// only pulled in through a wrapper (chart.js via vue-chartjs, @fullcalendar/core via
// @fullcalendar/vue) are reported separately.
const PEER_ONLY = { 'chart.js': 'vue-chartjs', '@fullcalendar/core': '@fullcalendar/vue', 'mapbox-gl': 'vue-mapbox' }
const pkgJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'frontend/package.json'), 'utf8'))
const declared = Object.keys(pkgJson.dependencies || {})
const allSource = [...vueFiles, ...jsFiles].map(f => fs.readFileSync(f, 'utf8')).join('\n') +
  fs.readFileSync(path.join(srcRoot, 'styles/main.scss'), 'utf8')
const notImported = declared.filter(dep => !/^(@vue|@babel|eslint|sass|compression-webpack-plugin|@gfx|vue-template-compiler)/.test(dep))
  .filter(dep => !allSource.includes(`'${dep}`) && !allSource.includes(`"${dep}`) && !allSource.includes(`~${dep}`))
const unusedDependencies = notImported.filter(dep => !PEER_ONLY[dep])
const peerOnlyDependencies = Object.fromEntries(notImported.filter(dep => PEER_ONLY[dep]).map(dep => [dep, `used through ${PEER_ONLY[dep]}`]))

for (const group of ['buefy', 'buefyProgrammatic', 'local', 'bulma']) {
  result[group] = sortObject(Object.fromEntries(Object.entries(buckets[group]).map(([k, b]) => [k, finalize(b)])))
}
result.thirdParty = sortObject(Object.fromEntries(Object.entries(buckets.thirdParty).map(([k, b]) => {
  const out = finalize(b)
  if (b.imports) { out.importedIn = Object.keys(b.imports).sort(); out.importCount = Object.values(b.imports).reduce((n, c) => n + c, 0) }
  return [k, out]
})))
// list third-party libs with zero usage too
for (const lib of Object.keys(THIRD_PARTY)) {
  if (!result.thirdParty[lib]) result.thirdParty[lib] = { uses: 0, fileCount: 0, files: [], note: 'declared but not used in frontend/src' }
}
result.thirdParty = sortObject(result.thirdParty)
result.a11ySignals = sortObject(Object.fromEntries(Object.entries(buckets.a11y).map(([k, b]) => {
  const out = finalize(b)
  out.examples = Object.entries(b.perFile).length ? b.examples : []
  return [k, out]
})))
result.bulmaHelpers = sortByCount(result.bulmaHelpers)
result.directives = sortByCount(result.directives)
result.headings = sortObject(result.headings)
result.htmlElements = sortByCount(result.htmlElements)

const summary = {
  vueFilesScanned: vueFiles.length,
  jsFilesScanned: jsFiles.length,
  buefyComponentTypes: Object.keys(result.buefy).length,
  buefyComponentUses: Object.values(result.buefy).reduce((n, b) => n + b.uses, 0),
  buefyProgrammaticCalls: Object.entries(result.buefyProgrammatic).filter(([k]) => k.startsWith('$buefy')).reduce((n, [, b]) => n + b.uses, 0),
  localComponentUses: Object.values(result.local).reduce((n, b) => n + b.uses, 0),
  bulmaPatternUses: Object.values(result.bulma).reduce((n, b) => n + b.uses, 0),
  unusedDependencies,
  peerOnlyDependencies,
  note: 'Heuristic scan (tag tokenizer + regexes). Counts are close but not exact; dynamic class bindings built from variables are not resolved.'
}

const output = { summary, ...result }
fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, JSON.stringify(output, null, 2) + '\n')

console.log(`Wrote ${rel(outFile)}`)
console.log(`  ${summary.vueFilesScanned} .vue and ${summary.jsFilesScanned} .js files`)
console.log(`  Buefy: ${summary.buefyComponentTypes} component types, ${summary.buefyComponentUses} uses, ${summary.buefyProgrammaticCalls} programmatic calls`)
console.log(`  Bulma pattern uses: ${summary.bulmaPatternUses}; local component uses: ${summary.localComponentUses}`)
console.log(`  Declared but unused dependencies: ${unusedDependencies.join(', ') || 'none'}`)
