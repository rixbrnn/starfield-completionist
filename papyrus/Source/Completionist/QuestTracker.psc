ScriptName Completionist:QuestTracker extends Quest
{Tracks every quest in Completionist:QuestData and reports progress per place.
Attached to the start-game-enabled quest Completionist_QuestTracker in StarfieldCompletionist.esm.}

; Quest status codes
Int Property kNotStarted = 0 AutoReadOnly
Int Property kInProgress = 1 AutoReadOnly
Int Property kCompleted = 2 AutoReadOnly
Int Property kFailed = 3 AutoReadOnly

Float Property CheckInterval = 30.0 AutoReadOnly
Int Property kCheckTimer = 1 AutoReadOnly
String Property LogName = "Completionist" AutoReadOnly

Completionist:QuestData:Entry[] entries
Int[] lastStatus ; per entry, as of the previous check (saved with the game)

Event OnQuestInit()
  RegisterForRemoteEvent(Game.GetPlayer(), "OnPlayerLoadGame")
  Refresh(abAnnounceChanges = False)
EndEvent

Event Actor.OnPlayerLoadGame(Actor akSender)
  Refresh(abAnnounceChanges = False)
EndEvent

Event OnTimer(Int aiTimerID)
  If aiTimerID == kCheckTimer
    Check()
    StartTimer(CheckInterval, kCheckTimer)
  EndIf
EndEvent

; Reloads the quest table (plugins or data may have changed) and logs a full report.
Function Refresh(Bool abAnnounceChanges)
  Debug.OpenUserLog(LogName)
  entries = Completionist:QuestData.Load()
  If lastStatus == None || lastStatus.Length != entries.Length
    lastStatus = new Int[0]
    Int i = 0
    While i < entries.Length
      lastStatus.Add(StatusOf(entries[i]))
      i += 1
    EndWhile
  EndIf
  Report()
  StartTimer(CheckInterval, kCheckTimer)
EndFunction

; Looks for status changes since the last check and announces completions.
Function Check()
  Int i = 0
  While i < entries.Length
    Int status = StatusOf(entries[i])
    If status != lastStatus[i]
      Debug.TraceUser(LogName, entries[i].name + ": " + StatusName(lastStatus[i]) + " -> " + StatusName(status) + " [" + entries[i].place + "]")
      lastStatus[i] = status
      If status == kCompleted
        Debug.Notification("Completed: " + entries[i].name + " (" + PlaceProgress(entries[i]) + ")")
      EndIf
    EndIf
    i += 1
  EndWhile
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
  EndIf
  Return "not started"
EndFunction

; "Neon 6/12": completed / total for quests starting at the same place as akEntry.
String Function PlaceProgress(Completionist:QuestData:Entry akEntry)
  String asPlace = akEntry.place
  Int total = 0
  Int done = 0
  Int i = 0
  While i < entries.Length
    If entries[i].place == asPlace
      total += 1
      If lastStatus[i] == kCompleted
        done += 1
      EndIf
    EndIf
    i += 1
  EndWhile
  Return akEntry.hub + " " + done + "/" + total
EndFunction


; Logs overall progress and one line per place.
Function Report()
  String[] places = new String[0]
  Int[] totals = new Int[0]
  Int[] done = new Int[0]
  Int[] active = new Int[0]
  Int completedCount = 0

  Int i = 0
  While i < entries.Length
    Int at = places.Find(entries[i].place)
    If at < 0
      places.Add(entries[i].place)
      totals.Add(0)
      done.Add(0)
      active.Add(0)
      at = places.Length - 1
    EndIf
    totals[at] = totals[at] + 1
    If lastStatus[i] == kCompleted
      done[at] = done[at] + 1
      completedCount += 1
    ElseIf lastStatus[i] == kInProgress
      active[at] = active[at] + 1
    EndIf
    i += 1
  EndWhile

  Debug.TraceUser(LogName, "Progress: " + completedCount + "/" + entries.Length + " quests completed")
  Int p = 0
  While p < places.Length
    Debug.TraceUser(LogName, "  " + done[p] + "/" + totals[p] + " done, " + active[p] + " active: " + places[p])
    p += 1
  EndWhile
  Debug.Notification("Completionist: " + completedCount + "/" + entries.Length + " quests completed")
EndFunction

