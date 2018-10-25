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

              <div class="field is-fullwidth">
                <label class="label">Address to send from</label>
                <div class="control">
                  <input class="input" type="text" required v-model="from" />
                </div>
              </div>

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
      from: 'chair@aegee.org',
      text: '',
      filter: '',
      subject: '',
      isSending: false
    }
  },
  methods: {
    sendMassMailer () {
      this.isSending = true

      this.axios.post(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/massmailer/' + this.filter, {
        from: this.from,
        subject: this.subject,
        text: this.text
      }).then((response) => {
        this.isSending = false
        this.$root.showSuccess('Mass mailer is sent successfully.')
      }).catch((err) => {
        this.isSending = false
        this.$root.showDanger('Error using massmailer: ' + err.message)
      })
    }
  },
  computed: mapGetters({
    services: 'services',
    loginUser: 'user'
  }),
  mounted () {

  }
}
</script>
