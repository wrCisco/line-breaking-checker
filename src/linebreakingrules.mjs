/**
 * Line breaking rules, Unicode v16 and v17
 * 
 * The rules's syntax is based on the one used in
 * https://www.unicode.org/reports/tr14/#Algorithm,
 * with modifications to facilitate the parsing.
 *
 * ×: break line forbidden
 * !: break line mandatory
 * ÷: break line allowed
 * sot: start of text
 * end: end of text
 * any: any text
 * (: start of set
 * ): end of set
 * [: start of sequence
 * ]: end of sequence
 * [A-Z0-9]{2,3}: line breaking class
 * gc([A-Za-z&]{2}): general category
 * eastasian: eastasian character (fullwidth, halfwidth and wide)
 * extpict: Extended_Pictographic category
 * \\u[0-9A-Fa-f]{4,6}: single code point
 * ^: modifier NOT
 * |: modifier OR (used only in sets, where it's the default)
 * &: modifier AND
 * -: modifier MINUS (i.e. AND NOT)
 * *: modifier 0 or more
 *
 * Every rule must have exactly one of the three break line (×, !, ÷)
 * symbols, preceded and followed by one or more other symbols.
 * Binary modifiers (|, &, -) are used inside sets only.
 * Unary modifiers (^ and *) must always PRECEDE their argument,
 * e.g. for zero or more spaces write * SP, not SP *
 * Sets are collections of elements that match if at least one element matches.
 * Sequences are ordered collections that match if all their elements match.
 * Always separate tokens with a space.

 * Every rule is an array with one required and two optional elements:
 * - the rule itself, required, a string in a parseable format
 * - the side effect, optional, a function
 *      The side effect function can optionally accept arguments. IF it is the case,
 *      the assignment of the arguments to the function is done directly in the LineBreakingChecker
 *      class, with the method registerSideEffectArguments, which accepts as only argument
 *      an object with the rules names as keys and arrays of arguments for the side effect function as values,
 *      e.g.
 *      const lbc = new LineBreakingChecker(text, customRules)
 *      lbc.registerSideEffectArguments({
 *          'rule_name1': ['arg1_for_name1', 'arg2_for_name2'],
 *          'rule_name2': ['arg1_for_name2'],
 *      })
 *      For the rule named 'std_remove_cm_sequences' in the standard ruleset this is done automatically,
 *      for any custom rule the method needs to be called manually.
 * - the name of the rule, optional, a string
 */


/**
 * Line breaking rules for Unicode v17.0
 * 
 * Modifications from the previous revision (from https://www.unicode.org/reports/tr14/#Modifications):
 *     Updated the test files to more closely match the rules.
 *     Split part of class BA into a new class Unambiguous_Hyphen (HH) and updated rules LB20a and LB21a to use it. Rules LB12a and LB21 treat HH like BA, preserving their old behavior. [181-C53]
 *     Updated rule LB20a to treat Hebrew letters (HL) like other alphabetic characters (AL). [181-C53]
 *     Updated the descriptions of classes CM and GL to reflect the change to the Line_Break property of U+034F COMBINING GRAPHEME JOINER. Added a discussion of this long-standing mistaken assignment in Section 11, History. [181-C54]
 *     Section 5.3, Use of Hyphen: updated for LB20a added in Unicode 16.0. [179-C32]
 *     Section 5.5, Use of Double Hyphen: Add a discussion of the actual DOUBLE HYPHEN, based on L2/11-038.
 *     Section 5.5, Use of Double Hyphen: Corrected confusing statements about U+2E17 DOUBLE OBLIQUE HYPHEN.
 */
