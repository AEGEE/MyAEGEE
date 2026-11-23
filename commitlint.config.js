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
        'network',
        'statutory',
        'summeruniversity',
        'mailer',
        'dispatcher',
        'e2e',
        
        // Infrastructure scopes (describe the change; releases depend only on
        // which module folders a commit changes, see CONTRIBUTING.md)
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
