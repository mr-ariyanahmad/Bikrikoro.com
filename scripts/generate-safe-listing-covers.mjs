import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outputDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'listing-covers')

const covers = [
  ['focusday-planner', '#0B6B63', '#7BE0C5', '#FFB36B', 'calendar'],
  ['creatorgrid-social', '#4B2A82', '#7E72F2', '#FF9D86', 'cards'],
  ['resumecraft-cv', '#183A5A', '#7ED8C6', '#FFE5B6', 'document'],
  ['pitchdeck-kit', '#102B4E', '#44C7A6', '#FF8A78', 'chart'],
  ['invoiceflow-sheet', '#0B6E5F', '#A5EDCD', '#F5C65D', 'calculator'],
  ['studysprint-notes', '#264E86', '#91C5FF', '#FFD26F', 'notebook'],
  ['languagelaunch-workbook', '#5B337E', '#D6A5FF', '#FFCF87', 'flashcards'],
  ['codestart-worksheets', '#142B4B', '#52D5B2', '#89B6FF', 'code'],
  ['pixelpulse-components', '#203D72', '#65D6D4', '#A9A2FF', 'blocks'],
  ['weblaunch-starter', '#0E5F64', '#76E1C8', '#FFF0A8', 'browser'],
  ['storesetup-catalog', '#4A315F', '#D79FFF', '#FFB59D', 'store'],
  ['brandboard-identity', '#173C57', '#75D8C8', '#FFBA73', 'palette'],
  ['creatorsound-intro', '#293360', '#9D9CFF', '#F6A3D9', 'sound'],
  ['motionloop-transitions', '#1D3B75', '#70CBFF', '#A6F1D0', 'motion'],
  ['phototone-presets', '#6A354C', '#FF9CB2', '#FFDB9A', 'lens'],
  ['securedevice-guide', '#145047', '#74DCC0', '#C6F4D1', 'shield'],
  ['privacycheck-list', '#173E68', '#83D5FF', '#9BE7C4', 'checklist'],
  ['backupready-kit', '#16476C', '#77C8E8', '#D5F5C4', 'cloud'],
  ['teamflow-workspace', '#34417D', '#9DA6FF', '#83E1C4', 'team'],
  ['freelanceclient-tracker', '#0F6A64', '#8AE0C8', '#F6D67F', 'tracker'],
  ['promptstudio-workflow', '#563C84', '#CBA1FF', '#8EE8D2', 'spark'],
  ['appfocus-guide', '#215A7A', '#80D4EE', '#FFE29B', 'mobile'],
  ['portfoliolaunch-case-study', '#36356B', '#B8B4FF', '#FFA993', 'folio'],
  ['localsearch-audit', '#0D6259', '#8BE5C2', '#FFE88C', 'search'],
  ['contentcalendar-pack', '#81405A', '#FFA2AF', '#FFD78F', 'calendar'],
  ['domainready-plan', '#244880', '#89B7FF', '#91E4D0', 'globe'],
  ['webcare-checklist', '#125154', '#78E0D6', '#B3F1B1', 'wrench'],
  ['indiegame-guide', '#293863', '#9AA3FF', '#6DE0C0', 'game'],
  ['gamestream-overlay', '#46286E', '#C68EFF', '#FF9B83', 'overlay'],
  ['merchantstore-kit', '#0F5C56', '#83E0C4', '#FFD56E', 'bag'],
  ['quickstart-course', '#29537E', '#8DC8FF', '#FFCF86', 'lesson'],
  ['filevault-archive', '#314866', '#9EC3E8', '#AEE7C8', 'folder'],
]

