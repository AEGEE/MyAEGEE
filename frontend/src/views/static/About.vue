<template>
  <div class="tile is-ancestor legal">
    <div class="tile is-parent is-vertical">
      <div class="tile is-child">
        <div class="title">MyAEGEE - Online Membership System</div>

        <hr />

        <div class="content">
          <h2>Technologies used</h2>

          <table class="table is-bordered is-striped is-narrow is-fullwidth">
            <thead>
              <tr>
                <th>Name</th>
                <th>What we're using it for</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td><a href="https://www.docker.com/">Docker</a> + <a href="https://docs.docker.com/compose/">Docker Compose</a></td>
                <td>For running applications in containers and for development/production environment.</td>
              </tr>

              <tr>
                <td><a href="https://nodejs.org/en/">Node.js</a> + <a href="http://expressjs.com/">Express</a></td>
                <td>Running the backend of core, statutory and events module, and also for building assets for frontend.</td>
              </tr>

              <tr>
                <td><a href="https://www.postgresql.org/">PostgreSQL</a></td>
                <td>Database used by core, events and statutory modules.</td>
              </tr>

              <tr>
                <td><a href="https://github.com/sequelize/sequelize">Sequelize</a></td>
                <td>ORM for statutory module for interacting with PostgreSQL.</td>
              </tr>

              <tr>
                <td><a href="https://vuejs.org/">Vue.js</a></td>
                <td>Frontend framework, because of that you are able to use OMS :D</td>
              </tr>

              <tr>
                <td><a href="https://webpack.js.org/">Webpack</a></td>
                <td>Frontend building system</td>
              </tr>

              <tr>
                <td><a href="https://bulma.io/">Bulma</a></td>
                <td>CSS framework, makes this website looks fancy.</td>
              </tr>

              <tr>
                <td><a href="https://fontawesome.com/">FontAwesone</a></td>
                <td>Fancy icons you can see at the sidebar, for example.</td>
              </tr>

              <tr>
                <td><a href="https://github.com/vue-bulma/vue-admin">Vue Admin</a></td>
                <td>This whole project is a rewrite of Vue Admin and therefore uses a lof of things that were implemented as a part of Vue Admin project.</td>
              </tr>
            </tbody>
          </table>

          <h2>Services used</h2>
          <div class="content">
            <p>We use the following technologies:</p>
          </div>

          <div class="images-block">
            <a href="https://www.docker.com/" target="_blank" rel="noopener noreferrer">
              <img src="/images/partners-logos/docker.svg" alt="Docker" />
            </a>
            <a href="https://git-scm.com/" target="_blank" rel="noopener noreferrer">
              <img src="/images/partners-logos/git.png" alt="Git" />
            </a>
            <a href="https://circleci.com/" target="_blank" rel="noopener noreferrer">
              <img src="/images/partners-logos/circle.svg" alt="Circle CI" />
            </a>
            <a href="https://codecov.io/" target="_blank" rel="noopener noreferrer">
              <img src="/images/partners-logos/codecov.png" alt="Codecov" />
            </a>
            <a href="https://slack.com/intl/de-de/?eu_nc=1" target="_blank" rel="noopener noreferrer">
              <img src="/images/partners-logos/slack.svg" alt="Slack" />
            </a>
          </div>

          <div class="content">
            <p>We also use the following technologies as donations (thank you!). We are in no way associated with the companies, and their logos are used with permission:</p>
          </div>

          <div class="images-block">
            <a href="https://auth0.com/" target="_blank" rel="noopener noreferrer">
              <img src="/images/partners-logos/auth0.svg" alt="Auth0" />
            </a>
            <a href="https://1password.com/" target="_blank" rel="noopener noreferrer">
              <img src="/images/partners-logos/1password.png" alt="1password" />
            </a>
            <a href="https://azure.microsoft.com/en-us/" target="_blank" rel="noopener noreferrer">
              <img src="/images/partners-logos/azure.svg" alt="Microsoft Azure" />
            </a>
            <a href="https://www.office.com/" target="_blank" rel="noopener noreferrer">
              <img src="/images/partners-logos/o365.svg" alt="Microsoft O365" />
            </a>
            <a href="https://www.atlassian.com/software/jira" target="_blank" rel="noopener noreferrer">
              <img src="/images/partners-logos/jira-core.svg" alt="Jira" />
            </a>
            <a href="https://github.com/" target="_blank" rel="noopener noreferrer">
              <img src="/images/partners-logos/github.png" alt="GitHub" />
            </a>
            <a href="https://www.atlassian.com/software/jira/service-desk" target="_blank" rel="noopener noreferrer">
              <img src="/images/partners-logos/jira-service-desk.svg" alt="Jira Service Desk" />
            </a>
            <a href="https://www.bugsnag.com/" target="_blank" rel="noopener noreferrer">
              <img src="/images/partners-logos/bugsnag.png" alt="Bugsnag" />
            </a>
            <a href="https://www.atlassian.com/software/confluence" target="_blank" rel="noopener noreferrer">
              <img src="/images/partners-logos/confluence.svg" alt="Confluence" />
            </a>
            <a href="https://workspace.google.com/" target="_blank" rel="noopener noreferrer">
              <img src="/images/partners-logos/gsuite.svg" alt="Google Workspace" />
            </a>
            <a href="https://www.elastic.co/" target="_blank" rel="noopener noreferrer">
              <img src="/images/partners-logos/elastic.svg" alt="Elastic" />
            </a>
          </div>

          <h2>Microservices</h2>

          <table class="table is-bordered is-striped is-narrow is-fullwidth">
            <thead>
              <tr>
                <th>Name</th>
                <th>Responsibilities</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td><a href="https://github.com/AEGEE/core">core</a></td>
                <td>Bodies, memberships, permissions management, registration.</td>
              </tr>

              <tr>
                <td><a href="https://github.com/AEGEE/statutory">statutory</a></td>
                <td>Agora and EPM applications, candidatures, proposals, motions, votings.</td>
              </tr>

              <tr>
                <td><a href="https://github.com/AEGEE/events">events</a></td>
                <td>Events (not statutory and SU) and their application procedure.</td>
              </tr>

              <tr>
                <td><a href="https://github.com/AEGEE/mailer">mailer</a></td>
                <td>Internal mailer (every email sent from our system is going through it).</td>
              </tr>

              <tr>
                <td><a href="https://github.com/AEGEE/discounts">discounts</a></td>
                <td>Discount code storage and retrieval.</td>
              </tr>

              <tr>
                <td><a href="https://github.com/AEGEE/network">network</a></td>
                <td>Network history and status.</td>
              </tr>

              <tr>
                <td><a href="https://github.com/AEGEE/gsuite-wrapper">gsuite-wrapper</a></td>
                <td>Integrates Google Workspace (formerly GSuite) with MyAEGEE.</td>
              </tr>
            </tbody>
          </table>

          <h2>Developers</h2>

          <table class="table is-bordered is-striped is-narrow is-fullwidth">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contribution</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td><a href="https://github.com/linuxbandit">Fabrizio Bellicano</a></td>
                <td>Founder of the project; proof-of-concepts, infrastructure, deployment scripts, and processes. General integrations</td>
              </tr>

              <tr>
                <td><a href="https://github.com/wikirik">Rik Smale</a></td>
                <td>Project manager & Maintainer of frontend, core, events, and statutory modules</td>
              </tr>
            </tbody>
          </table>

          <div class="content">
            <p>Also this website wouldn't exist without these people:</p>
            <ul>
              <li><strong>Sergey Peshkov</strong> - creator of frontend, core, events, and statutory modules</li>
              <li><strong>Dilyan Palauzov</strong> - helping integrating MyAEGEE with the mail server</li>
              <li><strong>George Dimitrakopoulos</strong> - helping integrating MyAEGEE with the JC OMS module</li>
              <li><strong>Philipp von Klitzing</strong> - monitoring improvements and general advices</li>
              <li><strong>Wim van Ravesteijn</strong> - maintaining the previous systems and helping with setting up domains and DNS</li>
              <li><strong>Tekla Hajdu</strong> - reporting a lot of bugs and clarifying procedures as a former CD/Chair/NetCom</li>
              <li><strong>Nico Westerbeck</strong> - deployment scripts and previous system of the core module</li>
              <li><strong>Derk Snijders</strong> - deployment scripts and previous system of the frontend</li>
              <li><strong>Flaviu Porutiu</strong> - development of the previous system of the core module</li>
              <li><strong>Veva Chmelarova and Timo Haarman</strong> - clarifying procedures and collaboration as Chair Team</li>
              <li><strong>Giuseppe Aquilino and Lisette Kunst</strong> - clarifying procedures and collaboration as JC member</li>
              <li><strong>Oksana Prokopchenko and Karolina Lapczyk</strong> - clarifying procedures and collaboration as Netcommies</li>
              <li><strong>Matis Joab, Evrim Emiroğlu and Alejandra Piot Pérez-Abadín</strong> - clarifying procedures and collaboration as the members of the Comite Directeur</li>
              <li><strong>Daniele Napolitano</strong> - reporting MyAEGEE issues</li>
              <li>... and many many other people who also helped us with every aspect of the system.</li>
            </ul>

            <p>Do you want to join the development team? Are you interested in helping MyAEGEE to become better and better? Contact us here: <a href="https://myaegee.slack.com/" target="_blank" rel="noopener noreferrer">https://myaegee.slack.com/</a> using your @aegee.eu or @aegee.org email. (IT knowledge is not a must, we have a lot of things you can help with.)</p>

            <p>Have you found an issue on MyAEGEE? Do you want to know more about it? Submit a ticket to <a href="https://aegee.org/support" target="_blank" rel="noopener noreferrer">AEGEE's helpdesk</a> and we'll see what we can do.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.images-block img {
  height: 80px;
  padding-right: 40px;
  padding-bottom: 20px;
}
</style>
