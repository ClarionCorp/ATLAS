-- Static game data for Hosts. Asset IDs are for the current game build.
local GameData = {}

-- key -> { level, map data asset, default terrain asset }
GameData.Maps = {
    ahtencity = { level = "GameMapAhtenCity", map = "GMD_AhtenCity", terrain = "CompetitiveTerrains/GTD_AhtenCity" },
    atlaslab = { level = "GameMapAtlasLab", map = "GMD_AtlasLab", terrain = "CompetitiveTerrains/GTD_Lab" },
    clarioncorp = { level = "GameMapClarionCorp", map = "GMD_ClarionCorp", terrain = "CompetitiveTerrains/GTD_ClarionCorpDefault" },
    digitalworld = { level = "GameMapDigitalWorld", map = "GMD_DigitalWorld", terrain = "CompetitiveTerrains/GTD_DigitalWorld" },
    drums = { level = "GameMapDrums", map = "GMD_Drums", terrain = "CompetitiveTerrains/GTD_Drums" },
    musicstage = { level = "GameMapMusicStage", map = "GMD_MusicStage", terrain = "CompetitiveTerrains/GTD_MusicStage" },
    nightmarket = { level = "GameMapNightMarket", map = "GMD_NightMarket", terrain = "CompetitiveTerrains/GTD_NightMarket" },
    obscura = { level = "GameMapObscura", map = "GMD_Obscura", terrain = "CompetitiveTerrains/GTD_Obscura" },
    onivillage = { level = "GameMapOniVillage", map = "GMD_OniVillage", terrain = "CompetitiveTerrains/GTD_OniVillage" },
    summersplash = { level = "GameMapSummerSplash", map = "GMD_SummerSplash", terrain = "CompetitiveTerrains/GTD_SummerSplash" },
    rgm = { level = "GameMapRGM", map = "GMD_RGM", terrain = "RGMTerrains/GTD_BackToBackXL" },
}

GameData.Formats = {
    normal = "GFD_Normal",
    ranked = "GFD_Ranked",
    quickplay = "GFD_QuickPlay",
    practice = "GFD_Practice",
    rgm = "GFD_RGM",
    tournament = "GFD_1v1Tournament",
    test = "GFD_Test",
}

GameData.Characters = {
    "CD_AngelicSupport", "CD_ChaoticRocketeer", "CD_CleverSummoner", "CD_DrumOni", "CD_EDMOni",
    "CD_EmpoweringEnchanter", "CD_FlashySwordsman", "CD_FlexibleBrawler", "CD_GravityMage", "CD_Healer",
    "CD_HulkingBeast", "CD_MagicalPlaymaker", "CD_ManipulatingMastermind", "CD_NimbleBlaster", "CD_RockOni",
    "CD_ShieldUser", "CD_SpeedySkirmisher", "CD_StalwartProtector", "CD_TempoSniper", "CD_UmbrellaUser",
    "CD_WhipFighter",
}

-- From a real GamePlayerInfo (dumpgpi)
GameData.PowerUps = {
    "TD_SpecialCooldownAfterRounds", "TD_EmpoweredHitsBuff", "TD_IncreasedPowerWithMaxStagger", "TD_StrikeRockSpeedUp",
    "TD_MovementAbilityCharges", "TD_MaxStaggerIncrease", "TD_KnockAnythingRecoverStagger", "TD_HitsReduceCooldowns",
    "TD_TakeDownReduceCooldowns", "TD_IncreasedSpeedWithStagger", "TD_CreationSizeLifeTime", "TD_TrapMaster",
    "TD_FasterDashes", "TD_HitEnemyBurnThem", "TD_RangedStrike", "TD_PrimaryEcho", "TD_SizeIncrease",
    "TD_CreationLifeTime", "TD_CreationSize", "TD_BuffAndDebuffDuration", "TD_MovementAbilitiesTeleport",
    "TD_GoalArcPower", "TD_KOKing", "TD_PrimaryAbilityCooldownReduction", "TD_FasterProjectiles", "TD_DistancePower",
    "TD_HitsIncreaseSpeedAndPower", "TD_HitRockCooldown", "TD_HitStaggerEnemyCooldownReduction",
    "TD_AvoidDamageHitHarder", "TD_MultiHitsReduceCooldowns", "TD_ComboATarget", "TD_HitCoreGainCDR",
    "TD_GainRampingSpeed",
}

-- Emoticon wheel from a real loadout (dumpgpi). Every character gets these plus its own two emotes.
GameData.WheelEmoticons = {
    "EmoticonData_JulietteAyaya", "EmoticonData_MakoOhno", "EmoticonData_JulietteHeart", "EmoticonData_AiMiShocked",
    "EmoticonData_Onigiri", "EmoticonData_RockOniMastery", "EmoticonData_JuliettePoint",
}

-- Character -> name in its EmoteData_<Name>_Delighted / _Disappointed assets
GameData.CharacterEmoteNames = {
    CD_AngelicSupport = "Atlas", CD_ChaoticRocketeer = "Luna", CD_CleverSummoner = "Juno", CD_DrumOni = "DrumOni",
    CD_EDMOni = "Octavia", CD_EmpoweringEnchanter = "Era", CD_FlashySwordsman = "Zentaro",
    CD_FlexibleBrawler = "Juliette", CD_GravityMage = "GravityMage", CD_Healer = "Healer", CD_HulkingBeast = "X",
    CD_MagicalPlaymaker = "AiMi", CD_ManipulatingMastermind = "Rune", CD_NimbleBlaster = "Drekar",
    CD_RockOni = "Vyce", CD_ShieldUser = "Asher", CD_SpeedySkirmisher = "Kai", CD_StalwartProtector = "Dubu",
    CD_TempoSniper = "Estelle", CD_UmbrellaUser = "UmbrellaUser", CD_WhipFighter = "Rasmus",
}

-- EMatchPhase, in enum order (value = index - 1)
GameData.MatchPhases = {
    "None", "PreGame", "CharacterSelect", "FaceOffIntro", "FaceOffCountdown", "InGame",
    "GoalCelebration", "GoalScore", "IntermissionIntro", "Intermission", "IntermissionOutro",
    "PostGameCelebration", "ArenaOverview", "PostGameSummary", "EndGame", "LoadoutSelect",
    "BoostSelect", "TimeoutCelebration", "VersusScreen", "BanSelect", "CharacterPreSelect",
    "BanCelebration", "IntermissionMvp",
}

-- Native (unreflected) bools on APMGameModeGame that TryToStartMatch requires, found by disassembly.
-- Offsets are for this exact build. 0x888 is the "is set" byte of the TOptional<GameInfo>.
GameData.StartFlags = {
    { name = "LS_bGameInfoSet", offset = 0x888 },
    { name = "LS_bAllPlayersLoggedIn", offset = 0x950 },
    { name = "LS_bAllPlayersLoaded", offset = 0x951 },
    { name = "LS_bAllowedCharactersReady", offset = 0x952 },
}

-- Players (by username or backend ID) who get the staff badge. :)
GameData.StaffPlayers = { ["blals"] = true, ["6333a58673a37dc7cb11a7a7"] = true }

return GameData
