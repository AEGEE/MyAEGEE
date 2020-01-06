<template>
  <div class="jumbotron" style="text-align: center;">
    <router-link class="button is-primary" :to="{ name: 'oms.alastair.organizer.myevents' }">My Events</router-link>

    <article class="message is-info">
      <div class="message-body">
        Here you can see the events that you are organizing. Currently you can not share organization with others and also you have to manually create events, in the future we will try to import them from oms-events.
      </div>
    </article>

    <article class="message is-info">
      <div class="message-body">
        Per event you can see a shopping list and meals. Each meal accomodates an arbitrary number of recipes, so you can design a meal to fit guests with different preferences. Per recipe you can specify the number of people you want to feed with this part of the meal and Alastair will automatically calculate the amounts fitting to this.
      </div>
    </article>

    <article class="message is-info">
      <div class="message-body">
        When you've done all this alastair will provide you with a shopping list with exact prices and pretty overview pages with the recipes. In the shopping list you can edit your choice of items in case there are several and you can tick bought items.
      </div>
    </article>
  </div>
</template>
