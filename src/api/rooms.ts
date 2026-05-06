import type { GamePhase, MissionVote, Role, RoleId, RoundHistoryStatus, TeamVote } from '@/domain/avalon'
import { apiRequest } from './http'

export type RemoteRoomStatus = 'lobby' | 'playing' | 'finished' | 'closed'

export type VoteStatus = 'pending' | 'submitted'

export type Winner = 'good' | 'evil' | null

export type RoleConfigItem = {
  roleId: RoleId
  count: number
}

export type RemotePlayer = {
  id: string
  name: string
  seat: number
  isHost: boolean
  isReady: boolean
  connected: boolean
}

export type RemoteRoom = {
  id: string
  code: string
  status: RemoteRoomStatus
  playerCount: number
  roleConfig: RoleConfigItem[]
  players: RemotePlayer[]
  createdAt: string
}

export type VoteProgress = {
  required: number
  submitted: number
  players: Record<string, VoteStatus>
}

export type RemoteTeamVoteResult = {
  approveCount: number
  rejectCount: number
  passed: boolean
  votes?: Record<string, TeamVote>
  forced?: boolean
}

export type RemoteMissionResult = {
  successCount: number
  failCount: number
  passed: boolean
}

export type RemoteRoundResult = {
  round: number
  leaderPlayerId: string
  teamPlayerIds: string[]
  status?: RoundHistoryStatus
  teamVoteResult: RemoteTeamVoteResult
  missionResult?: RemoteMissionResult
}

export type RemoteGame = {
  roomId: string
  phase: GamePhase
  round: number
  leaderPlayerId: string
  teamPlayerIds: string[]
  teamVoteProgress: VoteProgress
  missionVoteProgress: VoteProgress
  history: RemoteRoundResult[]
  winner: Winner
  updatedAt: string
}

export type VisibleKnownPlayer = {
  playerId: string
  name: string
  hint: 'evil' | 'merlin_candidate' | string
}

export type VisibleRoleInfo = {
  myRole: Role
  knownPlayers: VisibleKnownPlayer[]
  notes: string[]
}

export type CreateRoomPayload = {
  playerCount: number
  hostName: string
  roleConfig: RoleConfigItem[]
}

export type JoinRoomPayload = {
  playerName: string
}

export type PlayerPayload = {
  playerId: string
}

export type UpdateRoleConfigPayload = {
  hostPlayerId: string
  playerCount: number
  roleConfig: RoleConfigItem[]
}

export type ReadyPayload = {
  playerId: string
  isReady: boolean
}

export type SubmitTeamPayload = {
  leaderPlayerId: string
  teamPlayerIds: string[]
}

export type SubmitTeamVotePayload = {
  playerId: string
  vote: TeamVote
}

export type SubmitMissionVotePayload = {
  playerId: string
  vote: MissionVote
}

export type AssassinatePayload = {
  assassinPlayerId: string
  targetPlayerId: string
}

export type RoomResponse = {
  room: RemoteRoom
}

export type RoomsResponse = {
  rooms: RemoteRoom[]
}

export type JoinRoomResponse = RoomResponse & {
  currentPlayerId: string
}

export type GameResponse = {
  game: RemoteGame
  visibleRoleInfo: VisibleRoleInfo | null
}

export type RoomStateResponse = {
  room: RemoteRoom
  game: RemoteGame | null
  visibleRoleInfo: VisibleRoleInfo | null
  version: number
}

const playerHeaders = (playerId?: string) => {
  return playerId ? { 'X-Player-Id': playerId } : undefined
}

const asArray = <T>(value: T[] | null | undefined): T[] => {
  return Array.isArray(value) ? value : []
}

const normalizeRoom = (room: RemoteRoom | null | undefined): RemoteRoom => {
  const safeRoom = room || {
    id: '',
    code: '',
    status: 'closed' as RemoteRoomStatus,
    playerCount: 0,
    roleConfig: [],
    players: [],
    createdAt: ''
  }

  return {
    ...safeRoom,
    roleConfig: asArray(safeRoom.roleConfig),
    players: asArray(safeRoom.players)
  }
}

const normalizeRoomResponse = <T extends { room: RemoteRoom }>(response: T): T => {
  return {
    ...response,
    room: normalizeRoom(response.room)
  }
}

const normalizeRoomsResponse = (response: RoomsResponse | null | undefined): RoomsResponse => {
  const rooms = asArray(response?.rooms).map(normalizeRoom)

  return {
    rooms
  }
}

const normalizeRoomStateResponse = (response: RoomStateResponse): RoomStateResponse => {
  return {
    ...response,
    room: normalizeRoom(response.room)
  }
}

