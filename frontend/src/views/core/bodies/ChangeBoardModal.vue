<template>
  <div class="modal-card" style="height: 75vh">
    <header class="modal-card-head">
      <p class="modal-card-title" v-if="edit">Edit board</p>
      <p class="modal-card-title" v-else>Add board</p>
      <button class="delete" aria-label="close" @click="$parent.close()" />
    </header>
    <section class="modal-card-body">

      <div class="field">
        <label class="label">
          Board election date <span style="color: red;">*</span>
        </label>
        <div class="control">
          <flat-pickr
            placeholder="Select date"
            class="input"
            required
            v-model="board.elected_date" />
        </div>
      </div>

      <b-field grouped>
        <b-field expanded>
          <template slot="label">
            Term start date <span style="color: red;">*</span>
          </template>
          <div class="control">
            <flat-pickr
              placeholder="Select date"
              class="input"
              required
              v-model="board.start_date" />
          </div>
        </b-field>

        <b-field expanded label="Term end date">
          <div class="control">
            <flat-pickr
              placeholder="Select date"
              class="input"
              v-model="board.end_date" />
          </div>
        </b-field>
      </b-field>

      <b-field label="Board name">
        <b-input v-model="board.name" />
      </b-field>

      <hr>

      <b-field grouped v-for="(position, index) in board.positions" v-bind:key="index" style="height: 36px;">
        <b-field>
          <template v-if="position.required">
            <strong>{{ position.function }} <span style="color: red;">*</span></strong>
          </template>

          <template v-else>
            <b-input slot="label" placeholder="Function" v-model="position.function" />
          </template>
        </b-field>

        <b-autocomplete
          v-model="position.name"
          :data="members"
          :loading="isLoading"
          @input="query => fetchMembers(query)"
          @select="user => position.id = user.id"
          :expanded="true"
          field="name">
          <template slot-scope="props">
            <div class="media">
              <div class="media-content">{{ props.option.first_name }} {{ props.option.last_name }}</div>
            </div>
          </template>
        </b-autocomplete>

        <b-button v-if="!position.required" class="button is-danger" @click="deletePosition(index)">
          <span class="white"><font-awesome-icon :icon="['fa', 'trash-alt']" /></span>
        </b-button>
      </b-field>

      <b-field>
        <button class="button is-primary" @click="addPosition()">Add new position</button>
      </b-field>

      <hr>

      <template v-if="!edit">
        <div class="notification is-info">
          <div class="content">
            Please make sure that your contact details are (still) correct.
          </div>
        </div>

        <b-field horizontal label="Email">
          <b-input v-model="body.email" expanded />
        </b-field>

        <b-field horizontal label="Phone">
          <b-input v-model="body.phone" expanded />
        </b-field>

        <b-field horizontal label="Address">
          <b-input v-model="body.address" expanded />
        </b-field>

        <b-field horizontal label="Postal address">
          <b-input v-model="body.postal_address" expanded />
        </b-field>

        <b-field horizontal label="Website">
          <b-input v-model="body.website" expanded />
        </b-field>

        <hr>
      </template>

      <div class="field">
        <label class="label">Message</label>
        <div class="control">
          <b-input type="textarea" v-model="board.message" />
        </div>
        <label class="label">Preview <MarkdownTooltip /></label>
        <div class="content">
          <span v-html="$options.filters.markdown(board.message)" />
        </div>
      </div>
    </section>

    <footer class="modal-card-foot">
      <button class="button is-primary" @click="saveChangeBoard()">Save changes</button>
      <button class="button is-danger" v-if="edit" @click="deleteBoard()">Delete board</button>
      <button class="button" @click="$parent.close()">Cancel</button>
    </footer>

  </div>
</template>

<script>
import MarkdownTooltip from '../../../components/tooltips/MarkdownTooltip'

