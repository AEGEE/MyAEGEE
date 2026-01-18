<template>
  <div class="tile is-ancestor">
    <div class="tile is-parent">
      <div class="tile is-child">
        <div class="title">Statutory service page</div>

        <div class="subtitle">Permissions</div>

        <b-table :data="flattenedPermissions" :loading="isLoading">
          <b-table-column field="permission" label="Permission" v-slot="props">
            <b>{{ props.row.key }}</b>
          </b-table-column>

          <b-table-column field="value" label="Value" sortable v-slot="props">
            <span :class="calculateForValue(props.row.value)">
              {{ props.row.value | beautify }}
            </span>
          </b-table-column>

          <template slot="empty">
            <empty-table-stub />
          </template>
        </b-table>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

function flattenObj (obj, parent, res = {}) {
  for (const key in obj) {
    const propName = parent ? parent + '.' + key : key
    if (typeof obj[key] === 'object') {
      flattenObj(obj[key], propName, res)
    } else {
      res[propName] = obj[key]
    }
  }
  return res
}

export default {
  name: 'StatutoryDebug',
  data () {
    return {
      event: {
        questions: []
      },
      permissions: {},
      isLoading: false
    }
  },
  computed: {
    ...mapGetters({
      services: 'services',
      loginUser: 'user'
    }),
    flattenedPermissions () {
      const flattenedObj = flattenObj(this.permissions)

      return Object.keys(flattenedObj).map(key => ({
        key,
        value: flattenedObj[key]
      }))
    }
  },
  methods: {
    calculateForValue (value) {
      return ['tag', 'is-small', value ? 'is-primary' : 'is-danger']
    }
  },
  mounted () {
    this.isLoading = true

    this.axios.get(this.services['statutory'] + '/events/' + this.$route.params.id).then((event) => {
      this.event = event.data.data
      this.permissions = event.data.data.permissions

      this.isLoading = false
    }).catch((err) => {
      this.isLoading = false
      if (err.response.status === 404) {
        this.$root.showError('Event is not found')
      } else {
        this.$root.showError('Some error happened', err)
      }

      this.$router.push({ name: 'oms.statutory.list.all' })
    })
  }
}
</script>
