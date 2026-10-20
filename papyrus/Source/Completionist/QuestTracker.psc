ScriptName Completionist:QuestTracker extends Quest
{Tracks every quest in Completionist:QuestData and reports progress per place.
Attached to the start-game-enabled quest Completionist_QuestTracker in StarfieldCompletionist.esm.}

; Quest status codes (stored in QuestData:Entry.status)
Int Property kNotStarted = 0 AutoReadOnly
Int Property kInProgress = 1 AutoReadOnly
Int Property kCompleted = 2 AutoReadOnly
Int Property kFailed = 3 AutoReadOnly
Int Property kLockedOut = 4 AutoReadOnly ; the other branch of an either/or group was completed
Int Property kNotAvailable = 5 AutoReadOnly ; not started, and can't be found yet (see Entry.after1)

; Quest events catch changes as they happen; this pass over every quest is the safety net, and
; logs whatever it finds (the events missed it).
Float Property CheckInterval = 600.0 AutoReadOnly
Int Property kCheckTimer = 1 AutoReadOnly
Int Property kMenuCheckTimer = 2 AutoReadOnly
Int Property kRecheckTimer = 3 AutoReadOnly
; A quest is read again this long after its event: the stage's script may show its objectives
; only after the event arrived.
Float Property RecheckDelay = 2.0 AutoReadOnly
String Property LogName = "Completionist" AutoReadOnly

; Papyrus arrays hold at most 128 elements, so the quest table comes in pages.
; Keep the number of page variables in sync with MAX_PAGES in tools/build/build-mod.ts.
Int Property MaxPages = 4 AutoReadOnly

; Sent after every refresh and whenever a status changes, for listeners such as Completionist:MenuBridge.
CustomEvent StatusChanged
; Sent while a refresh builds the table, every BuildStep quests: [building, quests read, quests in all].
CustomEvent BuildProgress
Int Property BuildStep = 25 AutoReadOnly
; Manual overrides (Entry.override).
Int Property kOverrideNone = 0 AutoReadOnly
Int Property kOverrideDone = 1 AutoReadOnly
Int Property kOverrideNotDone = 2 AutoReadOnly
; Whether the player has entered Unity (New Game+): NG+-only quests count only then.
; Read from the game's own PlayerUnityTimesEntered actor value (Starfield.esm 0x219529).
Bool unityEntered = False

; Refresh state. A refresh can be interrupted (a save made mid-refresh, an error), so the
; timer retries until one finishes, and the menu only gets statuses once one has.
Bool refreshing = False
Bool ready = False
; Whether the pages hold the current quest table. One saved with an older version of the mod may
; judge quests by older data (an update can change the stage that completes an activity), so
; checks and quest events then wait for the refresh to put the current one in. With the current
; one saved (tableVersion), they run from the moment the game loads.
Bool tableLoaded = False
Int tableVersion = 0 ; Completionist:QuestData.TableVersion() of the table in the pages
String tablePlugins = "" ; Completionist:QuestData.InstalledPlugins() when it was loaded
; One check at a time, so a change isn't logged twice.
Bool checking = False
; Which refresh is the latest. Papyrus saves running functions, so a refresh saved mid-run resumes
; after loading alongside the one the load starts: the older one notices and stops.
Int refreshId = 0
Float refreshStarted = 0.0
; A refresh that made no progress for this long is stuck (an error stopped it): it starts over.
Float refreshProgressAt = 0.0
Float Property RefreshTimeout = 300.0 AutoReadOnly
Int buildDone = 0
Int buildTotal = 0

; The quest events registered so far (see RegisterAllEvents). Registrations are saved with the
; game; raise EventsVersion when RegisterQuestEvents registers more, so saves pick them up.
Int Property EventsVersion = 3 AutoReadOnly
Int eventsRegistered = 0

; Overrides as older versions kept them (at most 128), moved onto their entries by MigrateOverrides.
String[] overrideIds
Int[] overrideValues

; Track start (the menu): id of the quest whose giver Completionist_Guide points at, or "".
String guideFor = ""
; Its objective shown now (one per giver or place, see build-mod.ts). 0 before the first Track
; start, so a save from when the guide had only objective 0 hides that one.
Int guideShown = 0
Int Property GuideQuestID = 0x801 AutoReadOnly ; Completionist_Guide in StarfieldCompletionist.esm

; Quests whose stage changed or that stopped while a refresh was running: the refresh may have
; read them before the change, so QuestChanged handles them once it finishes.
Quest[] pendingQuests
; Quests to read again RecheckDelay after their event.
Quest[] recheckQuests

Completionist:QuestData:Entry[] page0
Completionist:QuestData:Entry[] page1
Completionist:QuestData:Entry[] page2
Completionist:QuestData:Entry[] page3

Event OnQuestInit()
  RegisterForRemoteEvent(Game.GetPlayer(), "OnPlayerLoadGame")
  Refresh()
EndEvent

