# What selling an achievement-friendly copy takes

**Ticket:** [#13](https://github.com/rixbrnn/starfield-completionist/issues/13) (map [#1](https://github.com/rixbrnn/starfield-completionist/issues/1)).
**Status:** answered from Bethesda's public pages, the Creation Kit EULA, the live Creations catalog, the Creation Kit's own strings, the GPL and GNU's GPL FAQ, and this repo's history (2026-10-16). Nobody applied to the program or contacted Bethesda.

> **This is research, not legal advice.** The licensing sections read public licence and contract text against this repo's facts. Before selling anything, have a lawyer check them. The contract that sets revenue share and pricing is not public. Items marked **unverified** could not be confirmed from a primary source.

## Verdict: feasible, with two conditions

A paid achievement-friendly copy next to the free one is a **common, general arrangement**, not a special deal. The catalog has about 80 third-party "Achievement Friendly" listings from about 40 creators, all paid (from 100 credits), most named as the copy of a free Creation. Nothing in the licences stops the owner from selling this repo's code there **today**, for one reason: he is still its **only copyright holder**. Two things could block it:

1. **Generative AI.** Bethesda's FAQ says Creations sold through the program "cannot contain anything produced through generative AI." Four of this repo's 80 commits carry a `Co-Authored-By: Claude` trailer, and the project is developed with AI agents (`.claude/`). Bethesda's FAQ doesn't define the term, so whether AI-assisted code counts is **unverified**. Ask Bethesda before spending effort on a paid copy. [vcp-faq]
2. **Outside contributors.** Once someone else's code is merged under GPL-3.0-or-later only, as `CONTRIBUTING.md` asks today, that code can probably not go into the paid copy without that person's written permission (see [Licensing](#licensing-can-gpl-code-be-sold-there)). Change the contribution terms before taking outside code, or keep outside code out of the Creations edition.

Everything else is paperwork and waiting: an application with no published timeline, Microsoft Partner Center enrollment, and Bethesda QA on every release and update of the paid copy.

## Answers at a glance

| Question | Answer | Source |
|---|---|---|
| Who can sell? | Only admitted Verified Creators. Anyone can release free Creations. | [vcp] |
| How to apply | "Apply now" on the program page, after logging in to Bethesda.net | [vcp], [bs-63828] |
| Requirements | A portfolio, the latest Creation Kit, a Bethesda.net account linked to Xbox, MFA, Discord | [vcp] |
| Individual or team | Individuals can join. Teams must be a registered business. | [vcp-faq] |
| How long | "Varies from applicant to applicant." No figure published. | [vcp-faq] |
| Payment | Royalty per sale, paid through Microsoft Partner Center | [vcp], [ck-eula] 2D(b) |
| Revenue share | **Not public.** Set by the "Bethesda Creations Online Durables Provider Agreement", which is not published. | [ck-eula] 1D(b) |
| Who sets the price | The creator, "from a set selection of options". The CK has a price-review status. | [vcp-faq], [ck-binary] |
| Lowest price tier | **100 credits** is the lowest price seen on any achievement-friendly listing. No official tier list found. | [af-search] |
| Who owns the content | The creator. ZeniMax gets a licence to host and sell it, as agent. | [ck-eula] 2A, 2D(b) |
| Exclusivity | The paid copy may not be put on other sites or given away for free (EULA 2D(d)). An identical free version is allowed in practice, and Bethesda recommends one. | [ck-eula], [vcp-faq], [cmui-af] |
| Free + paid pair allowed? | Yes, generally: Bethesda's FAQ recommends keeping the free original, and about 40 creators do. | [vcp-faq], [af-search] |
| Separate Creations? | In practice, yes: two listings. An existing free Creation can also be switched to Verified, but then it is no longer free. | [af-search], [bs-69345] |
| Build changes? | None needed: Compact Mission UI's paid copy is "Identical to free version". Achievement-friendly is a catalog flag. | [cmui-af], [ck-binary] |
| Review changes? | The paid copy goes through Bethesda QA, and each update is re-submitted. The free one doesn't. | [vcp-faq] |

## Joining the Verified Creator Program

- **What it is.** It replaces Creation Club. Creation Club members were "hired and paid as professional contract developers". Verified Creators earn royalties from sales instead. [vcp-faq]
- **What you need** (program page, and Bethesda Support): [vcp], [bs-63828]
  - modding experience, "or a willingness to learn"
  - a portfolio for review (the FAQ says "as simple as a list of mods" is fine). Completionist's Nexus edition would be the portfolio.
  - the latest Creation Kit (Steam)
  - a Bethesda.net account linked to an Xbox account, with MFA on
  - a Discord account: Verified Creators talk to staff on a private Discord server
- **After acceptance:** "you'll be asked to enroll in the Microsoft Partner Center, which is how you will receive payment". **Unverified:** what Partner Center asks for (likely tax and bank details). [vcp]
- **Teams** "must be a registered business for payment purposes" (entity name, jurisdiction, office address). A solo owner can apply as an individual. [vcp-faq]
- **Timeline:** none published, and it "varies from applicant to applicant". Bethesda posts updates on its Discord. [vcp-faq]
- **The application form is behind a Bethesda.net login.** Its fields were not seen, and the terms shown on admission are not public. [vcp]
- **Stale page.** The FAQ still lists Starfield as PC and Xbox only, while the catalog shows PlayStation (see the [platform rules research](https://github.com/rixbrnn/starfield-completionist/blob/research/creations-platform-rules/docs/research/creations-platform-rules.md)). [vcp-faq]

## What a sold Creation must meet

From the FAQ's "What kind of Creations can I sell?". Bethesda adds that an "internal document available to Verified Creators has some specifics" that are not public. [vcp-faq]

- **Standalone:** it "cannot depend on other community releases, free or paid". Completionist's Creations edition has no community dependencies (OSF UI and OSF Settings are Nexus-edition only). Bethesda's DLCs are not community releases.
- **Re-purposed free content is allowed.** Bethesda recommends making it "upgraded or otherwise distinct from the original" and keeping the original free. These are recommendations, not rules: Compact Mission UI's paid copy is identical to its free one. [vcp-faq], [cmui-af]
- **Other authors' work** only "if contracted or if you have received explicit approval for use before release". This matters for outside contributors (see [Licensing](#licensing-can-gpl-code-be-sold-there)).
- **"Creations cannot contain anything produced through generative AI."** No definition is given. See the [verdict](#verdict-feasible-with-two-conditions).
- **Fewer rules than Creation Club:** no game patch needed, voice-over allowed, no lore-friendly requirement, platform content and storage rules still apply. The FAQ also says Verified content "May not be localized in multiple languages". Whether that means "need not be" or "must not be" is **unverified**. Translations are out of the map's scope anyway.
- **All Game Mods**, free or paid, must carry the notice "THIS MOD IS NOT MADE, GUARANTEED OR SUPPORTED BY ZENIMAX OR ITS AFFILIATES." [ck-eula] 2B

## The contract terms

The public layer is the **Starfield Creation Kit EULA** and the ZeniMax Terms of Service. The commercial terms sit in a document that is not public. [ck-eula], [tos]

- **Two kinds of use.** CK use is limited to (i) "personal non-commercial use", or (ii) Game Mods "approved by Bethesda … to be distributed through Bethesda Creations", which the EULA calls **"Creations Paid Content"**. Charging for any other mod is banned, and so is asking for fees or crowdfunding to make one. [ck-eula] 1, 1D(a)
  - Bethesda's community standards repeat this: "No Crowdfunding or Monetization mod projects". So no donation links or crowdfunding for the free edition either. [standards]
- **Price and revenue share:** "the fee shall be established and controlled in accordance with … the Bethesda Creations Online Durables Provider Agreement". That agreement is not public, and no search found it. **Unverified:** the royalty percentage. No primary source gives one. Forum guesses (25%, 30%) refer to the 2015 Steam paid-mods deal or are speculation. Don't plan on any figure. [ck-eula] 1D(b), 11
- **Ownership:** the creator keeps ownership: "you do not transfer ownership of any of your Creations Paid Content to ZeniMax". [ck-eula] 2A, 2D(b)
- **Licence to ZeniMax for paid content:** "except for any material subject to any FOSS licenses", ZeniMax gets a worldwide right, as the creator's "agent, or commissionaire", to host it, copy it, sell it to customers and handle taxes through Microsoft's commerce platform. ZeniMax may also re-check it after release. [ck-eula] 2D(b)
  - Free mods give ZeniMax a much broader licence: perpetual, irrevocable, the right to modify, reuse in other games, and more. [ck-eula] 2D(a)
- **FOSS clause:** if any of the mod's code is "licensed under any FOSS License, you are solely responsible for: (i) compliance with those license terms … including any source code availability requirements, and (ii) ensuring that ZeniMax … has the necessary rights". So the EULA expects open-source code in paid content, and puts compliance on the creator. [ck-eula] 2D(c)
- **Exclusivity of the paid copy.** You may not "(2) distribute the Game Mods available on our Bethesda Creations on third party websites; (3) distribute the Paid Game Mods available on our Bethesda Creations for free", unless ZeniMax agrees. [ck-eula] 2D(d)
  - Read with the FAQ, the paid *listing* is exclusive to Creations. The FAQ's "You may also release your free content on other platforms" and the identical free versions on Nexus and Creations show an identical free version is tolerated. [vcp-faq], [cmui-af]
  - **Unverified:** how Bethesda reads 2D(d) for a paid copy whose source is public on GitHub.
- **No commercial use by others.** "You will not permit any third party to download, distribute or use Game Mods developed or created by You for any commercial purpose." This conflicts with the GPL, which lets anyone sell copies. It already applies to every GPL mod made with the CK, free ones included (Ship Vendor Framework is a GPL-3.0 free Creation). **Unverified:** how Bethesda treats this. [ck-eula] 2A, [svf-repo]
- **Warranty about contributors.** The creator promises each Game Mod "is originally created by You (or created by You and the other identified contributors, in which You represent You have the right to submit such Game Mod on behalf of those other contributors)". [ck-eula] 3
- **Bethesda may remove anything** at any time, and console makers may refuse to allow a mod. [ck-eula] 2C
- **Governing law:** Maryland for North America, England elsewhere. [ck-eula] 10

## The free + paid pair

- **It is a general pattern.** A search of the Starfield catalog for "achievement friendly" (pages 1 to 4 read on 2026-10-16) lists 80 third-party achievement-friendly Creations from about 40 creators. Most are named "<free name> - Achievement Friendly" (or "… Version"), and every one is paid. Not every free sibling was opened, so the pair count is approximate. Most cost 100 credits, a few 200 to 400. Stentorious alone has Compact Mission UI, Compact Crew UI, Accurate Aiming, Simple Save Manager and others as pairs. [af-search]
- **Bethesda recommends it.** The FAQ recommends that "re-purposed content remain available for free in its original form". [vcp-faq]
- **Two listings in practice.** Every pair seen is two separate Creations with their own pages and IDs: free *Compact Mission UI* (`51dab2d2-…`) and paid *Compact Mission UI | Achievement Friendly* (`e1d36498-…`). [cmui-cat], [cmui-af]
  - **The alternative** is switching the free Creation itself to Verified. Bethesda Support mentions "a Verified Creation that was previously a free creation" and "'Achievement Friendly' Creations that were updated as Verified Creations". That would end the free edition, so it doesn't fit the map's plan. [bs-69345]
- **The paid copy can be identical.** The Compact Mission UI | Achievement Friendly page says "Identical to free version. Continue to earn achievements. Support the mod author." It costs 100 credits, has about 126,000 plays on PC, and was created Apr 6, 2025. [cmui-af]
- **A free achievement-friendly Creation** from a third party was still not found. The earlier research left this open, and it stays **unverified**. Nothing in the FAQ or EULA promises the option. Every one seen is paid.
- **Achievement-friendly is opt-in by the creator** for Verified releases since 1.14.74 (official @StarfieldGame post, cited in the [platform rules research](https://github.com/rixbrnn/starfield-completionist/blob/research/creations-platform-rules/docs/research/creations-platform-rules.md)). The Creation Kit has an `achievement_friendly` catalog field. **Unverified:** where the creator sets it. [ck-binary]

## Price

- **Lowest tier: 100 credits** on every achievement-friendly listing seen, and Bethesda says prices come "from a set selection of options". No official tier list is public. Prices seen are 100, 200, 300 and 400 (and up to 1,000 elsewhere in the store). [vcp-faq], [af-search]
  - **Unverified:** whether a tier below 100 exists.
- **Real money (secondary):** Creation Credits are sold in packs, the smallest reported as 500 credits for $4.99, which makes 100 credits about $1. [siliconera]
- **Price review.** The Creation Kit's review statuses include `STATUS_REVIEW_PRICE_PENDING`, next to `REVIEW_PENDING`, `APPROVAL_PENDING`, `CERT_PENDING`, `PUBLISH_PENDING`, `REVISION` and `REJECTED`. Reading these as stages of a paid release is an inference. [ck-binary]

## Licensing: can GPL code be sold there?

This repo is GPL-3.0-or-later (`LICENSE`), with a modding exception and a GPLv3 section 7 linking permission (`EXCEPTIONS`). It is public, and `CONTRIBUTING.md` says "By contributing you agree your work is licensed under GPL-3.0-or-later". There is no CLA.

**Facts about the repo today** (`git log`, `gh api …/contributors`, `gh pr list --state all`, 2026-10-16):

- All 80 commits are by Richard Bringmann. The only GitHub contributor is `rixbrnn`, and no pull request was ever opened. So **every copyrightable line is the owner's**.
- Four commits carry `Co-Authored-By: Claude Opus 5.5` (Oct 14 to 15, 2026). See the [verdict](#verdict-feasible-with-two-conditions).
- The Creations edition would ship `QuestTracker.psc`, the generated quest table and a replaced `missionmenu.swf`. It would not ship the vendored OSF scripts or CommonLibSF, which belong to the Nexus edition.

**What the GPL and GNU say:**

- **Selling is allowed.** "Yes, the GPL allows everyone to do this. The right to sell copies is part of the definition of free software." [gpl-faq#DoesTheGPLAllowMoney]
- **The copyright holder can license the same code differently in parallel:** "If you are the copyright holder for the code, you can release it under various different non-exclusive licenses at various times." [gpl-faq#ReleaseUnderGPLAndNF], [gpl-faq#HeardOtherLicense]
  - So the owner can give Bethesda the EULA's licence for his own code and still keep the GitHub repo GPL. Nobody else can.
- **The public GPL release can't be taken back.** "The public already has the right to use the program under the GPL, and this right cannot be withdrawn." Anyone may keep redistributing the GitHub code under the GPL, even for money. [gpl-faq#CanDeveloperThirdParty]
- **Other people's GPL code can't be put under other terms without their permission.** When X wants to relicense Y's contributions: "X must get Y's permission before releasing that code under another license." [gpl-faq#Consider]
- **GPL code under extra restrictions:** "You may not impose any further restrictions on the exercise of the rights granted" (GPLv3 §10). If you can't meet the GPL and another obligation at once, "you may not convey it at all" (§12). [LICENSE]
  - The Creations terms give players only a "personal, private, non-commercial, non-transferable" licence and forbid redistribution. [tos] 2C, [ck-eula] 2D(d)
  - So putting a contributor's GPL-only code into the paid copy would probably break §10 and §12, unless the contributor agrees to other terms. **Unverified legal reading.** [LICENSE]
- **The modding exception doesn't help here.** It only permits linking with the game's code ("Modded Code") and with "Modding Libraries". It doesn't permit platform restrictions on recipients. [EXCEPTIONS]
- **Installation Information (§6)** applies when object code is conveyed with a "User Product" whose possession is transferred. A mod download doesn't transfer the console, so this is **probably** not an issue (**unverified**). [LICENSE] §6, [gpl-faq#Tivoization]

**So, what would have to change:**

1. **Nothing yet, for the owner's own code.** He can submit it as Creations Paid Content under the EULA (an extra, parallel licence) and keep the repo GPL. The EULA's FOSS clause means he should make sure the paid copy doesn't depend on anyone else's GPL code. [ck-eula] 2D(b)–(c)
2. **Before accepting outside code, choose one:**
   - **a.** Add an inbound grant to `CONTRIBUTING.md`: contributors keep copyright, license their work under GPL-3.0-or-later, and also give the owner the right to distribute it under other terms, including through Bethesda Creations. This is a CLA or a licence grant (FSF's own practice is assignment, [gpl-faq#AssignCopyright]). It needs a lawyer's wording, and it may put off contributors.
   - **b.** Ask each contributor for written permission before a release that includes their code. The FAQ's "explicit approval for use before release" and EULA §3 ("other identified contributors") point this way too. [vcp-faq], [ck-eula] 3
   - **c.** Keep outside code out of the Creations edition. That is hard, because the map plans one shared tracker core.
   - **Quest data fixes** (`data/curation.json`, `data/quests/*.json`), which `CONTRIBUTING.md` names as the most useful contributions, are mostly facts about the game. **Unverified:** whether they are copyrightable at all. Don't rely on that without advice.
3. **Keeping the paid copy's extra parts private: not needed.** The achievement-friendly copy can be byte-identical (Compact Mission UI), and achievement-friendly is a catalog flag, so there are no extra parts. The GPL wouldn't need private parts published anyway: modified versions only have to be released if they are distributed ([gpl-faq#GPLRequireSourcePostedPublic]). The copyright holder's own non-GPL distribution doesn't trigger source obligations either.
4. **Write it down.** Note in `README`/`LICENSE` that the Creations copies are distributed by the copyright holder under Bethesda's terms, while the source stays GPL. And say on the free and paid listings where the GPL source lives. **Unverified:** whether Bethesda accepts a GitHub link in a paid listing's description. Compact Mission UI links to its Nexus page. [cmui-af]
5. **Bethesda-owned files** aren't GPL'd, whatever happens. The replaced `missionmenu.swf` is derived from Bethesda's vanilla movie. The GPL can only cover this repo's own code (that's why `EXCEPTIONS` exists). The EULA forbids distributing "anything owned by ZeniMax" unless ZeniMax agrees, but replacement vanilla SWFs are accepted on Creations in practice (Compact Mission UI). [ck-eula] 2D(d)

## Does it change the build, review or upload?

- **Build: no.** The paid copy can be the same plugin and archives as the free one. Two Creations need two catalog entries. **Unverified:** whether they need different plugin file names to coexist in a load order. Players should run only one. The CMUI pair are "Identical", and Bethesda Support warns players to uninstall the old version when switching. [cmui-af], [bs-69345]
- **Review: yes, more of it.** Content for sale goes through "a quality assurance validation process". Its length "can vary" with the content's type and size, then the content is "scheduled to be published". Every update to the paid copy is re-submitted "for verification". Several submissions may be tested "one at a time". [vcp-faq]
  - The free copy only gets ordinary review, so the two copies can drift apart while the paid one waits in QA. That matters for "Releases across editions" and "Two Creations from one build" on the map.
- **Upload: the same tool.** Paid content is submitted "through the Creation Kit tool", with ZeniMax approving or rejecting it. [ck-eula] 2C
  - The Creation Kit checks enrollment (`/ugcmods/v1/partner/verified-creator`, `VerifiedCreatorCheckAsync`, `ModsRequiresVerifiedCreator`) and knows `author_price` and `author_verified`. **Unverified:** the exact upload steps for paid content. [ck-binary]
- **Disclaimer:** both copies must carry the ZeniMax notice. [ck-eula] 2B

## What this changes elsewhere

- **Map scope:** the paid copy is possible but conditional. The generative-AI rule is the first thing to settle, and only Bethesda can answer it. If AI-assisted code disqualifies the paid copy, the plan is free-only, with achievements off.
- **Contributions (`CONTRIBUTING.md`):** if a paid copy stays on the table, the contribution terms must change *before* the first outside code is merged. That is a decision for the map, possibly an ADR.
- **"Two Creations from one build":** confirmed as two catalog entries from one identical build. Plugin names are an open question. Paid-copy updates wait in QA longer than the free copy's.
- **"Releases across editions":** add the paid copy's extra QA wait to the release-cadence question.
- **Free edition:** no donation or crowdfunding links ([ck-eula] 1D(a), [standards]). The ZeniMax disclaimer is required.
- **#4 (build and upload):** unchanged for the free Creation. The paid copy uses the same Creation Kit upload, plus price review and QA.

## Sources

Primary (Bethesda, the Creations catalog, the Creation Kit, GNU/FSF, this repo):

- [vcp]: Creations site, "Bethesda Game Studios Creations" (Verified Creator Program) page, "How to apply" section, https://creations.bethesda.net/en/creators/bethesdagamestudios (read 2026-10-16; JavaScript page, read in a browser). The "Apply now" button opens a Bethesda.net login; nothing was submitted.
- [vcp-faq]: same page, FAQ section, all 17 answers expanded (read 2026-10-16).
- [bs-63828]: Bethesda Support, "How do I apply to be a Verified Creator?", https://help.bethesda.net/app/answers/detail/a_id/63828
- [bs-69345]: Bethesda Support, "Why am I getting an 'Achievements are disabled' message with Achievement Friendly Creations?", https://help.bethesda.net/app/answers/detail/a_id/69345 (read 2026-10-16)
- [ck-eula]: "Starfield: Creation Kit EULA" (ZeniMax), https://store.steampowered.com/eula/2722710_eula_0 (read 2026-10-16; undated). Sections cited: preamble, 1, 1D(a)–(b), 2A–2D, 3, 10, 11.
- [tos]: ZeniMax Media Terms of Service, Last Updated November 12, 2024, https://bethesda.net/en/document/terms-of-service (§2 B–D: UGC, Downloadable Content, Game Mods)
- [standards]: Bethesda Softworks Community Standards, "Mods" section, https://bethesda.net/en/article/27gkMO8RS6PPItVrenpbuC/bethesda-softworks-community-standards
- Code of Conduct (Last Updated September 7, 2020), https://bethesda.net/en/document/code-of-conduct: checked for AI rules, none found.
- [ck-binary]: Starfield Creation Kit 1.16.244, `CreationKit.exe`, strings read locally: `achievement_friendly`, `author_price`, `author_verified`, `/ugcmods/v1/partner/verified-creator`, `VerifiedCreatorCheckAsync`, `ModsRequiresVerifiedCreator`, `STATUS_REVIEW_*`
- Creations catalog (creations.bethesda.net, read 2026-10-16):
  - [af-search] search "achievement friendly", pages 1–4: https://creations.bethesda.net/en/starfield/all?text=achievement%20friendly
  - [cmui-cat] Compact Mission UI (free): https://creations.bethesda.net/en/starfield/details/51dab2d2-c610-4317-a6bf-144c92cb44b4/Compact_Mission_UI
  - [cmui-af] Compact Mission UI | Achievement Friendly (100 credits): https://creations.bethesda.net/en/starfield/details/e1d36498-3d58-4de9-bb88-c440b8e73518/Compact_Mission_UI___Achievement_Friendly
- [svf-repo]: Ship Vendor Framework repo, licence GPL-3.0 per GitHub API, https://github.com/rux616/starfield-ship-vendor-framework
- [gpl-faq]: GNU, "Frequently Asked Questions about the GNU Licenses", https://www.gnu.org/licenses/gpl-faq.html: entries `#DoesTheGPLAllowMoney`, `#ReleaseUnderGPLAndNF`, `#HeardOtherLicense`, `#CanDeveloperThirdParty`, `#Consider`, `#GPLRequireSourcePostedPublic`, `#AssignCopyright`, `#Tivoization`
- [LICENSE]: this repo's `LICENSE` (GPL-3.0 text: §6, §10, §12), `EXCEPTIONS`, `CONTRIBUTING.md`, `package.json` (`"license": "GPL-3.0-or-later"`)
- Repo history: `git log` (80 commits, one author, four `Co-Authored-By: Claude` trailers), `gh api repos/rixbrnn/starfield-completionist/contributors`, `gh pr list --state all` (none)
- Earlier finding: [What Creations allow on Xbox, PS5 and PC](https://github.com/rixbrnn/starfield-completionist/blob/research/creations-platform-rules/docs/research/creations-platform-rules.md) (#2)

Secondary (community or press, used only where marked):

- [siliconera]: Siliconera, "How to get Starfield Creation Credits", https://www.siliconera.com/how-to-get-starfield-creation-credits/ (pack sizes and prices)
- UESP, "Skyrim Mod:Verified Creator Program", https://en.uesp.net/wiki/Skyrim_Mod:Verified_Creator_Program: no royalty figure, no contract terms
- Nexus Mods forums, "Bethesda's New Verified Creator Program", https://forums.nexusmods.com/topic/13457609-bethesdas-new-verified-creator-program/page/3/: users note the split isn't published; figures there are guesses or about the 2015 Steam deal

Not found: the "Bethesda Creations Online Durables Provider Agreement", the internal Verified Creator guidelines, any published royalty percentage, an official price-tier list, and any open-source *paid* Creation to compare with.
