<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child" aria-labelledby="boards-title" :aria-busy="isLoading">
        <h1 class="title" id="boards-title">View current boards and election dates</h1>
        <div class="field">
          <label class="label" for="boards-search">Search by name, body code or abbreviation</label>
          <div class="field has-addons">
            <div class="control is-expanded">
              <input class="input" id="boards-search" type="text" v-model="query" placeholder="Search by name, body code or abbreviation" @input="refetch()">
            </div>
            <div class="control" v-if="can.viewDeleted">
              <button type="button" class="button is-info" v-if="includeDeleted" @click="toggleIncludeDeleted()">Only show active bodies</button>
              <button type="button" class="button is-info" v-if="!includeDeleted" @click="toggleIncludeDeleted()">Also show deleted bodies</button>
            </div>
          </div>
        </div>

        <div class="field">
          <span class="label" id="boards-types-label">Filter on body type</span>
          <div class="control">
            <multiselect
              v-model="selectedTypes"
              aria-labelledby="boards-types-label"
              :aria-expanded="String(typesOpen)"
              :multiple="true"
              :searchable="false"
              :close-on-select="false"
              :clear-on-select="false"
              :preserve-search="true"
              :options="types"
              placeholder="Select body types"
              track-by="value"
              label="name"
              @open="typesOpen = true"
              @close="typesOpen = false"
              @input="refetch">
              <template #tag="{ option, remove }">
                <span class="multiselect__tag" :key="option.value">
                  <span>{{ option.name }}</span>
                  <button type="button" class="multiselect__tag-icon boards-type-remove" :aria-label="'Remove ' + option.name" @mousedown.prevent @click="remove(option)" />
                </span>
              </template>
            </multiselect>
          </div>
        </div>

        <div class="field">
          <span class="label">Other filters</span>
          <label class="checkbox">
            <input type="checkbox" v-model="filters.noCurrentBoard" />
            Only display bodies without a current board
          </label>
        </div>

        <b-table :data="filteredBodies" :loading="isLoading" narrowed>
          <b-table-column field="code" label="Body code" v-slot="props">
            {{ props.row.code }}
          </b-table-column>

          <b-table-column field="name" label="Body name" v-slot="props">
            <router-link :to="{ name: 'oms.bodies.view', params: { id: props.row.id } }">{{ props.row.name }}</router-link>
          </b-table-column>

          <b-table-column field="type" label="Type" v-slot="props">
            {{ props.row.type | capitalize }}
          </b-table-column>

          <b-table-column field="election" label="Election" v-slot="props">
            <template v-if="props.row.board">
              {{ props.row.board.elected_date }}
            </template>
            <span v-else>-</span>
          </b-table-column>

          <b-table-column field="term_start" label="Term start" v-slot="props">
            <template v-if="props.row.board">
              {{ props.row.board.start_date }}
            </template>
            <span v-else>-</span>
          </b-table-column>

          <b-table-column field="term_end" label="Term end" v-slot="props">
            <template v-if="props.row.board">
              {{ props.row.board.end_date }}
            </template>
            <span v-else>-</span>
          </b-table-column>

          <b-table-column field="status" label="Status" :visible="includeDeleted" v-slot="props">
            <span class="tag is-small is-info" v-if="props.row.status === 'active'">Active</span>
            <span class="tag is-small is-danger" v-if="props.row.status === 'deleted'">Deleted</span>
          </b-table-column>

          <template slot="empty">
            <empty-table-stub />
          </template>
        </b-table>

      </article>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import 'vue-multiselect/dist/vue-multiselect.min.css'
import Multiselect from 'vue-multiselect'
import moment from 'moment'

export default {
  name: 'Boardslist',
  components: {
    Multiselect
  },
  data () {
    return {
      bodies: [],
      types: [
        { value: 'antenna', name: 'Antenna' },
        { value: 'contact antenna', name: 'Contact antenna' },
        { value: 'contact', name: 'Contact' }
      ],
      isLoading: false,
      source: null,
      filters: {
        noCurrentBoard: false
      },
      selectedTypes: [ // start with having these types pre-selected
        { value: 'antenna', name: 'Antenna' },
        { value: 'contact antenna', name: 'Contact antenna' },
        { value: 'contact', name: 'Contact' }
      ],
      query: '',
      includeDeleted: false,
      typesOpen: false
    }
  },
  computed: {
    queryObject () {
      const queryObj = { }

      if (this.query) queryObj.query = this.query

      if (this.includeDeleted) queryObj.all = 'true'

      return queryObj
    },
    filteredBodies () {
      if (!this.filters.noCurrentBoard) return this.bodies

      const today = moment().format('YYYY-MM-DD')
      return this.bodies.filter(x => !x.board || moment(x.board.end_date).isBefore(today, 'date'))
    },
    // Whether the member may list deleted bodies, from the permissions the app got when it
    // started.
    can () {
      return {
        viewDeleted: this.permissions.some(permission => permission.combined.endsWith('view_deleted:body'))
      }
    },
    ...mapGetters(['services', 'permissions'])
  },
  methods: {
    toggleIncludeDeleted () {
      this.includeDeleted = !this.includeDeleted
      this.refetch()
    },
    refetch () {
      this.bodies = []
      this.fetchData()
    },
    fetchData () {
      this.isLoading = true
      if (this.source) this.source.cancel()
      this.source = this.axios.CancelToken.source()

      this.axios.get(this.services['core'] + '/bodies', { params: this.queryObject, cancelToken: this.source.token }).then((bodiesResponse) => {
        this.bodies = bodiesResponse.data.data

        if (this.selectedTypes.length > 0) {
          const types = this.selectedTypes.map((type) => type.value)
          this.bodies = this.bodies.filter(x => types.includes(x.type))
        }

        this.axios.get(this.services['network'] + '/boards?sort=start_date&direction=desc').then((boardsResponse) => {
          const boards = boardsResponse.data.data

          // Add most recent board to their corresponding body
          for (const body of this.bodies) {
            const recentBoard = boards.find(board => board.body_id === body.id)
            if (recentBoard) this.$set(body, 'board', recentBoard)
          }

          this.isLoading = false
        }).catch((err) => {
          this.$root.showError('Could not fetch boards list', err)
        })
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

<style scoped>
/* A button, so the keyboard reaches it, that looks like the library's icon; at least 24
   pixels, so it is easy to hit. */
.boards-type-remove {
  border: 0;
  padding: 0;
  background-color: transparent;
  width: 24px;
  min-height: 24px;
}
</style>
