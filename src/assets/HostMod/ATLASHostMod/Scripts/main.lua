local ModName = "ATLASHostMod"
local ModVersion = "1.1.2"

print(string.format("\n=== %s v%s Loaded ===\n", ModName, ModVersion))

-- Hosts ATLAS Servers. Players can join with ATLASClientMod.
-- Host is forced to spectate, playing and hosting not supported yet.
-- Native functions (LANServer_*) come from this mod's own dlls/main.dll.

local UEHelpers = require("UEHelpers")
local GameData = require("gamedata")
local Info = require("info")
local Commands = require("commands")

local DA = "/Game/Prometheus/DataAssets/"
local GAME_MAPS = "/Game/Prometheus/Maps/GameMap/"
local MAIN_MENU = "/Game/Prometheus/Maps/MainMenuMap/MainMenuMap"
local DEFAULT_MAP = "ahtencity"
local DEFAULT_FORMAT = "normal"
local DEFAULT_OMEGA_MOD = "OMD_Empty"
local PORT = 7777

local function Log(fmt, ...)
    print(string.format("[%s] " .. fmt .. "\n", ModName, ...))
end

-- Logs and returns false, message: the failure result commands.jsonl reports back.
local function Fail(fmt, ...)
    local message = string.format(fmt, ...)
    Log("%s", message)
    return false, message
end

local function AssetPath(subPath)
    local name = subPath:match("([^/]+)$")
    return DA .. subPath .. "." .. name
end

local function LoadData(subPath)
    local path = AssetPath(subPath)
    local obj = StaticFindObject(path)
    if not obj or not obj:IsValid() then
        obj = LoadAsset(path)
    end
    if not obj or not obj:IsValid() then
        Log("Failed to load %s", path)
        return nil
    end
    return obj
end

-- Everything the 1s tick needs is reached through references from the game instance:
-- local player -> controller -> world -> game mode -> game state -> PlayerArray.
-- All of these must run on the game thread.

-- The game instance lives for the whole session, so it's only searched for until found.
local GameInstance = nil

local function GetGameInstance()
    if not (GameInstance and GameInstance:IsValid()) then
        local gi = FindFirstOf("PMGameInstance")
        GameInstance = (gi and gi:IsValid()) and gi or nil
    end
    return GameInstance
end

-- UEHelpers.GetPlayerController requires a possessive character, which the main menu doesn't have.
local function GetLocalPlayerController()
    local gi = GetGameInstance()
    if not gi then return nil end
    -- ForEach, not LocalPlayers[1]: UE4SS 3.0.1's TArray index read appends zeroed elements when it's out of range.
    local found = nil
    pcall(function()
        gi.LocalPlayers:ForEach(function(_, elem)
            local player = elem:get()
            local pc = player and player:IsValid() and player.PlayerController
            if pc and pc:IsValid() then
                found = pc
                return true -- stop
            end
        end)
    end)
    return found
end

local function RunConsoleCommand(cmd)
    local pc = GetLocalPlayerController()
    if not pc then
        Log("No local PlayerController found")
        return
    end
    UEHelpers.GetKismetSystemLibrary():ExecuteConsoleCommand(pc, cmd, pc)
end

local function DataName(obj)
    if obj and obj:IsValid() then return obj:GetFName():ToString() end
    return "nil"
end

-- The local world's game mode, whatever kind (the menu has its own), or nil while no world is up.
local function GetAuthorityGameMode()
    local pc = GetLocalPlayerController()
    local world = pc and pc:GetWorld()
    local gm = world and world:IsValid() and world.AuthorityGameMode
    if gm and gm:IsValid() then return gm end
    return nil
end

local GameModeGameClass = nil

-- The hosted match's game mode, or nil when this instance isn't hosting one.
local function GetGameMode()
    local gm = GetAuthorityGameMode()
    if not gm then return nil end
    GameModeGameClass = GameModeGameClass or StaticFindObject("/Script/Prometheus.PMGameModeGame")
    if not gm:IsA(GameModeGameClass) then return nil end
    return gm
end

