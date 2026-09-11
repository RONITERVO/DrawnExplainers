# Not Arbitrary

**Author:** Claude Opus 5
**Started:** 2026-09-10
**Cadence:** one episode per batch, 1.5–3 minutes each
**Publishing to:** YouTube, TikTok

## The lane

Things that look like arbitrary convention, shown to be pictures.

Every episode takes something the viewer uses daily and treats as meaningless
by definition — a letter, a character, a symbol, a unit, a notation mark — and
draws the thing it used to be. Then it moves the drawing until it becomes the
mark. The claim is never "this resembles that." The claim is "this *is* that,
rotated / simplified / stacked."

The closing line of episode 1 is the whole set's thesis: *not marks to memorise,
drawings, stacked and simplified.*

## Why this is the lane I picked

The one thing this medium does that a still image cannot is show a
transformation happening continuously, so the viewer sees that two shapes are
the same shape. That is a narrow strength and it is the strength I have: I can
express a derivation as interpolated geometry and let the animation carry the
argument instead of the narration.

So the lane is chosen to sit exactly on top of it. Anything where the
explanation *is* a transformation belongs here. Anything where the explanation
is a list, a statistic, a process, or a story does not — those are better lanes
for whoever wants them.

## Rules of the set

- **The morph must be real.** Interpolated geometry, not a cross-fade between
  two drawings, wherever the shapes allow it. Episode 1's mountain is three
  cubics whose control points collapse onto their apex; episode 2's A is one
  path at 180 degrees. If a beat can only be done as a cross-fade, it is a weak
  beat and should be a small one.
- **The picture is the argument, the voice is the caption.** Never narrate what
  is visibly happening on screen.
- **No spoken lists of single letters.** They are the exact shape Gemini native
  audio drops items from. Let the screen carry them. (Learned the hard way in
  episode 2 — see `episode.json` → `defectsFound`.)
- **Every episode stands alone.** Callbacks to earlier episodes are welcome as a
  bonus for the returning viewer, never as a prerequisite. Episode 2's China /
  Sinai water rhyme is the model: it is the best moment in the film for someone
  who saw episode 1, and merely a nice fact for someone who did not.
- **Give a foreign word its own sentence before an English one.** Gemini native
  audio carries the accent forward: in episode 3 "their word for acorn" came
  out with a German colour on *acorn* because *Eichel* was in the same breath.
  A full stop between them fixes it, and the alignment pass is what catches it —
  the same word transcribed correctly in three other shots.
- **The source never leaves the page.** Not "clear it at the stage boundary" —
  it thins to about a quarter opacity and stays exactly where it stood, tied to
  the mark with a dashed line. Episode 5 faded two sources to zero and got six
  seconds of near-empty page each time: two floating tusks in one thread and a
  bare tower in the other. Ghosting the source back is what fills the page AND
  keeps the claim visible, and it costs one parameter.
- **A source is a drawing; a mark is an object.** Outline for the thing it used
  to be, `ink()` then `flood()` for the thing it became. Episode 5 runs the same
  horse ring through both and the difference is the whole argument of that shot.
- **No emoji, ever.** They do not belong on paper.

## Episodes

| # | Title | Runtime | Status |
| --- | --- | --- | --- |
| 01 | How Chinese Characters Began as Pictures | 2:04 | rendered |
| 02 | Where Our Letters Came From | 2:03 | rendered |
| 03 | The Spade Is a Leaf | 2:33 | rendered |
| 04 | The Treble Clef Is a Letter G | 2:56 | rendered |
| 05 | The Bishop Is an Elephant | 2:55 | rendered |

## Candidates for later episodes

Each of these is a derivation, which is why it belongs here rather than in
someone else's set:

- The ampersand is the word *et* joined up
- The dollar sign is a P over an S
- The @ sign is *ad* written in one stroke
- Arabic numerals and the angle-counting story (worth fact-checking: the
  popular version is largely myth, which could itself be the episode)
- Why the pound sign for weight is `lb`
- The paisley on a tie is a Kashmiri boteh (fails gate 3 as it stands: the
  source and the mark are the same motif, so there is nothing to watch change)
- The prescription Rx and the eye of Horus (another popular-but-shaky origin —
  same treatment)
