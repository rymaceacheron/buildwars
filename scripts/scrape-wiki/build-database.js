/**
 * build-database.js
 *
 * Fetches skill data from the Guild Wars Wiki (wiki.guildwars.com)
 * using the MediaWiki API and outputs src/assets/data/skills.json.
 *
 * Usage:
 *   node scripts/scrape-wiki/build-database.js
 *     Full run: Phase 1 (IDs) + Phase 2 (details for all skills)
 *
 *   node scripts/scrape-wiki/build-database.js --details-only
 *     Skip Phase 1. Read names from existing skills.json and re-fetch
 *     details only for skills where description is still empty.
 *     Safe to stop and resume — already-populated skills are skipped.
 *
 *   node scripts/scrape-wiki/build-database.js --details-only --professions-only
 *     Same as above but only fetches the ~1,300 profession skills
 *     (Warrior, Ranger, Monk, etc.) — skips PvE title skills,
 *     common/misc skills, and PvP variants. Much faster (~45 min).
 *
 * Rate limit: 2 seconds between requests.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const OUT_PATH = join(ROOT, 'src', 'assets', 'data', 'skills.json')

const WIKI_API = 'https://wiki.guildwars.com/api.php'
const RATE_LIMIT_MS = 2000  // 2 seconds between requests to be polite to the wiki

// Game integration sub-pages that list skill IDs
// Format: "Skill N] → [[Skill Name]]"
const SKILL_LIST_PAGES = [
  'Guild_Wars_Wiki:Game_integration/Skills/1-500',
  'Guild_Wars_Wiki:Game_integration/Skills/501-1000',
  'Guild_Wars_Wiki:Game_integration/Skills/1001-1500',
  'Guild_Wars_Wiki:Game_integration/Skills/1501-2000',
  'Guild_Wars_Wiki:Game_integration/Skills/2001-2500',
  'Guild_Wars_Wiki:Game_integration/Skills/2501-3000',
  'Guild_Wars_Wiki:Game_integration/Skills/3001-3500',
]

// ─── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const DETAILS_ONLY = args.includes('--details-only')
const PROFESSIONS_ONLY = args.includes('--professions-only')
const SKILL_ARG_IDX = args.indexOf('--skill')
const SINGLE_SKILL = SKILL_ARG_IDX !== -1 ? args[SKILL_ARG_IDX + 1] : null

// ─── Constants ─────────────────────────────────────────────────────────────────

const KNOWN_PROFESSIONS = new Set([
  'Warrior', 'Ranger', 'Monk', 'Necromancer', 'Mesmer',
  'Elementalist', 'Assassin', 'Ritualist', 'Paragon', 'Dervish',
])

// Wiki category names for each profession's skill list
const PROFESSION_CATEGORIES = [
  'Warrior skills', 'Ranger skills', 'Monk skills',
  'Necromancer skills', 'Mesmer skills', 'Elementalist skills',
  'Assassin skills', 'Ritualist skills', 'Paragon skills', 'Dervish skills',
]

const CAMPAIGN_BY_PROFESSION = {
  Warrior: 'Core', Ranger: 'Core', Monk: 'Core',
  Necromancer: 'Core', Mesmer: 'Core', Elementalist: 'Core',
  Assassin: 'Factions', Ritualist: 'Factions',
  Paragon: 'Nightfall', Dervish: 'Nightfall',
}

// ─── HTTP helpers ──────────────────────────────────────────────────────────────

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; GW1BuildCreator/1.0; fan project skill scraper)',
  'Accept': 'application/json',
}

async function fetchWithRetry(url, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, { headers: FETCH_HEADERS })
    if (res.status === 429 || res.status === 503) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '5', 10) * 1000
      console.warn(`    Rate limited — waiting ${retryAfter}ms`)
      await sleep(retryAfter)
      continue
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    return res
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

async function wikiFetch(params) {
  const allParams = { format: 'json', ...params }
  const qs = Object.entries(allParams)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
  const url = `${WIKI_API}?${qs}`
  const res = await fetchWithRetry(url)
  const text = await res.text()
  if (text.trim().startsWith('<')) {
    throw new Error(`Wiki returned HTML instead of JSON. The wiki may be blocking requests.`)
  }
  return JSON.parse(text)
}

// ─── Step 1: Scrape skill ID → name from Game Integration pages ───────────────

/**
 * The Game Integration pages contain wiki tables like:
 *   | 1 || [[Flare]] || ... |
 * We parse these with the MediaWiki parse API returning wikitext.
 */
