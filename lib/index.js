// @linxin666/dsh-session-canvas — host half
// HTTP API for the session canvas UI:
//   GET  /api/dsh-session-canvas/context    current workspace context
//   GET  /api/dsh-session-canvas/workspaces list workspaces
//   GET  /api/dsh-session-canvas/sessions   list sessions (optionally filtered by cwd)
//   GET  /api/dsh-session-canvas/read       read one session transcript (?id=)
//   POST /api/dsh-session-canvas/chat       send a message into a session and wait for the reply
//   POST /api/dsh-session-canvas/inject     inject source-session content into a target session context
//   POST /api/dsh-session-canvas/create     create a summary session from selected sessions
const API = {
  context: '/api/dsh-session-canvas/context',
  workspaces: '/api/dsh-session-canvas/workspaces',
  sessions: '/api/dsh-session-canvas/sessions',
  read: '/api/dsh-session-canvas/read',
  chat: '/api/dsh-session-canvas/chat',
  inject: '/api/dsh-session-canvas/inject',
  create: '/api/dsh-session-canvas/create',
  newSession: '/api/dsh-session-canvas/new-session',
}

const CHAT_TIMEOUT = 150000

function writeJson(res, status, data) {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
    })
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch (e) {
        resolve({})
      }
    })
    req.on('error', () => resolve({}))
  })
}

function isLocal(req) {
  const addr = req.socket && req.socket.remoteAddress
  if (!addr) return true
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1'
}

function textOfContent(blocks) {
  if (!Array.isArray(blocks)) return ''
  const out = []
  for (const b of blocks) {
    if (b && b.type === 'text' && typeof b.text === 'string') out.push(b.text)
  }
  return out.join('\n')
}

function truncate(s, max) {
  if (typeof s !== 'string') return ''
  return s.length <= max ? s : s.slice(0, max) + '…'
}

function makeUserMessage(text, source) {
  return {
    id: 'canvas-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
    role: 'user',
    content: [{ type: 'text', text: text }],
    source: source || { kind: 'user' },
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms)
    promise.then((value) => {
      clearTimeout(timer)
      resolve(value)
    }, () => {
      clearTimeout(timer)
      resolve(null)
    })
  })
}

export const name = 'session-canvas'

export const inject = ['webServer']

