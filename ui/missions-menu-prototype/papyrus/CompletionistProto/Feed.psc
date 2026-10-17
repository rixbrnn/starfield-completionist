ScriptName CompletionistProto:Feed extends Quest
{PROTOTYPE (wayfinder ticket #5). Carries the Nexus edition tracker's statuses, the player's location
and the DLC plugins' load-order prefixes to the replaced Missions menu, through text-display globals
shown in this quest's objectives. Plain Papyrus: no SFSE, no OSF.}

Int Property kUnknown = 7 AutoReadOnly ; quest not in the tracker (plugin missing, tracker not ready)
String Property TrackerPlugin = "StarfieldCompletionist.esm" AutoReadOnly
String Property OwnPlugin = "CompletionistProto.esm" AutoReadOnly

Int counter = 0
GlobalVariable[] globalVars
String[] ids0
String[] ids1
String[] ids2
String[] ids3

Event OnInit()
  Setup()
EndEvent

Event Actor.OnPlayerLoadGame(Actor akSender)
  Setup()
EndEvent

Function Setup()
  Actor player = Game.GetPlayer()
  RegisterForRemoteEvent(player, "OnPlayerLoadGame")
  RegisterForRemoteEvent(player, "OnLocationChange")
  RegisterForMenuOpenCloseEvent("BSMissionMenu")
  globalVars = new GlobalVariable[0]
  Int g = 0
  While g < CompletionistProto:Ids.GlobalCount()
    globalVars.Add(Game.GetFormFromFile(0x801 + g, OwnPlugin) as GlobalVariable)
    g += 1
  EndWhile
  ids0 = CompletionistProto:Ids.Page(0)
  ids1 = CompletionistProto:Ids.Page(1)
  ids2 = CompletionistProto:Ids.Page(2)
  ids3 = CompletionistProto:Ids.Page(3)
  If !IsStageDone(10)
    SetStage(10)
  EndIf
  Int o = 0
  While o < CompletionistProto:Ids.ObjectiveCount()
    If !IsObjectiveDisplayed(o)
      SetObjectiveDisplayed(o)
    EndIf
    o += 1
  EndWhile
  Publish("load")
EndFunction

Event Actor.OnLocationChange(Actor akSender, Location akOldLoc, Location akNewLoc)
  Publish("location")
EndEvent

; Does this land before the menu reads its data? The menu shows the counter it received.
Event OnMenuOpenCloseEvent(String asMenuName, Bool abOpening)
  If asMenuName == "BSMissionMenu" && abOpening
    Publish("menu")
  EndIf
EndEvent

Function Publish(String asWhy)
  Float started = Utility.GetCurrentRealTime()
  counter += 1
  SetGlobal(0, counter)

  Completionist:QuestTracker tracker = Game.GetFormFromFile(0x800, TrackerPlugin) as Completionist:QuestTracker
  Int flags = 0
  If tracker
    flags += 1
    If tracker.IsReady()
      flags += 2
    EndIf
    If tracker.IsUnityEntered()
      flags += 4
    EndIf
  EndIf
  SetGlobal(1, flags)

  PublishLocation()
  PublishPrefixes()
  If tracker && tracker.IsReady()
    PublishStatuses(tracker)
  EndIf

  Int g = 0
  While g < globalVars.Length
    UpdateCurrentInstanceGlobal(globalVars[g])
    g += 1
  EndWhile
  Debug.TraceUser("CompletionistProto", "published #" + counter + " (" + asWhy + ") in " + (Utility.GetCurrentRealTime() - started) + " s")
EndFunction

Function SetGlobal(Int aiIndex, Int aiValue)
  If globalVars[aiIndex]
    globalVars[aiIndex].SetValue(aiValue as Float)
  EndIf
EndFunction

; A 32-bit FormID as two 16-bit halves (Papyrus floats hold 24 bits exactly).
Function SetFormID(Int aiFirstGlobal, Int aiFormID)
  Int value = aiFormID
  Int high = 0
  If value < 0
    value = value + 2147483647 + 1
    high = 32768
  EndIf
  SetGlobal(aiFirstGlobal, high + value / 65536)
  SetGlobal(aiFirstGlobal + 1, value % 65536)
EndFunction

; The player's location and its parents, then where the ship is (as MenuBridge.PublishLocation).
Function PublishLocation()
  Int[] chain = new Int[0]
  AddLocationChain(chain, Game.GetPlayer().GetCurrentLocation())
  SpaceshipReference ship = Game.GetPlayerHomeSpaceShip()
  If ship
    AddLocationChain(chain, ship.GetCurrentLocation())
  EndIf
  Int first = CompletionistProto:Ids.FirstLocationGlobal()
  Int i = 0
  While i < CompletionistProto:Ids.LocationSlots()
    Int id = 0
    If i < chain.Length
      id = chain[i]
    EndIf
    SetFormID(first + i * 2, id)
    i += 1
  EndWhile
EndFunction

Function AddLocationChain(Int[] aiIds, Location akLocation)
  If !akLocation
    Return
  EndIf
  aiIds.Add(akLocation.GetFormID())
  Location[] parents = akLocation.GetParentLocations()
  Int i = 0
  While i < parents.Length && aiIds.Length < 16
    aiIds.Add(parents[i].GetFormID())
    i += 1
  EndWhile
EndFunction

; One form per DLC plugin: its runtime FormID minus its local FormID is the plugin's prefix.
Function PublishPrefixes()
  Int first = CompletionistProto:Ids.FirstPrefixGlobal()
  Int i = 0
  While i < CompletionistProto:Ids.ReferenceCount()
    Form found = Game.GetFormFromFile(CompletionistProto:Ids.ReferenceLocal(i), CompletionistProto:Ids.ReferencePlugin(i))
    Int id = 0
    If found
      id = found.GetFormID()
    EndIf
    SetFormID(first + i * 2, id)
    i += 1
  EndWhile
EndFunction

; Statuses in database order, 8 per global, 3 bits each (status * 8^position).
Function PublishStatuses(Completionist:QuestTracker akTracker)
  Int[] pow8 = new Int[8]
  pow8[0] = 1
  Int j = 1
  While j < 8
    pow8[j] = pow8[j - 1] * 8
    j += 1
  EndWhile
  Int[] packed = new Int[0]
  Int g = 0
  While g < CompletionistProto:Ids.StatusGlobals()
    packed.Add(16777215) ; every quest kUnknown until the tracker says otherwise
    g += 1
  EndWhile

  Int p = 0
  While p < akTracker.MaxPages
    Completionist:QuestData:Entry[] entries = akTracker.GetPage(p)
    Int i = 0
    While entries && i < entries.Length
      Int index = IndexOf(entries[i].id)
      If index >= 0
        packed[index / 8] = packed[index / 8] - (kUnknown - entries[i].status) * pow8[index % 8]
      EndIf
      i += 1
    EndWhile
    p += 1
  EndWhile

  Int first = CompletionistProto:Ids.FirstStatusGlobal()
  g = 0
  While g < packed.Length
    SetGlobal(first + g, packed[g])
    g += 1
  EndWhile
EndFunction

Int Function IndexOf(String asId)
  Int found = ids0.Find(asId)
  If found >= 0
    Return found
  EndIf
  If ids1
    found = ids1.Find(asId)
    If found >= 0
      Return 128 + found
    EndIf
  EndIf
  If ids2
    found = ids2.Find(asId)
    If found >= 0
      Return 256 + found
    EndIf
  EndIf
  If ids3
    found = ids3.Find(asId)
    If found >= 0
      Return 384 + found
    EndIf
  EndIf
  Return -1
EndFunction
