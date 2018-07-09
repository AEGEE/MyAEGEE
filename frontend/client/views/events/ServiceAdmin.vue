<template>
  <div class="tile is-ancestor service-admin">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <div class="tile is-parent">
          <div class="tile is-child is-6">
            <div class="title">Service stats</div>
            <table class="table is-narrow is-fullwidth">
              <tbody>
                <tr>
                  <th>Uptime</th>
                  <td>{{ status.uptime }}ms.</td>
                </tr>
                <tr>
                  <th>Requests count</th>
                  <td>{{ status.requests }}</td>
                </tr>
                <tr>
                  <th>Deadline crons</th>
                  <td>{{ status.deadline_crons }}ms.</td>
                </tr>
                <tr>
                  <th>Roundtrip</th>
                  <td>{{ roundtrip.status }}ms.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="tile is-child is-6">
            <div class="title">User details</div>
            <table class="table is-narrow is-fullwidth">
              <tbody>
                <tr>
                  <th>Name</th>
                  <td>{{ user.first_name }} {{ user.last_name }}</td>
                </tr>

                <tr>
                  <th>Roundtrip</th>
                  <td>{{ roundtrip.user }}ms.</td>
                </tr>

                <tr>
                  <th>Is superadmin?</th>
                  <td>{{ (user.user && user.user.superadmin) ? 'Yes' : 'No' }}</td>
                </tr>

                <tr v-show="(user.user && user.user.superadmin)">
                  <td><a @click="seedLifecycles()" class="button is-small is-info is-fullwidth">Seed lifecycles</a></td>
                  <td><a @click="seedEvents()" class="button is-small is-info is-fullwidth">Seed events</a></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </article>

      <article class="tile is-child" v-show="(!user.user || !user.user.superadmin)">
        <div class="title has-text-centered is-fullwidth">Lifecycles management</div>
        <div class="subtitle has-text-centered is-fullwidth">You are not allowed to see this.</div>
      </article>

      <article class="tile is-child" v-show="(user.user && user.user.superadmin)">
        <div class="title has-text-centered is-fullwidth">Lifecycles management</div>

        <div class="tabs is-centered is-boxed">
          <ul>
            <li
              v-for="(eventType, index) in eventTypes" v-bind:key="eventType.name"
              :class="{ 'is-active' : selectedEventTypeIndex === index }"
              @click="selectedEventTypeIndex = index">
              <a>
                <span>{{ eventType.name }}</span>
                <span class="icon is-small" @click="askDeleteEventType(index)"><i class="fa fa-minus"></i></span>
              </a>
            </li>
            <li v-if="!eventTypes.length"><a><i>No event types are set.</i></a></li>
            <li @click="addNewEventType()">
              <a>
                <span class="icon is-small"><i class="fa fa-plus"></i></span>
              </a>
            </li>
          </ul>
        </div>

        <div v-if="eventTypes[selectedEventTypeIndex]">
          <div class="field">
            <label class="label">Name</label>
            <div class="control">
              <input class="input" type="text" required v-model="eventTypes[selectedEventTypeIndex].name" />
            </div>
            <p class="help is-danger" v-if="errors.name">{{ errors.name.join(', ')}}</p>
          </div>

          <div class="field">
            <label class="label">Initial status</label>
            <div class="select">
              <select v-model="eventTypes[selectedEventTypeIndex].defaultLifecycle.initialStatus">
                <option v-for="status in eventTypes[selectedEventTypeIndex].defaultLifecycle.statuses" v-bind:key="status.name" v-bind:value="status.name">
                  {{ status.name }}
                </option>
              </select>
            </div>
            <p class="help is-danger" v-if="errors['defaultLifecycle.initialStatus']">
              {{ errors['defaultLifecycle.initialStatus'].message }}
            </p>
          </div>

          <div class="subtitle">Statuses</div>
          <table class="table is-narrow is-fullwidth">
            <thead>
              <tr>
                <th>Name</th>
                <th>Access rights</th>
                <th>Remove</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(status, index) in eventTypes[selectedEventTypeIndex].defaultLifecycle.statuses" v-bind:key="status.value">
                <td>
                  <input class="input" v-model="status.name" /></td>
                <td>
                  <span>Change who can edit:</span>
                  <button class="button is-small is-info" @click="showModal(status.visibility, 'edit visibility');">visibility</button>
                  <button class="button is-small is-info" @click="showModal(status.applicable, 'edit applicable')">applicable</button>
                  <button class="button is-small is-info" @click="showModal(status.edit_details, 'edit details')">event details</button>
                  <button class="button is-small is-info" @click="showModal(status.edit_organizers, 'edit organizers')">organizers</button>
                  <button class="button is-small is-info" @click="showModal(status.edit_application_status, 'edit application status')">application status</button>
                  <button class="button is-small is-info" @click="showModal(status.view_applications, 'view applications')">view applications</button>
                </td>
                <td>
                  <button class="button is-small is-danger" @click="eventTypes[selectedEventTypeIndex].defaultLifecycle.statuses.splice(index, 1)">Remove status</button>
                </td>
              </tr>
            </tbody>
          </table>
          <button class="button is-primary" @click="addNewStatus()">Add status</button>

          <div class="subtitle">Transitions</div>
          <table class="table is-narrow is-fullwidth">
            <thead>
              <tr>
                <td>From</td>
                <td>To</td>
                <td>Allowed for</td>
                <td>Remove</td>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(transition, index) in eventTypes[selectedEventTypeIndex].defaultLifecycle.transitions" v-bind:key="transition">
                <td>
                  <div class="select">
                    <select v-model="transition.from">
                      <option v-for="status in eventTypes[selectedEventTypeIndex].defaultLifecycle.statuses" v-bind:key="status.name" v-bind:value="status.name">
                        {{ status.name }}
                      </option>
                    </select>
                  </div>
                </td>
                <td>
                  <div class="select">
                    <select v-model="transition.to">
                      <option v-for="status in eventTypes[selectedEventTypeIndex].defaultLifecycle.statuses" v-bind:key="status.name" v-bind:value="status.name">
                        {{ status.name }}
                      </option>
                    </select>
                  </div>
                </td>
                <td>
                  <button class="button is-small is-info" @click="showModal(transition.allowedFor, 'transition permissions')">Change transition permissions</button>
                </td>
                <td>
                  <button class="button is-small is-danger" @click="eventTypes[selectedEventTypeIndex].defaultLifecycle.transitions.splice(index, 1)">Remove transition</button>
                </td>
              </tr>
            </tbody>
          </table>

          <div class="field is-grouped">
            <div class="control"><button class="button is-info" @click="addNewTransition()">Add transition</button></div>
            <div class="control"><button class="button is-primary" @click="saveEventType()">Save</button></div>
            <div class="control"><button class="button is-danger" @click="askDeleteEventType(selectedEventTypeIndex)">Delete</button></div>
          </div>

          <div class="field">
            <div class="help is-danger" v-if="Object.keys(errors).length > 0">
              <pre>{{ JSON.stringify(errors, null, '  ') }}</pre>
            </div>
          </div>
        </div>
      </article>
    </div>

    <b-loading is-full-page="false" :active.sync="isLoadingSomething"></b-loading>

    <div class="modal is-active" v-if="editingSchema">
      <div class="modal-background" @click="editingSchema = null"></div>
      <div class="modal-card">
        <div class="modal-card-head">
          <p class="modal-card-title">Edit something</p>
          <button class="delete" aria-label="close" @click="editingSchema = null"></button>
        </div>
        <div class="modal-card-body">
          <table class="table">
            <thead>
              <tr>
                <th>Entry</th>
                <th>List of objects</th>
                <th>Add a new object</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Users</td>
                <td>
                  <ul>
                    <li v-for="(user, index) in editingSchema.users" v-bind:key="user">
                      <a class="tag is-danger">
                        {{ user }}
                        <button class="delete is-small" @click="editingSchema.users.splice(index, 1)"></button>
                      </a>
                    </li>
                  </ul>
                  <i v-if="!editingSchema.users.length">No users set.</i>
                </td>
                <td>
                  <div class="field has-addons">
                    <b-autocomplete
                      :expanded="true"
                      v-model="autoComplete.members.name"
                      :data="autoComplete.members.values"
                      open-on-focus="true"
                      :loading="autoComplete.members.loading"
                      @input="query => fetchSomething(query, 'members', 'members')"
                      @select="user => editingSchema.users.push(user.id)">
                      <template slot-scope="props">
                        <div class="media">
                          <div class="media-content">
                            {{ props.option.first_name }} {{ props.option.last_name }}
                          </div>
                        </div>
                      </template>
                    </b-autocomplete>
                  </div>
                </td>
              </tr>
              <tr>
                <td>Circles</td>
                <td>
                  <ul>
                    <li v-for="(circle, index) in editingSchema.circles" v-bind:key="circle">
                      <a class="tag is-danger">
                        {{ circle }}
                        <button class="delete is-small" @click="editingSchema.circles.splice(index, 1)"></button>
                      </a>
                    </li>
                  </ul>
                  <i v-if="!editingSchema.users.length">No users set.</i>
                </td>
                <td>
                  <div class="field has-addons">
                    <b-autocomplete
                      :expanded="true"
                      v-model="autoComplete.circles.name"
                      :data="autoComplete.circles.values"
                      open-on-focus="true"
                      :loading="autoComplete.circles.loading"
                      @input="query => fetchSomething(query, 'circles', 'circles')"
                      @select="circle => editingSchema.circles.push(circle.id)">
                      <template slot-scope="props">
                        <div class="media">
                          <div class="media-content">
                            {{ props.option.name }}
                            <br />
                            <small>{{ props.option.description }}</small>
                          </div>
                        </div>
                      </template>
                    </b-autocomplete>
                  </div>
                </td>
              </tr>
              <tr>
                <td>Bodies</td>
                <td>
                  <ul>
                    <li v-for="(body, index) in editingSchema.bodies" v-bind:key="body">
                      <a class="tag is-danger">
                        {{ body }}
                        <button class="delete is-small" @click="editingSchema.bodies.splice(index, 1)"></button>
                      </a>
                    </li>
                  </ul>
                  <i v-if="!editingSchema.bodies.length">No users set.</i>
                </td>
                <td>
                  <div class="field has-addons">
                    <b-autocomplete
                      :expanded="true"
                      v-model="autoComplete.bodies.name"
                      :data="autoComplete.bodies.values"
                      open-on-focus="true"
                      :loading="autoComplete.bodies.loading"
                      @input="query => fetchSomething(query, 'bodies', 'bodies')"
                      @select="body => editingSchema.bodies.push(body.id)">
                      <template slot-scope="props">
                        <div class="media">
                          <div class="media-content">
                            {{ props.option.name }}
                            <br />
                            <small>{{ props.option.description }}</small>
                          </div>
                        </div>
                      </template>
                    </b-autocomplete>
                  </div>
                </td>
              </tr>
              <tr>
                <td>Special</td>
                <td>
                  <ul>
                    <li v-for="(special, index) in editingSchema.special" v-bind:key="special">
                      <a class="tag is-danger">
                        {{ special }}
                        <button class="delete is-small" @click="editingSchema.special.splice(index, 1)"></button>
                      </a>
                    </li>
                  </ul>
                  <i v-if="!editingSchema.special.length">No special roles set.</i>
                </td>
                <td>
                  <div class="field has-addons">
                    <b-autocomplete
                      :expanded="true"
                      v-model="autoComplete.pseudo.name"
                      :data="pseudo"
                      open-on-focus="true"
                      @select="pseudo => editingSchema.special.push(pseudo.name)">
                      <template slot-scope="props">
                        <div class="media">
                          <div class="media-content">
                            {{ props.option.name }}
                            <br />
                            <small>{{ props.option.description }}</small>
                          </div>
                        </div>
                      </template>
                    </b-autocomplete>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="modal-card-foot">
          <button class="button is-success" @click="editingSchema = null">
            <span class="icon"><i class="fa fa-plus-circle"></i></span>
            <span>Accept</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.service-admin .modal .modal-card {
  min-height: 500px;
  min-width: 800px;
}
</style>