Event Actor.OnPlayerLoadGame(Actor akSender)
  ; A refresh saved mid-run left statuses half read: this session redoes it.
  Bool interrupted = refreshing
  ; Flags saved mid-refresh or mid-check belong to the previous session.
  refreshing = False
  checking = False
  refreshId += 1
  ; The statuses saved with the game are current for this save: the menu can show them right away.
  ready = page0 != None && page0.Length > 0
  tableLoaded = ready && tableVersion == Completionist:QuestData.TableVersion() && tablePlugins == Completionist:QuestData.InstalledPlugins()
  If ready
    SendCustomEvent("StatusChanged")
  EndIf
  If tableLoaded && !interrupted
    ; Same table, same plugins: nothing to re-read. Quest events and the menu pick up what
    ; changes from here. Re-reading every quest keeps the scripts busy for a minute or more,
    ; and the menu's hotkey waits behind them.
    MigrateOverrides()
    ReadUnity()
    If ResolveLeads()
      SendCustomEvent("StatusChanged")
    EndIf
    Report()
    StartTimer(CheckInterval, kCheckTimer)
    If eventsRegistered != EventsVersion
      RegisterAllEvents()
    EndIf
  Else
    Refresh()
  EndIf
EndEvent

Event OnTimer(Int aiTimerID)
  If aiTimerID == kCheckTimer
    If refreshing
      If Utility.GetCurrentRealTime() - refreshProgressAt > RefreshTimeout
        Debug.TraceUser(LogName, "Refresh made no progress for " + (RefreshTimeout as Int) + " s: starting over")
        refreshing = False
        Refresh()
      Else
        StartTimer(RefreshTimeout, kCheckTimer)
      EndIf
    ElseIf ready
      Check()
      StartTimer(CheckInterval, kCheckTimer)
    Else
      Refresh()
    EndIf
  ElseIf aiTimerID == kMenuCheckTimer
    QuickCheck()
  ElseIf aiTimerID == kRecheckTimer
    Recheck()
  EndIf
EndEvent

; The menu opened: catch quests finished since the last check, on a timer so the hotkey's handler
; returns at once.
Function MenuOpened()
  StartTimer(0.1, kMenuCheckTimer)
EndFunction

; Only the quests in progress: they are the ones that finish, so this takes a second or so where
; a pass over every quest takes much longer.
Function QuickCheck()
  If !ready || !tableLoaded || checking
    Return
  EndIf
  checking = True
  Bool changed = CheckInProgressFrom("menu opened")
  checking = False
  If changed
    SendCustomEvent("StatusChanged")
  EndIf
EndFunction

Function ReadUnity()
  ActorValue unityTimes = Game.GetFormFromFile(0x219529, "Starfield.esm") as ActorValue
  unityEntered = unityTimes && Game.GetPlayer().GetValue(unityTimes) >= 1
EndFunction

Completionist:QuestData:Entry[] Function GetPage(Int aiPage)
  If aiPage == 0
    Return page0
  ElseIf aiPage == 1
    Return page1
  ElseIf aiPage == 2
    Return page2
  ElseIf aiPage == 3
    Return page3
  EndIf
  Return None
EndFunction

; Reloads the quest table (plugins or data may have changed), re-reads every quest and logs a
; summary. The new table goes in before the reads, carrying the statuses the menu shows, so checks
; and quest events use the current data while the reads (the slow part) run.
Function Refresh()
  If refreshing
    Return
  EndIf
  refreshing = True
  refreshId += 1
  Int mine = refreshId
  refreshStarted = Utility.GetCurrentRealTime()
  refreshProgressAt = refreshStarted
  buildDone = 0
  buildTotal = 0
  SendBuildProgress()
  ; Watches for a refresh that stops making progress.
  StartTimer(RefreshTimeout, kCheckTimer)
  Debug.OpenUserLog(LogName)
  Int pages = Completionist:QuestData.PageCount()
  Int version = Completionist:QuestData.TableVersion()
  String plugins = Completionist:QuestData.InstalledPlugins()
  If pages > MaxPages
    Debug.TraceUser(LogName, "Quest table has " + pages + " pages but the tracker holds " + MaxPages + "; extra quests are ignored")
  EndIf
  ReadUnity()
  Completionist:QuestData:Entry[] new0 = LoadPage(0, pages)
  refreshProgressAt = Utility.GetCurrentRealTime()
  Completionist:QuestData:Entry[] new1 = LoadPage(1, pages)
  refreshProgressAt = Utility.GetCurrentRealTime()
  Completionist:QuestData:Entry[] new2 = LoadPage(2, pages)
  refreshProgressAt = Utility.GetCurrentRealTime()
  Completionist:QuestData:Entry[] new3 = LoadPage(3, pages)
  refreshProgressAt = Utility.GetCurrentRealTime()
  If mine != refreshId
    Return
  EndIf
  KeepStatuses(new0)
  KeepStatuses(new1)
  KeepStatuses(new2)
  KeepStatuses(new3)
  page0 = new0
  page1 = new1
  page2 = new2
  page3 = new3
  tableVersion = version
  tablePlugins = plugins
  tableLoaded = True
  MigrateOverrides()
  buildTotal = new0.Length + new1.Length + new2.Length + new3.Length
  SendBuildProgress()
  Float tableTime = Utility.GetCurrentRealTime() - refreshStarted
  ; A newer refresh took over (this one was resumed from a save): it does the rest.
  If !ReadForRefresh(mine, new0) || !ReadForRefresh(mine, new1) || !ReadForRefresh(mine, new2) || !ReadForRefresh(mine, new3)
    Return
  EndIf
  ; A refresh of an older version, resumed from a save, may have put its own table in meanwhile.
  page0 = new0
  page1 = new1
  page2 = new2
  page3 = new3

  ; Overrides, equivalents and choices only look at the raw statuses just read; unlocks and
  ; leads ask the game, for the few quests that have them.
  Int p = 0
  While p < MaxPages
    Completionist:QuestData:Entry[] entries = GetPage(p)
    Int i = 0
    While i < entries.Length
      Settle(entries[i])
      i += 1
    EndWhile
    p += 1
  EndWhile

  Debug.TraceUser(LogName, "Refresh: quest table loaded in " + (tableTime as Int) + " s, quests read in " + ((Utility.GetCurrentRealTime() - refreshStarted - tableTime) as Int) + " s")
  Report()
  refreshing = False
  ready = True
  SendBuildProgress()
  SendCustomEvent("StatusChanged")
  StartTimer(CheckInterval, kCheckTimer)
  ; The reads take a while: quests in progress, and those whose events came in meanwhile, may
  ; have changed after they were read.
  If CheckInProgress()
    SendCustomEvent("StatusChanged")
  EndIf
  While pendingQuests != None && pendingQuests.Length > 0
    Quest pending = pendingQuests[0]
    pendingQuests.Remove(0)
    QuestChanged(pending)
  EndWhile
  ; Last, since it takes a while too. Registrations are saved with the game, so after the first
  ; refresh the events already arrive during the next one.
  RegisterAllEvents()
