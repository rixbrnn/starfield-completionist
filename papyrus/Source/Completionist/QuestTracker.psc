ScriptName Completionist:QuestTracker extends Quest
{Tracks every quest in Completionist:QuestData and reports progress per place.
Attached to the start-game-enabled quest Completionist_QuestTracker in StarfieldCompletionist.esm.}

; Quest status codes (stored in QuestData:Entry.status)
Int Property kNotStarted = 0 AutoReadOnly
Int Property kInProgress = 1 AutoReadOnly
Int Property kCompleted = 2 AutoReadOnly
Int Property kFailed = 3 AutoReadOnly

Float Property CheckInterval = 30.0 AutoReadOnly
Int Property kCheckTimer = 1 AutoReadOnly
String Property LogName = "Completionist" AutoReadOnly

; Papyrus arrays hold at most 128 elements, so the quest table comes in pages.
; Keep the number of page variables in sync with MAX_PAGES in tools/build/build-mod.ts.
Int Property MaxPages = 4 AutoReadOnly
Completionist:QuestData:Entry[] page0
Completionist:QuestData:Entry[] page1
Completionist:QuestData:Entry[] page2
Completionist:QuestData:Entry[] page3

Event OnQuestInit()
  RegisterForRemoteEvent(Game.GetPlayer(), "OnPlayerLoadGame")
  Refresh()
EndEvent

Event Actor.OnPlayerLoadGame(Actor akSender)
  Refresh()
EndEvent

Event OnTimer(Int aiTimerID)
  If aiTimerID == kCheckTimer
    Check()
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
  Debug.OpenUserLog(LogName)
  Int pages = Completionist:QuestData.PageCount()
  If pages > MaxPages
    Debug.TraceUser(LogName, "Quest table has " + pages + " pages but the tracker holds " + MaxPages + "; extra quests are ignored")
  EndIf
  page0 = LoadPage(0, pages)
  page1 = LoadPage(1, pages)
  page2 = LoadPage(2, pages)
  page3 = LoadPage(3, pages)

  Int p = 0
  While p < MaxPages
    Completionist:QuestData:Entry[] entries = GetPage(p)
    Int i = 0
    While i < entries.Length
      entries[i].status = StatusOf(entries[i])
      i += 1
    EndWhile
    p += 1
  EndWhile

  Report()
  StartTimer(CheckInterval, kCheckTimer)
EndFunction

Completionist:QuestData:Entry[] Function LoadPage(Int aiPage, Int aiPageCount)
  If aiPage < aiPageCount
    Return Completionist:QuestData.LoadPage(aiPage)
  EndIf
  Return new Completionist:QuestData:Entry[0]
EndFunction

; Looks for status changes since the last check and announces completions.
Function Check()
  Int p = 0
  While p < MaxPages
    Completionist:QuestData:Entry[] entries = GetPage(p)
    Int i = 0
    While i < entries.Length
      Int status = StatusOf(entries[i])
      If status != entries[i].status
        Debug.TraceUser(LogName, entries[i].name + ": " + StatusName(entries[i].status) + " -> " + StatusName(status) + " [" + entries[i].place + "]")
        entries[i].status = status
        If status == kCompleted
          Debug.Notification("Completed: " + entries[i].name + " (" + PlaceProgress(entries[i].place, entries[i].hub) + ")")
        EndIf
      EndIf
      i += 1
    EndWhile
    p += 1
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

; "Neon 6/12": completed / total for quests that start at asPlace.
String Function PlaceProgress(String asPlace, String asHub)
  Int total = 0
  Int done = 0
  Int p = 0
  While p < MaxPages
    Completionist:QuestData:Entry[] entries = GetPage(p)
    Int i = 0
    While i < entries.Length
      If entries[i].place == asPlace
        total += 1
        If entries[i].status == kCompleted
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
  Int total = 0
  Int completed = 0
  Int p = 0
  While p < MaxPages
    Completionist:QuestData:Entry[] entries = GetPage(p)
    total += entries.Length
    Int i = 0
    While i < entries.Length
      If entries[i].status == kCompleted
        completed += 1
      EndIf
      i += 1
    EndWhile
    p += 1
  EndWhile
  Debug.TraceUser(LogName, "Progress: " + completed + "/" + total + " quests completed")

  p = 0
  While p < MaxPages
    Completionist:QuestData:Entry[] entries = GetPage(p)
    Int i = 0
    While i < entries.Length
      If !PlaceSeenBefore(entries[i].place, p, i)
        ReportPlace(entries[i].place)
      EndIf
      i += 1
    EndWhile
    p += 1
  EndWhile

  Debug.Notification("Completionist: " + completed + "/" + total + " quests completed")
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
      If entries[i].place == asPlace
        total += 1
        If entries[i].status == kCompleted
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
