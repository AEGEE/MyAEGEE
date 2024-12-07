<template>
  <div class="tile is-ancestor ">
    <div class="tile is-child">
      <form @submit.prevent="saveEvent()">
        <div class="notification is-info" v-if="!$route.params.id">
          <div class="content">
            <p>If you want to upload an image, please do it from the event page after creating the event.</p>
            <p><strong>If the event is not published, people won't be able to see the event in the listing or apply to it.</strong></p>
            <p>Also, <strong>once the event is published you won't be able to edit it.</strong> So please check everything twice.</p>
            <p>If you will need the event info to be changed after publishing, please contact CD or EQAC.</p>
            <p><strong>PLEASE KEEP IN MIND THAT THE APPROVAL OF YOUR SUBMITTED EVENT WILL TAKE 3-4 DAYS.</strong></p>
          </div>
        </div>
        <div class="notification is-info" v-else>
          <div class="content">
            <p>If you want to upload an image, please do it from the event page.</p>
          </div>
        </div>

        <div class="subtitle is-fullwidth has-text-centered">Event details</div>
        <hr />

        <div class="field">
          <label class="label">Title <span class="has-text-danger">*</span></label>
          <div class="control">
            <input class="input" type="text" v-model="event.name" />
          </div>
          <p class="help is-danger" v-if="errors.name">{{ errors.name.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Description <span class="has-text-danger">*</span></label>
          <div class="control">
            <textarea class="textarea" placeholder="e.g. Hello world" required v-model="event.description" />
          </div>
          <label class="label">Preview <MarkdownTooltip /></label>
          <div class="content">
            <span v-html="$options.filters.markdown(event.description)" />
          </div>
          <p class="help is-danger" v-if="errors.description">{{ errors.description.join(', ') }}</p>
        </div>

        <div class="notification is-info" v-if="!$route.params.id">
          <div class="content">
            <p>
              Event URL is the "short name of the event" and is the part of the address this event would be accessible at.
              That can be handy for the generation of nice events URLs.
            </p>
            <p>For example, when set as <i>my-awesome-event</i>, the event would be accessible at <i>https://my.aegee.eu/events/my-awesome-event</i>.</p>
            <p>It can contain only English letters, numbers and cannot have numbers only.</p>
            <p><strong>Please don't put Facebook event link here, this is meant for another purpose described above</strong>.</p>
          </div>
        </div>

        <div class="field">
          <label class="label">Event URL <span class="has-text-danger">*</span></label>
          <div class="control">
            <div class="field has-addons">
              <div class="control">
                <a class="button is-static">/events/</a>
              </div>
              <div class="control">
                <input class="input" type="text" v-model="event.url" />
              </div>
            </div>
          </div>
          <p class="help is-danger" v-if="errors.url">{{ errors.url.join(', ') }}</p>
        </div>

        <div class="notification is-info" v-if="!$route.params.id">
          Please select the event type wisely. <strong>It cannot be changed later.</strong>
        </div>

        <div class="field" v-if="!$route.params.id">
          <label class="label">Event type <span class="has-text-danger">*</span></label>
          <div class="select">
            <select v-model="event.type">
              <option v-for="(name, type) in eventTypes" v-bind:key="type" v-bind:value="type">{{ name }}</option>
            </select>
          </div>
          <p class="help is-danger" v-if="errors.type">{{ errors.type.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Fee <span class="has-text-danger">*</span></label>
          <div class="control">
            <div class="field has-addons">
              <div class="control">
                <a class="button is-static">€</a>
              </div>
              <div class="control">
                <input class="input" type="number" v-model="event.fee" min="0" required />
              </div>
            </div>
          </div>
          <p class="help is-danger" v-if="errors.fee">{{ errors.fee.join(', ') }}</p>
        </div>
        <div class="field">
          <label class="label">Max. participants</label>
          <div class="control">
            <input class="input" type="number" v-model="event.max_participants" min="0" @input="$root.nullifyIfEmpty(event, 'max_participants')" />
          </div>
          <p class="help is-danger" v-if="errors.max_participants">{{ errors.max_participants.join(', ') }}</p>
        </div>
        <div class="field notification is-info">
          <label class="label" style="color: white">Regarding water access</label>
          <p>
            Please make sure that the participants have access to a reasonable amount of water during the event.
          </p>
          <p>
            Tip: Advise your participants to bring their own refillable water bottles and remind them throughout the event to refill them.
          </p>
        </div>

        <div class="field">
          <label class="label">Number of meals provided per day <span class="has-text-danger">*</span></label>
          <div class="control">
            <div class="control">
              <input class="input" type="number" v-model="event.meals_per_day" min="0" max="3" required />
            </div>
          </div>
          <p class="help is-danger" v-if="errors.meals_per_day">{{ errors.meals_per_day.join(', ') }}</p>
        </div>

        <div class="field" v-if="!$route.params.id">
          <label class="label">Is the event going to be fully vegetarian?</label>
          <div class="control">
            <input type="checkbox" v-model="event.vegetarian" />
            <label class="checkbox"> Yes, the event will be without any meat</label>
          </div>
        </div>

        <div class="notification is-success" v-if="!$route.params.id">
          Consider if you want to make the event fully vegetarian / vegan! <strong>It can't be changed later.</strong>
        </div>

        <div class="field">
          <label class="label">Accommodation type <span class="has-text-danger">*</span></label>
          <div class="notification is-info" v-if="!$route.params.id">
            <p>Accommodation can be for instance camping, hostel, hosting by the members of the local, or in a gym. Write "none" for online events.</p>
          </div>
          <div class="control">
            <input class="input" v-model="event.accommodation_type" required />
          </div>
          <p class="help is-danger" v-if="errors.accommodation_type">{{ errors.accommodation_type.join(', ') }}</p>
        </div>

        <div class="subtitle is-fullwidth has-text-centered">Optional Programme</div>
        <hr />

        <div class="notification is-info">
          <div class="content">
            <p>You may offer an optional feature to your event. If so, please specify the optional programme and its cost. Leave the fields empty if there is no extra fee charged. Be concise in the description: "trip to city X", "ice-skating", "extra museum".</p>
          </div>
        </div>
        <div class="field">
          <label class="label">Optional Fee</label>
          <div class="control">
            <div class="field has-addons">
              <div class="control">
                <a class="button is-static">€</a>
              </div>
              <div class="control">
                <input class="input" type="number" v-model="event.optional_fee" min="0" />
              </div>
            </div>
          </div>
          <p class="help is-danger" v-if="errors.optional_fee">{{ errors.optional_fee.join(', ') }}</p>
        </div>
        <div class="field">
          <label class="label">Optional Programme</label>
          <div class="control">
            <input class="input" type="text" v-model="event.optional_programme" />
          </div>
          <p class="help is-danger" v-if="errors.optional_programme">{{ errors.optional_programme.join(', ') }}</p>
        </div>

        <div class="subtitle is-fullwidth has-text-centered">Event dates</div>
        <hr />

        <timezone-notification />

        <div class="field">
          <label class="label">Application period starts <span class="has-text-danger">*</span></label>
          <div class="control">
            <flat-pickr
              placeholder="Select date"
              class="input"
              required
              :config="dateConfig"
              v-model="dates.application_starts" />
          </div>
          <p class="help is-danger" v-if="errors.application_starts">{{ errors.application_starts.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Application period ends <span class="has-text-danger">*</span></label>
          <div class="control">
            <flat-pickr
              placeholder="Select date"
              class="input"
              required
              :config="dateConfig"
              v-model="dates.application_ends" />
          </div>
          <p class="help is-danger" v-if="errors.application_ends">{{ errors.application_ends.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Event start date <span class="has-text-danger">*</span></label>
          <div class="control">
            <flat-pickr
              placeholder="Select date"
              class="input"
              required
              :config="dateConfig"
              v-model="dates.starts" />
          </div>
          <p class="help is-danger" v-if="errors.starts">{{ errors.starts.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Event end date <span class="has-text-danger">*</span></label>
          <div class="control">
            <flat-pickr
              placeholder="Select date"
              class="input"
              :config="dateConfig"
              v-model="dates.ends" />
          </div>
          <p class="help is-danger" v-if="errors.ends">{{ errors.ends.join(', ') }}</p>
        </div>

        <div class="subtitle is-fullwidth has-text-centered">Organizing bodies <span class="has-text-danger">*</span></div>
        <hr />

        <div class="tags">
          <a
            class="tag is-primary is-medium"
            v-for="(body, index) in event.organizing_bodies"
            v-bind:key="body.body_id">
            {{ body ? body.body.name : 'Loading...' }}
            <button class="delete is-small" @click.prevent="body => event.organizing_bodies.splice(index, 1)" />
          </a>
          <a class="tag is-danger is-medium" v-if="event.organizing_bodies.length === 0">No organizing bodies.</a>
        </div>

        <div class="field">
          <label class="label">Add organizing body</label>
          <div class="control">
            <div class="field has-addons">
              <div class="control">
                <div class="select">
                  <select v-model="selectedBody">
                    <option :value="null">--</option>
                    <option v-for="body in bodies" v-bind:key="body.id" v-bind:value="body">{{ body.name }}</option>
                  </select>
                </div>
              </div>
              <div class="control">
                <a class="button is-primary" @click="addOrganizingBody()">Add</a>
              </div>
            </div>
          </div>
        </div>

        <div class="subtitle is-fullwidth has-text-centered">Organizers <span class="has-text-danger">*</span></div>
        <hr />

        <div class="notification is-info">
          <div class="content">
            <p>The user creating the event automatically becomes the organizer.</p>
            <p>People who are not listed as organizers won't be able to see and manage event manage applications, even if they are the board members.</p>
            <p v-if="!can.viewAllMembers">
              <strong>You can only add people from your bodies.</strong>
              If a person from another body needs to be added as an organizer, you can temporarily join this body to get the permissions
              to see members of this body, add required people, then leave it.
            </p>
            <p>Organizers list cannot be edited once the event is published, if you need to update it, please contact EQAC or CD.</p>
          </div>
        </div>

        <div>
          <b-table
            :data="event.organizers"
            :loading="isLoading">
            <b-table-column field="first_name" label="First and last name" sortable v-slot="props">
              <router-link target="_blank" rel="noopener noreferrer" :to="{ name: 'oms.members.view', params: { id: props.row.user_id } }">
                {{ props.row.first_name }} {{ props.row.last_name }}
              </router-link>
            </b-table-column>

            <b-table-column field="comment" label="Comment" v-slot="props">
              <div class="control">
                <input class="input" type="text" v-model="props.row.comment" />
              </div>
            </b-table-column>

            <b-table-column label="Delete" v-slot="props">
              <button class="button is-small is-danger" v-if="!props.row.disableEdit" @click="deleteOrganizer(props.index)">
                Delete
              </button>
            </b-table-column>

            <template slot="empty">
              <empty-table-stub />
            </template>
          </b-table>

          <div class="field">
            <label class="label">Add organizer</label>
            <div class="control">
              <div class="field has-addons">
                <b-autocomplete
                  v-model="autoComplete.members.name"
                  :data="autoComplete.members.values"
                  open-on-focus="true"
                  :loading="autoComplete.members.loading"
                  @input="query => fetchMembers(query)"
                  @select="organizer => addOrganizer(organizer)">
                  <template slot-scope="props">
                    <div class="media">
                      <div class="media-content">
                        {{ props.option.first_name }}
                        <br>
                        <small> {{ props.option.last_name }} </small>
                      </div>
                    </div>
                  </template>
                </b-autocomplete>
              </div>
            </div>
          </div>
        </div>

        <div class="subtitle is-fullwidth has-text-centered">Questions</div>
        <hr />

        <div class="notification is-info">
          <div class="content">
            <p>
              Keep in mind that the only questions gathered from users by default are body name and application consent.
              So, if you need some other fields in the application form (like motivation, visa fields etc.), you have to add them manually.
            </p>
            <p>Some fields (specifically, the email) are copied from the profile when applying, so you don't need to ask for it.</p>
            <p>Here are the question types that can be used:</p>
            <ul>
              <li><b>string</b> - short string value (like "Meals type")</li>
              <li><b>text</b> - long string value (like "Why I'm a good participant")</li>
              <li><b>number</b> - a number (like "How much events in AEGEE I've visited")</li>
              <li><b>select</b> - predefined set of values (like "Vegan", "Vegetarian" and "Meat-eater" for meals type)</li>
              <li><b>checkbox</b> - a yes/no question (like "Do I need a visa?").
                Combine it with "required" field to only allow this to be checked in order to to apply (like "I give my consent to share my data with third parties")
              </li>
            </ul>
          </div>
        </div>

        <table class="table is-fullwidth is-narrowed">
          <thead>
            <tr>
              <th>Description <span class="has-text-danger">*</span></th>
              <th>Type <span class="has-text-danger">*</span></th>
              <th>Required?</th>
              <th>Values (for select)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="(question, index) in event.questions" v-bind:key="index">
              <td>
                <input class="input" type="text" required v-model="event.questions[index].description" />
              </td>
              <td>
                <div class="select">
                  <select v-model="event.questions[index].type" @change="nullifyOrDeleteSelect(index)">
                    <option value="string">String</option>
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="checkbox">Checkbox</option>
                    <option value="select">Select</option>
                  </select>
                </div>
              </td>
              <td>
                <input type="checkbox" v-model="event.questions[index].required" />
              </td>
              <td>
                <input-tag
                  v-if="event.questions[index].type === 'select'"
                  v-model="event.questions[index].values"
                  :before-adding="value => value.trim()" />
              </td>
              <td>
                <a class="button is-danger" @click="deleteQuestion(index)">Delete question</a>
              </td>
            </tr>
            <tr colspan="5" v-if="event.questions.length === 0">
              <td>No questions are set.</td>
            </tr>
          </tbody>
        </table>

        <div class="notification is-danger" v-if="errors.questions">
          <div class="content">
            Could not create/edit event because of these reasons:
            <ul v-if="errors.questions">
              <li v-for="(error, index) in errors.questions" v-bind:key="index">{{ error }}</li>
            </ul>
          </div>
        </div>

        <div class="field">
          <div class="control">
            <a class="button is-primary" @click="addQuestion()">Add new question</a>
          </div>
        </div>

        <p class="help is-danger" v-if="errors.fee">{{ errors.questions.message }}</p>

        <div class="subtitle is-fullwidth has-text-centered">Locations</div>
        <hr />

        <div class="notification is-info">
          <div class="content">
            <p>You can add a location and drag it on the map to the desired point.</p>
            <p>The location name would be displayed as a map marker popup.</p>
          </div>
        </div>

        <div class="tile" style="position: relative; height: 400px">
          <MglMap
            :accessToken="accessToken"
            :mapStyle="map.style"
            :zoom="map.zoom"
            :scrollZoom="false"
            @load="onMapLoaded"
            :center="map.center">
            <MglNavigationControl position="top-right" />
            <MglMarker
              v-for="(location, index) in event.locations"
              v-bind:key="index"
              :coordinates="location.position"
              color="red"
              :draggable="true"
              @dragend="setMarkerPosition($event, index)" />
          </MglMap>
        </div>

        <table class="table is-narrowed is-stripped is-fullwidth">
          <thead>
            <tr>
              <th>Latitude</th>
              <th>Longitude</th>
              <th>Name</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="(marker, index) in event.locations" v-bind:key="index">
              <td>{{ marker.position.lat }}</td>
              <td>{{ marker.position.lng }}</td>
              <td>
                <input type="text" class="input" required v-model="marker.name" />
              </td>
              <td>
                <button class="button is-danger" @click="deleteLocation(index)">Delete location</button>
              </td>
            </tr>
            <tr colspan="4" v-if="event.locations.length === 0">
              <td>No locations added.</td>
            </tr>
          </tbody>
        </table>

        <div class="field">
          <div class="control">
            <a class="button is-primary" @click="addLocation()">Add new location</a>
          </div>
        </div>

        <div class="field">
          <label class="label">How to travel to your country</label>
          <p>You may provide an optional link to provide useful information about travelling to your country.</p>
          <div class="control">
            <input class="input" type="url" v-model="event.link_info_travel_country" />
          </div>
          <p class="help is-danger" v-if="errors.link_info_travel_country">{{ errors.link_info_travel_country.join(', ') }}</p>
        </div>

        <div class="subtitle is-fullwidth has-text-centered">EQAC approval fields</div>
        <hr />

        <div class="notification is-info">
          <div class="content">
            <p>These fields are visible to EQAC only.</p>
            <p>
              You can omit specifying them when creating the event, but
              <strong> you won't be able to submit event to EQAC if these fields are not set.</strong>

              For online events, you are able to use https://online-event.example.com/ as a placeholder for the budget.
            </p>
            <p>Please provide the link to Google spreadsheets for the event program and budget.</p>
            <p><a href="https://docs.google.com/spreadsheets/u/1/?ftv=1&tgif=d" target="_blank" rel="noopener noreferrer">
              You can take the template for the budget and the program here.
            </a></p>
            <p><i>
              Note: in case you cannot see AEGEE templates at the link above, try switching to AEGEE Google Workspace account.
              In case you don't have one,
              <a href="https://oms-project.atlassian.net/wiki/spaces/HEL/pages/248348673/Requesting+a+Gsuite+account+for+yourself" target="blank">
                here's how to request it
              </a>.
            </i></p>
          </div>
        </div>

        <div class="field">
          <label class="label">Link to event budget</label>
          <div class="control">
            <input class="input" type="url" v-model="event.budget" />
          </div>
          <p class="help is-danger" v-if="errors.is_budget_set">{{ errors.is_budget_set.join(', ') }}</p>
        </div>

        <div class="field">
          <label class="label">Link to event program</label>
          <div class="control">
            <input class="input" type="url" v-model="event.programme" />
          </div>
          <p class="help is-danger" v-if="errors.is_programme_set">{{ errors.is_programme_set.join(', ') }}</p>
        </div>

        <div class="notification is-success">
          <div class="content">
            <p><strong>Useful sustainability tips</strong></p>
            <p>In AEGEE we aim to make our events as environmentally sustainable as possible.
              In order to help you out on what you can do to make your event sustainable,
              we have a few handy documents for you!
            </p>

            <p>Firstly, there is a general
              <a href="https://drive.google.com/file/d/1xSgp2THL4rqFwZYgN79F0JwW2yFabiR7/view?usp=sharing" target="blank"><strong>guide on how to organise a sustainable event</strong></a>.
              There is also an
              <a href="https://docs.google.com/spreadsheets/d/1kwwbtznv4IjTY4bFmIp0PDYxXTkpQTD6/edit#gid=1247355884" target="blank"><strong>event sustainability assessment tool</strong></a>,
              which is a list of measures that you can use before your event to plan
              how to be as sustainable as possible, and check off afterwards to see how well you did.
              Lastly, there is a
              <a href="https://drive.google.com/file/d/16aWZLATOSo8kDBM5p33c1XLcjga4g3Kl/view?usp=sharing" target="blank"><strong>recipe booklet</strong></a>,
              where you can find sustainable vegetarian and vegan recipes that are easily made for a large number of people.
            </p>
          </div>
        </div>

        <div class="notification" style="background-color: purple; color: white;">
          <div class="content">
            <p><strong>Creating a safe event</strong></p>
            <p>AEGEE should be a place in which everyone can feel safe.
              That is why it is important to take measures against sexual harassment.
            </p>

            <p><a href="https://myaegee.atlassian.net/wiki/spaces/KMS/pages/2451505153/Organising+Safe+Events" target="blank">Here</a>
              you can find a checklist on how to make your event safer and educational posters to hang up during events.
              You may also request a workshop or briefing around consent and active bystanding or a Safe Person
              which acts as a first contact for people that experience sexual harassment during an AEGEE event
              <a href="https://forms.gle/oKjTeWrhLadrWkwR7" target="blank">here</a>.
            </p>

            <p>For any further questions, please contact the Safe Person Committee via
              <a href="mailto:safe.person@aegee.eu">safe.person@aegee.eu</a>
            </p>
          </div>
        </div>

        <b-loading is-full-page="false" :active.sync="isLoading" />

        <div class="field">
          <div class="control">
            <input type="submit" value="Save event" :disabled="isSaving" class="button is-primary is-fullwidth" />
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { MglMap, MglMarker, MglNavigationControl } from 'vue-mapbox'
import constants from '../../constants'
import credentials from '../../credentials'
import TimezoneNotification from '../../components/notifications/TimezoneNotification'
import MarkdownTooltip from '../../components/tooltips/MarkdownTooltip'

export default {
  components: {
    MglMap,
    MglMarker,
    MglNavigationControl,
    TimezoneNotification,
    MarkdownTooltip
  },
  name: 'EditEvent',
  data () {
    return {
      event: {
        name: null,
        description: '', // so it won't be null and marked() would not error
        id: null,
        url: null,
        questions: [],
        organizing_bodies: [],
        organizers: [],
        max_participants: null,
        locations: [],
        fee: null,
        application_starts: null,
        application_ends: null,
        starts: null,
        ends: null,
        body_id: null,
        body: null,
        optional_fee: null,
        meals_per_day: 0,
        vegetarian: false,
        optional_programme: null,
        link_info_travel_country: null,
        accommodation_type: ''
      },
      autoComplete: {
        members: { name: '', values: [], loading: false }
      },
      dates: {
        application_starts: null,
        application_ends: null,
        starts: null,
        ends: null
      },
      map: {
        actions: null,
        style: credentials.MAPS_API_TOKEN,
        center: { lat: 50.8503396, lng: 4.3517103 },
        zoom: 3
      },
      eventTypes: constants.EVENT_TYPES_NAMES,
      file: null,
      bodies: [],
      selectedBody: null,
      dateConfig: {
        enableTime: true,
        time_24hr: true
      },
      can: {
        edit_application_status: false,
        viewAllMembers: false
      },
      errors: {},
      isLoading: false,
      isSaving: false
    }
  },
  methods: {
    fetchMembers (query) {
      if (!query) return

      this.autoComplete.members.values = []
      this.autoComplete.members.loading = true

      if (this.token) this.token.cancel()
      this.token = this.axios.CancelToken.source()

      // If user has global permission, fetching global members list.
      // Otherwise, fetch all of the members of the bodies this user is a member of.
      const endpoints = this.can.viewAllMembers
        ? [this.services['core'] + '/members']
        : this.loginUser.bodies.map(body => this.services['core'] + '/bodies/' + body.id + '/members')

      // Ignoring the requests that failed (because of 403 most likely)
      // since the user does not always has the permissions to see
      // the members of the body.
      const fetchEndpoint = (endpoint) => this.axios.get(endpoint, {
        cancelToken: this.token.token,
        params: { query }
      }).then(res => res.data.data).catch(() => [])

      // Merging all of the responses into one array.
      // Then filtering out duplicate users.
      // .map is there because the /bodies/:id/members returns users, not members.
      Promise.all(endpoints.map(fetchEndpoint)).then((responses) => {
        this.autoComplete.members.values = responses
          .reduce((acc, val) => acc.concat(val), [])
          .map(value => (this.can.viewAllMembers ? value : value.user))
          .filter((elt, index, array) => array.findIndex(e => e.id === elt.id) === index)

        this.autoComplete.members.loading = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return
        }

        this.autoComplete.members.loading = false
        this.$root.showError('Could not fetch members', err)
      })
    },
    nullifyOrDeleteSelect (index) {
      if (this.event.questions[index].type === 'select') {
        this.$set(this.event.questions[index], 'values', [])
      } else {
        this.$delete(this.event.questions[index], 'values')
      }
    },
    addOrganizer (organizer) {
      if (this.event.organizers.some(org => org.user_id === organizer.id)) {
        return this.$root.showWarning('This user is already an organizer.')
      }

      this.event.organizers.push({
        user_id: organizer.id,
        user: organizer,
        first_name: organizer.first_name,
        last_name: organizer.last_name
      })
    },
    deleteOrganizer (index) {
      this.event.organizers.splice(index, 1)
    },
    addQuestion () {
      this.event.questions.push({
        name: '',
        description: '',
        required: false
      })
    },
    deleteQuestion (index) {
      this.event.questions.splice(index, 1)
    },
    addLocation () {
      this.event.locations.push({
        name: '',
        position: {
          lat: this.map.center.lat,
          lng: this.map.center.lng
        }
      })
    },
    deleteLocation (index) {
      this.event.locations.splice(index, 1)
    },
    setMarkerPosition (event, index) {
      const newCoords = event.marker.getLngLat()

      this.event.locations[index].position.lat = newCoords.lat
      this.event.locations[index].position.lng = newCoords.lng
    },
    addOrganizingBody () {
      if (!this.selectedBody) {
        this.$root.showWarning('Please select a body.')
        return
      }

      if (this.event.organizing_bodies.some(body => body.body_id === this.selectedBody.id)) {
        this.$root.showWarning('This body is already presented in the organizing bodies list.')
        return
      }

      this.event.organizing_bodies.push({
        body: this.selectedBody,
        body_id: this.selectedBody.id
      })
      this.selectedBody = null
    },
    saveEvent () {
      if (!this.event.application_starts) {
        return this.$root.showError('Please set the date when applications period will start.')
      }

      if (!this.event.application_ends) {
        return this.$root.showError('Please set the date when applications period will end.')
      }

      if (!this.event.starts) {
        return this.$root.showError('Please set the date when the event will start.')
      }

      if (!this.event.ends) {
        return this.$root.showError('Please set the date when the event will end.')
      }

      if (this.event.organizing_bodies.length === 0) {
        return this.$root.showError('Please select at least one organizing body.')
      }

      if (this.event.organizers.length === 0) {
        return this.$root.showError('Please add at least one organizer.')
      }

      for (const question of this.event.questions) {
        if (question.type === 'select' && question.values.length === 0) {
          return this.$root.showError('Please set values for select questions.')
        }
      }

      this.isSaving = true
      this.errors = {}

      // we don't need to pass body objects there
      const eventToSave = JSON.parse(JSON.stringify(this.event))
      eventToSave.organizing_bodies = eventToSave.organizing_bodies.map(body => ({ body_id: body.body_id }))
      eventToSave.organizers = eventToSave.organizers.map(org => ({ user_id: org.user_id }))

      const promise = this.$route.params.id
        ? this.axios.put(this.services['events'] + '/single/' + this.$route.params.id, eventToSave)
        : this.axios.post(this.services['events'], eventToSave)

      promise.then((response) => {
        this.isSaving = false
        this.$root.showSuccess('Event is saved.')

        return this.$router.push({
          name: 'oms.events.view',
          params: { id: response.data.data.url || response.data.data.id }
        })
      }).catch((err) => {
        this.isSaving = false

        if (err.response.status === 422) { // validation errors
          this.errors = err.response.data.errors
          return this.$root.showError('Some of the event data is invalid.')
        }

        this.$root.showError('Could not save event', err)
      })
    },
    onMapLoaded (event) {
      this.map.actions = event.component.actions

      // waiting till the event is loaded.
      if (!this.isLoading && this.event.id) {
        this.centerMap()
      }
    },
    centerMap () {
      // we don't know, what'll happen first, the map will load or the event will load.
      // and we need both to be loaded.
      if (this.event.locations.length === 0) {
        return
      }

      // if it's a single point, then just centering on it
      if (this.event.locations.length === 1) {
        this.map.actions.jumpTo({
          center: this.event.locations[0].position,
          zoom: 10
        })
        return
      }

      const minCoords = {
        lat: Math.min(...this.event.locations.map(location => location.position.lat)),
        lng: Math.min(...this.event.locations.map(location => location.position.lng))
      }
      const maxCoords = {
        lat: Math.max(...this.event.locations.map(location => location.position.lat)),
        lng: Math.max(...this.event.locations.map(location => location.position.lng))
      }

      this.map.actions.fitBounds([minCoords, maxCoords], { padding: 50 })
    }
  },
  computed: mapGetters({
    services: 'services',
    loginUser: 'user'
  }),
  watch: {
    'event.name': function (newName) {
      if (!this.$route.params.id) {
        this.event.url = this.$root.sluggify(newName)
      }
    },
    'dates.application_starts': function (newDate) {
      this.event.application_starts = new Date(newDate)
    },
    'dates.application_ends': function (newDate) {
      this.event.application_ends = new Date(newDate)
    },
    'dates.starts': function (newDate) {
      this.event.starts = new Date(newDate)
    },
    'dates.ends': function (newDate) {
      this.event.ends = new Date(newDate)
    }
  },
  mounted () {
    this.axios.get(this.services['core'] + '/bodies/').then((response) => {
      this.bodies = response.data.data

      return this.axios.get(this.services['core'] + '/my_permissions/')
    }).then((response) => {
      this.can.viewAllMembers = response.data.data.some(permission => permission.combined.endsWith('global:view:member'))

      if (!this.$route.params.id) {
        this.isLoading = false
        this.event.organizers.push({
          user_id: this.loginUser.id,
          first_name: this.loginUser.first_name,
          last_name: this.loginUser.last_name,
          comment: 'Event creator.',
          disableEdit: true
        })
        return
      }

      return this.axios.get(this.services['events'] + '/single/' + this.$route.params.id).then((eventsResponse) => {
        this.event = eventsResponse.data.data
        this.can = eventsResponse.data.permissions
        this.can.viewAllMembers = response.data.data.some(permission => permission.combined.endsWith('global:view:member')) // override it

        this.dates.starts = this.event.starts = new Date(this.event.starts)
        this.dates.ends = this.event.starts = new Date(this.event.ends)
        this.dates.application_starts = this.event.application_starts = new Date(this.event.application_starts)
        this.dates.application_ends = this.event.application_ends = new Date(this.event.application_ends)

        for (const body of this.event.organizing_bodies) {
          const foundBody = this.bodies.find(b => b.id === body.body_id)
          this.$set(body, 'body', foundBody)
        }

        for (const organizer of this.event.organizers) {
          if (this.loginUser.id === organizer.user_id) {
            this.$set(organizer, 'disableEdit', true)
            break
          }
        }

        this.isLoading = false
      })
    }).catch((err) => {
      this.isLoading = false
      if (err.response.status === 404) {
        this.$root.showError('Event is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

      this.$router.push({ name: 'oms.events.list' })
    })
  }
}
</script>
