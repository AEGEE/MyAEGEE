<template>
  <div class="jumbotron" style="text-align: center;">
    <router-link class="button is-primary" :to="{ name: 'oms.alastair.shop.list' }">Shops</router-link>

    <article class="message is-info">
      <div class="message-body">
        You made it to the disgusting part of Alastair. Somehow this app needs to know what the prices are for the ingredients, so it can calculate a price for you. Pray to god someone already copied all the prices from a nearby supermarket, otherwise you are up for some serious fun now -you may match each ingredient with a shopping item from that store. If you want to see the shopping list, go to the event page you want to see it for.
        Each shop has a number of shop admins, which are entitled to edit the details and shopping items in that shop, however everyone is able to use any shop for his project to calculate the food. In case you are using a shop which you can not edit, please bear in mind that other admins could remove or edit items and thus outdate your calculated price.
      </div>
    </article>    

    <article class="message is-info">
      <div class="message-body">
        In the not so near future I am planning to automatize this part with some machine learning, but for now, if you want to use this tool, you have to bite the bullet and spend 2 hours in a shop, copying prices :P
      </div>
    </article>

  </div>
</template>