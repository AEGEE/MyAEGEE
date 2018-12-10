<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Upload members list</div>

        <div class="field" v-if="boardBodies.length > 0">
          <label>Select the body to upload members list to:</label>
          <div class="field">
            <div class="control has-icons-left">
              <div class="select">
                <select v-model="selectedBody">
                  <option v-for="body in boardBodies" v-bind:key="body.id" v-bind:value="body.id">{{ body.name }}</option>
                </select>
              </div>
              <div class="icon is-small is-left">
                <i class="fa fa-globe"></i>
              </div>
            </div>
          </div>
        </div>

        <div class="subtitle" v-if="boardBodies.length === 0">You are not a board member of any body.</div>
        <div class="subtitle" v-if="!selectedBody && boardBodies.length > 0">You haven't selected the antenna yet.</div>

        <div class="field is-grouped" v-if="selectedBody">
          <div class="control">
            <button class="button is-primary" @click="fetchFromBody()">Fetch members list from a body</button>
          </div>
          <div class="control">
            <div class="file">
              <label class="file-label">
                <input class="file-input" type="file" name="resume" @change="openFileDialog($event)">
                <span class="file-cta">
                  <span class="file-icon">
                    <i class="fa fa-upload"></i>
                  </span>
                  <span class="file-label">
                    Fetch members list from CSV
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div class="control">
            <button class="button" v-show="isEditing" @click="isEditing = false">Stop editing</button>
            <button class="button" v-show="!isEditing" @click="isEditing = true">Edit</button>
          </div>
          <div class="control">
            <button class="button is-warning" @click="saveMembersList()">Save!</button>
          </div>
        </div>

        <div v-if="selectedBody && memberslist">
          <span>Uploaded list:</span>
          <ul v-if="!isEditing">
            <li><strong>Total members: </strong>{{ memberslist.members.length }}</li>
            <li><strong>Currency: </strong>{{ memberslist.currency }}</li>
          </ul>

          <div class="field" v-if="isEditing">
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(member, index) in memberslist.members" v-bind:key="index">
                <td>{{ index + 1 }}</td>
                <td>
                  <router-link :to="{ name: 'oms.members.view', params: { id: member.user_id } }">
                    {{ member.user_id }}
                  </router-link>
                </td>
                <td v-if="!isEditing">{{ member.first_name }}</td>
                <td v-if="!isEditing">{{ member.last_name }}</td>
                <td v-if="!isEditing">{{ member.fee }}</td>
                <td v-if="!isEditing"></td>

                <td v-if="isEditing"><input type="text" class="input" v-model="member.first_name"/></td>
                <td v-if="isEditing"><input type="text" class="input" v-model="member.last_name"/></td>
                <td v-if="isEditing"><input type="number" class="input" v-model="member.fee"/></td>
                <td v-if="isEditing"></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="selectedBody && !memberslist">
          <span>Your local hasn't submitted members list for this event yet.
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

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
      currenciesList: {
        EU: 'Euro',
        BG: 'Lev (New) (BG)',
        CZ: 'Czech Koruna (CZ)',
        DK: 'Danish Krone (DK)',
        HU: 'Forint (HU)',
        PL: 'Zloty (PL)',
        RO: 'New Romanian Leu (RO)',
        SE: 'Swedish Krona (SE)',
        GB: 'Pound Sterling (GB)',
        HR: 'Kuna (HR)',
        NO: 'Norwegian Krone (NO)',
        RU: 'New Rouble (RU)',
        CH: 'Swiss Franc (CH)',
        TR: 'Turkish Lira (new) (TR)',
        AL: 'Lek (AL)',
        AM: 'Dram (AM)',
        AZ: 'Azerbaijani Manat (AZ)',
        BY: 'Belarussian Rouble (BY)',
        BA: 'Bosnian Convertible Mark',
        GE: 'Lari (GE)',
        GI: 'Gibraltar pound (GI)',
        IS: 'Icelandic Króna (IS)',
        MK: 'Denar (MK)',
        MD: 'Moldovan Leu (MD)',
        RS: 'Serbian Dinar (RS)',
        UA: 'Hryvnia (UA)',
        US: 'US Dolar'
      },
      can: {
        upload_members_list: {}
      },
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

      this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/memberslists/' + this.selectedBody).then((response) => {
        this.memberslist = response.data.data
        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false
        console.log(err)

        if (err.response.status !== 404) {
          this.$root.showDanger('Could not fetch memberslist: ' + err.message)
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

      this.axios.get(this.services['oms-core-elixir'] + '/bodies/' + this.selectedBody + '/members').then((response) => {
        this.isLoading = false
        this.memberslist = {
          currency: null,
          members: response.data.data.map(member => ({
            user_id: member.member_id,
            first_name: member.member.first_name,
            last_name: member.member.last_name,
            fee: 0
          }))
        }
      }).catch((err) => {
        this.isLoading = false
        this.$root.showDanger('Some error happened: ' + err.message)
      })
    },
    saveMembersList () {
      if (!this.memberslist.currency) {
        return this.$root.showDanger('Please select a currency.')
      }
      if (!this.memberslist.members.length === 0) {
        return this.$root.showDanger('Memberslist should contain at least 1 member.')
      }

      for (let index = 0; index < this.memberslist.members.length; index++) {
        const member = this.memberslist.members[index]
        if (member.fee <= 0) {
          return this.$root.showDanger(`Fee for member number ${index + 1} cannot be negative.`)
        }

        if (member.first_name.trim().length === 0) {
          return this.$root.showDanger(`First name for member number ${index + 1} is not set.`)
        }

        if (member.last_name.trim().length === 0) {
          return this.$root.showDanger(`Last name for member number ${index + 1} is not set.`)
        }
      }

      this.isLoading = true
      this.isEditing = false
      this.axios.post(this.services['oms-statutory'] + '/events/' + this.$route.params.id + '/memberslists/' + this.selectedBody, this.memberslist).then((response) => {
        this.$root.showSuccess('Members list is uploaded.')
        this.isLoading = false
      }).catch((err) => {
        this.isLoading = false
        this.$root.showDanger('Could not save memberslist: ' + err.message)
      })
    },
    openFileDialog (event) {
      const file = event.target.files[0]
      if (!file) {
        return
      }

      if (file) {
        var reader = new FileReader()
        reader.readAsText(file, 'UTF-8')
        reader.onload = (evt) => this.processFileContent(evt.target.result)
        reader.onerror = (err) => {
          this.$root.showDanger('Could not open file: ' + err.message)
        }
      }
    },
    processFileContent (input) {
      // CSV content: first_name,last_name,fee
      const members = input.split('\n').filter(line => line.length > 0).map((line) => {
        const split = line.split(',')
        const firstName = split[0].trim()
        const lastName = split[1].trim()
        const fee = parseInt(split[2].trim()) || 0

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
    }
  },
  watch: {
    'selectedBody' () {
      this.fetchMembersList()
    }
  },
  mounted () {
    this.isLoading = true

    this.axios.get(this.services['oms-statutory'] + '/events/' + this.$route.params.id).then((event) => {
      this.event = event.data.data
      this.can = event.data.data.permissions
      this.myBoards = Object.keys(this.can.see_boardview_of).filter(key => this.can.see_boardview_of[key])
      this.selectedBody = this.myBoards.length > 0 ? this.myBoards[0] : null

      // If user has global permission, fetch all bodies.
      // Otherwise, fetch only bodies that user is a member of.
      if (!this.can.set_board_comment_and_participant_type_global) {
        for (const bodyId of this.myBoards) {
          this.axios.get(this.services['oms-core-elixir'] + '/bodies/' + bodyId).then((body) => {
            this.boardBodies.push(body.data.data)
          })
        }
      } else {
        this.axios.get(this.services['oms-core-elixir'] + '/bodies/').then((response) => {
          this.boardBodies = response.data.data
        })
      }
    }).catch((err) => {
      this.isLoading = false
      let message = (err.response.status === 404) ? 'Event is not found' : 'Some error happened: ' + err.message

      this.$root.showDanger(message)
      this.$router.push({ name: 'oms.statutory.single', params: { id: this.$route.params.id } })
    })
  }
}
</script>
