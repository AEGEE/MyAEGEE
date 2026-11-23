// Which branches of a compiled template the coverage loader counts. Each test compiles a small
// template the way the build does and runs it through the loader, then reads what istanbul
// would report for it.
//
// Run: node --test frontend/build/   (part of `npm run lint` in e2e/)
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { after, test } = require('node:test')
const { compileTemplate } = require('vue/compiler-sfc')

// The loader reads where to write when it is loaded.
const coverageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-loader-test-'))
process.env.FRONTEND_COVERAGE_DIR = coverageDir
const loaderPath = require.resolve('./coverage-loader')
const loader = require('./coverage-loader')

after(() => fs.rmSync(coverageDir, { recursive: true, force: true }))

let files = 0

// The conditions of the branches istanbul counts for a template, as the report's render file
// has them: of every `a ? b : c` and `if (a)` (what the gate counts), and separately of every
// `a && b` and `a || b` (reported for information only).
const branchesOf = (template) => {
  const name = `views/test/Case${++files}.vue`
  const resourcePath = path.resolve(__dirname, '../src', name)
  const compiled = compileTemplate({ source: template, filename: resourcePath, isProduction: true, prettify: false })
  assert.deepEqual(compiled.errors, [])

  let instrumented
  loader.call({
    resourcePath,
    resourceQuery: '?vue&type=template&id=1',
    rootContext: path.resolve(__dirname, '..'),
    loaders: [{ path: loaderPath }],
    loaderIndex: 0,
    callback (error, code) {
      if (error) throw error
      instrumented = code
    }
  }, `${compiled.code}\nexport { render, staticRenderFns }`)
  assert.match(instrumented, /cov_\w+/)

  const render = fs.readFileSync(path.join(coverageDir, 'render', `${name}.template.js`), 'utf8')
  const [coverage] = Object.values(JSON.parse(fs.readFileSync(path.join(coverageDir, 'baseline', `${name}.template.json`), 'utf8')))
  const lines = render.split('\n')
  const textAt = ({ start, end }) => (start.line === end.line
    ? lines[start.line - 1].slice(start.column, end.column)
    : [lines[start.line - 1].slice(start.column), ...lines.slice(start.line, end.line - 1), lines[end.line - 1].slice(0, end.column)].join(' ')
  ).replace(/\s+/g, ' ')

  const counted = []
  const shortCircuits = []
  for (const branch of Object.values(coverage.branchMap)) {
    if (branch.type === 'binary-expr') shortCircuits.push(textAt(branch.loc))
    else counted.push(textAt(branch.loc))
  }
  return { counted, shortCircuits, render }
}

const conditions = (template) => branchesOf(template).counted.map((text) => text.split(/ \? |\) \{/)[0].replace(/^if \(/, ''))

test('v-if, v-else, ternaries and v-show are counted', () => {
  assert.deepEqual(conditions(`
    <div>
      <p v-if="can.edit">Edit</p>
      <p v-else>Read only</p>
      <span>{{ event.open ? 'Open' : 'Closed' }}</span>
      <em v-show="isLoading">Loading</em>
    </div>
  `), ['_vm.can.edit', '_vm.event.open', '_vm.isLoading'])
})

test('the code Vue writes for v-model on a select is not counted', () => {
  const template = `
    <div>
      <select v-model="body.type">
        <option value="antenna">Antenna</option>
        <option :value="other">Other</option>
      </select>
      <select v-model.number="limit" multiple><option v-for="size in sizes" :value="size">{{ size }}</option></select>
      <p v-if="body.type">Chosen</p>
    </div>
  `
  const { render } = branchesOf(template)
  // Both ternaries of each handler are in the code: which options are selected, one or many.
  assert.equal((render.match(/"_value" in o \? o\._value : o\.value/g) || []).length, 2)
  assert.equal((render.match(/\$event\.target\.multiple \? \$\$selectedVal : \$\$selectedVal\[0\]/g) || []).length, 2)

  assert.deepEqual(conditions(template), ['_vm.body.type'])
})

test('the code Vue writes for v-model on a checkbox is not counted', () => {
  const template = `
    <div>
      <input type="checkbox" v-model="agreed">
      <input type="checkbox" v-model="answer" true-value="yes" false-value="no">
      <input type="checkbox" v-model="picked" :value="option.id">
      <p v-if="agreed">Thanks</p>
    </div>
  `
  const { render, shortCircuits } = branchesOf(template)
  // The `checked` property of each, and the list check in each handler.
  assert.equal((render.match(/"checked": \/\* istanbul ignore next \*\/\s*Array\.isArray\(/g) || []).length, 3)
  assert.equal((render.match(/if \(Array\.isArray\(\$\$a\)\)/g) || []).length, 3)

  assert.deepEqual(conditions(template), ['_vm.agreed'])
  // Nor the `$$i < 0 && (…)` of the handlers, in the numbers that are for information.
  assert.deepEqual(shortCircuits, [])
})

test('a text field, a radio button and a component with v-model have nothing to leave out', () => {
  assert.deepEqual(conditions(`
    <div>
      <input type="text" v-model.trim="name">
      <input type="radio" v-model="kind" value="a">
      <b-input v-model="search" />
      <p v-if="name">Hello</p>
    </div>
  `), ['_vm.name'])
})

test('a ternary somebody wrote is counted, also when it looks like Vue\'s', () => {
  assert.deepEqual(conditions(`
    <div>
      <span>{{ Array.isArray(answer) ? answer.join(', ') : answer }}</span>
      <input type="checkbox" :checked="Array.isArray(picked) ? picked.includes(option.id) : picked" @change="toggle(option)">
      <input type="checkbox" :checked="Array.isArray(picked) ? _i(picked, null) > -1 : other">
      <span :title="Array.isArray(picked) ? _i(picked, null) > -1 : picked">in a title, not a checked property</span>
      <span>{{ options.map(o => ('_value' in o ? o._value : o.value)).join() }}</span>
    </div>
  `), [
    'Array.isArray(_vm.answer)',
    'Array.isArray(_vm.picked)',
    'Array.isArray(_vm.picked)',
    'Array.isArray(_vm.picked)',
    '\'_value\' in o'
  ])
})

test('an event handler that looks at the event is not counted, one that looks at the page is', () => {
  assert.deepEqual(conditions(`
    <div>
      <input @keyup.enter="search()" @input="dirty = $event.target.value ? true : false">
      <button @click="isOpen ? close() : open()">Toggle</button>
    </div>
  `), ['_vm.isOpen'])
})
