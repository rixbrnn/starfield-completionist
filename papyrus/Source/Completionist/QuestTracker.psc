ScriptName Completionist:QuestTracker extends Quest
{Tracks every quest in Completionist:QuestData and reports progress per place.
Attached to the start-game-enabled quest Completionist_QuestTracker in StarfieldCompletionist.esm.}

; Quest status codes (stored in QuestData:Entry.status)
Int Property kNotStarted = 0 AutoReadOnly
Int Property kInProgress = 1 AutoReadOnly
Int Property kCompleted = 2 AutoReadOnly
Int Property kFailed = 3 AutoReadOnly
Int Property kLockedOut = 4 AutoReadOnly ; the other branch of an either/or group was completed

Float Property CheckInterval = 30.0 AutoReadOnly
Int Property kCheckTimer = 1 AutoReadOnly
String Property LogName = "Completionist" AutoReadOnly

; Papyrus arrays hold at most 128 elements, so the quest table comes in pages.
; Keep the number of page variables in sync with MAX_PAGES in tools/build/build-mod.ts.
Int Property MaxPages = 4 AutoReadOnly

; Sent after every refresh and whenever a status changes, for listeners such as Completionist:MenuBridge.
CustomEvent StatusChanged
; Manual overrides, saved with the game: quest id -> kOverrideDone / kOverrideNotDone.
; Kept apart from the pages because those are rebuilt on every load. At most 128 overrides.
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
Float refreshStarted = 0.0
Float Property RefreshTimeout = 120.0 AutoReadOnly

String[] overrideIds
Int[] overrideValues

Completionist:QuestData:Entry[] page0
Completionist:QuestData:Entry[] page1
Completionist:QuestData:Entry[] page2
Completionist:QuestData:Entry[] page3

Event OnQuestInit()
  RegisterForRemoteEvent(Game.GetPlayer(), "OnPlayerLoadGame")
  Refresh()
EndEvent

Event Actor.OnPlayerLoadGame(Actor akSender)
  ; Flags saved mid-refresh belong to the previous session.
  refreshing = False
  ready = False
  Refresh()
EndEvent

Event OnTimer(Int aiTimerID)
  If aiTimerID == kCheckTimer
    If ready
      Check()
    ElseIf !refreshing || Utility.GetCurrentRealTime() - refreshStarted > RefreshTimeout
      refreshing = False
      Refresh()
    EndIf
    StartTimer(CheckInterval, kCheckTimer)
  EndIf
EndEvent

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

; Reloads the quest table (plugins or data may have changed), sets every status
; without announcing, and logs a full report.
Function Refresh()
  If refreshing
    Return
  EndIf
  refreshing = True
  ready = False
  refreshStarted = Utility.GetCurrentRealTime()
  Debug.OpenUserLog(LogName)
  Int pages = Completionist:QuestData.PageCount()
  If pages > MaxPages
    Debug.TraceUser(LogName, "Quest table has " + pages + " pages but the tracker holds " + MaxPages + "; extra quests are ignored")
  EndIf
  ActorValue unityTimes = Game.GetFormFromFile(0x219529, "Starfield.esm") as ActorValue
  unityEntered = unityTimes && Game.GetPlayer().GetValue(unityTimes) >= 1
  page0 = LoadPage(0, pages)
  page1 = LoadPage(1, pages)
  page2 = LoadPage(2, pages)
  page3 = LoadPage(3, pages)

  Int p = 0
  While p < MaxPages
    Completionist:QuestData:Entry[] entries = GetPage(p)
    Int i = 0
    While i < entries.Length
      entries[i].status = Resolve(entries[i])
      i += 1
    EndWhile
    p += 1
  EndWhile

  Report()
  refreshing = False
  ready = True
  SendCustomEvent("StatusChanged")
  StartTimer(CheckInterval, kCheckTimer)
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

