import Taro from '@tarojs/taro'
import { useEffect } from 'react'
import { WS_BASE_URL } from './config'
import { getRoomState, type RemoteGame, type RemoteRoom, type VisibleRoleInfo } from './rooms'

type RoomSocketPayloads = {
  'connection.ready': {
    scope?: 'lobby' | 'room'
    roomCode?: string
    playerId: string
    serverTime: string
  }
  'lobby.rooms.changed': {
    reason: string
    roomCode?: string
  }
  'room.updated': {
    room: RemoteRoom
  }
  'room.closed': {
    roomCode: string
    reason: string
  }
  'game.updated': {
    game: RemoteGame
  }
  'game.private_role': {
    visibleRoleInfo: VisibleRoleInfo
  }
  'vote.progress': unknown
  'round.result': unknown
  error: {
    code: string
    message: string
  }
  pong: unknown
}

type RoomSocketMessage<T extends keyof RoomSocketPayloads = keyof RoomSocketPayloads> = {
  type: T
  payload: RoomSocketPayloads[T]
  version?: number
  createdAt?: string
}

type UseRoomSocketOptions = {
  roomCode: string
  playerId: string
  enabled?: boolean
  onRoomUpdated: (room: RemoteRoom) => void
  onGameUpdated: (game: RemoteGame) => void
  onPrivateRole: (visibleRoleInfo: VisibleRoleInfo) => void
  onRoomClosed: (payload: RoomSocketPayloads['room.closed']) => void
  onStateLoaded: (state: Awaited<ReturnType<typeof getRoomState>>) => void
  onError?: (message: string) => void
}

const RECONNECT_DELAYS = [1000, 2000, 5000, 10000]

const isH5Runtime = () => process.env.TARO_ENV === 'h5' && typeof WebSocket === 'function'

const buildSocketUrl = (roomCode: string, playerId: string) => {
  return `${WS_BASE_URL}/rooms/${roomCode}?playerId=${encodeURIComponent(playerId)}`
}

const buildLobbySocketUrl = (playerId: string) => {
  return `${WS_BASE_URL}/lobby?playerId=${encodeURIComponent(playerId)}`
}

const parseSocketMessage = (data: unknown): RoomSocketMessage | null => {
  if (typeof data !== 'string') {
    return null
  }

  try {
    return JSON.parse(data) as RoomSocketMessage
  } catch {
    return null
  }
}

type UseLobbySocketOptions = {
  playerId: string
  enabled?: boolean
  onRoomsChanged: () => void
  onError?: (message: string) => void
}

export const useLobbySocket = ({
  playerId,
  enabled = true,
  onRoomsChanged,
  onError
}: UseLobbySocketOptions) => {
  useEffect(() => {
    if (!enabled || !playerId) {
      return undefined
    }

    let closed = false
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let reconnectAttempt = 0
    let h5Socket: WebSocket | null = null
    let taroSocket: Taro.SocketTask | null = null

    const handleMessage = (data: unknown) => {
      const message = parseSocketMessage(data)

      if (!message) {
        return
      }

      if (message.type === 'connection.ready') {
        return
      }

      if (message.type === 'lobby.rooms.changed') {
        onRoomsChanged()
        return
      }

      if (message.type === 'error') {
        onError?.((message.payload as RoomSocketPayloads['error']).message)
      }
    }

    const handleConnectionError = () => {
      console.warn('Lobby WebSocket connection failed, retrying...')
    }

    const scheduleReconnect = () => {
      if (closed) {
        return
      }

      const delay = RECONNECT_DELAYS[Math.min(reconnectAttempt, RECONNECT_DELAYS.length - 1)]
      reconnectAttempt += 1
      reconnectTimer = setTimeout(connect, delay)
    }

    const connect = () => {
      const url = buildLobbySocketUrl(playerId)

      if (isH5Runtime()) {
        h5Socket = new WebSocket(url)
        h5Socket.onopen = () => {
          reconnectAttempt = 0
        }
        h5Socket.onmessage = (event) => handleMessage(event.data)
        h5Socket.onerror = handleConnectionError
        h5Socket.onclose = () => scheduleReconnect()
        return
      }

      Taro.connectSocket({ url }).then((socket) => {
        if (closed) {
          socket.close({})
          return
        }

        taroSocket = socket
        taroSocket.onOpen(() => {
          reconnectAttempt = 0
        })
        taroSocket.onMessage((event) => handleMessage(event.data))
        taroSocket.onError(handleConnectionError)
        taroSocket.onClose(() => scheduleReconnect())
      }).catch(() => {
        handleConnectionError()
        scheduleReconnect()
      })
    }

    connect()

    return () => {
      closed = true

      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
      }

      if (h5Socket) {
        h5Socket.close()
      }

      if (taroSocket) {
        taroSocket.close({})
      }
    }
  }, [enabled, onError, onRoomsChanged, playerId])
}

