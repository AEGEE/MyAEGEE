<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">Manage participants limits for a statutory event</h4>

        <p>Here you can specify how much envoys, delegates, visitors and observers can go to a statutory event for every body.</p>
        <p>When editing, type the empty value for unlimited.</p>
        <p>The limits that were set in a custom way have grey background. Others use the default limits.</p>
        <br />

        <div class="field">
          <label class="label">Select event type</label>
          <div class="control">
            <div class="select">
              <select v-model="eventType">
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
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tfoot>
              <tr>
                <th>Body</th>
                <th>Body type</th>
                <th>Delegates</th>
                <th>Envoys</th>
                <th>Observers</th>
                <th>Visitors</th>
                <th></th>
                <th></th>
              </tr>
            </tfoot>
            <tbody>
              <tr v-for="limit in limits" v-bind:key="limit.body_id" :class="{ 'has-background-grey-light': !limit.default }">
                <td>
                  <router-link :to="{ name: 'oms.bodies.view', params: { id: limit.body_id } }">
                    {{ limit.body ? limit.body.name : 'Loading...' }}
                  </router-link>
                </td>
                <td>{{ (limit.body ? limit.body.type : 'Loading...') | capitalize }}</td>
                <td v-if="!limit.isEditing">{{ limit.delegate | numberOrUnlimited }}</td>
                <td v-if="!limit.isEditing">{{ limit.envoy | numberOrUnlimited }}</td>
                <td v-if="!limit.isEditing">{{ limit.observer | numberOrUnlimited }}</td>
                <td v-if="!limit.isEditing">{{ limit.visitor | numberOrUnlimited }}</td>
                <td v-if="limit.isEditing">
                    <input type="number" min="0" v-model.number="limit.delegate" @input="if (limit.delegate === '') limit.delegate = null">
                </td>
                <td v-if="limit.isEditing">
                    <input type="number" min="0" v-model.number="limit.envoy" @input="if (limit.envoy === '') limit.envoy = null">
                </td>
                <td v-if="limit.isEditing">
                    <input type="number" min="0" v-model.number="limit.observer" @input="if (limit.observer === '') limit.observer = null">
                </td>
                <td v-if="limit.isEditing">
                    <input type="number" min="0" v-model.number="limit.visitor" @input="if (limit.visitor === '') limit.visitor = null">
                </td>
                <td>
                    <button class="button is-small is-warning" v-if="!limit.isEditing" @click="$set(limit, 'isEditing', true)">Edit</button>
                    <button class="button is-small is-primary" v-if="limit.isEditing" @click="saveLimit(limit)">Save</button>
                </td>
                <td>
                    <button class="button is-small is-danger" v-if="!limit.default" @click="deleteLimit(limit, index)">Use default</button>
                </td>
              </tr>
              <tr v-show="isLoading">
                <td colspan="8" class="has-text-centered"><i style="font-size:24px" class="fa fa-spinner fa-spin"></i></td>
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
      limits: [],
      bodies: [],
      eventType: 'agora',
      isLoading: false
    }
  },
  computed: mapGetters(['services']),
  methods: {
    saveLimit (limit) {
      this.axios.post(this.services['oms-statutory'] + '/limits/' + this.eventType, limit).then((response) => {
        this.$root.showSuccess('Limit is saved.')
        this.$set(limit, 'isEditing', false)
        this.$set(limit, 'default', false)
      }).catch((err) => {
        this.$root.showError('Error saving limit', err)
      })
    },
    deleteLimit (limit, index) {
      this.axios.delete(this.services['oms-statutory'] + '/limits/' + this.eventType + '/' + limit.body_id).then((response) => {
        this.$root.showSuccess('Limit is deleted.')
        window.location.reload()
      }).catch((err) => {
        this.$root.showError('Error deleting limit', err)
      })
    },
    fetchLimits () {
      this.isLoading = true
      this.axios.get(this.services['oms-statutory'] + '/limits/' + this.eventType).then((response) => {
        this.limits = response.data.data

        return this.axios.get(this.services['oms-core-elixir'] + '/bodies/')
      }).then((response) => {
        this.bodies = response.data.data

        for (const limit of this.limits) {
          this.$set(limit, 'body', this.bodies.find(body => body.id === limit.body_id))
          this.$set(limit, 'isEditing', false)
        }
        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false
        this.$root.showError('Could not fetch participants limits', err)
      })
    }
  },
  filters: {
    numberOrUnlimited (value) {
      return value === null ? 'Unlimited' : value
    }
  },
  watch: {
    eventType () {
      this.fetchLimits()
    }
  },
  mounted () {
    this.fetchLimits()
  }
}
</script>
