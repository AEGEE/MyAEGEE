// / <reference types="cypress" />

context('Members activation', () => {
  beforeEach(() => {
    cy.resetDatabase()
    cy.login()
  })

  it('should suspend user', () => {
    cy.visit('/members/board')

    cy.get('[data-cy=suspend-user-link]').click()
    cy.get('.modal .is-danger').contains('Suspend user').click()
    cy.contains('User is suspended.')
  })

  it('should activate user', () => {
    cy.visit('/members/suspended')

    cy.get('[data-cy=activate-user-link]').click()
    cy.get('.modal .is-primary').contains('Activate user').click()
    cy.contains('User is activated.')
  })

  it('should display an error on network request changing user status', () => {
    cy.visit('/members/board')

    cy.server()
    cy.route({
      method: 'PUT',
      url: /active$/,
      response: 'Some garbage',
      status: 500
    })

    cy.get('[data-cy=suspend-user-link]').click()
    cy.get('.modal .is-danger').contains('Suspend user').click()
    cy.contains('Error changing user status')
  })
})
