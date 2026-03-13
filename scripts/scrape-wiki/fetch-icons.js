/**
 * fetch-icons.js
 *
 * Downloads skill icon images from the Guild Wars Wiki to public/icons/.
 * Reads icon filenames from src/assets/data/skills.json.
 *
 * Image URLs are derived locally using MediaWiki's MD5-based path formula:
 *   images/<hash[0]>/<hash[0..1]>/<Filename>
 * This requires no API calls and avoids rate-limit 403s.
 *
 * Usage:
 *   node scripts/scrape-wiki/fetch-icons.js           # download all icons
 *   node scripts/scrape-wiki/fetch-icons.js --sample  # download 1 icon to validate
 *   node scripts/scrape-wiki/fetch-icons.js --limit 10
 *
 * Skips already-downloaded files so it can be safely re-run to resume.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createHash } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const SKILLS_PATH = join(ROOT, 'src', 'assets', 'data', 'skills.json')
const ICONS_DIR = join(ROOT, 'public', 'icons')

const WIKI_IMAGES_BASE = 'https://wiki.guildwars.com/images'
const RATE_LIMIT_MS = 300  // between downloads

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; GW1BuildCreator/1.0; fan project icon downloader)',
  'Accept': 'image/jpeg,image/png,image/*,*/*',
  'Referer': 'https://wiki.guildwars.com/',
}

// ─── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const isSample = args.includes('--sample')
const limitIdx = args.indexOf('--limit')
const limit = isSample ? 1 : (limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity)

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Derive the wiki image URL using MediaWiki's MD5 path formula.
 * e.g. "Healing_Signet.jpg" → "https://wiki.guildwars.com/images/e/e6/Healing_Signet.jpg"
 */
function wikiImageUrl(filename) {
  const hash = createHash('md5').update(filename).digest('hex')
  return `${WIKI_IMAGES_BASE}/${hash[0]}/${hash.slice(0, 2)}/${filename}`
}

async function fetchWithRetry(url, retries = 2) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, { headers: FETCH_HEADERS })
    if (res.status === 429 || res.status === 503) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '10', 10) * 1000
      console.warn(`\n  Rate limited (${res.status}) — waiting ${retryAfter / 1000}s`)
      await sleep(retryAfter)
      continue
    }
    if (res.status === 403) {
      console.warn(`\n  403 Forbidden — backing off 15s`)
      await sleep(15_000)
      continue
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    return res
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

async function downloadIcon(filename) {
  const url = wikiImageUrl(filename)
  const dest = join(ICONS_DIR, filename)
  const res = await fetchWithRetry(url)
  const buffer = Buffer.from(await res.arrayBuffer())
  writeFileSync(dest, buffer)
  return { url, bytes: buffer.length }
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Guild Wars 1 Build Creator — Icon Downloader')
  console.log('============================================\n')

  if (!existsSync(SKILLS_PATH)) {
    console.error(`skills.json not found at ${SKILLS_PATH}`)
    console.error('Run `npm run data:build` first to populate skill data.')
    process.exit(1)
  }
  const skills = JSON.parse(readFileSync(SKILLS_PATH, 'utf8'))
  if (!Array.isArray(skills) || skills.length === 0) {
    console.error('skills.json is empty. Run `npm run data:build` first.')
    process.exit(1)
  }

  mkdirSync(ICONS_DIR, { recursive: true })

  const allIcons = [...new Set(skills.map(s => s.icon).filter(Boolean))]
  const pending = allIcons.filter(f => !existsSync(join(ICONS_DIR, f)))
  const alreadyHave = allIcons.length - pending.length

  console.log(`  Total unique icons:  ${allIcons.length}`)
  console.log(`  Already downloaded: ${alreadyHave}`)
  console.log(`  To download:        ${pending.length}`)

  if (pending.length === 0) {
    console.log('\n  All icons already downloaded.')
    return
  }

  const queue = pending.slice(0, limit)
  if (isSample) console.log(`\n  Sample mode — downloading 1 icon: ${queue[0]}`)
  else if (isFinite(limit)) console.log(`\n  Limit mode — downloading ${queue.length} icons`)
  console.log()

  let downloaded = 0
  let failed = 0
  let totalBytes = 0

  for (const filename of queue) {
    try {
      const { url, bytes } = await downloadIcon(filename)
      downloaded++
      totalBytes += bytes

      if (isSample) {
        console.log(`  ✓ ${filename}`)
        console.log(`    URL:  ${url}`)
        console.log(`    Size: ${(bytes / 1024).toFixed(1)} KB`)
        console.log(`    Dest: ${join(ICONS_DIR, filename)}`)
      } else if (downloaded % 50 === 0 || downloaded === queue.length) {
        const pct = ((downloaded / queue.length) * 100).toFixed(1)
        process.stdout.write(`\r  Progress: ${downloaded}/${queue.length} (${pct}%) — ${(totalBytes / 1024 / 1024).toFixed(1)} MB`)
      }

      await sleep(RATE_LIMIT_MS)
    } catch (err) {
      failed++
      console.warn(`\n  ✗ Failed ${filename}: ${err.message}`)
      await sleep(RATE_LIMIT_MS)
    }
  }

  if (!isSample) process.stdout.write('\n')

  console.log(`\n  Done.`)
  console.log(`  ✓ Downloaded: ${downloaded}`)
  if (failed > 0) console.log(`  ✗ Failed:     ${failed}`)
  console.log(`  Total size:  ${(totalBytes / 1024 / 1024).toFixed(2)} MB`)
  if (pending.length > queue.length) {
    console.log(`\n  ${pending.length - queue.length} icons still pending — re-run without --limit to get all.`)
  }
}

main().catch(err => {
  console.error('\nFatal error:', err.message)
  console.error(err.stack)
  process.exit(1)
})
