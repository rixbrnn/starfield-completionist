ScriptName Completionist:MenuBridge extends Quest
{Connects Completionist:QuestTracker to the OSF UI menu (view "completionist/menu").
Attached to the same quest as the tracker. Needs OSF UI and OSF Settings: without them this
script fails to load and the tracker keeps working on its own (notifications only).}

String Property ModId = "completionist" AutoReadOnly
String Property MenuView = "completionist/menu" AutoReadOnly
String Property OpenHotkey = "open" AutoReadOnly

Completionist:QuestTracker Function Tracker()
  Return (Self as Quest) as Completionist:QuestTracker
EndFunction

; OnInit (not OnQuestInit) so the bridge also starts in saves where the quest is already running.
Event OnInit()
  Actor player = Game.GetPlayer()
  RegisterForRemoteEvent(player, "OnPlayerLoadGame")
  RegisterForRemoteEvent(player, "OnLocationChange")
  RegisterForCustomEvent(Tracker(), "StatusChanged")
  Register()
EndEvent

Event Actor.OnPlayerLoadGame(Actor akSender)
  Register()
EndEvent

; OSF UI and OSF Settings forget registrations and state on every load, so redo them each session.
Function Register()
  If !OSFUI.IsAvailable()
    Return
  EndIf
  ; "close" from the page is handled by OSF UI itself (the name is reserved).
  OSFUI.RegisterSend(Self, ModId, "track")
  OSFUI.RegisterSend(Self, ModId, "plot")
  OSFUI.RegisterSend(Self, ModId, "untrack")
  OSFUI.RegisterSend(Self, ModId, "override")
  OSFUI.RegisterSend(Self, ModId, "plotLocation")
  OSFUI.RegisterSend(Self, ModId, "objectives")
  OSFUI.RegisterSend(Self, ModId, "plotObjective")
  OSFUI.RegisterSend(Self, ModId, "log")
  OSFUI.RegisterSend(Self, ModId, "explored")
  OSFUI.RegisterSend(Self, ModId, "resolve")
  OSFSettings.RegisterHotkey(Self, ModId, OpenHotkey)
  ; Until the tracker's refresh finishes, statuses are incomplete; StatusChanged publishes them then.
  If Tracker().IsReady()
    PublishStatus()
    PublishTracked()
  EndIf
  PublishLocation(Game.GetPlayer().GetCurrentLocation())
EndFunction

Event Completionist:QuestTracker.StatusChanged(Completionist:QuestTracker akSender, Var[] akArgs)
  PublishStatus()
  PublishTracked()
EndEvent

Event Actor.OnLocationChange(Actor akSender, Location akOldLoc, Location akNewLoc)
  PublishLocation(akNewLoc)
EndEvent

Function OnOSFHotkey(String asModId, String asHotkeyId)
  If asHotkeyId == OpenHotkey
    ; Open first so the menu appears immediately; the location follows a moment later.
    OSFUI.Open(MenuView)
    PublishLocation(Game.GetPlayer().GetCurrentLocation())
    ; The player may have changed tracking in the game's own Missions menu.
    If Tracker().IsReady()
      PublishTracked()
    EndIf
  EndIf
EndFunction