const lineBreakingRulesV17 = [
    // LB2: Never break at the start of text.
    [ 'sot × any' ],
    // LB3: Always break at the end of text.
    [ 'any ! eot' ],
    // LB4: Always break after hard line breaks.
    [ 'BK ! any' ],
    // LB5: Treat CR followed by LF, as well as CR, LF, and NL as hard line breaks.
    [ 'CR × LF' ],
    [ '( CR | LF | NL ) ! any' ],
    // LB6: Do not break before hard line breaks.
    [ 'any × ( BK | CR | LF | NL )' ],
    // LB7: Do not break before spaces or zero width space.
    [ 'any × ( SP | ZW )' ],
    // LB8: Break before any character following a zero-width space, even if one or more spaces intervene.
    [ '[ ZW * SP ] ÷ any' ],
    // LB8a: Do not break after a zero width joiner. 
    [ 'ZWJ × any' ],
    // LB9 and LB10 have a side effect that changes how CM and ZWJ characters are interpreted in subsequent rules.
    // The implementation of the side effect is mandated to the callback function cb passed as argument.
    // LB9: Do not break a combining character sequence; treat it as if it has the line breaking class of the base character in all of the following rules. Treat ZWJ as if it were CM.
    // Treat X (CM | ZWJ)* as if it were X
    // where X is any line break class except BK, CR, LF, NL, SP, or ZW.
    // In subsequent rules, any CM or ZWJ characters affected by this rule are ignored.
    // LB10: Treat any remaining CM or ZWJ as if it had the properties of U+0041 A LATIN CAPITAL LETTER A, that is, Line_Break=AL, General_Category=Lu, East_Asian_Width=Na, Extended_Pictographic=N.
    // This catches the case where a CM is the first character on the line or follows SP, BK, CR, LF, NL, or ZW.
    [ '^ ( sot | BK | CR | LF | NL | SP | ZW ) × ( CM | ZWJ )', function(cb, ...args) { cb(...args) }, 'std_remove_cm_sequences' ],
    // LB11: Do not break before or after Word joiner and related characters.
    [ 'any × WJ' ],
    [ 'WJ × any' ],
    // LB12: Do not break after NBSP and related characters.
    [ 'GL × any' ],
    // LB12a: Do not break before NBSP and related characters, except after spaces and hyphens.
    [ '^ ( SP | BA | HY | HH ) × GL' ],
    // LB13: Do not break before ‘]’ or ‘!’ or ‘/’, even after spaces.
    [ 'any × ( CL | CP | EX | SY )' ],
    // LB14: Do not break after ‘[’, even after spaces.
    [ '[ OP * SP ] × any' ],
    // LB15a: Do not break after an unresolved initial punctuation that lies at the start of the line, after a space, after opening punctuation, or after an unresolved quotation mark, even after spaces.
    [ '[ ( sot | BK | CR | LF | NL | OP | QU | GL | SP | ZW ) ( gc(Pi) & QU ) * SP ] × any' ],
    // LB15b: Do not break before an unresolved final punctuation that lies at the end of the line, before a space, before a prohibited break, or before an unresolved quotation mark, even after spaces.
    [ 'any × [ ( gc(Pf) & QU ) ( SP | GL | WJ | CL | QU | CP | EX | IS | SY | BK | CR | LF | NL | ZW | eot ) ]' ],
    // LB15c: Break before a decimal mark that follows a space, for instance, in ‘subtract .5’.
    [ 'SP ÷ [ IS NU ]' ],
    // LB15d: Otherwise, do not break before ‘;’, ‘,’, or ‘.’, even after spaces.
    [ 'any × IS' ],
    // LB16: Do not break between closing punctuation and a nonstarter (lb=NS), even with intervening spaces.
    [ '[ ( CL | CP ) * SP ] × NS' ],
    // LB17: Do not break within ‘——’, even with intervening spaces.
    [ '[ B2 * SP ] × B2' ],
    // LB18: Break after spaces.
    [ 'SP ÷ any'],
    // LB19: Do not break before non-initial unresolved quotation marks, such as ‘ ” ’ or ‘ " ’, nor after non-final unresolved quotation marks, such as ‘ “ ’ or ‘ " ’.
    [ 'any × ( QU - gc(Pi) )' ],
    [ '( QU - gc(Pf) ) × any' ],
    // LB19a: Unless surrounded by East Asian characters, do not break either side of any unresolved quotation marks.
    [ '^ eastasian × QU' ],
    [ 'any × [ QU ( ^ eastasian | eot ) ]' ],
    [ 'QU × ^ eastasian' ],
    [ '[ ( sot | ^ eastasian ) QU ] × any' ],
    // LB20: Break before and after unresolved CB.
    [ 'any ÷ CB' ],
    [ 'CB ÷ any' ],
    // LB20a: Do not break after a word-initial hyphen.
    [ '[ ( sot | BK | CR | LF | NL | SP | ZW | CB | GL ) ( HY | HH ) ] × ( AL | HL )' ],
    // LB21: Do not break before hyphen-minus, other hyphens, fixed-width spaces, small kana, and other non-starters, or after acute accents.
    [ 'any × ( BA | HH | HY | NS )' ],
    [ 'BB × any' ],
    // LB21a: Do not break after the hyphen in Hebrew + Hyphen + non-Hebrew.
    [ '[ HL ( HY | HH ) ] × ^ HL' ],
    // LB21b: Do not break between Solidus and Hebrew letters.
    [ 'SY × HL' ],
    // LB22: Do not break before ellipses.
    [ 'any × IN' ],
    // LB23: Do not break between digits and letters.
    [ '( AL | HL ) × NU' ],
    [ 'NU × ( AL | HL )' ],
    // LB23a: Do not break between numeric prefixes and ideographs, or between ideographs and numeric postfixes.
    [ 'PR × ( ID | EB | EM )' ],
    [ '( ID | EB | EM ) × PO' ],
    // LB24: Do not break between numeric prefix/postfix and letters, or between letters and prefix/postfix.
    [ '( PR | PO ) × ( AL | HL )' ],
    [ '( AL | HL ) × ( PR | PO )' ],
    // LB25: Do not break numbers
    [ '[ NU * ( SY | IS ) ( CL | CP ) ] × ( PO | PR )' ],
    [ '[ NU * ( SY | IS ) ] × ( PO | PR | NU )' ],
    [ '( PO | PR ) × [ OP NU ]' ],
    [ '( PO | PR ) × [ OP IS NU ]' ],
    [ '( PO | PR | HY | IS ) × NU' ],
    // LB26: Do not break a Korean syllable.
    [ 'JL × ( JL | JV | H2 | H3 )' ],
    [ '( JV | H2 ) × ( JV | JT )' ],
    [ '( JT | H3 ) × JT' ],
    // LB27: Treat a Korean Syllable Block the same as ID.
    [ '( JL | JV | JT | H2 | H3 ) × PO' ],
    [ 'PR × ( JL | JV | JT | H2 | H3 )' ],
    // LB28: Do not break between alphabetics (“at”).
    [ '( AL | HL ) × ( AL | HL )' ],
    // LB28a: Do not break inside the orthographic syllables of Brahmic scripts.
    [ 'AP × ( AK | \\u25CC | AS )' ],
    [ '( AK | \\u25CC | AS ) × ( VF | VI )' ],
    [ '[ ( AK | \\u25CC | AS ) VI ] × ( AK | \\u25CC )' ],
    [ '( AK | \\u25CC | AS ) × [ ( AK | \\u25CC | AS ) VF ]' ],
    // LB29: Do not break between numeric punctuation and alphabetics (“e.g.”).
    [ 'IS × ( AL | HL )' ],
    // LB30: Do not break between letters, numbers, or ordinary symbols and opening or closing parentheses.
    [ '( AL | HL | NU ) × ( OP - eastasian )' ],
    [ '( CP - eastasian ) × ( AL | HL | NU )' ],
    // LB30a: Break between two regional indicator symbols if and only if there are an even number of regional indicators preceding the position of the break.
    [ '[ sot * [ RI RI ] RI ] × RI' ],
    [ '[ ^ RI * [ RI RI ] RI ] × RI' ],
    // LB30b: Do not break between an emoji base (or potential emoji) and an emoji modifier.
    [ 'EB × EM' ],
    [ '( extpict & gc(Cn) ) × EM' ],
    // LB31: Break everywhere else.
    [ 'any ÷ any'],
]


