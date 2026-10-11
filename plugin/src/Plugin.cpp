#include "Plugin.h"

#include "QuestRegistry.h"

namespace Completionist::Plugin
{
	namespace
	{
		QuestRegistry            g_registry;
		std::vector<QuestStatus> g_lastStatus;  // per quest, as of the previous check
		std::atomic_bool         g_checkQueued{ false };
		std::uint32_t            g_checks{ 0 };

		std::filesystem::path QuestDataDirectory()
		{
			// The game's working directory is the Starfield install folder.
			return std::filesystem::current_path() / "Data" / "SFSE" / "Plugins" / "StarfieldCompletionist" / "quests";
		}

		struct Tally
		{
			std::size_t total{ 0 };
			std::size_t completed{ 0 };
			std::size_t inProgress{ 0 };
			std::size_t failed{ 0 };
		};

		void LogPlaceSummary(const std::vector<QuestStatus>& a_status)
		{
			const auto& quests = g_registry.Quests();
			std::map<std::string, Tally> byPlace;
			Tally                        overall;
			for (std::size_t i = 0; i < quests.size(); ++i) {
				for (auto* tally : { &byPlace[quests[i].place.empty() ? "(no place)" : quests[i].place], &overall }) {
					++tally->total;
					tally->completed += a_status[i] == QuestStatus::kCompleted;
					tally->inProgress += a_status[i] == QuestStatus::kInProgress;
					tally->failed += a_status[i] == QuestStatus::kFailed;
				}
			}

			REX::INFO("Progress: {}/{} completed, {} in progress, {} failed", overall.completed, overall.total, overall.inProgress, overall.failed);
			for (const auto& [place, tally] : byPlace) {
				const auto missing = tally.total - tally.completed - tally.inProgress - tally.failed;
				REX::INFO("  {:>3}/{:<3} done  {:>2} active  {:>2} not started  {}", tally.completed, tally.total, tally.inProgress, missing, place);
			}
		}

		// Runs on the main thread: evaluates every quest and logs what changed.
		void CheckQuests()
		{
			const auto& quests = g_registry.Quests();
			std::vector<QuestStatus> status;
			status.reserve(quests.size());
			for (const auto& quest : quests) {
				status.push_back(quest.Status());
			}

			const bool  first = g_lastStatus.empty();
			std::size_t changed = 0;
			if (!first) {
				for (std::size_t i = 0; i < quests.size(); ++i) {
					if (status[i] != g_lastStatus[i]) {
						if (changed++ == 0) {
							REX::INFO("Quest status changes:");
						}
						REX::INFO("  {:<38} {} -> {}  [{}] {}", quests[i].name, ToString(g_lastStatus[i]), ToString(status[i]), quests[i].editorID, quests[i].place);
					}
				}
			}

			if (first || changed > 0) {
				LogPlaceSummary(status);
			} else if (++g_checks % 12 == 0) {
				const auto done = std::ranges::count(status, QuestStatus::kCompleted);
				REX::INFO("Watching {} quests ({} completed); no changes", quests.size(), done);
			}
			g_lastStatus = std::move(status);
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
