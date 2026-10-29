// Display names for the game's internal IDs.
// Typed as Record so adding a new Map/Mode to types/game.ts without a label here is a compile error.

import { Map, Mode } from "../../types/game";

export const MAP_NAMES: Record<Map, string> = {
  ahtencity: 'Ahten City',
  atlaslab: "Atlas's Lab",
  clarioncorp: 'Clarion Corp',
  digitalworld: 'Digital World',
  drums: 'Drums',
  musicstage: 'Music Stage',
  nightmarket: 'Night Market',
  obscura: 'Obscura',
  onivillage: 'Oni Village',
  summersplash: 'Summer Splash',
  rgm: 'RGM',
};

export const MODE_NAMES: Record<Mode, string> = {
  normal: 'Normal',
  ranked: 'Ranked',
  quickplay: 'Quickplay',
  practice: 'Practice',
  rgm: 'RGM',
  tournament: 'Tournament',
  test: 'Test',
};
