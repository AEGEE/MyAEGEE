// / <reference types="cypress" />

context('Password confirm', () => {
  beforeEach(() => {
    cy.resetDatabase()
    cy.visit('/password_confirm')
  })

  it('should complain if the token is not found', () => {
    cy.get('[data-cy=token]').type('not-existant')
    cy.get('[data-cy=password]').type('testtest')
    cy.get('[data-cy=password-confirmation]').type('testtest')
    cy.get('button').contains('Confirm password').click()

    cy.contains('Your token is invalid.')
  })

  it('should complain on server errors', () => {
    cy.server()
    cy.route({
      method: 'POST',
      url: /password_confirm$/,
      response: 'Some garbage',
      status: 500
    })

    cy.get('[data-cy=token]').type('5ecr3t')
    cy.get('[data-cy=password]').type('testtest')
    cy.get('[data-cy=password-confirmation]').type('testtest')
    cy.get('button').contains('Confirm password').click()

    cy.contains('Could not change password')
  })

  it('should complain on validation errors', () => {
    cy.get('[data-cy=token]').type('5ecr3t')
    cy.get('[data-cy=password]').type('test')
    cy.get('[data-cy=password-confirmation]').type('test')
    cy.get('button').contains('Confirm password').click()

    cy.contains('Some of the password data is invalid.')
    cy.contains('Password should be at least 8 characters long.')
  })

  it('should complain on password mismatch', () => {
    cy.get('[data-cy=token]').type('5ecr3t')
    cy.get('[data-cy=password]').type('testtest')
    cy.get('[data-cy=password-confirmation]').type('testtest2')
    cy.get('button').contains('Confirm password').click()

    cy.contains('Password do not match.')
  })

  it('should prefill token if provided', () => {
    cy.visit('/password_confirm?token=5ecr3t')
    cy.get('[data-cy=password]').type('testtest')
    cy.get('[data-cy=password-confirmation]').type('testtest')
    cy.get('button').contains('Confirm password').click()

    cy.contains('Password is changed.')
    cy.url().should('include', '/login')
  })

  it('should succeed if everything is okay', () => {
    cy.get('[data-cy=token]').type('5ecr3t')
    cy.get('[data-cy=password]').type('testtest')
    cy.get('[data-cy=password-confirmation]').type('testtest')
    cy.get('button').contains('Confirm password').click()

    cy.contains('Password is changed.')
    cy.url().should('include', '/login')
  })
})
