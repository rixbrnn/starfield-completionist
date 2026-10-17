// PROTOTYPE (wayfinder ticket #5): the Completionist tab of a replaced Missions menu.
// Loaded by the hook in missionmenu.swf / missionmenu_lrg.swf, which calls:
//   Attach(menu, quests)    once loaded (quests: the last QuestData.aQuests, or null)
//   OnQuestData(quests)     on every QuestData update, with our feed quest still in it
//   OnTab()                 when the category tab changes
//   ProcessUserEvent(n, d)  before the menu handles input; true = handled
// Switch layouts with the Set Course key (XButton), mouse click on the layout name, or V.
// Toggle the diagnostics with Show On Map (YButton), a click on them, or D.
package completionist
{
   import flash.display.MovieClip;
   import flash.display.Sprite;
   import flash.events.KeyboardEvent;
   import flash.events.MouseEvent;
   import flash.geom.Rectangle;
   import flash.text.TextField;
   import flash.utils.getTimer;

   public class CompletionistMissions extends MovieClip
   {
      private var menu:Object = null;
      private var model:Model;
      private var view:Sprite = new Sprite();
      private var active:Boolean = false;
      private var variant:int = 0;
      private var states:Array = [{"selected":0,"count":0},{"selected":0,"count":0},{"selected":0,"count":0}];
      private var showDiagnostics:Boolean = true;
      private var events:Array = [];
      private var renderMs:int = 0;
      private var attachedAt:int = 0;
      private var large:Boolean = false;
      private var listRect:Rectangle;
      private var infoRect:Rectangle;
      private var fontNote:String = "";

      public function CompletionistMissions()
      {
         super();
         this.model = new Model();
         addChild(this.view);
         this.view.visible = false;
      }

      public function Attach(menu:Object, quests:Array) : void
      {
         this.menu = menu;
         this.attachedAt = getTimer();
         try
         {
            this.large = String(menu.loaderInfo.url).toLowerCase().indexOf("_lrg") >= 0;
         }
         catch(e:Error)
         {
         }
         Ui.scale = this.large ? 1.2 : 1;
         this.listRect = this.Bounds(menu.MissionsList_mc,new Rectangle(110,250,760,680));
         this.infoRect = this.Bounds(menu.MissionInfo_mc,new Rectangle(960,250,860,680));
         if(quests != null)
         {
            this.model.Update(quests);
         }
         try
         {
            stage.addEventListener(KeyboardEvent.KEY_DOWN,this.OnKey);
         }
         catch(e:Error)
         {
         }
         this.view.addEventListener(MouseEvent.MOUSE_WHEEL,this.OnWheel);
         this.view.addEventListener(MouseEvent.CLICK,this.OnClick);
         this.OnTab();
      }

      // A vanilla clip's box on the menu, kept inside the screen; fallback if it looks wrong.
      private function Bounds(clip:Object, fallback:Rectangle) : Rectangle
      {
         try
         {
            var r:Rectangle = clip.getBounds(this.menu);
            if(r.width > 200 && r.height > 200 && r.x >= 0 && r.right <= 1920 && r.y >= 0)
            {
               r.bottom = Math.min(r.bottom,960);
               return r;
            }
         }
         catch(e:Error)
         {
         }
         return fallback;
      }

      public function OnQuestData(quests:Array) : void
      {
         this.model.Update(quests);
         if(this.active)
         {
            this.Render();
         }
      }

      public function OnTab() : void
      {
         this.active = this.menu != null && this.menu.currentFilterFlag == 0;
         this.menu.MissionsList_mc.visible = !this.active;
         this.menu.MissionInfo_mc.visible = !this.active;
         this.view.visible = this.active;
         if(this.active)
         {
            this.Render();
         }
      }

      public function ProcessUserEvent(name:String, down:Boolean) : Boolean
      {
         this.events.push(name + (down ? "+" : "-"));
         if(this.events.length > 8)
         {
            this.events.shift();
         }
         if(!this.active)
         {
            return false;
         }
         var state:Object = this.states[this.variant];
         var handled:Boolean = true;
         if(name == "Up")
         {
            if(down)
            {
               state.selected = Math.max(0,state.selected - 1);
            }
         }
         else if(name == "Down")
         {
            if(down)
            {
               state.selected = Math.min(Math.max(0,state.count - 1),state.selected + 1);
            }
         }
         else if(name == "XButton")
         {
            if(!down)
            {
               this.variant = (this.variant + 1) % Views.NAMES.length;
            }
         }
         else if(name == "YButton")
         {
            if(!down)
            {
               this.showDiagnostics = !this.showDiagnostics;
            }
         }
         else
         {
            handled = false;
         }
         this.Render();
         return handled;
      }

      private function OnKey(event:KeyboardEvent) : void
      {
         this.events.push("key " + event.keyCode);
         if(!this.active)
         {
            return;
         }
         if(event.keyCode == 86)
         {
            this.variant = (this.variant + 1) % Views.NAMES.length;
         }
         else if(event.keyCode == 68)
         {
            this.showDiagnostics = !this.showDiagnostics;
         }
         this.Render();
      }

      private function OnWheel(event:MouseEvent) : void
      {
         var state:Object = this.states[this.variant];
         state.selected = Math.max(0,Math.min(Math.max(0,state.count - 1),state.selected - event.delta));
         this.Render();
      }

      private function OnClick(event:MouseEvent) : void
      {
         if(event.stageY < this.listRect.y - 10)
         {
            this.variant = (this.variant + 1) % Views.NAMES.length;
         }
         else if(event.stageY > 960)
         {
            this.showDiagnostics = !this.showDiagnostics;
         }
         this.Render();
      }

      private function Render() : void
      {
         var started:int = getTimer();
         while(this.view.numChildren > 0)
         {
            this.view.removeChildAt(0);
         }
         this.view.graphics.clear();
         var area:Rectangle = new Rectangle(this.listRect.x,this.listRect.y,this.infoRect.right - this.listRect.x,Math.max(this.listRect.bottom,this.infoRect.bottom) - this.listRect.y);
         // Hit area for mouse wheel and clicks, and a backdrop like the vanilla panels.
         Ui.Box(this.view.graphics,area.x - 30,area.y - 50,area.width + 60,1040 - area.y,Ui.PANEL,0.55);
         Ui.Text(this.view,area.right - 600,area.y - 42,"LAYOUT " + Views.NAMES[this.variant] + "   [Set Course / V / click]",14,Ui.GREY,Ui.BOLD,600,"right");
         var body:Rectangle = new Rectangle(area.x,area.y,area.width,area.height - (this.showDiagnostics ? 130 : 0));
         var state:Object = this.states[this.variant];
         if(this.variant == 0)
         {
            Views.RenderA(this.view,body,this.model,state);
         }
         else if(this.variant == 1)
         {
            var list:Rectangle = this.listRect.clone();
            var info:Rectangle = this.infoRect.clone();
            list.bottom = info.bottom = body.bottom;
            Views.RenderB(this.view,list,info,this.model,state);
         }
         else
         {
            Views.RenderC(this.view,body,this.model,state);
         }
         if(this.showDiagnostics)
         {
            this.RenderDiagnostics(area.x,body.bottom + 10,area.width);
         }
         this.renderMs = getTimer() - started;
      }

      private function RenderDiagnostics(x:Number, y:Number, w:Number) : void
      {
         var m:Model = this.model;
         Ui.Box(this.view.graphics,x - 12,y - 4,w + 24,128,0x000000,0.6);
         var prefixes:Array = [];
         for(var i:int = 1; i < QuestDatabase.PLUGINS.length; i++)
         {
            prefixes.push(String(QuestDatabase.PLUGINS[i]).replace(".esm","") + "=" + (m.prefixes[i] >= 0 ? Model.Hex(m.prefixes[i]) : "missing"));
         }
         var chain:Array = [];
         for each(var id:Number in m.chain)
         {
            chain.push(Model.Hex(id));
         }
         var lines:Array = [
            "SWF " + (this.large ? "_lrg" : "normal") + " · platform " + this.Platform() + " · database " + m.questCount + " quests / " + m.placeCount + " places in " + m.dbMs + " ms · " + m.jsonNote + " · render " + this.renderMs + " ms · feed parse " + m.parseMs + " ms",
            "FEED " + (m.feedFound ? "found" : "MISSING") + " · counter " + m.counter + " (seen " + m.countersSeen.join(",") + " over " + m.updates + " QuestData updates) · tracker " + ((m.flags & 1) ? "found" : "missing") + ((m.flags & 2) ? ", ready" : ", not ready") + ((m.flags & 4) ? ", Unity entered" : "") + " · unresolved objectives " + m.feedUnresolved + "/" + m.feedTexts.length,
            "PREFIXES " + prefixes.join("  ") + " · LOCATION " + (chain.length > 0 ? chain.join(">") : "none") + " → here " + (m.here >= 0 ? Model.PlaceName(m.here) : "none"),
            "LOG " + m.logQuests + " quests: " + m.matchedBase + " base + " + m.matchedDlc + " DLC matched by prefix, " + m.matchedDlcByName + " DLC by name (" + m.nameAgrees + " agree), " + m.notInDb + " not in database · STATUS feed " + m.fromFeed + ", log only " + m.fromLog + " · done per feed, not completed in log " + m.doneNotInLog + " · log completed, feed not done " + m.logDoneFeedNot,
            "INPUT " + this.events.join(" ") + " · FONTS " + this.FontCheck() + " · RAW " + (m.feedTexts.length > 0 ? String(m.feedTexts[0]).substr(0,60) + " | " + String(m.feedTexts[m.feedTexts.length - 1]).substr(0,70) : "-")
         ];
         for(i = 0; i < lines.length; i++)
         {
            Ui.Text(this.view,x,y + i * 24,lines[i],13,i == 1 && !m.feedFound ? Ui.RED : Ui.GREY,Ui.REGULAR,w);
         }
      }

      private function Platform() : String
      {
         try
         {
            return String(this.menu.uiPlatform) + "/" + String(this.menu.uiController);
         }
         catch(e:Error)
         {
         }
         return "?";
      }

      // Does each of the game's fonts draw in this SWF? A field whose font is missing measures 0.
      private function FontCheck() : String
      {
         if(this.fontNote == "")
         {
            var probe:Sprite = new Sprite();
            var notes:Array = [];
            for each(var font:String in [Ui.BOLD,Ui.SEMIBOLD,Ui.REGULAR])
            {
               var tf:TextField = Ui.Text(probe,0,0,"Probe",20,0xFFFFFF,font);
               notes.push(font + (tf.textWidth > 0 ? " ok" : " MISSING"));
            }
            this.fontNote = notes.join(", ");
         }
         return this.fontNote;
      }
   }
}
