# Focus: attention-friendly design

Reviewed 14 October 2026. Focus is an everyday execution aid, not a diagnostic tool or a clinically validated ADHD treatment. ADHD experiences vary; users keep access to the full workspace and can choose their own pace.

## Evidence and its limits

- [NICE NG87: environmental modifications](https://www.nice.org.uk/guidance/ng87/chapter/recommendations) recommends reducing distractions, using written instructions, and adapting focus periods with movement breaks. Focus translates this into a quieter Today view, a visible next step, optional short sessions, and a break invitation. This is a product interpretation of guidance, not evidence that our interface treats symptoms.
- [Solanto et al., 2010: randomized trial of meta-cognitive therapy](https://pmc.ncbi.nlm.nih.gov/articles/PMC3633586/) evaluated a therapist-led program targeting organization, planning, and time management in adults with ADHD. It supports the relevance of those skills; it does not establish efficacy of this app or isolate our individual features.
- [Gollwitzer & Sheeran, 2006: implementation intentions meta-analysis](<https://doi.org/10.1016/S0065-2601(06)38002-1>) supports specifying when, where, and how to act across varied populations. Focus offers an optional “When I begin, I will…” first step. This prompt is a lightweight action cue, not the full intervention, and the evidence is not specific to adult ADHD.
- [2021 time-management CBT pilot](https://pubmed.ncbi.nlm.nih.gov/33472510/) studied a small adult ADHD sample. This informs transparent time estimates and actual-time tracking, with uncertainty retained rather than prescriptive schedules.

## Implemented design decisions

1. Today opens with one explicitly chosen action. Capacity totals, unfinished-work lists, and reviews live behind “See my day.” No tasks are silently selected.
2. Users can choose Today or Later from a finite batch of at most five eligible actions. Buttons, keyboard navigation, and swipe gestures coexist. A user can stop immediately; there is no requirement to clear the deck.
3. Later means leave unchosen. It does not move deadlines, activate goals, archive work, or reschedule existing commitments. Deck choices have a targeted undo.
4. No unread Inbox badges on navigation. Capture remains available without demanding immediate classification.
5. A five-minute session is an optional starting point. Five minutes is a design default, not a scientifically established optimum. Users can choose other durations; timer completion never completes a task.
6. The saved first step reduces the need to reconstruct context on return. Optional estimates and session outcomes remain editable.
7. No automatic popup on every visit, streaks, productivity scores, rewards for swiping, endless card feeds, or clinical claims.

## What needs user validation

The card deck and progressive disclosure are usability hypotheses. Evaluate with consenting users with different attention needs: can they identify a next step, start it, undo choices, and find the full plan? Ask whether the interface feels calmer and whether swiping causes accidental decisions. Do not infer mental health or productivity improvement from time spent in the app. No behavioral analytics or health data collection is added.
