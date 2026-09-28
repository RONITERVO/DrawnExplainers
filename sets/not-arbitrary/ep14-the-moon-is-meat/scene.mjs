// Not Arbitrary, episode 14 — the moon in 'liver' is meat.
//
// 月 is three different pictures squeezed into the same four strokes: the
// moon itself; a slice of meat, which is why so much of the body is written
// with it (肝 liver, 肺 lung, 肘 elbow, 腹 belly); and a boat, in 前 'in front'
// - a foot standing in a boat - and in 朕, the emperor's 'I'. Han clerks
// squeezed them together in the second century BC. The Kangxi Dictionary of
// 1716 still printed three versions; China and Japan made them identical in
// the twentieth century, in the meat's shape, and Taiwan and Hong Kong still
// print the meat apart.
//
// Every 月 and every picture comes from strip-moon.mjs, and 前 from
// strip-front.mjs. The glyphs set in a font are the ones the argument does not
// depend on: the four body-part words, 朕, and the two names of the meat.

import {
  P, ink, text, write, clipTo, createFilm, lerp, ramp, clamp01, easeInOut, travel,
  INK, INK_SOFT, RED, GOLD, CJK, HANGUL,
} from '../../../lib/scene-kit.mjs';
import { yue, printed } from './strip-moon.mjs';
import { front } from './strip-front.mjs';

const film = createFilm(import.meta.url);
export const { TOTAL_MS, FPS, SHOTS } = film;
const { beat, shotStart } = film;

const S = {
  hook: 's01.hook', three: 's02.three', moon: 's03.moon', frame: 's04.frame', meat: 's05.meat',
  body: 's06.body', boat: 's07.boat', front: 's08.front', clerks: 's09.clerks', emperor: 's10.emperor',
  dict: 's11.dictionary', today: 's12.today', names: 's13.names', recap: 's14.recap', close: 's15.close',
};

// Copies fade up out of their source over this much of their move (see
// travel() in lib/scene-kit.mjs); these moves are short, as in episode 12.
const EMERGE = 0.35;

const label = (t, from, s, x, y, size = 38, color = RED) => text(s, { x, y, size, color, p: ramp(t, from, 440) });
const caption = (t, from, s, x, y, size = 30) => text(s, { x, y, size, color: INK_SOFT, p: ramp(t, from, 560) });
const tie = (x0, y0, x1, y1, p, opacity = 0.5, color = INK_SOFT) =>
  ink(new P().M(x0, y0).L(x1, y1), p, { w: 3, color, dash: '10 9', opacity });
const fade = (o, inner) => (o <= 0.001 ? '' : `<g opacity="${clamp01(o).toFixed(3)}">${inner}</g>`);
const box = (x0, y0, x1, y1) => new P().M(x0, y0).L(x1, y0).L(x1, y1).L(x0, y1).Z();

/** A character set in the CJK font, written in, with its left part - the meat - overlaid in red. */
function word(ch, x, y, size, p, red = 0, frac = 0.44) {
  const base = write(ch, { x, y, size, p });
  if (red <= 0.001) return base;
  const x0 = x - size * 0.56, x1 = x - size * 0.5 + size * frac;
  return base + fade(red, clipTo([box(x0, y - size * 0.95, x1, y + size * 0.3)], write(ch, { x, y, size, color: RED })));
}

// ------------------------------------------------ the hook, and the columns
// The four words open the film, then shrink to a row along the foot of the
// page, where they wait for the meat to come back to them. The one 月 above
// them splits into three identical copies, and each column gets its picture.
const BODY = [['肝', 'liver', 0.44], ['肺', 'lung', 0.44], ['肘', 'elbow', 0.47], ['腹', 'belly', 0.4]];
const BIG = { xs: [540, 820, 1100, 1380], y: 690, size: 200 };
const ROW = { xs: [735, 885, 1035, 1185], y: 912, size: 92 };
const COLS = [500, 960, 1420];
const PIC_Y = 365, YUE_Y = 675, R = 0.85;
const PICS = ['moon', 'meat', 'boat'];
const TITLES = ['the moon', 'meat', 'a boat'];

