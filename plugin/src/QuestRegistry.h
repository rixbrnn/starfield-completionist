#pragma once

namespace Completionist
{
	// A "complete"/"fail" rule from the quest collections (see data/schema/quests.schema.json).
	struct Condition
	{
		enum class Kind
		{
			kQuestStage,
			kAnyOf,
			kAllOf,
			kUnsupported,  // e.g. questCompleted, until we can read the completed flag
		};

		Kind                   kind{ Kind::kUnsupported };
		std::uint16_t          stage{ 0 };
		std::vector<Condition> children;

		[[nodiscard]] bool Evaluate(const RE::TESQuest& a_quest) const;
	};

	enum class QuestStatus
	{
		kNotStarted,
		kInProgress,
		kCompleted,
		kFailed,
	};

	[[nodiscard]] std::string_view ToString(QuestStatus a_status);

	struct TrackedQuest
	{
		std::string                id;
		std::string                name;
		std::string                editorID;
		std::string                type;
		std::string                place;  // "Neon < Volii Alpha < Volii"
		std::vector<std::uint16_t> stages;
		Condition                  complete;
		std::optional<Condition>   fail;
		RE::TESQuest*              form{ nullptr };

		[[nodiscard]] QuestStatus Status() const;
	};

	class QuestRegistry
	{
	public:
		// Loads every *.json collection in a_directory and resolves quests by editor ID.
		void Load(const std::filesystem::path& a_directory);

		[[nodiscard]] const std::vector<TrackedQuest>& Quests() const noexcept { return _quests; }

	private:
		void LoadFile(const std::filesystem::path& a_file);

		std::vector<TrackedQuest> _quests;
	};
}
