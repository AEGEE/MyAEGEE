// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add("login", (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add("drag", { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add("dismiss", { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite("visit", (originalFn, url, options) => { ... })

import moment from 'moment'

Cypress.Commands.add('resetDatabase', () => {
  cy.exec('(cd .. && ./helper.sh --docker -- exec -T oms-core-js sh -c \\\'npm run db:clear \\&\\& npm run db:seed\\\')')
})

Cypress.Commands.add('login', (username = 'admin@example.com', password = '5ecr3t5ecr3t') => {
  cy.request({
    method: 'POST',
    url: '/api/core/login',
    body: {
      username,
      password
    }
  })
    .its('body')
    .then((body) => {
      window.localStorage.setItem('access-token', body.access_token)
      window.localStorage.setItem('refresh-token', body.refresh_token)
    })
})

Cypress.Commands.add('typeDate', (element, date) => {
  const dayOfWeek = moment(date).day()
  const day = moment(date).format('D')
  const month = moment(date).format('MMMM')
  const year = moment(date).format('YYYY')

  // doing some black magic to set the date to 1973-02-02
  // 1) fill in the month
  // 2) fill in the year
  // 3) wait for the day to be at the correct position
  // 4) click it
  cy.get(`${element} input`).click()
  cy.get(`${element} select`).eq(0).select(month)
  cy.get(`${element} select`).eq(1).select(year)
  cy.get(`${element} .datepicker-cell.is-selectable`).eq(dayOfWeek).contains('a', new RegExp(day)).click()
})
