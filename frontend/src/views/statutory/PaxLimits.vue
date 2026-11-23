<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">Manage participants limits for a statutory event</h4>

        <p>Here you can specify how many envoys, delegates, visitors and observers can go to a statutory event for every body.</p>
        <p>When editing, type the empty value for unlimited.</p>
        <p>The limits that were set in a custom way have grey background. Others use the default limits.</p>
        <br />

        <div class="field">
          <label class="label" for="pax-limits-event-type">Select event type</label>
          <div class="control">
            <div class="select">
              <select id="pax-limits-event-type" v-model="eventType">
                <option value="agora">Agora</option>
                <option value="epm">EPM</option>
                <option value="spm">SPM</option>
              </select>
            </div>
          </div>
        </div>

        <p><strong>Total bodies listed:</strong> {{ limits.length }}</p>
        <p><strong>Bodies with custom limits: </strong>{{ limits.filter(l => !l.default).length }}</p>

        <div class="table-responsive">
          <table class="table is-bordered is-striped is-narrow is-fullwidth">
            <thead>
              <tr>
                <th>Body</th>
                <th>Body type</th>
                <th>Delegates</th>
                <th>Envoys</th>
                <th>Observers</th>
                <th>Visitors</th>
                <th><span class="is-sr-only">Edit</span></th>
                <th><span class="is-sr-only">Use default</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="limit in limits" v-bind:key="limit.body_id">
                <td>
                  <router-link :to="{ name: 'oms.bodies.view', params: { id: limit.body_id } }">
                    {{ limit.body ? limit.body.name : 'Loading...' }}
                  </router-link>
                </td>
                <td>{{ (limit.body ? limit.body.type : 'Loading...') | capitalize }}</td>
                <td v-if="!limit.isEditing" :class="{ 'has-background-grey-light': !limit.default }"> {{ limit.delegate | numberOrUnlimited }} </td>
                <td v-if="!limit.isEditing" :class="{ 'has-background-grey-light': !limit.default }"> {{ limit.envoy | numberOrUnlimited }} </td>
                <td v-if="!limit.isEditing" :class="{ 'has-background-grey-light': !limit.default }"> {{ limit.observer | numberOrUnlimited }} </td>
                <td v-if="!limit.isEditing" :class="{ 'has-background-grey-light': !limit.default }"> {{ limit.visitor | numberOrUnlimited }} </td>
                <td v-if="limit.isEditing">
                  <input type="number" min="0" v-model.number="limit.delegate" @input="$root.nullifyIfEmpty(limit, 'delegate')" :aria-label="'Delegates of ' + bodyName(limit)">
                </td>
                <td v-if="limit.isEditing">
                  <input type="number" min="0" v-model.number="limit.envoy" @input="$root.nullifyIfEmpty(limit, 'envoy')" :aria-label="'Envoys of ' + bodyName(limit)">
                </td>
                <td v-if="limit.isEditing">
                  <input type="number" min="0" v-model.number="limit.observer" @input="$root.nullifyIfEmpty(limit, 'observer')" :aria-label="'Observers of ' + bodyName(limit)">
                </td>
                <td v-if="limit.isEditing">
                  <input type="number" min="0" v-model.number="limit.visitor" @input="$root.nullifyIfEmpty(limit, 'visitor')" :aria-label="'Visitors of ' + bodyName(limit)">
                </td>
                <td>
                  <button type="button" class="button is-small is-warning" v-if="!limit.isEditing" @click="$set(limit, 'isEditing', true)">Edit</button>
                  <button type="button" class="button is-small is-primary" v-if="limit.isEditing" @click="saveLimit(limit)">Save</button>
                </td>
                <td>
                  <button type="button" class="button is-small is-danger" v-if="!limit.default" @click="deleteLimit(limit)">Use default</button>
                </td>
              </tr>
              <tr v-show="isLoading">
                <td colspan="8" class="has-text-centered">
                  <font-awesome-icon style="font-size:24px" icon="spinner" spin title="Loading" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </article>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'PaxLimits',
  data () {
    return {
      defaultLimits: [],
      limits: [],
      bodies: [],
      eventType: 'agora',
      isLoading: false,
      request: 0
    }
  },
  computed: mapGetters(['services']),
  methods: {
    bodyName (limit) {
      return limit.body ? limit.body.name : 'body ' + limit.body_id
    },
    saveLimit (limit) {
      const { body_id, delegate, envoy, observer, visitor } = limit
      this.axios.post(this.services['statutory'] + '/limits/' + this.eventType, { body_id, delegate, envoy, observer, visitor }).then(() => {
        this.$root.showSuccess('Limit is saved.')
        this.$set(limit, 'isEditing', false)
        this.compareWithDefaults()
      }).catch((err) => {
        this.$root.showError('Error saving limit', err)
      })
    },
    deleteLimit (limit) {
      this.axios.delete(this.services['statutory'] + '/limits/' + this.eventType + '/' + limit.body_id).then(() => {
        this.$root.showSuccess('Limit is deleted.')
        this.fetchData()
      }).catch((err) => {
        this.$root.showError('Error deleting limit', err)
      })
    },
    // The limits, the default limits and the bodies of the chosen event type, together. When
    // another type is chosen before they are there, they are dropped for the newer ones.
    fetchData () {
      const request = ++this.request
      this.isLoading = true
      Promise.all([
        this.axios.get(this.services['statutory'] + '/limits/' + this.eventType),
        this.axios.get(this.services['statutory'] + '/limits/' + this.eventType + '/defaults/'),
        this.axios.get(this.services['core'] + '/bodies/')
      ]).then(([limits, defaultLimits, bodies]) => {
        if (request !== this.request) return

        this.bodies = bodies.data.data
        for (const limit of limits.data.data) {
          limit.body = this.bodies.find(body => body.id === limit.body_id)
          limit.isEditing = false
        }
        this.limits = limits.data.data
        this.defaultLimits = defaultLimits.data.data
        this.compareWithDefaults()
        this.isLoading = false
      }).catch((err) => {
        if (request !== this.request) return

        this.isLoading = false
        this.$root.showError('Could not fetch participants limits', err)
      })
    },
    compareWithDefaults () {
      if (this.limits.length === 0 || this.defaultLimits.length === 0) {
        return
      }
      for (const limit of this.limits) {
        const defaultLimit = this.defaultLimits.find(def => def.body_id === limit.body_id)
        if (defaultLimit) {
          this.$set(limit, 'default', this.isSameAsOriginal(limit, defaultLimit))
        }
      }
    },
    isSameAsOriginal (limit, defaultLimit) {
      return (
        limit.delegate === defaultLimit.delegate
        && limit.envoy === defaultLimit.envoy
        && limit.observer === defaultLimit.observer
        && limit.visitor === defaultLimit.visitor
      )
    }
  },
  filters: {
    numberOrUnlimited (value) {
      return value === null ? 'Unlimited' : value
    }
  },
  watch: {
    eventType () {
      this.fetchData()
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
