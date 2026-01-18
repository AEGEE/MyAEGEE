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
                  <select v-model="status">
                    <option :value="null">Everybody</option>
                    <option value="accepted">Accepted participants</option>
                    <option value="waiting_list">Waiting list participants</option>
                    <option value="rejected">Rejected participants</option>
                    <option value="pending">Pending participants</option>
                  </select>
                </div>
              </div>

              <div class="field is-fullwidth">
                <label class="label">Filter on confirmation</label>
                <div class="select">
                  <select v-model="confirmed">
                    <option :value="null">Everybody</option>
                    <option :value="true">Confirmed participants</option>
                    <option :value="false">Not confirmed participants</option>
                  </select>
                </div>
              </div>

              <div class="field is-fullwidth">
                <label class="label">Filter on incoming form filled (LO)</label>
                <div class="select">
                  <select v-model="incoming">
                    <option :value="null">Everybody</option>
                    <option :value="true">Participants that did fill incoming form</option>
                    <option :value="false">Participants that did not fill incoming form</option>
                  </select>
                </div>
              </div>

              <div class="field is-fullwidth">
                <label class="label">Filter on participant type</label>
                <div class="select">
                  <select v-model="participant_type">
                    <option :value="null">Everybody</option>
                    <option value="envoy">Envoy</option>
                    <option value="delegate">Delegate</option>
                    <option value="visitor">Visitor</option>
                    <option value="observer">Observer</option>
                  </select>
                </div>
              </div>

              <div class="tile is-parent">
                <div class="tile is-child">
                  <div class="notification is-warning">
                    <div class="content">
                      <span>You can type in the following phrases to be replaced with the actual application data:</span>
                      <ul>
                        <li><i>{first_name}</i> - user's first name</li>
                        <li><i>{last_name}</i> - user's last name</li>
                        <li><i>{participant_type_order}</i> - applicant's type order, in this format: <strong>type (order)</strong>, or <strong>not set</strong> if it's not set by the board.</li>
                        <li><i>{body_name}</i> - name of the body</li>
                        <li><i>{statutory_id}</i> - applicant's statutory id</li>
                      </ul>
                      <span>Also you can use Markdown for text markup. For example, you can:</span>
                      <ul>
                        <li>wrap text in *asterisks* to make it <i>italic</i></li>
                        <li>wrap text in **double asterisks** to make it <strong>bold</strong></li>
                        <li>insert a link by typing "[text to display](url)"</li>
                      </ul>
                      <span>Keep in mind, that by default, if you put one line break, the line won't be broken and the next text line would be displayed at the same line as the previous. For making a piece of text a separate paragraph, use 2 line breaks. That way, the text would be displayed with an offset from the previous and the next line. For just breaking the line, add 2 spaces at the end of it.</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="field is-fullwidth">
                <label class="label">Address to reply to</label>
                <div class="control">
                  <input class="input" type="email" required v-model="reply_to" />
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

              <div class="field is-fullwidth">
                <label class="label">Preview:</label>
                <div class="content box">
                  <div v-html="filledTemplate" />
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
      status: null,
      confirmed: null,
      incoming: null,
      participant_type: null,
      subject: '',
      reply_to: '',
      isSending: false,
      stabUser: {
        first_name: 'Name',
        last_name: 'Surname'
      },
      stabBody: { name: 'AEGEE-Europe' },
      stabApplication: { statutory_id: '001-0001', participant_type: 'delegate', participant_order: 1 }
    }
  },
  computed: {
    markdownText () {
      return this.$options.filters.markdown(this.text)
    },
    filledTemplate () {
      const typeAndOrder = this.stabApplication.participant_type
        ? (this.stabApplication.participant_type + ' (' + this.stabApplication.participant_order + ')')
        : 'not set'

      return this.markdownText
        .replace(/\{first_name\}/ig, this.stabUser.first_name)
        .replace(/\{last_name\}/ig, this.stabUser.last_name)
        .replace(/\{participant_type_order\}/ig, typeAndOrder)
        .replace(/\{body_name\}/ig, this.stabBody.name)
        .replace(/\{statutory_id\}/ig, this.stabApplication.statutory_id)
    },
    filter () {
      const filterObj = {}

      if (this.status !== null) filterObj.status = this.status
      if (this.confirmed !== null) filterObj.confirmed = this.confirmed
      if (this.incoming !== null) filterObj.incoming = this.incoming
      if (this.participant_type !== null) filterObj.participant_type = this.participant_type

      return filterObj
    },
    ...mapGetters({
      services: 'services',
      loginUser: 'user'
    })
  },
  methods: {
    sendMassMailer () {
      this.isSending = true

      this.axios.post(this.services['statutory'] + '/events/' + this.$route.params.id + '/massmailer/', {
        subject: this.subject,
        text: this.markdownText,
        reply_to: this.reply_to,
        filter: this.filter
      }).then((response) => {
        this.isSending = false
        this.$root.showSuccess(`Mass mailer is sent successfully to ${response.data.meta.sent} participants.`)
      }).catch((err) => {
        this.isSending = false
        this.$root.showError('Error using massmailer', err)
      })
    }
  },
  mounted () {

  }
}
</script>
