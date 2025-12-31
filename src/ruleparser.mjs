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

export class RuleParser {
    reverseBefore

    constructor(reverseBefore = true) {
        this.reverseBefore = reverseBefore
    }

    cleanRule(rule) {
        this.cleanPart(rule.before)
        this.cleanPart(rule.after)
    }

    cleanPart(part) {
        if ((part.type === 'sequence' && part.content.length === 1 && part.content[0].type === 'sequence')
                || (part.type === 'set' && part.content.length === 1 && part.content[0].type === 'set')) {
            part.content = part.content[0].content
        }
        if (Array.isArray(part.content)) {
            for (const token of part.content) {
                this.cleanPart(token)
            }
        }
    }

    reverseSequences(token) {
        if (token.type === 'sequence') {
            token.content = token.content.reverse()
            for (let i = 1, e = token.content.length; i < e; i++) {
                if (token.content[i].type === 'modifier') {
                    [token.content[i], token.content[i - 1]] = [token.content[i - 1], token.content[i]]
                }
            }
        }
        if (Array.isArray(token.content)) {
            for (const t of token.content) {
                this.reverseSequences(t)
            }
        }
    }

    parseRule(rule) {
        const str = rule[0]
        const side_effect = rule[1]  // optional
        const name = rule[2]  // optional
        const ruleObj = {
            before: {
                type: 'sequence',
                content: [],
            },
            after: {
                type: 'sequence',
                content: [],
            },
            name: name,
            side_effect: side_effect,
            result: undefined
        }
        let context = ruleObj.before.content
        const tokens = str.split(/\s+/)
        let i = 0
        while (i < tokens.length) {
            [context, i] = this.parseToken(tokens, i, context, ruleObj)
        }
        this.cleanRule(ruleObj)
        if (this.reverseBefore) {
            this.reverseSequences(ruleObj.before)
        }
        return ruleObj
    }

    parseToken(tokens, i, context, ruleObj) {
        let newContext = undefined
        const token = tokens[i]
        switch (token) {
            case '×':
                ruleObj.result = BreakType.FORBIDDEN
                newContext = ruleObj.after.content
                break
            case '!':
                ruleObj.result = BreakType.MANDATORY
                newContext = ruleObj.after.content
                break
            case '÷':
                ruleObj.result = BreakType.ALLOWED
                newContext = ruleObj.after.content
                break
            case 'any':
            case 'sot':
            case 'eot':
                context.push({ type: 'base', content: token })
                break
            case 'eastasian':
                context.push({ type: 'eastasian', content: token })
                break
            case 'extpict':
                context.push({ type: 'extpict', content: token })
                break
            case token.match(/\\u[0-9A-Fa-f]{4,6}/)?.[0]:
                context.push({ type: 'codepoint', content: Number('0x' + token.slice(2)) })
                break
            case token.match(/gc\([A-Za-z&]{2}\)/)?.[0]:
                context.push({ type: 'gc', content: token.slice(3, 5) })
                break
            case token.match(/[A-Z0-9]{2,3}/)?.[0]:
                context.push({ type: 'class', content: token })
                break
            case '^':
            case '&':
            case '-':
            case '*':
                context.push({ type: 'modifier', content: token })
                break
            case '|': // check that it's only used in sets?
                break
            case '(': {
                const newElem = {
                    type: 'set',
                    content: []
                }
                context.push(newElem)
                let unused
                i++
                while (tokens[i] !== ')') {
                    [unused, i] = this.parseToken(tokens, i, newElem.content, ruleObj)
                }
                break
            }
            case ')':
                break
            case '[': {
                const newElem = {
                    type: 'sequence',
                    content: [],
                }
                context.push(newElem)
                let unused
                i++
                while (tokens[i] !== ']') {
                    [unused, i] = this.parseToken(tokens, i, newElem.content, ruleObj)
                }
                break
            }
            case ']':
                break
            default:
                throw new Error(`Unrecognized token: ${token} (rule: ${tokens.join(" ")}`)
        }
        return [newContext ?? context, i + 1]
    }
}