export function apply(ctx) {
  const sessionQuery = ctx.get('sessionQuery')
  const agentLoop = ctx.get('agentLoop')
  const agents = ctx.get('agents')
  const workspaceRegistry = ctx.get('workspaceRegistry')
  const commandsSvc = ctx.get('commands')
  const skillsSvc = ctx.get('skills')
  const toolsSvc = ctx.get('tools')
  const agentPresets = ctx.get('agentPresets')
  if (sessionQuery === undefined || agentLoop === undefined) return

  // An agent for command operations: prefer the target session's live agent,
  // otherwise any live agent.
  async function commandAgent(sessionId) {
    if (agents) {
      if (sessionId) {
        const a = await ensureLiveAgent(sessionId)
        if (a) return a
      }
      const list = agents.list()
      if (Array.isArray(list) && list.length) return list[0]
    }
    return undefined
  }

  async function readMessages(sessionId, limit, perMsg) {
    const surf = await sessionQuery.readSurface(sessionId)
    const events = Array.isArray(surf && surf.events) ? surf.events : []
    const start = Math.max(0, events.length - (limit || 60))
    const messages = []
    const push = (role, text, time, src) => {
      if (!text) return
      messages.push({ role: role, text: perMsg ? truncate(text, perMsg) : text, time: time, src: src })
    }
    for (let i = start; i < events.length; i++) {
      const ev = events[i]
      if (!ev || typeof ev !== 'object') continue
      const type = ev.type
      if (type === 'user/message' && ev.data && Array.isArray(ev.data.content)) {
        const src = (ev.data.source && ev.data.source.kind) || 'user'
        push('user', textOfContent(ev.data.content), ev.time, src)
      } else if (type === 'assistant/message' && ev.data && ev.data.message && Array.isArray(ev.data.message.content)) {
        push('assistant', textOfContent(ev.data.message.content), ev.time, 'assistant')
      } else if (type === 'tool/result' && ev.data && ev.data.message && Array.isArray(ev.data.message.content)) {
        push('tool', textOfContent(ev.data.message.content), ev.time, 'tool')
      }
    }
    return messages
  }

  async function readTitle(id) {
    try {
      const t = await sessionQuery.readTitle(id)
      if (t && typeof t.title === 'string') return t.title
    } catch (e) { /* ignore */ }
    return ''
  }

  async function defaultCwd() {
    try {
      const records = await sessionQuery.listSessions()
      for (const r of records) {
        const h = r && r.header
        if (h && typeof h.cwd === 'string' && h.cwd) return h.cwd
      }
    } catch (e) { /* ignore */ }
    return undefined
  }

  // Attach a newly created session to the workspace matching its cwd, so the
  // main UI groups it under that workspace instead of "未分组".
  // Best effort: the workspaceRegistry service is not visible from this
  // plugin's ctx on this deployment, so this is a no-op fallback; the client
  // also tries workspaces.insertSessionBefore via the api proxy.
  async function attachToWorkspace(sessionId, cwd) {
    if (!workspaceRegistry || !cwd) return
    try {
      const ws = await workspaceRegistry.resolveByPath(cwd)
      if (ws && typeof ws.attachSession === 'function') {
        await ws.attachSession(sessionId)
      }
    } catch (e) { /* ignore */ }
  }

  // Model config for agents this plugin creates. Without provider/model the
  // agent's prompt assembly fails (persona {{model}} variable has no value),
  // so we must inherit the deployment's default selection.
  const agentDefaultModel = ctx.get('agentDefaultModel')
  function defaultAgentOptions() {
    try {
      if (agentDefaultModel && typeof agentDefaultModel.currentSelection === 'function') {
        const sel = agentDefaultModel.currentSelection()
        if (sel && typeof sel.provider === 'string' && typeof sel.model === 'string') {
          const opts = { provider: sel.provider, model: sel.model }
          if (typeof sel.reasoningEffort === 'string') opts.reasoningEffort = sel.reasoningEffort
          return opts
        }
      }
    } catch (e) { /* ignore */ }
    // fallback: copy a live agent's options
    if (agents) {
      try {
        const list = agents.list()
        if (Array.isArray(list)) {
          for (const a of list) {
            const o = a && a.options
            if (o && typeof o.provider === 'string' && typeof o.model === 'string') {
              return { provider: o.provider, model: o.model }
            }
          }
        }
      } catch (e) { /* ignore */ }
    }
    return {}
  }

  // Resolve the preset a session actually runs. New sessions use the current
  // default; resumed sessions preserve their header or latest logged switch.
  function selectedAgentPreset(session) {
    const header = session && session.header ? session.header : session && session.session ? session.session : {}
    const events = session && Array.isArray(session.events) ? session.events : []
    for (let i = events.length - 1; i >= 0; i--) {
      const event = events[i]
      if (event && event.type === 'agent-preset/selected' && event.data && typeof event.data.agentPreset === 'string') {
        return event.data.agentPreset
      }
    }
    return header && typeof header.agentPreset === 'string' ? header.agentPreset : undefined
  }

  async function agentComposition(presetId) {
    if (!agentPresets) return {}
    const preset = await agentPresets.resolve(presetId)
    return {
      agentPreset: preset.id,
      setup: async (agentCtx) => {
        await agentPresets.mount(agentCtx, preset.id)
      },
    }
  }

  // Older canvas versions published agents without a preset. Repair a live
  // one lazily so existing cards gain the same tools as normal DSH sessions.
  async function ensureAgentComposition(agent) {
    if (!agentPresets || !agent) return
    if (typeof agentPresets.composedPreset === 'function' && agentPresets.composedPreset(agent.ctx) !== undefined) return
    if (agent.status !== 'idle' && typeof agent.whenIdle === 'function') await agent.whenIdle()
    const storedPreset = selectedAgentPreset(agent.session)
    const preset = await agentPresets.mount(agent.ctx, storedPreset)
    if (storedPreset === undefined && agent.session && typeof agent.session.append === 'function') {
      agent.session.append('agent-preset/selected', { agentPreset: preset.id })
    }
  }

  // Get the live agent for a session, resuming it from persistence if needed
  // (DSH restarts leave sessions archived; resume also repairs missing model
  // config for sessions created by older plugin versions).
  async function ensureLiveAgent(sessionId) {
    if (agents) {
      const live = agents.get(sessionId)
      if (live) {
        try {
          await ensureAgentComposition(live)
          return live
        } catch (e) {
          agentErrors[sessionId] = String((e && e.message) || e)
          return undefined
        }
      }
    }
    try {
      let presetId
      try {
        const stored = await sessionQuery.readSession(sessionId)
        presetId = selectedAgentPreset(stored)
      } catch (e) { /* resume will report the authoritative failure */ }
      const composition = await agentComposition(presetId)
      await agentLoop.resume(ctx, {
        resumeSessionId: sessionId,
        agentOptions: defaultAgentOptions(),
        setup: composition.setup,
      })
    } catch (e) {
      return undefined
    }
    return agents ? agents.get(sessionId) : undefined
  }

  // recent agent errors for diagnostics
  const agentErrors = {}
  if (agents) {
    ctx.on('agent/error', (payload) => {
      try {
        const id = payload && payload.agent && payload.agent.id
        if (id) {
          agentErrors[id] = String((payload && payload.error && payload.error.message) || payload.error || 'unknown')
        }
      } catch (e) { /* ignore */ }
    })
  }

  async function listSessions(cwdFilter) {
    const records = await sessionQuery.listSessions()
    const ids = []
    for (const r of records) {
      const h = r && r.header
      if (h && typeof h.id === 'string') ids.push(h.id)
    }
    let titles = []
    try {
      const obs = await sessionQuery.readTitleSnapshots(ids)
      if (Array.isArray(obs)) titles = obs
    } catch (e) { /* ignore */ }
    const titleMap = {}
    const activeMap = {}
    for (const o of titles) {
      if (!o || !o.sessionId) continue
      if (o.status === 'fulfilled' && o.value) {
        if (o.value.title && typeof o.value.title.title === 'string') titleMap[o.sessionId] = o.value.title.title
        if (o.value.title && typeof o.value.title.updatedAt === 'number') activeMap[o.sessionId] = o.value.title.updatedAt
      }
    }
    const out = []
    for (const r of records) {
      const h = r.header || {}
      if (typeof h.id !== 'string') continue
      const cwd = typeof h.cwd === 'string' ? h.cwd : ''
      if (cwdFilter && !cwd.startsWith(cwdFilter)) continue
      const createdAt = typeof h.createdAt === 'number' ? h.createdAt : 0
      out.push({
        id: h.id,
        title: titleMap[h.id] || '',
        createdAt: createdAt,
        lastActive: activeMap[h.id] || createdAt,
        live: !!r.live,
        persisted: !!r.persisted,
        cwd: cwd,
      })
    }
    return out
  }

  const routes = [
    // ---------------------------------------------------------- context
    {
      kind: 'exact',
      path: API.context,
      handler: async (req, res) => {
        if (!isLocal(req)) return writeJson(res, 403, { error: 'forbidden' })
        let cwd = ''
        try {
          const records = await sessionQuery.listSessions()
          for (const r of records) {
            const h = r && r.header
            if (h && typeof h.cwd === 'string' && h.cwd) { cwd = h.cwd; break }
          }
        } catch (e) { /* ignore */ }
        let workspaceId = cwd || 'default'
        if (workspaceRegistry && cwd) {
          try {
            const ws = await workspaceRegistry.resolveByPath(cwd)
            if (ws && typeof ws.id === 'string' && ws.id) workspaceId = ws.id
          } catch (e) { /* ignore */ }
        }
        writeJson(res, 200, { workspaceId: workspaceId, cwd: cwd })
      },
    },
    // -------------------------------------------------------- workspaces
    {
      kind: 'exact',
      path: API.workspaces,
      handler: async (req, res) => {
        if (!isLocal(req)) return writeJson(res, 403, { error: 'forbidden' })
        // Derive workspaces from session cwd values (workspaceRegistry may be
        // absent or empty; session headers are the reliable source).
        const cwdSet = new Set()
        try {
          const records = await sessionQuery.listSessions()
          for (const r of records) {
            const h = r && r.header
            if (h && typeof h.cwd === 'string' && h.cwd) cwdSet.add(h.cwd)
          }
        } catch (e) { /* ignore */ }
        const out = []
        for (const cwd of cwdSet) {
          const parts = String(cwd).split('/').filter(Boolean)
          out.push({ id: cwd, path: cwd, title: parts.length ? parts[parts.length - 1] : cwd })
        }
        writeJson(res, 200, { workspaces: out })
      },
    },
    // --------------------------------------------------------- sessions
    {
      kind: 'exact',
      path: API.sessions,
      handler: async (req, res) => {
        if (!isLocal(req)) return writeJson(res, 403, { error: 'forbidden' })
        const url = new URL(req.url || '/', 'http://localhost')
        const cwd = url.searchParams.get('cwd') || ''
        try {
          const out = await listSessions(cwd || undefined)
          writeJson(res, 200, { sessions: out })
        } catch (e) {
          writeJson(res, 500, { error: String((e && e.message) || e) })
        }
      },
    },
    // ------------------------------------------------------------- read
    {
      kind: 'exact',
      path: API.read,
      handler: async (req, res) => {
        if (!isLocal(req)) return writeJson(res, 403, { error: 'forbidden' })
        const url = new URL(req.url || '/', 'http://localhost')
        const id = url.searchParams.get('id') || ''
        if (!id) return writeJson(res, 400, { error: 'missing id' })
        let messages = []
        let error = ''
        try {
          messages = await readMessages(id, 60, 700)
        } catch (e) {
          error = String((e && e.message) || e)
        }
        const title = await readTitle(id)
        writeJson(res, 200, { id: id, title: title, messages: messages, error: error })
      },
    },
    // -------------------------------------------------------------- chat
    {
      kind: 'exact',
      path: API.chat,
      handler: async (req, res) => {
        if (!isLocal(req)) return writeJson(res, 403, { error: 'forbidden' })
        const body = await readBody(req)
        const sessionId = body && typeof body.sessionId === 'string' ? body.sessionId : ''
        const text = body && typeof body.text === 'string' ? body.text : ''
        if (!sessionId || !text.trim()) return writeJson(res, 400, { error: 'missing sessionId or text' })
        if (!agents) return writeJson(res, 500, { error: 'agents service unavailable' })
        const agent = await ensureLiveAgent(sessionId)
        if (!agent) {
          return writeJson(res, 409, { error: '无法恢复该会话，请先在主界面打开它', code: 'not-running' })
        }
        const agentOpts = agent.options || {}
        if (typeof agentOpts.provider !== 'string' || typeof agentOpts.model !== 'string') {
          return writeJson(res, 409, {
            error: '该会话缺少模型配置（由旧版本创建），请删除该卡片后重新创建',
            code: 'no-model',
          })
        }
        try {
          agent.followup(makeUserMessage(text, { kind: 'user' }))
          await withTimeout(agent.whenIdle(), CHAT_TIMEOUT)
          const messages = await readMessages(sessionId, 8)
          const replies = messages.filter((m) => m.role === 'assistant')
          writeJson(res, 200, {
            ok: true,
            reply: replies.length ? replies[replies.length - 1].text : '',
            agentStatus: agent.status || '',
            agentError: agentErrors[sessionId] || '',
          })
        } catch (e) {
          writeJson(res, 500, { error: String((e && e.message) || e) })
        }
      },
    },
    // ------------------------------------------------------------ inject
    {
      kind: 'exact',
      path: API.inject,
      handler: async (req, res) => {
        if (!isLocal(req)) return writeJson(res, 403, { error: 'forbidden' })
        const body = await readBody(req)
        const targetId = body && typeof body.targetId === 'string' ? body.targetId : ''
        const sourceIds = Array.isArray(body && body.sourceIds)
          ? body.sourceIds.filter((x) => typeof x === 'string')
          : []
        if (!targetId || !sourceIds.length) return writeJson(res, 400, { error: 'missing targetId or sourceIds' })
        if (!agents) return writeJson(res, 500, { error: 'agents service unavailable' })
        const agent = await ensureLiveAgent(targetId)
        if (!agent) {
          return writeJson(res, 409, { error: '无法恢复目标会话，请先在主界面打开它', code: 'not-running' })
        }
        const parts = []
        for (let i = 0; i < sourceIds.length; i++) {
          const sid = sourceIds[i]
          try {
            const title = await readTitle(sid)
            const messages = await readMessages(sid, 30, 500)
            const lines = messages.map((m) => {
              const role = m.role === 'user' ? '用户' : m.role === 'assistant' ? '助手' : '工具结果'
              return '[' + role + '] ' + m.text
            })
            parts.push('========== 源会话 ' + (i + 1) + '：' + (title || sid) + ' ==========\n' + lines.join('\n\n'))
          } catch (e) {
            parts.push('========== 源会话 ' + (i + 1) + '：' + sid + '（读取失败） ==========')
          }
        }
        const recallText =
          '【会话画布·引用】以下内容来自画布中与本会话连接的其他会话，作为本次对话的参考上下文（不是用户的新指令）：\n\n' +
          parts.join('\n\n')
        try {
          agent.inject(makeUserMessage(recallText, { kind: 'plugin', plugin: 'session-canvas', form: 'recall' }))
          writeJson(res, 200, { ok: true })
        } catch (e) {
          writeJson(res, 500, { error: String((e && e.message) || e) })
        }
      },
    },
    // ------------------------------------------------------------ create
    {
      kind: 'exact',
      path: API.create,
      handler: async (req, res) => {
        if (!isLocal(req)) return writeJson(res, 403, { error: 'forbidden' })
        const body = await readBody(req)
        const sessionIds = Array.isArray(body && body.sessionIds)
          ? body.sessionIds.filter((x) => typeof x === 'string')
          : []
        const prompt = body && typeof body.prompt === 'string' ? body.prompt : ''
        const cwd = body && typeof body.cwd === 'string' && body.cwd ? body.cwd : undefined
        if (!sessionIds.length) return writeJson(res, 400, { error: '未选择任何会话' })

        const parts = []
        for (let i = 0; i < sessionIds.length; i++) {
          const sid = sessionIds[i]
          let headerText = '会话 ' + (i + 1) + '：' + sid
          let lines = []
          try {
            const title = await readTitle(sid)
            if (title) headerText = '会话 ' + (i + 1) + '：' + title
            const messages = await readMessages(sid, 30, 500)
            lines = messages.map((m) => {
              const role = m.role === 'user' ? '用户' : m.role === 'assistant' ? '助手' : '工具结果'
              return '[' + role + '] ' + m.text
            })
          } catch (e) {
            lines = ['（该会话内容读取失败）']
          }
          parts.push('========== ' + headerText + ' ==========\n' + lines.join('\n\n'))
        }
        const summary =
          '【会话画布·汇总】本会话由 ' + sessionIds.length + ' 个既有会话的内容汇总创建，以下是全部上下文：\n\n' +
          parts.join('\n\n') +
          '\n\n【任务要求】\n' + (prompt || '请通读以上各会话内容，给出整体总结、关键结论与下一步建议。')

        const now = Date.now()
        const sessionId = 'session-' + now.toString(36) + '-' + Math.random().toString(36).slice(2, 8)
        const seed = [{
          type: 'user/message',
          seq: 0,
          time: now,
          data: {
            id: 'canvas-' + now.toString(36) + '-' + Math.random().toString(36).slice(2, 6),
            role: 'user',
            content: [{ type: 'text', text: summary }],
            source: { kind: 'plugin', plugin: 'session-canvas', form: 'recall' },
          },
          surfaceOp: 'append',
        }]
        try {
          const composition = await agentComposition()
          await agentLoop.createAgent(ctx, {
            sessionId: sessionId,
            meta: {
              ...(cwd ? { cwd: cwd } : {}),
              ...(composition.agentPreset ? { agentPreset: composition.agentPreset } : {}),
            },
            seed: seed,
            agentOptions: defaultAgentOptions(),
            setup: composition.setup,
          })
        } catch (e) {
          try {
            const composition = await agentComposition()
            await agentLoop.createAgent(ctx, {
              sessionId: sessionId,
              meta: {
                ...(cwd ? { cwd: cwd } : {}),
                ...(composition.agentPreset ? { agentPreset: composition.agentPreset } : {}),
              },
              agentOptions: defaultAgentOptions(),
              setup: composition.setup,
            })
        } catch (e2) {
            return writeJson(res, 500, { ok: false, error: String((e2 && e2.message) || e2) })
          }
        }
        await attachToWorkspace(sessionId, cwd)
        writeJson(res, 200, { ok: true, sessionId: sessionId })
      },
    },
    // --------------------------------------------------------- new-session
    {
      kind: 'exact',
      path: API.newSession,
      handler: async (req, res) => {
        if (!isLocal(req)) return writeJson(res, 403, { error: 'forbidden' })
        const body = await readBody(req)
        let cwd = body && typeof body.cwd === 'string' && body.cwd ? body.cwd : undefined
        // fall back to the most recent session's cwd so a blank-session card
        // still belongs to a workspace (never an ungrouped session)
        if (!cwd) cwd = await defaultCwd()
        const now = Date.now()
        const sessionId = 'session-' + now.toString(36) + '-' + Math.random().toString(36).slice(2, 8)
        try {
          const composition = await agentComposition()
          await agentLoop.createAgent(ctx, {
            sessionId: sessionId,
            meta: {
              ...(cwd ? { cwd: cwd } : {}),
              ...(composition.agentPreset ? { agentPreset: composition.agentPreset } : {}),
            },
            agentOptions: defaultAgentOptions(),
            setup: composition.setup,
          })
          await attachToWorkspace(sessionId, cwd)
          writeJson(res, 200, { ok: true, sessionId: sessionId })
        } catch (e) {
          writeJson(res, 500, { ok: false, error: String((e && e.message) || e) })
        }
      },
    },
    // ---------------------------------------------------------- commands
    {
      kind: 'exact',
      path: '/api/dsh-session-canvas/commands',
      handler: async (req, res) => {
        if (!isLocal(req)) return writeJson(res, 403, { error: 'forbidden' })
        const url = new URL(req.url || '/', 'http://localhost')
        const sessionId = url.searchParams.get('sessionId') || ''
        const agent = await commandAgent(sessionId)
        const out = { commands: [], skills: [] }
        if (commandsSvc && agent) {
          try {
            const list = commandsSvc.list(agent)
            if (Array.isArray(list)) {
              out.commands = list.map((c) => ({ name: c.name, description: c.description || '' }))
            }
          } catch (e) { /* ignore */ }
        }
        if (skillsSvc && agent) {
          try {
            const cwd = agent.session && agent.session.header ? agent.session.header.cwd : undefined
            const lookup = { scope: agent }
            if (cwd) lookup.cwd = cwd
            const list = await skillsSvc.list(lookup)
            if (Array.isArray(list)) {
              out.skills = list
                .filter((s) => !s.invocation || s.invocation.userInvocable !== false)
                .map((s) => ({ name: s.name, description: s.description || '' }))
                .slice(0, 60)
            }
          } catch (e) { /* ignore */ }
        }
        writeJson(res, 200, out)
      },
    },
    // ------------------------------------------------- command execute
    {
      kind: 'exact',
      path: '/api/dsh-session-canvas/command',
      handler: async (req, res) => {
        if (!isLocal(req)) return writeJson(res, 403, { error: 'forbidden' })
        const body = await readBody(req)
        const sessionId = body && typeof body.sessionId === 'string' ? body.sessionId : ''
        const line = body && typeof body.line === 'string' ? body.line : ''
        if (!line.trim()) return writeJson(res, 400, { error: 'missing line' })
        const agent = await commandAgent(sessionId)
        if (!commandsSvc || !agent) return writeJson(res, 500, { error: 'commands service unavailable' })
        try {
          const exec = await commandsSvc.execute(agent, line, new AbortController().signal)
          if (exec && exec.result) {
            if (exec.result.kind === 'success') {
              writeJson(res, 200, { ok: true, text: exec.result.text || '' })
            } else {
              writeJson(res, 200, { ok: false, error: exec.result.text || '命令执行失败' })
            }
          } else {
            writeJson(res, 200, { ok: true, text: '' })
          }
        } catch (e) {
          writeJson(res, 500, { error: String((e && e.message) || e) })
        }
      },
    },
    // ---------------------------------------------------------- skill run
    {
      kind: 'exact',
      path: '/api/dsh-session-canvas/skill',
      handler: async (req, res) => {
        if (!isLocal(req)) return writeJson(res, 403, { error: 'forbidden' })
        const body = await readBody(req)
        const sessionId = body && typeof body.sessionId === 'string' ? body.sessionId : ''
        const name = body && typeof body.name === 'string' ? body.name : ''
        const requestedText = body && typeof body.text === 'string' ? body.text.trim() : ''
        if (!sessionId || !name) return writeJson(res, 400, { error: 'missing sessionId or name' })
        if (!agents) return writeJson(res, 500, { error: 'agents service unavailable' })
        const agent = await ensureLiveAgent(sessionId)
        if (!agent) return writeJson(res, 409, { error: '无法恢复该会话', code: 'not-running' })
        const agentOpts = agent.options || {}
        if (typeof agentOpts.provider !== 'string' || typeof agentOpts.model !== 'string') {
          return writeJson(res, 409, {
            error: '该会话缺少模型配置（由旧版本创建），请删除该卡片后重新创建',
            code: 'no-model',
          })
        }
        if (!skillsSvc) return writeJson(res, 500, { error: 'skills service unavailable' })
        try {
          const cwd = agent.session && agent.session.header ? agent.session.header.cwd : undefined
          const lookup = { scope: agent }
          if (cwd) lookup.cwd = cwd
          const list = await skillsSvc.list(lookup)
          const summary = Array.isArray(list) ? list.find((s) => s.name === name) : undefined
          if (!summary || (summary.invocation && summary.invocation.userInvocable === false)) {
            return writeJson(res, 404, { error: 'skill 不存在或不可由用户调用：' + name })
          }
          if (toolsSvc && typeof toolsSvc.get === 'function' && !toolsSvc.get('skill', agent)) {
            return writeJson(res, 409, {
              error: '当前会话未挂载原生 skill 工具，请重新打开会话后再试',
              code: 'skill-tool-unavailable',
            })
          }

          // Use DSH's native user-invocation gesture. The preset-mounted
          // tool-skill pre-step hook loads the complete, canonical skill body
          // (including resourceBase) and keeps all of the preset's tools in the
          // same agent scope. Do not read, truncate, or inject SKILL.md here.
          const runText = '/' + name + (requestedText ? ' ' + requestedText : '')
          delete agentErrors[sessionId]
          agent.followup(makeUserMessage(runText, { kind: 'user' }))
          await withTimeout(agent.whenIdle(), CHAT_TIMEOUT)
          const messages = await readMessages(sessionId, 8)
          const replies = messages.filter((m) => m.role === 'assistant')
          writeJson(res, 200, {
            ok: true,
            name: name,
            reply: replies.length ? replies[replies.length - 1].text : '',
            agentStatus: agent.status || '',
            agentError: agentErrors[sessionId] || '',
          })
        } catch (e) {
          writeJson(res, 500, { error: String((e && e.message) || e) })
        }
      },
    },
    // ------------------------------------------------------ attach-test (diag)
    {
      kind: 'exact',
      path: '/api/dsh-session-canvas/attach-test',
      handler: async (req, res) => {
        if (!isLocal(req)) return writeJson(res, 403, { error: 'forbidden' })
        const body = await readBody(req)
        const sessionId = body && typeof body.sessionId === 'string' ? body.sessionId : ''
        const cwd = body && typeof body.cwd === 'string' ? body.cwd : ''
        const out = { sessionId: sessionId, cwd: cwd, steps: [] }
        out.steps.push({ step: 'registry', present: workspaceRegistry !== undefined })
        out.steps.push({
          step: 'agent-presets',
          present: agentPresets !== undefined,
          defaultId: agentPresets && typeof agentPresets.defaultId === 'string' ? agentPresets.defaultId : null,
        })
        out.steps.push({ step: 'tools', present: toolsSvc !== undefined })
        try {
          if (workspaceRegistry) {
            const ws = await workspaceRegistry.resolveByPath(cwd)
            out.steps.push({ step: 'resolve', ok: !!ws, path: ws ? ws.path : null })
            if (ws) {
              await ws.attachSession(sessionId)
              out.steps.push({ step: 'attach', ok: true, sessionIds: ws.sessionIds })
            }
          }
          out.ok = true
        } catch (e) {
          out.ok = false
          out.error = String((e && e.message) || e)
        }
        writeJson(res, 200, out)
      },
    },
  ]

  const disposers = routes.map((route) => ctx.webServer.register(route))
  ctx.effect(() => () => {
    for (const dispose of disposers) dispose()
  }, 'dsh-session-canvas: routes')
}
