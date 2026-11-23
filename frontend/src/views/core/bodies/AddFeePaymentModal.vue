<template>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">Add fee payment for {{member.user.first_name }} {{ member.user.last_name }}</p>
      <button type="button" class="delete" aria-label="close" @click="$parent.close()" />
    </header>
    <section class="modal-card-body">
      <div class="field">
        <label class="label" for="fee-payment-starts">Starts at <span class="has-text-danger">*</span></label>
        <div class="control">
          <flat-pickr
            id="fee-payment-starts"
            :config="dateConfig"
            placeholder="Select date"
            class="input"
            required
            v-model="tmpPayment.starts" />
        </div>
        <p class="help is-danger" v-if="errors.starts">{{ errors.starts.join(', ') }}</p>
      </div>

      <div class="field">
        <label class="label" for="fee-payment-expires">Expires on <span class="has-text-danger">*</span></label>
        <div class="control">
          <flat-pickr
            id="fee-payment-expires"
            :config="dateConfig"
            placeholder="Select date"
            class="input"
            required
            v-model="tmpPayment.expires" />
        </div>
        <p class="help is-danger" v-if="errors.expires">{{ errors.expires.join(', ') }}</p>
      </div>

      <div class="field">
        <label class="label" for="fee-payment-amount">Amount <span class="has-text-danger">*</span></label>
        <div class="control">
          <input id="fee-payment-amount" type="number" required min="0" class="input" v-model.number="tmpPayment.amount" />
        </div>
        <p class="help is-danger" v-if="errors.amount">{{ errors.amount.join(', ') }}</p>
      </div>

      <div class="field">
        <label class="label" for="fee-payment-currency">Currency <span class="has-text-danger">*</span></label>
        <div class="control">
          <div class="select">
            <select id="fee-payment-currency" v-model="tmpPayment.currency">
              <option v-for="(currency, key) in currencies" v-bind:key="key" :value="key">{{ currency }}</option>
            </select>
          </div>
        </div>
        <p class="help is-danger" v-if="errors.currency">{{ errors.currency.join(', ') }}</p>
      </div>

      <div class="field">
        <label class="label" for="fee-payment-invoice-address">Invoice address</label>
        <div class="control">
          <input id="fee-payment-invoice-address" type="text" class="input" v-model="tmpPayment.invoice_address" />
        </div>
        <p class="help is-danger" v-if="errors.invoice_address">{{ errors.invoice_address.join(', ') }}</p>
      </div>

      <div class="field">
        <label class="label" for="fee-payment-invoice-name">Invoice name</label>
        <div class="control">
          <input id="fee-payment-invoice-name" type="text" class="input" v-model="tmpPayment.invoice_name" />
        </div>
        <p class="help is-danger" v-if="errors.invoice_name">{{ errors.invoice_name.join(', ') }}</p>
      </div>
    </section>
    <footer class="modal-card-foot">
      <button type="button" class="button is-primary" :class="{ 'is-loading': isLoading }" :disabled="isLoading" @click="saveFeePayment()">Add fee payment</button>
      <button type="button" class="button" @click="$parent.close()">Cancel</button>
    </footer>
  </div>
</template>

<script>
import 'flatpickr/dist/flatpickr.css'
import flatPickr from 'vue-flatpickr-component'
import moment from 'moment'

import currencies from '../../../currencies'

export default {
  name: 'AddFeePaymentModal',
  components: {
    flatPickr
  },
  props: ['member', 'body', 'services', 'showSuccess', 'showError'],
  data () {
    return {
      currencies,
      // Typed dates, and the same field on a phone.
      dateConfig: { allowInput: true, disableMobile: true },
      errors: {},
      isLoading: false,
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
      const starts = moment(this.tmpPayment.starts, 'YYYY-MM-DD', true)
      if (!starts.isValid()) return

      this.tmpPayment.expires = starts.add(1, 'year').format('YYYY-MM-DD')
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
        // Those who may add payments but not see them have no list of payments yet.
        if (!this.member.payments) this.$set(this.member, 'payments', [])
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
