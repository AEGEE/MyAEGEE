<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Mass mailer</div>

        <form @submit.prevent="sendMassMailer()">
          <div class="tile is-parent">
            <div class="tile is-child">

              <div class="field is-fullwidth">
                <label class="label">Filter on participant status</label>
                <div class="select">
                  <select v-model="filter">
                    <option value="">Everybody</option>
                    <option value="accepted">Accepted participants</option>
                    <option value="rejected">Rejected participants</option>
                    <option value="pending">Pending participants</option>
                  </select>
                </div>
              </div>

              <div class="tile is-parent">
                <div class="tile is-child">
                  <div class="notification is-warning">
                    You can type in the following phrases to be replaced with the actual application data:
                    <ul>
                      <li>{first_name} - user's first name</li>
                      <li>{last_name} - user's last name</li>
                      <li>{participant_type_order} - applicant's type order, in this format: <strong>type (order)</strong>, or <strong>not set</strong> if it's not set by the board.</li>
                      <li>{body_name} - name of the body</li>
                    </ul>
                  </div>
                </div>
              </div>

              <!--<div class="field is-fullwidth">
                <label class="label">Address to send from</label>
                <div class="control">
                  <input class="input" type="text" required v-model="from" />
                </div>
              </div>-->

              <div class="field is-fullwidth">
                <label class="label">Email subject</label>
                <div class="control">
                  <input class="input" type="text" required v-model="subject" />
                </div>
              </div>

              <div class="field is-fullwidth">
                <label class="label">Type the email text here</label>
                <div class="control">
                  <textarea class="textarea" required v-model="text" />
                </div>
              </div>

              <div class="field is-fullwidth">
                <label class="label">Preview:</label>
                <div class="control">
                  <div v-html="filledTemplate"></div>
                </div>
              </div>

              <div class="tile is-parent">
                <div class="tile is-child">
                  <div class="notification is-warning">
                    Please re-read everything twice before sending.
                  </div>
                </div>
              </div>

              <div class="field">
                <button type="submit" class="button is-primary" :disabled="isSending">
                  Send mail
                </button>
              </div>
            </div>
          </div>

        </form>
      </div>
    </div>
  </div>

</template>


<script>
import { mapGetters } from 'vuex'

export default {
  name: 'MassMailerStatutory',
  data () {
    return {
      text: '',
      filter: '',
      subject: '',
      isSending: false,
      stabUser: {
        first_name: 'Name',
        last_name: 'Surname'
      },
      stabBody: { name: 'AEGEE-Europe' },
      stabApplication: { participant_type: 'delegate', participant_order: 1 }
    }
  },
  computed: {
    markdownText () {
      return this.$options.filters.markdown(this.text)
    },
    filledTemplate () {
      const typeAndOrder = this.stabApplication.participant_type
        ? this.stabApplication.participant_type + ' (' + this.stabApplication.participant_order + ')'
        : 'not set'

      return this.markdownText
        .replace(/\{first_name\}/ig, this.stabUser.first_name)
        .replace(/\{last_name\}/ig, this.stabUser.last_name)
        .replace(/\{participant_type_order\}/ig, typeAndOrder)
        .replace(/\{body_name\}/ig, this.stabBody.name)
    },
    ...mapGetters({
      services: 'services',
      loginUser: 'user'
    })
  },
  methods: {
    sendMassMailer () {
      this.isSending = true

      this.axios.post(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/massmailer/' + this.filter, {
        subject: this.subject,
        text: this.markdownText
      }).then((response) => {
        this.isSending = false
        this.$root.showSuccess('Mass mailer is sent successfully.')
      }).catch((err) => {
        this.isSending = false
        this.$root.showDanger('Error using massmailer: ' + err.message)
      })
    }
  },
  mounted () {

  }
}
</script>