EndFunction

; For the menu's loading page (see BuildProgress).
Bool Function IsBuilding()
  Return refreshing
EndFunction

Int Function BuildDone()
  Return buildDone
EndFunction

Int Function BuildTotal()
  Return buildTotal
EndFunction

Function SendBuildProgress()
  Var[] args = new Var[3]
  args[0] = refreshing
  args[1] = buildDone
  args[2] = buildTotal
  SendCustomEvent("BuildProgress", args)
EndFunction

Function RegisterAllEvents()
  RegisterQuestEvents(page0)
  RegisterQuestEvents(page1)
  RegisterQuestEvents(page2)
  RegisterQuestEvents(page3)
  eventsRegistered = EventsVersion
EndFunction

; Stage changes, starts and shutdowns of the tracked quests, of the quests that make them
; available and of the quests errands lead to trigger QuestChanged. Registering again is harmless.
Function RegisterQuestEvents(Completionist:QuestData:Entry[] akEntries)
  Int i = 0
  While i < akEntries.Length
    Completionist:QuestData:Entry entry = akEntries[i]
    If entry.questForm
      RegisterForRemoteEvent(entry.questForm, "OnStageSet")
      RegisterForRemoteEvent(entry.questForm, "OnQuestShutdown")
      RegisterForRemoteEvent(entry.questForm, "OnQuestStarted")
    EndIf
    RegisterAfterEvents(entry.after1)
    RegisterAfterEvents(entry.after2)
    RegisterAfterEvents(entry.after3)
    RegisterAfterEvents(entry.after4)
    RegisterAfterEvents(entry.leadQuest)
    i += 1
  EndWhile
EndFunction

Function RegisterAfterEvents(Quest akQuest)
  If akQuest
    RegisterForRemoteEvent(akQuest, "OnStageSet")
    RegisterForRemoteEvent(akQuest, "OnQuestStarted")
  EndIf
EndFunction

Event Quest.OnStageSet(Quest akSender, Int auiStageID, Int auiItemID)
  QuestEvent(akSender)
EndEvent

Event Quest.OnQuestShutdown(Quest akSender)
  QuestEvent(akSender)
EndEvent

Event Quest.OnQuestStarted(Quest akSender)
  QuestEvent(akSender)
EndEvent

Function QuestEvent(Quest akQuest)
  QuestChanged(akQuest)
  If recheckQuests == None
    recheckQuests = new Quest[0]
  EndIf
  If recheckQuests.Find(akQuest) < 0 && recheckQuests.Length < 128
    recheckQuests.Add(akQuest)
  EndIf
  ; Restarted by every event, so a burst of stages is read again once.
  StartTimer(RecheckDelay, kRecheckTimer)
EndFunction

Function Recheck()
  While recheckQuests != None && recheckQuests.Length > 0
    Quest again = recheckQuests[0]
    recheckQuests.Remove(0)
    QuestChangedFrom(again, "quest event, read again")
  EndWhile
EndFunction

Function QuestChanged(Quest akQuest)
  QuestChangedFrom(akQuest, "quest event")
EndFunction

