// PROTOTYPE (wayfinder ticket #5). A fake Missions menu for smoke-testing our tab in a browser
// (Ruffle) before it goes in game: device fonts, made-up log and feed quest. Keys: Up/Down, X
// (layout), Y (diagnostics), T (toggle the tab), N (nowhere: no location).
package
{
   import completionist.CompletionistMissions;
   import completionist.QuestDatabase;
   import completionist.Ui;
   import flash.display.MovieClip;
   import flash.display.Sprite;
   import flash.events.KeyboardEvent;

   public class Harness extends Sprite
   {
      private var menu:FakeMenu = new FakeMenu();
      private var tab:CompletionistMissions;
      private var nowhere:Boolean = false;

      public function Harness()
      {
         Ui.deviceFonts = true;
         graphics.beginFill(0x1B2026);
         graphics.drawRect(0,0,1920,1080);
         graphics.endFill();
         addChild(this.menu);
         this.tab = new CompletionistMissions();
         addChild(this.tab);
         this.tab.Attach(this.menu,this.Quests());
         // A second update, as when Papyrus refreshes after the menu opened.
         this.tab.OnQuestData(this.Quests());
         stage.addEventListener(KeyboardEvent.KEY_DOWN,this.OnKey);
      }

      private function OnKey(e:KeyboardEvent) : void
      {
         var names:Object = {"38":"Up","40":"Down","88":"XButton","89":"YButton"};
         if(names[e.keyCode] != null)
         {
            this.tab.ProcessUserEvent(names[e.keyCode],true);
            this.tab.ProcessUserEvent(names[e.keyCode],false);
         }
         else if(e.keyCode == 84)
         {
            this.menu.currentFilterFlag = this.menu.currentFilterFlag == 0 ? 1 : 0;
            this.tab.OnTab();
         }
         else if(e.keyCode == 78)
         {
            this.nowhere = !this.nowhere;
            this.tab.OnQuestData(this.Quests());
         }
      }

      private static function Split(id:Number) : String
      {
         return Math.floor(id / 65536) + ";" + (id % 65536);
      }

      private function Quests() : Array
      {
         var quests:Array = [];
         // DLC prefixes: Shattered Space and friends loaded as full masters 2, 3, 4...
         var prefixes:Array = [0];
         var p:Array = [];
         for(var i:int = 1; i < QuestDatabase.PLUGINS.length; i++)
         {
            prefixes.push((i + 1) * 16777216);
            p.push(Split(prefixes[i] + QuestDatabase.REFERENCES[i - 1]));
         }
         // Here: New Atlantis and its parents.
         var chain:Array = [];
         for(var place:int = 0; place < QuestDatabase.PLACES.length && !this.nowhere; place++)
         {
            if(QuestDatabase.PLACES[place][0] == "New Atlantis" && QuestDatabase.PLACES[place][3] == 0)
            {
               for(var at:int = place; at >= 0 && chain.length < 6; at = QuestDatabase.PLACES[at][2])
               {
                  if(QuestDatabase.PLACES[at][3] >= 0)
                  {
                     chain.push(Split(prefixes[QuestDatabase.PLACES[at][3]] + QuestDatabase.PLACES[at][4]));
                  }
               }
               break;
            }
         }
         while(chain.length < 6)
         {
            chain.push("0;0");
         }
         // Statuses: a made-up spread, packed 8 per global; the log gets the started ones.
         var objectives:Array = [{"sName":"CMPL|H|0|12;7"},{"sName":"CMPL|L|0|" + chain.join(";")},{"sName":"CMPL|P|0|" + p.join(";")}];
         var packed:Array = [];
         for(var q:int = 0; q < QuestDatabase.QUESTS.length; q++)
         {
            var s:int = [0,2,0,1,2,5,0,2,4,0,3][(q * 7) % 11];
            packed[int(q / 8)] = (packed[int(q / 8)] || 0) + s * Math.pow(8,q % 8);
            var row:Array = QuestDatabase.QUESTS[q];
            if(s == 1 || s == 2 || s == 3)
            {
               quests.push({
                  "sName":row[1],
                  "uID":prefixes[row[2]] + row[3],
                  "bComplete":s == 2,
                  "bFailed":s == 3,
                  "aObjectives":s == 1 ? [{"sName":"Talk to someone about " + row[1],"bComplete":false},{"sName":"An earlier step","bComplete":true}] : []
               });
            }
         }
         for(var g:int = 0; g < packed.length; g += 8)
         {
            var values:Array = [];
            for(var k:int = g; k < g + 8 && k < packed.length; k++)
            {
               // Some with thousands separators, as a localized game might print them.
               values.push(k % 3 == 0 ? Number(packed[k]).toString().replace(/(\d)(?=(\d{3})+$)/g,"$1,") : String(packed[k]));
            }
            objectives.push({"sName":"CMPL|S|" + g + "|" + values.join(";")});
         }
         quests.push({"sName":"Completionist (prototype feed)","uID":4278192128,"aObjectives":objectives});
         quests.push({"sName":"Not tracked","uID":12345,"aObjectives":[{"sName":"Something"}]});
         return quests;
      }
   }
}

import flash.display.MovieClip;
import flash.display.Sprite;

class FakeMenu extends MovieClip
{
   public var MissionsList_mc:Sprite = new Sprite();
   public var MissionInfo_mc:Sprite = new Sprite();
   public var currentFilterFlag:int = 0;
   public var uiPlatform:uint = 0;
   public var uiController:uint = 0;

   public function FakeMenu()
   {
      this.MissionsList_mc.graphics.beginFill(0x334455);
      this.MissionsList_mc.graphics.drawRect(110,250,760,690);
      this.MissionInfo_mc.graphics.beginFill(0x443344);
      this.MissionInfo_mc.graphics.drawRect(960,250,860,690);
      addChild(this.MissionsList_mc);
      addChild(this.MissionInfo_mc);
   }
}
