-- set minimum xmake version
set_xmakever("3.0.0")

-- CommonLibSF provides the game API and the "commonlibsf.plugin" rule
includes("lib/commonlibsf")

-- set project constants
set_project("StarfieldCompletionist")
set_version("0.1.0")
set_license("GPL-3.0")
set_languages("c++23")
set_warnings("allextra")
set_encodings("utf-8")

-- add common rules
add_rules("mode.debug", "mode.releasedbg")
add_rules("plugin.vsxmake.autoupdate")

-- define targets
target("StarfieldCompletionist", function()
    add_rules("commonlibsf.plugin", {
        name = "StarfieldCompletionist",
        author = "rixbrnn",
        description = "Tracks quest completion by star system, planet and city",
        xse_minimum = "0.2.21"
    })

    add_files("plugin/src/**.cpp")
    add_headerfiles("plugin/src/**.h")
    add_includedirs("plugin/src")
    set_pcxxheader("plugin/src/pch.h")
end)
