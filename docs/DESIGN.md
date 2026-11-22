# Design System: Engklek

Engklek is the Indonesian hopscotch that children play one step at a time. Each tile is a real step or stage, and Pipit, a small sparrow, hops to the tile the child is on.

## Principles

- Every screen has one obvious next action.
- Caregivers and children use separate spaces, Ruang Pendamping and Ruang Anak.
- Tasks show objects and sound before text.
- Mistakes are safe: no red crosses, scores, or failure language.
- Progress uses real data and stays separate per skill.

## Tokens

| Role | Value |
|---|---|
| Nila (indigo), primary | `#1F2559`, `#333C8F`, `#5561C4`, `#C5C9EE`, `#E6E8F8` |
| Paper background | `#F6F6FB` |
| Slate, neutral surfaces | `#5B5E73`, `#A6A9BC`, `#DCDEE9`, `#EDEEF4` |
| Coral, the current step and main action | `#FF9E80`, `#FFE0D6` |
| Daun (leaf), done states | `#1F6B4F`, `#2F8F6B`, `#CFEFE1` |
| Ink | `#171B3D` |

**Type:** Lexend, bundled for offline use and designed for reading fluency. Left aligned and sentence case.

**Shapes:** square tiles with ink outlines, hard offset shadows, and a dashed chalk line between steps.

**Targets:** 48px for caregivers and 64px for children.

## Responsive layouts

| Device | Width | Layout |
|---|---|---|
| Phone | Under 640px | One column, bottom navigation |
| Phone in landscape | Height up to 520px | Prompt and answer side by side, compact controls |
| Tablet | 640 to 1023px | Full-width content, larger answers, two-column child map |
| Small laptop | 900px and up | Top navigation in the caregiver space |
| Laptop and desktop | 1024px and up | Full-screen split layouts for setup, child map, and practice |
| Wide desktop | 1200px and up | "Hari ini" adds a side column for schedule and journey |

## Motion

Motion is used for press feedback, orientation, and Pipit's hop. It runs on `transform` and `opacity`, never blocks input, and has no ambient loops. With the OS reduced-motion setting or the child's preference, movement is replaced by a short fade.

## Audio

Speech uses Indonesian audio files shipped with the app, so it does not depend on voices installed on the device. See the README for adding clips.
