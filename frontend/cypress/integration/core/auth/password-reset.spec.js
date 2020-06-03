// / <reference types="cypress" />

context('Password reset', () => {
  beforeEach(() => {
    cy.resetDatabase()
    cy.visit('/password_reset')
  })

  it('should complain if the email is not found', () => {
    cy.get('[data-cy=email]').type('not-existant@example.com')
    cy.get('button').contains('Reset password').click()

    cy.contains('Could not find this email.')
  })

  it('should complain on server errors', () => {
    cy.server()
    cy.route({
      method: 'POST',
      url: /password_reset$/,
      response: 'Some garbage',
      status: 500
    })

    cy.get('[data-cy=email]').type('admin@example.com')
    cy.get('button').contains('Reset password').click()

    cy.contains('Could not reset password')
  })

  it('should succeed if everything is okay', () => {
    cy.get('[data-cy=email]').type('admin@example.com')
    cy.get('button').contains('Reset password').click()

    cy.contains('Password reset triggered. Check your email.')
    cy.url().should('include', '/password_confirm')
  })
})