function stageColumns(t) {
  const out = [];

  // The words, written in one after another, then shrunk into the row.
  const shrink = easeInOut(ramp(t, shotStart(S.three) - 100, 1300));
  const red = ramp(t, beat(S.hook, 'moon'), 700);
  const wordAt = [shotStart(S.hook), beat(S.hook, 'lung'), beat(S.hook, 'elbow'), beat(S.hook, 'belly')];
  BODY.forEach(([ch, gloss, frac], i) => {
    const x = lerp(BIG.xs[i], ROW.xs[i], shrink), y = lerp(BIG.y, ROW.y, shrink);
    out.push(word(ch, x, y, lerp(BIG.size, ROW.size, shrink), ramp(t, wordAt[i], 1100), red, frac));
    out.push(fade(1 - ramp(t, shotStart(S.three) - 100, 500), caption(t, beat(S.hook, gloss), gloss, BIG.xs[i], 790, 38)));
  });

  // The character for the moon, named, then struck: none of them is the moon.
  const one = ramp(t, beat(S.hook, 'character'), 1300);
  const named = ramp(t, beat(S.hook, 'moon'), 500);
  const struck = ramp(t, beat(S.three, 'moon'), 450);
  const gone = 1 - ramp(t, beat(S.three, 'moon') + 650, 450);
  out.push(fade(gone, text('moon', { x: 1112, y: 318, size: 44, color: INK_SOFT, p: named })
    + ink(new P().M(1052, 304).L(1174, 300), struck, { w: 5, color: RED })));

  // Down into the middle column, then two copies slide out of it.
  const down = easeInOut(ramp(t, beat(S.three, 'moon') + 900, 1100));
  const split = easeInOut(ramp(t, beat(S.three, 'different'), 1300));

  // Each column: its 月 dims when its picture arrives, the picture is drawn
  // above, and a copy of it drops into the 月 while the picture stays behind.
  const dimAt = [beat(S.moon, 'first'), beat(S.meat, 'second'), beat(S.boat, 'third')];
  const drawAt = [beat(S.moon, 'moon'), beat(S.meat, 'piece'), beat(S.boat, 'third') + 200];
  const titleAt = [beat(S.moon, 'first'), beat(S.meat, 'meat'), beat(S.boat, 'boat')];
  const dropP = [
    ramp(t, beat(S.frame, 'script'), 5200),
    ramp(t, beat(S.meat, 'squeezed'), beat(S.meat, 'matched') - beat(S.meat, 'squeezed')),
    ramp(t, beat(S.boat, 'long'), 2600),
  ];
  PICS.forEach((name, i) => {
    const x = COLS[i];
    const e = easeInOut(dropP[i]);
    // The waiting 月.
    let wx = x, wy = YUE_Y, wR = R, wo = 1;
    if (i === 1) { wy = lerp(300, YUE_Y, down); wR = lerp(0.8, R, down); }
    else { wx = lerp(COLS[1], x, split); wo = clamp01(split / EMERGE); }
    wo *= lerp(1, 0.28, ramp(t, dimAt[i], 600));
    if (e < 0.999 && wo > 0.001 && (i === 1 || split > 0)) {
      out.push(printed('modern', { cx: wx, cy: wy, R: wR, opacity: wo, draw: i === 1 ? one : 1 }));
    }
    // The picture, and its copy on the way down.
    const arrive = ramp(t, drawAt[i], 1500);
    if (arrive > 0) {
      out.push(yue(name, 0, { cx: x, cy: PIC_Y, R, draw: arrive, opacity: lerp(1, 0.34, clamp01(e * 3)) }));
      out.push(label(t, titleAt[i], TITLES[i], x, 236));
    }
    if (e > 0.01) {
      const cy = lerp(PIC_Y, YUE_Y, e);
      out.push(tie(x, PIC_Y + 100, x, Math.max(PIC_Y + 100, cy - 112), clamp01(e * 2)));
      out.push(yue(name, e, { cx: x, cy, R, opacity: clamp01(e / EMERGE) }));
    }
  });

  // The meat's 月 goes red, and ties back down to every word it is in.
  const meatRed = ramp(t, beat(S.body, 'body'), 700);
  out.push(fade(meatRed, yue('meat', 1, { cx: COLS[1], cy: YUE_Y, R, color: RED })));
  ['liver', 'lung', 'elbow', 'belly'].forEach((w, i) => {
    const x = ROW.xs[i] - ROW.size * 0.28;
    out.push(tie(COLS[1], YUE_Y + 112, x, ROW.y - ROW.size * 0.95, ramp(t, beat(S.body, w), 600), 0.75, RED));
  });
  return out.join('');
}

