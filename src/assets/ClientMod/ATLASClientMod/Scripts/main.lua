local ModName = "ATLASClientMod"
local ModVersion = "1.0.1"

print(string.format("\n=== %s v%s Loaded ===\n", ModName, ModVersion))

-- Joins ATLAS Servers: `connect <ip>[:port]`. Leave with `disconnect`.
-- Custom DLL has native functions for getting the user's profile safely and efficiently. (LANClient_GetProfile)

local UEHelpers = require("UEHelpers")

local PORT = 7777
local CONNECT_POLL_MS = 500
local CONNECT_TIMEOUT_TRIES = 120 -- 60 s at CONNECT_POLL_MS

-- Client -> server identity, sent through APlayerController::ServerChangeName once connected:
-- "LSID:<odyPlayerId>:<username>[<tab><FPlayerPublicProfile as ImportText>]".
-- This string format is the only contract between the two mods; keep it in sync with ATLASHostMod's identity hook.
local IDENTITY_PREFIX = "LSID:"

local function Log(fmt, ...)
    print(string.format("[%s] " .. fmt .. "\n", ModName, ...))
end

-- UEHelpers.GetPlayerController requires a possessive character, which the main menu doesn't have.
local function GetLocalPlayerController()
    for _, pc in pairs(FindAllOf("PlayerController") or {}) do
        if pc:IsValid() and pc:IsLocalController() then return pc end
    end
    return nil
end

local function RunConsoleCommand(cmd)
    local pc = GetLocalPlayerController()
    if not pc then
        Log("No local PlayerController found")
        return
    end
    UEHelpers.GetKismetSystemLibrary():ExecuteConsoleCommand(pc, cmd, pc)
end

-- Fetch local Odyssey player information about the account to replicate on the ATLAS Server
-- Must run on the game thread.
local function LocalProfile()
    if not LANClient_GetProfile then
        Log("LANClient_GetProfile missing; is LANClientMod's dlls/main.dll in place?")
        return nil
    end
    local username, playerId, profileText = LANClient_GetProfile()
    local name = (username or ""):gsub("[%?=#]", "")
    if name == "" then return nil end
    return name, (playerId ~= "" and playerId or nil), (profileText ~= "" and profileText or nil)
end

-- Bumped by every join, so a slow earlier join stops waiting instead of sending its identity to the newer server.
local JoinGeneration = 0

-- Once the game map's local PlayerController and its PlayerState exist, send the identity string.
local function SendIdentityWhenConnected(identity, generation)
    local tries = 0
    LoopAsync(CONNECT_POLL_MS, function()
        tries = tries + 1
        if generation ~= JoinGeneration then return true end
        if tries > CONNECT_TIMEOUT_TRIES then
            Log("Never reached the game map; name not sent")
            return true
        end
        local done = false
        ExecuteInGameThread(function()
            if done or generation ~= JoinGeneration then return end
            local pc = FindFirstOf("PMPlayerControllerGame")
            if not (pc and pc:IsValid() and pc:IsLocalController() and pc.PlayerState and pc.PlayerState:IsValid()) then
                return
            end
            done = true
            JoinGeneration = JoinGeneration + 1 -- this join is finished; ends the loop on its next pass
            Log("Connected; sending identity to the server")
            pc:ServerChangeName(identity)
        end)
        return false
    end)
end

local function Join(address)
    if not address or address == "" then
        Log("Usage: join <ip>[:port]")
        return
    end
    if not address:find(":") then
        address = address .. ":" .. PORT
    end
    JoinGeneration = JoinGeneration + 1
    local generation = JoinGeneration
    ExecuteInGameThread(function()
        -- ?Name= can't carry the username: the login handshake overwrites it with the local player's nickname,
        -- which here is the account ID. So once connected, rename through APlayerController::ServerChangeName.
        -- With the backend ID too, the server sets PMPlayerId to it, which the end-of-game summary needs to find the local player. 
        -- Read before leaving the menu, while the profile cache is certainly there.
        local name, playerId, profileText = LocalProfile()
        local identity = name
        if not name then
            Log("Username not available; the server will show your account ID")
        elseif playerId then
            identity = IDENTITY_PREFIX .. playerId .. ":" .. name .. (profileText and ("\t" .. profileText) or "")
        end
        Log("Joining %s", address)
        RunConsoleCommand("open " .. address)
        if identity then SendIdentityWhenConnected(identity, generation) end
    end)
end

for _, command in ipairs({ "join", "connect" }) do
    RegisterConsoleCommandHandler(command, function(FullCommand, Parameters, Ar)
        Join(Parameters[1])
        return true
    end)
end

-- -atlasJoin=<ip[:port]>: join once the menu is up and the profile is cached.
local AUTO_JOIN_POLL_MS = 1000
local AUTO_JOIN_TIMEOUT_TRIES = 60

local function AutoJoinAddress()
    local cmdLine = LANClient_GetCommandLine and LANClient_GetCommandLine() or ""
    return cmdLine:lower():match("%-atlasjoin=([%w%.%-:]+)")
end

local function StartAutoJoin(address)
    Log("Auto-joining %s once logged in", address)
    local tries, ready = 0, false
    LoopAsync(AUTO_JOIN_POLL_MS, function()
        tries = tries + 1
        if ready or tries > AUTO_JOIN_TIMEOUT_TRIES then
            if not ready then Log("Auto-join: no profile after %ds, joining anyway", AUTO_JOIN_TIMEOUT_TRIES) end
            -- Called from here, not from the game-thread check below: Join queues its own game-thread action.
            Join(address)
            return true
        end
        ExecuteInGameThread(function()
            if not ready and GetLocalPlayerController() and LocalProfile() then ready = true end
        end)
        return false
    end)
end

local autoJoinAddress = AutoJoinAddress()
if autoJoinAddress then StartAutoJoin(autoJoinAddress) end
