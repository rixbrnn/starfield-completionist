// PROTOTYPE (wayfinder ticket #5). Three structurally different takes on "Here" inside the
// Missions menu's Completionist tab. Switched in game (see CompletionistMissions.as).
//   A  Card + list: the Nexus edition's Here, a summary card and places on the left, quests on the right
//   B  Native: the vanilla menu's own two columns, a quest list left and the selected quest right
//   C  Dashboard: one big number, then quests / activities / errands side by side
package completionist
{
   import flash.display.Sprite;
   import flash.geom.Rectangle;

   public class Views
   {
      public static const NAMES:Array = ["A  Card + list","B  Native two columns","C  Dashboard"];

      // ------------------------------------------------------------ shared

      // Where the player is, as the Here views need it; null when nothing tracked is here.
      public static function HereData(model:Model) : Object
      {
         if(model.here < 0)
         {
            return null;
         }
         var quests:Array = model.QuestsUnder(model.here);
         return {
            "place":model.here,
            "name":Model.PlaceName(model.here),
            "sub":model.PlaceSubtitle(model.here),
            "kind":Model.PlaceKind(model.here),
            "quests":quests,
            "tally":model.Tally(quests),
            "places":model.SubPlaces(model.here)
         };
      }

      private static const SECTIONS:Array = [
         {"label":"IN PROGRESS","statuses":[Model.IN_PROGRESS]},
         {"label":"NOT DISCOVERED","statuses":[Model.NOT_STARTED]},
         {"label":"NOT AVAILABLE YET","statuses":[Model.NOT_AVAILABLE]},
         {"label":"FAILED","statuses":[Model.FAILED]},
         {"label":"DONE","statuses":[Model.COMPLETED,Model.LOCKED_OUT]}
      ];

      // Quest rows grouped by status; objectives from the game's log under quests in progress.
      public static function QuestRows(model:Model, quests:Array, withObjectives:Boolean) : Array
      {
         var rows:Array = [];
         for each(var section:Object in SECTIONS)
         {
            var inSection:Array = [];
            for each(var q:int in quests)
            {
               if(section.statuses.indexOf(model.status[q]) >= 0)
               {
                  inSection.push(q);
               }
            }
            if(inSection.length == 0)
            {
               continue;
            }
            inSection.sort(function(a:int, b:int):int
            {
               return Model.Name(a) < Model.Name(b) ? -1 : (Model.Name(a) > Model.Name(b) ? 1 : 0);
            });
            rows.push({"kind":"header","text":section.label + "  " + inSection.length});
            for each(q in inSection)
            {
               rows.push({"kind":"quest","quest":q,"text":Model.Name(q),"right":Model.Tag(q),"color":Ui.StatusColor(model.status[q])});
               if(withObjectives && model.status[q] == Model.IN_PROGRESS)
               {
                  for each(var objective:String in model.logObjectives[q].slice(0,2))
                  {
                     rows.push({"kind":"objective","text":objective});
                  }
               }
            }
         }
         return rows;
      }

      public static function InProgressAnywhere(model:Model) : Array
      {
         var result:Array = [];
         for(var q:int = 0; q < model.questCount; q++)
         {
            if(model.Counted(q) && model.status[q] == Model.IN_PROGRESS)
            {
               result.push(q);
            }
         }
         return result;
      }

      // Rows that Up/Down select.
      public static function Selectable(rows:Array) : Array
      {
         var result:Array = [];
         for(var i:int = 0; i < rows.length; i++)
         {
            if(rows[i].kind == "quest" || rows[i].kind == "place")
            {
               result.push(i);
            }
         }
         return result;
      }

      // Draws rows into a box, scrolled so the selected row shows. Returns how many rows fit.
      public static function DrawRows(parent:Sprite, x:Number, y:Number, w:Number, h:Number, rows:Array, selectedRow:int, rowHeight:Number) : int
      {
         var fit:int = Math.max(1,Math.floor(h / rowHeight));
         var top:int = 0;
         if(selectedRow >= fit - 2)
         {
            top = Math.min(selectedRow - fit + 3,Math.max(0,rows.length - fit));
         }
         for(var i:int = top; i < rows.length && i < top + fit; i++)
         {
            var row:Object = rows[i];
            var ry:Number = y + (i - top) * rowHeight;
            if(i == selectedRow)
            {
               Ui.Box(parent.graphics,x - 8,ry,w + 16,rowHeight - 2,0xFFFFFF,0.14);
               Ui.Box(parent.graphics,x - 8,ry,3,rowHeight - 2,Ui.ACCENT,1);
            }
            if(row.kind == "header")
            {
               Ui.Text(parent,x,ry + rowHeight * 0.3,row.text,15,Ui.GREY,Ui.BOLD);
               Ui.Line(parent.graphics,x,ry + rowHeight - 3,w,0xFFFFFF,0.15);
            }
            else if(row.kind == "objective")
            {
               Ui.Text(parent,x + 24,ry + 4,row.text,15,Ui.GREY,Ui.REGULAR,w - 24);
            }
            else
            {
               Ui.Text(parent,x,ry + 4,row.text,19,row.color != null ? row.color : Ui.WHITE,Ui.SEMIBOLD,w - 150);
               if(row.right)
               {
                  Ui.Text(parent,x + w - 150,ry + 7,row.right,13,Ui.GREY,Ui.BOLD,150,"right");
               }
            }
         }
         if(rows.length > fit)
         {
            var trackH:Number = h;
            Ui.Box(parent.graphics,x + w + 14,y,3,trackH,0xFFFFFF,0.1);
            Ui.Box(parent.graphics,x + w + 14,y + trackH * top / rows.length,3,Math.max(20,trackH * fit / rows.length),0xFFFFFF,0.5);
         }
         return fit;
      }

      private static function Card(parent:Sprite, x:Number, y:Number, w:Number, here:Object) : Number
      {
         var t:Object = here.tally;
         Ui.Box(parent.graphics,x,y,w,286,0xFFFFFF,0.05);
         Ui.Box(parent.graphics,x,y,4,286,Ui.ACCENT,1);
         Ui.Text(parent,x + 24,y + 18,String(here.name).toUpperCase(),30,Ui.WHITE,Ui.BOLD,w - 48);
         Ui.Text(parent,x + 24,y + 62,here.sub != "" ? here.sub : here.kind,16,Ui.GREY,Ui.REGULAR,w - 48);
         Ui.Text(parent,x + 24,y + 92,Ui.Percent(t.done,t.total),64,Ui.WHITE,Ui.BOLD);
         Ui.Text(parent,x + w - 24 - 200,y + 128,t.done + " / " + t.total + " done",18,Ui.GREY,Ui.SEMIBOLD,200,"right");
         Ui.Bar(parent.graphics,x + 24,y + 182,w - 48,6,t.total > 0 ? t.done / t.total : 0);
         Ui.Text(parent,x + 24,y + 202,t.active + " in progress",18,Ui.ACCENT,Ui.SEMIBOLD);
         Ui.Text(parent,x + 24,y + 230,t.missing + " not discovered",18,Ui.WHITE,Ui.SEMIBOLD);
         if(t.locked > 0)
         {
            Ui.Text(parent,x + w / 2,y + 230,t.locked + " not available yet",18,Ui.DIM,Ui.SEMIBOLD);
         }
         return 286;
      }

      private static function NowhereCard(parent:Sprite, x:Number, y:Number, w:Number, model:Model) : Number
      {
         Ui.Box(parent.graphics,x,y,w,150,0xFFFFFF,0.05);
         Ui.Text(parent,x + 24,y + 18,"NOTHING TRACKED HERE",26,Ui.WHITE,Ui.BOLD,w - 48);
         Ui.Para(parent,x + 24,y + 60,model.chain.length == 0 ? "No location from the feed: is the prototype plugin running?" : "No quests or activities start here. These systems have the most you haven't discovered yet.",16,Ui.GREY,w - 48);
         return 150;
      }

      private static function SystemRows(model:Model) : Array
      {
         var rows:Array = [{"kind":"header","text":"WHERE TO NEXT"}];
         for each(var s:Object in model.TopSystems(8))
         {
            rows.push({"kind":"place","text":s.label,"right":s.missing + " NOT DISCOVERED","color":Ui.WHITE});
         }
         return rows;
      }

      // ------------------------------------------------------------ A: card + list

      public static function RenderA(parent:Sprite, area:Rectangle, model:Model, state:Object) : Array
      {
         var leftW:Number = Math.round(area.width * 0.34);
         var rightX:Number = area.x + leftW + 48;
         var rightW:Number = area.right - rightX - 24;
         var here:Object = HereData(model);
         var y:Number = area.y;
         var rows:Array;
         if(here == null)
         {
            y += NowhereCard(parent,area.x,y,leftW,model) + 24;
            DrawRows(parent,area.x + 8,y,leftW - 16,area.bottom - y,SystemRows(model),-1,36);
            rows = QuestRows(model,InProgressAnywhere(model),true);
         }
         else
         {
            y += Card(parent,area.x,y,leftW,here) + 24;
            var placeRows:Array = [];
            if(here.places.length > 0)
            {
               placeRows.push({"kind":"header","text":(here.kind == "planet" ? "PLACES ON " : "PLANETS AND MOONS IN ") + String(here.name).toUpperCase()});
               for each(var p:Object in here.places)
               {
                  var pt:Object = model.Tally(p.quests);
                  placeRows.push({"kind":"place","text":p.label,"right":pt.done + " / " + pt.total,"color":pt.done == pt.total ? Ui.GREEN : Ui.WHITE});
               }
            }
            DrawRows(parent,area.x + 8,y,leftW - 16,area.bottom - y,placeRows,-1,36);
            rows = QuestRows(model,here.quests,true);
         }
         var selectable:Array = Selectable(rows);
         state.count = selectable.length;
         state.selected = Math.max(0,Math.min(state.selected,selectable.length - 1));
         DrawRows(parent,rightX,area.y,rightW,area.height,rows,selectable.length > 0 ? selectable[state.selected] : -1,38);
         return rows;
      }

      // ------------------------------------------------------------ B: native two columns

      public static function RenderB(parent:Sprite, list:Rectangle, info:Rectangle, model:Model, state:Object) : Array
      {
         var here:Object = HereData(model);
         var rows:Array = here != null ? QuestRows(model,here.quests,false) : QuestRows(model,InProgressAnywhere(model),false);
         var selectable:Array = Selectable(rows);
         state.count = selectable.length;
         state.selected = Math.max(0,Math.min(state.selected,selectable.length - 1));
         // Left: place header and the list, where the vanilla mission list sits.
         var y:Number = list.y;
         if(here != null)
         {
            Ui.Text(parent,list.x,y,String(here.name).toUpperCase() + "   " + Ui.Percent(here.tally.done,here.tally.total),24,Ui.WHITE,Ui.BOLD);
            Ui.Bar(parent.graphics,list.x,y + 40,list.width,4,here.tally.total > 0 ? here.tally.done / here.tally.total : 0);
         }
         else
         {
            Ui.Text(parent,list.x,y,"NOTHING TRACKED HERE · IN PROGRESS ANYWHERE",20,Ui.WHITE,Ui.BOLD);
         }
         y += 60;
         var selectedRow:int = selectable.length > 0 ? selectable[state.selected] : -1;
         DrawRows(parent,list.x + 8,y,list.width - 16,list.bottom - y,rows,selectedRow,40);
         // Right: the selected quest, where vanilla shows mission details.
         if(selectedRow < 0)
         {
            return rows;
         }
         var q:int = rows[selectedRow].quest;
         var s:int = model.status[q];
         y = info.y;
         Ui.Text(parent,info.x,y,Model.Tag(q) + "  ·  " + Model.StatusLabel(s),15,Ui.StatusColor(s),Ui.BOLD);
         y += 30;
         var title:* = Ui.Para(parent,info.x,y,Model.Name(q).toUpperCase(),30,Ui.WHITE,info.width);
         y += title.height + 12;
         var places:Array = [];
         for each(var p:int in model.placeChains[q])
         {
            places.push(Model.PlaceName(p));
         }
         Ui.Text(parent,info.x,y,places.length > 0 ? "Starts at " + places.slice(0,3).join(", ") : "Starts anywhere",17,Ui.GREY,Ui.REGULAR,info.width);
         y += 44;
         Ui.Line(parent.graphics,info.x,y,info.width,0xFFFFFF,0.2);
         y += 20;
         var objectives:Array = model.logObjectives[q];
         if(s == Model.IN_PROGRESS && objectives.length > 0)
         {
            Ui.Text(parent,info.x,y,"OBJECTIVES (FROM THE GAME'S LOG)",14,Ui.GREY,Ui.BOLD);
            y += 30;
            for each(var objective:String in objectives.slice(0,6))
            {
               var tf:* = Ui.Para(parent,info.x + 20,y,objective,18,Ui.WHITE,info.width - 20);
               y += tf.height + 8;
            }
         }
         else if(s == Model.NOT_STARTED)
         {
            Ui.Para(parent,info.x,y,"Not discovered yet. Look around " + (places.length > 0 ? places[0] : "the settled systems") + ".",18,Ui.WHITE,info.width);
         }
         else if(s == Model.NOT_AVAILABLE)
         {
            Ui.Para(parent,info.x,y,"Not available yet: it opens up after another quest.",18,Ui.WHITE,info.width);
         }
         else
         {
            Ui.Para(parent,info.x,y,"Source: " + (model.feedStatus[q] != Model.UNKNOWN ? "tracker (Papyrus feed)" : "game log"),16,Ui.GREY,info.width);
         }
         return rows;
      }

      // ------------------------------------------------------------ C: dashboard

      private static const KINDS:Array = [
         {"label":"QUESTS","test":function(q:int):Boolean { return (Model.Flags(q) & 3) == 0; }},
         {"label":"ACTIVITIES","test":function(q:int):Boolean { return (Model.Flags(q) & 3) == 1; }},
         {"label":"ERRANDS","test":function(q:int):Boolean { return (Model.Flags(q) & 2) != 0; }}
      ];

      public static function RenderC(parent:Sprite, area:Rectangle, model:Model, state:Object) : Array
      {
         var here:Object = HereData(model);
         var y:Number = area.y;
         var pool:Array;
         if(here != null)
         {
            Ui.Text(parent,area.x,y,String(here.name).toUpperCase(),40,Ui.WHITE,Ui.BOLD);
            Ui.Text(parent,area.x,y + 54,here.sub,18,Ui.GREY,Ui.REGULAR);
            Ui.Text(parent,area.right - 300,y - 8,Ui.Percent(here.tally.done,here.tally.total),80,Ui.ACCENT,Ui.BOLD,300,"right");
            Ui.Bar(parent.graphics,area.x,y + 100,area.width,8,here.tally.total > 0 ? here.tally.done / here.tally.total : 0);
            pool = here.quests;
         }
         else
         {
            Ui.Text(parent,area.x,y,"NOTHING TRACKED HERE",40,Ui.WHITE,Ui.BOLD);
            Ui.Text(parent,area.x,y + 54,"Everything in progress, anywhere",18,Ui.GREY,Ui.REGULAR);
            pool = InProgressAnywhere(model);
         }
         y += 140;
         var colW:Number = (area.width - 2 * 40) / 3;
         var listTop:Number = y + 130;
         state.count = 0;
         for(var k:int = 0; k < KINDS.length; k++)
         {
            var x:Number = area.x + k * (colW + 40);
            var mine:Array = pool.filter(function(q:int, i:int, a:Array):Boolean { return KINDS[k].test(q); });
            var t:Object = model.Tally(mine);
            Ui.Text(parent,x,y,KINDS[k].label,16,Ui.GREY,Ui.BOLD);
            Ui.Text(parent,x,y + 24,t.done + " / " + t.total,42,Ui.WHITE,Ui.BOLD);
            Ui.Bar(parent.graphics,x,y + 84,colW,5,t.total > 0 ? t.done / t.total : 0,Ui.GREEN);
            Ui.Text(parent,x,y + 98,t.active + " in progress · " + t.missing + " not discovered",15,Ui.GREY,Ui.REGULAR,colW);
            var open:Array = [];
            for each(var q:int in mine)
            {
               if(model.status[q] == Model.IN_PROGRESS || model.status[q] == Model.NOT_STARTED)
               {
                  open.push(q);
               }
            }
            var rows:Array = [];
            for each(q in open.slice(state.selected,state.selected + 40))
            {
               rows.push({"kind":"item","text":Model.Name(q),"color":Ui.StatusColor(model.status[q])});
            }
            state.count = Math.max(state.count,open.length);
            DrawRows(parent,x,listTop,colW,area.bottom - listTop,rows,-1,32);
         }
         return [];
      }
   }
}
