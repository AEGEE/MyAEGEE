module.exports = {
  root: true,
  env: {
    node: true,
    browser: true
  },
  extends: [
    'plugin:vue/essential',
    'plugin:cypress/recommended',
    '@vue/airbnb'
  ],
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'template-curly-spacing': 'off',
    indent: ['error', 2, {
      ignoredNodes: ['TemplateLiteral']
    }],
    'no-restricted-syntax': 'off',
    'semi': ['error', 'never'],
    'max-len': 'off',
    'comma-dangle': ['error', 'never'],
    'prefer-template': 'off',
    'object-curly-newline': 'off',
    'arrow-parens': 'off',
    'space-before-function-paren': ['error', 'always'],
    'no-plusplus': 'off',
    'consistent-return': 'off',
    'no-continue': 'off',
    'no-param-reassign': 'off',
    'import/extensions': 'off',
    'no-mixed-operators': 'off',
    'no-multi-assign': 'off',
    'func-names': 'off',
    'guard-for-in': 'off',
    'prefer-destructuring': 'off',
    'no-underscore-dangle': 'off',
    'no-await-in-loop': 'off',
    'no-prototype-builtins': 'off',
    'quote-props': 'off',
    'arrow-body-style': 'off',
    'import/no-extraneous-dependencies': 'off',
    'dot-notation': 'off',
    'vue/no-mutating-props': 'off'
  },
  parserOptions: {
    parser: 'babel-eslint'
  }
}
