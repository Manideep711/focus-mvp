import { useEffect, useRef, useState } from 'react'
import {
  recognitionConstructor,
  readSpeechResults,
  speechError,
  type Recognition,
} from '../services/speech'

export function useDictation(onTranscript: (text: string) => void) {
  const [status, setStatus] = useState<'idle' | 'starting' | 'listening' | 'stopping'>('idle')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')
  const instance = useRef<Recognition | null>(null)
  const callback = useRef(onTranscript)
  callback.current = onTranscript
  const supported = !!recognitionConstructor() && window.isSecureContext
  function release(recognition: Recognition) {
    recognition.onstart = null
    recognition.onend = null
    recognition.onerror = null
    recognition.onresult = null
    try {
      recognition.abort()
    } catch {
      /* Already ended by the browser. */
    }
  }
  function stop() {
    if (!instance.current) return
    setStatus('stopping')
    try {
      instance.current.stop()
    } catch {
      release(instance.current)
      instance.current = null
      setStatus('idle')
      setInterim('')
      setError('Voice capture stopped. Review your draft before saving.')
    }
  }
  function start(language: string) {
    const Constructor = recognitionConstructor()
    if (!Constructor || !supported || instance.current) return
    const recognition = new Constructor()
    const seen = new Set<number>()
    instance.current = recognition
    recognition.lang = language
    recognition.continuous = true
    recognition.interimResults = true
    setStatus('starting')
    setError('')
    setInterim('')
    recognition.onstart = () => setStatus('listening')
    recognition.onresult = ({ results }) => {
      const result = readSpeechResults(results, seen)
      if (result.finalized) callback.current(result.finalized)
      setInterim(result.interim)
    }
    recognition.onerror = ({ error }) => {
      setError(speechError(error))
      release(recognition)
      instance.current = null
      setStatus('idle')
      setInterim('')
    }
    recognition.onend = () => {
      instance.current = null
      setStatus('idle')
      setInterim('')
      recognition.onstart = null
      recognition.onend = null
      recognition.onerror = null
      recognition.onresult = null
    }
    try {
      recognition.start()
    } catch {
      release(recognition)
      instance.current = null
      setStatus('idle')
      setError('Your browser could not start voice capture. Try again or keep typing.')
    }
  }
  useEffect(() => {
    const onHidden = () => {
      if (document.hidden) stop()
    }
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      if (instance.current) {
        release(instance.current)
        instance.current = null
      }
    }
  }, [])
  return { supported, status, active: status !== 'idle', interim, error, start, stop }
}
