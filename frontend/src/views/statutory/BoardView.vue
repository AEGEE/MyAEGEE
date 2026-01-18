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
                <font-awesome-icon icon="globe" />
              </div>
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
          <p v-if="allowedToSendAnyPax">The deadline for board approval is: <strong>{{ event.board_approve_deadline | datetime }}</strong> (local time).</p>
        </div>

        <div class="tabs is-centered is-boxed">
          <ul>
            <li :class="{ 'is-active': scope === 'edit' }" @click="scope = 'edit'" v-show="bodyStatuses.length > 0 && canEditSelectedBody">
              <a>
                <span class="icon is-small"><font-awesome-icon icon="pen" aria-hidden="true" /></span>
                <span>Edit boardview</span>
              </a>
            </li>
            <li :class="{ 'is-active': scope === 'view' }" @click="scope = 'view'">
              <a>
                <span class="icon is-small"><font-awesome-icon icon="users" aria-hidden="true" /></span>
                <span>View applications</span>
              </a>
            </li>
          </ul>
        </div>

        <div v-show="scope === 'edit' && selectedBody">
          <div class="notification is-danger" v-if="Object.keys(this.errors).length > 0">
            <div class="content">
              <strong>This errors occured while trying to update the participant:</strong>
              <ul>
                <li v-if="errors.participant_type">Participant type: {{ errors.participant_type.join(', ') }}</li>
                <li v-if="errors.participant_order">Participant order: {{ errors.participant_order.join(', ') }}</li>
                <li v-if="errors.participantTypeShouldBeSetWithOrder">{{ errors.participantTypeShouldBeSetWithOrder.join(', ') }}</li>
                <li v-if="errors.board_comment">Board comment: {{ errors.board_comment.join(', ') }}</li>
              </ul>
            </div>
          </div>

          <div class="notification is-warning">
            <p>To allow for an anonymous selection procedure, please do not provide any personal information here (like the name of the applicant).</p>
          </div>

          <div>
            <b-table
              :data="bodyStatuses">
              <b-table-column label="Participant type and order" v-slot="props">
                {{ props.row.participant_type }} ({{ props.row.participant_order }})
              </b-table-column>

              <b-table-column field="user_id" label="User" v-slot="props">
                <div class="select">
                  <select v-model="props.row.user_id">
                    <option :value="null">Not set</option>
                    <option v-for="application in applications" v-bind:key="application.user_id" v-bind:value="application.user_id">
                      {{ application.first_name }} {{ application.last_name }}
                    </option>
                  </select>
                </div>
              </b-table-column>

              <b-table-column field="board_comment" label="Board comment" sortable v-slot="props">
                <textarea class="textarea" v-model="props.row.board_comment" />
              </b-table-column>
            </b-table>
          </div>

          <div class="notification is-warning">
            <p>Please keep in mind that if you haven't selected any application here, its participant type/order and board comment would be unset.</p>
            <p>If you are swapping 2 applications, please swap their board comments as well.</p>
          </div>

          <button class="button is-fullwidth is-primary" @click="updateParticipants()">Save!</button>
        </div>

        <div v-show="scope === 'view' && selectedBody">
          <div class="field">
            <label class="label">Search by name, surname or email</label>
            <div class="field has-addons">
              <div class="control is-expanded">
                <input class="input" type="text" v-model="query" placeholder="Search by name, surname or email" />
              </div>
              <div class="control">
                <button class="button is-primary" v-if="!displayCancelled" @click="displayCancelled = true">Display all applications</button>
                <button class="button is-primary" v-if="displayCancelled" @click="displayCancelled = false">Display only not cancelled applications</button>
              </div>
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
                label="name">
                <template
                  slot="selection"
                  slot-scope="{ values, isOpen }">
                  <span class="multiselect__single" v-if="values.length &amp;&amp; !isOpen">{{ values.length }} fields selected</span>
                </template>
              </multiselect>
            </div>
          </div>

          <b-table
            :data="filteredApplications"
            :row-class="row => calculateClassForApplication(row)"
            :loading="isLoading"
            paginated
            :per-page="limit">
            <b-table-column field="statutory_id" label="#" numeric v-slot="props">
              {{ props.row.statutory_id }}
            </b-table-column>

            <b-table-column field="last_name" label="First and last name" v-slot="props">
              {{ props.row.first_name }} {{ props.row.last_name }}
            </b-table-column>

            <b-table-column label="Participant type and order" v-slot="props">
              <span v-if="props.row.participant_type">{{ props.row.participant_type }} ({{ props.row.participant_order }})</span>
            </b-table-column>

            <b-table-column field="is_on_memberslist" label="Is on memberslist?" centered :visible="event.type === 'agora'" v-slot="props">
              <span :class="calculateClassForMemberslist(props.row)">
                {{ props.row.is_on_memberslist | beautify }}
              </span>
            </b-table-column>

            <b-table-column field="cancelled" label="Cancelled?" centered :visible="displayCancelled" v-slot="props">
              <span class="tag" :class="{ 'is-danger': props.row.cancelled }">
                {{ props.row.cancelled | beautify }}
              </span>
            </b-table-column>

            <b-table-column label="View" centered v-slot="props">
              <router-link :to="{ name: 'oms.statutory.applications.view', params: { id: event.url || event.id, application_id: props.row.statutory_id || props.row.id } }">
                View
              </router-link>
            </b-table-column>

            <b-table-column field="status" label="Status" centered v-slot="props">
              <span v-if="props.row.status === 'accepted'">Accepted</span>
              <span v-if="props.row.status === 'rejected'">Rejected</span>
              <span v-if="props.row.status === 'waiting_list'">Waiting list</span>
              <span v-if="props.row.status === 'pending'">Pending</span>
            </b-table-column>

            <b-table-column v-for="(field, index) in selectedFields" v-bind:key="index" field="answers[index]" :label="field.name" v-slot="props">
              {{ field.get(props.row) | beautify }}
            </b-table-column>

            <template slot="empty">
              <empty-table-stub />
            </template>
          </b-table>
        </div>

        <div class="subtitle" v-if="boardBodies.length === 0">You are not a board member of any body.</div>
        <div class="subtitle" v-if="!selectedBody && boardBodies.length > 0">You haven't selected the antenna yet.</div>
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
      bodyStatuses: [],
      scope: 'edit',
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
      displayCancelled: false,
      errors: {},
      selectedFields: [],
      fields: [
        { name: 'First name', get: (pax) => pax.first_name },
        { name: 'Last name', get: (pax) => pax.last_name },
        { name: 'Gender', get: (pax) => pax.gender },
        { name: 'Email', get: (pax) => pax.notification_email },
        { name: 'Created at', get: (pax) => pax.created_at },
        { name: 'Updated at', get: (pax) => pax.updated_at },
        { name: 'Participant type', get: (pax) => (pax.participant_type ? `${pax.participant_type} (${pax.participant_order})` : '') },
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
      const filterCancelled = this.displayCancelled
        ? this.applications
        : this.applications.filter(app => !app.cancelled)

      const lowercaseQuery = this.query.toLowerCase()

      return filterCancelled.filter(app => ['first_name', 'last_name', 'notification_email'].some(field => app[field].toLowerCase().includes(lowercaseQuery)))
    },
    canEditSelectedBody () {
      return this.can.set_board_comment_and_participant_type.global
        || this.can.set_board_comment_and_participant_type[this.selectedBody]
    }
  },
  methods: {
    calculateClassForApplication (pax) {
      switch (pax.status) {
      case 'accepted':
        return 'has-background-success'
      case 'rejected':
        return 'has-background-danger'
      case 'waiting_list':
        return 'has-background-warning'
      default:
        return ''
      }
    },
    calculateClassForMemberslist (pax) {
      return ['tag', 'is-small', pax.is_on_memberslist ? 'is-primary' : 'is-danger']
    },
    updateParticipants () {
      // checking for dups
      const ids = this.bodyStatuses
        .map(s => s.user_id)
        .filter(s => !!s)

      for (let index = 0; index < ids.length; index++) {
        if (ids[index] && ids.indexOf(ids[index]) !== index) {
          return this.$root.showError('You\'ve specified one user multiple times, please remove any duplicate users and try again.')
        }
      }

      // also checking if there's an entry with a board comment but without user (pointless)
      for (const entry of this.bodyStatuses) {
        if (!entry.user_id && entry.board_comment) {
          return this.$root.showWarning('You\'ve specified a board comment but didn\'t select an appplication for it. Either remove the board comment or select an applicant for it.')
        }
      }

      this.errors = {}
      const url = this.services['statutory'] + '/events/' + this.$route.params.id + '/applications/boardview/' + this.selectedBody
      const body = this.bodyStatuses.filter(entry => entry.user_id !== null && typeof entry.user_id !== 'undefined')

      this.axios.post(url, body).then(() => {
        this.$root.showSuccess('Participants info is successfully updated.')
      }).catch((err) => {
        if (err.response && err.response.data.errors) {
          this.errors = err.response.data.errors
        } else {
          this.$root.showError('Could not update participants info', err)
        }
      })
    },
    fetchBoardview () {
      this.isLoading = true
      this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id + '/applications/boardview/' + this.selectedBody).then((application) => {
        this.applications = application.data.data

        return this.axios.get(this.services['statutory'] + '/limits/' + this.event.type + '/' + this.selectedBody)
      }).then((limitResponse) => {
        this.limits = limitResponse.data.data

        // setting the selected body statuses to send to the endpoint
        this.bodyStatuses = []
        for (const type of ['delegate', 'envoy', 'observer', 'visitor']) {
          // setting 30 as a max value, why not
          const limit = this.limits[type] !== null ? this.limits[type] : 30

          for (let order = 1; order <= limit; order++) {
            const entry = {
              participant_type: type,
              participant_order: order,
              user_id: null,
              board_comment: null
            }
            const application = this.applications.find(a => a.participant_type === type && a.participant_order === order)
            if (application) {
              entry.user_id = application.user_id
              entry.board_comment = application.board_comment
            }

            this.bodyStatuses.push(entry)
          }
        }

        // if the body cannot send anyone, disabling the 'edit' scope
        // and switching to applications view instead.
        if (this.bodyStatuses.length === 0 || !this.canEditSelectedBody) {
          this.scope = 'view'
        }

        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false

        this.$root.showError('Could not fetch boardview', err)
      })
    }
  },
  filters: {
    numberOrUnlimited (value) {
      return value === null ? 'Unlimited amount of' : value
    }
  },
  watch: {
    selectedBody () {
      this.fetchBoardview()
    }
  },
  mounted () {
    this.isLoading = true

    this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id).then((event) => {
      this.loading = false

      this.event = event.data.data
      this.can = event.data.data.permissions
      this.myBoards = Object.keys(this.can.see_boardview)
        .filter(key => key !== 'global')
        .filter(key => this.can.see_boardview[key])
        .map(id => Number(id))
      this.selectedBody = this.myBoards.length > 0 ? this.myBoards[0] : null

      for (const index in this.event.questions) {
        this.fields.push({
          name: this.event.questions[index].description,
          get: pax => pax.answers[index]
        })
      }

      if (this.can.see_boardview.global) {
        // Fetching all bodies
        this.axios.get(this.services['core'] + '/bodies/').then((body) => {
          this.boardBodies = body.data.data
        })
      } else {
        // Using login user's bodies.
        this.boardBodies = this.myBoards.map(id => this.loginUser.bodies.find(body => body.id === id))
      }
    }).catch((err) => {
      this.isLoading = false
      if (err.response && err.response.status === 404) {
        this.$root.showError('Event is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

      this.$router.push({ name: 'oms.statutory.list.all' })
    })
  }
}
</script>