export const useRoomSocket = ({
  roomCode,
  playerId,
  enabled = true,
  onRoomUpdated,
  onGameUpdated,
  onPrivateRole,
  onRoomClosed,
  onStateLoaded,
  onError
}: UseRoomSocketOptions) => {
  useEffect(() => {
    if (!enabled || !roomCode || !playerId) {
      return undefined
    }

    let closed = false
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let reconnectAttempt = 0
    let h5Socket: WebSocket | null = null
    let taroSocket: Taro.SocketTask | null = null

    const loadState = async () => {
      try {
        const state = await getRoomState(roomCode, playerId)

        if (!closed) {
          onStateLoaded(state)
        }
      } catch (error) {
        if (!closed) {
          onError?.(error instanceof Error ? error.message : '房间状态同步失败')
        }
      }
    }

    const handleMessage = (data: unknown) => {
      const message = parseSocketMessage(data)

      if (!message) {
        return
      }

      if (message.type === 'connection.ready') {
        loadState()
        return
      }

      if (message.type === 'room.updated') {
        onRoomUpdated((message.payload as RoomSocketPayloads['room.updated']).room)
        return
      }

      if (message.type === 'room.closed') {
        onRoomClosed(message.payload as RoomSocketPayloads['room.closed'])
        return
      }

      if (message.type === 'game.updated') {
        onGameUpdated((message.payload as RoomSocketPayloads['game.updated']).game)
        return
      }

      if (message.type === 'game.private_role') {
        onPrivateRole((message.payload as RoomSocketPayloads['game.private_role']).visibleRoleInfo)
        return
      }

      if (message.type === 'error') {
        onError?.((message.payload as RoomSocketPayloads['error']).message)
      }
    }

    const handleConnectionError = () => {
      console.warn('WebSocket connection failed, retrying...')
    }

    const scheduleReconnect = () => {
      if (closed) {
        return
      }

      const delay = RECONNECT_DELAYS[Math.min(reconnectAttempt, RECONNECT_DELAYS.length - 1)]
      reconnectAttempt += 1
      reconnectTimer = setTimeout(connect, delay)
    }

    const connect = () => {
      const url = buildSocketUrl(roomCode, playerId)

      if (isH5Runtime()) {
        h5Socket = new WebSocket(url)
        h5Socket.onopen = () => {
          reconnectAttempt = 0
        }
        h5Socket.onmessage = (event) => handleMessage(event.data)
        h5Socket.onerror = handleConnectionError
        h5Socket.onclose = () => scheduleReconnect()
        return
      }

      Taro.connectSocket({ url }).then((socket) => {
        if (closed) {
          socket.close({})
          return
        }

        taroSocket = socket
        taroSocket.onOpen(() => {
          reconnectAttempt = 0
        })
        taroSocket.onMessage((event) => handleMessage(event.data))
        taroSocket.onError(handleConnectionError)
        taroSocket.onClose(() => scheduleReconnect())
      }).catch(() => {
        handleConnectionError()
        scheduleReconnect()
      })
    }

    connect()

    return () => {
      closed = true

      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
      }

      if (h5Socket) {
        h5Socket.close()
      }

      if (taroSocket) {
        taroSocket.close({})
      }
    }
  }, [enabled, onError, onGameUpdated, onPrivateRole, onRoomClosed, onRoomUpdated, onStateLoaded, playerId, roomCode])
}
