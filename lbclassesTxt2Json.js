/**
 *  CLI script to extract line breaking classes and general categories
 *  of Unicode code points from txt Unicode data files.
 *  Links to these data files can be found in:
 *  - https://www.unicode.org/reports/tr44/tr44-30.html#UCD_Files
 *  - https://www.unicode.org/reports/tr14/#Properties (section Data File)
 */ 

import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { argv } from 'node:process'
import path from 'node:path'

import { Range } from './src/range.mjs'

class R extends Range {
    toJSON() {
        return this.stop === this.start + 1 ? [ this.start ] : [ this.start, this.stop ]
    }
}

function showUsage(scriptName='<script_name>') {
    console.log('\nScript usage:')
    console.log(`  node ${scriptName} <LineBreak Unicode Data File> <General Unicode Data File> [<Output File>]`)
    console.log('\nExamples:')
    console.log(`  node ${scriptName} ./resources/LineBreak-17.0.0.txt ./resources/UnicodeData-17.0.0.txt`)
    console.log(`  node ${scriptName} ./resources/LineBreak-16.0.0.txt ./resources/UnicodeData-16.0.0.txt ./resources/LineBreak-16.0.0.json`)
    console.log('\nThe first two file paths are required and must point to existing Unicode data files. The optional third file path can be provided to specify where to save the output. '
                + 'The default value for the output file will be the <LineBreak Unicode Data File> with the extension changed to .json (as in the example)')
    console.log('\nCheck these links to know more about Unicode data files:')
    console.log('- https://www.unicode.org/reports/tr44/tr44-30.html#UCD_Files')
    console.log('- https://www.unicode.org/reports/tr14/#Properties (section Data File)\n')
}

function validateFilePath(filePath, argPosition) {
  if (!filePath) {
    console.error(`Error: Missing file path for argument ${argPosition}`);
    return false;
  }

  const resolvedPath = path.resolve(filePath);
  
  if (!existsSync(resolvedPath)) {
    console.error(`Error: File does not exist: "${filePath}"`);
    console.error(`Resolved path: ${resolvedPath}`);
    return false;
  }

  return true;
}

const scriptName = path.parse(process.argv[1]).base
const args = process.argv.slice(2)
if (![2, 3].includes(args.length)) {
    console.error(`Error: Expected 2 required file paths and an optional third, but received ${args.length}`)
    showUsage(scriptName)
    process.exit(1)
}

if (!validateFilePath(args[0]) || !validateFilePath(args[1])) {
    showUsage(scriptName)
    process.exit(1)
}


/**
 *  Extract general categories from UnicodeData.txt
 */
const generalUnicodeDataPath = args[1]

const generalData = await fs.readFile(generalUnicodeDataPath, { encoding: 'utf8' })
const generalDataLines = generalData.split(/(?:\r\n|\r|\n)/)
const generalCategoriesObj = {}
for (const line of generalDataLines) {
    const fields = line.split(';')
    const codePoint = fields[0]
    const generalCategory = fields[2]
    generalCategoriesObj[codePoint] = generalCategory
}
// Define a default value for all the undefined or null object properties
const generalCategoriesHandler = {
    get(target, prop, receiver) {
        return target[prop] ?? 'Cn' // Cn: Unassigned code point
    }
}
const generalCategories = new Proxy(generalCategoriesObj, generalCategoriesHandler)


/**
 * Extract line breaking rules from LineBreak-[version].txt and combine them with
 * the general categories in lists of code point ranges.
 */
const lineBreakingClassesDataFilePath = args[0]

const data = await fs.readFile(lineBreakingClassesDataFilePath, { encoding: 'utf8' })
const lines = data.split(/(?:\r\n|\r|\n)/)

const default_class = 'XX'

const codepoints = new Map
const lbclasses = new Map
let r, cls, gc
let prevRange, prevClass, prevGC
for (const line of lines) {
    if (line.startsWith('#') || !line.trim()) {
        continue;
    }
    let codes = line.match(/^([0-9A-F]{4,6})\.\.([0-9A-F]{4,6})\s+; ([A-Z0-9]{2,3}) *# ([A-Z][a-z&])/)
    if (codes) {
        r = new R(Number('0x' + codes[1]), Number('0x' + codes[2]) + 1)
        cls = codes[3]
        gc = codes[4]
    }
    else {
        codes = line.match(/^([0-9A-F]{4,6})\s+; ([A-Z0-9]{2,3}) *# ([A-Z][a-z&])/)
        if (codes) {
            r = new R(Number('0x' + codes[1]), Number('0x' + codes[1]) + 1)
            cls = codes[2]
            gc = codes[3]
        }
    }
    if (codes) {
        if (r.start > prevRange?.stop) {
            let newRange
            let newRangeClass = default_class
            let newRangeGC = generalCategories[prevRange.stop]
            let newRangeStart = prevRange.stop
            for (let i = prevRange.stop + 1; i <= r.start; i++) {
                if (generalCategories[i] !== newRangeGC || i === r.start) {
                    newRange = new R(newRangeStart, i)
                    if (!lbclasses.has(newRangeClass)) {
                        lbclasses.set(newRangeClass, [])
                    }
                    codepoints.set(newRange, [newRangeClass, newRangeGC])
                    lbclasses.get(newRangeClass).push([newRange, newRangeGC])
                    prevRange = newRange
                    prevClass = newRangeClass
                    prevGC = newRangeGC
                    newRangeGC = generalCategories[i]
                    newRangeStart = i
                }
            }
        }
        if (!lbclasses.has(cls)) {
            lbclasses.set(cls, [])
        }
        if (prevClass === cls && prevGC === gc && r.start === prevRange?.stop) {
            codepoints.delete(prevRange)
            lbclasses.get(cls).pop()
            r = new R(prevRange.start, r.stop)
        }
        codepoints.set(r, [cls, gc])
        lbclasses.get(cls).push([r, gc])
        prevRange = r
        prevClass = cls
        prevGC = gc
    }
}


/**
 * Compact data and save it as a json string.
 */
const lbclassesOpt = new Map
for (const [cls, vals] of lbclasses.entries()) {
    let gcs = {}
    for (const [r, gc] of vals) {
        if (!gcs[gc]) {
            gcs[gc] = []
        }
        gcs[gc].push(r)
    }
    lbclassesOpt.set(cls, gcs)
}

const jsonData = JSON.stringify(Object.fromEntries(lbclassesOpt))

const pathObj = path.parse(lineBreakingClassesDataFilePath)
pathObj.ext = '.json'
pathObj.base = undefined
const outputFilePath = path.format(pathObj)  // './resources/LineBreak-17.0.0.json'

try {
    await fs.writeFile(outputFilePath, jsonData)
}
catch (e) {
    console.error(e)
}
