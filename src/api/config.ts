const DEFAULT_API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://lucas-avalon-service.duckdns.org/api'
  : 'http://10.0.0.128:3000/api'

const DEFAULT_WS_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'wss://lucas-avalon-service.duckdns.org/ws'
  : 'ws://10.0.0.128:3000/ws'

export const API_BASE_URL = process.env.TARO_APP_API_BASE_URL || DEFAULT_API_BASE_URL

export const WS_BASE_URL = process.env.TARO_APP_WS_BASE_URL || DEFAULT_WS_BASE_URL