; A quest set a stage, started or stopped: re-reads it if it is tracked, then updates it and the
; quests whose status depends on it (same equivalent group, either/or choices, unlocked by it).
Function QuestChangedFrom(Quest akQuest, String asSource)
  If !ready || refreshing
    ; The refresh may already have read this quest and would put back what it read: handle it
    ; again once the refresh finishes.
    If pendingQuests == None
      pendingQuests = new Quest[0]
    EndIf
    If pendingQuests.Find(akQuest) < 0 && pendingQuests.Length < 128
      pendingQuests.Add(akQuest)
    EndIf
    ; Until the refresh puts in the current table, the saved one may judge the quest wrongly.
    If !ready || !tableLoaded
      Return
    EndIf
  EndIf
  ; None when akQuest only makes tracked quests available.
  Completionist:QuestData:Entry source = EntryOf(akQuest)
  If source
    source.raw = StatusOf(source)
  EndIf
  ; Dependents are looked up with FindStruct, never by walking every entry: quest events come
  ; mid-conversation (dialogue quests set stages), and a walk over the table takes seconds of the
  ; game's script time, which holds up the conversation's own scripts.
  Bool changed = ApplyWhereQuest("questForm", akQuest, asSource)
  changed = ApplyWhereQuest("after1", akQuest, asSource) || changed
  changed = ApplyWhereQuest("after2", akQuest, asSource) || changed
  changed = ApplyWhereQuest("after3", akQuest, asSource) || changed
  changed = ApplyWhereQuest("after4", akQuest, asSource) || changed
  changed = ApplyWhereQuest("leadQuest", akQuest, asSource) || changed
  If source && source.equivalent != ""
    changed = ApplyWhereString("equivalent", source.equivalent, asSource) || changed
    changed = ApplyWhereString("afterGroup", source.equivalent, asSource) || changed
  EndIf
  ; A choice locks out the other side of its own groups only.
  If source && source.choice1Group != ""
    changed = ApplyWhereString("choice1Group", source.choice1Group, asSource) || changed
    changed = ApplyWhereString("choice2Group", source.choice1Group, asSource) || changed
  EndIf
  If source && source.choice2Group != ""
    changed = ApplyWhereString("choice1Group", source.choice2Group, asSource) || changed
    changed = ApplyWhereString("choice2Group", source.choice2Group, asSource) || changed
  EndIf
  If changed
    SendCustomEvent("StatusChanged")
  EndIf
EndFunction

; Resolves and applies every entry whose asField (a Quest field) is akQuest.
Bool Function ApplyWhereQuest(String asField, Quest akQuest, String asSource)
  Bool changed = False
  Int p = 0
  While p < MaxPages
    Completionist:QuestData:Entry[] entries = GetPage(p)
    If entries
      Int i = FindQuestIn(entries, asField, akQuest, 0)
      While i >= 0
        changed = Apply(entries[i], Resolve(entries[i]), asSource) || changed
        If i + 1 < entries.Length
          i = FindQuestIn(entries, asField, akQuest, i + 1)
        Else
          i = -1
        EndIf
      EndWhile
    EndIf
    p += 1
  EndWhile
  Return changed
EndFunction

; FindStruct takes the field name only as a literal, hence one call per field.
Int Function FindQuestIn(Completionist:QuestData:Entry[] akEntries, String asField, Quest akQuest, Int aiStart)
  If asField == "questForm"
    Return akEntries.FindStruct("questForm", akQuest, aiStart)
  ElseIf asField == "after1"
    Return akEntries.FindStruct("after1", akQuest, aiStart)
  ElseIf asField == "after2"
    Return akEntries.FindStruct("after2", akQuest, aiStart)
  ElseIf asField == "after3"
    Return akEntries.FindStruct("after3", akQuest, aiStart)
  ElseIf asField == "after4"
    Return akEntries.FindStruct("after4", akQuest, aiStart)
  ElseIf asField == "leadQuest"
    Return akEntries.FindStruct("leadQuest", akQuest, aiStart)
  EndIf
  Return -1
EndFunction

Int Function FindStringIn(Completionist:QuestData:Entry[] akEntries, String asField, String asValue, Int aiStart)
  If asField == "equivalent"
    Return akEntries.FindStruct("equivalent", asValue, aiStart)
  ElseIf asField == "afterGroup"
    Return akEntries.FindStruct("afterGroup", asValue, aiStart)
  ElseIf asField == "choice1Group"
    Return akEntries.FindStruct("choice1Group", asValue, aiStart)
  ElseIf asField == "choice2Group"
    Return akEntries.FindStruct("choice2Group", asValue, aiStart)
  EndIf
  Return -1
EndFunction

; Resolves and applies every entry whose asField (a String field) is asValue.
Bool Function ApplyWhereString(String asField, String asValue, String asSource)
  Bool changed = False
  Int p = 0
  While p < MaxPages
    Completionist:QuestData:Entry[] entries = GetPage(p)
    If entries
      Int i = FindStringIn(entries, asField, asValue, 0)
      While i >= 0
        changed = Apply(entries[i], Resolve(entries[i]), asSource) || changed
        If i + 1 < entries.Length
          i = FindStringIn(entries, asField, asValue, i + 1)
        Else
          i = -1
        EndIf
      EndWhile
    EndIf
    p += 1
  EndWhile
  Return changed
EndFunction

Bool Function IsReady()
  Return ready
EndFunction

Completionist:QuestData:Entry[] Function LoadPage(Int aiPage, Int aiPageCount)
  If aiPage < aiPageCount
    Return Completionist:QuestData.LoadPage(aiPage)
  EndIf
  Return new Completionist:QuestData:Entry[0]
EndFunction

