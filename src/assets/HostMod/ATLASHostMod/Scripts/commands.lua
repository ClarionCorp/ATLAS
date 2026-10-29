-- Runs commands other programs queue in $TEMP/ATLAS/commands.jsonl: one JSON object per line, appended, e.g.
--   {"id": "1", "command": "host", "args": ["drums", "normal"]}
-- Write each command as one complete line.

-- Each poll takes the whole file by renaming it, which is atomic and fails while a writer still has it open, so nothing appended is lost.
-- Later lines just land in a new file for the next poll.
-- Taken commands wait in a queue and run one per Step, so e.g. a `host` and the next command never share a frame.
local Commands = {}

local Log = function() end
local OnResult = function() end
local Handlers = {}
local QueuePath, TakenPath = nil, nil
local Queue = {}

-- Minimal JSON decoder (objects, arrays, strings, numbers, true/false/null). Errors with a message on bad input.
local ESCAPES = { b = "\b", f = "\f", n = "\n", r = "\r", t = "\t", ['"'] = '"', ["\\"] = "\\", ["/"] = "/" }
local LITERALS = { { "true", true }, { "false", false }, { "null", nil } }

local function Decode(s)
    local pos = 1
    local function Fail(what) error(string.format("%s at character %d", what, pos), 0) end
    local function Skip() pos = s:find("[^ \t\r\n]", pos) or #s + 1 end
    local function Peek() return s:sub(pos, pos) end

    local function String()
        pos = pos + 1
        local out = {}
        while true do
            local c = Peek()
            if c == "" then Fail("unterminated string") end
            if c == '"' then
                pos = pos + 1
                return table.concat(out)
            elseif c == "\\" then
                local e = s:sub(pos + 1, pos + 1)
                if e == "u" then
                    local hex = s:match("^%x%x%x%x", pos + 2)
                    if not hex then Fail("bad \\u escape") end
                    out[#out + 1] = utf8.char(tonumber(hex, 16))
                    pos = pos + 6
                elseif ESCAPES[e] then
                    out[#out + 1] = ESCAPES[e]
                    pos = pos + 2
                else
                    Fail("bad escape")
                end
            else
                local chunk = s:match('^[^"\\]+', pos)
                out[#out + 1] = chunk
                pos = pos + #chunk
            end
        end
    end

    local Value

    -- Shared by objects and arrays: reads items until the closing bracket.
    local function Items(close, readItem)
        pos = pos + 1
        Skip()
        if Peek() == close then
            pos = pos + 1
            return
        end
        while true do
            readItem()
            Skip()
            local sep = Peek()
            pos = pos + 1
            if sep == close then return end
            if sep ~= "," then Fail("expected ',' or '" .. close .. "'") end
            Skip()
        end
    end

    function Value()
        Skip()
        local c = Peek()
        if c == "{" then
            local obj = {}
            Items("}", function()
                if Peek() ~= '"' then Fail("expected a key") end
                local key = String()
                Skip()
                if Peek() ~= ":" then Fail("expected ':'") end
                pos = pos + 1
                obj[key] = Value()
            end)
            return obj
        elseif c == "[" then
            local arr = {}
            Items("]", function() arr[#arr + 1] = Value() end)
            return arr
        elseif c == '"' then
            return String()
        end
        for _, literal in ipairs(LITERALS) do
            local word = literal[1]
            if s:sub(pos, pos + #word - 1) == word then
                pos = pos + #word
                return literal[2]
            end
        end
        local number = s:match("^-?%d[%d%.eE+-]*", pos)
        if number and tonumber(number) then
            pos = pos + #number
            return tonumber(number)
        end
        Fail("unexpected '" .. c .. "'")
    end

    local value = Value()
    Skip()
    if pos <= #s then Fail("trailing data") end
    return value
end

-- Reads and deletes the taken file, queueing each valid line. False when there's no taken file.
local function ReadTaken()
    local f = io.open(TakenPath, "r")
    if not f then return false end
    local text = f:read("a")
    f:close()
    os.remove(TakenPath)

    text = text:gsub("^\239\187\191", "") -- UTF-8 BOM, which Windows PowerShell 5.1 adds
    for line in text:gmatch("[^\r\n]+") do
        if line:find("%S") then
            local ok, cmd = pcall(Decode, line)
            if ok and type(cmd) == "table" and type(cmd.command) == "string" then
                Queue[#Queue + 1] = cmd
            else
                local message = ok and 'not an object with a "command"' or cmd
                Log("Bad command line (%s): %s", message, line)
                OnResult({ id = ok and type(cmd) == "table" and cmd.id or nil, ok = false, message = message })
            end
        end
    end
    return true
end

-- handlers: command name (lowercase) -> function(...string args) returning ok, message; a nil ok counts as success.
-- Handlers run on the game thread (Step is called from the tick), so they must not queue game-thread actions of their own.
-- onResult(result) gets { id, command, args, ok, message } for every command, bad lines included.
function Commands.Init(log, handlers, onResult)
    Log = log
    Handlers = handlers
    OnResult = onResult
    local dir = (os.getenv("TEMP") or ".") .. "\\ATLAS"
    QueuePath = dir .. "\\commands.jsonl"
    TakenPath = dir .. "\\commands.taking.jsonl"
    Log("Reading commands from %s", QueuePath)
end

-- Takes any new commands, then runs the oldest queued one. Call once per tick, on the game thread.
function Commands.Step()
    if not QueuePath then return end
    -- A taken file still there (the last read didn't finish) is read before taking a new one.
    if not ReadTaken() and os.rename(QueuePath, TakenPath) then ReadTaken() end

    local cmd = table.remove(Queue, 1)
    if not cmd then return end
    local args = {}
    for i, v in ipairs(type(cmd.args) == "table" and cmd.args or {}) do args[i] = tostring(v) end
    local name = cmd.command:lower()

    local handler = Handlers[name]
    local ok, message
    if not handler then
        ok, message = false, "Unknown command"
    else
        local success, result, text = pcall(handler, table.unpack(args))
        if success then
            ok, message = result ~= false, text
        else
            ok, message = false, tostring(result)
        end
    end
    Log("Command %s %s: %s%s", name, table.concat(args, " "), ok and "ok" or "FAILED",
        message and (" - " .. tostring(message)) or "")
    OnResult({ id = cmd.id, command = name, args = args, ok = ok, message = message })
end

return Commands