// ---------------------------------------------------- 前: a foot in a boat
const FY = 560, FR = 1.35;
const BOAT_RED = { a: RED, b: RED, c: RED, d: RED, e: RED };

function stageFront(t) {
  const arrive = ramp(t, shotStart(S.front) - 150, 2600);
  const p = ramp(t, beat(S.clerks, 'clerks'), beat(S.clerks, 'moons') - beat(S.clerks, 'clerks'));
  const knife = ramp(t, beat(S.clerks, 'strokes'), 900);
  const pair = travel((u, cx, o) => front(u, {
    cx, cy: FY, R: FR, opacity: o, draw: arrive, knife: u > 0.999 ? knife : 0, hi: BOAT_RED,
  }), p, { from: 520, to: 1100, y: FY, inset: 190, emerge: EMERGE });

  // Labels on the seal form while it is alone in the middle of the page.
  const alone = 1 - ramp(t, beat(S.clerks, 'clerks'), 500);
  const parts = fade(alone, label(t, beat(S.front, 'foot'), 'a foot', 720, 468, 36, INK_SOFT)
    + label(t, beat(S.front, 'boat'), 'a boat', 720, 650, 36));

  const emperorAt = beat(S.emperor, 'emperor');
  const zhen = word('朕', 1570, 650, 220, ramp(t, emperorAt, 1100), ramp(t, beat(S.emperor, 'boat'), 700), 0.43);
  const boatTie = tie(1060, 738, 1490, 738, ramp(t, beat(S.emperor, 'boat'), 700), 0.75, RED);

  return pair + parts + zhen + boatTie
    + fade(1 - ramp(t, beat(S.clerks, 'clerks'), 400), caption(t, beat(S.front, 'front'), "'in front', in seal script", 960, 236))
    + fade(1 - ramp(t, emperorAt, 400), caption(t, beat(S.clerks, 'clerks'), 'Han clerks, 2nd century BC', 960, 236))
    + caption(t, beat(S.clerks, 'strokes') + 500, 'the knife came later', 1150, 830, 28)
    + caption(t, beat(S.emperor, 'only'), "'I', for the emperor alone", 1570, 830, 28);
}

// ------------------------------------------------------------- in print
const KX = [560, 960, 1360];
const KINDS = ['moon', 'meat', 'boat'];
const CJ = { x: 740, y: 790 }, TW = [1190, 1340];

function stagePrint(t) {
  const start = shotStart(S.dict) - 150;
  // Alone, the three hold the middle of the page; they make room when today's arrive.
  const up = easeInOut(ramp(t, shotStart(S.today) - 300, 1200));
  const KY = lerp(520, 400, up), KR = lerp(1.1, 0.85, up);
  const redAt = [beat(S.dict, 'moons'), beat(S.dict, 'meats'), beat(S.dict, 'boat')];
  const out = KINDS.map((k, i) => printed(k, { cx: KX[i], cy: KY, R: KR, draw: ramp(t, start + i * 450, 1300) })
    + fade(ramp(t, redAt[i], 500), printed(k, { cx: KX[i], cy: KY, R: KR, only: 'bars', barColor: RED }))
    + caption(t, start + 300 + i * 450, k, KX[i], KY + 200 * KR, 34));
  out.push(caption(t, beat(S.dict, 'dictionary'), 'the Kangxi Dictionary, 1716', 960, 236));

  // China and Japan: all three into one, in the meat's shape.
  const into = ramp(t, beat(S.today, 'three'), 800);
  const meats = ramp(t, beat(S.today, 'meats'), 600);
  KINDS.forEach((k, i) => out.push(tie(KX[i], KY + 190, CJ.x, CJ.y - 80, into, 0.5)));
  out.push(fade(meats, tie(KX[1], KY + 190, CJ.x, CJ.y - 80, 1, 0.9, RED)));
  out.push(printed('modern', { cx: CJ.x, cy: CJ.y, R: 0.55, draw: ramp(t, beat(S.today, 'identical'), 1200) }));
  out.push(fade(meats, printed('modern', { cx: CJ.x, cy: CJ.y, R: 0.55, only: 'bars', barColor: RED })));
  out.push(caption(t, beat(S.today, 'identical'), 'China and Japan, 1900s', CJ.x, 925, 28));

  // Taiwan and Hong Kong: the moon and the boat together, the meat apart.
  const tw = beat(S.today, 'taiwan');
  out.push(printed('modern', { cx: TW[0], cy: CJ.y, R: 0.55, draw: ramp(t, tw, 1000) }));
  out.push(printed('taiwan', { cx: TW[1], cy: CJ.y, R: 0.55, draw: ramp(t, tw + 400, 1000), barColor: RED }));
  out.push(caption(t, tw, 'Taiwan and Hong Kong', (TW[0] + TW[1]) / 2, 925, 28));
  return out.join('');
}

