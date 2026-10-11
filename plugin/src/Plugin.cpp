#include "Plugin.h"

#include "QuestRegistry.h"

namespace Completionist::Plugin
{
	namespace
	{
		QuestRegistry              g_registry;
		std::vector<std::uint16_t> g_lastFlags;  // per quest: last logged QUEST_DATA::flags
		std::atomic_bool           g_checkQueued{ false };

		std::filesystem::path QuestDataDirectory()
		{
			// The game's working directory is the Starfield install folder.
			return std::filesystem::current_path() / "Data" / "SFSE" / "Plugins" / "StarfieldCompletionist" / "quests";
		}

		// Spike S1: which QUEST_DATA::flags bits mean running / completed?
		// Runs on the main thread and logs every quest whose flags changed since the last check.
		void CheckQuests()
		{
			const auto& quests = g_registry.Quests();
			g_lastFlags.resize(quests.size(), 0xFFFF);

			std::size_t                          changed = 0;
			std::map<std::uint16_t, std::size_t> histogram;
			for (std::size_t i = 0; i < quests.size(); ++i) {
				const auto& quest = quests[i];
				if (!quest.form) {
					continue;
				}
				const auto flags = quest.form->data.flags;
				++histogram[flags];
				if (flags == g_lastFlags[i]) {
					continue;
				}
				if (changed++ == 0) {
					REX::INFO("Quest flags changed:");
				}
				REX::INFO("  {:<34} {:<38} {:#06x} -> {:#06x}  [{}] {}", quest.editorID, quest.name, g_lastFlags[i], flags, quest.type, quest.place);
				g_lastFlags[i] = flags;
			}

			if (changed > 0) {
				REX::INFO("{} quests changed. Flags histogram:", changed);
				for (const auto& [flags, count] : histogram) {
					REX::INFO("  {:#06x}: {}", flags, count);
				}
			}
		}

		// SFSE doesn't tell plugins when a save loads (spike S6), so poll for changes.
		void StartQuestWatcher()
		{
			const auto* tasks = SFSE::GetTaskInterface();
			if (!tasks) {
				REX::ERROR("SFSE task interface unavailable; quest watcher not started");
				return;
			}
			std::thread([tasks] {
				for (;;) {
					std::this_thread::sleep_for(std::chrono::seconds(5));
					if (!g_checkQueued.exchange(true)) {
						tasks->AddTask([] {
							CheckQuests();
							g_checkQueued = false;
						});
					}
				}
			}).detach();
		}

		void OnMessage(SFSE::MessagingInterface::Message* a_msg) noexcept
		{
			if (a_msg->type == SFSE::MessagingInterface::kPostDataLoad) {
				REX::INFO("Game data loaded");
				g_registry.Load(QuestDataDirectory());
				StartQuestWatcher();
			}
		}
	}

	bool OnLoad()
	{
		REX::INFO("StarfieldCompletionist loading");

		const auto* messaging = SFSE::GetMessagingInterface();
		if (!messaging || !messaging->RegisterListener(OnMessage)) {
			REX::ERROR("Could not register the SFSE message listener");
			return false;
		}

		return true;
	}
}
