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

        <div class="field" v-if="allowedToSendAnyPax">
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

        <table class="table is-narrow is-fullwidth" v-if="selectedBody && allowedToSendAnyPax">
          <thead>
            <tr>
              <th>#</th>
              <th>Name and surname</th>
              <th class="has-background-white-bis" v-for="(field, index) in selectedFields" v-bind:key="index">{{ field.name }}</th>
              <th>Participant type</th>
              <th>Participant order</th>
              <th>Board comment</th>
              <th>Cancelled?</th>
              <th>Application status</th>
              <th>Paid fee</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="pax in filteredApplications" v-bind:key="pax.user_id">
              <td>{{ pax.id }}</td>
              <td>
                <router-link :to="{ name: 'oms.members.view', params: { id: pax.user_id } }">
                  {{ pax.user ? pax.user.first_name + ' ' + pax.user.last_name: 'Loading...' }}
                </router-link>
              </td>
              <td v-for="(field, index) in selectedFields" v-bind:key="index">{{ field.get(pax) }}</td>
              <td>
                <div class="select">
                  <select v-model="pax.participant_type">
                    <option :value="null">Not set</option>
                    <option value="delegate" v-show="limits.delegate !== 0">Delegate</option>
                    <option value="visitor" v-show="limits.visitor !== 0">Visitor</option>
                    <option value="envoy" v-show="limits.envoy !== 0">Envoy</option>
                    <option value="observer" v-show="limits.observer !== 0">Observer</option>
                  </select>
                </div>
              </td>
              <td>
                <input class="input" type="number" v-model.number="pax.participant_order" min="0" />
              </td>
              <td>
                <textarea class="textarea" v-model="pax.board_comment" />
              </td>
              <td :class="{ 'has-background-danger': pax.cancelled }">{{ pax.cancelled ? 'Yes' : 'No' }}</td>
              <td>{{ pax.status | capitalize }}</td>
              <td>{{ pax.paid_fee ? 'Yes' : 'No'  }}</td>
              <th>
                <button class="button is-primary" @click="updateParticipant(pax)">Save!</button>
              </th>
            </tr>
            <tr v-if="applications.length == 0 && !isLoading">
              <td :colspan="7 + selectedFields.length">No applications yet!</td>
            </tr>
            <tr v-if="isLoading">
              <td :colspan="7 + selectedFields.length">Loading...</td>
            </tr>
          </tbody>
        </table>

        <nav class="pagination" v-show="applications.length > 0">
          <ul class="pagination-list">
            <li v-for="(value, index) in Math.ceil(applications.length / limit)" :key="index">
              <a class="pagination-link" :class="{ 'is-current': index === page }" @click="page = index">{{ (index + 1) }} </a>
            </li>
          </ul>
        </nav>
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
        envoy: null
      },
      page: 0,
      limit: 50,
      event: {
        questions: [],
        type: ''
      },
      can: {
        see_boardview_of: {}
      },
      errors: {},
      selectedFields: [],
      fields: [],
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

      return filtered.slice(this.page * this.limit, (this.page + 1) * this.limit - 1)
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

        this.fetchDisplayedUsers()

        return this.axios.get(this.services['oms-statutory'] + '/limits/' + this.event.type + '/' + this.selectedBody)
      }).then((limit) => {
        this.limits = limit.data.data
        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false

        this.$root.showDanger('Could not fetch boardview: ' + err.message)
      })
    },
    fetchDisplayedUsers () {
      for (const pax of this.filteredApplications) {
        if (pax.user && pax.body) {
          continue
        }

        this.axios.get(this.services['oms-core-elixir'] + '/members/' + pax.user_id).then((user) => {
          const member = user.data.data

          this.$set(pax, 'user', member)
          this.$set(pax, 'body', member.bodies.find(body => body.id === pax.body_id))
        }).catch(console.error)
      }
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
    },
    page () {
      this.fetchDisplayedUsers()
    }
  },
  mounted () {
    this.isLoading = true

    this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id).then((event) => {
      this.event = event.data.data
      this.can = event.data.data.permissions
      this.myBoards = Object.keys(this.can.see_boardview_of).filter(key => this.can.see_boardview_of[key])
      this.selectedBody = this.myBoards.length > 0 ? this.myBoards[0] : null

      for (const index in this.event.questions) {
        this.fields.push({
          name: this.event.questions[index].description,
          get: pax => pax.answers[index]
        })
      }

      for (const bodyId of this.myBoards) {
        this.axios.get(this.services['oms-core-elixir'] + '/bodies/' + bodyId).then((body) => {
          this.boardBodies.push(body.data.data)
        })
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