async function fetchSkillListPage(page) {
  const data = await wikiFetch({
    action: 'parse',
    page,
    prop: 'wikitext',
  })

  const wikitext = data?.parse?.wikitext?.['*'] ?? ''
  const skills = {}

  // Format: "Skill N|redirect=no}} Skill N] → [[Skill Name]]"
  // or:     "* [{{fullurl:Game link:Skill 1|redirect=no}} Skill 1] → [[Healing Signet]]"
  const rowPattern = /Skill\s+(\d+)\]\s*(?:&rarr;|→)\s*\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g
  let match
  while ((match = rowPattern.exec(wikitext)) !== null) {
    const id = parseInt(match[1], 10)
    const name = match[2].trim()
    if (id > 0 && name) {
      skills[id] = name
    }
  }

  return skills
}

async function fetchAllSkillIds() {
  const allSkills = {}
  for (const page of SKILL_LIST_PAGES) {
    console.log(`  Fetching ${page}…`)
    const skills = await fetchSkillListPage(page)
    Object.assign(allSkills, skills)
    console.log(`    → ${Object.keys(skills).length} entries (total: ${Object.keys(allSkills).length})`)
    await sleep(RATE_LIMIT_MS)
  }
  return allSkills  // { id: name }
}

/**
 * Fetch all skill names that belong to a given wiki category (e.g. "Warrior skills").
 * Returns a Set of skill names.
 */
async function fetchCategoryMembers(category) {
  const names = new Set()
  let continueToken = null

  do {
    const params = {
      action: 'query',
      list: 'categorymembers',
      cmtitle: `Category:${category}`,
      cmtype: 'page',
      cmlimit: '500',
    }
    if (continueToken) params.cmcontinue = continueToken

    const data = await wikiFetch(params)
    for (const member of data?.query?.categorymembers ?? []) {
      names.add(member.title)
    }
    continueToken = data?.continue?.cmcontinue ?? null
    if (continueToken) await sleep(RATE_LIMIT_MS)
  } while (continueToken)

  return names
}

async function fetchProfessionSkillNames() {
  const allNames = new Set()
  for (const category of PROFESSION_CATEGORIES) {
    console.log(`  Fetching Category:${category}…`)
    const names = await fetchCategoryMembers(category)
    console.log(`    → ${names.size} entries`)
    for (const n of names) allNames.add(n)
    await sleep(RATE_LIMIT_MS)
  }
  return allNames  // Set of skill names that belong to a profession
}

// ─── Step 2: Scrape individual skill pages for details ────────────────────────

/**
 * Fetch a skill's infobox data via the MediaWiki API.
 * Uses prop=revisions to get wikitext, then parses the {{skill infobox}} template.
 */
async function fetchSkillDetail(skillName) {
  const data = await wikiFetch({
    action: 'query',
    titles: skillName,
    prop: 'revisions',
    rvprop: 'content',
    rvslots: 'main',
  })

  const pages = data?.query?.pages ?? {}
  const page = Object.values(pages)[0]
  if (!page || page.missing !== undefined) return null

  const wikitext = page.revisions?.[0]?.slots?.main?.['*'] ?? ''
  return parseSkillInfobox(wikitext, skillName)
}

/**
 * Parse {{skill infobox}} template parameters from wikitext.
 */
