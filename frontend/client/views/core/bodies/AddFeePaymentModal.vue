<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">Add fee payment</p>
      <button class="delete" aria-label="close" @click="$parent.close()"></button>
    </header>
    <section class="modal-card-body">
      <div class="field">
        <label class="label">Expires on <span class="has-text-danger">*</span></label>
        <div class="control">
        <flat-pickr
            placeholder="Select date"
            class="input"
            required
            v-model="tmpPayment.expires" />
        </div>
        <p class="help is-danger" v-if="errors.expires">{{ errors.expires.join(', ') }}</p>
      </div>

      <div class="field">
        <label class="label">Amount <span class="has-text-danger">*</span></label>
        <div class="control">
          <input type="number" required min="0" class="input" v-model.number="tmpPayment.amount" />
        </div>
        <p class="help is-danger" v-if="errors.amount">{{ errors.amount.join(', ') }}</p>
      </div>

      <div class="field">
        <label class="label">Currency <span class="has-text-danger">*</span></label>
        <div class="control">
          <div class="select">
            <select v-model="tmpPayment.currency">
              <option v-for="(currency, key) in currencies" v-bind:key="key" :value="key">{{ currency }}</option>
            </select>
          </div>
        </div>
        <p class="help is-danger" v-if="errors.currency">{{ errors.currency.join(', ') }}</p>
      </div>
    </section>
    <footer class="modal-card-foot">
      <button class="button is-primary" @click="saveFeePayment()">Add fee payment</button>
      <button class="button" @click="$parent.close()">Cancel</button>
    </footer>
  </div>
</template>

<script>
import moment from 'moment'

import currencies from '../../../currencies'

export default {
  name: 'AddFeePaymentModal',
  props: ['member', 'body', 'services', 'showSuccess', 'showDanger'],
  data () {
    return {
      currencies,
      errors: {},
      tmpPayment: {
        expires: '',
        currency: '',
        amount: 0
      }
    }
  },
  methods: {
    saveFeePayment () {
      this.isLoading = true

      this.axios.post(this.services['oms-core-elixir'] + '/bodies/' + this.body.id + '/payments', {
        payment: {
          expires: moment(this.tmpPayment.expires, 'YYYY-MM-DD').toISOString(),
          currency: this.tmpPayment.currency,
          amount: this.tmpPayment.amount,
          member_id: this.member.member_id,
          body_id: this.body.id
        }
      }).then((response) => {
        this.showSuccess('Payment is added.')

        this.tmpPayment = { expires: '', currency: '', amount: 0 }
        this.member.payments.push(response.data.data)

        if (this.member.payments.length <= 1) {
          this.$set(this.member, 'lastPayment', response.data.data)
        }

        this.isLoading = false
        this.$parent.close()
      }).catch((err) => {
        this.isLoading = false
        let message = err.response && err.response.status === 422 ? 'Some fields were not set: ' : err.message
        if (err.response && err.response.data && err.response.data.errors) this.errors = err.response.data.errors

        this.showDanger(message)
      })
    }
  }
}
</script>