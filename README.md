# LIFESONG — Social Karaoke

A static A-Frame karaoke prototype for desktop, phone, tablet and compatible WebXR headsets. Each visitor plays an independent local game. There are no accounts, rooms, networking or shared scores.

## Hosting

1. Extract **all** of `center-stage-vr.zip` into a folder.
2. Upload the whole folder to your web server, preserving the `assets/` and `vendor/` directories.
3. Visit the folder's `index.html` URL. A subfolder such as `/karaoke/` works without changing paths.
4. Use **HTTPS** for public hosting. WebXR and microphone features require a secure context and a compatible browser. Normal mouse/touch play works without VR or a microphone.

When replacing an older build, upload `index.html` as well as its scripts and styles. Changed assets use versioned URLs to avoid stale browser caches. If the server caches the HTML itself, do a hard refresh after uploading.

No build step, npm install, database or application server is needed. A-Frame, its text atlas and the supplied MP3 are included locally. Optional speech recognition may use the browser provider's online service.

For a desktop preview with Python installed, open a terminal in the extracted folder:

```sh
python -m http.server 8000
```

Then open `http://localhost:8000`. For Quest 3, open your **HTTPS hosted URL** in its headset browser. An HTTP URL on another computer's LAN is usually not a secure context for WebXR.

Serve `.js`, `.css`, `.json`, `.png`, `.svg` and `.mp3` normally. Recommended MIME types are `text/javascript`, `text/css`, `application/json`, `image/png`, `image/svg+xml` and `audio/mpeg`. Do not rename scripts or extract only the HTML file.

## Playing

- Press **Play**. The actual MP3 playback time drives lyrics, highlights, scoring and progress.
- Each lyric hides one keyword. Match the sung word with one of three buttons, or keys **1 / 2 / 3**.
- A correct match earns **100 points**; a match within 0.9 seconds of the keyword's timing earns **250**.
- Four consecutive matches unlock the next multiplier; the fifth hit scores at ×2, ninth at ×3, thirteenth at ×4. A missed or incorrect line resets the streak.
- One attempt per line prevents repeated clicks from farming points. Restart clears the song and score.
- **Space** toggles playback. **WASD / arrows** move on the stage; drag to look around.
- The demo leaderboard has three simulated competitors. Only your own score is interactive. These are labelled demo players, not connected users.
- Settings lets you change your performer name and shift the lyric timing by ±5 seconds. Changing timing clears your score to keep the current attempt consistent.

## Microphone mode

Mic mode is optional. In browsers exposing `SpeechRecognition` or `webkitSpeechRecognition`, enable **Mic**, allow microphone access and sing or say the line. A match needs the hidden word plus at least two distinct context words from the current line.

This is **word recognition**, not pitch, melody or vocal-quality grading. Recognition of singing is less reliable than speech. Use headphones: speaker playback can otherwise be mistaken for your voice. The microphone stops when the song pauses and resumes on playback while mic mode remains enabled. Disable it to stop listening. Recognition errors fall back to tap matching. Firefox and some mobile/headset browsers may have no compatible recognition API; the word buttons remain playable.

## VR controls

The lyric board, score, word choices, Play/Pause, Restart and Mic buttons are inside the 3D scene. Point either controller's ray and press its trigger. If no tracked controllers are present, look at a button for 1.3 seconds to select it. Thumbsticks move within the stage.

The desktop HTML overlay is hidden during immersive VR. The rig starts on the stage surface at y=0.45, and the desktop camera is 1.6 m above that surface. In local-floor VR, the headset supplies its tracked height. The boundary clamps the actual camera world position, including room-scale headset offsets, to a 3.25 m radius.

## Song and lyric cues

The supplied **Sunny Side Up.mp3** is included as `assets/sunny-side-up.mp3`, unmodified. Duration is approximately **3:01**. The track's embedded lyrics include a **Final Chorus**, so the prototype includes that additional repeat before the outro. The chorus display follows the track's “I'm waking up…” wording.

`song.js` holds 47 lyric lines, section labels, starts, ends and individual `wordTimes` in seconds. Cues were generated from local alignment of the audio and supplied lyrics, with section-onset refinements. They are prototype timing data, not a manually verified studio lyric track. Sung runs, repeats and backing vocals may need small timing edits. Use the settings offset for a global adjustment, or edit the individual cues for precise alignment. **Download lyric timing file** exports `song.js` with your chosen offset; replace the hosted copy to retain it.

To change a line, keep `wordTimes.length` equal to the number of whitespace-separated words, set increasing word times, keep all word times inside its start/end window, and prevent adjacent lyric windows from overlapping. `targetIndex` identifies the missing word (zero-based).

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Scene and accessible desktop/mobile UI |
| `styles.css` | Responsive karaoke layout |
| `stage.js` | Stage, elevated sun and clouds |
| `crowd.js` | 84 animated instanced people, six nameplates and score celebrations |
| `movement.js` | Keyboard/XR movement and stage boundaries |
| `game.js` | Playback, scoring UI, speech matching and VR controls |
| `game-core.js` | Timing and scoring rules |
| `song.js` | Lyric text, keyword choices and word timings |
| `assets/` | Supplied song and original SVG artwork |
| `vendor/` | A-Frame 1.8.0, local Roboto text atlas and licences |

## Validation and limits

Verified script syntax, all 47 cue windows, word-time ordering, score multipliers, one-attempt protection, pause/restart behaviour, DOM and VR button actions, forward movement, room-scale boundary correction, 84 finite crowd animation matrices and six nameplates. The packaged MP3 decodes and the HTML assets resolve through a static server.

The cloud browser could not access the local preview address, so final rendered appearance, live microphone recognition and headset performance remain device checks. The scene uses lightweight primitive geometry and instancing; no scene `.glb` models are required. The framework may fetch built-in controller models when entering VR; the scene and controls work without those decorative models.

A-Frame is distributed under its included MIT licence. Roboto is distributed under its included Apache 2.0 licence. The bundled framework contains additional dependency licences in its distribution.
