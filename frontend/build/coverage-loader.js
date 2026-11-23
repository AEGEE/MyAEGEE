// Webpack loader that instruments the code of src/ for coverage (istanbul). Only used by the
// FRONTEND_COVERAGE=1 build (see vue.config.js), which the end-to-end tests run against.
//
// It runs after babel and knows vue-loader's block requests, so a .vue file gets two entries:
// - its <script>, reported on the lines of the .vue file through babel's source map;
// - its compiled template (the render function), which has no source map. That code is written
//   to <coverage dir>/render/<path under src>.vue.template.js and reported as that file, so the
//   branches of v-if, v-else, v-show and ternaries can be read there.
// Every file's empty coverage goes to <coverage dir>/baseline/, so files that no test loads
// count as uncovered instead of being left out.
const fs = require('fs')
const path = require('path')
const qs = require('querystring')
const babel = require('@babel/core')
const { createInstrumenter, readInitialCoverage } = require('istanbul-lib-instrument')

const srcRoot = path.resolve(__dirname, '../src')
const coverageDir = path.resolve(process.env.FRONTEND_COVERAGE_DIR || path.resolve(__dirname, '../../e2e/.coverage/build'))
const renderRoot = path.join(coverageDir, 'render')
const baselineRoot = path.join(coverageDir, 'baseline')

const isPitcher = (loader) => /vue-loader(-v15)?[\\/]lib[\\/]loaders[\\/]pitcher/.test(loader.path)

// Code that Vue generates for v-model and for event modifiers (`if ($event.target.composing) return`,
// `$$el.checked ? true : false`, key checks). Nobody wrote it and half of it can't run, so its
// branches would only be noise in the numbers. build/coverage-loader.test.js shows what is
// left out and what still counts.
const isEventName = (name) => name === '$event' || name.startsWith('$$')
const readsEventCode = (testPath) => {
  if (testPath.isIdentifier()) return isEventName(testPath.node.name)
  let found = false
  testPath.traverse({
    ReferencedIdentifier (idPath) {
      if (!isEventName(idPath.node.name)) return
      found = true
      idPath.stop()
    }
  })
  return found
}

const IGNORE = ' istanbul ignore next '

// Changes to the render function before it is instrumented.
const renderBranches = ({ types: t }) => {
  const ignore = (node) => {
    const marked = (node.leadingComments || []).some((comment) => comment.value === IGNORE)
    if (!marked) t.addComment(node, 'leading', IGNORE)
  }

  // The whole statement is left out, not only the condition: istanbul loses a comment on an
  // expression when it wraps that expression in a counter.
  const ignoreEventCode = (nodePath) => {
    if (!readsEventCode(nodePath.get('test'))) return
    ignore(nodePath.getStatementParent().node)
  }

  // Two more ternaries that Vue writes for v-model have no `$event` in their condition. Both
  // are matched by the exact code Vue generates (genSelect and genCheckboxModel in its
  // compiler), so a ternary somebody wrote in a template is still counted.

  // v-model on a <select>, in the handler of its change event:
  //   var $$selectedVal = Array.prototype.filter.call($event.target.options, function (o) { return o.selected })
  //     .map(function (o) { var val = "_value" in o ? o._value : o.value; return val })
  // Vue sets `_value` on an <option> only when its value is bound (`:value`). A select whose
  // options are all bound, or all fixed, can only ever run one side of this.
  const isSelectedValue = (nodePath) => {
    const { test, consequent, alternate } = nodePath.node
    if (!t.isBinaryExpression(test, { operator: 'in' }) || !t.isStringLiteral(test.left, { value: '_value' }) || !t.isIdentifier(test.right)) return false
    const reads = (node, property) => t.isMemberExpression(node, { computed: false })
      && t.isIdentifier(node.object, { name: test.right.name })
      && t.isIdentifier(node.property, { name: property })
    if (!reads(consequent, '_value') || !reads(alternate, 'value')) return false
    // `$$selectedVal` can't be declared in a template: only Vue's handler has it.
    return !!nodePath.findParent((parent) => parent.isVariableDeclarator() && t.isIdentifier(parent.node.id, { name: '$$selectedVal' }))
  }

  // v-model on a checkbox, in its `checked` property:
  //   domProps: { "checked": Array.isArray(_vm.x) ? _vm._i(_vm.x, null) > -1 : _vm.x }
  // (`: _vm._q(_vm.x, "yes")` with a true-value). A checkbox is bound to a list or to one
  // value, never to both, so one side of this never runs.
  const isCheckedValue = (nodePath) => {
    const { test, consequent, alternate } = nodePath.node
    const helper = (node, name) => t.isCallExpression(node)
      && t.isMemberExpression(node.callee, { computed: false })
      && t.isIdentifier(node.callee.property, { name })
      && node.arguments.length === 2
    if (!t.isCallExpression(test) || !t.matchesPattern(test.callee, 'Array.isArray') || test.arguments.length !== 1) return false
    const [model] = test.arguments
    const inList = t.isBinaryExpression(consequent, { operator: '>' })
      && helper(consequent.left, '_i')
      && t.isNodesEquivalent(consequent.left.arguments[0], model)
      && t.isUnaryExpression(consequent.right, { operator: '-' })
      && t.isNumericLiteral(consequent.right.argument, { value: 1 })
    const isValue = t.isNodesEquivalent(alternate, model)
      || (helper(alternate, '_q') && t.isNodesEquivalent(alternate.arguments[0], model))
    if (!inList || !isValue) return false
    const named = (propertyPath, name) => propertyPath.isObjectProperty() && !propertyPath.node.computed
      && (t.isIdentifier(propertyPath.node.key, { name }) || t.isStringLiteral(propertyPath.node.key, { value: name }))
    const property = nodePath.parentPath
    return named(property, 'checked') && property.parentPath.isObjectExpression() && named(property.parentPath.parentPath, 'domProps')
  }

  const ignoreModelCode = (nodePath) => {
    // The statement holds nothing else: `var val = …`.
    if (isSelectedValue(nodePath)) ignore(nodePath.getStatementParent().node)
    // The statement around this one is the whole render function, so only the ternary is
    // marked. That works here because istanbul doesn't wrap the value of a property.
    else if (isCheckedValue(nodePath)) ignore(nodePath.node)
  }

  return {
    visitor: {
      // v-show compiles to a directive value, not to a branch. `value: x` becomes
      // `value: x ? true : false`, so both outcomes are counted like those of a v-if.
      ObjectExpression (nodePath) {
        const props = nodePath.node.properties.filter((prop) => t.isObjectProperty(prop) && t.isIdentifier(prop.key))
        const name = props.find((prop) => prop.key.name === 'name')
        const value = props.find((prop) => prop.key.name === 'value')
        if (!name || !value || !t.isStringLiteral(name.value, { value: 'show' })) return
        if (!t.isConditionalExpression(value.value)) {
          value.value = t.conditionalExpression(value.value, t.booleanLiteral(true), t.booleanLiteral(false))
        }
      },
      IfStatement: ignoreEventCode,
      ConditionalExpression (nodePath) {
        ignoreEventCode(nodePath)
        ignoreModelCode(nodePath)
      }
    }
  }
}

