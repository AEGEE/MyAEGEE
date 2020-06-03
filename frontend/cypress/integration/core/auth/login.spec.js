// / <reference types="cypress" />

context('Login', () => {
  beforeEach(() => {
    cy.resetDatabase()
  })

  it('should allow you to login with correct password', () => {
    cy.visit('/campaigns')

    cy.url().should('include', '/login')

    cy.get('form input[type=email]').type('admin@example.com')
    cy.get('form input[type=password]').type('5ecr3t5ecr3t')

    cy.get('form').contains('Login').click()

    cy.url().should('include', '/campaigns')
  })

  it('should redirect you after login', () => {
    cy.visit('/login')

    cy.get('form input[type=email]').type('admin@example.com')
    cy.get('form input[type=password]').type('5ecr3t5ecr3t')

    cy.get('form').contains('Login').click()

    cy.url().should('include', '/dashboard')
  })

  it('should display an error on invalid password', () => {
    cy.visit('/login')

    cy.get('form input[type=email]').type('admin@example.com')
    cy.get('form input[type=password]').type('invalid')

    cy.get('form').contains('Login').click()

    cy.contains('Password is not valid.')
  })

  it('should display an error on backend error', () => {
    cy.visit('/login')

    cy.server()
    cy.route('POST', /login/, 'Some garbage')

    cy.get('form input[type=email]').type('admin@example.com')
    cy.get('form input[type=password]').type('invalid')

    cy.get('form').contains('Login').click()

    cy.contains('An error occured while logging in.')
  })
})
