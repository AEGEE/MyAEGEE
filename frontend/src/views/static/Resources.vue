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
        External: [
          {
            url: 'http://aegee.org',
            title: 'AEGEE website',
            description: 'Official website',
            img: 'default-blue.png',
            color: '#1468C5'
          },
          {
            url: 'http://aegee.blogactiv.eu/',
            title: 'External blog',
            description: 'Blog hosted on Blogactiv platform',
            img: 'default-blue.png',
            color: '#1468C5'
          },
          {
            url: 'http://aegee.us7.list-manage.com/subscribe?u=7a170c64e0d3990f3f6629d21&id=fc8908d780',
            title: 'External newsletter',
            description: 'Bi-monthly newsletter for Partners & Supporters',
            img: 'default-blue.png',
            color: '#1468C5'
          },
          {
            url: 'https://www.aegee.org/external/key-to-europe/',
            title: 'Key to Europe',
            description: 'Yearbook - the annual report publication',
            img: 'none.png',
            color: '#1468C5'
          }
        ],
        Members: [
          {
            url: 'http://www.zeus.aegee.org/portal/',
            title: 'Internal news',
            description: 'Open calls and news from European Bodies',
            img: 'members-portal.png',
            color: '#FBBA00'
          },
          {
            url: 'https://lists.aegee.org/join/AEGEENEWS-L',
            title: 'Internal newsletter',
            description: 'Bi-weekly internal newsletter',
            img: 'default-yellow.png',
            color: '#FBBA00'
          },
          {
            url: 'http://www.zeus.aegee.org/magazine/',
            title: 'The AEGEEan magazine',
            description: 'AEGEE\'s online Magazine',
            img: 'none.png',
            color: '#FBBA00'
          },
          {
            url: 'http://aegee.org/wiki',
            title: 'AEGEE Wiki',
            description: 'A collaborative knowledge backbone of AEGEE',
            img: 'wiki.png',
            color: '#FBBA00'
          },
          {
            url: 'https://www.zeus.aegee.org/forum',
            title: 'Forum',
            description: 'Place for structured discussions ',
            img: 'default-purple.png',
            color: '#FBBA00'
          },
          {
            url: 'https://lists.aegee.org/?HOME',
            title: 'Mailing lists',
            description: 'AEGEE mailing lists',
            img: 'default-purple.png',
            color: '#FBBA00'
          },
          {
            url: 'https://www.facebook.com/groups/aegeeans/',
            title: 'Facebook group',
            description: 'AEGEE\'s official group on Facebook',
            img: 'facebook.png',
            color: '#FBBA00'
          },
          {
            url: 'https://site.aegee.org/wp-content/uploads/AEGEE-StrategicPlan-2020-2023.pdf',
            title: 'Strategic Plan',
            description: 'Strategic Plan of AEGEE-Europe 2020-2023',
            img: 'facebook.png',
            color: '#FBBA00'
          }
        ],
        Statutory: [
          {
            url: 'https://www.zeus.aegee.org/statutoryvote/jc/',
            title: 'Online voting',
            description: 'Online Voting for Agorae/General Assembly',
            img: 'none.png',
            color: '#A0C514'
          },
          {
            url: 'https://www.zeus.aegee.org/portal/new-cia-29-1/',
            title: 'CIA',
            description: 'Statutes, regulation, working formats and motions',
            img: 'none.png',
            color: '#A0C514'
          }
        ],
        'Useful guides': [
          {
            url: 'http://www.zeus.aegee.org/portal/resources/pr-materials/',
            title: 'Visual identity',
            description: 'Manual, logos, PR materials and more',
            img: 'default-red.png',
            color: '#C51C13'
          },
          {
            url: 'https://www.zeus.aegee.org/portal/resources/internal-education/',
            title: 'Internal education',
            description: 'LTC and RTC packages.',
            img: 'default-red.png',
            color: '#C51C13'
          },
          {
            url: 'https://www.zeus.aegee.org/portal/resources/members-manual/',
            title: 'Members manual',
            description: 'Members Manual, guides etc.',
            img: 'default-red.png',
            color: '#C51C13'
          }
        ]
      }
    }
  }
}
</script>
