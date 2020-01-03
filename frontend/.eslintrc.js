module.exports = {
  root: true,
  env: {
    node: true,
    browser: true
  },
  extends: [
    'plugin:vue/essential',
    '@vue/airbnb',
  ],
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'template-curly-spacing': 'off',
    indent: ['error', 2, {
      ignoredNodes: ['TemplateLiteral'],
    }],
    'no-restricted-syntax': 'off',
    'semi': ['error', 'never'],
    'max-len': 'off',
    'comma-dangle': ['error', 'never'],
    'prefer-template': 'off'
  },
  parserOptions: {
    parser: 'babel-eslint',
  },
};
