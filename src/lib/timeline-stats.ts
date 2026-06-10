/** Hover statistics shown along memory timelines. */

export type TimelineYearStats = {
  year: number;
  contributors: number;
  images: number;
};

export type TimelineHoverStats = TimelineYearStats & {
  t: number;
};

function lerp(a: number, b: number, u: number): number {
  return a + (b - a) * u;
}

function yearAtPosition(t: number, years: readonly number[]): number {
  const min = years[0];
  const max = years[years.length - 1];
  return Math.round(min + t * (max - min));
}

export function statsAtTimelinePosition(
  t: number,
  years: readonly number[],
  keyframes: TimelineYearStats[]
): TimelineHoverStats {
  const clamped = Math.max(0, Math.min(1, t));
  const year = yearAtPosition(clamped, years);

  if (keyframes.length === 0) {
    return { t: clamped, year, contributors: 0, images: 0 };
  }
  if (keyframes.length === 1) {
    const k = keyframes[0];
    return { t: clamped, year, contributors: k.contributors, images: k.images };
  }

  const minYear = keyframes[0].year;
  const maxYear = keyframes[keyframes.length - 1].year;
  const span = maxYear - minYear || 1;
  const targetYear = minYear + clamped * span;

  let i = 0;
  while (i < keyframes.length - 1 && keyframes[i + 1].year < targetYear) i++;
  const a = keyframes[i];
  const b = keyframes[Math.min(i + 1, keyframes.length - 1)];

  if (a.year === b.year) {
    return { t: clamped, year, contributors: a.contributors, images: a.images };
  }

  const u = (targetYear - a.year) / (b.year - a.year);
  return {
    t: clamped,
    year,
    contributors: Math.round(lerp(a.contributors, b.contributors, u)),
    images: Math.round(lerp(a.images, b.images, u)),
  };
}

export const CAMPUS_TIMELINE_STATS: TimelineYearStats[] = [
  { year: 2018, contributors: 12, images: 84 },
  { year: 2021, contributors: 38, images: 412 },
  { year: 2024, contributors: 96, images: 1280 },
  { year: 2027, contributors: 164, images: 2840 },
];

export const DESK_ROOM_TIMELINE_STATS: TimelineYearStats[] = [
  { year: 2020, contributors: 1, images: 186 },
  { year: 2023, contributors: 1, images: 210 },
  { year: 2026, contributors: 1, images: 198 },
];

export const DINING_HALL_TIMELINE_STATS: TimelineYearStats[] = [
  { year: 2021, contributors: 4, images: 220 },
  { year: 2024, contributors: 9, images: 250 },
];