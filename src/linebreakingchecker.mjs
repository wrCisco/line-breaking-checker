/**
 * Copyright (c) 2025 Francesco Martini
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { BreakType } from './breaktypes.mjs'
import { RuleParser } from './ruleparser.mjs'

export { BreakType } from './breaktypes.mjs'
export { default as lineBreakingRulesV17, lineBreakingRulesV16 } from './linebreakingrules.mjs'


// definition of $EastAsian used in the Unicode line breaking algorithm, from
// https://www.unicode.org/reports/tr14/: 
// The symbol $EastAsian stands for the set [\p{ea=F}\p{ea=W}\p{ea=H}] of characters
// with Fullwidth, Wide, or Halfwidth East Asian Width.
//
// To find the code points with these characteristics I used the Python stdlib
// unicodedata.east_asian_width function (Python 3.12)
const eastAsianCodePoints = new Map

// maps every code point to its line breaking class and its general category
// e.g. codePointsBLClasses.get(key)[65] ('A') will be
// { line_breaking_class: 'AL', general_category: 'Lu' }
// ('key' is the url of the source json file of the Unicode data, used to
// handle more than one version of the line breaking checker at a time)
const codePointsBLClasses = new Map

export async function makeLBC(rules, criteria, compactClassesUrl, eastAsianCharRangesUrl) {
    if (!rules) {
        rules = (await import('./linebreakingrules.mjs')).default
    }
    if (!compactClassesUrl) {
        compactClassesUrl = '../resources/LineBreak-17.0.0.json'
    }
    if (!codePointsBLClasses.has(compactClassesUrl)) {
        let CompactClasses
        try {
            const res = await fetch(compactClassesUrl)
            CompactClasses = await res.json()
        }
        catch (e) {
            // NodeJS does not support fetch of local files
            CompactClasses = (await import(/* @vite-ignore */compactClassesUrl, { with: { type: 'json' }})).default
        }
        const classes = []
        for (const cls in CompactClasses) {
            for (const gc in CompactClasses[cls]) {
                for (let [b, e] of CompactClasses[cls][gc]) {
                    if (e === undefined) { e = b + 1 }
                    for (let i = b; i < e; i++) {
                        classes[i] = { line_breaking_class: cls, general_category: gc }
                    }
                }
            }
        }
        codePointsBLClasses.set(compactClassesUrl, classes)
    }
    if (!eastAsianCharRangesUrl) {
        eastAsianCharRangesUrl = '../resources/EastAsianChars.json'
    }
    if (!eastAsianCodePoints.has(eastAsianCharRangesUrl)) {
        let EastAsianCharRanges
        try {
            const res = await fetch(eastAsianCharRangesUrl)
            EastAsianCharRanges = await res.json()
        }
        catch(e) {
            // NodeJS does not support fetch of local files
            EastAsianCharRanges = (await import(/* @vite-ignore */eastAsianCharRangesUrl, { with: { type: 'json' }})).default
        }
        const eaCodePoints = new Set
        for (const [s, e] of EastAsianCharRanges) {
            for (let i = s; i < e; i++) eaCodePoints.add(i)
        }
        eastAsianCodePoints.set(eastAsianCharRangesUrl, eaCodePoints)
    }
    return new LineBreakingChecker(criteria, rules, compactClassesUrl, eastAsianCharRangesUrl)
}


function getClass(codePoint, key) {
    return codePointsBLClasses.get(key)[codePoint]?.line_breaking_class
}

function getGeneralCategory(codePoint, key) {
    return codePointsBLClasses.get(key)[codePoint]?.general_category
}

function getClsAndGC(codePoint, key) {
    const { line_breaking_class, general_category } = codePointsBLClasses.get(key)[codePoint] ?? { line_breaking_class: undefined, general_category: '' }
    return [line_breaking_class, general_category]
}

function computeCodePointFromSurrogatePair(high, low) {
    const offset = 0x10000 - (0xd800 << 10) - 0xdc00
    return (high << 10) + low + offset
}


class LineBreakingChecker {
    #text = ''
    #codePoints
    #offsetsSurrogates
    #assignLineBreakingClsCriteria
    #classesKey
    #eastAsianKey
    #classes
    #rules
    #sideEffectArguments
    #origClasses
    #origCodePoints
    #classesWithoutCS
    #codePointsWithoutCS
    #offsetsCombiningSeqs
    #applyOffset

    constructor(criteria, rules, classesKey, eastAsianKey) {
        this.#assignLineBreakingClsCriteria = criteria
        this.#rules = this.#parseRules(rules)
        this.registerSideEffectArguments(
            { std_remove_cm_sequences: [this.boundRemoveCombiningSequences] }
        )
        this.#classesKey = classesKey
        this.#eastAsianKey = eastAsianKey
    }