/**
 * Line breaking rules for Unicode v16.0
 */
const lineBreakingRulesV16 = [
    // LB2: Never break at the start of text.
    [ 'sot × any' ],
    // LB3: Always break at the end of text.
    [ 'any ! eot' ],
    // LB4: Always break after hard line breaks.
    [ 'BK ! any' ],
    // LB5: Treat CR followed by LF, as well as CR, LF, and NL as hard line breaks.
    [ 'CR × LF' ],
    [ '( CR | LF | NL ) ! any' ],
    // LB6: Do not break before hard line breaks.
    [ 'any × ( BK | CR | LF | NL )' ],
    // LB7: Do not break before spaces or zero width space.
    [ 'any × ( SP | ZW )' ],
    // LB8: Break before any character following a zero-width space, even if one or more spaces intervene.
    [ '[ ZW * SP ] ÷ any' ],
    // LB8a: Do not break after a zero width joiner. 
    [ 'ZWJ × any' ],
    // LB9 and LB10 have a side effect that changes how CM and ZWJ characters are interpreted in subsequent rules.
    // The implementation of the side effect is mandated to the callback function cb passed as argument.
    // LB9: Do not break a combining character sequence; treat it as if it has the line breaking class of the base character in all of the following rules. Treat ZWJ as if it were CM.
    // Treat X (CM | ZWJ)* as if it were X
    // where X is any line break class except BK, CR, LF, NL, SP, or ZW.
    // In subsequent rules, any CM or ZWJ characters affected by this rule are ignored.
    // LB10: Treat any remaining CM or ZWJ as if it had the properties of U+0041 A LATIN CAPITAL LETTER A, that is, Line_Break=AL, General_Category=Lu, East_Asian_Width=Na, Extended_Pictographic=N.
    // This catches the case where a CM is the first character on the line or follows SP, BK, CR, LF, NL, or ZW.
    [ '^ ( sot | BK | CR | LF | NL | SP | ZW ) × ( CM | ZWJ )', function(cb, ...args) { cb(...args) }, 'std_remove_cm_sequences' ],
    // LB11: Do not break before or after Word joiner and related characters.
    [ 'any × WJ' ],
    [ 'WJ × any' ],
    // LB12: Do not break after NBSP and related characters.
    [ 'GL × any' ],
    // LB12a: Do not break before NBSP and related characters, except after spaces and hyphens.
    [ '^ ( SP | BA | HY ) × GL' ],
    // LB13: Do not break before ‘]’ or ‘!’ or ‘/’, even after spaces.
    [ 'any × ( CL | CP | EX | SY )' ],
    // LB14: Do not break after ‘[’, even after spaces.
    [ '[ OP * SP ] × any' ],
    // LB15a: Do not break after an unresolved initial punctuation that lies at the start of the line, after a space, after opening punctuation, or after an unresolved quotation mark, even after spaces.
    [ '[ ( sot | BK | CR | LF | NL | OP | QU | GL | SP | ZW ) ( gc(Pi) & QU ) * SP ] × any' ],
    // LB15b: Do not break before an unresolved final punctuation that lies at the end of the line, before a space, before a prohibited break, or before an unresolved quotation mark, even after spaces.
    [ 'any × [ ( gc(Pf) & QU ) ( SP | GL | WJ | CL | QU | CP | EX | IS | SY | BK | CR | LF | NL | ZW | eot ) ]' ],
    // LB15c: Break before a decimal mark that follows a space, for instance, in ‘subtract .5’.
    [ 'SP ÷ [ IS NU ]' ],
    // LB15d: Otherwise, do not break before ‘;’, ‘,’, or ‘.’, even after spaces.
    [ 'any × IS' ],
    // LB16: Do not break between closing punctuation and a nonstarter (lb=NS), even with intervening spaces.
    [ '[ ( CL | CP ) * SP ] × NS' ],
    // LB17: Do not break within ‘——’, even with intervening spaces.
    [ '[ B2 * SP ] × B2' ],
    // LB18: Break after spaces.
    [ 'SP ÷ any'],
    // LB19: Do not break before non-initial unresolved quotation marks, such as ‘ ” ’ or ‘ " ’, nor after non-final unresolved quotation marks, such as ‘ “ ’ or ‘ " ’.
    [ 'any × ( QU - gc(Pi) )' ],
    [ '( QU - gc(Pf) ) × any' ],
    // LB19a: Unless surrounded by East Asian characters, do not break either side of any unresolved quotation marks.
    [ '^ eastasian × QU' ],
    [ 'any × [ QU ( ^ eastasian | eot ) ]' ],
    [ 'QU × ^ eastasian' ],
    [ '[ ( sot | ^ eastasian ) QU ] × any' ],
    // LB20: Break before and after unresolved CB.
    [ 'any ÷ CB' ],
    [ 'CB ÷ any' ],
    // LB20a: Do not break after a word-initial hyphen.
    [ '[ ( sot | BK | CR | LF | NL | SP | ZW | CB | GL ) ( HY | \\u2010 ) ] × AL' ],
    // LB21: Do not break before hyphen-minus, other hyphens, fixed-width spaces, small kana, and other non-starters, or after acute accents.
    [ 'any × ( BA | HY | NS )' ],
    [ 'BB × any' ],
    // LB21a: Do not break after the hyphen in Hebrew + Hyphen + non-Hebrew.
    [ '[ HL ( HY | ( BA - eastasian ) ) ] × ^ HL' ],
    // LB21b: Do not break between Solidus and Hebrew letters.
    [ 'SY × HL' ],
    // LB22: Do not break before ellipses.
    [ 'any × IN' ],
    // LB23: Do not break between digits and letters.
    [ '( AL | HL ) × NU' ],
    [ 'NU × ( AL | HL )' ],
    // LB23a: Do not break between numeric prefixes and ideographs, or between ideographs and numeric postfixes.
    [ 'PR × ( ID | EB | EM )' ],
    [ '( ID | EB | EM ) × PO' ],
    // LB24: Do not break between numeric prefix/postfix and letters, or between letters and prefix/postfix.
    [ '( PR | PO ) × ( AL | HL )' ],
    [ '( AL | HL ) × ( PR | PO )' ],
    // LB25: Do not break numbers
    [ '[ NU * ( SY | IS ) ( CL | CP ) ] × ( PO | PR )' ],
    [ '[ NU * ( SY | IS ) ] × ( PO | PR | NU )' ],
    [ '( PO | PR ) × [ OP NU ]' ],
    [ '( PO | PR ) × [ OP IS NU ]' ],
    [ '( PO | PR | HY | IS ) × NU' ],
    // LB26: Do not break a Korean syllable.
    [ 'JL × ( JL | JV | H2 | H3 )' ],
    [ '( JV | H2 ) × ( JV | JT )' ],
    [ '( JT | H3 ) × JT' ],
    // LB27: Treat a Korean Syllable Block the same as ID.
    [ '( JL | JV | JT | H2 | H3 ) × PO' ],
    [ 'PR × ( JL | JV | JT | H2 | H3 )' ],
    // LB28: Do not break between alphabetics (“at”).
    [ '( AL | HL ) × ( AL | HL )' ],
    // LB28a: Do not break inside the orthographic syllables of Brahmic scripts.
    [ 'AP × ( AK | \\u25CC | AS )' ],
    [ '( AK | \\u25CC | AS ) × ( VF | VI )' ],
    [ '[ ( AK | \\u25CC | AS ) VI ] × ( AK | \\u25CC )' ],
    [ '( AK | \\u25CC | AS ) × [ ( AK | \\u25CC | AS ) VF ]' ],
    // LB29: Do not break between numeric punctuation and alphabetics (“e.g.”).
    [ 'IS × ( AL | HL )' ],
    // LB30: Do not break between letters, numbers, or ordinary symbols and opening or closing parentheses.
    [ '( AL | HL | NU ) × ( OP - eastasian )' ],
    [ '( CP - eastasian ) × ( AL | HL | NU )' ],
    // LB30a: Break between two regional indicator symbols if and only if there are an even number of regional indicators preceding the position of the break.
    [ '[ sot * [ RI RI ] RI ] × RI' ],
    [ '[ ^ RI * [ RI RI ] RI ] × RI' ],
    // LB30b: Do not break between an emoji base (or potential emoji) and an emoji modifier.
    [ 'EB × EM' ],
    [ '( extpict & gc(Cn) ) × EM' ],
    // LB31: Break everywhere else.
    [ 'any ÷ any'],
]


export {
    lineBreakingRulesV17 as default,
    lineBreakingRulesV16
}
