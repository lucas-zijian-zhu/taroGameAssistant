export type Team = 'good' | 'evil'

export type RoleId = 'merlin' | 'percival' | 'loyal' | 'assassin' | 'morgana' | 'mordred' | 'oberon' | 'minion'

export type Role = {
  id: RoleId
  name: string
  team: Team
  description: string
}

export type Player = {
  id: string
  name: string
  isHost?: boolean
  isReady?: boolean
  connected?: boolean
  role?: Role
}

export type Mission = {
  round: number
  teamSize: number
  failsRequired: number
}

export type TeamVote = 'approve' | 'reject'

export type MissionVote = 'success' | 'fail'

export type RoundHistoryStatus =
  | 'team_rejected'
  | 'mission_pending'
  | 'mission_succeeded'
  | 'mission_failed'

export type GamePhase =
  | 'lobby'
  | 'not_started'
  | 'role_reveal'
  | 'speech'
  | 'team_building'
  | 'team_vote'
  | 'mission_vote'
  | 'round_result'
  | 'assassination'
  | 'finished'

export type RoundResult = {
  round: number
  teamPlayerIds: string[]
  teamVotes: Record<string, TeamVote>
  teamVoteForced: boolean
  approveCount: number
  rejectCount: number
  successCount: number
  failCount: number
  status: RoundHistoryStatus
  missionCompleted: boolean
  passed: boolean
}

export const PLAYER_COUNTS = [5, 6, 7, 8, 9, 10]

export const ROLE_LIBRARY: Record<RoleId, Role> = {
  merlin: {
    id: 'merlin',
    name: '梅林',
    team: 'good',
    description: '知道除莫德雷德外的坏人，终局需要避免被刺客识破。'
  },
  percival: {
    id: 'percival',
    name: '派西维尔',
    team: 'good',
    description: '知道梅林与莫甘娜，但无法区分两者。'
  },
  loyal: {
    id: 'loyal',
    name: '忠臣',
    team: 'good',
    description: '没有额外信息，通过发言与任务结果找出坏人。'
  },
  assassin: {
    id: 'assassin',
    name: '刺客',
    team: 'evil',
    description: '知道其他坏人，三次任务成功后可以刺杀梅林。'
  },
  morgana: {
    id: 'morgana',
    name: '莫甘娜',
    team: 'evil',
    description: '在派西维尔视角中会伪装成梅林。'
  },
  mordred: {
    id: 'mordred',
    name: '莫德雷德',
    team: 'evil',
    description: '坏人阵营，梅林无法看见你的身份。'
  },
  oberon: {
    id: 'oberon',
    name: '奥伯伦',
    team: 'evil',
    description: '坏人阵营，但你不知道其他坏人，其他坏人也不知道你。'
  },
  minion: {
    id: 'minion',
    name: '爪牙',
    team: 'evil',
    description: '坏人阵营，知道其他坏人并干扰好人完成任务。'
  }
}

export const ROLE_SETS: Record<number, RoleId[]> = {
  5: ['merlin', 'percival', 'loyal', 'assassin', 'morgana'],
  6: ['merlin', 'percival', 'loyal', 'loyal', 'assassin', 'morgana'],
  7: ['merlin', 'percival', 'loyal', 'loyal', 'assassin', 'morgana', 'oberon'],
  8: ['merlin', 'percival', 'loyal', 'loyal', 'loyal', 'assassin', 'morgana', 'minion'],
  9: ['merlin', 'percival', 'loyal', 'loyal', 'loyal', 'loyal', 'assassin', 'morgana', 'mordred'],
  10: ['merlin', 'percival', 'loyal', 'loyal', 'loyal', 'loyal', 'assassin', 'morgana', 'mordred', 'oberon']
}

export const getDefaultRoleConfig = (playerCount: number) => {
  const counts = ROLE_SETS[playerCount].reduce<Record<RoleId, number>>((result, roleId) => {
    result[roleId] = (result[roleId] || 0) + 1
    return result
  }, {} as Record<RoleId, number>)

  return Object.entries(counts).map(([roleId, count]) => ({
    roleId: roleId as RoleId,
    count
  }))
}

export const MISSION_TABLE: Record<number, Mission[]> = {
  5: [
    { round: 1, teamSize: 2, failsRequired: 1 },
    { round: 2, teamSize: 3, failsRequired: 1 },
    { round: 3, teamSize: 2, failsRequired: 1 },
    { round: 4, teamSize: 3, failsRequired: 1 },
    { round: 5, teamSize: 3, failsRequired: 1 }
  ],
  6: [
    { round: 1, teamSize: 2, failsRequired: 1 },
    { round: 2, teamSize: 3, failsRequired: 1 },
    { round: 3, teamSize: 4, failsRequired: 1 },
    { round: 4, teamSize: 3, failsRequired: 1 },
    { round: 5, teamSize: 4, failsRequired: 1 }
  ],
  7: [
    { round: 1, teamSize: 2, failsRequired: 1 },
    { round: 2, teamSize: 3, failsRequired: 1 },
    { round: 3, teamSize: 3, failsRequired: 1 },
    { round: 4, teamSize: 4, failsRequired: 2 },
    { round: 5, teamSize: 4, failsRequired: 1 }
  ],
  8: [
    { round: 1, teamSize: 3, failsRequired: 1 },
    { round: 2, teamSize: 4, failsRequired: 1 },
    { round: 3, teamSize: 4, failsRequired: 1 },
    { round: 4, teamSize: 5, failsRequired: 2 },
    { round: 5, teamSize: 5, failsRequired: 1 }
  ],
  9: [
    { round: 1, teamSize: 3, failsRequired: 1 },
    { round: 2, teamSize: 4, failsRequired: 1 },
    { round: 3, teamSize: 4, failsRequired: 1 },
    { round: 4, teamSize: 5, failsRequired: 2 },
    { round: 5, teamSize: 5, failsRequired: 1 }
  ],
  10: [
    { round: 1, teamSize: 3, failsRequired: 1 },
    { round: 2, teamSize: 4, failsRequired: 1 },
    { round: 3, teamSize: 4, failsRequired: 1 },
    { round: 4, teamSize: 5, failsRequired: 2 },
    { round: 5, teamSize: 5, failsRequired: 1 }
  ]
}

export const createRoomCode = () => Math.random().toString(36).slice(2, 8).toUpperCase()

export const getRolePreview = (playerCount: number) => ROLE_SETS[playerCount].map((roleId) => ROLE_LIBRARY[roleId])

export const getMission = (playerCount: number, roundIndex: number) => MISSION_TABLE[playerCount][roundIndex]

export const shuffleRoles = (playerCount: number) => {
  const roles = ROLE_SETS[playerCount].map((roleId) => ROLE_LIBRARY[roleId])

  for (let index = roles.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const role = roles[index]
    roles[index] = roles[swapIndex]
    roles[swapIndex] = role
  }

  return roles
}
