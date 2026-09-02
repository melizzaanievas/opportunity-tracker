import { Request, Response } from "express";
import { 
  answerTelegramCallbackQuery, 
  editTelegramMessage, 
  sendTelegramMessage, 
  buildDailySummary 
} from "./bot";

export async function handleTelegramWebhook(req: Request, res: Response) {
  try {
    const { message, callback_query } = req.body;

    // Handle Inline Button Clicks
    if (callback_query) {
      const { id, data, message: cbMessage } = callback_query;
      if (data.startsWith("add_opp:")) {
        const idStr = data.replace("add_opp:", "");
        await answerTelegramCallbackQuery(id, "Added to pipeline!");
        await editTelegramMessage(cbMessage.chat.id, cbMessage.message_id, `${cbMessage.text}\n\n✅ <i>Added to pipeline</i>`);
      } else if (data.startsWith("ignore_opp:")) {
        await answerTelegramCallbackQuery(id, "Ignored");
        await editTelegramMessage(cbMessage.chat.id, cbMessage.message_id, `<s>${cbMessage.text}</s>\n\n❌ <i>Ignored</i>`);
      }
      return res.status(200).send("OK");
    }

    // Handle Commands
    if (message?.text) {
      const text = message.text.trim();

      if (text.startsWith("/start")) {
        await sendTelegramMessage(
          "🎯 <b>Opportunity Scout Bot Active!</b>\n\nCommands:\n• <code>/scout &lt;query&gt;</code> - Search live opportunities\n• <code>/digest</code> - View 7-day pipeline summary"
        );
      } else if (text.startsWith("/digest")) {
        const digest = await buildDailySummary();
        await sendTelegramMessage(digest.text);
      } else if (text.startsWith("/scout")) {
        const query = text.replace("/scout", "").trim();
        if (!query) {
          await sendTelegramMessage("Please provide a query, e.g., <code>/scout AI Fellowships 2026</code>");
        } else {
          await sendTelegramMessage(`🔍 Scouting live opportunities for: <b>${query}</b>...`);
          // Trigger SerpAPI / JSearch query logic here
        }
      }
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook processing error:", err);
    return res.status(500).send("Error");
  }
}
