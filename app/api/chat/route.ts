import { StreamingTextResponse } from 'ai'
import { Configuration, OpenAIApi } from 'openai-edge'

import { auth } from '@/auth'

import { OpenAIStream } from '@/lib/openai-stream'

export const runtime = 'edge'

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
})

const openai = new OpenAIApi(configuration)

export async function POST(req: Request) {
  const json = await req.json()
  const { messages, previewToken } = json
  const userId = (await auth())?.user.id

  if (!userId) {
    return new Response('Unauthorized', {
      status: 401
    })
  }

  if (previewToken) {
    configuration.apiKey = previewToken
  }

  const payload = {
    model: 'gpt-3.5-turbo',
    messages,
    temperature: 0.7,
    stream: true
  }

  const stream = await OpenAIStream(payload, userId, json.id)

  return new StreamingTextResponse(stream)
}
