<template>
  <div class="modal-card" style="height: 75vh">
    <header class="modal-card-head">
      <p class="modal-card-title">{{ local.name }}</p>
      <button type="button" class="delete" aria-label="close" @click="$parent.close()" />
    </header>

    <section class="modal-card-body">
      <div class="notification is-warning" v-if="missingParts.length">
        <p v-for="part in missingParts" :key="part">No text set for {{ part }}.</p>
      </div>

      <b-field label="From" label-for="ac-send-from" horizontal>
        <b-input id="ac-send-from" v-model="from" />
      </b-field>

      <b-field label="To" label-for="ac-send-to" horizontal>
        <b-input id="ac-send-to" v-model="to" />
      </b-field>

      <b-field label="Cc" label-for="ac-send-cc" horizontal>
        <b-input id="ac-send-cc" v-model="cc" />
      </b-field>

      <b-field label="Subject" label-for="ac-send-subject" horizontal>
        <b-input id="ac-send-subject" v-model="subject" />
      </b-field>

      <b-field label="Mail text" label-for="ac-send-body">
        <b-input type="textarea" id="ac-send-body" v-model="body" />
      </b-field>

      <hr />

      <h2 class="subtitle">Preview of full mail</h2>
      <span v-html="$options.filters.markdown(mail)" />

    </section>

    <footer class="modal-card-foot">
      <button type="button" class="button is-primary" @click="send()">Send</button>
      <button type="button" class="button" @click="$parent.close()">Cancel</button>
    </footer>
  </div>
</template>

<script>
export default {
  name: 'AntennaCriteriaMailSend',
  props: ['local', 'agora', 'mailComponents', 'antennaCriteriaMapping', 'services', 'showError', 'showSuccess'],
  data () {
    return {
      from: 'network@aegee.eu',
      to: '',
      cc: '',
      subject: '',
      body: '',
      // Parts of the mail that the Agora has no text for.
      missingParts: []
    }
  },
  methods: {
    send () {
      const data = {
        'from': this.from,
        'to': this.to,
        'cc': this.cc,
        'subject': this.subject,
        'reply_to': this.from,
        'body': this.$options.filters.markdown(this.mail)
      }

      this.axios.post(
        this.services['network'] + '/antennaCriteria/sendFulfilmentMail',
        data
      ).then(() => {
        this.showSuccess('Mail sent successfully.')
        this.$parent.close()
      }).catch((err) => {
        // showError lists the field messages of a 422.
        this.showError('Could not send the mail', err)
      })
    }
  },
  computed: {
    mail () {
      // <font color> instead of a styled span: the markdown filter drops style attributes,
      // and email clients show <font> too.
      return this.body.replaceAll('<r>', '<font color="red">').replaceAll('</r>', '</font>')
    }
  },
  mounted () {
    this.to = this.local.email
    // A Local has no NetCom data when it could not be loaded.
    this.cc = this.local.netcom?.email ?? '' // TODO: See how we can set this to always be an @aegee.eu account
    this.subject = 'Preliminary Antenna Criteria check ' + this.agora.name

    const textOf = (part) => {
      const component = this.mailComponents.find(c => c.mail_component === part)
      if (!component) this.missingParts.push(part)
      return component?.text
    }

    // Add all parts of the mail template that the Local is not fulfilling and should fulfil
    const parts = [textOf('introduction')]
    for (const criterion of this.antennaCriteriaMapping[this.local.type]) {
      const part = criterion.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
      const criterionFulfilment = this.local.antennaCriteria[criterion]
      if (criterionFulfilment !== 'true' && criterionFulfilment !== 'exception') {
        parts.push(textOf(part))
      }
    }
    parts.push(textOf('closing'))
    const rawMail = parts.filter(text => text !== undefined).join('\n<br><br>\n')

    // Replace the variables of the template with actual values
    this.body = rawMail
      .replaceAll('{body_name}', this.local.name)
      .replaceAll('{agora_name}', this.agora.name)
      .replaceAll('{netcom_name}', this.local.netcom?.first_name ?? '')
      .replaceAll('{local_type}', this.local.type.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '))
      .replaceAll('{antenna_criteria_amount}', this.antennaCriteriaMapping[this.local.type].length)
  }
}
</script>
