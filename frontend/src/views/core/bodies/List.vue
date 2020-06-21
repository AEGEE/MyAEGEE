<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">Bodies list</h4>
        <div class="field">
          <label class="label">Search by name or body code</label>
          <div class="control">
            <input class="input" type="text" v-model="query" placeholder="Search by name or body code" @input="refetch()">
          </div>
        </div>

        <div class="field">
          <label class="label">Filter on body type</label>
          <div class="control">
            <multiselect
              v-model="selectedTypes"
              :multiple="true"
              :searchable="false"
              :close-on-select="false"
              :clear-on-select="false"
              :preserve-search="true"
              :options="types"
              placeholder="Select application fields"
              track-by="value"
              label="name">
              <template
                slot="selection"
                slot-scope="{ values, search, isOpen }">
                <span class="multiselect__single" v-if="values.length &amp;&amp; !isOpen">{{ values.length }} fields selected</span>
              </template>
            </multiselect>
          </div>
        </div>

        <div class="field" v-if="can.create">
          <div class="control">
            <router-link class="button is-primary" :to="{ name: 'oms.bodies.create' }">Create body</router-link>
          </div>
        </div>

        <b-table :data="bodies" :loading="isLoading" narrowed>
          <template slot-scope="props">
            <b-table-column field="code" label="Body code">
              {{ props.row.code }}
            </b-table-column>

            <b-table-column field="name" label="Body name">
              <router-link :to="{ name: 'oms.bodies.view', params: { id: props.row.id } }">{{ props.row.name}}</router-link>
            </b-table-column>

            <b-table-column field="type" label="Type">
              {{ props.row.type | capitalize }}
            </b-table-column>

            <b-table-column field="description" label="Description">
              <span class="body-description" v-html="$options.filters.markdown(props.row.description)"></span>
            </b-table-column>

            <b-table-column field="founded_at" label="Foundation date">
              {{ props.row.founded_at }}
            </b-table-column>
          </template>

          <template slot="empty">
            <empty-table-stub />
          </template>
        </b-table>

        <div class="field">
          <button
            class="button is-primary is-fullwidth"
            :class="{ 'is-loading': isLoading }"
            :disabled="isLoading"
            v-show="canLoadMore"
            @click="fetchData()">Load more bodies</button>
        </div>
      </article>
    </div>
  </div>
</template>

<style>
.body-description a {
  word-break: break-all;
}
</style>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'BodiesList',
  data () {
    return {
      bodies: [],
      types: [
        { value: 'antenna', name: 'Antenna' },
        { value: 'contact antenna', name: 'Contact antenna' },
        { value: 'contact', name: 'Contact' },
        { value: 'interest group', name: 'Interest group' },
        { value: 'working group', name: 'Working group' },
        { value: 'commission', name: 'Commission' },
        { value: 'committee', name: 'Committee' },
        { value: 'project', name: 'Project' },
        { value: 'partner', name: 'Partner' },
        { value: 'other', name: 'Other' }
      ],
      selectedTypes: [],
      isLoading: false,
      query: '',
      limit: 30,
      offset: 0,
      type: null,
      canLoadMore: true,
      source: null,
      permissions: [],
      can: {
        create: false
      }
    }
  },
  computed: {
    queryObject () {
      const queryObj = {
        limit: this.limit,
        offset: this.offset
      }

      if (this.query) queryObj.query = this.query
      if (this.selectedTypes) {
        queryObj.type = this.selectedTypes
          .map((type) => type.value)
          .join(',')
      }
      return queryObj
    },
    ...mapGetters({
      services: 'services',
      loginUser: 'user'
    })
  },
  watch: {
    selectedTypes () {
      this.refetch()
    }
  },
  methods: {
    refetch () {
      this.bodies = []
      this.offset = 0
      this.canLoadMore = true
      this.fetchData()
    },
    fetchData () {
      this.isLoading = true
      if (this.source) this.source.cancel()
      this.source = this.axios.CancelToken.source()

      this.axios.get(this.services['core'] + '/bodies', { params: this.queryObject, cancelToken: this.source.token }).then((response) => {
        this.bodies = this.bodies.concat(response.data.data)
        this.offset += this.limit
        this.canLoadMore = response.data.data.length === this.limit

        if (this.loginUser) {
          return this.axios.get(this.services['core'] + '/my_permissions').then((permissionsResponse) => {
            this.permissions = permissionsResponse.data.data

            this.can.create = this.permissions.some(permission => permission.combined.endsWith('create:body'))
            this.isLoading = false
          })
        }
        this.isLoading = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return
        }

        this.$root.showError('Could not fetch bodies list', err)
      })
    }
  },
  mounted () {
    this.fetchData()
  }
}
</script>
