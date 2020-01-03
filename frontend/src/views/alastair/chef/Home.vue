<template>
  <div class="jumbotron" style="text-align: center;">
    <router-link class="button is-primary" :to="{ name: 'oms.alastair.chef.ingredient.list' }">Ingredients</router-link>

    <article class="message is-info">
      <div class="message-body">
        Here you can see the list of ingredients registered in the system. Ingredients are managed by <b><router-link :to="{name: 'oms.alastair.chef.admins'}">Alastair-Admins</router-link></b> and you can not change them yourself. This is to avoid cluttering the database with non-english or duplicate records. If an ingredient is missing, contact one of the admins to add it for you.
      </div>
    </article>
   

    <router-link class="button is-primary" :to="{ name: 'oms.alastair.chef.recipe.list' }">Recipes</router-link>
    <article class="message is-info">
      <div class="message-body">
        Check out the recipes in the system! Recipes are only visible here and can only used for food planning when they were published, to see unpublished recipes go to <b><router-link :to="{name: 'oms.alastair.chef.recipe.list', params: {which: 'mine'}}">my recipes</router-link></b>
      </div>
    </article>
  </div>
</template>