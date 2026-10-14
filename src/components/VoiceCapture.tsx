import { Mic, Square } from 'lucide-react'
import { Field } from './ui'
import type { useDictation } from '../state/useDictation'

export function VoiceCapture({
  voice,
  language,
  onLanguage,
  disabled,
}: {
  voice: ReturnType<typeof useDictation>
  language: string
  onLanguage(value: string): void
  disabled: boolean
}) {
  if (!voice.supported)
    return (
      <p className="voice-fallback">
        Voice capture isn’t available in this browser. You can type here or use your device’s
        keyboard dictation.
      </p>
    )
  return (
    <div className="voice-capture">
      <div className="voice-controls">
        <button
          type="button"
          className={`button secondary ${voice.active ? 'voice-active' : ''}`}
          disabled={(disabled && !voice.active) || voice.status === 'stopping'}
          onClick={() => (voice.active ? voice.stop() : voice.start(language))}
        >
          {voice.active ? <Square size={15} /> : <Mic size={16} />}
          {voice.status === 'starting'
            ? 'Cancel microphone request'
            : voice.status === 'stopping'
              ? 'Finishing transcript…'
              : voice.active
                ? 'Stop listening'
                : 'Speak your thoughts'}
        </button>
        <Field label="Speech language">
          <select
            value={language}
            disabled={voice.active || disabled}
            onChange={(e) => onLanguage(e.target.value)}
          >
            <option value="en-IN">English · India</option>
            <option value="en-US">English · US</option>
            <option value="en-GB">English · UK</option>
            <option value="hi-IN">Hindi</option>
            <option value="ta-IN">Tamil</option>
            <option value="te-IN">Telugu</option>
          </select>
        </Field>
      </div>
      <p className="voice-status" role="status">
        {voice.status === 'listening'
          ? 'Listening. Say what’s on your mind; you can edit it after stopping.'
          : voice.status === 'starting'
            ? 'Waiting for microphone access…'
            : voice.status === 'stopping'
              ? 'Waiting for the final words…'
              : 'Speak freely, then stop and review. Nothing is captured automatically.'}
      </p>
      <p className="small muted mt-2">
        Uses your browser’s speech service; audio may be processed online.
      </p>
      {voice.interim && (
        <p className="voice-interim" aria-label="Words still being transcribed">
          {voice.interim}
        </p>
      )}
      {voice.error && (
        <p className="inline-error" role="alert">
          {voice.error}
        </p>
      )}
      <details className="voice-privacy">
        <summary>How voice capture works</summary>
        <p>
          Your browser’s speech service may send audio to its provider to transcribe it. Focus
          doesn’t save audio or send it to Groq. Final words are added to your draft on this device;
          saving a capture syncs the text if you’re signed in. Availability and language support
          depend on your browser and speech service.
        </p>
      </details>
    </div>
  )
}
