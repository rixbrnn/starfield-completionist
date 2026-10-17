// PROTOTYPE (wayfinder ticket #5). Everything the Completionist tab knows, from three sources:
// the quest database built into this SWF, the quests the game sends the Missions menu
// (QuestData.aQuests), and the feed quest's objectives (text-display globals set by Papyrus).
package completionist
{
   import flash.utils.getDefinitionByName;
   import flash.utils.getTimer;

   public class Model
   {
      public static const NOT_STARTED:int = 0;
      public static const IN_PROGRESS:int = 1;
      public static const COMPLETED:int = 2;
      public static const FAILED:int = 3;
      public static const LOCKED_OUT:int = 4;
      public static const NOT_AVAILABLE:int = 5;
      public static const UNKNOWN:int = 7;

      // Database, built once.
      public var questCount:int = 0;
      public var placeCount:int = 0;
      public var placeChains:Array = []; // per quest: place indices, most specific first
      public var dbMs:int = 0;
      public var jsonNote:String = "";

      // Feed.
      public var feedFound:Boolean = false;
      public var feedTexts:Array = [];
      public var feedUnresolved:int = 0;
      public var counter:int = -1;
      public var flags:int = 0;
      public var prefixes:Array = []; // per plugin: prefix (uint) or -1 when the plugin is missing
      public var chain:Array = []; // runtime location FormIDs, most specific first
      public var feedStatus:Array = []; // per quest, UNKNOWN when not delivered
      public var parseMs:int = 0;

      // Log.
      public var updates:int = 0;
      public var countersSeen:Array = [];
      public var logStatus:Array = []; // per quest, -1 when not in the log
      public var logObjectives:Array = []; // per quest: open objective texts from the log
      public var logQuests:int = 0;
      public var matchedBase:int = 0;
      public var matchedDlc:int = 0;
      public var matchedDlcByName:int = 0;
      public var nameAgrees:int = 0;
      public var notInDb:int = 0;

      // Result.
      public var status:Array = [];
      public var doneNotInLog:int = 0;
      public var logDoneFeedNot:int = 0;
      public var fromFeed:int = 0;
      public var fromLog:int = 0;
      public var here:int = -1;

      public function Model()
      {
         var started:int = getTimer();
         this.questCount = QuestDatabase.QUESTS.length;
         this.placeCount = QuestDatabase.PLACES.length;
         for(var i:int = 0; i < this.questCount; i++)
         {
            var placeChain:Array = [];
            var place:int = QuestDatabase.QUESTS[i][5];
            while(place >= 0 && placeChain.length < 8)
            {
               placeChain.push(place);
               place = QuestDatabase.PLACES[place][2];
            }
            this.placeChains.push(placeChain);
            this.feedStatus.push(UNKNOWN);
            this.logStatus.push(-1);
            this.logObjectives.push([]);
            this.status.push(NOT_STARTED);
         }
         this.dbMs = getTimer() - started;
         this.prefixes.push(0);
         for(i = 1; i < QuestDatabase.PLUGINS.length; i++)
         {
            this.prefixes.push(-1);
         }
         this.TestJson();
      }

      // Is there a native JSON class under Scaleform, and how fast would a JSON database parse?
      private function TestJson() : void
      {
         try
         {
            var json:Object = getDefinitionByName("JSON");
            var text:String = json.stringify(QuestDatabase.QUESTS);
            var started:int = getTimer();
            json.parse(text);
            this.jsonNote = "JSON: yes, " + Math.round(text.length / 1024) + " KB in " + (getTimer() - started) + " ms";
         }
         catch(e:Error)
         {
            this.jsonNote = "JSON: no (" + e.message.substr(0,40) + ")";
         }
      }

      public static function Plugin(quest:int) : int
      {
         return QuestDatabase.QUESTS[quest][2];
      }

      public static function Flags(quest:int) : int
      {
         return QuestDatabase.QUESTS[quest][6];
      }

      public static function Name(quest:int) : String
      {
         return QuestDatabase.QUESTS[quest][1];
      }

      public static function Type(quest:int) : String
      {
         return QuestDatabase.QUESTS[quest][4];
      }

      public static function PlaceName(place:int) : String
      {
         return place >= 0 ? QuestDatabase.PLACES[place][0] : "";
      }

      public static function PlaceKind(place:int) : String
      {
         return place >= 0 ? QuestDatabase.PLACES[place][1] : "";
      }

      public static function PlaceParent(place:int) : int
      {
         return place >= 0 ? QuestDatabase.PLACES[place][2] : -1;
      }

      public function RuntimeId(plugin:int, local:uint) : Number
      {
         var prefix:Number = this.prefixes[plugin];
         return prefix < 0 ? -1 : (prefix + local) % 4294967296;
      }

      // ------------------------------------------------------------ input

      public function Update(quests:Array) : void
      {
         this.updates++;
         this.ReadFeed(quests);
         this.ReadLog(quests);
         this.Resolve();
         this.countersSeen.push(this.counter);
         if(this.countersSeen.length > 6)
         {
            this.countersSeen.shift();
         }
      }

      // Numbers as the engine printed them: tolerate thousands separators and a decimal tail.
      private static function Number_(text:String) : Number
      {
         var digits:String = "";
         var end:int = text.length;
         var dot:int = Math.max(text.lastIndexOf("."),text.lastIndexOf(","));
         if(dot >= 0 && text.length - dot - 1 <= 2)
         {
            end = dot;
         }
         for(var i:int = 0; i < end; i++)
         {
            var c:int = text.charCodeAt(i);
            if(c >= 48 && c <= 57)
            {
               digits += text.charAt(i);
            }
         }
         return digits.length > 0 ? Number(digits) : -1;
      }

      private function ReadFeed(quests:Array) : void
      {
         var started:int = getTimer();
         this.feedFound = false;
         this.feedTexts = [];
         this.feedUnresolved = 0;
         for each(var quest:Object in quests)
         {
            var objectives:Array = quest.aObjectives as Array;
            if(objectives == null || objectives.length == 0 || String(objectives[0].sName).indexOf("CMPL|") != 0)
            {
               continue;
            }
            this.feedFound = true;
            var statusValues:Array = [];
            for each(var objective:Object in objectives)
            {
               var text:String = String(objective.sName);
               this.feedTexts.push(text);
               if(text.indexOf("<Global") >= 0)
               {
                  this.feedUnresolved++;
               }
               var parts:Array = text.split("|");
               if(parts.length < 4)
               {
                  continue;
               }
               var first:int = int(parts[2]);
               var raw:Array = String(parts.slice(3).join("|")).split(";");
               var values:Array = [];
               for each(var v:String in raw)
               {
                  values.push(Number_(v));
               }
               if(parts[1] == "H")
               {
                  this.counter = values[0];
                  this.flags = values[1];
               }
               else if(parts[1] == "L")
               {
                  this.chain = [];
                  for(var l:int = 0; l + 1 < values.length; l += 2)
                  {
                     var id:Number = values[l] * 65536 + values[l + 1];
                     if(id > 0)
                     {
                        this.chain.push(id);
                     }
                  }
               }
               else if(parts[1] == "P")
               {
                  for(var p:int = 0; p * 2 + 1 < values.length; p++)
                  {
                     var runtime:Number = values[p * 2] * 65536 + values[p * 2 + 1];
                     this.prefixes[p + 1] = runtime > 0 ? (runtime - QuestDatabase.REFERENCES[p] + 4294967296) % 4294967296 : -1;
                  }
               }
               else if(parts[1] == "S")
               {
                  for(var s:int = 0; s < values.length; s++)
                  {
                     statusValues[first + s] = values[s];
                  }
               }
            }
            for(var q:int = 0; q < this.questCount; q++)
            {
               var packed:Number = statusValues[int(q / QuestDatabase.STATUS_PER_GLOBAL)];
               this.feedStatus[q] = packed >= 0 ? int(Math.floor(packed / Math.pow(8,q % QuestDatabase.STATUS_PER_GLOBAL)) % 8) : UNKNOWN;
            }
            break;
         }
         this.parseMs = getTimer() - started;
      }

      private function ReadLog(quests:Array) : void
      {
         var byId:Object = {};
         var byName:Object = {};
         for(var q:int = 0; q < this.questCount; q++)
         {
            this.logStatus[q] = -1;
            this.logObjectives[q] = [];
            var runtime:Number = this.RuntimeId(Plugin(q),QuestDatabase.QUESTS[q][3]);
            if(runtime >= 0)
            {
               byId[String(runtime)] = q;
            }
            if(Plugin(q) > 0)
            {
               byName[Name(q)] = q;
            }
         }
         this.logQuests = this.matchedBase = this.matchedDlc = this.matchedDlcByName = this.nameAgrees = this.notInDb = 0;
         for each(var quest:Object in quests)
         {
            var objectives:Array = quest.aObjectives as Array;
            if(objectives != null && objectives.length > 0 && String(objectives[0].sName).indexOf("CMPL|") == 0)
            {
               continue;
            }
            if(quest.bIsMiscQuest === true)
            {
               // The game's "Miscellaneous" entry: one objective per misc quest, with its owner's FormID.
               for each(var misc:Object in objectives)
               {
                  this.Match(byId,byName,uint(misc.uOwnerQuestFormID),"",misc.bComplete === true ? COMPLETED : IN_PROGRESS,misc);
               }
               continue;
            }
            var logged:int = quest.bComplete === true ? COMPLETED : (quest.bFailed === true ? FAILED : IN_PROGRESS);
            this.Match(byId,byName,uint(quest.uID),String(quest.sName),logged,null);
            var found:* = byId[String(uint(quest.uID))];
            if(found !== undefined && logged == IN_PROGRESS && objectives != null)
            {
               for each(var objective:Object in objectives)
               {
                  if(objective.bComplete !== true && objective.bFailed !== true)
                  {
                     this.logObjectives[found].push(String(objective.sName));
                  }
               }
            }
         }
      }

      private function Match(byId:Object, byName:Object, id:uint, name:String, logged:int, misc:Object) : void
      {
         this.logQuests++;
         var found:* = byId[String(id)];
         var dlc:Boolean = (id >>> 24) != 0;
         var named:* = name != "" ? byName[name] : undefined;
         if(dlc && named !== undefined)
         {
            this.matchedDlcByName++;
            if(found === named)
            {
               this.nameAgrees++;
            }
         }
         if(found === undefined)
         {
            this.notInDb++;
            return;
         }
         if(dlc)
         {
            this.matchedDlc++;
         }
         else
         {
            this.matchedBase++;
         }
         this.logStatus[found] = Math.max(this.logStatus[found],logged);
         if(misc != null && misc.bComplete !== true)
         {
            this.logObjectives[found].push(String(misc.sName));
         }
      }

      private function Resolve() : void
      {
         this.fromFeed = this.fromLog = this.doneNotInLog = this.logDoneFeedNot = 0;
         for(var q:int = 0; q < this.questCount; q++)
         {
            var feed:int = this.feedStatus[q];
            var log:int = this.logStatus[q];
            if(feed != UNKNOWN)
            {
               this.status[q] = feed;
               this.fromFeed++;
               if(IsDone(feed) && log != COMPLETED && feed == COMPLETED)
               {
                  this.doneNotInLog++;
               }
               if(log == COMPLETED && !IsDone(feed))
               {
                  this.logDoneFeedNot++;
               }
            }
            else if(log >= 0)
            {
               this.status[q] = log;
               this.fromLog++;
            }
            else
            {
               this.status[q] = this.prefixes[Plugin(q)] < 0 ? UNKNOWN : NOT_STARTED;
            }
         }
         this.here = -1;
         for each(var id:Number in this.chain)
         {
            for(var p:int = 0; p < this.placeCount && this.here < 0; p++)
            {
               var row:Array = QuestDatabase.PLACES[p];
               if(row[3] >= 0 && this.RuntimeId(row[3],row[4]) == id)
               {
                  this.here = p;
               }
            }
            if(this.here >= 0)
            {
               break;
            }
         }
      }

      // ------------------------------------------------------------ queries

      public static function IsDone(status:int) : Boolean
      {
         return status == COMPLETED || status == LOCKED_OUT;
      }

      public function get UnityEntered() : Boolean
      {
         return (this.flags & 4) != 0;
      }

      // Listed and counted: not hidden, plugin present, NG+-only only after Unity.
      public function Counted(quest:int) : Boolean
      {
         return (Flags(quest) & 8) == 0 && this.status[quest] != UNKNOWN && ((Flags(quest) & 4) == 0 || this.UnityEntered);
      }

      public function QuestsUnder(place:int) : Array
      {
         var result:Array = [];
         for(var q:int = 0; q < this.questCount; q++)
         {
            if(this.Counted(q) && this.placeChains[q].indexOf(place) >= 0)
            {
               result.push(q);
            }
         }
         return result;
      }

      public function Tally(quests:Array) : Object
      {
         var t:Object = {"total":0,"done":0,"active":0,"failed":0,"locked":0,"missing":0};
         for each(var q:int in quests)
         {
            var s:int = this.status[q];
            t.total++;
            if(IsDone(s))
            {
               t.done++;
            }
            else if(s == IN_PROGRESS)
            {
               t.active++;
            }
            else if(s == FAILED)
            {
               t.failed++;
            }
            else if(s == NOT_AVAILABLE)
            {
               t.locked++;
            }
            else
            {
               t.missing++;
            }
         }
         return t;
      }

      // The places in `place` one level down (hubs on a planet, planets in a system), with their quests.
      public function SubPlaces(place:int) : Array
      {
         var kind:String = PlaceKind(place);
         if(kind != "planet" && kind != "system")
         {
            return [];
         }
         var groups:Object = {};
         var order:Array = [];
         for each(var q:int in this.QuestsUnder(place))
         {
            var chain:Array = this.placeChains[q];
            var holder:int = chain[0];
            if(kind == "system")
            {
               holder = place;
               for each(var c:int in chain)
               {
                  if(PlaceKind(c) == "planet")
                  {
                     holder = c;
                     break;
                  }
               }
            }
            if(groups[holder] == null)
            {
               groups[holder] = [];
               order.push(holder);
            }
            groups[holder].push(q);
         }
         var result:Array = [];
         for each(var key:int in order)
         {
            result.push({"place":key,"quests":groups[key],"label":key == place ? (kind == "planet" ? "Elsewhere on " + PlaceName(place) : "In space") : PlaceName(key)});
         }
         result.sortOn("place",Array.NUMERIC);
         result.sort(function(a:Object, b:Object):int
         {
            return b.quests.length - a.quests.length;
         });
         return result;
      }

      // Nothing tracked here: the systems with the most left to discover.
      public function TopSystems(count:int) : Array
      {
         var bySystem:Object = {};
         var order:Array = [];
         for(var q:int = 0; q < this.questCount; q++)
         {
            if(!this.Counted(q))
            {
               continue;
            }
            for each(var c:int in this.placeChains[q])
            {
               if(PlaceKind(c) == "system")
               {
                  if(bySystem[c] == null)
                  {
                     bySystem[c] = [];
                     order.push(c);
                  }
                  bySystem[c].push(q);
                  break;
               }
            }
         }
         var result:Array = [];
         for each(var s:int in order)
         {
            var t:Object = this.Tally(bySystem[s]);
            if(t.missing > 0)
            {
               result.push({"place":s,"label":PlaceName(s),"tally":t,"missing":t.missing});
            }
         }
         result.sortOn("missing",Array.NUMERIC | Array.DESCENDING);
         return result.slice(0,count);
      }

      public function PlaceSubtitle(place:int) : String
      {
         var names:Array = [];
         for(var p:int = PlaceParent(place); p >= 0 && names.length < 3; p = PlaceParent(p))
         {
            names.push(PlaceName(p) + (PlaceKind(p) == "system" ? " system" : ""));
         }
         return names.join(" · ");
      }

      public static function Tag(quest:int) : String
      {
         if((Flags(quest) & 2) != 0)
         {
            return "ERRAND";
         }
         if((Flags(quest) & 1) != 0)
         {
            return "ACTIVITY";
         }
         return Type(quest).toUpperCase();
      }

      public static function StatusLabel(status:int) : String
      {
         switch(status)
         {
            case IN_PROGRESS:
               return "IN PROGRESS";
            case COMPLETED:
               return "DONE";
            case FAILED:
               return "FAILED";
            case LOCKED_OUT:
               return "LOCKED OUT";
            case NOT_AVAILABLE:
               return "NOT AVAILABLE YET";
            default:
               return "NOT DISCOVERED";
         }
      }

      public static function Hex(value:Number) : String
      {
         if(value < 0)
         {
            return "-";
         }
         var text:String = uint(value).toString(16).toUpperCase();
         while(text.length < 8)
         {
            text = "0" + text;
         }
         return text;
      }
   }
}
