import { argv } from 'node:process'
import fs from 'node:fs/promises'
import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
const rl = readline.createInterface({ input, output })

import { BreakType, makeLBC } from './src/linebreakingchecker.mjs'

const args = process.argv.slice(2)
const unicodeVersion = args[0] && !isNaN(parseInt(args[0])) ? parseInt(args[0]) : '17'

let data
try {
    data = await fs.readFile(`./resources/LineBreakTest-${unicodeVersion}.0.0.txt`, { encoding: 'utf8' })
}
catch (e) {
    console.error(e)
    process.exit()
}

const lines = data.split(/(?:\r\n|\r|\n)/)

const mapToBreakType = {
    '×': BreakType.FORBIDDEN,
    '÷': BreakType.MANDATORY|BreakType.ALLOWED
}

const mapToBreakChar = {
    1: '×',
    2: '÷',
    4: '÷',
}

function isSurrogatePair(lead, trail) {
    return lead >= 0xd800 && lead <= 0xdbff && trail >= 0xdc00 && trail <= 0xdfff
}

let lbcRules = null
let lineBreakingClassesUrl = null
if (unicodeVersion) {
    lbcRules = (await import('./src/linebreakingrules.mjs'))[`lineBreakingRulesV${unicodeVersion}`]
    lineBreakingClassesUrl = `../resources/LineBreak-${unicodeVersion}.0.0.json`
}
const lbc = await makeLBC(lbcRules, null, lineBreakingClassesUrl)

let index = 0
for (const line of lines) {
    if (!line || line.startsWith('#')) { continue }
    index++
    const payload = line.split(/\s+#/)[0].split(' ')
    let expectedResults = []
    let codePoints = []
    payload.forEach((el, i) => {
        i % 2 === 0 ? expectedResults.push(el) : codePoints.push(String.fromCodePoint(Number('0x' + el)))
    })
    lbc.setText(codePoints.join(''))
    let resultArray = []
    let results = []
    for (let i = 0; i <= lbc.text.length; i++) {
        const breakType = lbc.isPosLineBreaking(i)
        if (i === 0 || i === lbc.text.length || !isSurrogatePair(lbc.text[i - 1].codePointAt(0), lbc.text[i].codePointAt(0))) {
            results.push(mapToBreakChar[breakType])
            const cp = lbc.text.codePointAt(i)
            resultArray.push(mapToBreakChar[breakType] + ' ' + (!isNaN(cp) ? String.fromCodePoint(cp) : '') + ' ')
        }
    }
    let error = false
    if (expectedResults.length !== results.length) {
        error = true
    }
    else {
        for (let i = 0; i < expectedResults.length; i++) {
            if (expectedResults[i] !== results[i]) {
                error = true
                break
            }
        }
    }
    if (error) {
        console.error("ERROR!\nExpected results: ", expectedResults)
        console.error('Got instead: ', resultArray)
        console.error('Test nr. ' + (index+1))
        // console.error(lbc.classes)
        // console.error(codePoints.map(c => /\p{Extended_Pictographic}/u.test(c) ? 'ExtPict' : 'Not ExtPict'))
        // console.error(lbc.origClasses)
        // console.error(lbc.codePoints)
        // // console.error(codePoints.map(c => getGeneralCategory(c.codePointAt(0))))
        // console.error(codePoints)
        // console.error(payload)
        await rl.question('> ')
    }
}

console.log((index + 1) + ' tests completed.')

rl.close();
