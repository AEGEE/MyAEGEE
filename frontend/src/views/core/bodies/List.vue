<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <h4 class="title">Bodies list</h4>

        <div class="field">
          <label class="label">Search by name, body code or abbreviation</label>
          <div class="field has-addons">
            <div class="control is-expanded">
              <input class="input" type="text" v-model="query" placeholder="Search by name, body code or abbreviation" @input="refetch()">
            </div>
            <div class="control" v-if="can.viewDeleted">
              <a class="button is-info" v-if="includeDeleted" @click="toggleIncludeDeleted()">Only show active bodies</a>
              <a class="button is-info" v-if="!includeDeleted" @click="toggleIncludeDeleted()">Also show deleted bodies</a>
            </div>
          </div>
        </div>

        <div class="field" v-if="loginUser">
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
              placeholder="Select body types"
              track-by="value"
              label="name">
              <template
                slot="selection"
                slot-scope="{ values, isOpen }">
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
            <b-table-column field="code" label="Body code" sortable>
              {{ props.row.code }}
            </b-table-column>

            <b-table-column field="name" label="Body name" sortable>
              <router-link :to="{ name: 'oms.bodies.view', params: { id: props.row.id } }">{{ props.row.name}}</router-link>
            </b-table-column>

            <b-table-column field="type" label="Type" sortable>
              {{ props.row.type | capitalize }}
            </b-table-column>

            <b-table-column field="description" label="Description">
              <span class="body-description" v-html="$options.filters.markdown(props.row.description)" />
            </b-table-column>

            <b-table-column field="founded_at" label="Foundation date" sortable>
              {{ props.row.founded_at }}
            </b-table-column>

            <b-table-column field="status" label="Status" :visible="includeDeleted">
              <span class="tag is-small is-info" v-if="props.row.status === 'active'">Active</span>
              <span class="tag is-small is-danger" v-if="props.row.status === 'deleted'">Deleted</span>
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
        { value: 'external', name: 'External' },
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
      includeDeleted: false,
      can: {
        create: false,
        viewDeleted: false
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

      if (this.includeDeleted) queryObj.all = 'true'

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
    toggleIncludeDeleted () {
      this.includeDeleted = !this.includeDeleted
      this.refetch()
    },
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
            this.can.viewDeleted = this.permissions.some(permission => permission.combined.endsWith('view_deleted:body'))
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
