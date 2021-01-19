<template>
  <div class='tile is-ancestor resources'>
    <div class='tile is-parent is-vertical'>

      <section v-for="(block, name) in resources" v-bind:key="name">
        <div class="title">{{ name }}</div>

        <section class="resources-block">
          <div class="resources-item" v-for="resource in block" v-bind:key="resource.url">
            <a :href="resource.url" target="_blank">
              <div class="card">
                <header role="tab" class="card-header">
                  <div class="card-header-title" :style="{ 'background-color': resource.color }">
                    <span>{{ resource.title }}</span>
                  </div>
                </header>
                <div class="card-content">
                  <div class="card-content-box" v-html="resource.description"></div>
                </div>
              </div>
            </a>
          </div>
        </section>
      </section>

    </div>
  </div>
</template>

<style>
.resources .resources-item {
  margin-right: 30px;
  margin-bottom: 30px;
  width: 300px;
  height: 150px;
}
.resources .resources-item .card:hover .card-content {
  background-color: #fafafa;
}
.resources .resources-item .card {
  height: 100%;
}
.resources .resources-item .card-header {
  height: 50px;
}
.resources .resources-item .card-content {
  height: 100px;
}
.resources .resources-block {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 20px;
  margin-top: 50px;
}
.resources .not-bold {
  font-weight: normal;
}
</style>

<script>
export default {
  data () {
    return {
      resources: {
        'External': [
          {
            url: 'https://aegee.org',
            title: 'AEGEE website',
            description: 'Official website',
            color: '#4CA0FF'
          },
          {
            url: 'https://aegee.blogactiv.eu/',
            title: 'External blog',
            description: 'Blog hosted on Blogactiv platform',
            color: '#4CA0FF'
          },
          {
            url: 'https://aegee.us7.list-manage.com/subscribe?u=7a170c64e0d3990f3f6629d21&id=fc8908d780',
            title: 'External newsletter',
            description: 'Bi-monthly newsletter for Partners & Supporters',
            color: '#4CA0FF'
          },
          {
            url: 'https://www.aegee.org/external/key-to-europe/',
            title: 'Key to Europe',
            description: 'Yearbook - the annual report publication',
            color: '#4CA0FF'
          }
        ],
        'Members': [
          {
            url: '/pages/mailing-lists',
            title: 'Mailing lists',
            description: 'AEGEE mailing lists',
            color: '#FFDB4C'
          },
          {
            url: 'https://aegee.org/wiki',
            title: 'AEGEE Wiki',
            description: 'A collaborative knowledge backbone of AEGEE',
            color: '#FFDB4C'
          },
          {
            url: 'https://drive.google.com/drive/folders/1KtcEZspEAdKgzORqWjn_MNNl2eHK4Jks',
            title: 'AEGEE Materials Database',
            description: 'Knowledge library of AEGEE materials',
            color: '#FFDB4C'
          },
          {
            url: 'https://www.facebook.com/groups/aegeeans/',
            title: 'Facebook group',
            description: 'AEGEE\'s official group on Facebook',
            color: '#FFDB4C'
          },
          {
            url: 'https://www.zeus.aegee.org/magazine/',
            title: 'The AEGEEan magazine',
            description: 'AEGEE\'s online Magazine',
            color: '#FFDB4C'
          },
          {
            url: 'https://www.zeus.aegee.org/portal/wp-content/uploads/Strategic-Plan-2020-2023-updated.pdf',
            title: 'Strategic Plan',
            description: 'Strategic Plan of AEGEE-Europe 2020-2023',
            color: '#FFDB4C'
          },
          {
            url: 'https://site.aegee.org/wp-content/uploads/Action-Agenda-2020-2021.pdf',
            title: 'Action Agenda',
            description: 'Action Agenda 2020-2021',
            color: '#FFDB4C'
          },
          {
            url: 'https://aegee-academy.eu/request-a-training/',
            title: 'AEGEE-Academy',
            description: 'Request a trainer for your training events',
            color: '#FFDB4C'
          }
        ],
        'Statutory': [
          {
            url: 'https://www.zeus.aegee.org/statutoryvote/jc/',
            title: 'Online voting',
            description: 'Online Voting for Agorae/General Assembly',
            color: '#C44BC2'
          },
          {
            url: 'https://www.zeus.aegee.org/portal/category/jc/',
            title: 'CIA',
            description: 'Statutes, regulation, working formats and motions',
            color: '#C44BC2'
          }
        ],
        'Useful guides': [
          {
            url: 'https://www.zeus.aegee.org/portal/resources/pr-materials/',
            title: 'Visual identity',
            description: 'Manual, logos, PR materials and more',
            color: '#FF5543'
          },
          {
            url: 'https://www.zeus.aegee.org/portal/resources/internal-education/',
            title: 'Internal education',
            description: 'LTC and RTC packages.',
            color: '#FF5543'
          },
          {
            url: 'https://www.zeus.aegee.org/portal/resources/members-manual/',
            title: 'Members manual',
            description: 'Members Manual, guides etc.',
            color: '#FF5543'
          }
        ]
      }
    }
  }
}
</script>
