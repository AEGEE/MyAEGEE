<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <h1 class="title">Manage members list</h1>

        <div class="field" v-if="boardBodies.length > 0">
          <label for="memberslist-body">Select the body to manage members list for:</label>
          <div class="field">
            <div class="control has-icons-left">
              <div class="select">
                <select id="memberslist-body" v-model="selectedBody">
                  <option v-for="body in boardBodies" v-bind:key="body.id" v-bind:value="body.id">{{ body.name }}</option>
                </select>
              </div>
              <div class="icon is-small is-left">
                <font-awesome-icon icon="globe" />
              </div>
            </div>
          </div>
        </div>

        <div class="subtitle" v-if="!isLoadingBodies && boardBodies.length === 0">You are not a board member of any body.</div>
        <div class="subtitle" v-if="!selectedBody && boardBodies.length > 0">You haven't selected the antenna yet.</div>

        <div v-show="selectedBody && canEditMemberslist(selectedBody)">
          <div class="field is-grouped is-grouped-multiline">
            <div class="control">
              <button type="button" class="button is-primary" @click="fetchFromBody()">Fetch members list from a body</button>
            </div>
            <div class="control" v-if="memberslist">
              <button type="button" class="button" v-show="isEditing" @click="isEditing = false">Stop editing</button>
              <button type="button" class="button" v-show="!isEditing" @click="isEditing = true">Edit</button>
            </div>
            <div class="control" v-if="memberslist">
              <button
                type="button"
                class="button is-warning"
                @click="checkMemberslist()"
                :disabled="isLoading">
                Save!
              </button>
            </div>
          </div>
        </div>

        <article
          class="message is-warning"
          v-if="selectedBody && memberslist && !canEditMemberslist(selectedBody) && isAfterSubmissionDeadline">
          <div class="message-body" v-if="isAfterEditDeadline">
            The edit deadline has passed. If you want to make changes to the members list, reach out to the Network Director at
            <a href="mailto:network@aegee.eu">network@aegee.eu</a>.
          </div>
          <div class="message-body" v-else>
            The upload deadline has passed. If you want to make changes to the members list, reach out to the Network Director at
            <a href="mailto:network@aegee.eu">network@aegee.eu</a>.
          </div>
        </article>

        <div v-if="selectedBody && memberslist">
          <hr />
          <span>Uploaded list:</span>
          <ul v-if="!isEditing">
            <li><strong>Total members: </strong>{{ memberslist.members.length }}</li>
            <li v-if="memberslist.fee_to_aegee"><strong>Total fee paid to AEGEE-Europe: </strong>{{ memberslist.fee_to_aegee.toFixed(2) }} EUR</li>
          </ul>
          <div class="field">
            <label class="label" for="memberslist-currency">Currency</label>
            <div class="control">
              <div class="select">
                <select id="memberslist-currency" v-model="memberslist.currency">
                  <option v-for="(description, value) in currenciesList" v-bind:key="value" v-bind:value="value">{{ description }}</option>
                </select>
              </div>
            </div>
          </div>

          <hr v-if="isEditing" />

          <div class="field" v-if="isEditing">
            <label class="label" for="memberslist-fee-for-everyone">Set fee for everyone</label>
            <div class="field has-addons">
              <div class="control is-expanded">
                <input id="memberslist-fee-for-everyone" class="input" type="number" v-model.number="tempFee">
              </div>
              <div class="control">
                <button type="button" class="button is-info" @click="setFee()">Set</button>
              </div>
            </div>
          </div>

          <table class="table is-narrow is-fullwidth" aria-label="Members">
            <thead>
              <tr>
                <th>Index</th>
                <th>User ID</th>
                <th>First name</th>
                <th>Last name</th>
                <th>Fee</th>
                <th v-if="memberslist.fee_to_aegee">Fee to AEGEE-Europe</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(member, index) in memberslist.members" v-bind:key="index">
                <td>{{ index + 1 }}</td>
                <td>
                  <router-link target="_blank" rel="noopener noreferrer" v-if="member.user_id" :to="{ name: 'oms.members.view', params: { id: member.user_id } }">
                    {{ member.user_id }}
                  </router-link>
                  <span v-if="!member.user_id">-</span>
                </td>
                <td v-if="!isEditing">{{ member.first_name }}</td>
                <td v-if="!isEditing">{{ member.last_name }}</td>
                <td v-if="!isEditing">{{ member.fee }}</td>

                <td v-if="isEditing"><input type="text" class="input" :aria-label="'First name of member ' + (index + 1)" v-model="member.first_name" /></td>
                <td v-if="isEditing"><input type="text" class="input" :aria-label="'Last name of member ' + (index + 1)" v-model="member.last_name" /></td>
                <td v-if="isEditing"><input type="number" class="input" :aria-label="'Fee of member ' + (index + 1)" v-model.number="member.fee" /></td>

                <td v-if="memberslist.fee_to_aegee">{{ member.fee_to_aegee.toFixed(2) }} EUR</td>
              </tr>
            </tbody>
          </table>
        </div>

        <article
          class="message is-warning"
          v-if="selectedBody && !memberslist && !canEditMemberslist(selectedBody) && isAfterSubmissionDeadline">
          <div class="message-body">
            The submission deadline has passed. If your local still needs to submit a members list, reach out to the Network Director at
            <a href="mailto:network@aegee.eu">network@aegee.eu</a>.
          </div>
        </article>

        <div v-if="selectedBody && !memberslist">
          <span>This local hasn't submitted a members list for this event yet.</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import moment from 'moment'