    #parseRules(rules) {
        const p = new RuleParser()
        const parsedRules = rules.map(r => p.parseRule(r))
        return parsedRules
    }

    registerSideEffectArguments(args) {
        if (!this.#sideEffectArguments) {
            this.#sideEffectArguments = {}
        }
        for (const name in args) {
            this.#sideEffectArguments[name] = args[name]
        }
        return this.#sideEffectArguments
    }

    get text() {
        return this.#text
    }

    get codePoints() {
        return this.#codePoints
    }

    setText(text) {
        this.#text = text
        this.#setCodePoints()
        this.#classes = this.#assignLineBreakingClasses(this.#assignLineBreakingClsCriteria)
        this.#setCombiningSequencesMaps()
        this.#origClasses = this.#classes
        this.#origCodePoints = this.#codePoints
    }

    #setCodePoints() {
        this.#codePoints = []
        this.#offsetsSurrogates = []
        let offset = 0
        let highSurrogate
        for (let i = 0; i < this.#text.length; i++) {
            this.#offsetsSurrogates.push(offset)
            const codePoint = this.#text.codePointAt(i)
            if (!highSurrogate) {
                this.#codePoints.push(codePoint)
            }
            if (codePoint > 65535) {
                highSurrogate = true
                offset++
            }
            else {
                highSurrogate = false
            }

        }
        this.#offsetsSurrogates.push(offset)
    }

    static isSurrogate(n) {
        return n >= 0xd800 && n <= 0xdfff
    }

    static isSurrogatePair(lead, trail) {
        return lead >= 0xd800 && lead <= 0xdbff && trail >= 0xdc00 && trail <= 0xdfff
    }

    #setCombiningSequencesMaps() {
        this.#classesWithoutCS = []
        this.#offsetsCombiningSeqs = []
        this.#codePointsWithoutCS = []
        let prevCls = undefined
        let totOffset = 0
        for (const [i, el] of this.#classes.entries()) {
            if (['CM', 'ZWJ'].includes(el)) {
                if (!prevCls || ['SP', 'BK', 'CR', 'LF', 'NL', 'ZW'].includes(prevCls)) {
                    this.#classesWithoutCS.push('AL')
                    this.#codePointsWithoutCS.push(0x41)  // 'A'
                }
                else {
                    totOffset++
                }
            }
            else {
                this.#classesWithoutCS.push(el)
                this.#codePointsWithoutCS.push(this.#codePoints[i])
            }
            this.#offsetsCombiningSeqs.push(totOffset)
            prevCls = el
        }
        this.#offsetsCombiningSeqs.push(totOffset)
        this.#applyOffset = false
    }

    #assignLineBreakingClasses(criteria) {
        const classes = []
        for (const c of this.#codePoints) {
            const [cls, gc] = getClsAndGC(c, this.#classesKey)
            if (!criteria) {
                switch (cls) {
                    case 'AI':
                    case 'SG':
                    case 'XX':
                        classes.push('AL')
                        break
                    case 'SA':
                        if (gc === 'Mn' || gc === 'Mc') {
                            classes.push('CM')
                        }
                        else {
                            classes.push('AL')
                        }
                        break
                    case 'CJ':
                        classes.push('NS')
                        break
                    default:
                        classes.push(cls)
                }
            }
            else {
                classes.push(criteria(cls, gc))
            }
        }
        return classes
    }

    [Symbol.iterator]() {
        let current = -1
        let lineBreak = BreakType.MANDATORY|BreakType.ALLOWED
        return {
            next: () => {
                let result = BreakType.UNKNOWN
                while ((result & lineBreak) === 0) {
                    current++
                    if (current > this.#text.length) {
                        return { done: true }
                    }
                    result = this.isPosLineBreaking(current)
                }
                return { done: false, value: { index: current, breakType: result }}
            }
        }
    }

    isPosLineBreaking(i) {
        let result = BreakType.UNKNOWN
        // handle position inside surrogate pair as a special case
        if (i > 0 && i < this.#text.length && LineBreakingChecker.isSurrogatePair(this.#text[i-1].codePointAt(0), this.#text[i].codePointAt(0))) {
            result = BreakType.FORBIDDEN
        }
        else {
            for (const rule of this.#rules) {
                const offsetSurrogates = this.#offsetsSurrogates[i]
                result = this.#checkRule(rule, i - offsetSurrogates - this.#offsetsCombiningSeqs[i - offsetSurrogates] * !!this.#applyOffset)
                if (result !== BreakType.UNKNOWN) {
                    break
                }
            }
        }
        // cleanup
        if (this.#applyOffset) {
            this.#classes = this.#origClasses
            this.#codePoints = this.#origCodePoints
            this.#applyOffset = false
        }
        return result
    }

    #checkRule(rule, i) {
        if (this.#consumeToken(rule.before, i - 1, -1, null, null, null).result
                && this.#consumeToken(rule.after, i, 1, null, null, null).result) {
            return rule.result
        }
        if (rule.side_effect) {
            rule.side_effect(...(this.#sideEffectArguments[rule.name] ?? []))
        }
        return BreakType.UNKNOWN
    }

    #removeCombiningSequences() {
        this.#classes = this.#classesWithoutCS
        this.#codePoints = this.#codePointsWithoutCS
        this.#applyOffset = true
    }
    boundRemoveCombiningSequences = this.#removeCombiningSequences.bind(this)

    #checkBase(base, i) {
        switch (base) {
            case 'any':
                return true
            case 'sot':
                return i < 0
            case 'eot':
                return i === this.#codePoints.length
            default:
                throw Error('Invalid rule base value: ' + base)
        }
    }

    #checkClass(cls, i) {
        return cls === this.#classes[i]
    }

    #checkGeneralCategory(gc, i) {
        return gc === getGeneralCategory(this.#codePoints[i], this.#classesKey)
    }

    #checkCodePoint(cp, i) {
        return cp === this.#codePoints[i]
    }

    #checkExtPict(i) {
        return /\p{Extended_Pictographic}/u.test(String.fromCodePoint(this.#codePoints[i]))
    }

    #checkEastAsian(i) {
        return eastAsianCodePoints.get(this.#eastAsianKey).has(this.#codePoints[i])
    }

    #consumeToken(token, i, step, parent, prev_result, next_token_index) {
        switch (token.type) {
            case 'base':
                return { result: this.#checkBase(token.content, i), index: i }
            case 'class':
                return { result: this.#checkClass(token.content, i), index: i }
            case 'gc':
                return { result: this.#checkGeneralCategory(token.content, i), index: i }
            case 'codepoint':
                return { result: this.#checkCodePoint(token.content, i), index: i }
            case 'extpict':
                return { result: this.#checkExtPict(i), index: i }
            case 'eastasian':
                return { result: this.#checkEastAsian(i), index: i }
            case 'modifier':
                if (token.content === '^') {
                    const result = this.#consumeToken(parent.content[next_token_index], i, step, parent, prev_result, next_token_index + 1)
                    return {
                        result: !result.result,
                        index: result.index,
                        next_token_index: result.next_token_index ?? next_token_index + 1
                    }
                }
                else if (token.content === '&') {
                    if (prev_result === false) {
                        return { result: false, index: i, next_token_index: next_token_index + 1 }
                    }
                    const result = this.#consumeToken(parent.content[next_token_index], i, step, parent, prev_result, next_token_index + 1)
                    return {
                        result: result.result,
                        index: result.index,
                        next_token_index: result.next_token_index ?? next_token_index + 1
                    }
                }
                else if (token.content === '-') {
                    if (prev_result === false) {
                        return { result: false, index: i, next_token_index: next_token_index + 1 }
                    }
                    const result = this.#consumeToken(parent.content[next_token_index], i, step, parent, prev_result, next_token_index + 1)
                    return {
                        result: !result.result,
                        index: result.index,
                        next_token_index: result.next_token_index ?? next_token_index + 1
                    }
                }
                else if (token.content === '*') {
                    let result = this.#consumeToken(parent.content[next_token_index], i, step, parent, prev_result, next_token_index + 1)
                    while (result.result && result.index > 0 && result.index < this.#codePoints.length - 1) {
                        result = this.#consumeToken(parent.content[next_token_index], result.index + step, step, parent, result.result, next_token_index + 1)
                    }
                    return {
                        result: true,
                        index: result.index,
                        next_token_index: result.next_token_index ?? next_token_index + 1
                    }
                }
                throw Error('Invalid modifier value: ' + token.content)
            case 'set': {
                let result = { result: undefined, index: i }
                let token_i = 0
                while (token_i < token.content.length) {
                    result = this.#consumeToken(
                        token.content[token_i], result.index, step, token, result.result, token_i + 1
                    )
                    token_i = result.next_token_index ?? token_i + 1
                    // set's result is true if at least one of its items returns true, unless the following item is a non-unary modifier
                    if (result.result === true && (token.content[token_i]?.type !== 'modifier' || ['*', '^'].includes(token.content[token_i]?.content))) {
                        return { result: true, index: i }
                    }
                }
                return { result: false, index: i }
            }
            case 'sequence': {
                let result = { result: undefined, index: i }
                let token_i = 0
                while (token_i < token.content.length) {
                    result = this.#consumeToken(
                        token.content[token_i], result.index, step, token, result.result, token_i + 1
                    )
                    if (result.result === false) {
                        return { result: false, index: i }
                    }
                    if (token.content[token_i].content !== '*') {
                        result.index += step
                    }
                    token_i = result.next_token_index ?? token_i + 1
                }
                return { result: true, index: result.index }
            }
            default:
                throw new Error('Invalid token type: ' + token.type)
        }
    }
}
