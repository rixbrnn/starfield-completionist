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
  OSFUI.RegisterSend(Self, ModId, "close")
  OSFSettings.RegisterHotkey(Self, ModId, OpenHotkey)
  PublishStatus()
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
    PublishLocation(Game.GetPlayer().GetCurrentLocation())
    OSFUI.Open(MenuView)
  EndIf
EndFunction

Function OnOSFUISend(String asName, Var[] akArgs, String asSourceViewId)
  If asName == "close"
    OSFUI.Close(MenuView)
  EndIf
EndFunction

; Publishes quest ids and statuses page by page ("ids0"/"status0" …), since Papyrus arrays
; hold at most 128 elements. The menu joins the pages back together.
Function PublishStatus()
  Completionist:QuestTracker tracker = Tracker()
  Int pages = tracker.MaxPages
  OSFUI.SetState(ModId, "pages", pages)
  Int p = 0
  While p < pages
    Completionist:QuestData:Entry[] entries = tracker.GetPage(p)
    String[] ids = new String[0]
    Int[] statuses = new Int[0]
    Int i = 0
    While i < entries.Length
      ids.Add(entries[i].id)
      statuses.Add(entries[i].status)
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
  If akLocation
    ids.Add(akLocation.GetFormID())
    Location[] parents = akLocation.GetParentLocations()
    Int i = 0
    While i < parents.Length && ids.Length < 120
      ids.Add(parents[i].GetFormID())
      i += 1
    EndWhile
  EndIf
  OSFUI.SetStateInts(ModId, "location", ids)
EndFunction
