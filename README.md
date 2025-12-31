An implementation of the Unicode Line Breaking Algorithm. It uses the rules and data of Unicode v17.0 by default, but can be adapted for other versions (the repository contains the rules and data of versions 16 and 17 ready for use). It passes all the tests provided by Unicode for the versions 16 and 17.

Basic usage:
```javascript
import { BreakType, makeLBC } from './dist/src/linebreakingchecker.js'
const lbc = await makeLBC()
lbc.setText('Hello, breaker')
for (const segment of lbc) {
  console.log(segment)
}
// Object { index: 7, breakType: 4, text: "Hello, " }
// Object { index: 14, breakType: 2, text: "breaker" }
```

Break types are:
```javascript
BreakType = {
  UNKNOWN: 0
  FORBIDDEN: 1
  MANDATORY: 2
  ALLOWED: 4
}
```

It can be used in conjunction with Intl.Segmenter:
```javascript
import { BreakType, makeLBC } from './dist/src/linebreakingchecker.js'
const text = 'Hello, breaker'
const lbc = await makeLBC()
lbc.setText(text)
const segmenter = new Intl.Segmenter("en", { granularity: "word" })
const segments = segmenter.segment(text)
for (const segment of segments) {
  const breakType = lbc.isPosLineBreaking(segment.index)
  if ((breakType & (BreakType.MANDATORY|BreakType.ALLOWED)) !== 0) {
    console.log(`Can break line at index ${segmenter.index}`)
  }
}
// Can break line at index 7
```
