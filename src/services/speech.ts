export interface SpeechResult {
  isFinal: boolean
  0: { transcript: string }
}
export interface SpeechResults {
  length: number
  [index: number]: SpeechResult
}
export interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onstart: (() => void) | null
  onend: (() => void) | null
  onresult: ((event: { results: SpeechResults }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  start(): void
  stop(): void
  abort(): void
}
export type RecognitionConstructor = new () => Recognition
export function recognitionConstructor(): RecognitionConstructor | undefined {
  const browser = window as typeof window & {
    SpeechRecognition?: RecognitionConstructor
    webkitSpeechRecognition?: RecognitionConstructor
  }
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition
}
export function readSpeechResults(results: SpeechResults, seen: Set<number>) {
  const finalized: string[] = []
  const interim: string[] = []
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.isFinal) {
      if (!seen.has(i)) {
        seen.add(i)
        finalized.push(result[0].transcript.trim())
      }
    } else interim.push(result[0].transcript.trim())
  }
  return {
    finalized: finalized.filter(Boolean).join(' '),
    interim: interim.filter(Boolean).join(' '),
  }
}
export function appendDictation(text: string, transcript: string, limit = 20000) {
  return `${text}${text && !/\s$/.test(text) ? '\n' : ''}${transcript}`.slice(0, limit)
}
export function speechError(error: string) {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone or speech access was denied. Allow it in your browser settings, or keep typing.'
    case 'audio-capture':
      return 'No microphone is available. Check your microphone connection or keep typing.'
    case 'no-speech':
      return 'No speech was heard. Your draft is safe. Try again when you’re ready.'
    case 'network':
      return 'The speech service could not connect. Check your connection or keep typing.'
    case 'language-not-supported':
      return 'This speech service does not support that language. Try another language or keep typing.'
    case 'aborted':
      return 'Voice capture stopped. Your written draft is safe.'
    default:
      return 'Voice capture could not continue. Your draft is safe; you can keep typing.'
  }
}
