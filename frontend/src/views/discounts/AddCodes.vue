<template>
  <div class="tile is-ancestor ">
    <div class="tile is-child">
      <h4 class="title">Add codes for {{ integration.name }}</h4>

      <form @submit.prevent="addCodes()">
        <div class="field">
          <label class="label">Please enter each code on a separate line, without any spaces or tabs.</label>
          <div class="control">
            <textarea class="textarea" placeholder="e.g. Hello world" rows="20" required v-model="codesRaw" />
          </div>
        </div>

        <b-loading is-full-page="false" :active.sync="isLoading" />

        <div class="field">
          <div class="control">
            <input type="submit" value="Add codes to integration" :disabled="isSaving" class="button is-primary is-fullwidth" />
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'AddCodesToIntegration',
  data () {
    return {
      integration: {
        id: null,
        name: 'integration that is loading'
      },
      codesRaw: '',
      isLoading: false
    }
  },
  computed: {
    ...mapGetters(['services']),
    codes () {
      return this.codesRaw
        .split('\n')
        .filter(l => l.length > 0)
    }
  },
  methods: {
    addCodes () {
      if (!this.codes.length) {
        return this.$root.showError('Please add at least 1 not empty code.')
      }

      this.isSaving = true

      this.axios.post(this.services['discounts'] + '/integrations/' + this.integration.id + '/codes', this.codes).then(() => {
        this.isSaving = false

        this.$root.showSuccess('Codes are added.')

        return this.$router.push({ name: 'oms.discounts.list' })
      }).catch((err) => {
        this.isSaving = false
        this.$root.showError('Could not add codes', err)
      })
    }
  },
  mounted () {
    this.isLoading = true
    this.axios.get(this.services['discounts'] + '/integrations/' + this.$route.params.id).then((response) => {
      this.integration = response.data.data
      this.isLoading = false
    }).catch((err) => {
      if (err.response.status === 404) {
        this.$root.showError('Integration is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

      this.$router.push({ name: 'oms.discounts.list' })
    })
  }
}
</script>
