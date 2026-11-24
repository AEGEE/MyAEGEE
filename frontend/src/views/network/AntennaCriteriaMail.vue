<template>
  <div class="modal-card" style="height: 75vh">
    <header class="modal-card-head">
      <p class="modal-card-title">Change fulfilment email text</p>
      <button type="button" class="delete" aria-label="close" @click="$parent.close()" />
    </header>

    <section class="modal-card-body">
      <div class="notification is-warning">
        You can type the following to be replaced with the actual data:
        <ul style="list-style: inside">
          <li><em>{body_name}</em> - name of the body</li>
          <li><em>{agora_name}</em> - name of the Agora</li>
          <li><em>{netcom_name}</em> - name of the assigned NetCommie</li>
          <li><em>{local_type}</em> - type of the Local</li>
          <li><em>{antenna_criteria_amount}</em> - the amount of Antenna Criteria to fulfil</li>
        </ul>
        You can also use Markdown, here are some basic functions:
        <ul style="list-style: inside">
          <li>Placing * around a word makes it <em>italic</em></li>
          <li>Placing ** around a word makes it <strong>bold</strong></li>
          <li>A link can be made by typing it like "[text to display](url)"</li>
          <li>Enters can be inserted by typing "&lt;br&gt;"</li>
          <li>Placing "&lt;r&gt;XXX&lt;/r&gt;" around a word makes it <span style="color: red">red</span></li>
        </ul>
      </div>

      <b-field label="Introduction text" label-for="ac-mail-introduction">
        <b-input type="textarea" id="ac-mail-introduction" v-model="parts.introduction" />
      </b-field>

      <b-field label="Communication" label-for="ac-mail-communication">
        <b-input type="textarea" id="ac-mail-communication" v-model="parts.communication" />
      </b-field>

      <b-field label="Board election" label-for="ac-mail-board-election">
        <b-input type="textarea" id="ac-mail-board-election" v-model="parts.boardElection" />
      </b-field>

      <b-field label="Members list" label-for="ac-mail-members-list">
        <b-input type="textarea" id="ac-mail-members-list" v-model="parts.membersList" />
      </b-field>

      <b-field label="Membership fee" label-for="ac-mail-membership-fee">
        <b-input type="textarea" id="ac-mail-membership-fee" v-model="parts.membershipFee" />
      </b-field>

      <b-field label="Events" label-for="ac-mail-events">
        <b-input type="textarea" id="ac-mail-events" v-model="parts.events" />
      </b-field>

      <b-field label="Agora attendance" label-for="ac-mail-agora-attendance">
        <b-input type="textarea" id="ac-mail-agora-attendance" v-model="parts.agoraAttendance" />
      </b-field>

      <b-field label="Development plan" label-for="ac-mail-development-plan">
        <b-input type="textarea" id="ac-mail-development-plan" v-model="parts.developmentPlan" />
      </b-field>

      <b-field label="Fulfilment Report" label-for="ac-mail-fulfilment-report">
        <b-input type="textarea" id="ac-mail-fulfilment-report" v-model="parts.fulfilmentReport" />
      </b-field>

      <b-field label="Closing" label-for="ac-mail-closing">
        <b-input type="textarea" id="ac-mail-closing" v-model="parts.closing" />
      </b-field>

      <hr />

      <h2 class="subtitle">Preview of full mail</h2>
      <span v-html="$options.filters.markdown(mail)" />

    </section>

    <footer class="modal-card-foot">
      <button type="button" class="button is-primary" @click="save()">Save</button>
      <button type="button" class="button" @click="$parent.close()">Cancel</button>
    </footer>
  </div>
</template>

<script>
export default {
  name: 'AntennaCriteriaMail',
  props: ['agora', 'mailComponents', 'permissions', 'services', 'showError', 'showSuccess', 'router'],
  data () {
    return {
      parts: {
        introduction: '',
        communication: '',
        boardElection: '',
        membersList: '',
        membershipFee: '',
        events: '',
        agoraAttendance: '',
        developmentPlan: '',
        fulfilmentReport: '',
        closing: ''
      }
    }
  },
  methods: {
    async setMailComponent (component, text) {
      const data = {
        'agora_id': this.agora.id,
        'mail_component': component,
        'text': text
      }

      await this.axios.put(
        this.services['network'] + '/mailComponent',
        data
      ).catch((err) => {
        this.showError('Error saving mail component', err)
      })
    },
    async save () {
      const promises = []

      for (const part in this.parts) {
        const component = part.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
        const original = this.mailComponents.find(c => c.mail_component === component)
        if ((original?.text ?? '') !== this.parts[part]) {
          promises.push(this.setMailComponent(component, this.parts[part]))
        }
      }

      await Promise.all(promises).then(() => {
        this.showSuccess('Mail components updated.')
        this.router.go(0)
      }).catch((err) => {
        this.showError('Something went wrong', err)
      })
    }
  },
  computed: {
    mail () {
      // Combine all the different items in parts, in order
      const rawMail = Object.values(this.parts).join('<br><br>')
      // <font color> instead of a styled span: the markdown filter drops style attributes,
      // and email clients show <font> too.
      return rawMail.replaceAll('<r>', '<font color="red">').replaceAll('</r>', '</font>')
    }
  },
  mounted () {
    for (const component of this.mailComponents) {
      const part = component.mail_component.replace(/ (\w)/g, (_, c) => c.toUpperCase())
      this.parts[part] = component.text
    }
  }
}
</script>
