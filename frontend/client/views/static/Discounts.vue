<template>
  <div class='tile is-ancestor discounts'>
    <div class='tile is-parent is-vertical'>
      <section v-for="block in discounts" v-bind:key="block.name">
        <div class="title">{{ block.name }}</div>

        <div class="collapse is-fullwidth">
          <div class="discounts-item" v-for="discount in block.children" v-bind:key="discount.title">
            <div class="card collapse-item" :class="{ 'is-active' : discount.expanded }">
              <header role="tab" class="card-header touchable" @click="discount.expanded = !discount.expanded">
                <div class="card-header-icon">
                  <i class="fa" :class="discount.icon" />
                </div>
                <div class="card-header-title">
                  <span> {{ discount.title }}: <span class="not-bold">{{ discount.shortDescription }}</span></span>
                </div>
                <span class="card-header-icon">
                  <i class="fa fa-angle-down" v-show="discount.expanded"></i>
                  <i class="fa fa-angle-up" v-show="!discount.expanded"></i>
                </span>
              </header>
              <div class="card-content" v-show="discount.expanded">
                <div class="card-content-box" v-html="discount.fullDescription"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div class="control">
          <router-link class="button is-primary" :to="{ name: 'oms.discounts.my_discounts' }">My codes</router-link>
        </div>
      </section>
    </div>
  </div>
</template>

<style>
.discounts .discounts-item:last-child {
  margin-bottom: 50px;
}
.discounts .discounts-item .card-header-icon {
  width: 48px;
  text-align: center;
}
.discounts .not-bold {
  font-weight: normal;
}

.discounts .card-header {
  cursor: pointer;
}
</style>