; A freshly loaded table takes over the statuses and overrides of the quests already in the pages
; (the ones saved with the game, after a load). Quests new to the table start out not started.
Function KeepStatuses(Completionist:QuestData:Entry[] akEntries)
  Int i = 0
  While i < akEntries.Length
    Completionist:QuestData:Entry kept = CurrentEntry(akEntries[i].id)
    If kept
      akEntries[i].status = kept.status
      akEntries[i].raw = kept.raw
      akEntries[i].override = kept.override
    EndIf
    i += 1
  EndWhile
EndFunction

Completionist:QuestData:Entry Function CurrentEntry(String asId)
  Int p = 0
  While p < MaxPages
    Completionist:QuestData:Entry[] entries = GetPage(p)
    If entries
      Int at = entries.FindStruct("id", asId)
      If at >= 0
        Return entries[at]
      EndIf
    EndIf
    p += 1
  EndWhile
  Return None
EndFunction

; Older versions kept overrides in their own arrays: moves them onto their entries, once.
Function MigrateOverrides()
  If overrideIds == None
    Return
  EndIf
  Int i = 0
  While i < overrideIds.Length
    Completionist:QuestData:Entry entry = CurrentEntry(overrideIds[i])
    If entry
      entry.override = overrideValues[i]
      entry.status = Resolve(entry)
    EndIf
    i += 1
  EndWhile
  Debug.TraceUser(LogName, "Moved " + overrideIds.Length + " manual override(s) onto their quests")
  overrideIds = None
  overrideValues = None
EndFunction

; Reads a page for refresh aiRefresh, reporting progress. Returns whether that refresh is still
; the latest.
Bool Function ReadForRefresh(Int aiRefresh, Completionist:QuestData:Entry[] akEntries)
  Int i = 0
  While i < akEntries.Length
    If aiRefresh != refreshId
      Return False
    EndIf
    akEntries[i].raw = StatusOf(akEntries[i])
    buildDone += 1
    If buildDone % BuildStep == 0
      refreshProgressAt = Utility.GetCurrentRealTime()
      SendBuildProgress()
    EndIf
    i += 1
  EndWhile
  Return aiRefresh == refreshId
EndFunction

; Sets a quest's status after a refresh read it. One in progress when the refresh started may
; have finished since (right after a load, before any check ran): that is logged like a check
; would. Other changes are set quietly: a new quest table can judge quests the player finished
; long ago differently, and those aren't news.
Function Settle(Completionist:QuestData:Entry akEntry)
  Int status = Resolve(akEntry)
  If akEntry.status == kInProgress
    Apply(akEntry, status, "refresh")
  Else
    akEntry.status = status
    ClearStartIfFound(akEntry)
  EndIf
EndFunction

; Asks the game about every quest once (StatusOf) and keeps the answer in raw. With abSetStatus,
; status starts out as raw until Resolve runs (only refreshes resumed from older saves use it).
Function ReadQuests(Completionist:QuestData:Entry[] akEntries, Bool abSetStatus)
  Int i = 0
  While i < akEntries.Length
    akEntries[i].raw = StatusOf(akEntries[i])
    If abSetStatus
      akEntries[i].status = akEntries[i].raw
    EndIf
    i += 1
  EndWhile
EndFunction

; The safety net, every CheckInterval: a pass over every quest. Whatever it changes, the quest
; events missed, and the log says so.
Function Check()
  ; Before the refresh puts in the current table there is nothing reliable to check against.
  If !ready || !tableLoaded || checking
    Return
  EndIf
  checking = True
  ; Quests in progress first: they are the ones that finish, and asking about every quest takes
  ; a while. Their changes reach the menu before the full pass.
  If CheckInProgressFrom("safety check, missed by events")
    SendCustomEvent("StatusChanged")
  EndIf
  ; Then everything; a refresh running now does that itself.
  If refreshing
    checking = False
    Return
  EndIf
  Bool changed = False
  Int p = 0
  While p < MaxPages
    ReadQuests(GetPage(p), False)
    p += 1
  EndWhile
  p = 0
  While p < MaxPages
    Completionist:QuestData:Entry[] entries = GetPage(p)
    Int i = 0
    While i < entries.Length
      changed = Apply(entries[i], Resolve(entries[i]), "safety check, missed by events") || changed
      i += 1
    EndWhile
    p += 1
  EndWhile
  checking = False
  If changed
    SendCustomEvent("StatusChanged")
  EndIf
EndFunction

Bool Function CheckInProgress()
  Return CheckInProgressFrom("check, in progress")
EndFunction

; Re-reads only the quests in progress, a handful at most. Returns whether any changed.
Bool Function CheckInProgressFrom(String asSource)
  Bool changed = False
  Int p = 0
  While p < MaxPages
    Completionist:QuestData:Entry[] entries = GetPage(p)
    Int i = 0
    While i < entries.Length
      If entries[i].status == kInProgress
        entries[i].raw = StatusOf(entries[i])
        changed = Apply(entries[i], Resolve(entries[i]), asSource) || changed
      EndIf
      i += 1
    EndWhile
    p += 1
  EndWhile
  Return changed
EndFunction

; Stores a newly resolved status and logs the change (and what noticed it: asSource). Returns
; whether it changed.
Bool Function Apply(Completionist:QuestData:Entry akEntry, Int aiStatus, String asSource)
  Int was = akEntry.status
  If aiStatus == was
    Return False
  EndIf
  ; Stored before any call into the game: a check or quest event running alongside then sees it
  ; and doesn't log it again.
  akEntry.status = aiStatus
  Debug.TraceUser(LogName, akEntry.name + ": " + StatusName(was) + " -> " + StatusName(aiStatus) + " [" + akEntry.place + "] (" + asSource + ")")
  ClearStartIfFound(akEntry)
  Return True
