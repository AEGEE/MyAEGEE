<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">Add fee payment for {{member.user.first_name }} {{ member.user.last_name }}</p>
      <button class="delete" aria-label="close" @click="$parent.close()" />
    </header>
    <section class="modal-card-body">
      <div class="field">
        <label class="label">Starts at <span class="has-text-danger">*</span></label>
        <div class="control">
          <flat-pickr
            placeholder="Select date"
            class="input"
            required
            v-model="tmpPayment.starts" />
        </div>
        <p class="help is-danger" v-if="errors.starts">{{ errors.starts.join(', ') }}</p>
      </div>

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

      <div class="field">
        <label class="label">Invoice address</label>
        <div class="control">
          <input type="text" class="input" v-model.number="tmpPayment.invoice_address" />
        </div>
        <p class="help is-danger" v-if="errors.invoice_address">{{ errors.invoice_address.join(', ') }}</p>
      </div>

      <div class="field">
        <label class="label">Invoice name</label>
        <div class="control">
          <input type="text" class="input" v-model.number="tmpPayment.invoice_name" />
        </div>
        <p class="help is-danger" v-if="errors.invoice_name">{{ errors.invoice_name.join(', ') }}</p>
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
  props: ['member', 'body', 'services', 'showSuccess', 'showError'],
  data () {
    return {
      currencies,
      errors: {},
      tmpPayment: {
        starts: '',
        expires: '',
        currency: '',
        invoice_address: '',
        invoice_name: '',
        amount: 0
      }
    }
  },
  watch: {
    'tmpPayment.starts': function () {
      this.tmpPayment.expires = moment(this.tmpPayment.starts, 'YYYY-MM-DD').add(1, 'year').format('YYYY-MM-DD')
    }
  },
  methods: {
    saveFeePayment () {
      this.isLoading = true

      this.axios.post(this.services['core'] + '/bodies/' + this.body.id + '/payments', {
        starts: this.tmpPayment.starts,
        expires: this.tmpPayment.expires,
        currency: this.tmpPayment.currency,
        amount: this.tmpPayment.amount,
        invoice_address: this.tmpPayment.invoice_address,
        invoice_name: this.tmpPayment.invoice_name,
        user_id: this.member.user_id,
        body_id: this.body.id
      }).then((response) => {
        this.showSuccess('Payment is added.')
        this.member.payments.push(response.data.data)
        this.isLoading = false
        this.$parent.close()
      }).catch((err) => {
        this.isLoading = false
        if (err.response && err.response.status === 422) {
          this.showError('Some fields were not set')
        } else {
          this.showError('Some error happened', err)
        }

        if (err.response && err.response.data && err.response.data.errors) this.errors = err.response.data.errors
      })
    }
  },
  mounted () {
    this.tmpPayment.starts = moment().format('YYYY-MM-DD')
  }
}
</script>