const glyphs = {
  calendar: '<rect x="142" y="152" width="228" height="210" rx="26" fill="#FFFFFF" fill-opacity=".92"/><path d="M142 208h228M198 152v-24m116 24v-24M194 248h42m34 0h42m34 0h-40m-112 52h42m34 0h42m34 0h-40m-112 52h42m34 0h42" stroke="currentColor" stroke-width="18" stroke-linecap="round"/>',
  cards: '<rect x="118" y="198" width="152" height="184" rx="28" fill="#FFFFFF" fill-opacity=".9" transform="rotate(-11 194 290)"/><rect x="270" y="130" width="142" height="185" rx="28" fill="#F7D286" transform="rotate(12 341 223)"/><rect x="247" y="263" width="150" height="150" rx="28" fill="#FF917D" transform="rotate(-4 322 338)"/>',
  document: '<path d="M168 112h146l78 78v216a30 30 0 0 1-30 30H168a30 30 0 0 1-30-30V142a30 30 0 0 1 30-30Z" fill="#FFFFFF" fill-opacity=".92"/><path d="M314 112v74h78M192 245h152m-152 52h152m-152 52h90" stroke="currentColor" stroke-width="18" stroke-linecap="round"/>',
  chart: '<path d="M130 398V236m86 162V174m86 224V272m86 126V118" stroke="#FFFFFF" stroke-width="42" stroke-linecap="round"/><path d="m124 176 78-52 86 57 92-94" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>',
  calculator: '<rect x="136" y="118" width="240" height="300" rx="36" fill="#FFFFFF" fill-opacity=".92"/><rect x="172" y="152" width="168" height="66" rx="14" fill="currentColor" fill-opacity=".28"/><g fill="currentColor"><circle cx="190" cy="264" r="19"/><circle cx="256" cy="264" r="19"/><circle cx="322" cy="264" r="19"/><circle cx="190" cy="326" r="19"/><circle cx="256" cy="326" r="19"/><circle cx="322" cy="326" r="19"/></g>',
  notebook: '<rect x="150" y="104" width="212" height="316" rx="26" fill="#FFFFFF" fill-opacity=".94"/><path d="M186 174h136m-136 54h136m-136 54h90M151 135h211" stroke="currentColor" stroke-width="17" stroke-linecap="round"/><path d="M150 148h212" stroke="#FFFFFF" stroke-width="10"/>',
  flashcards: '<rect x="124" y="218" width="194" height="136" rx="22" fill="#FFFFFF" fill-opacity=".94" transform="rotate(-13 221 286)"/><rect x="232" y="142" width="174" height="142" rx="22" fill="#FFE19A" transform="rotate(14 319 213)"/><path d="M164 274h98m36-58h68" stroke="currentColor" stroke-width="18" stroke-linecap="round"/>',
  code: '<path d="m210 142-92 114 92 114M302 142l92 114-92 114M283 108l-54 296" fill="none" stroke="#FFFFFF" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>',
  blocks: '<rect x="124" y="126" width="112" height="112" rx="28" fill="#FFFFFF" fill-opacity=".92"/><rect x="276" y="126" width="112" height="112" rx="28" fill="currentColor" fill-opacity=".55"/><rect x="124" y="278" width="112" height="112" rx="28" fill="currentColor" fill-opacity=".45"/><rect x="276" y="278" width="112" height="112" rx="28" fill="#FFFFFF" fill-opacity=".78"/>',
  browser: '<rect x="102" y="132" width="308" height="254" rx="30" fill="#FFFFFF" fill-opacity=".92"/><path d="M102 195h308M143 164h10m29 0h10m29 0h10" stroke="currentColor" stroke-width="16" stroke-linecap="round"/><rect x="153" y="236" width="96" height="96" rx="18" fill="currentColor" fill-opacity=".42"/><path d="M278 253h81m-81 42h55m-55 42h70" stroke="currentColor" stroke-width="18" stroke-linecap="round"/>',
  store: '<path d="M128 218h256v186H128z" fill="#FFFFFF" fill-opacity=".9"/><path d="m108 218 33-94h230l33 94H108Z" fill="currentColor" fill-opacity=".62"/><path d="M173 404v-118h70v118m54-116h44" stroke="currentColor" stroke-width="20" stroke-linecap="round"/>',
  palette: '<path d="M257 105c-103 0-159 70-159 148 0 85 76 146 157 146h42c31 0 40-45 12-62-20-12-4-47 22-47 45 0 87-31 87-84 0-66-67-101-161-101Z" fill="#FFFFFF" fill-opacity=".9"/><g fill="currentColor"><circle cx="174" cy="202" r="20"/><circle cx="252" cy="166" r="20"/><circle cx="337" cy="203" r="20"/><circle cx="170" cy="290" r="20"/></g>',
  sound: '<path d="M138 276h54l96-80v160l-96-80h-54z" fill="#FFFFFF" fill-opacity=".92"/><path d="M330 214c29 24 29 60 0 84m34-122c57 55 57 105 0 160" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round"/>',
  motion: '<path d="M108 346c104-188 197-188 312 0" fill="none" stroke="#FFFFFF" stroke-width="34" stroke-linecap="round"/><path d="M102 233c93-126 214-126 318 0" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round"/><circle cx="253" cy="346" r="44" fill="currentColor" fill-opacity=".55"/>',
  lens: '<circle cx="255" cy="246" r="115" fill="#FFFFFF" fill-opacity=".88"/><circle cx="255" cy="246" r="72" fill="currentColor" fill-opacity=".58"/><path d="m331 326 74 74" stroke="#FFFFFF" stroke-width="30" stroke-linecap="round"/>',
  shield: '<path d="M256 96 390 150v108c0 92-59 142-134 166-75-24-134-74-134-166V150l134-54Z" fill="#FFFFFF" fill-opacity=".92"/><path d="m193 255 43 43 88-94" fill="none" stroke="currentColor" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>',
  checklist: '<rect x="134" y="108" width="244" height="310" rx="30" fill="#FFFFFF" fill-opacity=".92"/><path d="m178 194 20 20 34-39m24 23h80m-158 84 20 20 34-39m24 23h80m-158 84 20 20 34-39m24 23h80" fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>',
  cloud: '<path d="M170 362h184c50 0 77-35 77-75 0-44-34-76-78-76-12-64-58-99-113-99-66 0-112 48-112 108-36 2-66 33-66 72 0 39 31 70 70 70h38Z" fill="#FFFFFF" fill-opacity=".9"/><path d="M256 196v108m-47-47 47-47 47 47" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>',
  team: '<circle cx="196" cy="210" r="45" fill="#FFFFFF" fill-opacity=".92"/><circle cx="318" cy="210" r="45" fill="#FFFFFF" fill-opacity=".7"/><path d="M122 372c9-71 47-105 111-105s102 34 111 105M288 286c55 8 86 37 96 86" fill="none" stroke="currentColor" stroke-width="26" stroke-linecap="round"/>',
  tracker: '<path d="M118 374 207 281l62 48 124-165" fill="none" stroke="#FFFFFF" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/><circle cx="118" cy="374" r="22" fill="currentColor"/><circle cx="207" cy="281" r="22" fill="currentColor"/><circle cx="269" cy="329" r="22" fill="currentColor"/><circle cx="393" cy="164" r="22" fill="currentColor"/>',
  spark: '<path d="m255 96 28 104 104 28-104 28-28 104-28-104-104-28 104-28 28-104Z" fill="#FFFFFF" fill-opacity=".9"/><path d="m373 312 14 52 52 14-52 14-14 52-14-52-52-14 52-14 14-52Z" fill="currentColor" fill-opacity=".72"/>',
  mobile: '<rect x="168" y="94" width="176" height="336" rx="32" fill="#FFFFFF" fill-opacity=".92"/><rect x="193" y="138" width="126" height="218" rx="16" fill="currentColor" fill-opacity=".32"/><circle cx="256" cy="394" r="13" fill="currentColor"/>',
  folio: '<path d="M112 176h288v228H112z" fill="#FFFFFF" fill-opacity=".9"/><path d="M112 176h112l24-38h96l24 38h32" fill="currentColor" fill-opacity=".62"/><path d="M157 240h198m-198 62h128m-128 62h160" stroke="currentColor" stroke-width="18" stroke-linecap="round"/>',
  search: '<circle cx="232" cy="229" r="94" fill="#FFFFFF" fill-opacity=".9"/><path d="m302 300 91 91" stroke="currentColor" stroke-width="34" stroke-linecap="round"/><path d="M194 228h77m-38-38v77" stroke="currentColor" stroke-width="18" stroke-linecap="round"/>',
  globe: '<circle cx="256" cy="256" r="142" fill="#FFFFFF" fill-opacity=".88"/><path d="M114 256h284M256 114c47 42 69 89 69 142s-22 100-69 142c-47-42-69-89-69-142s22-100 69-142Z" fill="none" stroke="currentColor" stroke-width="18"/>',
  wrench: '<path d="M334 116c-25 7-44 29-44 57 0 35 29 64 64 64 9 0 17-2 25-5L217 394l-61-61 162-162c-3-8-5-16-5-25 0-28 19-51 45-58l-31 37 36 36 36-45-65 0Z" fill="#FFFFFF" fill-opacity=".9"/>',
  game: '<path d="M153 207h206c39 0 65 30 75 76l20 90c9 41-42 60-68 28l-47-56H173l-47 56c-26 32-77 13-68-28l20-90c10-46 36-76 75-76Z" fill="#FFFFFF" fill-opacity=".92"/><path d="M185 266v54m-27-27h54m160-20h1m27 27h1" stroke="currentColor" stroke-width="18" stroke-linecap="round"/>',
  overlay: '<rect x="104" y="119" width="304" height="274" rx="32" fill="#FFFFFF" fill-opacity=".2" stroke="#FFFFFF" stroke-width="14"/><rect x="132" y="148" width="120" height="75" rx="14" fill="#FFFFFF" fill-opacity=".86"/><rect x="272" y="148" width="104" height="75" rx="14" fill="currentColor" fill-opacity=".72"/><rect x="132" y="246" width="244" height="112" rx="14" fill="#FFFFFF" fill-opacity=".68"/>',
  bag: '<path d="M139 184h234l-20 218H159l-20-218Z" fill="#FFFFFF" fill-opacity=".9"/><path d="M204 184c0-48 21-74 52-74s52 26 52 74" fill="none" stroke="currentColor" stroke-width="24" stroke-linecap="round"/><path d="M196 262h120m-120 58h120" stroke="currentColor" stroke-width="18" stroke-linecap="round"/>',
  lesson: '<rect x="114" y="130" width="284" height="272" rx="28" fill="#FFFFFF" fill-opacity=".9"/><path d="M114 190h284M168 244l44 35-44 35m79 0h94" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>',
  folder: '<path d="M105 177h120l32 38h150v178H105V177Z" fill="#FFFFFF" fill-opacity=".9"/><path d="M105 177h120l32 38H105v-38Z" fill="currentColor" fill-opacity=".58"/><path d="M160 285h190" stroke="currentColor" stroke-width="20" stroke-linecap="round"/>',
}

await mkdir(outputDir, { recursive: true })

for (const [slug, base, accent, glow, motif] of covers) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Original digital marketplace cover"><defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${base}"/><stop offset="1" stop-color="${accent}"/></linearGradient><radialGradient id="light" cx="78%" cy="18%" r="70%"><stop stop-color="${glow}" stop-opacity=".8"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient><filter id="shadow"><feDropShadow dx="0" dy="18" stdDeviation="16" flood-opacity=".22"/></filter></defs><rect width="512" height="512" rx="44" fill="url(#bg)"/><rect width="512" height="512" rx="44" fill="url(#light)"/><circle cx="90" cy="86" r="38" fill="#FFFFFF" fill-opacity=".13"/><circle cx="425" cy="410" r="76" fill="#FFFFFF" fill-opacity=".1"/><g filter="url(#shadow)" style="color:${base}">${glyphs[motif]}</g></svg>`
  await writeFile(join(outputDir, `${slug}.svg`), svg)
}

console.log(`Generated ${covers.length} original SVG covers in ${outputDir}`)
