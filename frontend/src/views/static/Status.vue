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
              <th>Releases</th>
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
              <td v-if="value.releasesUrl">
                <a :href="value.releasesUrl" target="_blank" rel="noopener noreferrer">View releases</a>
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
          releasesUrl: 'https://github.com/AEGEE/MyAEGEE/releases?q=core'
        },
        mailer: {
          roundTrip: null,
          version: '-',
          latestVersion: '-',
          latestTag: '-',
          isAlive: 'Waiting...',
          releasesUrl: 'https://github.com/AEGEE/MyAEGEE/releases?q=mailer'
        },
        events: {
          roundTrip: null,
          version: '-',
          latestVersion: '-',
          latestTag: '-',
          isAlive: 'Waiting...',
          releasesUrl: 'https://github.com/AEGEE/MyAEGEE/releases?q=events'
        },
        summeruniversity: {
          roundTrip: null,
          version: '-',
          latestVersion: '-',
          latestTag: '-',
          isAlive: 'Waiting...',
          releasesUrl: 'https://github.com/AEGEE/MyAEGEE/releases?q=summeruniversity'
        },
        statutory: {
          roundTrip: null,
          version: '-',
          latestVersion: '-',
          latestTag: '-',
          isAlive: 'Waiting...',
          releasesUrl: 'https://github.com/AEGEE/MyAEGEE/releases?q=statutory'
        },
        discounts: {
          roundTrip: null,
          version: '-',
          latestVersion: '-',
          latestTag: '-',
          isAlive: 'Waiting...',
          releasesUrl: 'https://github.com/AEGEE/MyAEGEE/releases?q=discounts'
        },
        network: {
          roundTrip: null,
          version: '-',
          latestVersion: '-',
          latestTag: '-',
          isAlive: 'Waiting...',
          releasesUrl: 'https://github.com/AEGEE/MyAEGEE/releases?q=network'
        },
        'gsuite-wrapper': {
          roundTrip: null,
          version: '-',
          latestVersion: '-',
          latestTag: '-',
          isAlive: 'Waiting...',
          releasesUrl: 'https://github.com/AEGEE/MyAEGEE/releases?q=gsuite-wrapper'
        },
        frontend: {
          roundTrip: null,
          version: this.$store.state.pkg.version,
          latestVersion: '-',
          latestTag: '-',
          isAlive: 'Waiting...',
          releasesUrl: 'https://github.com/AEGEE/MyAEGEE/releases?q=frontend'
        },
        'core-static': {
          roundTrip: null,
          version: '-',
          latestVersion: '-',
          latestTag: '-',
          isAlive: 'Waiting...',
          releasesUrl: null
        },
        'statutory-static': {
          roundTrip: null,
          version: '-',
          latestVersion: '-',
          latestTag: '-',
          isAlive: 'Waiting...',
          releasesUrl: null
        },
        'events-static': {
          roundTrip: null,
          version: '-',
          latestVersion: '-',
          latestTag: '-',
          isAlive: 'Waiting...',
          releasesUrl: null
        },
        'summeruniversity-static': {
          roundTrip: null,
          version: '-',
          latestVersion: '-',
          latestTag: '-',
          isAlive: 'Waiting...',
          releasesUrl: null
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
    fetchLatestVersions () {
      fetch('https://api.github.com/repos/AEGEE/MyAEGEE/releases?per_page=100')
        .then((res) => res.json())
        .then((releases) => {
          for (const service in this.statuses) {
            const prefix = service + '@'
            const release = releases.find((r) => r.tag_name.startsWith(prefix))
            if (release) {
              this.statuses[service].latestVersion = release.tag_name.replace(prefix, '')
            }
          }
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
    this.fetchLatestVersions()
    for (const service in this.statuses) {
      this.fetchHealthcheckForService(service)
      this.fetchLatestDockerTagForService(service)
    }
  }
}
</script>
