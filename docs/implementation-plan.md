# GW1 Build Creator — Implementation Plan

## Context

Building a Vue 3 SPA that replicates the Guild Wars 1 Skills & Attributes Panel in the browser. Lets players create, share, and manage character builds via the game's native Base64 template code format. The project is a greenfield — only a `package.json` exists at `/home/ryanm/Workspace/guildwars/`. The user wants focus on **structure**.

---

## 1. Project Scaffolding

Run from `/home/ryanm/Workspace/guildwars/`:

```bash
npm create vite@latest . -- --template vue-ts
npm install vue-router@4 pinia @vueuse/core
npm install -D tailwindcss@3 postcss autoprefixer vitest @vitest/ui @vue/test-utils jsdom
npx tailwindcss init -p
```

### Config files to create

| File | Key content |
|---|---|
| `vite.config.ts` | `@` alias → `src/`, `test.environment: 'jsdom'` |
| `tailwind.config.js` | GW theme tokens: `gw-gold`, `gw-dark`, `gw-panel`, `gw-border` |
| `tsconfig.json` | Strict mode, path alias `@/*` |

---

## 2. Full Directory Structure

```
guildwars/
├── public/
│   └── icons/                        # Skill & profession icons (~1,300 files)
├── src/
│   ├── assets/
│   │   ├── data/
│   │   │   ├── skills.json           # ~1,319 skills (merged, enriched)
│   │   │   ├── professions.json      # 10 professions (hand-crafted)
│   │   │   └── attributes.json       # 44 attributes with template IDs
│   │   └── styles/
│   │       └── main.css              # Tailwind directives + CSS vars
│   ├── components/
│   │   ├── build/
│   │   │   ├── ProfessionPicker.vue  # Dual profession selector grid
│   │   │   ├── SkillBar.vue          # 8-slot bar with drag-to-reorder
│   │   │   ├── SkillSlot.vue         # Single slot (icon, elite border)
│   │   │   ├── SkillTooltip.vue      # Hover tooltip via Teleport
│   │   │   ├── AttributePanel.vue    # Point allocator (200 pts, rank 0-12)
│   │   │   └── TemplateCode.vue      # Encode/decode/copy/share URL
│   │   ├── skills/
│   │   │   ├── SkillBrowser.vue      # Virtual-scroll skill list
│   │   │   ├── SkillCard.vue         # Compact skill row in browser
│   │   │   └── SkillFilters.vue      # Attribute/type/campaign/elite filters
│   │   ├── team/
│   │   │   ├── TeamBuilder.vue       # 8-character team view (stretch)
│   │   │   └── TeamSlot.vue          # Single team member card
│   │   └── shared/
│   │       ├── AppHeader.vue         # Logo, nav, GitHub link
│   │       └── AppFooter.vue         # Attribution disclaimer
│   ├── composables/
│   │   ├── useSkillData.ts           # Module-level cache; loads + indexes JSON
│   │   ├── useAttributeCalc.ts       # Pure point math (ATTR_COST table)
│   │   ├── useTemplateCodec.ts       # Bit-packed Base64 encode/decode
│   │   └── useBuildValidation.ts     # Rule enforcement (elite limit, prof checks)
│   ├── stores/
│   │   ├── buildStore.ts             # Single build state (Pinia)
│   │   └── teamStore.ts              # Team of up to 8 builds (Pinia)
│   ├── views/
│   │   ├── BuildEditor.vue           # Layout orchestrator (main page)
│   │   ├── TeamEditor.vue            # Team builder page
│   │   ├── BrowseBuilds.vue          # Community builds (stub for now)
│   │   └── HomePage.vue
│   ├── router/
│   │   └── index.ts
│   ├── App.vue
│   └── main.ts
├── scripts/
│   └── scrape-wiki/
│       ├── fetch-skills.js           # MediaWiki API → raw skill IDs/names
│       ├── fetch-icons.js            # Download icons to public/icons/
│       └── build-database.js         # Merge gwskillbar + wiki → skills.json
├── docs/
│   └── implementation-plan.md        # This file
├── package.json
└── vite.config.ts
```

---

## 3. Data Layer

### 3.1 Sourcing Strategy