function parseSkillInfobox(wikitext, skillName) {
  const infoboxStart = wikitext.search(/\{\{skill infobox/i)
  if (infoboxStart === -1) return null

  // Extract template body (handle nested braces)
  let depth = 0
  let end = infoboxStart
  for (let i = infoboxStart; i < wikitext.length - 1; i++) {
    if (wikitext[i] === '{' && wikitext[i + 1] === '{') { depth++; i++ }
    else if (wikitext[i] === '}' && wikitext[i + 1] === '}') {
      depth--
      if (depth === 0) { end = i + 2; break }
    }
  }

  const body = wikitext.slice(infoboxStart, end)

  // Strip the outer {{ and }} so splitTemplateParts sees only the content
  // e.g. "{{Skill infobox\n| foo = bar\n}}" → "\n| foo = bar\n"
  const inner = body.replace(/^\{\{[^|{}\n]+/i, '').replace(/\}\}$/, '')

  const params = {}
  const parts = splitTemplateParts(inner)
  for (const part of parts) {
    const eqIdx = part.indexOf('=')
    if (eqIdx === -1) continue
    const key = part.slice(0, eqIdx).trim().toLowerCase()
    const value = part.slice(eqIdx + 1).trim()
    params[key] = stripWikiMarkup(value)
  }

  const typeRaw = params['type'] ?? params['skill type'] ?? 'Skill'
  const eliteParam = (params['elite'] ?? '').toLowerCase().trim()
  const elite = typeRaw.toLowerCase().includes('elite') ||
    eliteParam === 'yes' || eliteParam === 'y' || eliteParam === 'true' || eliteParam === '1'
  const typeStripped = typeRaw.replace(/^elite\s*/i, '').trim() || 'Skill'
  // Normalize to title case so "hex spell" and "Hex Spell" become identical
  const type = typeStripped.replace(/\b\w/g, c => c.toUpperCase())

  let profession = params['profession'] ?? params['prof'] ?? null
  if (profession) {
    const titleCased = profession.charAt(0).toUpperCase() + profession.slice(1).toLowerCase()
    profession = KNOWN_PROFESSIONS.has(profession) ? profession
      : KNOWN_PROFESSIONS.has(titleCased) ? titleCased
      : null
  }

  const campaignRaw = params['campaign'] ?? ''
  const campaign = normaliseCampaign(campaignRaw) ??
    (profession ? CAMPAIGN_BY_PROFESSION[profession] : null) ??
    'Core'

  const num = (v) => {
    if (v === undefined || v === null || v === '' || v === 'n/a' || v === '–') return null
    const n = parseFloat(v)
    return isNaN(n) ? null : n
  }

  const image = params['image'] ?? params['icon'] ?? ''
  const icon = image
    ? image.replace(/^File:/i, '').trim()
    : skillName.replace(/\s+/g, '_') + '.jpg'

  return {
    type,
    profession,
    attribute: params['attribute'] ?? params['attr'] ?? null,
    campaign,
    elite,
    pveOnly: params['pve-only'] === 'yes' || params['pve only'] === 'yes',
    pvpVariant: skillName.includes('(PvP)'),
    energy: num(params['energy'] ?? params['energy cost']),
    adrenaline: num(params['adrenaline'] ?? params['adrenaline cost']),
    activation: num(params['activation'] ?? params['activation time']),
    recharge: num(params['recharge'] ?? params['recharge time']),
    sacrifice: num(params['sacrifice'] ?? params['health sacrifice']),
    upkeep: num(params['upkeep']),
    overcast: num(params['overcast']),
    description: params['description'] ?? params['desc'] ?? '',
    icon,
  }
}

function splitTemplateParts(template) {
  const parts = []
  let depth = 0
  let current = ''
  for (let i = 0; i < template.length; i++) {
    const c = template[i]
    if ((c === '{' || c === '[') && template[i + 1] === c) { depth++; current += c; i++; current += template[i] }
    else if ((c === '}' || c === ']') && template[i + 1] === c) { depth--; current += c; i++; current += template[i] }
    else if (c === '|' && depth === 0) { parts.push(current); current = '' }
    else current += c
  }
  if (current.trim()) parts.push(current)
  return parts
}

function stripWikiMarkup(text) {
  return text
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    // {{gr|min|max}} → "min...max" (attribute-scaling value ranges)
    .replace(/\{\{gr\|([^|{}]+)\|([^|{}]+)(?:\|[^{}]*)?\}\}/gi, '$1...$2')
    // {{gr|val}} → "val"
    .replace(/\{\{gr\|([^|{}]+)\}\}/gi, '$1')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/'''+/g, '')
    .trim()
}

function normaliseCampaign(raw) {
  const r = raw.toLowerCase()
  if (r.includes('factions')) return 'Factions'
  if (r.includes('nightfall')) return 'Nightfall'
  if (r.includes('eye') || r.includes('eotn')) return 'Eye of the North'
  if (r.includes('prophecies')) return 'Prophecies'
  if (r.includes('core')) return 'Core'
  return null
}

// ─── Step 3: Build the final skill object ─────────────────────────────────────

function buildSkill(id, name, detail) {
  const d = detail ?? {}
  return {
    id,
    name,
    profession: d.profession ?? null,
    attribute: d.attribute ?? null,
    campaign: d.campaign ?? 'Core',
    elite: d.elite ?? false,
    pvpVariant: d.pvpVariant ?? name.includes('(PvP)'),
    pveOnly: d.pveOnly ?? false,
    type: d.type ?? 'Skill',
    energy: d.energy ?? null,
    adrenaline: d.adrenaline ?? null,
    activation: d.activation ?? null,
    recharge: d.recharge ?? null,
    sacrifice: d.sacrifice ?? null,
    upkeep: d.upkeep ?? null,
    overcast: d.overcast ?? null,
    description: d.description ?? '',
    icon: d.icon ?? name.replace(/\s+/g, '_') + '.jpg',
  }
}

// ─── Validation ────────────────────────────────────────────────────────────────

function validate(skills) {
  const ids = new Set()
  const errors = []
  for (const s of skills) {
    if (typeof s.id !== 'number') errors.push(`Non-numeric id: ${JSON.stringify(s).slice(0, 80)}`)
    if (!s.name) errors.push(`Skill id ${s.id} has no name`)
    if (ids.has(s.id)) errors.push(`Duplicate id: ${s.id}`)
    ids.add(s.id)
  }
  if (skills.length < 500) {
    errors.push(`Only ${skills.length} skills — expected 1,000+. The scraper may have failed.`)
  }
  return errors
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Guild Wars 1 Build Creator — Wiki Skill Scraper')
  console.log('================================================\n')
  if (DETAILS_ONLY) console.log('  Mode: --details-only (skipping Phase 1)')
  if (PROFESSIONS_ONLY) console.log('  Mode: --professions-only (profession skills only)')
  if (SINGLE_SKILL) console.log(`  Mode: --skill "${SINGLE_SKILL}" (single skill retry)`)
  if (DETAILS_ONLY || PROFESSIONS_ONLY || SINGLE_SKILL) console.log()

  // ── Single skill retry mode ─────────────────────────────────────────────────
  if (SINGLE_SKILL) {
    if (!existsSync(OUT_PATH)) {
      console.error('skills.json not found.')
      process.exit(1)
    }
    const skills = JSON.parse(readFileSync(OUT_PATH, 'utf8'))
    const idx = skills.findIndex(s => s.name === SINGLE_SKILL)
    if (idx === -1) {
      console.error(`Skill "${SINGLE_SKILL}" not found in skills.json.`)
      console.error('Check the name is spelled exactly as it appears in the file.')
      process.exit(1)
    }
    console.log(`Fetching details for "${SINGLE_SKILL}"…`)
    const detail = await fetchSkillDetail(SINGLE_SKILL)
    if (!detail) {
      console.error(`Could not parse infobox for "${SINGLE_SKILL}". The wiki page may be missing or use a different format.`)
      process.exit(1)
    }
    skills[idx] = buildSkill(skills[idx].id, SINGLE_SKILL, detail)
    writeFileSync(OUT_PATH, JSON.stringify(skills, null, 2))
    console.log(`✓ Updated "${SINGLE_SKILL}" (id ${skills[idx].id})`)
    console.log(`  profession: ${skills[idx].profession}`)
    console.log(`  attribute:  ${skills[idx].attribute}`)
    console.log(`  type:       ${skills[idx].type}`)
    console.log(`  elite:      ${skills[idx].elite}`)
    return
  }

  // ── Step 1: Build the id→name map ──────────────────────────────────────────

  let skillMap = {}   // { id: name }

  if (DETAILS_ONLY) {
    // Re-use names from existing skills.json
    if (!existsSync(OUT_PATH)) {
      console.error('skills.json not found — run without --details-only first.')
      process.exit(1)
    }
    const existing = JSON.parse(readFileSync(OUT_PATH, 'utf8'))
    for (const s of existing) skillMap[s.id] = s.name
    console.log(`Step 1: Loaded ${existing.length} skill names from existing skills.json\n`)
  } else {
    console.log('Step 1: Fetching skill IDs from wiki Game Integration pages…')
    skillMap = await fetchAllSkillIds()
    const total = Object.keys(skillMap).length
    console.log(`\n  → ${total} skills found\n`)
    if (total === 0) {
      console.error('No skills found. Check if the wiki pages have changed format.')
      process.exit(1)
    }
  }

  // ── Optional: filter to profession skills only ──────────────────────────────

  let allowedNames = null   // null = no filter (all skills)
  if (PROFESSIONS_ONLY) {
    console.log('Step 1b: Fetching profession skill names from wiki categories…')
    allowedNames = await fetchProfessionSkillNames()
    console.log(`\n  → ${allowedNames.size} profession skill names found\n`)
  }

  // ── Step 2: Fetch individual detail pages ───────────────────────────────────

  // Load existing data so we can skip already-populated skills
  let existingSkills = []
  if (existsSync(OUT_PATH)) {
    existingSkills = JSON.parse(readFileSync(OUT_PATH, 'utf8'))
  }
  const existingMap = new Map(existingSkills.map(s => [s.id, s]))

  console.log('Step 2: Fetching individual skill pages for details…')

  const allEntries = Object.entries(skillMap).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))

  // Determine which skills to fetch:
  // - Skip skills that already have a non-empty description (already populated)
  // - If --professions-only, skip skills not in allowedNames
  const toFetch = allEntries.filter(([idStr, name]) => {
    if (allowedNames && !allowedNames.has(name)) return false
    const existing = existingMap.get(parseInt(idStr, 10))
    return !existing || existing.description === ''
  })
  const toSkip = allEntries.length - toFetch.length

  console.log(`  ${toFetch.length} to fetch, ${toSkip} already populated or skipped\n`)

  const skills = [...existingSkills]  // start with existing data
  let fetched = 0
  let failed = 0

  for (const [idStr, name] of toFetch) {
    const id = parseInt(idStr, 10)
    try {
      const detail = await fetchSkillDetail(name)
      const skill = buildSkill(id, name, detail)

      // Update in-place if already in the list, otherwise push
      const existingIdx = skills.findIndex(s => s.id === id)
      if (existingIdx >= 0) skills[existingIdx] = skill
      else skills.push(skill)

      fetched++

      if (fetched % 10 === 0) {
        const pct = ((fetched / toFetch.length) * 100).toFixed(1)
        process.stdout.write(`\r  Progress: ${fetched}/${toFetch.length} (${pct}%)`)
        // Save incrementally every 10 skills so progress isn't lost if interrupted
        skills.sort((a, b) => a.id - b.id)
        writeFileSync(OUT_PATH, JSON.stringify(skills, null, 2))
      }

      await sleep(RATE_LIMIT_MS)
    } catch (err) {
      console.warn(`\n  ✗ Failed "${name}" (id ${id}): ${err.message}`)
      failed++
      await sleep(RATE_LIMIT_MS)
    }
  }

  process.stdout.write('\n')
  console.log(`\n  → ${fetched} fetched, ${failed} failed\n`)

  // Step 3: Sort and validate
  skills.sort((a, b) => a.id - b.id)

  console.log('Step 3: Validating…')
  const errors = validate(skills)
  if (errors.length > 0) {
    console.error('Validation errors:')
    for (const e of errors) console.error(`  ✗ ${e}`)
    process.exit(1)
  }
  console.log('  ✓ Validation passed\n')

  // Step 4: Write output
  console.log('Step 4: Writing output…')
  mkdirSync(dirname(OUT_PATH), { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify(skills, null, 2))
  const bytes = Buffer.byteLength(JSON.stringify(skills))
  console.log(`  ✓ Written to ${OUT_PATH}`)
  console.log(`  ✓ ${skills.length} skills, ${(bytes / 1024).toFixed(1)} KB\n`)

  // Summary
  const eliteCount = skills.filter(s => s.elite).length
  const withDetail = skills.filter(s => s.description).length
  const byProf = {}
  for (const s of skills) {
    const k = s.profession ?? '(common/PvE)'
    byProf[k] = (byProf[k] ?? 0) + 1
  }
  console.log('Summary:')
  console.log(`  Total skills:  ${skills.length}`)
  console.log(`  With detail:   ${withDetail}`)
  console.log(`  Elite skills:  ${eliteCount}`)
  console.log('  By profession:')
  for (const [prof, count] of Object.entries(byProf).sort()) {
    console.log(`    ${prof.padEnd(20)} ${count}`)
  }
}

main().catch(err => {
  console.error('\nFatal error:', err.message)
  console.error(err.stack)
  process.exit(1)
})
