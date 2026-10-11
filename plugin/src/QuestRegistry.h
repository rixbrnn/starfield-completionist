#pragma once

namespace Completionist
{
	struct TrackedQuest
	{
		std::string   id;
		std::string   name;
		std::string   editorID;
		std::string   type;
		std::string   place;  // "Neon < Volii Alpha < Volii"
		RE::TESQuest* form{ nullptr };
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