; From the menu: osfui.send("track", questId) sets a started quest as the active mission;
; osfui.send("plot", questId) opens the starmap with a course to where the quest starts.
Function OnOSFUISend(String asName, Var[] akArgs, String asSourceViewId)
  If akArgs == None || akArgs.Length == 0
    Return
  EndIf
  ; osfui.send("plotLocation", localFormId, plugin): open the starmap with a course to a location.
  If asName == "plotLocation" && akArgs.Length >= 2
    Location target = Game.GetFormFromFile(akArgs[0] as Int, akArgs[1] as String) as Location
    If target
      OSFUI.Close(MenuView)
      Game.ShowGalaxyStarMapMenuAndPlotToLocation(target)
    EndIf
    Return
  EndIf
  ; osfui.send("log", text): a diagnostic line from the menu, written to the mod's user log.
  If asName == "log"
    Debug.TraceUser("Completionist", "menu: " + (akArgs[0] as String))
    Return
  EndIf
  ; osfui.send("explored", batch, plugin, localFormId, ...): which of these locations the player
  ; has ever explored, for hiding the names of places not seen yet. Replies with the event
  ; "explored" [batch, explored?, ...] in the same order.
  If asName == "explored" && akArgs.Length >= 2
    String plugin = akArgs[1] as String
    Var[] result = new Var[akArgs.Length - 1]
    result[0] = akArgs[0]
    Int i = 2
    While i < akArgs.Length
      Location place = Game.GetFormFromFile(akArgs[i] as Int, plugin) as Location
      result[i - 1] = place != None && place.HasEverBeenExplored()
      i += 1
    EndWhile
    OSFUI.EmitEvent(ModId, "explored", result)
    Return
  EndIf
  ; osfui.send("override", questId, value): 0 = automatic, 1 = mark done, 2 = mark not done.
  If asName == "override" && akArgs.Length >= 2
    Tracker().SetOverride(akArgs[0] as String, akArgs[1] as Int)
    Return
  EndIf
  Completionist:QuestData:Entry entry = FindEntry(akArgs[0] as String)
  If entry == None
    Return
  EndIf

  If asName == "track" || asName == "untrack"
    ; Keeps the menu open (the player may want to show it on the map next) and reports
    ; whether the game actually accepted it, since SetActive can be refused silently.
    Bool wanted = asName == "track"
    Quest q = entry.questForm
    Bool wasActive = q.IsActive()
    If !wanted || (q.IsRunning() && !q.IsCompleted())
      q.SetActive(wanted)
    EndIf
    Bool nowActive = q.IsActive()
    Debug.TraceUser("Completionist", asName + " " + entry.name + " [" + entry.id + "]: running=" + q.IsRunning() + " completed=" + q.IsCompleted() + " active " + wasActive + " -> " + nowActive)
    Var[] result = new Var[3]
    result[0] = entry.id
    result[1] = nowActive
    result[2] = wanted
    OSFUI.EmitEvent(ModId, "tracked", result)
    PublishTracked()
  ElseIf asName == "objectives"
    ; osfui.send("objectives", questId, objective, objective, …): reports each objective as
    ; 0 = not shown, 1 = shown, 2 = completed, 3 = failed, so the menu can list the ones the
    ; mission log shows. Most aren't shown, which takes a single call to find out.
    Quest q = entry.questForm
    Int count = akArgs.Length
    If count > 128
      count = 128
    EndIf
    Var[] result = new Var[count]
    result[0] = entry.id
    Int i = 1
    While i < count
      Int objective = akArgs[i] as Int
      Int shown = 0
      If q.IsObjectiveDisplayed(objective)
        shown = 1
        If q.IsObjectiveCompleted(objective)
          shown = 2
        ElseIf q.IsObjectiveFailed(objective)
          shown = 3
        EndIf
      EndIf
      result[i] = shown
      i += 1
    EndWhile
    OSFUI.EmitEvent(ModId, "objectives", result)
  ElseIf asName == "resolve"
    ; osfui.send("resolve", questId, kind, id, plugin, kind, id, plugin, ...): what fills the
    ; placeholders of an objective's text. kind 1: location alias (its location), 2: reference
    ; alias (its base object and current location), 3: global variable (id/plugin: its form; its
    ; value). Replies with the event "resolved" [questId, a, b, a, b, ...]: two ints per token.
    Quest q = entry.questForm
    Int count = (akArgs.Length - 1) / 3
    Var[] result = new Var[1 + count * 2]
    result[0] = entry.id
    Int i = 0
    While i < count
      Int kind = akArgs[1 + i * 3] as Int
      Int id = akArgs[2 + i * 3] as Int
      Int a = 0
      Int b = 0
      If kind == 1
        LocationAlias locAlias = q.GetAlias(id) as LocationAlias
        Location where = None
        If locAlias
          where = locAlias.GetLocation()
        EndIf
        If where
          a = where.GetFormID()
        EndIf
      ElseIf kind == 2
        ReferenceAlias refAlias = q.GetAlias(id) as ReferenceAlias
        ObjectReference ref = None
        If refAlias
          ref = refAlias.GetRef()
        EndIf
        If ref
          Form base = ref.GetBaseObject()
          If base
            a = base.GetFormID()
          EndIf
          Location refWhere = ref.GetCurrentLocation()
          If refWhere
            b = refWhere.GetFormID()
          EndIf
        EndIf
      ElseIf kind == 3
        GlobalVariable counter = Game.GetFormFromFile(id, akArgs[3 + i * 3] as String) as GlobalVariable
        If counter
          a = counter.GetValueInt()
          b = 1
        EndIf
      EndIf
      result[1 + i * 2] = a
      result[2 + i * 2] = b
      i += 1
    EndWhile
    OSFUI.EmitEvent(ModId, "resolved", result)
  ElseIf asName == "plotObjective" && akArgs.Length >= 2
    ; osfui.send("plotObjective", questId, aliasId): a course to where the objective's target is now.
    Location target = AliasLocation(entry.questForm.GetAlias(akArgs[1] as Int))
    If target
      OSFUI.Close(MenuView)
      Game.ShowGalaxyStarMapMenuAndPlotToLocation(target)
    Else
      Var[] failed = new Var[1]
      failed[0] = entry.id
      OSFUI.EmitEvent(ModId, "plotFailed", failed)
    EndIf
  ElseIf asName == "plot"
    If entry.startLocation
      OSFUI.Close(MenuView)
      Game.ShowGalaxyStarMapMenuAndPlotToLocation(entry.startLocation)
    Else
      Debug.Notification("No known start location for " + entry.name)
    EndIf
  EndIf
EndFunction