<script>
export default {
  data () {
    return {
      discounts: [{
        name: 'FEATURED PARTNERS',
        children: [
          {
            expanded: false,
            icon: 'fa-graduation-cap',
            title: 'EDUopinions',
            shortDescription: 'Rate your University in 3 minutes and help AEGEE-Europe!',
            fullDescription: '<b>Give your opinion about your University</b></a> (it doesn\'t matter if you already graduated or still study there) in just 3 minutes and help AEGEE-Europe raise some money! Make sure you mention how AEGEE local influenced your student life. <br />If you studied in more than one university, you can rate all of them by using the incognito mode of your browser or using different devices (phone, laptop etc).<br />Feel free to <a href=\'https://www.aegee.org/eduopinions\'><b>share the link</b></a> with your friends and invite them to rate their university as well!<br> <em>With every review, you support AEGEE-Europe.</em>'
          }
        ]
      },
      {
        name: 'DISCOUNTS FOR AEGEEANS',
        children:
        [
          {
            expanded: false,
            icon: 'fa-bus',
            title: 'FlixBus',
            shortDescription: 'Bus company | 10% Discount',
            fullDescription: 'Get your <a href="https://my.aegee.eu/discounts/my"><b>10% FlixBus discount</b></a> codes. You can get 2 codes per month of 10% discount each.'
          },
          {
            expanded: false,
            icon: 'fa-truck',
            title: 'Eurosender',
            shortDescription: 'Door to door shipping service | 10% Discount',
            fullDescription: 'Get your <b>10% Discount</b> with the <b>code \'AEGEE10\'</b> (without apostrophes) when ordering in <a href="https://www.eurosender.com"><b>Eurosender</b></a>. Valid for all orders over 5€.<br><em>With every purchase using this discount code, you support AEGEE-Europe.</em>'
          },
          {
            expanded: false,
            icon: 'fa-home',
            title: 'Spotahome',
            shortDescription: 'Find your new home | 25% Discount on the fee',
            fullDescription: 'Get your <b>25% Discount</b> on the <a href="https://www.spotahome.com/?utm_campaign=MT&utm_medium=pdf&utm_source=aegee"><b>Spotahome</b></a> fee with the <b>code \'AEGEESAH25\'</b> (without apostrophes).<br><em>With every purchase using this discount code, you support AEGEE-Europe.</em>'
          },
          {
            expanded: false,
            icon: 'fa-dollar-sign',
            title: 'N26',
            shortDescription: 'Online banking with no fees and free Mastercard | 5€ for free for new accounts',
            fullDescription: 'Get your <a href="https://www.zeus.aegee.org/discount/N26/"><b>5€ for free</b></a> for opening a new bank account in 15 minutes from home - with no hidden fees and no fees for exchanging currency, a Mastercard and a very cool app! You can get only 1 code, and you have to use it while creating the new account. <br>You will get the 5€ extra credit once you deposit at least 0,01€ in your new account.<br><em>With every new account created through <a href="https://n26.go2cloud.org/aff_c?offer_id=16&aff_id=1702"><b>this link</b></a>, you support AEGEE-Europe.</em>'
          },
          {
            expanded: false,
            icon: 'fa-bed',
            title: 'Booking.com',
            shortDescription: 'Accommodation for short term | Genius 10% discount + perks',
            fullDescription: 'Get your <a href="https://secure.booking.com/enterprise/signon.en-gb.html?aid=304142;label=gen173nr-1FCAEoggJCAlhYSDNYBGgViAEBmAEuwgEKd2luZG93cyAxMMgBDNgBAegBAfgBDJICAXmoAgM;sid=add3d4b4b83cf90c8e3f055d5f55e404;lang=en-gb;token=cee63b95918444a2&"><b>AEGEE Booking account</b></a> to get the Genius status automatically! <br> The Genius status grants you a <b>10% discount</b> in all accommodation tagged with the Genius sticker. You also get some free perks like a cocktail on arrival or free airport shuttles, depending on the accommodation.<br> You need to register with your @aegee.org email. If you don\'t have one and would like to get one, <a href="https://www.oms.aegee.org/wiki/index.php?title=Mail#Aliases"><b>follow this guide</b></a>.'
          },
          {
            expanded: false,
            icon: 'fa-pencil-alt',
            title: 'Neuland',
            shortDescription: 'Markers and materials for workshops | 10% Discount',
            fullDescription: 'Get your <b>10% Discount</b> on all products of <a href="https://www.neuland.com"><b>Neuland</b></a>. In order to apply the codes, you must <a href="https://drive.google.com/file/d/14yCTbuW8ro4bQNnQTdfQzoSIHehR8A2w/view?usp=sharing"><b>follow these instructions</b></a>. <br> Discount code for European Union: 85f2e7980e2<br> Discount code for outside European Union: e2fd6e6d552 '
          }
        ]
      },
      {
        name: 'OPPORTUNITIES AND TOOLS FOR AEGEEANS',
        children:
        [
          {
            expanded: false,
            icon: 'fa-comment-alt',
            title: 'Slido',
            shortDescription: 'Interact with your audience | PRO account',
            fullDescription: '<a href="https://www.slido.com">Slido.com</a> is an original, organized and impressive way to interact with your audience.<br>You create an event, and then people can easily join that live with their phones. While you\'re screening with a beamer, people see questions on their phone and can answer openly, choose from multiple choice and even ask questions to the speakers themselves. Everything is updated live on the screen immediately, and there are many possibilities to increase the participation of your audience as you can see in this <a href="https://www.sli.do/assets/videos/polls.webm?v=571a832">short animation</a>.<br> Slido has a <a href="https://www.sli.do/pricing">free version</a>, but we have access to 5 accounts at once for the PRO version. If the basic free version is enough for your event because you want to moderate or ask more than 3 questions, then you can make your own account and start using it to interact with your participants. If you would like to use more features, then you can <a href="http://bit.ly/aegeeslido"><b>fill in this form</b></a> requesting a PRO account for the limited time of your event (and some extra days to prepare). Once your request is approved, you will get an email.<br> We encourage you to use Slido in events such as conferences or big workshops where it\'s hard to interact with large audiences in a more personalized way.'
          },
          {
            expanded: false,
            icon: 'fa-microphone',
            title: 'Catchbox',
            shortDescription: 'World\'s first soft throwable microphone | Lend them from AEGEE-Europe',
            fullDescription: '<a href="https://www.getcatchbox.com">Catchbox</a> sponsored AEGEE with 3 Catchbox Lite and 1 Pro. Catchbox is great to efficiently interact with your audience, by throwing the microphones. If you would like to lend one for your conference/big event, contact <a href= "mailto:headoffice@aegee.org"> headoffice</a> asking with at least 1 month in advance.'
          }
        ]
      }]
    }
  }
}
</script>
