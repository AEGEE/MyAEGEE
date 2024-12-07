<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">Services statuses</h4>

        <table class="table is-bordered is-striped is-narrow is-fullwidth">
          <thead>
            <tr>
              <th>Name</th>
              <th>Current version</th>
              <th>Latest Github version</th>
              <th>Latest Dockerhub tag</th>
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
              <td>{{ value.latestTag }}</td>
              <td v-if="value.changelog">
                <a :href="value.changelog" target="_blank" rel="noopener noreferrer">{{ value.changelog }}</a>
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
        core: {
          roundTrip: null,
          version: '-',
          latestVersion: '-',
          latestTag: '-',
          isAlive: 'Waiting...',
          changelog: 'https://github.com/AEGEE/core/blob/stable/CHANGELOG.md'
        },
        mailer: {
          roundTrip: null,
          version: '-',
          latestVersion: '-',
          latestTag: '-',
          isAlive: 'Waiting...',
          changelog: 'https://github.com/AEGEE/mailer/blob/stable/CHANGELOG.md'
        },
        events: {
          roundTrip: null,
          version: '-',
          latestVersion: '-',
          latestTag: '-',
          isAlive: 'Waiting...',
          changelog: 'https://github.com/AEGEE/events/blob/stable/CHANGELOG.md'
        },
        summeruniversity: {
          roundTrip: null,
          version: '-',
          latestVersion: '-',
          latestTag: '-',
          isAlive: 'Waiting...',
          changelog: 'https://github.com/AEGEE/summeruniversity/blob/stable/CHANGELOG.md'
        },
        statutory: {
          roundTrip: null,
          version: '-',
          latestVersion: '-',
          latestTag: '-',
          isAlive: 'Waiting...',
          changelog: 'https://github.com/AEGEE/statutory/blob/stable/CHANGELOG.md'
        },
        discounts: {
          roundTrip: null,
          version: '-',
          latestVersion: '-',
          latestTag: '-',
          isAlive: 'Waiting...',
          changelog: 'https://github.com/AEGEE/discounts/blob/stable/CHANGELOG.md'
        },
        network: {
          roundTrip: null,
          version: '-',
          latestVersion: '-',
          latestTag: '-',
          isAlive: 'Waiting...',
          changelog: 'https://github.com/AEGEE/network/blob/stable/CHANGELOG.md'
        },
        'gsuite-wrapper': {
          roundTrip: null,
          version: '-',
          latestVersion: '-',
          latestTag: '-',
          isAlive: 'Waiting...',
          changelog: 'https://github.com/AEGEE/gsuite-wrapper/blob/stable/CHANGELOG.md'
        },
        frontend: {
          roundTrip: null,
          version: this.$store.state.pkg.version,
          latestVersion: '-',
          latestTag: '-',
          isAlive: 'Waiting...',
          changelog: 'https://github.com/AEGEE/frontend/blob/stable/CHANGELOG.md'
        },
        'core-static': {
          roundTrip: null,
          version: '-',
          latestVersion: '-',
          latestTag: '-',
          isAlive: 'Waiting...',
          changelog: null
        },
        'statutory-static': {
          roundTrip: null,
          version: '-',
          latestVersion: '-',
          latestTag: '-',
          isAlive: 'Waiting...',
          changelog: null
        },
        'events-static': {
          roundTrip: null,
          version: '-',
          latestVersion: '-',
          latestTag: '-',
          isAlive: 'Waiting...',
          changelog: null
        },
        'summeruniversity-static': {
          roundTrip: null,
          version: '-',
          latestVersion: '-',
          latestTag: '-',
          isAlive: 'Waiting...',
          changelog: null
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
      const githubLink = 'https://api.github.com/repos/AEGEE/' + service + '/contents/package.json'

      fetch(githubLink)
        .then((res) => res.json())
        .then((response) => {
          const content = window.atob(response.content)
          const jsonContent = JSON.parse(content)

          this.statuses[service].latestVersion = jsonContent.version
        }).catch((err) => {
          console.log(err)
        })
    },
    fetchLatestDockerTagForService (service) {
      fetch(`/services/dockerhub/v2/repositories/aegee/${service}/tags?page_size=10000`)
        .then((res) => res.json())
        .then((response) => {
          const semverTags = response.results
            .filter((image) => {
              // filtering out non semver tags
              const versions = image.name.split('.')
              return versions.length >= 3
            })

          this.statuses[service].latestTag = semverTags.length > 0
            ? semverTags[0].name
            : ''
        }).catch((err) => {
          console.log(`Error fetching docker tags for ${service}: ${err}`)
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
      this.fetchLatestDockerTagForService(service)
    }
  }
}
</script>
