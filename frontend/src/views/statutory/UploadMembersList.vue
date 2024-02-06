<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Manage members list</div>

        <div class="field" v-if="boardBodies.length > 0">
          <label>Select the body to manage members list for:</label>
          <div class="field">
            <div class="control has-icons-left">
              <div class="select">
                <select v-model="selectedBody">
                  <option v-for="body in boardBodies" v-bind:key="body.id" v-bind:value="body.id">{{ body.name }}</option>
                </select>
              </div>
              <div class="icon is-small is-left">
                <font-awesome-icon icon="globe" />
              </div>
            </div>
          </div>
        </div>

        <div class="subtitle" v-if="boardBodies.length === 0">You are not a board member of any body.</div>
        <div class="subtitle" v-if="!selectedBody && boardBodies.length > 0">You haven't selected the antenna yet.</div>

        <div v-show="selectedBody && canEditMemberslist(selectedBody)">
          <div class="field is-grouped">
            <div class="control">
              <button class="button is-primary" @click="fetchFromBody()">Fetch members list from a body</button>
            </div>
            <!-- Disabled for now, probably will be enabled again later, therefore not deleted. -->
            <!-- <div class="control">
              <div class="file">
                <label class="file-label">
                  <input class="file-input" type="file" name="resume" @change="openFileDialog($event)">
                  <span class="file-cta">
                    <span class="file-icon">
                      <font-awesome-icon icon="upload" />
                    </span>
                    <span class="file-label">
                      Fetch members list from CSV
                    </span>
                  </span>
                </label>
              </div>
            </div> -->

            <div class="control">
              <button class="button" v-show="isEditing" @click="isEditing = false">Stop editing</button>
              <button class="button" v-show="!isEditing" @click="isEditing = true">Edit</button>
            </div>
            <div class="control">
              <button
                class="button is-warning"
                @click="checkMemberslist()"
                :disabled="isLoading">
                Save!
              </button>
            </div>
          </div>
        </div>

        <div v-if="selectedBody && memberslist">
          <hr />
          <span>Uploaded list:</span>
          <ul v-if="!isEditing">
            <li><strong>Total members: </strong>{{ memberslist.members.length }}</li>
            <li v-if="memberslist.fee_to_aegee"><strong>Total fee paid to AEGEE-Europe: </strong>{{ memberslist.fee_to_aegee.toFixed(2) }} EUR</li>
          </ul>
          <div class="field">
            <label class="label">Currency</label>
            <div class="control">
              <div class="select">
                <select v-model="memberslist.currency">
                  <option v-for="(description, value) in currenciesList" v-bind:key="value" v-bind:value="value">{{ description }}</option>
                </select>
              </div>
            </div>
          </div>

          <hr v-if="isEditing" />

          <div class="field" v-if="isEditing">
            <label class="label">Set fee for everyone</label>
            <div class="field has-addons">
              <div class="control is-expanded">
                <input class="input" type="number" v-model.number="tempFee">
              </div>
              <div class="control">
                <a class="button is-info" @click="setFee()">Set</a>
              </div>
            </div>
          </div>

          <table class="table is-narrow is-fullwidth">
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

                <td v-if="isEditing"><input type="text" class="input" v-model="member.first_name" /></td>
                <td v-if="isEditing"><input type="text" class="input" v-model="member.last_name" /></td>
                <td v-if="isEditing"><input type="number" class="input" v-model.number="member.fee" /></td>

                <td>
                  <span v-if="memberslist.fee_to_aegee">{{ member.fee_to_aegee.toFixed(2) }} EUR</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="selectedBody && !memberslist">
          <span>Your local hasn't submitted members list for this event yet.</span>
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
      event: {
        questions: []
      },
      currenciesList,
      can: {
        upload_memberslist: {}
      },
      payments: [],
      tempFee: 0,
      isLoading: false,
      isEditing: false,
      isSaving: false,
      saved: true
    }
  },
  computed: mapGetters({
    services: 'services',
    loginUser: 'user'
  }),
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
              // for old memberslists that were uploaded through CSV and do not have the user ID, do nothing
              if (!member.user_id) {
                continue
              }

              // get member's current payment
              const currentPayment = this.payments.find(payment => payment.member_id === member.user_id && moment().isBetween(payment.starts, payment.expires))

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
    openFileDialog (event) {
      const file = event.target.files[0]
      if (!file) {
        return
      }

      if (file) {
        const reader = new FileReader()
        reader.readAsText(file, 'UTF-8')
        reader.onload = (evt) => this.processFileContent(evt.target.result)
        reader.onerror = (err) => {
          this.$root.showError('Could not open file', err)
        }
      }
    },
    isLocal (body) {
      return ['antenna', 'contact antenna', 'contact'].includes(body.type)
    },
    processFileContent (input) {
      // CSV content: first_name,last_name,fee
      const csvArray = input
        .replace(/;/g, ',') // replacing all semicolons with commas
        .replace(/"/g, '') // removing all quotes
        .split('\n') // splitting by new lime
        .filter(line => line.length > 0) // removing empty strings
        .map(elt => elt.split(','))

      // Checking if each line has at least 3 columns.
      if (csvArray.some(elt => elt.length < 3)) {
        return this.$root.showError('CSV is malformed.')
      }

      const members = csvArray.map((element) => {
        const firstName = element[0].trim()
        const lastName = element[1].trim()
        const fee = parseInt(element[2].trim(), 10) || 0

        return {
          first_name: firstName,
          last_name: lastName,
          fee
        }
      })

      this.memberslist = {
        currency: null,
        members
      }
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
    this.isLoading = true

    this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id).then((event) => {
      this.event = event.data.data
      this.can = event.data.data.permissions
      this.myBoards = Object.keys(this.can.see_memberslist)
        .filter(key => key !== 'global')
        .filter(key => this.can.see_memberslist[key])
      this.selectedBody = this.myBoards.length > 0 ? this.myBoards[0] : null

      // If user has global permission, fetch all bodies.
      // Otherwise, fetch only bodies that user is a member of.
      if (!this.can.see_memberslist.global) {
        for (const bodyId of this.myBoards) {
          this.axios.get(this.services['core'] + '/bodies/' + bodyId).then((body) => {
            if (this.isLocal(body.data.data)) {
              this.boardBodies.push(body.data.data)
            }
          })
        }
      } else {
        this.axios.get(this.services['core'] + '/bodies/').then((response) => {
          this.boardBodies = response.data.data.filter(body => this.isLocal(body))
        })
      }
    }).catch((err) => {
      this.isLoading = false
      if (err.response.status === 404) {
        this.$root.showError('Event is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

      this.$router.push({ name: 'oms.statutory.single', params: { id: this.$route.params.id } })
    })
  }
}
</script>
