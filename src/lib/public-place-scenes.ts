import {
  alignPathForMoment,
  splatPathForMoment,
  type TimelineMoment,
} from "@/lib/demo-scenes";

export const DINING_HALL_YEARS = [2021, 2024] as const;

export const DINING_HALL_MOMENTS: TimelineMoment[] = [
  {
    id: "dininghall1",
    year: DINING_HALL_YEARS[0],
    label: `${DINING_HALL_YEARS[0]}`,
    splatUrl: splatPathForMoment("dininghall1"),
    alignUrl: alignPathForMoment("dininghall1"),
    photos: [
      {
        src: "/scenes/dininghall1/photo-01.jpg",
        caption: "Dining hall, earlier visit",
      },
      {
        src: "/scenes/dininghall1/photo-02.jpg",
        caption: "Lunch crowd",
      },
    ],
  },
  {
    id: "dininghall2",
    year: DINING_HALL_YEARS[1],
    label: `${DINING_HALL_YEARS[1]}`,
    splatUrl: splatPathForMoment("dininghall2"),
    alignUrl: alignPathForMoment("dininghall2"),
    photos: [
      {
        src: "/scenes/dininghall2/photo-01.jpg",
        caption: "Dining hall, later visit",
      },
      {
        src: "/scenes/dininghall2/photo-02.jpg",
        caption: "Evening service",
      },
    ],
  },
];

const PLACE_VIEWERS: Record<
  string,
  { moments: TimelineMoment[]; years: readonly number[] }
> = {
  "yufeng-canteen": {
    moments: DINING_HALL_MOMENTS,
    years: DINING_HALL_YEARS,
  },
};

export function placeHas3DViewer(placeId: string): boolean {
  return placeId in PLACE_VIEWERS;
}

export function timelineForPlace(placeId: string): {
  moments: TimelineMoment[];
  years: readonly number[];
} | null {
  return PLACE_VIEWERS[placeId] ?? null;
}

export function yearAtPlaceTimeline(
  t: number,
  years: readonly number[]
): number {
  const minYear = years[0];
  const maxYear = years[years.length - 1];
  return Math.round(minYear + t * (maxYear - minYear));
}

export function momentIndexAtPlaceTimeline(
  t: number,
  count: number
): number {
  if (count <= 1) return 0;
  return Math.min(count - 1, Math.round(t * (count - 1)));
}
