// / <reference types="cypress" />

context('Register', () => {
  beforeEach(() => {
    cy.resetDatabase()
    cy.visit('/signup/default')
  })

  it('should complain if the passwords mismatch', () => {
    cy.visit('/signup/default')

    cy.get('[data-cy=username]').type('test')
    cy.get('[data-cy=email]').type('test@example.com')
    cy.get('[data-cy=password]').type('testtest')
    cy.get('[data-cy=password-confirmation]').type('testtest2')
    cy.get('[data-cy=first-name]').type('test')
    cy.get('[data-cy=last-name]').type('test')
    cy.get('[data-cy=agree-to-privacy-policy]').check()

    cy.get('button').contains('Register').click()

    cy.contains('Passwords do not match')
  })

  it('should complain if didn\'t agree to privacy policy', () => {
    cy.visit('/signup/default')

    cy.get('[data-cy=username]').type('test')
    cy.get('[data-cy=email]').type('test@example.com')
    cy.get('[data-cy=password]').type('testtest')
    cy.get('[data-cy=password-confirmation]').type('testtest')
    cy.get('[data-cy=first-name]').type('test')
    cy.get('[data-cy=last-name]').type('test')

    cy.get('button').contains('Register').click()

    cy.contains('You need to agree with our Privacy Policy.')
  })

  it('should complain if the company is not found', () => {
    cy.visit('/signup/non-existant')

    cy.get('[data-cy=username]').type('test')
    cy.get('[data-cy=email]').type('test@example.com')
    cy.get('[data-cy=password]').type('testtest')
    cy.get('[data-cy=password-confirmation]').type('testtest')
    cy.get('[data-cy=first-name]').type('test')
    cy.get('[data-cy=last-name]').type('test')
    cy.get('[data-cy=agree-to-privacy-policy]').check()

    cy.get('button').contains('Register').click()

    cy.contains('The registration campaign is not found.')
  })

  it('should complain on validation errors', () => {
    cy.visit('/signup/default')

    cy.get('[data-cy=username]').type('admin')
    cy.get('[data-cy=email]').type('test@example.com')
    cy.get('[data-cy=password]').type('testtest')
    cy.get('[data-cy=password-confirmation]').type('testtest')
    cy.get('[data-cy=first-name]').type('test')
    cy.get('[data-cy=last-name]').type('test')
    cy.get('[data-cy=agree-to-privacy-policy]').check()

    cy.get('button').contains('Register').click()

    cy.contains('Some of the registration data is invalid.')
  })

  it('should complain on server errors', () => {
    cy.visit('/signup/default')

    cy.server()
    cy.route({
      method: 'POST',
      url: /signup\/default$/,
      response: 'Some garbage',
      status: 500
    })

    cy.get('[data-cy=username]').type('test')
    cy.get('[data-cy=email]').type('test@example.com')
    cy.get('[data-cy=password]').type('testtest')
    cy.get('[data-cy=password-confirmation]').type('testtest')
    cy.get('[data-cy=first-name]').type('test')
    cy.get('[data-cy=last-name]').type('test')
    cy.get('[data-cy=agree-to-privacy-policy]').check()

    cy.get('button').contains('Register').click()

    cy.contains('Could not register')
  })

  it('should succeed if everything is okay', () => {
    cy.visit('/signup/default')

    cy.get('[data-cy=username]').type('test')
    cy.get('[data-cy=email]').type('test@example.com')
    cy.get('[data-cy=password]').type('testtest')
    cy.get('[data-cy=password-confirmation]').type('testtest')
    cy.get('[data-cy=first-name]').type('test')
    cy.get('[data-cy=last-name]').type('test')
    cy.get('[data-cy=agree-to-privacy-policy]').check()

    cy.get('button').contains('Register').click()

    cy.contains('Your submission is registered.')
  })
})
