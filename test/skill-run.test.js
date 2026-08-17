import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'

import { apply } from '../lib/index.js'

function request(body) {
  const req = new EventEmitter()
  req.socket = { remoteAddress: '127.0.0.1' }
  queueMicrotask(() => {
    req.emit('data', JSON.stringify(body))
    req.emit('end')
  })
  return req
}

function response() {
  let resolve
  const done = new Promise((r) => { resolve = r })
  return {
    done,
    writeHead(status) { this.status = status },
    end(body) { resolve({ status: this.status, body: JSON.parse(body) }) },
  }
}

test('skill route uses the native user invocation gesture', async () => {
  const calls = []
  const compositionCalls = []
  const events = []
  const agent = {
    options: { provider: 'test', model: 'test-model' },
    ctx: { marker: 'legacy-agent-context' },
    session: {
      header: { cwd: '/workspace' },
      events: [],
      append(type, data) { compositionCalls.push(['append', type, data]) },
    },
    status: 'idle',
    followup(message) {
      calls.push(['followup', message])
      events.push({
        type: 'assistant/message',
        time: Date.now(),
        data: { message: { content: [{ type: 'text', text: 'skill result' }] } },
      })
    },
    whenIdle() { return Promise.resolve() },
  }
  const routes = []
  const services = {
    sessionQuery: {
      readSurface: async () => ({ events }),
      listSessions: async () => [],
      readTitle: async () => ({ title: '' }),
    },
    agentLoop: {},
    agents: { get: () => agent, list: () => [agent] },
    skills: {
      list: async () => [{ name: 'demo-skill', description: 'demo' }],
    },
    tools: { get: (name) => name === 'skill' ? {} : undefined },
    agentPresets: {
      composedPreset: () => compositionCalls.some(([kind]) => kind === 'mount') ? 'full-tools' : undefined,
      mount: async (agentCtx, id) => {
        compositionCalls.push(['mount', agentCtx, id])
        return { id: 'full-tools' }
      },
    },
  }
  const ctx = {
    get: (name) => services[name],
    on: () => {},
    effect: () => {},
    webServer: { register(route) { routes.push(route); return () => {} } },
  }
  services.webServer = ctx.webServer
  apply(ctx)

  const route = routes.find((item) => item.path === '/api/dsh-session-canvas/skill')
  assert.ok(route)
  const res = response()
  route.handler(request({ sessionId: 'session-1', name: 'demo-skill' }), res)
  const result = await res.done

  assert.equal(result.status, 200)
  assert.equal(result.body.ok, true)
  assert.equal(result.body.reply, 'skill result')
  assert.deepEqual(calls.map(([kind]) => kind), ['followup'])
  assert.equal(calls[0][1].content[0].text, '/demo-skill')
  assert.equal(calls[0][1].source.kind, 'user')
  assert.deepEqual(compositionCalls, [
    ['mount', agent.ctx, undefined],
    ['append', 'agent-preset/selected', { agentPreset: 'full-tools' }],
  ])

  calls.length = 0
  const taskedResponse = response()
  route.handler(request({
    sessionId: 'session-1',
    name: 'demo-skill',
    text: 'summarize the selected sessions',
  }), taskedResponse)
  const taskedResult = await taskedResponse.done
  assert.equal(taskedResult.status, 200)
  assert.equal(calls[0][1].content[0].text, '/demo-skill summarize the selected sessions')
})

test('new canvas sessions mount and record the default agent preset', async () => {
  const routes = []
  const creations = []
  const mounts = []
  const services = {
    sessionQuery: {
      listSessions: async () => [],
    },
    agentLoop: {
      createAgent: async (_ctx, options) => { creations.push(options) },
    },
    agentPresets: {
      resolve: async (id) => {
        assert.equal(id, undefined)
        return { id: 'full-tools' }
      },
      mount: async (agentCtx, id) => {
        mounts.push([agentCtx, id])
        return { id }
      },
    },
  }
  const ctx = {
    get: (name) => services[name],
    on: () => {},
    effect: () => {},
    webServer: { register(route) { routes.push(route); return () => {} } },
  }
  services.webServer = ctx.webServer
  apply(ctx)

  const route = routes.find((item) => item.path === '/api/dsh-session-canvas/new-session')
  const res = response()
  route.handler(request({ cwd: '/workspace' }), res)
  const result = await res.done

  assert.equal(result.status, 200)
  assert.equal(result.body.ok, true)
  assert.equal(creations.length, 1)
  assert.deepEqual(creations[0].meta, { cwd: '/workspace', agentPreset: 'full-tools' })
  assert.equal(typeof creations[0].setup, 'function')
  const agentCtx = { marker: 'agent-context' }
  await creations[0].setup(agentCtx)
  assert.deepEqual(mounts, [[agentCtx, 'full-tools']])
})
