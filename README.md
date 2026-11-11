# Sunbeam

A side-scrolling cat adventure, and the earlier quiet virtual pet.

The game at the root is a modern side-scroller. Pick a coat, then run, jump, and collect fish through the living room, the porch, the yard, and the neighbor’s house. Each level ends with the cat’s person. The original pet still lives at [pet/index.html](pet/index.html).

Sunbeam is a static site: no build step, no account, no ads, and nothing is sent off the phone. The cat you design is saved in `localStorage` on the device.

## Play

From this folder:

```bash
python3 -m http.server 8741
```

Open [http://127.0.0.1:8741/](http://127.0.0.1:8741/).

Any static file server works. The page uses ES modules, so open it over `http://` rather than as a `file://` URL. Hold the phone in landscape. Arrows or A and D move, space jumps, J scratches, and F casts the rod. The earlier pet is at `pet/index.html`.

## GitHub Pages

`index.html` is at the repository root and every asset path is relative, so a project site such as `https://<user>.github.io/virtual-pet-cat/` works without a build.

1. Push this folder to the repository.
2. In the repository settings, set Pages to deploy from the branch you want, with the root (`/`) as the folder.
3. Open the Pages URL on a phone.

## What’s in the room

- Choose boy or girl, short or long hair, a coat, eye color, and a name. The preview is the same cat you’ll meet in the room. Change the look later with the pencil button.
- Coats: orange tabby, brown tabby, gray, black, white, tuxedo, calico, tortoiseshell, Siamese, and cream.
- The cat wanders, naps in the sunbeam, grooms, stretches, stares out the window, gets the zoomies, and sits in the box.
- Birds land on the feeder. The cat chatters, wiggles, and pounces at the glass.
- Toys, along the bottom: feather wand, laser dot, yarn ball, petting, the couch, and the box. Drag on the floor, or tap once to leave the toy there for a couple of seconds. A long rub on the belly gets a playful grab. The first time you pick a drag toy, a short note says to drag on the floor.
- The couch is on the left. Tap it, or the scratch button, and the cat walks over, stands up, and scratches the arm. The fabric shows the marks. Sometimes the cat goes over on their own.
- Birds calls a flock to the window. Outside, the same button puts birds on the fence.
- A door on the left, or the Outside button, leads to the porch and garden once bond reaches 5. Settings can unlock everything sooner. Bond rises when you play, pet, watch birds, or scratch. Three small goals reset each day. All of that stays in `localStorage` on the phone.
- Long-press the cat’s name three times to show a small touch readout: the last event, where it landed, the selected toy, and where the cat is headed. Long-press again three times to hide it.
- Playful, sleepy, and happy shift what the cat does next.
- A very quiet lullaby plays under the room, and a lighter one under the garden. They crossfade at the door. The cat’s meow, purr, hiss, and the birds are real recordings. The speaker button mutes everything. Settings has separate music and effects sliders, and a credits page. Press `M` on a keyboard.

The layout respects the iPhone notch and home bar.

## Files

| Path | Role |
| --- | --- |
| `index.html` | Page shell |
| `css/game.css` | Layout, safe areas, picker, toy tray |
| `js/main.js` | Picker, saving, input, game loop |
| `js/game.js` | Cat life, toys, birds, moods |
| `js/draw.js` | Room, birds, toys |
| `js/kitten.js` | The cat, including the tail anchored to the rump |
| `js/coats.js` | Coats, eyes, saved cat |
| `js/poses.js` | Body poses |
| `js/audio.js` | Music, purr, meows, birds, scratch |
| `audio/` | Lullaby loops, plus `audio/real/` recordings |
| `js/util.js` | Small math helpers |
| `favicon.svg` | Icon |
| `tools/render_audio.py` | Regenerates the mp3s. The game does not run it. |

## Sound

The lullaby is about 48 beats a minute: long felt-piano notes, a soft pad, and lots of quiet. Outside, the same tune grows a few very light high tones. Music stays under the sound effects, and the music slider starts low.

On an iPhone, sound starts at the first tap. The page asks Safari to treat it as ambient audio, so the silent switch can quiet it. Music pauses when you leave the page and comes back when you return.

## Credits

The lullabies, the four adventure themes, the fishing sting, the victory fanfare, and the little hurt cue are original music made for Sunbeam. The scratch of claws is still made live in the browser.

Cat and bird recordings: "Weibliche Britisch Kurzhaar will Futter C1277 MIAUEN" by PantheraLeo1359531, CC BY 4.0, Wikimedia Commons. Additional recordings (CC0 / public domain) by Kerzoven, IgnasD, patchytherat, Tsester, George Miquilena, freemaster2, Luke100000, Adam Cuerden, Zabuhailo, Sadiquecat, simon.danielsson, FartMuffin, Shyamal, and Akum20, via OpenGameArt.org, Freesound.org, and Wikimedia Commons.