<script>
import { mapGetters } from 'vuex'
import moment from 'moment'

const emptySchema = { users: [], bodies: [], circles: [], special: [] }

export default {
  name: 'EventsServiceAdmin',
  data () {
    return {
      user: {},
      eventTypes: [],
      pseudo: [],
      status: {
        uptime: 0,
        requests: 0,
        deadline_crons: 0
      },
      selectedEventTypeIndex: -1,
      isLoading: {
        eventTypes: false,
        user: false,
        status: false,
        pseudo: false
      },
      autoComplete: {
        members: { name: '', values: [], loading: false },
        bodies: { name: '', values: [], loading: false },
        circles: { name: '', values: [], loading: false },
        pseudo: { name: '' }
      },
      errors: {},
      editingSchema: null,
      roundtrip: {
        user: 0,
        status: 0
      },
      source: null
    }
  },
  computed: {
    ...mapGetters({
      services: 'services',
      loginUser: 'user'
    }),
    isLoadingSomething () {
      return Object.keys(this.isLoading).some(key => this.isLoading[key])
    }
  },
  methods: {
    seedEvents () {
      const total = 10
      const titles = [
        'Hackathon',
        'Visit museum',
        'Sightseeing',
        'LGBTI Demonstration',
        'Adventure time: return of the rabbits',
        'Jamsession',
        `Develop Yourself ${Math.floor(Math.random() * 20)}`,
        'The Mystery of Transylvanian (K)nights'
      ]

      const descriptions = [
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quae cum dixisset paulumque institisset, Quid est? Omnes enim iucundum motum, quo sensus hilaretur. Duo Reges: constructio interrete. Qua ex cognitione facilior facta est investigatio rerum occultissimarum.',
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Utinam quidem dicerent alium alio beatiorem! Iam ruinas videres. Si stante, hoc natura videlicet vult, salvam esse se, quod concedimus; Iam id ipsum absurdum, maximum malum neglegi. Quorum sine causa fieri nihil putandum est. Non potes, nisi retexueris illa. Duo Reges: constructio interrete. Mihi enim satis est, ipsis non satis. Si enim ad populum me vocas, eum. Tibi hoc incredibile, quod beatissimum. Quod si ita se habeat, non possit beatam praestare vitam sapientia.',
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. An potest, inquit ille, quicquam esse suavius quam nihil dolere? Qualis ista philosophia est, quae non interitum afferat pravitatis, sed sit contenta mediocritate vitiorum? Ergo id est convenienter naturae vivere, a natura discedere. Qua tu etiam inprudens utebare non numquam. Inde sermone vario sex illa a Dipylo stadia confecimus. ',
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Tum Quintus: Est plane, Piso, ut dicis, inquit. Nonne igitur tibi videntur, inquit, mala? Mihi enim erit isdem istis fortasse iam utendum. Et ille ridens: Video, inquit, quid agas; Duo Reges: constructio interrete. Paulum, cum regem Persem captum adduceret, eodem flumine invectio? Quo plebiscito decreta a senatu est consuli quaestio Cn. Videamus animi partes, quarum est conspectus illustrior; Mihi enim satis est, ipsis non satis. Satis est ad hoc responsum. Nondum autem explanatum satis, erat, quid maxime natura vellet.'
      ]

      const lifecycles = this.eventTypes.map(e => e.name)
      const bodies = this.loginUser.bodies.map(body => body.id)

      for (let i = 0; i < total; i++) {
        const title = titles[Math.floor(Math.random() * titles.length)]
        const start = moment().add(Math.random() * 3 * 365 * 24 * 60 * 60, 'seconds').toDate() // this date plus 3 years
        const end = moment(start).add(Math.random() * 14 * 24 * 60 * 60, 'seconds').toDate() // start date plus 2 weeks
        const description = descriptions[Math.floor(Math.random() * descriptions.length)]
        const eventType = lifecycles[Math.floor(Math.random() * lifecycles.length)]
        const body = bodies[Math.floor(Math.random() * bodies.length)]

        const event = {
          name: title,
          starts: start,
          ends: end,
          description,
          type: eventType,
          body_id: body
        }

        this.axios.post(this.services['oms-events'], event).then((response) => {
          this.$toast.open({
            message: 'Event "' + event.name + '" is successfully added.',
            type: 'is-success'
          })
        }).catch((err) => {
          this.$toast.open({
            duration: 3000,
            message: 'Could not save event: ' + err.message,
            type: 'is-danger'
          })
        })
      }
    },
    askDeleteEventType (index) {
      const eventType = this.eventTypes[index]
      const message =
        'Are you sure you want to <b>delete</b> ' +
        eventType.name +
        ' from the system? This action cannot be undone.'

      this.$dialog.confirm({
        title: 'Deleting the event type',
        message,
        confirmText: 'Delete event type',
        type: 'is-danger',
        hasIcon: true,
        onConfirm: () => this.deleteEventType(index)
      })
    },
    deleteEventType (index) {
      const eventType = this.eventTypes[index]
      this.axios.delete(this.services['oms-events'] + '/lifecycle/' + eventType.name).then((response) => {
        this.$toast.open('Event type is deleted.')

        this.eventTypes.splice(index, 1)
        this.selectedEventTypeIndex -= 1
      }).catch((err) => this.$toast.open({
        duration: 3000,
        message: 'Could not delete event type: ' + err.message,
        type: 'is-danger'
      }))
    },
    saveEventType () {
      this.isLoading.eventType = true
      const eventType = this.eventTypes[this.selectedEventTypeIndex]
      // Create an object for sending to server...
      const newLifecycle = {
        eventType: eventType.name,
        statuses: JSON.parse(JSON.stringify(eventType.defaultLifecycle.statuses)),
        transitions: JSON.parse(JSON.stringify(eventType.defaultLifecycle.transitions)),
        initialStatus: eventType.defaultLifecycle.initialStatus
      }

      // ... aaaand sending it.
      this.axios.post(this.services['oms-events'] + '/lifecycle', newLifecycle).then(() => {
        this.isLoading.eventType = false
        this.$toast.open({
          message: `The default lifecycle for the event type '${eventType.name}' is successfully updated.`,
          type: 'is-success'
        })
      }).catch((err) => {
        this.isLoading.eventType = false
        if (err.response.status === 422) {
          this.errors = err.response.data.errors
          return this.$toast.open({
            duration: 3000,
            message: 'Some of the lifecycle data is invalid: ' + err.response.data.message,
            type: 'is-danger'
          })
        }
        this.$toast.open({
          duration: 3000,
          message: 'Could not delete event type: ' + err.message,
          type: 'is-danger'
        })
      })
    },
    showModal (objectToBind) {
      this.editingSchema = objectToBind
    },
    fetchSomething (query, key, context) {
      if (!query) return

      this.autoComplete[key].values = []
      this.autoComplete[key].loading = true

      if (this.token) this.token.cancel()
      this.token = this.axios.CancelToken.source()

      this.axios.get(this.services['oms-core-elixir'] + '/' + context, {
        cancelToken: this.token.token,
        params: { query }
      }).then((response) => {
        this.autoComplete[key].values = response.data.data
        this.autoComplete[key].loading = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return console.log('Request canceled')
        }

        this.autoComplete[key].loading = false

        this.$toast.open({
          duration: 3000,
          message: 'Could not fetch ' + context + 's: ' + err.message,
          type: 'is-danger'
        })
      })
    },
    addNewTransition () {
      this.eventTypes[this.selectedEventTypeIndex].defaultLifecycle.transitions.push({
        from: '',
        to: '',
        allowedFor: JSON.parse(JSON.stringify(emptySchema))
      })
    },
    addNewEventType () {
      this.eventTypes.push({
        name: 'Default event type',
        defaultLifecycle: {
          statuses: [],
          transitions: [],
          initialStatus: null
        }
      })
      this.selectedEventTypeIndex = this.eventTypes.length - 1 // selecting it
    },
    addNewStatus () {
      this.eventTypes[this.selectedEventTypeIndex].defaultLifecycle.statuses.push({
        name: '',
        visibility: JSON.parse(JSON.stringify(emptySchema)),
        applicable: JSON.parse(JSON.stringify(emptySchema)),
        approve_participants: JSON.parse(JSON.stringify(emptySchema)),
        edit_application_status: JSON.parse(JSON.stringify(emptySchema)),
        edit_details: JSON.parse(JSON.stringify(emptySchema)),
        edit_organizers: JSON.parse(JSON.stringify(emptySchema)),
        view_applications: JSON.parse(JSON.stringify(emptySchema))
      })
    },
    seedLifecycles () {
      this.axios.get(this.services['oms-events'] + '/lifecycle/seed').then((response) => {
        this.$toast.open({
          duration: 3000,
          message: 'Lifecycles are seeded. Server response: ' + response.data.message,
          type: 'is-success'
        })

        this.isLoading.eventTypes = true
        return this.axios.get(this.services['oms-events'] + '/lifecycle')
      }).then((response) => {
        this.eventTypes = response.data.data
        this.isLoading.eventTypes = false
      }).catch((err) => {
        this.isLoading.eventTypes = false
        this.$toast.open({
          duration: 3000,
          message: 'Could not seed lifecycles: ' + err.message,
          type: 'is-danger'
        })
      })
    }
  },
  mounted () {
    const start1 = Date.now()
    this.isLoading.user = true
    this.axios.get(this.services['oms-events'] + '/getUser').then((response) => {
      this.user = response.data.data
      this.roundtrip.user = Date.now() - start1
      this.isLoading.user = false
    }).catch((err) => {
      this.isLoading.user = false
      this.$toast.open({
        duration: 3000,
        message: 'Could not fetch user: ' + err.message,
        type: 'is-danger'
      })
    })

    const start2 = Date.now()
    this.isLoading.status = true
    this.axios.get(this.services['oms-events'] + '/status').then((response) => {
      this.status = response.data.data
      this.roundtrip.status = Date.now() - start2
      this.isLoading.status = false
    }).catch((err) => {
      this.isLoading.status = false
      this.$toast.open({
        duration: 3000,
        message: 'Could not fetch status: ' + err.message,
        type: 'is-danger'
      })
    })

    this.isLoading.eventTypes = true
    this.axios.get(this.services['oms-events'] + '/lifecycle').then((response) => {
      this.eventTypes = response.data.data
      if (this.eventTypes.length) this.selectedEventTypeIndex = 0 // going to 1st event type selected
      this.isLoading.eventTypes = false
    }).catch((err) => {
      this.isLoading.eventTypes = false
      this.$toast.open({
        duration: 3000,
        message: 'Could not fetch event types: ' + err.message,
        type: 'is-danger'
      })
    })

    this.isLoading.pseudo = true
    this.axios.get(this.services['oms-events'] + '/lifecycle/pseudo').then((response) => {
      this.pseudo = response.data.data
      this.isLoading.pseudo = false
    }).catch((err) => {
      this.isLoading.pseudo = false
      this.$toast.open({
        duration: 3000,
        message: 'Could not fetch pseudo roles: ' + err.message,
        type: 'is-danger'
      })
    })
  }
}
</script>
