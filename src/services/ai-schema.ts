import { z } from 'zod'
export const aiResultSchema = z
  .object({
    summary: z.string().max(2000),
    clarifying_question: z.string().max(500).nullable(),
    suggestions: z
      .array(
        z
          .object({
            kind: z.enum(['idea', 'goal', 'project', 'task', 'resource', 'phase', 'reflection']),
            title: z.string().min(1).max(500),
            detail: z.string().max(3000),
            reason: z.string().max(1000),
          })
          .strict(),
      )
      .max(8),
  })
  .strict()