export default {
  components: {
    MarkdownTooltip
  },
  name: 'ChangeBoardModal',
  props: ['edit', 'oldBoard', 'body', 'services', 'showError', 'showSuccess', 'router'],
  data () {
    return {
      board: {
        elected_date: '',
        start_date: '',
        end_date: null,
        positions: [
          { function: 'President', name: '', user_id: '', required: true },
          { function: 'Secretary', name: '', user_id: '', required: true },
          { function: 'Treasurer', name: '', user_id: '', required: true }
        ],
        name: '',
        message: ''
      },
      members: [],
      isLoading: false,
      isSaving: false
    }
  },
  methods: {
    deleteBoard () {
      this.isSaving = true
      this.axios.delete(this.services['network'] + '/bodies/' + this.body.id + '/boards/' + this.oldBoard.id).then(() => {
        this.isSaving = false
        this.showSuccess('Board is deleted.')
        this.router.go(0)
      })
    },
    saveChangeBoard () {
      this.isSaving = true

      const otherMembers = []

      for (const position of this.board.positions) {
        if (!position.required) { // For all the non-required positions
          otherMembers.push({
            function: position.function,
            user_id: position.id
          })
        }
      }

      const boardExport = {
        body_id: this.body.id,
        elected_date: this.board.elected_date,
        start_date: this.board.start_date,
        end_date: this.board.end_date,
        president: this.board.positions[0].id,
        secretary: this.board.positions[1].id,
        treasurer: this.board.positions[2].id,
        other_members: otherMembers,
        name: this.board.name,
        message: this.board.message
        // TODO: Add image
        // image:
      }

      // Save body details
      this.axios.put(
        this.services['core'] + '/bodies/' + this.body.id,
        this.body
      ).then(() => {
        // Save board information
        const promise = this.edit
          ? this.axios.put(this.services['network'] + '/bodies/' + this.body.id + '/boards/' + this.oldBoard.id, boardExport)
          : this.axios.post(this.services['network'] + '/bodies/' + this.body.id + '/boards', boardExport)

        promise.then(() => {
          this.isSaving = false
          this.showSuccess('Board is saved.')
          this.router.go(0)
        }).catch((err) => {
          this.isSaving = false
          if (err.response.status === 422) {
            this.showError('Some input data is invalid')
            return
          }
          this.showError('Something went wrong', err)
        })
      })
    },
    addPosition () {
      this.board.positions.push({
        function: '',
        name: '',
        user_id: '',
        required: false
      })
    },
    deletePosition (index) {
      this.board.positions.splice(index, 1)
    },
    fetchMembers (query) {
      if (!query) return

      this.isLoading = true
      this.members = []

      if (this.token) this.token.cancel()
      this.token = this.axios.CancelToken.source()

      // Get all the members of this body, matching with what the user typed in
      this.axios.get(this.services['core'] + '/bodies/' + this.body.id + '/members', {
        cancelToken: this.token.token,
        params: { query }
      }).then((response) => {
        const users = response.data.data
        for (const user of users) {
          user.user.name = user.user.first_name + ' ' + user.user.last_name
          this.members.push(user.user)
        }
        this.isLoading = false
      }).catch((err) => {
        if (this.axios.isCancel(err)) {
          return
        }

        this.isLoadingMembers = false
        this.showError('Could not fetch members', err)
      })
    }
  },
  mounted () {
    if (!this.edit) {
      return
    }

    // There must be a nicer way to do this, oops :p
    this.board.elected_date = this.oldBoard.elected_date
    this.board.start_date = this.oldBoard.start_date
    this.board.end_date = this.oldBoard.end_date
    this.board.positions[0].id = this.oldBoard.president
    this.board.positions[0].name = this.oldBoard.president_user.first_name + ' ' + this.oldBoard.president_user.last_name
    this.board.positions[1].id = this.oldBoard.secretary
    this.board.positions[1].name = this.oldBoard.secretary_user.first_name + ' ' + this.oldBoard.secretary_user.last_name
    this.board.positions[2].id = this.oldBoard.treasurer
    this.board.positions[2].name = this.oldBoard.treasurer_user.first_name + ' ' + this.oldBoard.treasurer_user.last_name
    this.board.name = this.oldBoard.name
    this.board.message = this.oldBoard.message

    for (const other of this.oldBoard.other_members) {
      this.board.positions.push({
        function: other.function,
        name: other.user.first_name + ' ' + other.user.last_name,
        user_id: other.user_id,
        required: false
      })
    }
  }
}

</script>
