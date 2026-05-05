import Taro from '@tarojs/taro'

const SESSION_KEY = 'avalon-player-session'
const LOBBY_PLAYER_ID_KEY = 'avalon-lobby-player-id'

export type PlayerSession = {
  roomCode: string
  playerId: string
}

export const savePlayerSession = (session: PlayerSession) => {
  Taro.setStorageSync(SESSION_KEY, session)
}

export const getPlayerSession = (): PlayerSession | null => {
  try {
    const session = Taro.getStorageSync<PlayerSession>(SESSION_KEY)

    if (session?.roomCode && session?.playerId) {
      return session
    }
  } catch {
    return null
  }

  return null
}

export const clearPlayerSession = () => {
  Taro.removeStorageSync(SESSION_KEY)
}

export const getLobbyPlayerId = () => {
  const existingPlayerId = Taro.getStorageSync<string>(LOBBY_PLAYER_ID_KEY)

  if (existingPlayerId) {
    return existingPlayerId
  }

  const playerId = `lobby_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  Taro.setStorageSync(LOBBY_PLAYER_ID_KEY, playerId)

  return playerId
}
