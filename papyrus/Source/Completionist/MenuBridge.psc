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
  OSFUI.RegisterSend(Self, ModId, "override")
  OSFUI.RegisterSend(Self, ModId, "plotLocation")
  OSFSettings.RegisterHotkey(Self, ModId, OpenHotkey)
  ; Until the tracker's refresh finishes, statuses are incomplete; StatusChanged publishes them then.
  If Tracker().IsReady()
    PublishStatus()
  EndIf
  PublishLocation(Game.GetPlayer().GetCurrentLocation())
EndFunction

Event Completionist:QuestTracker.StatusChanged(Completionist:QuestTracker akSender, Var[] akArgs)
  PublishStatus()
EndEvent

Event Actor.OnLocationChange(Actor akSender, Location akOldLoc, Location akNewLoc)
  PublishLocation(akNewLoc)
EndEvent

Function OnOSFHotkey(String asModId, String asHotkeyId)
  If asHotkeyId == OpenHotkey
    ; Open first so the menu appears immediately; the location follows a moment later.
    OSFUI.Open(MenuView)
    PublishLocation(Game.GetPlayer().GetCurrentLocation())
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
  ; osfui.send("override", questId, value): 0 = automatic, 1 = mark done, 2 = mark not done.
  If asName == "override" && akArgs.Length >= 2
    Tracker().SetOverride(akArgs[0] as String, akArgs[1] as Int)
    Return
  EndIf
  Completionist:QuestData:Entry entry = FindEntry(akArgs[0] as String)
  If entry == None
    Return
  EndIf

  If asName == "track"
    ; Keeps the menu open (the player may want to show it on the map next) and reports
    ; whether the game actually accepted it, since SetActive can be refused silently.
    Quest q = entry.questForm
    Bool wasActive = q.IsActive()
    If q.IsRunning() && !q.IsCompleted()
      q.SetActive(True)
    EndIf
    Bool nowActive = q.IsActive()
    Debug.TraceUser("Completionist", "Track " + entry.name + " [" + entry.id + "]: running=" + q.IsRunning() + " completed=" + q.IsCompleted() + " active " + wasActive + " -> " + nowActive)
    Var[] result = new Var[2]
    result[0] = entry.id
    result[1] = nowActive
    OSFUI.EmitEvent(ModId, "tracked", result)
  ElseIf asName == "plot"
    If entry.startLocation
      OSFUI.Close(MenuView)
      Game.ShowGalaxyStarMapMenuAndPlotToLocation(entry.startLocation)
    Else
      Debug.Notification("No known start location for " + entry.name)
    EndIf
  EndIf
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

; Publishes quest ids and statuses page by page ("ids0"/"status0" …), since Papyrus arrays
; hold at most 128 elements. The menu joins the pages back together.
Function PublishStatus()
  Completionist:QuestTracker tracker = Tracker()
  Int pages = tracker.MaxPages
  OSFUI.SetState(ModId, "pages", pages)
  OSFUI.SetState(ModId, "unityEntered", tracker.IsUnityEntered())
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
      If tracker.OverrideOf(entries[i].id) != tracker.kOverrideNone
        status += 10
      EndIf
      statuses.Add(status)
      i += 1
    EndWhile
    OSFUI.SetStateStrings(ModId, "ids" + p, ids)
    OSFUI.SetStateInts(ModId, "status" + p, statuses)
    p += 1
  EndWhile
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
