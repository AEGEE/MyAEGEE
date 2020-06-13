<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">Services statuses</h4>

        <table class="table is-bordered is-striped is-narrow is-fullwidth">
          <thead>
            <tr>
              <th>Name</th>
              <th>Version</th>
              <th>Latest version</th>
              <th>Changelog</th>
              <th>Round-trip time</th>
              <th>Is alive?</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(value, service) in statuses" v-bind:key="service">
              <td>{{ value.name || service }}</td>
              <td>{{ value.version }}</td>
              <td>{{ value.latestVersion }}</td>
              <td v-if="value.changelog">
                <a :href="value.changelog" target="_blank">{{ value.changelog }}</a>
              </td>
              <td v-else>-</td>
              <td v-if="value.roundTrip">{{ value.roundTrip }} ms.</td>
              <td v-else>-</td>
              <td>
                <span class="tag is-small" :class="calculateClassForService(value.isAlive)">{{ value.isAlive | beautify }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </article>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'Status',
  data () {
    return {
      statuses: {
        'oms-core-elixir': {
          name: 'oms-core-js',
          roundTrip: null,
          version: '-',
          latestVersion: '-',
          isAlive: 'Waiting...',
          changelog: 'https://github.com/AEGEE/oms-core-js/blob/master/CHANGELOG.md',
          healthcheckLink: '/services/oms-core-elixir/api/healthcheck',
          githubLink: 'https://api.github.com/repos/AEGEE/oms-core-js/contents/package.json'
        },
        'oms-mailer': {
          roundTrip: null,
          version: '-',
          latestVersion: '-',
          isAlive: 'Waiting...',
          changelog: 'https://github.com/AEGEE/oms-mailer/blob/master/CHANGELOG.md'
        },
        'oms-events': {
          roundTrip: null,
          version: '-',
          latestVersion: '-',
          isAlive: 'Waiting...',
          changelog: 'https://github.com/AEGEE/oms-events/blob/master/CHANGELOG.md'
        },
        'oms-statutory': {
          roundTrip: null,
          version: '-',
          latestVersion: '-',
          isAlive: 'Waiting...',
          changelog: 'https://github.com/AEGEE/oms-statutory/blob/master/CHANGELOG.md'
        },
        'oms-discounts': {
          roundTrip: null,
          version: '-',
          latestVersion: '-',
          isAlive: 'Waiting...',
          changelog: 'https://github.com/AEGEE/oms-discounts/blob/master/CHANGELOG.md'
        },
        'oms-frontend': {
          roundTrip: null,
          version: this.$store.state.pkg.version,
          latestVersion: '-',
          isAlive: 'Waiting...',
          changelog: 'https://github.com/AEGEE/oms-frontend/blob/master/CHANGELOG.md'
        }
      }
    }
  },
  methods: {
    calculateClassForService (isAlive) {
      switch (isAlive) {
      case true:
        return 'is-success'
      case false:
        return 'is-danger'
      default:
        return 'is-warning'
      }
    },
    fetchHealthcheckForService (service) {
      const timeStart = Date.now()

      const healthcheckUrl = this.statuses[service].healthcheckLink || (this.services[service] + '/healthcheck')

      this.axios.get(healthcheckUrl).then((response) => {
        this.statuses[service].roundTrip = Date.now() - timeStart
        this.statuses[service].isAlive = true
        if (response.data && response.data.data && response.data.data.version) {
          this.statuses[service].version = response.data.data.version
        }
      }).catch((err) => {
        console.log(err)
        this.statuses[service].roundTrip = Date.now() - timeStart
        this.statuses[service].isAlive = false
      })
    },
    fetchLatestVersionForService (service) {
      const githubLink = this.statuses[service].githubLink || ('https://api.github.com/repos/AEGEE/' + service + '/contents/package.json')

      fetch(githubLink)
        .then((res) => res.json())
        .then((response) => {
          const content = window.atob(response.content)
          const jsonContent = JSON.parse(content)

          this.statuses[service].latestVersion = jsonContent.version
        }).catch((err) => {
          console.log(err)
        })
    }
  },
  computed: {
    ...mapGetters(['services'])
  },
  mounted () {
    for (const service in this.statuses) {
      this.fetchHealthcheckForService(service)
      this.fetchLatestVersionForService(service)
    }
  }
}
</script>
