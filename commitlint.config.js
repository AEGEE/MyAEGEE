module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Enforce scope (module name) is required
    'scope-empty': [2, 'never'],
    
    // Define valid scopes (module names + special cases)
    'scope-enum': [
      2,
      'always',
      [
        // Module names
        'core',
        'events',
        'frontend',
        'discounts',
        'knowledge',
        'network',
        'statutory',
        'summeruniversity',
        'mailer',
        'dispatcher',
        
        // Infrastructure scopes (trigger all modules)
        'ci',
        'docker',
        'deps',
        'deps-dev',
        'monorepo',
        'infra',
        
        // Documentation
        'docs',
        'readme'
      ]
    ],
    
    // Disable length restrictions
    'header-max-length': [0],
    'footer-max-line-length': [0],
    'body-max-line-length': [0]
  }
};
