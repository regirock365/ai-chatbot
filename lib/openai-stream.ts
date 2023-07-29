import { kv } from '@vercel/kv'

import { nanoid } from '@/lib/utils'

export interface OpenAIStreamPayload {
  messages: { role: string; content: string }[]
  model: string
  prompt?: string
  temperature?: number
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
  max_tokens?: number
  stream?: boolean
  n?: number
}

export async function OpenAIStream(
  payload: OpenAIStreamPayload,
  userId: string,
  chatId?: string
) {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  let counter = 0
  let fullText = ''

  const res = await fetch(process.env.BACKEND_URL || 'http://localhost:3000', {
    headers: {
      'Content-Type': 'application/json'
      //   Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ''}`
    },
    method: 'POST',
    body: JSON.stringify(payload)
  })

  console.log('res we got', Object.keys(res))

  const stream = new ReadableStream({
    async start(controller) {
      console.log('we have started...')

      // https://web.dev/streams/#asynchronous-iteration
      for await (const chunk of res.body as any) {
        // // console.log('chunk we got...', chunk, decoder.decode(chunk))
        // parser.feed(decoder.decode(chunk))

        const data = decoder.decode(chunk)
        // console.log('data we got', data)
        // https://beta.openai.com/docs/api-reference/completions/create#completions/create-stream
        if (data === '[DONE]') {
          //   console.log("ce'st finit")

          //   Save the message in history
          const title = payload.messages[0].content.substring(0, 100)
          const id = chatId ?? nanoid()
          const createdAt = Date.now()
          const path = `/chat/${id}`
          const temp_payload = {
            id,
            title,
            userId,
            createdAt,
            path,
            messages: [
              ...payload.messages,
              {
                content: fullText,
                role: 'assistant'
              }
            ]
          }
          await kv.hmset(`chat:${id}`, temp_payload)
          await kv.zadd(`user:chat:${userId}`, {
            score: createdAt,
            member: `chat:${id}`
          })

          controller.close()
          return
        }
        try {
          const text = data
          if (counter < 2 && (text.match(/\n/) || []).length) {
            // this is a prefix character (i.e., "\n\n"), do nothing
            return
          }
          fullText += text
          const queue = encoder.encode(text)
          controller.enqueue(queue)
          counter++
        } catch (e) {
          // maybe parse error
          controller.error(e)
        }
      }
    }
  })

  return stream
}