import currenciesList from '../../currencies.json'

export default {
  name: 'UploadMembersList',
  data () {
    return {
      memberslist: null,
      boardBodies: [],
      myBoards: [],
      selectedBody: null,
      event: {},
      currenciesList,
      can: {
        upload_memberslist: {}
      },
      payments: [],
      tempFee: 0,
      isLoading: false,
      isLoadingBodies: true,
      isEditing: false
    }
  },
  computed: {
    ...mapGetters({
      services: 'services'
    }),
    // Only an Agora has these deadlines; without them nothing is said about them.
    isAfterSubmissionDeadline () {
      return Boolean(this.event.memberslist_submission_deadline) && moment().isAfter(this.event.memberslist_submission_deadline)
    },
    // Read after the submission deadline only, so the event has its edit deadline.
    isAfterEditDeadline () {
      return moment().isAfter(this.event.memberslist_edit_deadline)
    }
  },
  methods: {
    fetchMembersList () {
      this.isLoading = true
      this.memberslist = null

      this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id + '/memberslists/' + this.selectedBody).then((response) => {
        this.memberslist = response.data.data
        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false
        this.memberslist = null

        if (err.response && err.response.status !== 404) {
          this.$root.showError('Could not fetch memberslist', err)
        }
      })
    },
    setFee () {
      for (const member of this.memberslist.members) {
        member.fee = this.tempFee
      }
    },
    fetchFromBody () {
      this.isLoading = true
      this.isEditing = false

      this.axios.get(this.services['core'] + '/bodies/' + this.selectedBody + '/members').then((response) => {
        this.memberslist = {
          currency: null,
          members: response.data.data.map(member => ({
            user_id: member.user_id,
            first_name: member.user.first_name,
            last_name: member.user.last_name,
            fee: 0
          }))
        }

        return this.axios.get(this.services['core'] + '/bodies/' + this.selectedBody + '/payments')
          .then((paymentsResponse) => {
            this.payments = paymentsResponse.data.data

            // getting last payment for each user, setting it as a members' fee on newly-created memberslist
            for (const member of this.memberslist.members) {
              // get member's current payment
              const currentPayment = this.payments.find(payment => payment.user_id === member.user_id && moment().isBetween(payment.starts, payment.expires))

              // if there's no payment, do nothing, so it'd default to zero
              // if there is one, setting it for the user.
              if (currentPayment) {
                const intFee = Number(currentPayment.amount)
                member.fee = !Number.isNaN(intFee) ? intFee : 0
              }
            }

            this.isLoading = false
          })
          .catch((err) => {
            // not great, not terrible
            this.$root.showWarning('Could not fetch payments info: ' + err.message)
            this.isLoading = false
          })
      }).catch((err) => {
        this.isLoading = false
        this.$root.showError('Some error happened', err)
      })
    },
    checkMemberslist () {
      if (this.memberslist.members.every(member => member.fee === 0)) {
        this.$buefy.dialog.confirm({
          title: 'No fee set',
          message: 'You submitted that your members have paid a fee of €0 to your local, is that correct?',
          confirmText: 'Confirm',
          type: 'is-warning',
          hasIcon: true,
          onConfirm: () => this.saveMembersList()
        })
      } else {
        this.saveMembersList()
      }
    },
    saveMembersList () {
      if (!this.memberslist.currency) {
        return this.$root.showError('Please select a currency.')
      }
      if (this.memberslist.members.length === 0) {
        return this.$root.showError('Memberslist should contain at least 1 member.')
      }

      for (let index = 0; index < this.memberslist.members.length; index++) {
        const member = this.memberslist.members[index]
        if (typeof member.fee !== 'number') {
          return this.$root.showError(`Please set the fee for member number ${index + 1}.`)
        }

        if (member.fee < 0) {
          return this.$root.showError(`Fee for member number ${index + 1} cannot be negative.`)
        }

        if (member.first_name.trim().length === 0) {
          return this.$root.showError(`First name for member number ${index + 1} is not set.`)
        }

        if (member.last_name.trim().length === 0) {
          return this.$root.showError(`Last name for member number ${index + 1} is not set.`)
        }
      }

      // Filtering out fee_to_aegee to pass validation.
      const body = {
        currency: this.memberslist.currency,
        members: this.memberslist.members.map(member => ({
          user_id: member.user_id,
          first_name: member.first_name,
          last_name: member.last_name,
          fee: member.fee
        }))
      }

      this.isLoading = true
      this.isEditing = false
      this.axios.post(this.services['statutory'] + '/events/' + this.$route.params.id + '/memberslists/' + this.selectedBody, body).then((response) => {
        this.$root.showSuccess('Members list is uploaded.')
        this.memberslist = response.data.data
        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false
        this.$root.showError('Could not save memberslist', err)
      })
    },
    isLocal (body) {
      return ['antenna', 'contact antenna', 'contact'].includes(body.type)
    },
    canEditMemberslist (bodyId) {
      if (this.memberslist) {
        return this.can.edit_memberslist.global || this.can.edit_memberslist[bodyId]
      }

      return this.can.upload_memberslist.global || this.can.upload_memberslist[bodyId]
    }
  },
  watch: {
    selectedBody () {
      this.fetchMembersList()
    }
  },
  mounted () {
    this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id).then((event) => {
      this.event = event.data.data
      this.can = event.data.data.permissions
      this.myBoards = Object.keys(this.can.see_memberslist)
        .filter(key => key !== 'global')
        .filter(key => this.can.see_memberslist[key])
      this.selectedBody = this.myBoards.length > 0 ? this.myBoards[0] : null

      // If user has global permission, fetch all bodies.
      // Otherwise, fetch only bodies that user is a member of.
      const requests = this.can.see_memberslist.global
        ? [this.axios.get(this.services['core'] + '/bodies/').then((response) => response.data.data)]
        : this.myBoards.map((bodyId) => this.axios.get(this.services['core'] + '/bodies/' + bodyId).then((body) => [body.data.data]))

      // The page only says the member has no body once every body is in.
      Promise.allSettled(requests).then((results) => {
        this.boardBodies = results
          .filter((result) => result.status === 'fulfilled')
          .flatMap((result) => result.value)
          .filter(body => this.isLocal(body))
        this.isLoadingBodies = false

        const failed = results.find((result) => result.status === 'rejected')
        if (failed) {
          this.$root.showError('Could not fetch bodies', failed.reason)
        }
      })
    }).catch((err) => {
      if (err.response && err.response.status === 404) {
        this.$root.showError('Event is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

      this.$router.push({ name: 'oms.statutory.view', params: { id: this.$route.params.id } })
    })
  }
}
</script>
