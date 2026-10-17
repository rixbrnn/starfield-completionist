// PROTOTYPE (wayfinder ticket #5). Drawing helpers: text in the game's own fonts, boxes, bars.
package completionist
{
   import flash.display.Graphics;
   import flash.display.Sprite;
   import flash.text.TextField;
   import flash.text.TextFieldAutoSize;
   import flash.text.TextFormat;

   public class Ui
   {
      // Font names the vanilla Missions menu's text fields use (fontClass in missionmenu.swf).
      public static const BOLD:String = "$MAIN_Font_Bold";
      public static const SEMIBOLD:String = "$NB_Grotesk_Semibold";
      public static const REGULAR:String = "$MAIN_Font";

      public static const WHITE:uint = 0xEDEDED;
      public static const GREY:uint = 0x9A9A9A;
      public static const DIM:uint = 0x5E5E5E;
      public static const ACCENT:uint = 0xE5B54B;
      public static const GREEN:uint = 0x7FC18A;
      public static const RED:uint = 0xD06A5E;
      public static const PANEL:uint = 0x0A0D11;

      // Large text mode multiplies every size.
      public static var scale:Number = 1;

      // Browser harness only: no game fonts there.
      public static var deviceFonts:Boolean = false;

      public static function Text(parent:Sprite, x:Number, y:Number, text:String, size:Number, color:uint, font:String = null, width:Number = 0, align:String = "left") : TextField
      {
         var tf:TextField = new TextField();
         var format:TextFormat = new TextFormat(deviceFonts ? "_sans" : (font != null ? font : SEMIBOLD),Math.round(size * scale),color);
         format.align = align;
         tf.defaultTextFormat = format;
         tf.embedFonts = !deviceFonts;
         tf.selectable = false;
         tf.mouseEnabled = false;
         tf.multiline = false;
         tf.wordWrap = false;
         if(width > 0)
         {
            tf.width = width;
            tf.height = Math.round(size * scale * 1.5);
         }
         else
         {
            tf.autoSize = TextFieldAutoSize.LEFT;
         }
         tf.text = text;
         tf.x = x;
         tf.y = y;
         parent.addChild(tf);
         return tf;
      }

      // Wrapped text in a fixed width.
      public static function Para(parent:Sprite, x:Number, y:Number, text:String, size:Number, color:uint, width:Number) : TextField
      {
         var tf:TextField = Text(parent,x,y,"",size,color,REGULAR,width);
         tf.multiline = true;
         tf.wordWrap = true;
         tf.autoSize = TextFieldAutoSize.LEFT;
         tf.text = text;
         return tf;
      }

      public static function Box(g:Graphics, x:Number, y:Number, w:Number, h:Number, color:uint, alpha:Number) : void
      {
         g.beginFill(color,alpha);
         g.drawRect(x,y,w,h);
         g.endFill();
      }

      public static function Line(g:Graphics, x:Number, y:Number, w:Number, color:uint, alpha:Number = 1) : void
      {
         Box(g,x,y,w,1,color,alpha);
      }

      public static function Bar(g:Graphics, x:Number, y:Number, w:Number, h:Number, fraction:Number, color:uint = 0xE5B54B) : void
      {
         Box(g,x,y,w,h,0xFFFFFF,0.12);
         Box(g,x,y,Math.max(0,Math.min(1,fraction)) * w,h,color,1);
      }

      public static function Percent(done:int, total:int) : String
      {
         return total > 0 ? Math.floor(done * 100 / total) + "%" : "-";
      }

      public static function StatusColor(status:int) : uint
      {
         if(Model.IsDone(status))
         {
            return GREEN;
         }
         if(status == Model.IN_PROGRESS)
         {
            return ACCENT;
         }
         if(status == Model.FAILED)
         {
            return RED;
         }
         if(status == Model.NOT_AVAILABLE)
         {
            return DIM;
         }
         return WHITE;
      }
   }
}
