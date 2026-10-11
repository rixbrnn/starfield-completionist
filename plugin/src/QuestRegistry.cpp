#include "QuestRegistry.h"

#include <nlohmann/json.hpp>

namespace Completionist
{
	void QuestRegistry::Load(const std::filesystem::path& a_directory)
	{
		_quests.clear();

		std::error_code error;
		if (!std::filesystem::is_directory(a_directory, error)) {
			REX::WARN("Quest data folder not found: {}", a_directory.string());
			return;
		}

		for (const auto& entry : std::filesystem::directory_iterator(a_directory, error)) {
			if (entry.is_regular_file() && entry.path().extension() == ".json") {
				LoadFile(entry.path());
			}
		}

		const auto resolved = std::ranges::count_if(_quests, [](const auto& a_quest) { return a_quest.form != nullptr; });
		REX::INFO("Quest data: {} quests, {} found in game data", _quests.size(), resolved);
	}

	void QuestRegistry::LoadFile(const std::filesystem::path& a_file)
	{
		nlohmann::json data;
		try {
			std::ifstream stream(a_file);
			data = nlohmann::json::parse(stream);
		} catch (const std::exception& e) {
			REX::ERROR("{}: could not parse ({})", a_file.filename().string(), e.what());
			return;
		}

		// Place id -> "Hub < Planet < System"
		std::unordered_map<std::string, std::pair<std::string, std::string>> places;  // id -> (name, parent)
		for (const auto& place : data.value("places", nlohmann::json::array())) {
			places[place.value("id", "")] = { place.value("name", ""), place.value("parent", "") };
		}
		const auto describePlace = [&](std::string a_id) {
			std::string path;
			for (int depth = 0; depth < 8 && places.contains(a_id); ++depth) {
				const auto& [name, parent] = places[a_id];
				path += path.empty() ? name : " < " + name;
				a_id = parent;
			}
			return path;
		};

		std::size_t loaded = 0;
		std::size_t missing = 0;
		for (const auto& quest : data.value("quests", nlohmann::json::array())) {
			TrackedQuest tracked{
				.id = quest.value("id", ""),
				.name = quest.value("name", ""),
				.editorID = quest.value("editorId", ""),
				.type = quest.value("type", ""),
				.place = describePlace(quest["start"].value("place", "")),
			};
			if (const auto* form = RE::TESForm::LookupByEditorID(tracked.editorID.c_str()); form && form->Is(RE::FormType::kQUST)) {
				tracked.form = const_cast<RE::TESQuest*>(static_cast<const RE::TESQuest*>(form));
			} else {
				++missing;
				REX::WARN("{}: quest {} ({}) not found in game data", a_file.filename().string(), tracked.editorID, tracked.name);
			}
			_quests.push_back(std::move(tracked));
			++loaded;
		}

		REX::INFO("{}: {} quests ({} not found)", a_file.filename().string(), loaded, missing);
	}
}