const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

module.exports = function coverageLoader (source, map) {
  const query = qs.parse((this.resourceQuery || '').replace(/^\?/, ''))
  const isVue = this.resourcePath.endsWith('.vue')
  const skip = !this.resourcePath.startsWith(srcRoot + path.sep)
    // Styles and custom blocks of a .vue file.
    || (isVue && !['script', 'template'].includes(query.type))
    // vue-loader's pitcher answers a block request with a re-export of the real request.
    || this.loaders.some(isPitcher)
    // That real request lists this loader again, next to the rule that adds it. Only the
    // outermost one works: the others can sit behind vue-loader's cache and not run at all.
    || this.loaders.findIndex((loader) => loader.path === __filename) !== this.loaderIndex
  if (skip) return this.callback(null, source, map)

  const relative = path.relative(srcRoot, this.resourcePath)
  let filename = this.resourcePath
  let baseline = path.join(baselineRoot, `${relative}.json`)
  let inputMap

  if (isVue && query.type === 'template') {
    filename = path.join(renderRoot, `${relative}.template.js`)
    baseline = path.join(baselineRoot, `${relative}.template.json`)
    source = babel.transformSync(source, {
      babelrc: false,
      configFile: false,
      sourceType: 'module',
      compact: false,
      plugins: [renderBranches]
    }).code
    write(filename, source)
  } else if (map && typeof map === 'object' && map.sources) {
    // istanbul keeps the map with the file's coverage and hashes both, and the tests' results
    // are only merged when the hashes are the same. So the map gets the same shape in every
    // build: these keys in this order (a map from babel-loader's cache has them in another
    // order than a new one), and the whole path of the sources (vue-loader and babel name them
    // relative to the project, where istanbul wouldn't find them).
    inputMap = {
      version: map.version,
      sources: map.sources.map((file) => path.resolve(this.rootContext, file.replace(/^webpack:\/\/[^/]*\//, '').replace(/\?.*$/, ''))),
      names: map.names,
      sourcesContent: map.sourcesContent,
      mappings: map.mappings
    }
  }

  const instrumenter = createInstrumenter({ esModules: true, produceSourceMap: true, compact: false })
  const code = instrumenter.instrumentSync(source, filename, inputMap)
  // The hash is what the instrumented code carries; merging the test results compares it,
  // to tell when they come from different builds.
  const initial = readInitialCoverage(code)
  if (initial) write(baseline, JSON.stringify({ [filename]: { ...instrumenter.lastFileCoverage(), hash: initial.hash } }))
  return this.callback(null, code, instrumenter.lastSourceMap())
}