// ------------------------------------------------------------ the names
function stageNames(t) {
  const start = shotStart(S.names) - 150;
  const means = beat(S.names, 'means');
  return printed('meat', { cx: 960, cy: 520, R: 1.1, draw: ramp(t, start, 1300), barColor: RED })
    + write('にくづき', { x: 560, y: 560, size: 70, p: ramp(t, beat(S.names, 'japan'), 900) })
    + caption(t, beat(S.names, 'japan') + 300, 'Japanese', 560, 650, 30)
    + write('육달월', { x: 1360, y: 560, size: 64, family: HANGUL, p: ramp(t, beat(S.names, 'korea'), 900) })
    + caption(t, beat(S.names, 'korea') + 300, 'Korean', 1360, 650, 30)
    + tie(620, 690, 880, 800, ramp(t, means, 600), 0.6) + tie(1300, 690, 1040, 800, ramp(t, means, 600), 0.6)
    + label(t, beat(S.names, 'name'), "'meat moon'", 960, 860, 50);
}

// ------------------------------------------------------ recap and close
function stageRecap(t) {
  const start = shotStart(S.recap) - 150;
  const cues = [start, beat(S.recap, 'slice'), beat(S.recap, 'boat')];
  const squeeze = ramp(t, beat(S.recap, 'squeezed'), 1200);
  const out = PICS.map((name, i) => yue(name, 0, { cx: COLS[i], cy: 372, R: 0.8, draw: ramp(t, cues[i], 1300) })
    + caption(t, cues[i] + 300, TITLES[i], COLS[i], 506, 30)
    + tie(COLS[i], 530, lerp(COLS[i], 960, 0.8), 600, squeeze, 0.55));
  out.push(printed('modern', { cx: 960, cy: 716, R: 0.9, draw: squeeze }));

  // The close: the word for liver, whose moon is meat; and the moon itself,
  // printed today in the meat's shape.
  const liver = beat(S.close, 'liver');
  out.push(word('肝', 1450, 820, 170, ramp(t, liver, 900), ramp(t, liver + 400, 600), 0.44));
  out.push(tie(1060, 740, 1365, 740, ramp(t, beat(S.close, 'never'), 600), 0.8, RED));
  out.push(fade(ramp(t, beat(S.close, 'today'), 700), printed('modern', { cx: 960, cy: 716, R: 0.9, only: 'bars', barColor: RED })));
  out.push(text('Not Arbitrary', { x: 960, y: 925, size: 46, color: GOLD, p: ramp(t, beat(S.close, 'printed'), 900) }));
  return out.join('');
}

const EDGES = [S.front, S.dict, S.names, S.recap];

function stageFor(t) {
  if (t < shotStart(S.front) - 260) return stageColumns(t);
  if (t < shotStart(S.dict) - 260) return stageFront(t);
  if (t < shotStart(S.names) - 260) return stagePrint(t);
  if (t < shotStart(S.recap) - 260) return stageNames(t);
  return stageRecap(t);
}

export const renderFrame = film.wrap(stageFor, EDGES);
