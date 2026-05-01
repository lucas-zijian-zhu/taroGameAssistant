import Taro from '@tarojs/taro'

const SESSION_KEY = 'avalon-player-session'

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
