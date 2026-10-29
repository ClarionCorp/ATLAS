-- Writes $TEMP/ATLAS/info.json: every player that connected this session (added once each, when their identity
-- arrives) and the current match state (rewritten only when it changes). Takes plain Lua values, no UObjects.
local Info = {}

-- Stands in for a JSON null, since a nil table field just disappears.
Info.null = setmetatable({}, { __tostring = function() return "null" end })

local Log = function() end
local FilePath = nil
local Players = {}
local KnownPlayerIds = {}
local Match = {}
local LastMatchJson = nil
local CommandResults = {}

local function Now()
    return os.date("!%Y-%m-%dT%H:%M:%SZ")
end

local ESCAPES = { ['"'] = '\\"', ['\\'] = '\\\\', ['\n'] = '\\n', ['\r'] = '\\r', ['\t'] = '\\t' }

local function EncodeString(s)
    return '"' .. s:gsub('[%c"\\]', function(c)
        return ESCAPES[c] or string.format("\\u%04x", c:byte())
    end) .. '"'
end

-- Tables with a [1] (or empty ones) are arrays; others are objects with sorted keys, so output is stable.
local function Encode(value, indent)
    if value == nil or value == Info.null then return "null" end
    local kind = type(value)
    if kind == "boolean" or kind == "number" then return tostring(value) end
    if kind == "string" then return EncodeString(value) end
    if kind ~= "table" then return EncodeString(tostring(value)) end

    indent = indent or ""
    local inner = indent .. "  "
    local items = {}
    if value[1] ~= nil or next(value) == nil then
        for i, v in ipairs(value) do items[i] = inner .. Encode(v, inner) end
        if #items == 0 then return "[]" end
        return "[\n" .. table.concat(items, ",\n") .. "\n" .. indent .. "]"
    end
    local keys = {}
    for k in pairs(value) do keys[#keys + 1] = tostring(k) end
    table.sort(keys)
    for i, k in ipairs(keys) do items[i] = inner .. EncodeString(k) .. ": " .. Encode(value[k], inner) end
    return "{\n" .. table.concat(items, ",\n") .. "\n" .. indent .. "}"
end

local function Write()
    if not FilePath then return end
    local f = io.open(FilePath, "w")
    if not f then
        Log("Failed to write %s", FilePath)
        return
    end
    f:write(Encode({ updatedAt = Now(), match = Match, players = Players, commands = CommandResults }), "\n")
    f:close()
end

function Info.Init(log)
    Log = log
    local dir = (os.getenv("TEMP") or ".") .. "\\ATLAS"
    pcall(function() os.execute('mkdir "' .. dir .. '" 2>nul') end)
    FilePath = dir .. "\\info.json"
    Log("Writing info to %s", FilePath)
    Write()
end

-- Records a player the first time their ID is seen this session; later calls for the same ID are ignored.
function Info.AddPlayer(playerId, username)
    if KnownPlayerIds[playerId] then return end
    KnownPlayerIds[playerId] = true
    Players[#Players + 1] = { playerId = playerId, username = username, joinedAt = Now() }
    Write()
end

-- Results of commands from commands.jsonl, newest last, capped so the file stays small.
local MAX_COMMAND_RESULTS = 20

function Info.AddCommandResult(result)
    result.at = Now()
    CommandResults[#CommandResults + 1] = result
    if #CommandResults > MAX_COMMAND_RESULTS then table.remove(CommandResults, 1) end
    Write()
end

-- Replaces the match state; only writes when it differs from the last one.
function Info.SetMatch(state)
    local json = Encode(state)
    if json == LastMatchJson then return end
    LastMatchJson = json
    Match = state
    Write()
end

return Info
