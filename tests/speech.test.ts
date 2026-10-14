import { describe, expect, it } from 'vitest'
import { appendDictation, readSpeechResults, speechError } from '../src/services/speech'

describe('voice transcript handling', () => {
  it('keeps partial recognition out of saved text and commits each final segment once', () => {
    const seen = new Set<number>()
    const partial = { length: 1, 0: { isFinal: false, 0: { transcript: 'Maybe learn' } } }
    expect(readSpeechResults(partial, seen)).toEqual({ finalized: '', interim: 'Maybe learn' })
    const final = {
      length: 2,
      0: { isFinal: true, 0: { transcript: 'Maybe learn pottery.' } },
      1: { isFinal: false, 0: { transcript: 'Also call' } },
    }
    expect(readSpeechResults(final, seen)).toEqual({
      finalized: 'Maybe learn pottery.',
      interim: 'Also call',
    })
    expect(readSpeechResults(final, seen).finalized).toBe('')
  })
  it('appends to typed text without losing the earlier draft', () => {
    expect(appendDictation('Remember the book', 'Call my friend.')).toBe(
      'Remember the book\nCall my friend.',
    )
    expect(appendDictation('', 'A thought.')).toBe('A thought.')
  })
  it('respects the capture limit', () => {
    expect(appendDictation('abcd', 'efgh', 6)).toBe('abcd\ne')
  })
  it('provides actionable permission and connectivity errors', () => {
    expect(speechError('not-allowed')).toContain('browser settings')
    expect(speechError('network')).toContain('connection')
    expect(speechError('unexpected')).toContain('draft is safe')
  })
})
