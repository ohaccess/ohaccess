# ohACCESS — 90-Second Brand Film: Production Package

Welcome! This package contains everything you need to produce the film. The creative is finished — script, shot list, per-clip generation prompts, and voiceover copy are all written. Your job is execution: generate the clips, keep them visually consistent, assemble, and deliver.

## About the product (30-second context)

ohACCESS is a verified sign-in system for real estate open houses. Instead of a paper sign-in sheet, visitors scan a QR sign at the door, register on their phone with a real phone number and email, and receive a one-time **code word** by text and email. They say the code word to the agent to enter. Fake info = no code = no entry. The agent gets verified leads; the home seller gets a report proving the open house was worth it.

The film tells that story in 11 generated clips + 1 end card. No dialogue is heard clearly, no on-screen text in the generated footage — the voiceover carries the narrative.

## What's in this package

| File / folder | What it is |
|---|---|
| `01-shot-list-and-prompts.md` | All 12 clips with a ready-to-paste generation prompt per clip, plus a table mapping which reference images attach to which clip |
| `02-voiceover-script.md` | The full VO script, broken out per clip with timing |
| `references/` | Reference images (visitor, house, sign, paper sign-in sheet, logo) |
| `app-screens/` | Real screenshots of the ohACCESS product for the phone/laptop screens shown in the film |

## The one hard requirement: consistency

The same visitor (woman, long curly brown hair, olive tank/jacket), the same agent, the same house (modern farmhouse, "412", wood door, black A-frame sign), and the same sign must read as identical people/places across every clip they appear in. Reference images are provided for the visitor, house, and sign — attach them to every clip that features them, and do not let the model restyle them.

**Agent character:** we do not have a fixed reference photo for the agent. Establish your own consistent agent character (professional woman, warm presence) in Clip 1 and carry her identically through Clips 6, 7, 8, and 9. Generate a reference still of her first and reuse it.

## Style rules (apply to every clip)

- Photorealistic, cinematic, 35mm look, shallow depth of field, smooth slow camera moves
- Warm grade with deep near-black shadows and golden highlights (Clip 2 is the deliberate exception: cold, flat, harsh — the "old way")
- **No on-screen text overlays, no logos** in generated footage (the end card is built in the editor)
- Phone/laptop screens in shot must show the real app screens from `app-screens/` — never let the model invent UI

## Deliverables

1. Final master, ~95 seconds, 16:9, MP4 (H.264), 1920×1080 minimum (4K master welcome), web-optimized
2. Poster frame: one still (JPG/PNG, 16:9) chosen from the film for the website's video player
3. Voiceover: single clean take (ElevenLabs or equivalent — warm, confident, natural read; script in `02-voiceover-script.md`)
4. Sound design: ambient per the shot list; light music optional if it helps
5. Project files / EDL and the individual generated clips

## Process

1. First: generate Clip 1 and your agent-character reference still → send for approval before proceeding (this locks look and characters)
2. Then: all 11 clips as a rough assembly with scratch VO
3. Revision round(s) per our agreement
4. Final delivery per above

Questions welcome — ask early, especially about anything in the app screens you're unsure about.