EndFunction

; ---------------------------------------------------------------- Track start

; Points Completionist_Guide at who starts quest asId (its giver, or the placed reference it
; starts at), which the player hasn't started, and makes it the only tracked mission: the game
; then shows the target on the compass and map, under an objective that names it ("Talk to
; Sarah Morgan"). Returns whether it could: the quest needs a giver or a reference, and it must
; be in the world (a disabled one hasn't been put there yet).
Bool Function TrackStart(String asId)
  Completionist:QuestData:Entry entry = CurrentEntry(asId)
  If entry == None || entry.guideObjective < 0
    Return False
  EndIf
  ObjectReference target = entry.giverRef
  ActorBase npc = entry.giver as ActorBase
  If npc
    target = npc.GetUniqueActor()
  EndIf
  Quest guide = Game.GetFormFromFile(GuideQuestID, "StarfieldCompletionist.esm") as Quest
  If target == None || target.IsDisabled() || guide == None
    Debug.TraceUser(LogName, "Track start " + entry.name + ": not in the world (" + target + ")")
    Return False
  EndIf
  If !guide.IsRunning()
    guide.Start()
  EndIf
  UntrackAll()
  (guide.GetAlias(0) as ReferenceAlias).ForceRefTo(target)
  guide.SetObjectiveDisplayed(guideShown, False)
  guide.SetObjectiveDisplayed(entry.guideObjective, True, True)
  guideShown = entry.guideObjective
  guide.SetActive(True)
  guideFor = entry.id
  Debug.TraceUser(LogName, "Track start " + entry.name + ": " + target + " (objective " + guideShown + ")")
  Return True
EndFunction

; One tracked mission at a time, as in the game's own Missions menu: SetActive alone adds to
; the tracked ones. Stops tracking the quests in progress and Track start's marker.
Function UntrackAll()
  Int p = 0
  While p < MaxPages
    Completionist:QuestData:Entry[] entries = GetPage(p)
    Int i = 0
    While entries && i < entries.Length
      If entries[i].status == kInProgress && entries[i].questForm.IsActive()
        entries[i].questForm.SetActive(False)
      EndIf
      i += 1
    EndWhile
    p += 1
  EndWhile
  Quest guide = Game.GetFormFromFile(GuideQuestID, "StarfieldCompletionist.esm") as Quest
  If guide && guide.IsActive()
    guide.SetActive(False)
  EndIf
EndFunction

; Show on map: where the quest can be picked up now. The giver's current location (people move,
; e.g. after another quest) or the placed object's, else the start location from the data. A
; disabled giver hasn't been put in the world yet: it may sit in a holding cell.
Location Function WhereItStarts(Completionist:QuestData:Entry akEntry)
  ObjectReference where = akEntry.giverRef
  ActorBase npc = akEntry.giver as ActorBase
  If npc
    where = npc.GetUniqueActor()
  EndIf
  If where && !where.IsDisabled()
    Location now = where.GetCurrentLocation()
    If now
      Return now
    EndIf
  EndIf
  Return akEntry.startLocation
EndFunction

Function ClearStart()
  Quest guide = Game.GetFormFromFile(GuideQuestID, "StarfieldCompletionist.esm") as Quest
  If guide && guide.IsRunning()
    guide.SetObjectiveDisplayed(guideShown, False)
    (guide.GetAlias(0) as ReferenceAlias).Clear()
    guide.SetActive(False)
  EndIf
  guideFor = ""
EndFunction

String Function GuideFor()
  Return guideFor
EndFunction

; The marker is only needed until the quest is found: once it starts (or is done some other way),
; it goes away by itself.
Function ClearStartIfFound(Completionist:QuestData:Entry akEntry)
  If guideFor != "" && akEntry.id == guideFor && akEntry.status != kNotStarted && akEntry.status != kNotAvailable
    ClearStart()
    SendCustomEvent("StatusChanged")
  EndIf
EndFunction

; Status including either/or groups: a quest whose alternative was completed is locked out.
Int Function Resolve(Completionist:QuestData:Entry akEntry)
  If akEntry.override == kOverrideDone
    Return kCompleted
  ElseIf akEntry.override == kOverrideNotDone
    Return kNotStarted
  EndIf
  Int status = akEntry.raw
  If status != kCompleted && akEntry.equivalent != "" && EquivalentCompleted(akEntry)
    Return kCompleted
  EndIf
  If status != kCompleted && (akEntry.leadQuest || akEntry.leadLocation) && LeadReached(akEntry)
    Return kCompleted
  EndIf
  If status != kCompleted && akEntry.choice1Group != "" && LockedByChoice(akEntry)
    Return kLockedOut
  EndIf
  If status == kNotStarted && akEntry.after1 != None && !Unlocked(akEntry)
    Return kNotAvailable
  EndIf
  Return status
EndFunction

; Whether a quest that hasn't started can be found yet: one of the quest stages that start it is
; done (stage -1: that quest has started), or a quest of its after-group (One Small Step or one
; of its New Game+ variants) is completed.
Bool Function Unlocked(Completionist:QuestData:Entry akEntry)
  If AfterReached(akEntry.after1, akEntry.after1Stage) || AfterReached(akEntry.after2, akEntry.after2Stage) || AfterReached(akEntry.after3, akEntry.after3Stage) || AfterReached(akEntry.after4, akEntry.after4Stage)
    Return True
  EndIf
  Return akEntry.afterGroup != "" && GroupCompleted(akEntry.afterGroup)
EndFunction

; An errand that leads elsewhere ("Talk to Clover", "Go to Eleos") is done once the player has
; that quest (in the mission log, or finished) or has explored that place, however they got
; there. Not "the quest is running": city quests run in the background long before that.
Bool Function LeadReached(Completionist:QuestData:Entry akEntry)
  If akEntry.leadQuest
    Completionist:QuestData:Entry target = EntryOf(akEntry.leadQuest)
    If target
      Return target.raw == kInProgress || target.raw == kCompleted || target.raw == kFailed
    EndIf
    Return akEntry.leadQuest.IsCompleted()
  EndIf
  Return akEntry.leadLocation && akEntry.leadLocation.HasEverBeenExplored()
EndFunction

; Errands that lead elsewhere, judged again on load: a place explored or a quest picked up
; raises no event of theirs, and saves of 1.0.3 test builds counted leads as done too early.
Bool Function ResolveLeads()
  Bool changed = False
  Int p = 0
  While p < MaxPages
    Completionist:QuestData:Entry[] entries = GetPage(p)
    Int i = 0
    While i < entries.Length
      If entries[i].leadQuest || entries[i].leadLocation
        changed = Apply(entries[i], Resolve(entries[i]), "load, lead") || changed
      EndIf
      i += 1
    EndWhile
    p += 1
  EndWhile
  Return changed
EndFunction

Completionist:QuestData:Entry Function EntryOf(Quest akQuest)
  Int p = 0
  While p < MaxPages
    Completionist:QuestData:Entry[] entries = GetPage(p)
    If entries
      Int at = entries.FindStruct("questForm", akQuest)
      If at >= 0
        Return entries[at]
      EndIf
    EndIf
    p += 1
  EndWhile
  Return None
EndFunction

Bool Function AfterReached(Quest akQuest, Int aiStage)
  If akQuest == None
    Return False
  ElseIf aiStage < 0
    Return akQuest.IsRunning() || akQuest.IsCompleted() || akQuest.GetStage() > 0
  EndIf
  Return akQuest.IsStageDone(aiStage)
EndFunction

Bool Function GroupCompleted(String asGroup)
  Return CompletedIn("equivalent", asGroup, None)
EndFunction

; Equivalent quests are versions of the same content, e.g. the New Game+ variants of
; One Small Step (MQ401a-j): completing any of them completes the visible entry.
Bool Function EquivalentCompleted(Completionist:QuestData:Entry akEntry)
  Return CompletedIn("equivalent", akEntry.equivalent, akEntry)
EndFunction

; Whether an entry other than akExcept whose asField is asValue is completed (raw), found with
; FindStruct; with asSideField set, only entries whose side (asSideField) isn't asSide count.
Bool Function CompletedIn(String asField, String asValue, Completionist:QuestData:Entry akExcept, String asSideField = "", String asSide = "")
  Int p = 0
  While p < MaxPages
    Completionist:QuestData:Entry[] entries = GetPage(p)
    If entries
      Int i = FindStringIn(entries, asField, asValue, 0)
      While i >= 0
        Completionist:QuestData:Entry other = entries[i]
        If other != akExcept && other.raw == kCompleted && (asSideField == "" || SideOf(other, asSideField) != asSide)
          Return True
        EndIf
        If i + 1 < entries.Length
          i = FindStringIn(entries, asField, asValue, i + 1)
        Else
          i = -1
        EndIf
      EndWhile
    EndIf
    p += 1
  EndWhile
  Return False
EndFunction

String Function SideOf(Completionist:QuestData:Entry akEntry, String asSideField)
  If asSideField == "choice1Side"
    Return akEntry.choice1Side
  EndIf
  Return akEntry.choice2Side
EndFunction

; Locked out when a quest on the other side of one of its choice groups was completed,
; e.g. Foreknowledge done -> Short Sighted, No Sudden Moves, ... are skipped.
; Locked out when a completed quest is on the other side of one of the entry's groups.
Bool Function LockedByChoice(Completionist:QuestData:Entry akEntry)
  If LockedIn(akEntry, akEntry.choice1Group, akEntry.choice1Side)
    Return True
  EndIf
  Return akEntry.choice2Group != "" && LockedIn(akEntry, akEntry.choice2Group, akEntry.choice2Side)
EndFunction

Bool Function LockedIn(Completionist:QuestData:Entry akEntry, String asGroup, String asSide)
  Return CompletedIn("choice1Group", asGroup, akEntry, "choice1Side", asSide) || CompletedIn("choice2Group", asGroup, akEntry, "choice2Side", asSide)
EndFunction

; Whether an entry counts toward totals: hidden equivalents never do, NG+-only quests
; only after entering Unity.
Bool Function Counted(Completionist:QuestData:Entry akEntry)
  Return !akEntry.hidden && (!akEntry.ngPlusOnly || unityEntered)
EndFunction

Bool Function IsUnityEntered()
  Return unityEntered
EndFunction

; Sets (or with kOverrideNone clears) a manual override, updates the quest at once and tells
; listeners.
Function SetOverride(String asId, Int aiValue)
  Int p = 0
  While p < MaxPages
    Completionist:QuestData:Entry[] entries = GetPage(p)
    Int i = 0
    While i < entries.Length
      If entries[i].id == asId
        entries[i].override = aiValue
        entries[i].status = Resolve(entries[i])
        ClearStartIfFound(entries[i])
        Debug.TraceUser(LogName, entries[i].name + ": manual override " + aiValue + " -> " + StatusName(entries[i].status))
      EndIf
      i += 1
    EndWhile
    p += 1
  EndWhile
  SendCustomEvent("StatusChanged")
EndFunction

; Completed, or resolved because its alternative was completed.
Bool Function IsDone(Int aiStatus)
  Return aiStatus == kCompleted || aiStatus == kLockedOut
EndFunction

; Each call here waits for the game, so the common case (never started) is settled with as
; few as possible: no stage set and not running means no stage can be done. No tracked
; quest completes or fails at stage 0.
Int Function StatusOf(Completionist:QuestData:Entry akEntry)
  Quest q = akEntry.questForm
  Bool running = q.IsRunning()
  If !running && q.GetStage() == 0
    If q.IsCompleted()
      Return kCompleted
    EndIf
    Return kNotStarted
  EndIf
  If AnyStageDone(q, akEntry.fail1, akEntry.fail2, -1, -1)
    Return kFailed
  ElseIf q.IsCompleted() || AnyStageDone(q, akEntry.complete1, akEntry.complete2, akEntry.complete3, akEntry.complete4)
    Return kCompleted
  ElseIf running && HasOpenObjective(akEntry)
    Return kInProgress
  EndIf
  Return kNotStarted
EndFunction

; Whether the game shows this quest in the mission log: one of its objectives is displayed
; and not completed or failed. Many activities and errands run in the background with
; nothing displayed; the game doesn't list those, so neither do we.
Bool Function HasOpenObjective(Completionist:QuestData:Entry akEntry)
  If akEntry.objectivesMany || akEntry.obj1 < 0
    Return True
  EndIf
  Quest q = akEntry.questForm
  Return ObjectiveOpen(q, akEntry.obj1) || ObjectiveOpen(q, akEntry.obj2) || ObjectiveOpen(q, akEntry.obj3) || ObjectiveOpen(q, akEntry.obj4) || ObjectiveOpen(q, akEntry.obj5) || ObjectiveOpen(q, akEntry.obj6) || ObjectiveOpen(q, akEntry.obj7) || ObjectiveOpen(q, akEntry.obj8)
EndFunction

Bool Function ObjectiveOpen(Quest akQuest, Int aiObjective)
  Return aiObjective >= 0 && akQuest.IsObjectiveDisplayed(aiObjective) && !akQuest.IsObjectiveCompleted(aiObjective) && !akQuest.IsObjectiveFailed(aiObjective)
EndFunction

Bool Function AnyStageDone(Quest akQuest, Int aiStage1, Int aiStage2, Int aiStage3, Int aiStage4)
  Return (aiStage1 >= 0 && akQuest.IsStageDone(aiStage1)) || (aiStage2 >= 0 && akQuest.IsStageDone(aiStage2)) || (aiStage3 >= 0 && akQuest.IsStageDone(aiStage3)) || (aiStage4 >= 0 && akQuest.IsStageDone(aiStage4))
EndFunction

String Function StatusName(Int aiStatus)
  If aiStatus == kCompleted
    Return "completed"
  ElseIf aiStatus == kInProgress
    Return "in progress"
  ElseIf aiStatus == kFailed
    Return "failed"
  ElseIf aiStatus == kLockedOut
    Return "locked out"
  ElseIf aiStatus == kNotAvailable
    Return "not available yet"
  EndIf
  Return "not started"
EndFunction

; Logs overall progress.
Function Report()
  Int quests = 0
  Int questsDone = 0
  Int activities = 0
  Int activitiesDone = 0
  Int p = 0
  While p < MaxPages
    Completionist:QuestData:Entry[] entries = GetPage(p)
    Int i = 0
    While i < entries.Length
      Bool done = IsDone(entries[i].status)
      If !Counted(entries[i])
        ; hidden equivalents, or NG+-only before entering Unity
      ElseIf entries[i].activity
        activities += 1
        If done
          activitiesDone += 1
        EndIf
      Else
        quests += 1
        If done
          questsDone += 1
        EndIf
      EndIf
      i += 1
    EndWhile
    p += 1
  EndWhile
  Debug.TraceUser(LogName, "Progress: " + questsDone + "/" + quests + " quests, " + activitiesDone + "/" + activities + " activities completed")
  ; The game's own counters (stats screen), for comparison: they include every small activity and repeatable job.
  Debug.TraceUser(LogName, "Game stats: " + Game.QueryStat("Quests Completed") + " quests completed, " + Game.QueryStat("Activities Completed") + " activities completed")
EndFunction