; Looks for status changes since the last check and announces completions.
Function Check()
  Bool changed = False
  Int p = 0
  While p < MaxPages
    Completionist:QuestData:Entry[] entries = GetPage(p)
    Int i = 0
    While i < entries.Length
      Int status = Resolve(entries[i])
      If status != entries[i].status
        Debug.TraceUser(LogName, entries[i].name + ": " + StatusName(entries[i].status) + " -> " + StatusName(status) + " [" + entries[i].place + "]")
        entries[i].status = status
        changed = True
        If status == kCompleted && !entries[i].hidden
          String prefix = "Completed: "
          If entries[i].activity
            prefix = "Activity completed: "
          EndIf
          Debug.Notification(prefix + entries[i].name + " (" + PlaceProgress(entries[i].place, entries[i].hub) + ")")
        EndIf
      EndIf
      i += 1
    EndWhile
    p += 1
  EndWhile
  If changed
    SendCustomEvent("StatusChanged")
  EndIf
EndFunction

; Status including either/or groups: a quest whose alternative was completed is locked out.
Int Function Resolve(Completionist:QuestData:Entry akEntry)
  Int override = OverrideOf(akEntry.id)
  If override == kOverrideDone
    Return kCompleted
  ElseIf override == kOverrideNotDone
    Return kNotStarted
  EndIf
  Int status = StatusOf(akEntry)
  If status != kCompleted && akEntry.equivalent != "" && EquivalentCompleted(akEntry)
    Return kCompleted
  EndIf
  If status != kCompleted && akEntry.choice1Group != "" && LockedByChoice(akEntry)
    Return kLockedOut
  EndIf
  Return status
EndFunction

; Equivalent quests are versions of the same content, e.g. the New Game+ variants of
; One Small Step (MQ401a-j): completing any of them completes the visible entry.
Bool Function EquivalentCompleted(Completionist:QuestData:Entry akEntry)
  Int p = 0
  While p < MaxPages
    Completionist:QuestData:Entry[] entries = GetPage(p)
    Int i = 0
    While i < entries.Length
      If entries[i] != akEntry && entries[i].equivalent == akEntry.equivalent && StatusOf(entries[i]) == kCompleted
        Return True
      EndIf
      i += 1
    EndWhile
    p += 1
  EndWhile
  Return False
EndFunction

; Locked out when a quest on the other side of one of its choice groups was completed,
; e.g. Foreknowledge done -> Short Sighted, No Sudden Moves, ... are skipped.
Bool Function LockedByChoice(Completionist:QuestData:Entry akEntry)
  Int p = 0
  While p < MaxPages
    Completionist:QuestData:Entry[] entries = GetPage(p)
    Int i = 0
    While i < entries.Length
      Completionist:QuestData:Entry other = entries[i]
      If other != akEntry && other.choice1Group != ""
        If OnOtherSide(other, akEntry.choice1Group, akEntry.choice1Side) || (akEntry.choice2Group != "" && OnOtherSide(other, akEntry.choice2Group, akEntry.choice2Side))
          If StatusOf(other) == kCompleted
            Return True
          EndIf
        EndIf
      EndIf
      i += 1
    EndWhile
    p += 1
  EndWhile
  Return False
EndFunction

Bool Function OnOtherSide(Completionist:QuestData:Entry akOther, String asGroup, String asSide)
  Return (akOther.choice1Group == asGroup && akOther.choice1Side != asSide) || (akOther.choice2Group == asGroup && akOther.choice2Side != asSide)
EndFunction

; Whether an entry counts toward totals: hidden equivalents never do, NG+-only quests
; only after entering Unity.
Bool Function Counted(Completionist:QuestData:Entry akEntry)
  Return !akEntry.hidden && (!akEntry.ngPlusOnly || unityEntered)
EndFunction

Bool Function IsUnityEntered()
  Return unityEntered
EndFunction

Int Function OverrideOf(String asId)
  If overrideIds == None
    Return kOverrideNone
  EndIf
  Int at = overrideIds.Find(asId)
  If at < 0
    Return kOverrideNone
  EndIf
  Return overrideValues[at]
EndFunction

