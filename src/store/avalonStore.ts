import { create } from 'zustand'
import {
  createRoomCode,
  getMission,
  type GamePhase,
  type MissionVote,
  type Player,
  type RoundHistoryStatus,
  type RoundResult,
  shuffleRoles,
  type TeamVote
} from '@/domain/avalon'
import type { RemoteGame, RemoteRoom, VisibleRoleInfo } from '@/api/rooms'

type AvalonState = {
  roomCode: string
  joinCode: string
  playerName: string
  playerCount: number
  players: Player[]
  currentPlayerId: string
  visibleRoleInfo: VisibleRoleInfo | null
  activePlayerId: string
  phase: GamePhase
  roundIndex: number
  leaderIndex: number
  selectedTeamIds: string[]
  teamVotes: Record<string, TeamVote>
  missionVotes: Record<string, MissionVote>
  history: RoundResult[]
  setJoinCode: (joinCode: string) => void
  setPlayerName: (playerName: string) => void
  setPlayerCount: (playerCount: number) => void
  setCurrentPlayerId: (playerId: string) => void
  setVisibleRoleInfo: (visibleRoleInfo: VisibleRoleInfo | null) => void
  syncRemoteRoom: (room: RemoteRoom, currentPlayerId?: string) => void
  syncRemoteGame: (game: RemoteGame, visibleRoleInfo?: VisibleRoleInfo | null) => void
  createRoom: () => void
  joinRoom: () => { ok: boolean, message?: string }
  removePlayer: (playerId: string) => void
  setActivePlayer: (playerId: string) => void
  startGame: () => { ok: boolean, message?: string }
  toggleTeamMember: (playerId: string) => void
  submitTeam: () => { ok: boolean, message?: string }
  castTeamVote: (playerId: string, vote: TeamVote) => void
  castMissionVote: (playerId: string, vote: MissionVote) => { ok: boolean, message?: string }
  nextRound: () => void
  reset: () => void
}

const initialGameState = {
  roomCode: '',
  joinCode: '',
  playerName: '',
  playerCount: 5,
  players: [],
  currentPlayerId: '',
  visibleRoleInfo: null,
  activePlayerId: '',
  phase: 'lobby' as GamePhase,
  roundIndex: 0,
  leaderIndex: 0,
  selectedTeamIds: [],
  teamVotes: {},
  missionVotes: {},
  history: []
}

const getNextLeaderIndex = (leaderIndex: number, playerCount: number) => {
  return (leaderIndex + 1) % playerCount
}

const countVotes = <T extends string>(votes: Record<string, T>, value: T) => {
  return Object.values(votes).filter((vote) => vote === value).length
}

const progressToSubmittedMap = <T extends TeamVote | MissionVote>(players: Record<string, string>, submittedValue: T) => {
  return Object.entries(players).reduce<Record<string, T>>((result, [playerId, status]) => {
    if (status === 'submitted') {
      result[playerId] = submittedValue
    }

    return result
  }, {})
}

const getRoundHistoryStatus = (result: RemoteGame['history'][number]): RoundHistoryStatus => {
  if (result.status) {
    return result.status
  }

  if (!result.teamVoteResult.passed) {
    return 'team_rejected'
  }

  if (!result.missionResult) {
    return 'mission_pending'
  }

  return result.missionResult.passed ? 'mission_succeeded' : 'mission_failed'
}

const resolveTeamVote = (state: AvalonState): Partial<AvalonState> => {
  const approveCount = countVotes(state.teamVotes, 'approve')
  const rejectCount = countVotes(state.teamVotes, 'reject')

  if (approveCount > rejectCount) {
    return {
      phase: 'mission_vote'
    }
  }

  return {
    phase: 'team_building',
    selectedTeamIds: [],
    teamVotes: {},
    leaderIndex: getNextLeaderIndex(state.leaderIndex, state.players.length)
  }
}

