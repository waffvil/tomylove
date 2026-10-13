# For My Love ♡

A tiny Y2K corner of the internet with all the little apps I make for her.

**Live:** https://waffvil.github.io/tomylove/

- 📷 [photobooth](https://waffvil.github.io/photobooth/)
- 🌫️ [fogged glass](https://waffvil.github.io/mv_screen_fog/)
- 💌 [M ♡ V](https://waffvil.github.io/mimaimo-wurong/) (the "you've got mail" button)

## The girls' house

`house.html` (the ⤢ button on the nursery) is a little side-view dollhouse where
Mivi, Vimi and Teddy live their own lives: they eat, nap, watch tv, read, paint,
water the flowers, swing, play ball and chat, depending on how hungry, sleepy,
bored and loved they are. It follows the real clock (bedtime is 10pm to 7am),
remembers everything in the browser, and shares bedtime with the nursery.
Their sprites and lines live in `kids.js`, shared by both pages.

## Adding a new app

In `index.html`, copy one `<a class="app">` card in the apps grid, change the link,
icon and words, and add a matching line to the start menu (`#startMenu`).

The love notes and "can't close this window" lines are the `NOTES` and `NOPES`
arrays at the top of the script.