; Sets (or with kOverrideNone clears) a manual override, updates the quest at once and
; tells listeners. No "Completed" notification for manual changes.
Function SetOverride(String asId, Int aiValue)
  If overrideIds == None
    overrideIds = new String[0]
    overrideValues = new Int[0]
  EndIf
  Int at = overrideIds.Find(asId)
  If aiValue == kOverrideNone
    If at >= 0
      overrideIds.Remove(at)
      overrideValues.Remove(at)
    EndIf
  ElseIf at >= 0
    overrideValues[at] = aiValue
  ElseIf overrideIds.Length < 128
    overrideIds.Add(asId)
    overrideValues.Add(aiValue)
  Else
    Debug.Notification("Completionist: too many manual overrides (128)")
    Return
  EndIf

  Int p = 0
  While p < MaxPages
    Completionist:QuestData:Entry[] entries = GetPage(p)
    Int i = 0
    While i < entries.Length
      If entries[i].id == asId
        entries[i].status = Resolve(entries[i])
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

Int Function StatusOf(Completionist:QuestData:Entry akEntry)
  Quest q = akEntry.questForm
  If AnyStageDone(q, akEntry.fail1, akEntry.fail2, -1, -1)
    Return kFailed
  ElseIf q.IsCompleted() || AnyStageDone(q, akEntry.complete1, akEntry.complete2, akEntry.complete3, akEntry.complete4)
    Return kCompleted
  ElseIf q.IsRunning() || q.GetStage() > 0
    Return kInProgress
  EndIf
  Return kNotStarted
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
  EndIf
  Return "not started"
EndFunction

; "Neon 6/12": completed / total for quests that start at asPlace.
String Function PlaceProgress(String asPlace, String asHub)
  Int total = 0
  Int done = 0
  Int p = 0
  While p < MaxPages
    Completionist:QuestData:Entry[] entries = GetPage(p)
    Int i = 0
    While i < entries.Length
      If entries[i].place == asPlace && Counted(entries[i])
        total += 1
        If IsDone(entries[i].status)
          done += 1
        EndIf
      EndIf
      i += 1
    EndWhile
    p += 1
  EndWhile
  Return asHub + " " + done + "/" + total
EndFunction

; True if an entry before (aiPage, aiIndex) has the same place, so each place is reported once.
Bool Function PlaceSeenBefore(String asPlace, Int aiPage, Int aiIndex)
  Int p = 0
  While p <= aiPage
    Completionist:QuestData:Entry[] entries = GetPage(p)
    Int last = entries.Length
    If p == aiPage
      last = aiIndex
    EndIf
    Int i = 0
    While i < last
      If entries[i].place == asPlace
        Return True
      EndIf
      i += 1
    EndWhile
    p += 1
  EndWhile
  Return False
EndFunction

; Logs overall progress and one line per place.
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
  String summary = questsDone + "/" + quests + " quests, " + activitiesDone + "/" + activities + " activities completed"
  Debug.TraceUser(LogName, "Progress: " + summary)
  ; The game's own counters (stats screen), for comparison: they include every small activity and repeatable job.
  Debug.TraceUser(LogName, "Game stats: " + Game.QueryStat("Quests Completed") + " quests completed, " + Game.QueryStat("Activities Completed") + " activities completed")

  p = 0
  While p < MaxPages
    Completionist:QuestData:Entry[] entries = GetPage(p)
    Int i = 0
    While i < entries.Length
      If Counted(entries[i]) && !PlaceSeenBefore(entries[i].place, p, i)
        ReportPlace(entries[i].place)
      EndIf
      i += 1
    EndWhile
    p += 1
  EndWhile

  Debug.Notification("Completionist: " + summary)
EndFunction

; Logs "done/total, active" for one place.
Function ReportPlace(String asPlace)
  Int total = 0
  Int done = 0
  Int active = 0
  Int p = 0
  While p < MaxPages
    Completionist:QuestData:Entry[] entries = GetPage(p)
    Int i = 0
    While i < entries.Length
      If entries[i].place == asPlace && Counted(entries[i])
        total += 1
        If IsDone(entries[i].status)
          done += 1
        ElseIf entries[i].status == kInProgress
          active += 1
        EndIf
      EndIf
      i += 1
    EndWhile
    p += 1
  EndWhile
  Debug.TraceUser(LogName, "  " + done + "/" + total + " done, " + active + " active: " + asPlace)
EndFunction
