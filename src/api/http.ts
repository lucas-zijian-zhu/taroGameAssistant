import Taro from '@tarojs/taro'
import { API_BASE_URL } from './config'

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
}

const isH5Runtime = () => process.env.TARO_ENV === 'h5' && typeof fetch === 'function'

export class ApiError extends Error {
  status: number
  data: unknown

  constructor(status: number, data: unknown) {
    super(`API request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

const buildUrl = (path: string) => `${API_BASE_URL}${path}`

const parseResponse = async <T>(response: Response) => {
  const text = await response.text()
  const data = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new ApiError(response.status, data)
  }

  return data as T
}

export const apiRequest = async <T>(path: string, options: RequestOptions = {}) => {
  const method = options.method || 'GET'
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  }

  if (isH5Runtime()) {
    const response = await fetch(buildUrl(path), {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    })

    return parseResponse<T>(response)
  }

  const response = await Taro.request({
    url: buildUrl(path),
    method,
    header: headers,
    data: options.body
  })

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new ApiError(response.statusCode, response.data)
  }

  return response.data as T
}
