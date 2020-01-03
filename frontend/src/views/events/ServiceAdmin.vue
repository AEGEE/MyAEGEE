<template>
  <div class="tile is-ancestor service-admin">
    <div class="tile is-parent is-vertical">
      <article class="tile is-child">
        <div class="tile is-parent">
          <div class="tile is-child is-6">
            <div class="title">Service stats</div>
            <table class="table is-narrow is-fullwidth">
              <tbody>
                <tr>
                  <th>Uptime</th>
                  <td>{{ status.uptime }}ms.</td>
                </tr>
                <tr>
                  <th>Requests count</th>
                  <td>{{ status.requests }}</td>
                </tr>
                <tr>
                  <th>Roundtrip</th>
                  <td>{{ roundtrip.status }}ms.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="tile is-child is-6">
            <div class="title">User details</div>
            <table class="table is-narrow is-fullwidth">
              <tbody>
                <tr>
                  <th>Name</th>
                  <td>{{ user.first_name }} {{ user.last_name }}</td>
                </tr>

                <tr>
                  <th>Roundtrip</th>
                  <td>{{ roundtrip.user }}ms.</td>
                </tr>

                <tr>
                  <th>Is superadmin?</th>
                  <td>{{ (user.user && user.user.superadmin) ? 'Yes' : 'No' }}</td>
                </tr>

                <tr v-show="(user.user && user.user.superadmin)">
                  <td><a @click="seedEvents()" class="button is-small is-info is-fullwidth">Seed events</a></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<style>
.service-admin .modal .modal-card {
  min-height: 500px;
  min-width: 800px;
}
</style>

<script>
import { mapGetters } from 'vuex'
import moment from 'moment'

export default {
  name: 'EventsServiceAdmin',
  data () {
    return {
      user: {},
      status: {
        uptime: 0,
        requests: 0,
        deadline_crons: 0
      },
      isLoading: {
        user: false
      },
      roundtrip: {
        user: 0,
        status: 0
      },
      source: null
    }
  },
  computed: {
    ...mapGetters({
      services: 'services',
      loginUser: 'user'
    }),
    isLoadingSomething () {
      return Object.keys(this.isLoading).some(key => this.isLoading[key])
    }
  },
  methods: {
    seedEvents () {
      const total = 10
      const titles = [
        'Hackathon',
        'Visit museum',
        'Sightseeing',
        'LGBTI Demonstration',
        'Adventure time: return of the rabbits',
        'Jamsession',
        `Develop Yourself ${Math.floor(Math.random() * 20)}`,
        'The Mystery of Transylvanian (K)nights'
      ]

      const descriptions = [
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quae cum dixisset paulumque institisset, Quid est? Omnes enim iucundum motum, quo sensus hilaretur. Duo Reges: constructio interrete. Qua ex cognitione facilior facta est investigatio rerum occultissimarum.',
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Utinam quidem dicerent alium alio beatiorem! Iam ruinas videres. Si stante, hoc natura videlicet vult, salvam esse se, quod concedimus; Iam id ipsum absurdum, maximum malum neglegi. Quorum sine causa fieri nihil putandum est. Non potes, nisi retexueris illa. Duo Reges: constructio interrete. Mihi enim satis est, ipsis non satis. Si enim ad populum me vocas, eum. Tibi hoc incredibile, quod beatissimum. Quod si ita se habeat, non possit beatam praestare vitam sapientia.',
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. An potest, inquit ille, quicquam esse suavius quam nihil dolere? Qualis ista philosophia est, quae non interitum afferat pravitatis, sed sit contenta mediocritate vitiorum? Ergo id est convenienter naturae vivere, a natura discedere. Qua tu etiam inprudens utebare non numquam. Inde sermone vario sex illa a Dipylo stadia confecimus. ',
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Tum Quintus: Est plane, Piso, ut dicis, inquit. Nonne igitur tibi videntur, inquit, mala? Mihi enim erit isdem istis fortasse iam utendum. Et ille ridens: Video, inquit, quid agas; Duo Reges: constructio interrete. Paulum, cum regem Persem captum adduceret, eodem flumine invectio? Quo plebiscito decreta a senatu est consuli quaestio Cn. Videamus animi partes, quarum est conspectus illustrior; Mihi enim satis est, ipsis non satis. Satis est ad hoc responsum. Nondum autem explanatum satis, erat, quid maxime natura vellet.'
      ]

      const lifecycles = this.eventTypes.map(e => e.name)
      const bodies = this.loginUser.bodies.map(body => body.id)

      for (let i = 0; i < total; i++) {
        const title = titles[Math.floor(Math.random() * titles.length)]
        const start = moment().add(Math.random() * 3 * 365 * 24 * 60 * 60, 'seconds').toDate() // this date plus 3 years
        const end = moment(start).add(Math.random() * 14 * 24 * 60 * 60, 'seconds').toDate() // start date plus 2 weeks
        const description = descriptions[Math.floor(Math.random() * descriptions.length)]
        const eventType = lifecycles[Math.floor(Math.random() * lifecycles.length)]
        const body = bodies[Math.floor(Math.random() * bodies.length)]

        const event = {
          name: title,
          starts: start,
          ends: end,
          description,
          type: eventType,
          body_id: body
        }

        this.axios.post(this.services['oms-events'], event).then((response) => {
          this.$root.showSuccess('Event "' + event.name + '" is successfully added.')
        }).catch((err) => {
          this.$root.showError('Could not save event', err)
        })
      }
    }
  },
  mounted () {
    const start1 = Date.now()
    this.isLoading.user = true
    this.axios.get(this.services['oms-events'] + '/getUser').then((response) => {
      this.user = response.data.data
      this.roundtrip.user = Date.now() - start1
      this.isLoading.user = false
    }).catch((err) => {
      this.isLoading.user = false
      this.$root.showError('Could not fetch user', err)
    })

    const start2 = Date.now()
    this.isLoading.status = true
    this.axios.get(this.services['oms-events'] + '/status').then((response) => {
      this.status = response.data.data
      this.roundtrip.status = Date.now() - start2
      this.isLoading.status = false
    }).catch((err) => {
      this.isLoading.status = false
      this.$root.showError('Could not fetch status', err)
    })
  }
}
</script>
