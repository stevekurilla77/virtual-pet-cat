# Sunbeam

A small virtual pet cat. Pick a coat, give them a name, and leave them in a sunny room. They wander, nap, groom, watch birds, and play when you do.

Sunbeam is a static site: no build step, no account, no ads, and nothing is sent off the phone. The cat you design is saved in `localStorage` on the device.

## Play

From this folder:

```bash
python3 -m http.server 8741
```

Open [http://127.0.0.1:8741/](http://127.0.0.1:8741/).

Any static file server works. The page uses ES modules, so open it over `http://` rather than as a `file://` URL. iPhone Safari and a desktop mouse are both supported. Hold the phone in portrait.

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
- Sound is synthesized in the browser. The speaker button mutes it. Press `M` on a keyboard.

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
| `js/audio.js` | Purr, meow, chirp, tweets |
| `js/util.js` | Small math helpers |
| `favicon.svg` | Icon |