-- The match's PlayerStates (GameState.PlayerArray, which drops a player when they log out), host's included.
local function GetPlayerStates(gm)
    local states = {}
    local gs = gm and gm.GameState
    if not (gs and gs:IsValid()) then return states end
    gs.PlayerArray:ForEach(function(_, elem)
        local ps = elem:get()
        if ps and ps:IsValid() then states[#states + 1] = ps end
    end)
    return states
end

-- Remote players' PlayerControllers: on the server, each PlayerState's owner is its controller.
local function GetRemoteControllers(gm)
    local controllers = {}
    for _, ps in ipairs(GetPlayerStates(gm)) do
        local pc = ps.Owner
        if pc and pc:IsValid() and not pc:IsLocalController() then controllers[#controllers + 1] = pc end
    end
    return controllers
end

-- The listen host's own player never gets the owner-only phase replication, so it can't move and its camera stays on the overview.
-- By default it spectates: GetPMPlayerArray(bExcludeSpectators) skips PlayerStates with bIsSpectator/bOnlySpectator, and it's left out of the GameInfo roster.
-- Using `host <map> [format] play` opts back in.
local HostPlays = false

local function GetHostPlayerState()
    local pc = GetLocalPlayerController()
    local ps = pc and pc.PlayerState
    if ps and ps:IsValid() then return ps end
    return nil
end

-- Address of the host's own PlayerState, for comparing against many PlayerStates without a lookup each.
local function GetHostAddress()
    local host = GetHostPlayerState()
    return host and host:GetAddress()
end

-- The host never logs in, so its PlayerState gets fixed credentials instead of whatever the engine assigned.
local HOST_USERNAME = "ATLASHost"
local HOST_PLAYER_ID = "00000000-0000-0000-0000-000000000000"

local function ApplyHostRole()
    local ps = GetHostPlayerState()
    if not ps then return false end
    ps.bIsSpectator = not HostPlays
    ps.bOnlySpectator = not HostPlays
    ps.PMPlayerId = FName(HOST_PLAYER_ID)
    local gm = GetGameMode()
    if gm then gm:ChangeName(GetLocalPlayerController(), HOST_USERNAME, false) end
    Log("Host %s as %s (bIsSpectator=%s)", HostPlays and "plays" or "spectates", HOST_USERNAME, tostring(ps.bIsSpectator))
    return true
end

-- After the map loads, report whether the game state picked up our chosen data.
-- (HandleGameSessionData is deliberately not used: its OnGameDataLoaded reloads the map without ?listen.)
-- Polls from the async thread but touches objects only on the game thread.
local function ReportGameState()
    local tries = 0
    local done = false
    LoopAsync(500, function()
        tries = tries + 1
        if done or tries > 40 then return true end
        ExecuteInGameThread(function()
            if done then return end
            local gm = GetGameMode()
            local gs = gm and gm.GameState
            if not (gs and gs:IsValid()) then return end
            done = true
            local ok, err = pcall(function()
                Log("GameState data -> Format: %s, Map: %s, Terrain: %s",
                    DataName(gs.CurrentFormatData), DataName(gs.CurrentMapData), DataName(gs.CurrentTerrainData))
                ApplyHostRole()
            end)
            if not ok then Log("GameState report error: %s", tostring(err)) end
        end)
        return false
    end)
end

local function ReportReadyState()
    local gm = GetGameMode()
    local gs = gm and gm.GameState
    if gs and gs:IsValid() then
        Log("Ready: %d/%d players, waited %.1f/%.1fs",
            gs.NumPlayersReady, gs.MaxNumPlayersReady, gs.TimeWaitingForAllPlayersReady, gs.MaxTimeWaitingForAllPlayersReady)
    end
end

-- The host never sends the client->server readiness RPCs a remote client would, so send them by hand.
local function WithLocalPlayerState(fn)
    ExecuteInGameThread(function()
        local ps = GetHostPlayerState()
        if not ps then
            Log("No local PlayerState found")
            return
        end
        local ok, err = pcall(fn, ps)
        if not ok then Log("Error: %s", tostring(err)) end
        ReportReadyState()
    end)
end

RegisterConsoleCommandHandler("ready", function(FullCommand, Parameters, Ar)
    local steps = tonumber(Parameters[1]) or 0x3f
    WithLocalPlayerState(function(ps)
        Log("UpdateLoadingSteps_Server(%d)", steps)
        ps:UpdateLoadingSteps_Server(steps)
    end)
    return true
end)

RegisterConsoleCommandHandler("ack", function(FullCommand, Parameters, Ar)
    WithLocalPlayerState(function(ps)
        Log("AcknowledgePreGameReady_Server()")
        ps:AcknowledgePreGameReady_Server()
    end)
    return true
end)

local function Str(v)
    if type(v) == "userdata" then
        local ok, s = pcall(function() return v:ToString() end)
        if ok then return s end
    end
    return tostring(v)
end

-- GameInfo normally comes from the backend through HandleGameInfoRequestComplete.
-- UE4SS can't build that struct from Lua, so this file builds each field as ImportText and the native LANServer_ApplyGameInfo imports it.
local ALL_CHARACTERS = GameData.Characters
local ALL_POWERUPS = GameData.PowerUps
local WHEEL_EMOTICONS = GameData.WheelEmoticons
local CHARACTER_EMOTE_NAMES = GameData.CharacterEmoteNames

local function CharacterEmotes(characterId)
    local name = CHARACTER_EMOTE_NAMES[characterId]
    if not name then return {} end
    return { "EmoteData_" .. name .. "_Delighted", "EmoteData_" .. name .. "_Disappointed" }
end

local ALL_EMOTES = {}
for _, id in ipairs(ALL_CHARACTERS) do
    for _, emote in ipairs(CharacterEmotes(id)) do ALL_EMOTES[#ALL_EMOTES + 1] = emote end
end

local MAX_GAME_SECONDS = 1800

-- Unreal ImportText format: structs are (Field=Value,...), arrays are (a,b,...), strings are quoted.
local function Quote(s)
    local escaped = tostring(s):gsub("\\", "\\\\"):gsub('"', '\\"')
    return '"' .. escaped .. '"'
end

local function QuotedList(values)
    local out = {}
    for i, v in ipairs(values) do out[i] = Quote(v) end
    return "(" .. table.concat(out, ",") .. ")"
end

-- FGameInfoCatalogEntryListWithTypeV1 where every asset is owned by default, so no per-player entitlements are needed.
local function CatalogText(entitlementType, assetIds)
    local entries = {}
    for i, id in ipairs(assetIds) do
        entries[i] = string.format("(AssetId=%s,OwnedByDefault=True)", Quote(id))
    end
    return string.format("(EntitlementType=%s,CatalogEntries=(%s))", entitlementType, table.concat(entries, ","))
end

-- FReactionListV1: the emoticon wheel, plus the character's emotes when given one.
local function ReactionListText(characterId)
    local entries = {}
    for _, id in ipairs(WHEEL_EMOTICONS) do
        entries[#entries + 1] = string.format("(AssetId=%s,AssetType=Emoticon)", Quote(id))
    end
    for _, id in ipairs(CharacterEmotes(characterId)) do
        entries[#entries + 1] = string.format("(AssetId=%s,AssetType=Emote)", Quote(id))
    end
    return "(Entries=(" .. table.concat(entries, ",") .. "))"
end

-- FReactionListByCharacterIdV1; TMaps import as ((Key,Value),...).
local function ReactionsText()
    local byCharacter = {}
    for i, id in ipairs(ALL_CHARACTERS) do
        byCharacter[i] = string.format("(%s,%s)", Quote(id), ReactionListText(id))
    end
    return string.format("(DefaultReactionList=%s,ReactionListByCharacterId=(%s))",
        ReactionListText(nil), table.concat(byCharacter, ","))
end

-- The same for every player and every match, so built once here rather than per player per GameInfo.
local OWNED_CHARACTERS_TEXT = QuotedList(ALL_CHARACTERS)
local OWNED_POWERUPS_TEXT = QuotedList(ALL_POWERUPS)
local WHEEL_EMOTICONS_TEXT = QuotedList(WHEEL_EMOTICONS)
local REACTIONS_TEXT = ReactionsText()

-- FGameInfoResponseV1 fields that don't depend on who joined.
-- GetGamePlayerInfoFromResponse needs a Character list in the catalog, or every player's info fails and the game ends the session as soon as InGame starts.
local STATIC_GAME_INFO_FIELDS = {
    MaximumGameSeconds = tostring(MAX_GAME_SECONDS),
    IsSurrenderEnabled = "True",
    Queue = Quote("queue:custom:NvM"),
    QueueConfig = string.format("(CharacterSelectDuplicatesPolicy=%s)", Quote("NoDuplicatesInGame")),
    AllowedCharacterAssetIds = OWNED_CHARACTERS_TEXT,
    AllowedPowerUpAssetIds = OWNED_POWERUPS_TEXT,
    Catalog = string.format("(Entitlements=(%s,%s,%s,%s))",
        CatalogText("Character", ALL_CHARACTERS), CatalogText("Training", ALL_POWERUPS),
        CatalogText("Emoticon", WHEEL_EMOTICONS), CatalogText("Emote", ALL_EMOTES)),
}

-- Backend player ID -> that player's own FPlayerPublicProfile as ImportText (nameplate, title, tags, emoticon...),
-- sent by their client when it joins (see the identity hook). Players without one get just their ID and name.
local PublicProfiles = {}

local STAFF_PLAYERS = GameData.StaffPlayers
-- Profile tags the client UI knows: "verified" (checkmark) and "staff" (Ody badge).
local STAFF_TAG = "staff"

-- Adds a tag to an FPlayerPublicProfile ImportText, creating Tags if it's missing.
local function WithTag(profile, tag)
    if profile:find("Tags=%(%)") then
        return (profile:gsub("Tags=%(%)", "Tags=(" .. Quote(tag) .. ")", 1))
    elseif profile:find("Tags=%(") then
        return (profile:gsub("Tags=%(", "Tags=(" .. Quote(tag) .. ",", 1))
    end
    return (profile:gsub("%)$", ",Tags=(" .. Quote(tag) .. "))", 1))
end

local function GamePlayerText(p)
    local profile = PublicProfiles[p.id] or string.format("(PlayerId=%s,Username=%s)", Quote(p.id), Quote(p.name))
    if STAFF_PLAYERS[p.id] or STAFF_PLAYERS[p.name] then profile = WithTag(profile, STAFF_TAG) end
    return string.format(
        "(PlayerId=%s,DisplayName=%s,OwnedCharacterAssetNames=%s,OwnedPowerUpAssetNames=%s,"
        .. "EquippedEmoticonAssetNames=%s,QueuedRole=Flex,AssignedRole=Flex,PublicProfile=%s,Reactions=%s)",
        Quote(p.id), Quote(p.name), OWNED_CHARACTERS_TEXT, OWNED_POWERUPS_TEXT,
        WHEEL_EMOTICONS_TEXT, profile, REACTIONS_TEXT)
end

-- Build the GameInfo from the connected PlayerStates, so every PlayerId matches what the server already has.
-- extraIds: backend player IDs the server can't see on its own.
-- Must run on the game thread.
local function ApplyGameInfo(extraIds)
    if not LANServer_ApplyGameInfo then
        Log("LANServer_ApplyGameInfo missing; is the mod's dlls/main.dll in place?")
        return false
    end

    ApplyHostRole()
    local hostAddress = GetHostAddress()
    local players = {}
    for _, ps in ipairs(GetPlayerStates(GetGameMode())) do
        if not HostPlays and ps:GetAddress() == hostAddress then
            Log("Skipping host's own PlayerState (spectating)")
        else
            local id = Str(ps.PMPlayerId)
            -- GetPlayerName() returns an FString by value, which UE4SS 3.0.1 hands back as garbage.
            local ok, name = pcall(function() return Str(ps.PlayerNamePrivate) end)
            if not ok or name == "" then name = id end
            Log("Player '%s' PMPlayerId='%s'", name, id)
            players[#players + 1] = { id = id, name = name }
        end
    end
    for _, id in ipairs(extraIds or {}) do
        players[#players + 1] = { id = id, name = id }
    end

    local gamePlayers = {}
    for i, p in ipairs(players) do gamePlayers[i] = GamePlayerText(p) end
    -- FGameInfoResponseV1 field -> ImportText value; the native side imports and reports each one separately.
    local fields = { GamePlayers = "(" .. table.concat(gamePlayers, ",") .. ")" }
    for k, v in pairs(STATIC_GAME_INFO_FIELDS) do fields[k] = v end

    local ok, message = LANServer_ApplyGameInfo(fields)
    Log("GameInfo for %d player(s): %s - %s", #players, ok and "ok" or "FAILED", tostring(message))
    return ok
end

RegisterConsoleCommandHandler("gameinfo", function(FullCommand, Parameters, Ar)
    ExecuteInGameThread(function()
        if not GetGameMode() then
            Log("PMGameModeGame not found (are you hosting?)")
            return
        end
        local extraIds = {}
        for _, id in ipairs(Parameters) do extraIds[#extraIds + 1] = id end
        ApplyGameInfo(extraIds)
    end)
    return true
end)

-- Leave the hosted map, which ends the session and drops clients. (Clients leave with the engine's `disconnect`.)
-- Must run on the game thread.
local function ForceStop()
    if not GetGameMode() then return Fail("Not hosting a match; to leave a server, use disconnect") end
    Log("Ending hosted match, returning to main menu")
    RunConsoleCommand("open " .. MAIN_MENU)
    return true
end

for _, name in ipairs({ "stop", "forcestop" }) do
    RegisterConsoleCommandHandler(name, function(FullCommand, Parameters, Ar)
        ExecuteInGameThread(ForceStop)
        return true
    end)
end

-- bAllPlayersLoggedIn is only ever set by GameLift's AllGameLiftPlayersJoined, which never fires here.
for _, flag in ipairs(GameData.StartFlags) do
    RegisterCustomProperty({
        Name = flag.name,
        Type = PropertyTypes.ByteProperty,
        BelongsToClass = "/Script/Prometheus.PMGameModeGame",
        OffsetInternal = flag.offset,
    })
end

local FULLY_LOADED_STEPS = 0x3f -- every EPlayerLoadingStep bit, as a real client reports it

-- Match length overrides; nil keeps the format's values. Filled from launch args further down.
local MatchRules = { setsToWin = nil, goalsToWinSet = nil }

-- The game mode's win conditions, and the score info copies of them (the game state's one replicates to clients).
local function ApplyMatchRules(gm)
    local sets, goals = MatchRules.setsToWin, MatchRules.goalsToWinSet
    if not sets and not goals then return end
    local points = goals and goals * math.max(gm.NumPointsPerGoal, 1)

    local targets = { gm, gm.MatchScoreInfo }
    local gs = gm.GameState
    if gs and gs:IsValid() then targets[#targets + 1] = gs.MatchScoreInfo end
    for _, target in ipairs(targets) do
        if points then target.NumPointsToWinSet = points end
        if sets then target.NumSetsToWinMatch = sets end
    end
    Log("Match rules -> sets to win: %d, points to win a set: %d (%d per goal)",
        gm.NumSetsToWinMatch, gm.NumPointsToWinSet, gm.NumPointsPerGoal)
end

-- Must run on the game thread.
local function ForceStart()
    local gm = GetGameMode()
    if not gm then return Fail("PMGameModeGame not found (are you hosting?)") end
    -- EMatchPhase values; MatchPhases/PhaseName are defined further down the file.
    if gm.CurrentMatchPhase ~= 0 then return Fail("Match already past None (phase %d)", gm.CurrentMatchPhase) end

    -- bAllPlayersLoaded needs every known player (including the host's own, which never reports) in the loaded set, so set it directly too.
    -- Nothing resets it, and TryToStartMatch only re-checks the flags.
    -- Run `gameinfo` first to supply real GameInfo; if it wasn't, this leaves an empty (zeroed) one, which means no characters and an instant timeout.
    ApplyHostRole()
    ApplyMatchRules(gm)
    gm.LS_bGameInfoSet = 1
    gm.LS_bAllPlayersLoggedIn = 1
    gm.LS_bAllPlayersLoaded = 1
    gm.LS_bAllowedCharactersReady = 1
    Log("Flags -> GameInfoSet: %d, LoggedIn: %d, Loaded: %d, CharactersReady: %d",
        gm.LS_bGameInfoSet, gm.LS_bAllPlayersLoggedIn, gm.LS_bAllPlayersLoaded, gm.LS_bAllowedCharactersReady)

    -- PlayerLoadingStateUpdated tail-calls TryToStartMatch; report every player so the loaded set is complete too.
    for _, ps in ipairs(GetPlayerStates(gm)) do
        Log("UpdateLoadingSteps_Server(0x%x) on %s", FULLY_LOADED_STEPS, ps:GetFullName())
        ps:UpdateLoadingSteps_Server(FULLY_LOADED_STEPS)
    end

    Log("Phase now: %d", gm.CurrentMatchPhase)
    return true, "Phase now: " .. tostring(gm.CurrentMatchPhase)
end

RegisterConsoleCommandHandler("forcestart", function(FullCommand, Parameters, Ar)
    ExecuteInGameThread(ForceStart)
    return true
end)

-- `gameinfo` then `forcestart`. Must run on the game thread.
local function Start()
    if not GetGameMode() then return Fail("PMGameModeGame not found (are you hosting?)") end
    if not ApplyGameInfo({}) then return Fail("GameInfo failed; not starting") end
    return ForceStart()
end

RegisterConsoleCommandHandler("start", function(FullCommand, Parameters, Ar)
    ExecuteInGameThread(Start)
    return true
end)

-- Dump APMPlayerState.GamePlayerInfo (what the backend gives the server per player), to model fakes on.
local function List(arr, fn)
    local out = {}
    pcall(function()
        arr:ForEach(function(_, elem) out[#out + 1] = (fn or Str)(elem:get()) end)
    end)
    return "[" .. table.concat(out, ", ") .. "]"
end

local function DumpGamePlayerInfo(ps)
    local gpi = ps.GamePlayerInfo
    local p = gpi.PublicProfile
    local r = gpi.WinRatingUpdate
    Log("---- GamePlayerInfo for %s ----", ps:GetFullName())
    Log("PlayerId: %s | DisplayName: %s | QueuedRole: %s | AssignedRole: %s",
        Str(gpi.PlayerId), Str(gpi.DisplayName), Str(gpi.QueuedRole), Str(gpi.AssignedRole))
    Log("OwnedCharacterAssetNames: %s", List(gpi.OwnedCharacterAssetNames))
    Log("OwnedPowerUpAssetNames: %s", List(gpi.OwnedPowerUpAssetNames))
    Log("EquippedEmoticonAssetNames: %s", List(gpi.EquippedEmoticonAssetNames))
    Log("EquippedGoalExplosionAssetId: %s", Str(gpi.EquippedGoalExplosionAssetId))
    Log("PublicProfile: PlayerId=%s Username=%s Title=%s LogoId=%s NameplateId=%s EmoticonId=%s TitleId=%s "
        .. "SocialUrl=%s Tags=%s Platform=%s MasteryLevel=%s Status=%s",
        Str(p.PlayerId), Str(p.Username), Str(p.Title), Str(p.LogoId), Str(p.NameplateId), Str(p.EmoticonId),
        Str(p.TitleId), Str(p.SocialUrl), List(p.Tags), Str(p.CurrentPlatform), Str(p.MasteryLevel), Str(p.PlayerStatus))
    Log("WinRatingUpdate: Name=%s Change=%s Updated=%s Tier=%s->%s Status=%s Band=%s->%s",
        Str(r.RatingName), Str(r.RatingChangeAmount), Str(r.UpdatedRating), Str(r.PreviousTierId),
        Str(r.UpdatedTierId), Str(r.TierChangeStatus), Str(r.PreviousBand), Str(r.UpdatedBand))
    pcall(function()
        gpi.CharacterEquipmentList:ForEach(function(_, elem)
            local ce = elem:get()
            Log("  Character %s: Equipped=%s Reactions=%s", Str(ce.CharacterId),
                List(ce.Equipped, function(e) return Str(e.EntitlementType) .. ":" .. Str(e.AssetId) end),
                List(ce.Reactions, function(a) return Str(a.PrimaryAssetType.Name) .. ":" .. Str(a.PrimaryAssetName) end))
        end)
    end)
end

RegisterConsoleCommandHandler("dumpgpi", function(FullCommand, Parameters, Ar)
    ExecuteInGameThread(function()
        -- Reading the replicated copy's nested arrays on a client crashed the game; the server's copy is authoritative.
        if not GetGameMode() then
            Log("dumpgpi only works on the host")
            return
        end
        local states
        if Parameters[1] == "all" then
            states = FindAllOf("PMPlayerState") or {}
        else
            states = { GetHostPlayerState() }
        end
        for _, ps in pairs(states) do
            if ps and ps:IsValid() then
                local ok, err = pcall(DumpGamePlayerInfo, ps)
                if not ok then Log("dumpgpi error: %s", tostring(err)) end
            end
        end
    end)
    return true
end)

-- core [hz]: show the core's (APMRockCharacter) replication and smoothing settings; with hz, raise how often the
-- server sends it (NetUpdateFrequency, and MinNetUpdateFrequency so it can't throttle below that).
RegisterConsoleCommandHandler("core", function(FullCommand, Parameters, Ar)
    local hz = tonumber(Parameters[1])
    ExecuteInGameThread(function()
        local cores = FindAllOf("PMRockCharacter") or {}
        if #cores == 0 then
            Log("No core (PMRockCharacter) found; is a match running?")
            return
        end
        for _, core in ipairs(cores) do
            if core:IsValid() then
                if hz then
                    core.NetUpdateFrequency = hz
                    core.MinNetUpdateFrequency = hz
                end
                local cmc = core.CharacterMovement
                Log("%s: NetUpdateFrequency=%s MinNetUpdateFrequency=%s NetPriority=%s Smoothing=%s",
                    core:GetFullName(), tostring(core.NetUpdateFrequency), tostring(core.MinNetUpdateFrequency),
                    tostring(core.NetPriority), cmc and cmc:IsValid() and tostring(cmc.NetworkSmoothingMode) or "?")
            end
        end
    end)
    return true
end)

-- host <map> [format] [play|spectate]; the role can also come second, e.g. `host drums play`.
-- onGameThread: the caller is already running as a game-thread action (the tick).
-- It must not queue another one: UE4SS runs its single, shared game-thread queue with std::remove_if,
-- so appending to it from inside an action can reallocate the vector mid-iteration. That hung or crashed -atlasHost hosts at boot.
local HostedMap, HostedFormat = nil, nil -- keys of the last map/format opened, for info.json
local LastHostAt = nil -- os.time() of the last open, so auto host waits out a load already underway

local function Host(mapKey, formatKey, role, onGameThread)
    if formatKey == "play" or formatKey == "spectate" then
        formatKey, role = nil, formatKey
    end
    if role and role ~= "play" and role ~= "spectate" then
        return Fail("Unknown host role '%s' (use play or spectate)", role)
    end
    HostPlays = role == "play"

    mapKey = (mapKey or DEFAULT_MAP):lower()
    formatKey = (formatKey or (mapKey == "rgm" and "rgm" or DEFAULT_FORMAT)):lower()

    local map = GameData.Maps[mapKey]
    local format = GameData.Formats[formatKey]
    if not map then return Fail("Unknown map '%s'", mapKey) end
    if not format then return Fail("Unknown format '%s'", formatKey) end

    local function Open()
        local gi = GetGameInstance()
        if not gi then return Fail("PMGameInstance not found") end

        local formatData = LoadData("GameFormatData/" .. format)
        local mapData = LoadData("GameMapData/" .. map.map)
        local terrainData = LoadData("GameTerrainData/" .. map.terrain)
        local omegaModData = LoadData("OmegaModData/" .. DEFAULT_OMEGA_MOD)
        if not (formatData and mapData and terrainData and omegaModData) then return Fail("Failed to load game data") end

        gi.ChosenFormatData = formatData
        gi.ChosenMapData = mapData
        gi.ChosenTerrainData = terrainData
        gi.ChosenOmegaModData = omegaModData
        Log("Chosen data set: %s / %s / %s / %s", format, map.map, map.terrain, DEFAULT_OMEGA_MOD)

        local url = GAME_MAPS .. map.level .. "?listen"
        Log("Opening %s (listen port: the engine's -port=, default %d)", url, PORT)
        RunConsoleCommand("open " .. url)
        HostedMap, HostedFormat, LastHostAt = mapKey, formatKey, os.time()
        ReportGameState()
        return true, string.format("Opening %s (%s)", mapKey, formatKey)
    end

    if onGameThread then return Open() end
    ExecuteInGameThread(Open)
    return true
end

-- Client -> server identity: once connected, ATLASClientMod calls ServerChangeName("LSID:<backend player id>:<username>[<tab><FPlayerPublicProfile as ImportText>]").
-- The end-of-game summary matches players by backend ID, which a real server gets from GameLift.
-- This string format is the only contract between the two mods; keep it in sync with ATLASClientMod.
local IDENTITY_PATTERN = "^LSID:(%w+):([^\t]*)\t?(.*)$"

RegisterHook("/Script/Engine.PlayerController:ServerChangeName", function() end, function(Context, S)
    local ok, err = pcall(function()
        local id, name, profile = S:get():ToString():match(IDENTITY_PATTERN)
        if not id then return end
        local gm = GetGameMode()
        if not gm then return end -- only the server acts on it
        if profile ~= "" then PublicProfiles[id] = profile end
        local pc = Context:get()
        local ps = pc.PlayerState
        if not ps or not ps:IsValid() then return end
        ps.PMPlayerId = FName(id)
        -- The engine already applied the whole string as the name; replace it with just the username.
        gm:ChangeName(pc, name, false)
        Log("Identity: '%s' is backend player %s", name, id)
        Info.AddPlayer(id, name)
    end)
    if not ok then Log("Identity hook error: %s", tostring(err)) end
end)

local MatchPhases = GameData.MatchPhases

local function PhaseName(value)
    return MatchPhases[(value or -1) + 1] or tostring(value)
end

local function ParsePhase(arg)
    local n = tonumber(arg)
    if n then return MatchPhases[n + 1] and n or nil end
    for i, name in ipairs(MatchPhases) do
        if name:lower() == arg:lower() then return i - 1 end
    end
    return nil
end

-- Must run on the game thread.
local function SetPhase(arg)
    local gm = GetGameMode()
    if not gm then return Fail("PMGameModeGame not found (are you hosting?)") end
    if not arg then
        Log("Current phase: %s. Usage: phase <name|number>", PhaseName(gm.CurrentMatchPhase))
        return true, PhaseName(gm.CurrentMatchPhase)
    end
    local phase = ParsePhase(arg)
    if not phase then return Fail("Unknown phase '%s'", arg) end
    local message = string.format("Phase %s -> %s", PhaseName(gm.CurrentMatchPhase), PhaseName(phase))
    Log("%s", message)
    gm:RequestNewMatchPhase(phase)
    return true, message
end

RegisterConsoleCommandHandler("phase", function(FullCommand, Parameters, Ar)
    local arg = Parameters[1]
    ExecuteInGameThread(function() SetPhase(arg) end)
    return true
end)

RegisterConsoleCommandHandler("host", function(FullCommand, Parameters, Ar)
    local function Lower(s) return s and s:lower() end
    Host(Lower(Parameters[1]), Lower(Parameters[2]), Lower(Parameters[3]))
    return true
end)

RegisterKeyBind(Key.F8, function()
    Host(DEFAULT_MAP, DEFAULT_FORMAT)
end)

-- Host settings: launch args (case-insensitive), else these defaults. Only -atlasHost turns auto-hosting on.
--   -atlasHost                auto-host
--   -atlasMap=<map>           map key (see gamedata.lua)
--   -atlasMode=<format>       format key (see gamedata.lua)
--   -atlasMinPlayers=<n>      auto start once n players joined (0 = start manually)
--   -atlasStartDelay=<s>      wait after reaching minPlayers
--   -atlasMaxSets=<n>         sets to win the match
--   -atlasMaxRounds=<n>       goals to win a set
--   -atlasAutoEnd=<0|1>       send everyone to the menu at EndGame
--   -atlasEndDelay=<s>        wait into EndGame before that
--   -atlasEmptyRestart=<s>    restart a started match left empty this long (0 = never)
--   -atlasMaxFps=<n>          frame cap while auto-hosting (0 = uncapped, which crashed a headless host)
local function LoadHostConfig()
    local cmdLine = (LANServer_GetCommandLine and LANServer_GetCommandLine() or ""):lower()
    if not LANServer_GetCommandLine then
        Log("LANServer_GetCommandLine missing; is the mod's dlls/main.dll in place? Launch args are ignored")
    end
    local function Num(name, default)
        local value = tonumber(cmdLine:match("%-" .. name .. "=(%d+)"))
        if value == nil then return default end
        return value
    end
    local function Text(name, default)
        return cmdLine:match("%-" .. name .. "=(%w+)") or default
    end

    local config = {
        autoHost = cmdLine:find("%-atlashost%f[^%w]") ~= nil,
        map = Text("atlasmap", DEFAULT_MAP),
        format = Text("atlasmode", DEFAULT_FORMAT),
        role = "spectate",
        minPlayers = Num("atlasminplayers", 6),
        startDelaySeconds = Num("atlasstartdelay", 5),
        setsToWin = Num("atlasmaxsets", 3),
        goalsToWinSet = Num("atlasmaxrounds", 3),
        autoEnd = Num("atlasautoend", 1) ~= 0,
        endGameDelaySeconds = Num("atlasenddelay", 0),
        emptyRestartSeconds = Num("atlasemptyrestart", 5),
        maxFps = Num("atlasmaxfps", 768),
        -- The engine's own -port=<n> sets the listen port; read only to log it.
        port = Num("port", PORT),
    }
    return config
end

local HostConfig = LoadHostConfig()
MatchRules.setsToWin = HostConfig.setsToWin
MatchRules.goalsToWinSet = HostConfig.goalsToWinSet
Log("Host config: autoHost=%s port=%s maxFps=%s map=%s format=%s role=%s minPlayers=%s startDelay=%s setsToWin=%s "
    .. "goalsToWinSet=%s autoEnd=%s endDelay=%s emptyRestart=%s",
    tostring(HostConfig.autoHost), tostring(HostConfig.port), tostring(HostConfig.maxFps),
    tostring(HostConfig.map), tostring(HostConfig.format), tostring(HostConfig.role),
    tostring(HostConfig.minPlayers), tostring(HostConfig.startDelaySeconds),
    tostring(HostConfig.setsToWin), tostring(HostConfig.goalsToWinSet),
    tostring(HostConfig.autoEnd), tostring(HostConfig.endGameDelaySeconds), tostring(HostConfig.emptyRestartSeconds))

Info.Init(Log)

-- Everything below runs from one 1s game-thread tick (see the end of the file), which looks up the game mode once and hands it to each check.
-- Each check resets its own state when its phase isn't current.

-- Auto host: the listen host's own player never goes through PreLogin, so real players should join it remotely.
-- Hosts as soon as any non-match world is up with a local PlayerController (Host() runs `open` through it).
-- That's the first map at boot, before the menu's login flow, so a host never needs a backend login or Steam account.
-- Keeps running: whenever the host is back out of a match (e.g. after it ends), it hosts again.
local AUTO_HOST_RETRY_SECONDS = 30 -- don't re-issue Host while the previous open is still loading
local LastAutoHostAt = nil

local function CheckAutoHost(gm)
    if gm then return end
    local function Recent(at) return at and os.time() - at < AUTO_HOST_RETRY_SECONDS end
    if Recent(LastAutoHostAt) or Recent(LastHostAt) then return end
    -- A world with a game mode and our own controller in it (both come from the local controller).
    if not GetAuthorityGameMode() then return end

    LastAutoHostAt = os.time()
    -- A listen server ticks (and replicates) once per frame; uncapped, a headless host burns CPU for nothing.
    if (HostConfig.maxFps or 0) > 0 then RunConsoleCommand("t.MaxFPS " .. HostConfig.maxFps) end
    Log("Auto-hosting (frame cap %s)", tostring(HostConfig.maxFps or "none"))
    Host(HostConfig.map, HostConfig.format, HostConfig.role, true) -- already on the game thread (inside Tick)
end

-- Auto start: once minPlayers have joined (a spectating host doesn't count), wait startDelaySeconds and then do what
-- `gameinfo` + `forcestart` do. minPlayers = 0 leaves starting to those commands.
local AutoStartAt = nil
local AutoStartedFor = nil -- address of the game mode already started, so a slow phase change can't start it twice

local function CountJoinedPlayers(gm)
    local hostAddress = not HostPlays and GetHostAddress() or nil
    local count = 0
    for _, ps in ipairs(GetPlayerStates(gm)) do
        if ps:GetAddress() ~= hostAddress then count = count + 1 end
    end
    return count
end

local function CheckAutoStart(gm, phase)
    if not gm or phase ~= 0 or AutoStartedFor == gm:GetAddress() then
        AutoStartAt = nil
        return
    end

    local count = CountJoinedPlayers(gm)
    if count < HostConfig.minPlayers then
        if AutoStartAt then Log("Auto start: down to %d/%d players, waiting again", count, HostConfig.minPlayers) end
        AutoStartAt = nil
        return
    end
    if not AutoStartAt then
        AutoStartAt = os.time() + (HostConfig.startDelaySeconds or 0)
        Log("Auto start: %d/%d players, starting in %ds", count, HostConfig.minPlayers, HostConfig.startDelaySeconds or 0)
        return
    end
    if os.time() < AutoStartAt then return end

    AutoStartAt = nil
    AutoStartedFor = gm:GetAddress()
    Log("Auto start: starting with %d player(s)", count)
    Start()
end

-- Auto end: in EndGame a real server's EndGameSession shuts the process down through GameLift, which drops the clients back to their main menu.
-- Without GameLift everyone would sit in EndGame forever, so endGameDelaySeconds into it, send each client home through the engine's own return-to-menu RPC,
-- then take the host back too (where autoHost hosts the next match).
local END_GAME_PHASE = 14 -- EMatchPhase::EndGame
local HOST_LEAVE_DELAY_MS = 1000 -- lets the return-to-menu RPCs go out before the host's travel closes connections
local EndGameAt = nil
local EndedFor = nil -- address of the game mode already ended

local function CheckAutoEnd(gm, phase)
    if not gm or phase ~= END_GAME_PHASE or EndedFor == gm:GetAddress() then
        EndGameAt = nil
        return
    end
    if not EndGameAt then
        EndGameAt = os.time() + (HostConfig.endGameDelaySeconds or 0)
        Log("Auto end: match over, returning players to the main menu in %ds", HostConfig.endGameDelaySeconds or 0)
        return
    end
    if os.time() < EndGameAt then return end

    EndGameAt = nil
    EndedFor = gm:GetAddress()
    local reason = FText("The match has ended.")
    for _, pc in ipairs(GetRemoteControllers(gm)) do
        Log("Auto end: returning %s to the main menu", pc:GetFullName())
        pc:ClientReturnToMainMenuWithTextReason(reason)
    end
    ExecuteWithDelay(HOST_LEAVE_DELAY_MS, function()
        ExecuteInGameThread(function()
            Log("Auto end: host returning to the main menu")
            RunConsoleCommand("open " .. MAIN_MENU)
        end)
    end)
end

-- Empty restart: A started match (phase past None) that has had no connected players for emptyRestartSeconds goes back to the main menu, where autoHost hosts a fresh one.
-- The game's own empty-server timer ends the session through GameLift, which does nothing here.
-- Counts remote PlayerControllers: A leaving player's PlayerState can linger.
local EmptySince = nil
local EmptyRestartedFor = nil -- address of the game mode already restarted

local function CheckEmptyRestart(gm, phase)
    if not gm or phase == 0 or EmptyRestartedFor == gm:GetAddress() or #GetRemoteControllers(gm) > 0 then
        EmptySince = nil
        return
    end
    if not EmptySince then
        EmptySince = os.time()
        Log("Empty restart: no players left, restarting in %ds unless someone rejoins", HostConfig.emptyRestartSeconds)
        return
    end
    if os.time() - EmptySince < HostConfig.emptyRestartSeconds then return end

    EmptySince = nil
    EmptyRestartedFor = gm:GetAddress()
    Log("Empty restart: returning to the main menu")
    RunConsoleCommand("open " .. MAIN_MENU)
end

-- The checks this config turns on, with the label their errors are logged under.
local Checks = {}
if HostConfig.autoHost then Checks[#Checks + 1] = { "Auto host", CheckAutoHost } end
if (HostConfig.minPlayers or 0) > 0 then Checks[#Checks + 1] = { "Auto start", CheckAutoStart } end
if HostConfig.autoEnd then Checks[#Checks + 1] = { "Auto end", CheckAutoEnd } end
if (HostConfig.emptyRestartSeconds or 0) > 0 then Checks[#Checks + 1] = { "Empty restart", CheckEmptyRestart } end

-- Commands from $TEMP/ATLAS/commands.jsonl (see commands.lua), one per tick, with results in info.json.
-- Same names and args as the console commands. They run on the tick's game thread.
local function RequireGameMode()
    if not GetGameMode() then return Fail("PMGameModeGame not found (are you hosting?)") end
    return true
end

Commands.Init(Log, {
    host = function(map, format, role)
        local function Lower(s) return s and s:lower() end
        return Host(Lower(map), Lower(format), Lower(role), true)
    end,
    gameinfo = function(...)
        if not RequireGameMode() then return false, "Not hosting" end
        return ApplyGameInfo({ ... })
    end,
    forcestart = ForceStart,
    start = Start,
    stop = ForceStop,
    forcestop = ForceStop,
    phase = SetPhase,
}, Info.AddCommandResult)
Checks[#Checks + 1] = { "Commands", function() Commands.Step() end }

-- Match state for info.json; Info only writes when it changed.
local function UpdateInfo(gm, phase)
    local hostAddress = GetHostAddress()
    local players = {}
    for _, ps in ipairs(GetPlayerStates(gm)) do
        if ps:GetAddress() ~= hostAddress then
            local ok, name = pcall(function() return Str(ps.PlayerNamePrivate) end)
            players[#players + 1] = { playerId = Str(ps.PMPlayerId), username = ok and name or Info.null }
        end
    end
    Info.SetMatch({
        hosting = gm ~= nil,
        map = gm and HostedMap or Info.null,
        format = gm and HostedFormat or Info.null,
        phase = gm and PhaseName(phase) or Info.null,
        setsToWin = MatchRules.setsToWin or Info.null,
        goalsToWinSet = MatchRules.goalsToWinSet or Info.null,
        players = players,
    })
end
Checks[#Checks + 1] = { "Info", UpdateInfo }

-- Tick timing, since a headless host can't show its own hitches: each tick runs inside one server frame, so a slow one stalls replication for every client.
-- Logs any tick over SLOW_TICK_MS, plus a summary every TICK_REPORT_SECONDS.
local SLOW_TICK_MS = 2
local TICK_REPORT_SECONDS = 60
local TickStats = { count = 0, totalMs = 0, maxMs = 0, since = os.time() }

local function Tick()
    local started = os.clock()
    local gm = GetGameMode()
    local lookupMs = (os.clock() - started) * 1000
    local phase = gm and gm.CurrentMatchPhase
    for _, check in ipairs(Checks) do
        local ok, err = pcall(check[2], gm, phase)
        if not ok then Log("%s error: %s", check[1], tostring(err)) end
    end

    local ms = (os.clock() - started) * 1000
    TickStats.count = TickStats.count + 1
    TickStats.totalMs = TickStats.totalMs + ms
    TickStats.maxMs = math.max(TickStats.maxMs, ms)
    if ms > SLOW_TICK_MS then
        Log("Slow tick: %.1f ms (game mode lookup %.1f ms, phase %s)", ms, lookupMs, tostring(phase))
    end
    if os.time() - TickStats.since >= TICK_REPORT_SECONDS then
        Log("Tick stats: %d ticks, avg %.2f ms, max %.1f ms", TickStats.count, TickStats.totalMs / TickStats.count,
            TickStats.maxMs)
        TickStats.count, TickStats.totalMs, TickStats.maxMs, TickStats.since = 0, 0, 0, os.time()
    end
end

if #Checks > 0 then
    LoopAsync(1000, function()
        ExecuteInGameThread(Tick)
        return false
    end)
end
