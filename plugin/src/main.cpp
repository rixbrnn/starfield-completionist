#include "Plugin.h"

SFSE_PLUGIN_PRELOAD(const SFSE::PreLoadInterface* a_sfse)
{
	SFSE::Init(a_sfse, {
		.logLevel = REX::ELogLevel::Debug,
		.logPattern = "[%m-%d %T.%e] [%L] %v",
	});

	return true;
}

SFSE_PLUGIN_LOAD(const SFSE::LoadInterface* a_sfse)
{
	SFSE::Init(a_sfse);
	return Completionist::Plugin::OnLoad();
}