export const createRoom = (payload: CreateRoomPayload) => {
  return apiRequest<JoinRoomResponse>('/rooms', {
    method: 'POST',
    body: payload
  }).then(normalizeRoomResponse)
}

export const joinRoom = (roomCode: string, payload: JoinRoomPayload) => {
  return apiRequest<JoinRoomResponse>(`/rooms/${roomCode}/join`, {
    method: 'POST',
    body: payload
  }).then(normalizeRoomResponse)
}

export const listRooms = () => {
  return apiRequest<RoomsResponse>('/rooms').then(normalizeRoomsResponse)
}

export const updateRoleConfig = (roomCode: string, payload: UpdateRoleConfigPayload) => {
  return apiRequest<RoomResponse>(`/rooms/${roomCode}/role-config`, {
    method: 'PUT',
    body: payload
  }).then(normalizeRoomResponse)
}

export const setReady = (roomCode: string, payload: ReadyPayload) => {
  return apiRequest<RoomResponse>(`/rooms/${roomCode}/ready`, {
    method: 'POST',
    body: payload
  }).then(normalizeRoomResponse)
}

export const getRoom = (roomCode: string) => {
  return apiRequest<RoomResponse>(`/rooms/${roomCode}`).then(normalizeRoomResponse)
}

export const getRoomState = (roomCode: string, playerId?: string) => {
  return apiRequest<RoomStateResponse>(`/rooms/${roomCode}/state`, {
    headers: playerHeaders(playerId)
  }).then(normalizeRoomStateResponse)
}

export const leaveRoom = (roomCode: string, payload: PlayerPayload) => {
  return apiRequest<RoomResponse>(`/rooms/${roomCode}/leave`, {
    method: 'POST',
    body: payload
  }).then(normalizeRoomResponse)
}

export const closeRoom = (roomCode: string, payload: { hostPlayerId: string }) => {
  return apiRequest<RoomResponse>(`/rooms/${roomCode}/close`, {
    method: 'POST',
    body: payload,
    headers: playerHeaders(payload.hostPlayerId)
  }).then(normalizeRoomResponse)
}

export const startGame = (roomCode: string, payload: { hostPlayerId: string }) => {
  return apiRequest<GameResponse>(`/rooms/${roomCode}/game/start`, {
    method: 'POST',
    body: payload,
    headers: playerHeaders(payload.hostPlayerId)
  })
}

export const getGame = (roomCode: string, playerId?: string) => {
  return apiRequest<GameResponse>(`/rooms/${roomCode}/game`, {
    headers: playerHeaders(playerId)
  })
}

export const getMyRole = (roomCode: string, playerId: string) => {
  return apiRequest<{ visibleRoleInfo: VisibleRoleInfo | null }>(`/rooms/${roomCode}/game/my-role`, {
    headers: playerHeaders(playerId)
  })
}

export const enterSpeech = (roomCode: string, payload: PlayerPayload) => {
  return apiRequest<GameResponse>(`/rooms/${roomCode}/game/speech`, {
    method: 'POST',
    body: payload,
    headers: playerHeaders(payload.playerId)
  })
}

export const submitTeam = (roomCode: string, payload: SubmitTeamPayload) => {
  return apiRequest<GameResponse>(`/rooms/${roomCode}/game/team`, {
    method: 'POST',
    body: payload,
    headers: playerHeaders(payload.leaderPlayerId)
  })
}

export const submitTeamVote = (roomCode: string, payload: SubmitTeamVotePayload) => {
  return apiRequest<GameResponse>(`/rooms/${roomCode}/game/team-votes`, {
    method: 'POST',
    body: payload,
    headers: playerHeaders(payload.playerId)
  })
}

export const submitMissionVote = (roomCode: string, payload: SubmitMissionVotePayload) => {
  return apiRequest<GameResponse>(`/rooms/${roomCode}/game/mission-votes`, {
    method: 'POST',
    body: payload,
    headers: playerHeaders(payload.playerId)
  })
}

export const nextRound = (roomCode: string, payload: PlayerPayload) => {
  return apiRequest<GameResponse>(`/rooms/${roomCode}/game/next-round`, {
    method: 'POST',
    body: payload,
    headers: playerHeaders(payload.playerId)
  })
}

export const assassinate = (roomCode: string, payload: AssassinatePayload) => {
  return apiRequest<GameResponse>(`/rooms/${roomCode}/game/assassinate`, {
    method: 'POST',
    body: payload,
    headers: playerHeaders(payload.assassinPlayerId)
  })
}

export const resetGame = (roomCode: string, payload: { hostPlayerId: string }) => {
  return apiRequest<RoomResponse>(`/rooms/${roomCode}/game/reset`, {
    method: 'POST',
    body: payload,
    headers: playerHeaders(payload.hostPlayerId)
  }).then(normalizeRoomResponse)
}
