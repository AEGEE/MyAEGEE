<template>
  <div class="tile is-ancestor legal">
    <div class="tile is-parent is-vertical">
      <div class="tile is-child">
        <div class="title">OMS - Online Membership System</div>

        <hr/>

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
                <td>Running the backend of statutory and events module, and also for building assets for frontend.</td>
              </tr>

              <tr>
                <td><a href="https://elixir-lang.org/">Elixir</a> + <a href="http://phoenixframework.org/">Phoenix</a></td>
                <td>Running the backend of core module.</td>
              </tr>

              <tr>
                <td><a href="https://www.mongodb.com/">MongoDB</a></td>
                <td>Database used by oms-events module.</td>
              </tr>

              <tr>
                <td><a href="https://www.postgresql.org/">PostgreSQL</a></td>
                <td>Database used by oms-core and oms-statutory modules.</td>
              </tr>

              <tr>
                <td><a href="http://mongoosejs.com/">Mongoose</a></td>
                <td>ORM for oms-events module for interacting with MongoDB.</td>
              </tr>

              <tr>
                <td><a href="https://github.com/sequelize/sequelize">Sequelize</a></td>
                <td>ORM for oms-statutory module for interacting with PostgreSQL.</td>
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
            <img src="/images/partners-logos/docker.svg" alt="Docker" />
            <img src="/images/partners-logos/git.png" alt="Git" />
            <img src="/images/partners-logos/travis.svg" alt="Travis CI" />
            <img src="/images/partners-logos/codecov.png" alt="Codecov" />
            <img src="/images/partners-logos/slack.svg" alt="Slack" />
          </div>

          <div class="content">
            <p>We also use the following technologies as donations (thank you!). We are in no way associated with the companies, and their logos are used with permission:</p>
          </div>

          <div class="images-block">
            <img src="/images/partners-logos/auth0.svg" alt="Auth0" />
            <img src="/images/partners-logos/1password.png" alt="1password" />
            <img src="/images/partners-logos/azure.svg" alt="Microsoft Azure" />
            <img src="/images/partners-logos/o365.svg" alt="Microsoft O365" />
            <img src="/images/partners-logos/jira-core.svg" alt="Jira" />
            <img src="/images/partners-logos/github.png" alt="GitHub" />
            <img src="/images/partners-logos/jira-service-desk.svg" alt="Jira Service Desk" />
            <img src="/images/partners-logos/bugsnag.png" alt="Bugsnag" />
            <img src="/images/partners-logos/confluence.png" alt="Confluence" />
            <img src="/images/partners-logos/gsuite.svg" alt="GSuite" />
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
                <td><a href="https://github.com/AEGEE/oms-core-elixir">oms-core-elixir<a></td>
                <td>Bodies, memberships, permissions management, registration.</td>
              </tr>

              <tr>
                <td><a href="https://github.com/AEGEE/oms-statutory">oms-statutory<a></td>
                <td>Agora and EPM applications, candidatures, proposals, motions, votings.</td>
              </tr>

              <tr>
                <td><a href="https://github.com/AEGEE/oms-events">oms-events<a></td>
                <td>Events (not statutory and SU) and their application procedure.</td>
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
                <td><a href="https://github.com/linuxbandit">Fabrizio Bellicano<a></td>
                <td>Deployment scripts and processes</td>
              </tr>

              <tr>
                <td><a href="https://github.com/serge1peshcoff">Sergey Peshkov</a></td>
                <td>Maintainer of oms-events and oms-statutory modules and the frontend</td>
              </tr>

              <tr>
                <td><a href="https://github.com/blacksph3re">Nico Westerbeck</td>
                <td>Maintainer of oms-core module, developed deployment scripts.</td>
              </tr>

              <tr>
                <td><a href="https://github.com/i3anaan/">Derk Snijders</td>
                <td>Development of deployment scripts and frontend.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
