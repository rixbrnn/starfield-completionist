#include "QuestRegistry.h"

#include <nlohmann/json.hpp>

namespace Completionist
{
	namespace
	{
		Condition ParseCondition(const nlohmann::json& a_json)
		{
			Condition condition;
			const auto type = a_json.value("type", "");
			if (type == "questStage" && !a_json.contains("form")) {
				condition.kind = Condition::Kind::kQuestStage;
				condition.stage = a_json.value<std::uint16_t>("stage", 0);
			} else if (type == "anyOf" || type == "allOf") {
				condition.kind = type == "anyOf" ? Condition::Kind::kAnyOf : Condition::Kind::kAllOf;
				for (const auto& child : a_json.value("conditions", nlohmann::json::array())) {
					condition.children.push_back(ParseCondition(child));
				}
			}
			return condition;
		}
	}

	bool Condition::Evaluate(const RE::TESQuest& a_quest) const
	{
		switch (kind) {
		case Kind::kQuestStage:
			return a_quest.IsStageDone(stage);
		case Kind::kAnyOf:
			return std::ranges::any_of(children, [&](const auto& a_child) { return a_child.Evaluate(a_quest); });
		case Kind::kAllOf:
			return std::ranges::all_of(children, [&](const auto& a_child) { return a_child.Evaluate(a_quest); });
		default:
			return false;
		}
	}

	std::string_view ToString(QuestStatus a_status)
	{
		switch (a_status) {
		case QuestStatus::kNotStarted:
			return "not started";
		case QuestStatus::kInProgress:
			return "in progress";
		case QuestStatus::kCompleted:
			return "completed";
		case QuestStatus::kFailed:
			return "failed";
		}
		return "?";
	}

	QuestStatus TrackedQuest::Status() const
	{
		if (!form) {
			return QuestStatus::kNotStarted;
		}
		if (complete.Evaluate(*form)) {
			return QuestStatus::kCompleted;
		}
		if (fail && fail->Evaluate(*form)) {
			return QuestStatus::kFailed;
		}
		const auto started = std::ranges::any_of(stages, [&](auto a_stage) { return form->IsStageDone(a_stage); });
		return started ? QuestStatus::kInProgress : QuestStatus::kNotStarted;
	}

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
				.stages = quest.value("stages", std::vector<std::uint16_t>{}),
				.complete = ParseCondition(quest.value("complete", nlohmann::json::object())),
			};
			if (quest.contains("fail") && quest["fail"].is_object()) {
				tracked.fail = ParseCondition(quest["fail"]);
			}
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