const resolveMissionVote = (state: AvalonState): Partial<AvalonState> => {
  const mission = getMission(state.playerCount, state.roundIndex)
  const approveCount = countVotes(state.teamVotes, 'approve')
  const rejectCount = countVotes(state.teamVotes, 'reject')
  const successCount = countVotes(state.missionVotes, 'success')
  const failCount = countVotes(state.missionVotes, 'fail')
  const passed = failCount < mission.failsRequired
  const history = [
    ...state.history,
    {
      round: mission.round,
      teamPlayerIds: state.selectedTeamIds,
      approveCount,
      rejectCount,
      successCount,
      failCount,
      status: passed ? 'mission_succeeded' : 'mission_failed',
      missionCompleted: true,
      passed
    }
  ]
  const successRounds = history.filter((result) => result.status === 'mission_succeeded').length
  const failedRounds = history.filter((result) => result.status === 'mission_failed').length

  return {
    history,
    phase: successRounds >= 3 ? 'assassination' : failedRounds >= 3 ? 'finished' : 'round_result'
  }
}

export const useAvalonStore = create<AvalonState>((set, get) => ({
  ...initialGameState,

  setJoinCode: (joinCode) => set({ joinCode }),

  setPlayerName: (playerName) => set({ playerName }),

  setPlayerCount: (playerCount) => set({ playerCount }),

  setCurrentPlayerId: (currentPlayerId) => set({ currentPlayerId }),

  setVisibleRoleInfo: (visibleRoleInfo) => set({ visibleRoleInfo }),

  syncRemoteRoom: (room, currentPlayerId) => set((state) => ({
    roomCode: room.code,
    playerCount: Number(room.playerCount),
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      isHost: player.isHost,
      isReady: player.isReady,
      connected: player.connected,
      role: state.players.find((item) => item.id === player.id)?.role
    })),
    currentPlayerId: currentPlayerId || state.currentPlayerId,
    phase: room.status === 'lobby' ? 'lobby' : state.phase
  })),

  syncRemoteGame: (game, visibleRoleInfo) => set((state) => {
    const leaderIndex = Math.max(0, state.players.findIndex((player) => player.id === game.leaderPlayerId))

    return {
      phase: game.phase,
      roundIndex: Math.max(0, game.round - 1),
      leaderIndex,
      selectedTeamIds: game.teamPlayerIds,
      teamVotes: progressToSubmittedMap(game.teamVoteProgress.players, 'approve'),
      missionVotes: progressToSubmittedMap(game.missionVoteProgress.players, 'success'),
      visibleRoleInfo: visibleRoleInfo === undefined ? state.visibleRoleInfo : visibleRoleInfo,
      history: game.history.map((result) => {
        const status = getRoundHistoryStatus(result)

        return {
          round: result.round,
          teamPlayerIds: result.teamPlayerIds,
          approveCount: result.teamVoteResult.approveCount,
          rejectCount: result.teamVoteResult.rejectCount,
          successCount: result.missionResult?.successCount || 0,
          failCount: result.missionResult?.failCount || 0,
          status,
          missionCompleted: status === 'mission_succeeded' || status === 'mission_failed',
          passed: status === 'mission_succeeded'
        }
      })
    }
  }),

  createRoom: () => set({
    ...initialGameState,
    playerCount: get().playerCount,
    roomCode: createRoomCode()
  }),

  joinRoom: () => {
    const state = get()
    const name = state.playerName.trim()
    const code = state.roomCode || state.joinCode.trim().toUpperCase()

    if (!code) {
      return { ok: false, message: '请先创建或输入房间号' }
    }

    if (!name) {
      return { ok: false, message: '请输入玩家昵称' }
    }

    if (state.phase !== 'lobby') {
      return { ok: false, message: '对局已开始，请重开房间后加入' }
    }

    if (state.players.length >= state.playerCount) {
      return { ok: false, message: '房间人数已满' }
    }

    if (state.players.some((player) => player.name === name)) {
      return { ok: false, message: '昵称已在房间中' }
    }

    set({
      roomCode: code,
      playerName: '',
      players: [
        ...state.players,
        {
          id: `${Date.now()}-${state.players.length}`,
          name
        }
      ]
    })

    return { ok: true }
  },

  removePlayer: (playerId) => {
    if (get().phase !== 'lobby') {
      return
    }

    set((state) => ({
      players: state.players.filter((player) => player.id !== playerId)
    }))
  },

  setActivePlayer: (activePlayerId) => set({ activePlayerId }),

  startGame: () => {
    const state = get()

    if (state.players.length !== state.playerCount) {
      return { ok: false, message: `需要 ${state.playerCount} 名玩家才能开始` }
    }

    const roles = shuffleRoles(state.playerCount)

    set({
      players: state.players.map((player, index) => ({
        ...player,
        role: roles[index]
      })),
      activePlayerId: '',
      phase: 'team_building',
      roundIndex: 0,
      leaderIndex: 0,
      selectedTeamIds: [],
      teamVotes: {},
      missionVotes: {},
      history: []
    })

    return { ok: true }
  },

  toggleTeamMember: (playerId) => {
    const state = get()

    if (state.phase !== 'team_building' && state.phase !== 'speech') {
      return
    }

    const mission = getMission(state.playerCount, state.roundIndex)
    const isSelected = state.selectedTeamIds.includes(playerId)

    if (isSelected) {
      set({
        selectedTeamIds: state.selectedTeamIds.filter((selectedId) => selectedId !== playerId)
      })
      return
    }

    if (state.selectedTeamIds.length >= mission.teamSize) {
      return
    }

    set({
      selectedTeamIds: [...state.selectedTeamIds, playerId]
    })
  },

  submitTeam: () => {
    const state = get()
    const mission = getMission(state.playerCount, state.roundIndex)

    if (state.selectedTeamIds.length !== mission.teamSize) {
      return { ok: false, message: `本轮需要选择 ${mission.teamSize} 名玩家` }
    }

    set({
      phase: 'team_vote',
      teamVotes: {},
      missionVotes: {}
    })

    return { ok: true }
  },

  castTeamVote: (playerId, vote) => {
    const state = get()

    if (state.phase !== 'team_vote') {
      return
    }

    const teamVotes = {
      ...state.teamVotes,
      [playerId]: vote
    }
    const nextState = {
      ...state,
      teamVotes
    }

    set({
      teamVotes,
      ...(Object.keys(teamVotes).length === state.players.length ? resolveTeamVote(nextState) : {})
    })
  },

  castMissionVote: (playerId, vote) => {
    const state = get()
    const player = state.players.find((item) => item.id === playerId)

    if (state.phase !== 'mission_vote') {
      return { ok: false, message: '当前不是出任务阶段' }
    }

    if (!state.selectedTeamIds.includes(playerId)) {
      return { ok: false, message: '只有出任务玩家可以投任务票' }
    }

    if (vote === 'fail' && player?.role?.team !== 'evil') {
      return { ok: false, message: '好人阵营只能提交成功票' }
    }

    const missionVotes = {
      ...state.missionVotes,
      [playerId]: vote
    }
    const nextState = {
      ...state,
      missionVotes
    }

    set({
      missionVotes,
      ...(Object.keys(missionVotes).length === state.selectedTeamIds.length ? resolveMissionVote(nextState) : {})
    })

    return { ok: true }
  },

  nextRound: () => {
    const state = get()

    if (state.phase !== 'round_result') {
      return
    }

    set({
      phase: 'team_building',
      roundIndex: state.roundIndex + 1,
      leaderIndex: getNextLeaderIndex(state.leaderIndex, state.players.length),
      selectedTeamIds: [],
      teamVotes: {},
      missionVotes: {},
      activePlayerId: ''
    })
  },

  reset: () => set(initialGameState)
}))