**Start with [gwskillbar repo](https://github.com/haliphax/gwskillbar)** — it already has curated `skills.json` (id→name), `skills-data.json` (name→details), `attributes.json`, `professions.json`. Merge these files via `scripts/scrape-wiki/build-database.js` rather than scraping from scratch. Scrapers are for future balance updates only.

### 3.2 Data Schemas

#### `skills.json` — array of `Skill`, sorted by id

```ts
interface Skill {
  id: number               // game internal ID 1–3431
  name: string
  profession: string | null  // null = common/PvE-only
  attribute: string | null
  campaign: 'Core' | 'Prophecies' | 'Factions' | 'Nightfall' | 'Eye of the North'
  elite: boolean
  pvpVariant: boolean
  pveOnly: boolean
  type: string             // 'Spell' | 'Enchantment Spell' | 'Hex Spell' | 'Signet' | ...
  energy: number | null
  adrenaline: number | null
  activation: number | null
  recharge: number | null
  sacrifice: number | null
  upkeep: number | null
  overcast: number | null
  description: string
  icon: string             // filename in public/icons/
}
```

#### `professions.json` — array of 10 `Profession`

```ts
interface Profession {
  id: number           // 1=W, 2=R, 3=Mo, 4=N, 5=Me, 6=E, 7=A, 8=Rt, 9=P, 10=D
  abbrev: string       // "W", "Mo", etc.
  name: string
  campaign: 'Core' | 'Factions' | 'Nightfall'
  primaryAttribute: string
  attributes: string[] // all attributes including primary
  color: string        // hex for UI theming
  icon: string
}
```

#### `attributes.json` — array of 44 `Attribute`

```ts
interface Attribute {
  id: number       // template encoding ID (0–43 per wiki spec)
  name: string
  profession: string
  isPrimary: boolean
}
```

**Attribute cost table** — embedded as constant in `useAttributeCalc.ts`, not JSON:
```ts
// index = rank, value = cumulative cost
const ATTR_COST = [0, 1, 3, 6, 10, 15, 21, 28, 37, 48, 61, 77, 97]
```

---

## 4. Store Design

### `buildStore.ts`

```ts
interface AttributeAllocation {
  attributeId: number
  rank: number          // base, 0–12
  runeBonus: number     // 0–3
  headgearBonus: number // 0–1
}

interface Build {
  primaryProfession: number | null   // profession ID 1–10
  secondaryProfession: number | null // profession ID 1–10, null = no secondary
  attributes: AttributeAllocation[]  // only non-zero stored
  skills: (number | null)[]          // length 8, null = empty slot
}

// State
build: Build
activeSlotIndex: number | null
isDirty: boolean

// Getters
primary, secondary: Profession | null
availableAttributes: Attribute[]
availableSkills: Skill[]
pointsUsed, remainingPoints: number
hasElite: boolean
resolvedSkills: (Skill | null)[]
templateCode: string  // computed via useTemplateCodec

// Actions
setProfessions(primaryId, secondaryId)  // clears invalid skills/attrs
setAttributeRank(attributeId, rank)     // validates <= 200 pts
setSkill(slotIndex, skillId)            // validates profession + elite rule
moveSkill(fromIndex, toIndex)
removeSkill(slotIndex)
loadBuild(build: Build)
resetBuild()
saveToLocalStorage()
loadFromLocalStorage()
```

### `teamStore.ts`

```ts
// State
builds: Build[]          // 1–8 builds
activeBuildIndex: number
teamName: string

// Getters
activeBuild: Build
buildCount: number

// Actions
addBuild(), removeBuild(index), setActiveBuild(index), updateBuild(index, build)
encodeTeamTemplate(): string   // pipe-delimited codes
decodeTeamTemplate(codes: string): void
```

---

## 5. Composable API Surfaces

### `useSkillData.ts`
```ts
// Module-level singleton cache (shallowRef arrays + Map index)
async init(): Promise<void>                              // lazy-loads JSON once
getSkillById(id): Skill | undefined
getSkillsByProfession(profId): Skill[]
getProfessionById(id): Profession | undefined
getAttributeById(id): Attribute | undefined
getAttributesByProfession(profId): Attribute[]
filterSkills(options: {
  professions: number[], query?: string,
  attribute?: string, type?: string,
  eliteOnly?: boolean, campaign?: string
}): Skill[]
getSkillIndex(): Map<number, Skill>                      // O(1) lookup for codec
```

### `useAttributeCalc.ts`
```ts
costForRank(rank): number                                // ATTR_COST[rank]
costDelta(from, to): number
totalPointsUsed(allocations): number
canIncrement(attributeId, allocations): boolean          // rank < 12 AND pts <= 200
canDecrement(attributeId, allocations): boolean          // rank > 0
effectiveRank(allocation): number                        // base + rune + headgear, max 16
maxAchievableRank(remainingPoints, currentRank): number
```

### `useTemplateCodec.ts`
```ts
encode(build: DecodedBuild): string
decode(code: string): { data: DecodedBuild } | { error: CodecError }
isValidCode(code: string): boolean

interface DecodedBuild {
  primaryProfessionId: number
  secondaryProfessionId: number
  attributes: Array<{ id: number; rank: number }>
  skillIds: number[]  // exactly 8, 0 = empty
}

type CodecError = {
  code: 'INVALID_BASE64' | 'WRONG_TYPE' | 'WRONG_VERSION' | 'DECODE_ERROR'
  message: string
}
```

### `useBuildValidation.ts`
```ts
validateBuild(build, skillIndex): ValidationResult
validateSkillAddition(skill, slotIndex, currentSkills, primaryId, secondaryId): ValidationResult
validateAttributeAllocation(allocations, primaryId, secondaryId, available): ValidationResult
validateProfessionChange(newPrimary, newSecondary, currentSkills, skillIndex): { skillsToRemove: number[] }

interface ValidationResult { valid: boolean; errors: ValidationError[]; warnings: ValidationWarning[] }
```

---

## 6. Template Codec — Bit-Level Detail

GW1 uses a bit-packed LSB-first binary stream, Base64-encoded with the standard alphabet.

### Bit stream layout

```
[3:0]   type = 14            4 bits  (verify on decode)
[7:4]   version = 0          4 bits  (verify on decode)
[9:8]   P_CODE               2 bits  → prof_width = P_CODE*2 + 4
        primary prof ID      prof_width bits
        secondary prof ID    prof_width bits
        num_attributes       4 bits
        A_CODE               4 bits  → attr_id_width = A_CODE + 4
        For each attribute:
          attribute ID       attr_id_width bits
          attribute rank     4 bits
        S_CODE               4 bits  → skill_id_width = S_CODE + 8
        For each of 8 skills:
          skill ID           skill_id_width bits (0 = empty)
        Zero-pad to 6-bit boundary
```

**Current GW1 data widths** (max skill ID ~3431):
- `P_CODE = 0` → 4-bit profession width (handles IDs 0–15)
- `A_CODE = 2` → 6-bit attribute ID width (handles IDs 0–63)
- `S_CODE = 4` → 12-bit skill ID width (handles IDs 0–4095)

### Encode pseudocode

```ts
function pushBits(value, width) { for i in 0..width: bits.push((value >> i) & 1) }

pushBits(14, 4); pushBits(0, 4)          // header
pushBits(pCode, 2)
pushBits(primaryId, pWidth); pushBits(secondaryId, pWidth)
pushBits(attrs.length, 4); pushBits(aCode, 4)
for attr: pushBits(attr.id, aWidth); pushBits(attr.rank, 4)
pushBits(sCode, 4)
for skillId: pushBits(skillId ?? 0, sWidth)
// Pad to 6-bit boundary, then map each 6-bit group to Base64 char
```

### Decode: reverse — Base64 → bits array → read fields in same order

---

## 7. Component Interface Summary

| Component | Reads Store | Writes Store | Key Props/Emits |
|---|---|---|---|
| `ProfessionPicker` | `primary`, `secondary` | `setProfessions()` | — |
| `SkillBar` | `resolvedSkills` | `moveSkill`, `removeSkill` | emits `slot-clicked(index)` |
| `SkillSlot` | — | — | props: `skill`, `index`, `isSelected`; emits: `click`, `remove`, drag events |
| `SkillTooltip` | — | — | props: `skill`, `attributeRank?` (Teleport to body) |
| `AttributePanel` | `availableAttributes`, `remainingPoints` | `setAttributeRank()` | — |
| `SkillBrowser` | `primary`, `secondary` | — | props: `targetSlotIndex`; emits: `skill-selected(skill, slot)` |
| `SkillCard` | — | — | props: `skill`, `isInBar`, `isDisabled`; emits: `select(skill)` |
| `SkillFilters` | — | — | props: `availableAttributes`, `availableCampaigns`; emits: `update:filters` |
| `TemplateCode` | full build state | `loadBuild()` | — |
| `BuildEditor` (view) | — | — | route prop: `code?` (decodes on mount) |

---

## 8. Router Structure

```ts
// src/router/index.ts
[
  { path: '/', name: 'home', component: HomePage },
  { path: '/build', name: 'build-editor', component: BuildEditor },
  { path: '/build/:code', name: 'build-editor-with-code', component: BuildEditor, props: true },
  { path: '/team', name: 'team-editor', component: TeamEditor },
  { path: '/team/:codes', name: 'team-editor-with-codes', component: TeamEditor, props: true },
  { path: '/browse', name: 'browse-builds', component: BrowseBuilds },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]
```

**URL strategy:**
- Single build: `/build/OQNDArwTOhDcIZlZmYj7BBAAAAAA` — code in path segment
- Team: `/team/CODE1|CODE2|CODE3` — pipe-separated, URL-encoded
- As build changes, use `router.replace()` to keep URL in sync (always shareable)
- On mount: if `props.code` → decode → `loadBuild()`; else → `loadFromLocalStorage()`

---

## 9. File Creation Order

### Phase 1 — Infrastructure (Days 1–3)
1. `vite.config.ts`
2. `tsconfig.json`
3. `tailwind.config.js`, `postcss.config.js`
4. `src/assets/styles/main.css`
5. `index.html`
6. `src/main.ts`
7. `src/App.vue`
8. `src/router/index.ts`

### Phase 2 — Data Layer (Days 3–5)
9. `src/assets/data/professions.json` (hand-craft)
10. `src/assets/data/attributes.json` (hand-craft)
11. `scripts/scrape-wiki/fetch-skills.js`
12. `scripts/scrape-wiki/fetch-icons.js`
13. `scripts/scrape-wiki/build-database.js`
14. `src/assets/data/skills.json` (output of scraper)
15. `src/composables/useSkillData.ts`

### Phase 3 — State & Logic (Days 5–7)
16. `src/composables/useAttributeCalc.ts`
17. `src/composables/useBuildValidation.ts`
18. `src/stores/buildStore.ts`
19. `src/composables/useTemplateCodec.ts`
20. `src/stores/teamStore.ts`

### Phase 4 — Shared Components (Days 7–8)
21. `src/components/shared/AppHeader.vue`
22. `src/components/shared/AppFooter.vue`
23. `src/views/HomePage.vue`

### Phase 5 — Build Editor (Days 8–14)
24. `src/components/build/ProfessionPicker.vue`
25. `src/components/build/SkillSlot.vue`
26. `src/components/build/SkillTooltip.vue`
27. `src/components/build/SkillBar.vue`
28. `src/components/skills/SkillFilters.vue`
29. `src/components/skills/SkillCard.vue`
30. `src/components/skills/SkillBrowser.vue`
31. `src/components/build/AttributePanel.vue`
32. `src/components/build/TemplateCode.vue`
33. `src/views/BuildEditor.vue`

### Phase 6 — Polish & Team (Days 14–21)
34. `src/components/team/TeamSlot.vue`
35. `src/components/team/TeamBuilder.vue`
36. `src/views/TeamEditor.vue`
37. `src/views/BrowseBuilds.vue` (stub)

---

## 10. Verification

### Template Codec (highest risk)
- Unit test decode of known real codes from PvXwiki (e.g. `OQNDArwTOhDcIZlZmYj7BBAAAAAA`)
- Verify first char `O` = index 14 in Base64 alphabet → bits `0,1,1,1` = type 14
- Roundtrip test: encode → decode → compare all fields equal
- Roundtrip all 10×11 profession combos
- Test error paths: invalid chars, wrong type byte, truncated input

### Attribute Calculator
- `costForRank(12) === 97`
- Two attrs at rank 12 + 6 = `97 + 21 = 118` points used
- `effectiveRank({ rank: 12, runeBonus: 3, headgearBonus: 1 }) === 16` (game cap)

### Build Validation
- Second elite skill is rejected
- Skill from wrong profession is rejected
- Common skill (profession: null) is always allowed

### Data Integrity Script (`scripts/validate-data.js`)
- All required fields present on each skill
- No duplicate skill IDs
- All attribute IDs in skills exist in attributes.json
- Skill count between 1,000–1,400

Add to `package.json`: `"build": "node scripts/validate-data.js && vite build"`

### End-to-End Smoke Test
1. Load a known template code via URL → verify professions/attributes/skills render correctly
2. Modify an attribute → verify remaining points update
3. Re-encode → paste into GWToolbox or gw-memorial decoder → confirm match
