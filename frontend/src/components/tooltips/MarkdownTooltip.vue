<template>
  <tooltip
    text='The input field above accepts Markdown, here are some basic functions:

    &nbsp;- Placing "\*" around a word makes it *italic*

    &nbsp;- Placing "\*\*" around a word makes it **bold**

    &nbsp;- Placing a "\#" before a sentence makes it appear bigger

    &nbsp;- A link can be made by typing it like "\[text to display\]\(URL\)"

    &nbsp;

    More information can be found by searching for Markdown online'>
  </tooltip>
</template>

<style>
  .tooltip-inner > .markdown > p > strong {
    color: white;
  }
</style>
