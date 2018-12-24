<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Board view</div>

        <div class="field" v-if="boardBodies.length > 0">
          <label>Select the body to view application from:</label>
          <div class="field">
            <div class="control has-icons-left">
              <div class="select">
                <select v-model="selectedBody">
                  <option v-for="body in boardBodies" v-bind:key="body.id" v-bind:value="body.id">{{ body.name }}</option>
                </select>
              </div>
              <div class="icon is-small is-left">
                <i class="fa fa-globe"></i>
              </div>
            </div>
          </div>
        </div>

        <div class="field">
          <label class="label">Search by name or description</label>
          <div class="field has-addons">
            <div class="control is-expanded">
              <input class="input" type="text" v-model="query" placeholder="Search by name, surname or email" />
            </div>
          </div>
        </div>

        <div class="content" v-if="selectedBody">
          <p>Your body can send:</p>
          <ul>
            <li v-if="limits.delegate !== 0"><strong>{{ limits.delegate | numberOrUnlimited }} delegates</strong></li>
            <li v-if="limits.visitor !== 0"><strong>{{ limits.visitor | numberOrUnlimited }} visitors</strong></li>
            <li v-if="limits.envoy !== 0"><strong>{{ limits.envoy | numberOrUnlimited }} envoys</strong></li>
            <li v-if="limits.observer !== 0"><strong>{{ limits.observer | numberOrUnlimited }} observers</strong></li>
            <li v-if="!allowedToSendAnyPax">
              <strong>Your body cannot send any participants to Agora.</strong>
            </li>
          </ul>
        </div>

        <div class="notification is-danger" v-if="Object.keys(this.errors).length > 0">
          <div class="content">
            <strong>This errors occured while trying to update the participant:</strong>
            <ul>
              <li v-if="errors.participant_type">Participant type: {{ errors.participant_type.join(', ') }}</li>
              <li v-if="errors.participant_order">Participant order: {{ errors.participant_order.join(', ') }}</li>
              <li v-if="errors.board_comment">Participant type: {{ errors.board_comment.join(', ') }}</li>
            </ul>
          </div>
        </div>

        <div class="field" v-if="allowedToSendAnyPax && selectedBody">
          <div class="control">
            <multiselect
              v-model="selectedFields"
              :multiple="true"
              :searchable="false"
              :close-on-select="false"
              :clear-on-select="false"
              :preserve-search="true"
              :options="fields"
              placeholder="Select application fields"
              track-by="name"
              label="name" >
              <template
                slot="selection"
                slot-scope="{ values, search, isOpen }">
                <span class="multiselect__single" v-if="values.length &amp;&amp; !isOpen">{{ values.length }} fields selected</span>
              </template>
            </multiselect>
          </div>
        </div>

        <div class="subtitle" v-if="boardBodies.length === 0">You are not a board member of any body.</div>
        <div class="subtitle" v-if="!selectedBody && boardBodies.length > 0">You haven't selected the antenna yet.</div>

        <b-table
          :data="filteredApplications"
          :loading="isLoading"
          paginated
          :per-page="limit"
          default-sort="id"
          default-sort-direction="desc">
          <template slot-scope="props">
            <b-table-column field="id" label="#" numeric sortable>
              {{ props.row.id }}
            </b-table-column>

            <b-table-column field="last_name" label="First and last name" sortable>
              {{ props.row.first_name }} {{ props.row.last_name }}
            </b-table-column>

            <b-table-column v-for="(field, index) in selectedFields" v-bind:key="index" field="answers[index]" :label="field.name" sortable>
              {{ field.get(props.row) | beautify }}
            </b-table-column>

            <b-table-column field="participant_type" label="Participant type" sortable>
              <div class="select">
                <select v-model="props.row.participant_type">
                  <option :value="null">Not set</option>
                  <option value="delegate" v-show="limits.delegate !== 0">Delegate</option>
                  <option value="visitor" v-show="limits.visitor !== 0">Visitor</option>
                  <option value="envoy" v-show="limits.envoy !== 0">Envoy</option>
                  <option value="observer" v-show="limits.observer !== 0">Observer</option>
                </select>
              </div>
            </b-table-column>

            <b-table-column field="participant_type" label="Participant order" sortable>
              <input class="input" type="number" v-model.number="props.row.participant_order" min="1" />
            </b-table-column>

            <b-table-column field="board_comment" label="Board comment" sortable>
              <textarea class="textarea" v-model="props.row.board_comment" />
            </b-table-column>

            <b-table-column field="cancelled" label="Cancelled?" centered sortable>
              <span class="tag" :class="{ 'is-danger': props.row.cancelled }">
                {{ props.row.cancelled | beautify }}
              </span>
            </b-table-column>

            <b-table-column field="status" label="Status" centered sortable>
              {{ props.row.status | beautify }}
            </b-table-column>

            <b-table-column centered>
              <button class="button is-primary is-small" @click="updateParticipant(props.row)">Save!</button>
            </b-table-column>
          </template>

          <template slot="empty">
            <section class="section">
              <div class="content has-text-grey has-text-centered">
                <p>
                  <b-icon icon="fa fa-times-circle" size="is-large"></b-icon>
                </p>
                <p>Nothing here.</p>
              </div>
            </section>
          </template>
        </b-table>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'StatutoryBoardView',
  data () {
    return {
      applications: [],
      boardBodies: [],
      myBoards: [],
      selectedBody: null,
      limits: {
        delegate: 0,
        observer: 0,
        visitor: 0,
        envoy: 0
      },
      limit: 50,
      query: '',
      event: {
        questions: [],
        type: ''
      },
      can: {
        see_boardview_of: {},
        see_boardview_global: false
      },
      errors: {},
      selectedFields: [],
      fields: [
        { name: 'First name', get: (pax) => pax.first_name },
        { name: 'Last name', get: (pax) => pax.last_name },
        { name: 'Gender', get: (pax) => pax.gender },
        { name: 'Email', get: (pax) => pax.email },
        { name: 'Created at', get: (pax) => pax.created_at },
        { name: 'Updated at', get: (pax) => pax.updated_at },
        { name: 'Participant type', get: (pax) => pax.participant_type ? `${pax.participant_type} (${pax.participant_order})` : '' },
        { name: 'Board comment', get: (pax) => pax.board_comment }
      ],
      isLoading: false,
      isSaving: false
    }
  },
  computed: {
    ...mapGetters({
      services: 'services',
      loginUser: 'user'
    }),
    allowedToSendAnyPax () {
      return this.limits.delegate !== 0 || this.limits.visitor !== 0 || this.limits.envoy !== 0 || this.limits.observer !== 0
    },
    filteredApplications () {
      const filtered = this.applications

      const lowercaseQuery = this.query.toLowerCase()

      return filtered.filter(app =>
        ['first_name', 'last_name', 'email'].some(field => app[field].toLowerCase().includes(lowercaseQuery)))
    }
  },
  methods: {
    updateParticipant (pax) {
      this.errors = {}
      const url = this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/applications/' + pax.id + '/board'

      this.axios.put(url, {
        participant_type: pax.participant_type,
        participant_order: pax.participant_order,
        board_comment: pax.board_comment
      }).then(() => {
        this.$root.showSuccess('Participant is successfully updated.')
      }).catch((err) => {
        if (err.response && err.response.data && err.response.data.message) {
          this.$root.showDanger('Could not update participant: ' + err.response.data.message)
        } else if (err.response && err.response.data.errors) {
          this.errors = err.response.data.errors
        } else {
          this.$root.showDanger('Could not update participant: ' + err.message)
        }
      })
    },
    fetchBoardview () {
      this.isLoading = true
      this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/applications/boardview/' + this.selectedBody).then((application) => {
        this.applications = application.data.data

        return this.axios.get(this.services['oms-statutory'] + '/limits/' + this.event.type + '/' + this.selectedBody)
      }).then((limit) => {
        this.limits = limit.data.data
        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false

        this.$root.showDanger('Could not fetch boardview: ' + err.message)
      })
    }
  },
  filters: {
    numberOrUnlimited (value) {
      return value === null ? 'Unlimited amount of' : value
    }
  },
  watch: {
    'selectedBody' () {
      this.fetchBoardview()
    }
  },
  mounted () {
    this.isLoading = true

    this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id).then((event) => {
      this.event = event.data.data
      this.can = event.data.data.permissions
      this.myBoards = Object.keys(this.can.see_boardview_of)
        .filter(key => this.can.see_boardview_of[key])
        .map(id => Number(id))
      this.selectedBody = this.myBoards.length > 0 ? this.myBoards[0] : null

      for (const index in this.event.questions) {
        this.fields.push({
          name: this.event.questions[index].description,
          get: pax => pax.answers[index]
        })
      }

      if (this.can.see_boardview_global) {
        // Fetching all bodies
        this.axios.get(this.services['oms-core-elixir'] + '/bodies/').then((body) => {
          this.boardBodies = body.data.data
        })
      } else {
        // Using login user's bodies.
        this.boardBodies = this.myBoards.map(id => this.loginUser.bodies.find(body => body.id === id))
      }
    }).catch((err) => {
      this.isLoading = false
      let message = (err.response.status === 404) ? 'Event is not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
      this.$router.push({ name: 'oms.statutory.list' })
    })
  }
}
</script>
