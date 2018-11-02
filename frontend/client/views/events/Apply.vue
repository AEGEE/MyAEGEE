<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title" v-show="isNew">Apply to {{ event.name }}</div>
        <div class="title" v-show="!isNew && application.status === 'requesting'">Edit your application on {{ event.name }}</div>
        <div class="title" v-show="!isNew && application.status !== 'requesting'">See your application on {{ event.name }}</div>

        <form @submit.prevent="saveApplication()">
          <div class="tile is-parent" v-show="isNew || (application.status === 'requesting')">
            <div class="tile is-child">
              <div class="field">
                <label class="label">Select body to apply from</label>
                <div class="control">
                  <div class="field has-addons">
                    <b-autocomplete
                      v-model="autoComplete.bodies.name"
                      :data="loginUser.bodies"
                      open-on-focus="true"
                      @select="body => { application.body_id = body.id; application.body = body }">
                      <template slot-scope="props">
                        <div class="media">
                          <div class="media-content">
                            {{ props.option.name }}
                          </div>
                        </div>
                      </template>
                    </b-autocomplete>
                    <p class="control">
                      <a class="button is-danger"
                        @click="body => { application.body_id = null; application.body = null }"
                        v-if="application.body">{{ application.body.name }} (Click to unset)</a>
                      <a class="button is-static" v-if="!application.body">Not set.</a>
                    </p>
                  </div>
                </div>
              </div>

              <div class="field is-fullwidth" v-for="field in event.application_fields" v-bind:key="field._id">
                <div class="control">
                  <label class="has-text-weight-bold">{{ field.name }}<span class="has-text-danger" v-show="!field.optional">*</span></label>
                  <small>{{ field.description }}</small>
                </div>
                <div class="control">
                  <input
                    type="text"
                    class="input"
                    :required="!field.optional"
                    v-model="field.answer"
                    />
                </div>
              </div>

              <div class="field" v-show="event.application_fields.length == 0">
                <p class="notification is-info">
                  You do not need to fill in any application fields to apply for this event! Just press the button.
                </p>
              </div>

              <div class="field">
                <button type="submit" class="button is-primary">
                  Save application!
                </button>
              </div>
            </div>
          </div>

          <div v-show="!isNew && application.status !== 'requesting'" class="tile is-parent">
            <div class="tile is-child">
              <p>
                <b>You applied from this body:</b>
                <router-link :to="{ name: 'oms.bodies.view', params: { id: application.body_id } }">
                  {{ application.body ? application.body.name : 'Loading...' }}
                </router-link>
              </p>
              <table class="table is-narrow is-fullwidth">
                <thead>
                  <tr>
                    <th>Question</th>
                    <th>Description</th>
                    <th>Your answer</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="field in event.application_fields" v-bind:key="field._id">
                    <td><b>{{ field.name }}</b><span class="is-danger" ng-show="!field.optional">*</span></td>
                    <td>{{ field.description }}</td>
                    <td>{{ field.answer }}</td>
                  </tr>
                </tbody>
              </table>

              <div class="field" v-show="event.application_fields.length == 0">
                <div class="notification is-info">
                  You didn't need to fill in the application fields.
                </div>
              </div>
            </div>
          </div>

          <div class="tile is-parent" v-show="!isNew">
            <div class="tile is-child">
              <div class="notification is-info" v-if="application.status === 'requesting'">
                Your application was saved, please wait for the organizers to close the application process and start evaluating.
              </div>
              <div class="notification is-warning" v-else-if="application.status === 'pending'">
                Your application is being processed, please wait for the organizers to evaluate your application. Unfortunately you can not edit it any more.
              </div>
              <div class="notification is-success" v-else-if="application.status === 'accepted'">
                Congratulations, you have been accepted to the event!
              </div>
              <div class="notification is-success" v-else-if="application.status === 'rejected'">
                Sorry, but you were not accepted to the event.
              </div>
            </div>
          </div>

          <b-loading is-full-page="false" :active.sync="isLoading"></b-loading>
        </form>
      </div>
    </div>
  </div>

</template>


<script>
import { mapGetters } from 'vuex'

export default {
  name: 'ApplyToEvent',
  data () {
    return {
      event: {
        name: null,
        application_fields: []
      },
      autoComplete: { bodies: { name: '' } },
      application: {
        body: null,
        body_id: null,
        user: null,
        user_id: null,
        _id: null,
        application: []
      },
      errors: {},
      isLoading: false,
      isSaving: false
    }
  },
  methods: {
    saveApplication () {
      // Copy data from the form into an object to submit it in the format the backend needs it
      this.isSaving = true

      const toServer = {
        body_id: this.application.body.id,
        application: []
      }

      for (const field of this.event.application_fields) {
        if (field.answer) {
          toServer.application.push({
            field_id: field._id,
            value: field.answer
          })
        }
      }

      this.axios.put(this.services['oms-events'] + '/single/' + this.$route.params.id + '/participants/mine', toServer).then(() => {
        this.$root.showSuccess('Your application was saved, you can still edit it until the application period ends')

        return this.$router.push({
          name: 'oms.events.view',
          params: { id: this.event.url || this.event.id }
        })
      }).catch((err) => {
        this.isSaving = false

        if (err.response.status === 422) { // validation errors
          this.errors = err.response.data.errors
          return this.$root.showDanger('Some of the application data is invalid.')
        }

        this.$root.showDanger('Could not save application: ' + err.message)
      })
    }
  },
  computed: {
    ...mapGetters({
      services: 'services',
      loginUser: 'user'
    }),
    isNew () {
      return !this.application._id
    }
  },
  mounted () {
    this.isLoading = true
    this.axios.get(this.services['oms-events'] + '/single/' + this.$route.params.id).then((response) => {
      this.event = response.data.data

      return this.axios.get(this.services['oms-events'] + '/single/' + this.$route.params.id + '/participants/mine').then((application) => {
        this.application = application.data.data
        this.application.body = this.loginUser.bodies.find(body => body.id === this.application.body_id)

        // Loop through application fields and assign them to our model
        for (const field of this.application.application) {
          // Find the matching application_field to our users application field
          this.event.application_fields.some((item, index) => {
            if (field.field_id === item._id) {
              this.event.application_fields[index].answer = field.value
              return true
            }
            return false
          })
        }

        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false
        // if there's no application, just ignore, otherwise re-throw the error
        if (err.response.status !== 404) {
          throw err
        }
      })
    }).catch((err) => {
      let message = (err.response.status === 404) ? 'Event is not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
      this.$router.push({ name: 'oms.events.list' })
    })
  }
}
</script>