; Where an objective target is: the location of a reference alias's reference, or a location alias's location.
; A disabled reference hasn't been put in place yet (it may sit in a holding cell), so it has none.
Location Function AliasLocation(Alias akAlias)
  ReferenceAlias refAlias = akAlias as ReferenceAlias
  If refAlias
    ObjectReference ref = refAlias.GetRef()
    If ref && !ref.IsDisabled()
      Return ref.GetCurrentLocation()
    EndIf
    Return None
  EndIf
  LocationAlias locAlias = akAlias as LocationAlias
  If locAlias
    Return locAlias.GetLocation()
  EndIf
  Return None
EndFunction

; Papyrus string comparison ignores case, so ids match however the engine interned them.
Completionist:QuestData:Entry Function FindEntry(String asId)
  Completionist:QuestTracker tracker = Tracker()
  Int p = 0
  While p < tracker.MaxPages
    Completionist:QuestData:Entry[] entries = tracker.GetPage(p)
    Int i = 0
    While i < entries.Length
      If entries[i].id == asId
        Return entries[i]
      EndIf
      i += 1
    EndWhile
    p += 1
  EndWhile
  Return None
EndFunction

; Publishes the ids of tracked quests. Only quests in progress can be tracked, so only
; those are asked (IsActive), which keeps this cheap enough to run on every menu open.
Function PublishTracked()
  Completionist:QuestTracker tracker = Tracker()
  String[] ids = new String[0]
  Int p = 0
  While p < tracker.MaxPages
    Completionist:QuestData:Entry[] entries = tracker.GetPage(p)
    Int i = 0
    While i < entries.Length && ids.Length < 128
      If entries[i].status == tracker.kInProgress && entries[i].questForm.IsActive()
        ids.Add(entries[i].id)
      EndIf
      i += 1
    EndWhile
    p += 1
  EndWhile
  OSFUI.SetStateStrings(ModId, "tracked", ids)
EndFunction

; Publishes quest ids and statuses page by page ("ids0"/"status0" …), since Papyrus arrays
; hold at most 128 elements. The menu joins the pages back together.
Function PublishStatus()
  Completionist:QuestTracker tracker = Tracker()
  Int pages = tracker.MaxPages
  OSFUI.SetState(ModId, "unityEntered", tracker.IsUnityEntered())
  ; Fetched once: calls into the tracker script per quest would each wait for it.
  String[] overridden = tracker.GetOverrideIds()
  ; The game's own activity counter (it also counts small errands the menu leaves out).
  OSFUI.SetState(ModId, "gameActivities", Game.QueryStat("Activities Completed"))
  Int p = 0
  While p < pages
    Completionist:QuestData:Entry[] entries = tracker.GetPage(p)
    String[] ids = new String[0]
    Int[] statuses = new Int[0]
    Int i = 0
    While i < entries.Length
      ids.Add(entries[i].id)
      ; +10 flags a manual override so the menu can show it.
      Int status = entries[i].status
      If overridden.Find(entries[i].id) >= 0
        status += 10
      EndIf
      statuses.Add(status)
      i += 1
    EndWhile
    OSFUI.SetStateStrings(ModId, "ids" + p, ids)
    OSFUI.SetStateInts(ModId, "status" + p, statuses)
    p += 1
  EndWhile
  ; Last, so the menu reads complete pages.
  OSFUI.SetState(ModId, "pages", pages)
EndFunction

; Publishes the FormIDs of the player's location and all its parents (most specific first),
; so the menu's Here tab can find the hub, planet and system.
Function PublishLocation(Location akLocation)
  Int[] ids = new Int[0]
  AddLocationChain(ids, akLocation)
  ; Aboard a ship in space, the player's location is the ship's own interior, which isn't
  ; part of the system's location tree. Add where the ship is (orbit / system) after it,
  ; so the player's own location still wins when it's a tracked place.
  SpaceshipReference ship = Game.GetPlayerHomeSpaceShip()
  If ship
    AddLocationChain(ids, ship.GetCurrentLocation())
  EndIf
  OSFUI.SetStateInts(ModId, "location", ids)

  Actor player = Game.GetPlayer()
  OSFUI.SetState(ModId, "inSpace", player.IsInSpace())
  Planet currentPlanet = player.GetCurrentPlanet()
  If !currentPlanet && ship
    currentPlanet = ship.GetCurrentPlanet()
  EndIf
  Float survey = -1.0
  If currentPlanet
    survey = currentPlanet.GetSurveyPercent()
  EndIf
  OSFUI.SetState(ModId, "survey", survey)
EndFunction

Function AddLocationChain(Int[] aiIds, Location akLocation)
  If !akLocation
    Return
  EndIf
  aiIds.Add(akLocation.GetFormID())
  Location[] parents = akLocation.GetParentLocations()
  Int i = 0
  While i < parents.Length && aiIds.Length < 120
    aiIds.Add(parents[i].GetFormID())
    i += 1
  EndWhile
EndFunction
