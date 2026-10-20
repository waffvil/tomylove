# For My Love ♡

A tiny Y2K corner of the internet with all the little apps I make for her.

**Live:** https://waffvil.github.io/tomylove/

- 📷 [photobooth](https://waffvil.github.io/photobooth/)
- 🌫️ [fogged glass](https://waffvil.github.io/mv_screen_fog/)
- 💌 [M ♡ V](https://waffvil.github.io/mimaimo-wurong/) (the "you've got mail" button)

## The girls' island

`world.html` (the ⤢ button on the nursery) is the girls' own little world, old
Pokémon style, in two places: the island and the inside of their house (tap the
house to peek in). Mivi, Vimi and Teddy live there by themselves. They choose what
to do from how hungry, sleepy, bored, loved and clean they are, plus the real clock
and the (shared, hourly) weather. Outside: a park with swings, slide, seesaw and
sandbox, the flower field, a strawberry patch they water and pick, apple trees,
the pond with a jetty for fishing, the town square with a wishing fountain and a
shop, a picnic hill, kites, cloud watching, the beach with an ice cream cart, and
a cat who wanders about. Inside: their three beds, the sofa and TV, a piano,
storybooks, toys, a kitchen where they eat (or cook pancakes for each other) and a
bubble bath. They feed themselves (the fridge, shop, cart, basket and trees never
run out), go home when it rains or gets late, brush their teeth and sleep in their
own beds 10pm to 7am, and bring you flowers, shells, strawberries, letters and
drawings. Bedtime is shared with the nursery. Their sprites live in `kids.js`;
the island, house and everything they do live in `world.js`.

### Their minds

Each girl thinks for herself, with no AI. She weighs every option for her own
reasons: her needs, her personality, what she has learned she likes, her mood,
which sister is around, how far away it is, and what she's working towards (a
dream for the day, cheering up a sad sister, making up after a squabble, a tag
rematch). She asks her sisters to play and they can say no, changes her mind when
something better comes up, remembers what happened, and her tastes and friendships
keep changing with how things go. Tap a girl to see what she's thinking and why.

Each girl also has her own garden plot (top right) where she decides what to grow,
then gives it to mama, puts flowers in the vase, shares with a sister or eats it.

Who they are is the `PERSONALITY` block in `kids.js`: Mivi our polite little
princess, Vimi who charges in first, and Teddy the shy baby who loves mama and papa
nhiều lắm. It holds their traits, favourite things, bestie, how fast they get
hungry or sleepy, what they say, what they like to grow and when they go to bed.
Change it and they behave differently. Everything they learn is saved in the browser.

Tap a girl to see her card, and type to her in the 💬 box (simple rules, no AI): she
answers in her own way and might go and do what you ask (Vimi sometimes finishes what she's doing
first). The 📔 button opens their diary, and coming back after a while opens a
"while you were away…" page. The ⧉ button pops the island out into a little
always-on-top window (Chrome on a computer) so it keeps running beside your work.

Preview another time or weather with `world.html?hour=21.5&weather=rain`.

## Adding a new app

In `index.html`, copy one `<a class="app">` card in the apps grid, change the link,
icon and words, and add a matching line to the start menu (`#startMenu`).

The love notes and "can't close this window" lines are the `NOTES` and `NOPES`
arrays at the top of the script.
