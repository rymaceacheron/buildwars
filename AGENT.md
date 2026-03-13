# Guild Wars 1 Build Creator — Project Plan

## 1. Project Overview

A web application built with **Vue.js** that lets players create, share, and manage character builds for Guild Wars (original). The app replicates the in-game Skills and Attributes Panel experience in the browser, with features for generating and parsing the game's native template codes.

**Existing tools for reference:**
- [guildwars.magical.ch](https://guildwars.magical.ch/) — mobile-friendly build creator (closest comparable project)
- [gwskillbar (GitHub)](https://github.com/haliphax/gwskillbar) — open-source template parser for GW Reforged
- [GW Memorial Template Decoder](https://www.gw-memorial.net/templateDecoder/) — decodes template strings
- [PvXwiki](https://gwpvx.fandom.com/) — community build repository
- [GWToolbox++](https://www.gwtoolbox.com/builds) — in-game build manager

---

## 2. Game Mechanics to Model

### 2.1 Professions (10 total)

Each character has a **primary profession** (permanent, determines armor and primary attribute) and a **secondary profession** (swappable, grants access to skills/attributes but NOT the primary attribute).

| Profession | Primary Attribute | Campaign | Secondary Attributes |
|---|---|---|---|
| Warrior | Strength | Core | Hammer Mastery, Axe Mastery, Swordsmanship, Tactics |
| Ranger | Expertise | Core | Marksmanship, Beast Mastery, Wilderness Survival |
| Monk | Divine Favor | Core | Healing Prayers, Smiting Prayers, Protection Prayers |
| Necromancer | Soul Reaping | Core | Blood Magic, Curses, Death Magic |
| Mesmer | Fast Casting | Core | Domination Magic, Inspiration Magic, Illusion Magic |
| Elementalist | Energy Storage | Core | Fire Magic, Water Magic, Air Magic, Earth Magic |
| Assassin | Critical Strikes | Factions | Dagger Mastery, Deadly Arts, Shadow Arts |
| Ritualist | Spawning Power | Factions | Channeling Magic, Communing, Restoration Magic |
| Paragon | Leadership | Nightfall | Spear Mastery, Command, Motivation |
| Dervish | Mysticism | Nightfall | Scythe Mastery, Earth Prayers, Wind Prayers |

**Key rule:** When a profession is used as a secondary, its primary attribute is *inaccessible*. For example, an Elementalist/Mesmer has Energy Storage but NOT Fast Casting.

### 2.2 Attribute Points

- A level 20 character has **200 attribute points** to distribute.
- Attribute ranks cost increasing points (rank 1 = 1 pt, rank 12 = 97 pts cumulative).
- Maximum base rank from points alone is **12**.
- Runes can add +1, +2, or +3 (superior) to one attribute each.
- Headgear provides +1 to one attribute.
- Practical cap with equipment is **16** (12 base + 3 superior rune + 1 headgear).
- Common spreads: 12/12/3, 12/10/8, 12/11/6+1, etc.

**Attribute point cost table (cumulative):**

| Rank | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Cumulative | 1 | 3 | 6 | 10 | 15 | 21 | 28 | 37 | 48 | 61 | 77 | 97 |

### 2.3 Skills

- Each character equips exactly **8 skills** on their skill bar.
- At most **1 elite skill** can be equipped.
- Skills come from the character's primary and secondary professions.
- Some skills are profession-independent (PvE-only skills, common skills).
- Each skill has: name, profession, attribute, campaign, type (spell, stance, shout, enchantment, hex, trap, signet, etc.), energy cost, activation time, recharge time, adrenaline cost (warriors/paragons/dervishes), sacrifice %, upkeep, overcast, elite status, and a text description with variable values based on attribute rank.
- Approximately **1,319 learnable skills** in total.

### 2.4 Skill Template Codes

The game uses a Base64-encoded binary format for sharing builds. The format (post-April 2007) encodes:

1. Version header (4 bits, value 14)
2. Profession code bit width
3. Primary and secondary profession IDs
4. Attribute count, IDs, and ranks
5. Skill IDs (8 skills)

Template codes look like: `OQNDArwTOhDcIZlZmYj7BBAAAAAA`

Your site should be able to both **encode** (build → code) and **decode** (code → build).

**Data sources for codes:**
- Profession codes: documented on [Skill template format](https://guildwars.fandom.com/wiki/Skill_template_format)
- Attribute codes: same page
- Skill ID list: [Game integration/Skills](https://wiki.guildwars.com/wiki/Guild_Wars_Wiki:Game_integration/Skills) pages (IDs 1–3431)

---

## 3. Data Layer — Scraping & Structuring the Wiki

Guild Wars 1 has **no official API** (unlike GW2). All data must be scraped or sourced from community datasets.

### 3.1 Data Sources

| Data | Source | Method |
|---|---|---|
| Skill list (IDs, names) | `wiki.guildwars.com/wiki/Guild_Wars_Wiki:Game_integration/Skills/*` | Scrape wiki pages (segmented 1-500, 501-1000, etc.) |
| Skill details (costs, description, type) | Individual skill pages, e.g. `wiki.guildwars.com/wiki/Healing_Breeze` | Scrape infoboxes via MediaWiki API |
| Skill icons | Wiki image files or game asset extraction | Download from wiki (check licensing) |
| Profession/attribute mapping | `wiki.guildwars.com/wiki/Profession` | Hardcode (small, stable dataset) |
| Template format spec | `wiki.guildwars.com/wiki/Skill_template_format` | Implement encoder/decoder from spec |
| Existing community JSON | Check gwskillbar repo or guildwars.magical.ch | May already have curated skill databases |

### 3.2 Recommended Data Schema

```
skills.json
├── id: number (game skill ID, 1-3431)
├── name: string
├── profession: string | null (null for common/PvE-only)
├── attribute: string | null
├── campaign: "Core" | "Prophecies" | "Factions" | "Nightfall" | "Eye of the North"
├── elite: boolean
├── type: string (Spell, Enchantment, Hex, Stance, Shout, Signet, Trap, etc.)
├── energy: number | null
├── adrenaline: number | null
├── activation: number | null (seconds)
├── recharge: number | null (seconds)
├── sacrifice: number | null (percentage)
├── upkeep: number | null
├── overcast: number | null
├── description: string (with attribute-scaling values)
├── icon: string (filename or URL)
└── pvp_variant: boolean
```

```
professions.json
├── id: string (abbreviation: W, R, Mo, N, Me, E, A, Rt, P, D)
├── name: string
├── campaign: string
├── code: number (for template encoding)
├── primary_attribute: string
├── attributes: string[]
└── icon: string
```

### 3.3 Data Pipeline (One-Time Scrape)

Build a Node.js or Python scraper that:

1. **Fetches skill IDs and names** from the Game Integration pages via the MediaWiki API:
   ```
   https://wiki.guildwars.com/api.php?action=parse&page=Guild_Wars_Wiki:Game_integration/Skills&format=json
   ```
2. **Fetches individual skill details** using the wiki's semantic data or by parsing skill infobox templates.
3. **Downloads skill icons** from the wiki's file repository.
4. **Outputs** a single `skills.json` file and an `icons/` folder.
5. Store as static JSON bundled with the Vue app (no need for a backend database for read-only skill data).

**Important:** Check the [gwskillbar GitHub repo](https://github.com/haliphax/gwskillbar) — it may already contain a curated skill database you can reuse or fork, saving significant scraping effort.

---

## 4. Application Architecture

### 4.1 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Vue 3 (Composition API) |
| Build Tool | Vite |
| State Management | Pinia |
| Routing | Vue Router |
| Styling | Tailwind CSS (or custom CSS with GW-themed design) |
| Data | Static JSON files (bundled at build time) |
| Hosting | Vercel, Netlify, or GitHub Pages (static site) |
| Backend (optional) | Supabase or Firebase (only if adding user accounts/saved builds) |

### 4.2 Project Structure

```
gw1-build-creator/
├── public/
│   └── icons/                    # Skill & profession icons
├── src/
│   ├── assets/
│   │   ├── data/
│   │   │   ├── skills.json       # Complete skill database
│   │   │   ├── professions.json  # Profession definitions
│   │   │   └── attributes.json   # Attribute point cost tables
│   │   └── styles/
│   ├── components/
│   │   ├── build/
│   │   │   ├── SkillBar.vue          # The 8-slot skill bar
│   │   │   ├── SkillSlot.vue         # Individual skill slot
│   │   │   ├── SkillTooltip.vue      # Hover tooltip with details
│   │   │   ├── AttributePanel.vue    # Attribute point allocator
│   │   │   ├── ProfessionPicker.vue  # Primary/secondary selectors
│   │   │   └── TemplateCode.vue      # Encode/decode/copy template
│   │   ├── skills/
│   │   │   ├── SkillBrowser.vue      # Searchable/filterable skill list
│   │   │   ├── SkillCard.vue         # Skill display in the browser
│   │   │   └── SkillFilters.vue      # Filter by attribute, type, etc.
│   │   ├── team/
│   │   │   ├── TeamBuilder.vue       # Multi-build team view (8 chars)
│   │   │   └── TeamSlot.vue          # Individual team member build
│   │   └── shared/
│   │       ├── AppHeader.vue
│   │       └── AppFooter.vue
│   ├── composables/
│   │   ├── useSkillData.js           # Load and query skill database
│   │   ├── useAttributeCalc.js       # Point allocation logic
│   │   ├── useTemplateCodec.js       # Encode/decode template strings
│   │   └── useBuildValidation.js     # Enforce build rules
│   ├── stores/
│   │   ├── buildStore.js             # Current build state (Pinia)
│   │   └── teamStore.js              # Team builds state
│   ├── views/
│   │   ├── BuildEditor.vue           # Main build editor page
│   │   ├── TeamEditor.vue            # Team builder page
│   │   ├── BrowseBuilds.vue          # Community builds (future)
│   │   └── HomePage.vue
│   ├── router/
│   │   └── index.js
│   └── App.vue
├── scripts/
│   └── scrape-wiki/                  # Data scraping tools
│       ├── fetch-skills.js
│       ├── fetch-icons.js
│       └── build-database.js
├── package.json
└── vite.config.js
```

---

## 5. Core Features (MVP)

### 5.1 Profession Selection

- Two dropdown or icon-grid selectors for primary and secondary profession.
- When primary changes: reset all attributes and skills.
- When secondary changes: remove skills that belong to the old secondary; keep primary skills.
- Show profession abbreviation (e.g., "W/Mo" for Warrior/Monk).

### 5.2 Attribute Allocator

- Show all available attributes for current primary + secondary.
- Primary attribute only appears for the primary profession.
- Increment/decrement buttons (or sliders) for each attribute, rank 0–12.
- Display remaining points out of 200.
- Support rune bonuses (+1/+2/+3) and headgear (+1) as additive modifiers shown beside the base rank (e.g., "12 + 1 + 1").
- Validate: cannot exceed 200 points, cannot go below 0.

### 5.3 Skill Bar (8 Slots)

- 8 draggable/clickable slots.
- Click a slot to open the Skill Browser filtered to current professions.
- Visual indicator for elite skills (gold border, like in-game).
- Enforce one-elite-only rule (warn or prevent adding a second).
- Show skill icon, and on hover, display a tooltip with full skill details.
- Drag to reorder skills within the bar.

### 5.4 Skill Browser / Picker

- Filterable list of all skills available to current primary + secondary profession.
- Filters: by attribute line, skill type, elite only, campaign.
- Search by name (fuzzy/substring).
- Click a skill to place it in the selected slot.
- Display skill cost info (energy, adrenaline, activation, recharge) inline.
- Highlight elite skills distinctly.

### 5.5 Skill Tooltips

- On hover: show skill name, icon, type, costs, and full description.
- Description values should scale with current attribute allocation (the "green numbers" from the game).
- This is a stretch goal — initial version can show description text with value ranges.

### 5.6 Template Code Panel

- **Encode:** Generate a valid GW template code from the current build.
- **Decode:** Paste a template code to load a build (sets professions, attributes, skills).
- **Copy to clipboard** button.
- **Share URL:** Encode build state into a URL query parameter or hash fragment for link sharing (e.g., `yoursite.com/build?code=OQNDArwT...`).

---

## 6. Template Codec Implementation

This is one of the most technical parts. The format is a bit-packed binary stream encoded in Base64.

### 6.1 Encoding (Build → Template Code)

```
Bit stream layout (post-April 2007):
─────────────────────────────────────────────
 4 bits: type = 14 (skill template)
 4 bits: version = 0
 2 bits: prof_bits_code → p = code * 2 + 4
 p bits: primary profession ID
 p bits: secondary profession ID
 4 bits: num_attributes
 4 bits: attr_bits_code → a = code + 4
 For each attribute:
   a bits: attribute ID
   4 bits: attribute rank (0-12)
 4 bits: skill_bits_code → s = code + 8
 For each of 8 skills:
   s bits: skill ID (0 = empty slot)
─────────────────────────────────────────────
Pad final byte with zeros, then Base64 encode.
```

### 6.2 Decoding (Template Code → Build)

Reverse the process: Base64 decode → read bits in LSB-first order → extract fields.

### 6.3 Key Data Needed

- **Profession codes:** W=1, R=2, Mo=3, N=4, Me=5, E=6, A=7, Rt=8, P=9, D=10 (0 = None)
- **Attribute codes:** Each attribute has a numeric ID used in templates. These are documented on the wiki's Skill template format page.
- **Skill codes:** The game's internal skill IDs (1–3431).

### 6.4 Reference Implementation

The [gwskillbar repo](https://github.com/haliphax/gwskillbar) likely has a working JS implementation you can reference or adapt for Vue.

---

## 7. Stretch Features (Post-MVP)

### 7.1 Team Builder
- Build a full team of up to 8 characters (player + 7 heroes/henchmen).
- Each team slot is a full build editor.
- Generate a "team template" that encodes all 8 builds.
- Useful for hero team setups which are very popular in current GW1 play.

### 7.2 Dynamic Skill Descriptions
- Parse skill description templates to calculate actual values at the current attribute rank.
- The wiki stores these as formulas or progression tables — you'd need to scrape and store the scaling data per skill.

### 7.3 Equipment Planner
- Armor sets, runes, insignias, weapons, and mods.
- These affect derived stats (health, energy, armor rating) and attribute bonuses.

### 7.4 Build Saving & Sharing
- **Local storage:** Save builds in the browser (localStorage).
- **User accounts (Supabase/Firebase):** Save builds to the cloud with optional sharing.
- **Build library:** Browse and rate community-submitted builds (requires a backend).

### 7.5 Import from PvXwiki
- Parse PvXwiki build page formatting to auto-import popular builds.

### 7.6 Build Comparison
- Side-by-side comparison of two builds.

### 7.7 PWA / Offline Support
- Make it a Progressive Web App so players can use it offline or install it on mobile (similar to what guildwars.magical.ch does).

---

## 8. UI/UX Design Notes

### 8.1 Visual Theme
- Draw inspiration from the GW1 in-game UI: dark panel backgrounds, gold/amber accents, parchment textures.
- Skill icons should be the original game icons (approximately 64×64px).
- Elite skills get a gold border, regular skills get a neutral border.
- The skill bar should visually resemble the in-game bar as closely as possible.

### 8.2 Layout (Desktop)

```
┌──────────────────────────────────────────────┐
│  Header: Logo / Nav / Import Template        │
├──────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐   │
│  │ Profession Pick  │  │  Template Code   │   │
│  │ [W] / [Mo]       │  │  [OQNDAr...]     │   │
│  └─────────────────┘  └──────────────────┘   │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │  ╔══╗ ╔══╗ ╔══╗ ╔══╗ ╔══╗ ╔══╗ ╔══╗ ╔══╗│
│  │  ║1 ║ ║2 ║ ║3 ║ ║4 ║ ║5 ║ ║6 ║ ║7 ║ ║8 ║│ ← Skill Bar
│  │  ╚══╝ ╚══╝ ╚══╝ ╚══╝ ╚══╝ ╚══╝ ╚══╝ ╚══╝│
│  └──────────────────────────────────────┘    │
│                                              │
│  ┌──────────────┐  ┌────────────────────┐    │
│  │  Attributes   │  │  Skill Browser     │    │
│  │               │  │                    │    │
│  │  Strength: 12 │  │  [Search...]       │    │
│  │  Healing:   8 │  │  [Filters]         │    │
│  │  ...          │  │  ┌──┐ ┌──┐ ┌──┐    │    │
│  │               │  │  │  │ │  │ │  │    │    │
│  │  Points: 200  │  │  └──┘ └──┘ └──┘    │    │
│  │  Remaining: 3 │  │  ...               │    │
│  └──────────────┘  └────────────────────┘    │
└──────────────────────────────────────────────┘
```

### 8.3 Mobile
- Stack layout vertically: professions → skill bar → attributes → skill browser.
- Skill browser opens as a modal/drawer.
- Touch-friendly slot selection.

---

## 9. Development Phases

### Phase 1: Foundation (Weeks 1–2)
- [ ] Set up Vue 3 + Vite + Pinia + Vue Router + Tailwind
- [ ] Build or source the skill database (scrape wiki or find existing JSON)
- [ ] Create `professions.json` and `attributes.json` (small, hand-crafted)
- [ ] Implement `useSkillData` composable (loads and indexes skill data)
- [ ] Build `ProfessionPicker` component

### Phase 2: Core Build Editor (Weeks 3–4)
- [ ] Implement `AttributePanel` with point allocation logic
- [ ] Build `SkillBar` and `SkillSlot` components
- [ ] Build `SkillBrowser` with search and filters
- [ ] Implement `SkillTooltip`
- [ ] Wire everything together in `BuildEditor` view
- [ ] Enforce build rules (elite limit, profession restrictions)

### Phase 3: Template Codes (Week 5)
- [ ] Implement the template codec (`useTemplateCodec`)
- [ ] Build `TemplateCode` component (encode, decode, copy)
- [ ] URL-based build sharing (encode build into URL hash/params)

### Phase 4: Polish & UX (Week 6)
- [ ] GW1-themed styling
- [ ] Responsive/mobile layout
- [ ] Drag-and-drop skill reordering
- [ ] localStorage build saving
- [ ] Accessibility and keyboard navigation

### Phase 5: Stretch Goals (Ongoing)
- [ ] Team builder
- [ ] Dynamic skill value scaling
- [ ] User accounts and cloud-saved builds
- [ ] Community build library
- [ ] PWA offline support

---

## 10. Data Licensing & Legal Notes

- **Skill data and icons** from the GW wiki are generally available under creative commons licenses, but check `wiki.guildwars.com`'s specific licensing terms (typically CC-BY-SA or GFDL).
- **Skill icons** are game assets owned by ArenaNet/NCSoft. Fan sites typically use them under a fan content policy — include proper attribution.
- GW1 has an active community and ArenaNet has historically been supportive of fan tools.
- Include a disclaimer on your site: *"Guild Wars is a trademark of ArenaNet/NCSoft. This tool is a fan project and is not affiliated with ArenaNet."*

---

## 11. Key Technical Challenges

1. **Skill database completeness** — GW1 has no API; you're dependent on wiki scraping or community data. PvP and PvE skill variants have separate IDs. Monster skills exist in the ID space but shouldn't be user-selectable.
2. **Template codec correctness** — The bit-packing format is well-documented but fiddly. Test extensively against known good template codes from PvXwiki.
3. **Skill description scaling** — Parsing the wiki's template syntax for variable skill values at different attribute ranks is complex. Consider deferring this to a later phase.
4. **Icon hosting** — ~1,300+ skill icons at 64×64px. Sprite sheets or lazy loading recommended. Total size is manageable (~5-10 MB).
5. **Keeping data current** — GW1 still receives occasional balance updates (the December 2025 "Reforged" update changed things). Plan for a repeatable scraping/update pipeline.