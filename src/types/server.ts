import { Map, Mode, Phase } from "./game";

export namespace Server {
  export type Status = 'ONLINE' | 'OFFLINE' | 'STARTING';
  export type Match = {
    format: Mode,
    goalsToWinSet: number,
    hosting: boolean,
    map: Map,
    phase: Phase,
    players: Player[],
    setsToWin: number,
  }
  export type Players = (Player & { joinedAt: Date });
  export type Player = {
    playerId: string,
    username: string,
  }
  export type Info = { // the JSON object
    match: Match,
    players?: Players[],
    updatedAt: Date,
  }
}