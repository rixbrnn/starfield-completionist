#include "Plugin.h"

namespace Completionist::Plugin
{
	namespace
	{
		// SFSE also sends save/load messages, but CommonLibSF's MessageType enum
		// stops at kPostPostDataLoad. Values are from sfse/PluginAPI.h.
		enum : std::uint32_t
		{
			kPreSaveGame = 4,
			kPostSaveGame = 5,
			kPreLoadGame = 6,
			kPostLoadGame = 7,
		};

		std::string_view MessageName(std::uint32_t a_type)
		{
			switch (a_type) {
			case kPreSaveGame:
				return "PreSaveGame";
			case kPostSaveGame:
				return "PostSaveGame";
			case kPreLoadGame:
				return "PreLoadGame";
			case kPostLoadGame:
				return "PostLoadGame";
			default:
				return "Unknown";
			}
		}

		// Spike S6: do save/load messages carry the save file name?
		// Logs the first bytes of the payload as hex and as printable text.
		void LogSavePayload(const SFSE::MessagingInterface::Message* a_msg)
		{
			if (!a_msg->data || a_msg->dataLen == 0) {
				REX::INFO("{}: no payload (dataLen={})", MessageName(a_msg->type), a_msg->dataLen);
				return;
			}

			constexpr std::uint32_t kMaxBytes = 128;
			const auto* bytes = static_cast<const std::uint8_t*>(a_msg->data);
			const auto  count = std::min(a_msg->dataLen, kMaxBytes);

			std::string hex;
			std::string text;
			for (std::uint32_t i = 0; i < count; ++i) {
				hex += std::format("{:02X}", bytes[i]);
				text += (bytes[i] >= 0x20 && bytes[i] < 0x7F) ? static_cast<char>(bytes[i]) : '.';
			}

			REX::INFO("{}: dataLen={} text=\"{}\" hex={}", MessageName(a_msg->type), a_msg->dataLen, text, hex);
		}

		// Spike S2: how many quests does the runtime see, per questType?
		void LogQuestTypes()
		{
			const auto* dataHandler = RE::TESDataHandler::GetSingleton();
			if (!dataHandler) {
				REX::WARN("TESDataHandler unavailable, skipping quest survey");
				return;
			}

			const auto& quests = dataHandler->formArrays[std::to_underlying(RE::FormType::kQUST)].formArray;

			std::array<std::uint32_t, 256> perType{};
			std::uint32_t                  withEditorID = 0;
			for (const auto& form : quests) {
				const auto* quest = static_cast<const RE::TESQuest*>(form.get());
				if (!quest) {
					continue;
				}
				++perType[quest->data.questType];
				if (const auto* editorID = quest->GetFormEditorID(); editorID && editorID[0] != '\0') {
					++withEditorID;
				}
			}

			REX::INFO("Quests loaded: {} ({} with an editor ID at runtime)", quests.size(), withEditorID);
			for (std::size_t type = 0; type < perType.size(); ++type) {
				if (perType[type] > 0) {
					REX::INFO("  questType {}: {}", type, perType[type]);
				}
			}
		}

		void OnMessage(SFSE::MessagingInterface::Message* a_msg) noexcept
		{
			switch (a_msg->type) {
			case SFSE::MessagingInterface::kPostDataLoad:
				REX::INFO("Game data loaded");
				LogQuestTypes();
				break;
			case kPreSaveGame:
			case kPostSaveGame:
			case kPreLoadGame:
			case kPostLoadGame:
				LogSavePayload(a_msg);
				break;
			default:
				break;
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
