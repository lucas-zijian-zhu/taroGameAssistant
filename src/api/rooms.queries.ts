import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as roomsApi from './rooms'

export const roomKeys = {
  rooms: ['rooms'] as const,
  room: (roomCode: string) => ['room', roomCode] as const,
  state: (roomCode: string, playerId?: string) => ['room', roomCode, 'state', playerId || 'anonymous'] as const,
  game: (roomCode: string, playerId?: string) => ['room', roomCode, 'game', playerId || 'anonymous'] as const,
  myRole: (roomCode: string, playerId: string) => ['room', roomCode, 'my-role', playerId] as const
}

const invalidateRoom = (queryClient: ReturnType<typeof useQueryClient>, roomCode: string) => {
  queryClient.invalidateQueries({ queryKey: ['room', roomCode] })
}

export const useRoomQuery = (roomCode: string) => {
  return useQuery({
    queryKey: roomKeys.room(roomCode),
    queryFn: () => roomsApi.getRoom(roomCode),
    enabled: Boolean(roomCode)
  })
}

export const useRoomsQuery = () => {
  return useQuery({
    queryKey: roomKeys.rooms,
    queryFn: roomsApi.listRooms
  })
}

export const useRoomStateQuery = (roomCode: string, playerId?: string) => {
  return useQuery({
    queryKey: roomKeys.state(roomCode, playerId),
    queryFn: () => roomsApi.getRoomState(roomCode, playerId),
    enabled: Boolean(roomCode)
  })
}

export const useGameQuery = (roomCode: string, playerId?: string) => {
  return useQuery({
    queryKey: roomKeys.game(roomCode, playerId),
    queryFn: () => roomsApi.getGame(roomCode, playerId),
    enabled: Boolean(roomCode)
  })
}

export const useMyRoleQuery = (roomCode: string, playerId: string) => {
  return useQuery({
    queryKey: roomKeys.myRole(roomCode, playerId),
    queryFn: () => roomsApi.getMyRole(roomCode, playerId),
    enabled: Boolean(roomCode && playerId)
  })
}

export const useCreateRoomMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: roomsApi.createRoom,
    onSuccess: (data) => {
      queryClient.setQueryData(roomKeys.room(data.room.code), { room: data.room })
      queryClient.invalidateQueries({ queryKey: roomKeys.rooms })
      queryClient.setQueryData(roomKeys.state(data.room.code, data.currentPlayerId), {
        room: data.room,
        game: null,
        visibleRoleInfo: null,
        version: 0
      })
    }
  })
}

export const useJoinRoomMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ roomCode, payload }: { roomCode: string, payload: roomsApi.JoinRoomPayload }) => {
      return roomsApi.joinRoom(roomCode, payload)
    },
    onSuccess: (data) => {
      queryClient.setQueryData(roomKeys.room(data.room.code), { room: data.room })
      queryClient.invalidateQueries({ queryKey: roomKeys.rooms })
      invalidateRoom(queryClient, data.room.code)
    }
  })
}

export const useUpdateRoleConfigMutation = (roomCode: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: roomsApi.UpdateRoleConfigPayload) => roomsApi.updateRoleConfig(roomCode, payload),
    onSuccess: () => invalidateRoom(queryClient, roomCode)
  })
}

export const useReadyMutation = (roomCode: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: roomsApi.ReadyPayload) => roomsApi.setReady(roomCode, payload),
    onSuccess: () => invalidateRoom(queryClient, roomCode)
  })
}

export const useLeaveRoomMutation = (roomCode: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: roomsApi.PlayerPayload) => roomsApi.leaveRoom(roomCode, payload),
    onSuccess: () => invalidateRoom(queryClient, roomCode)
  })
}

export const useCloseRoomMutation = (roomCode: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: { hostPlayerId: string }) => roomsApi.closeRoom(roomCode, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roomKeys.rooms })
      invalidateRoom(queryClient, roomCode)
    }
  })
}

export const useStartGameMutation = (roomCode: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: { hostPlayerId: string }) => roomsApi.startGame(roomCode, payload),
    onSuccess: () => invalidateRoom(queryClient, roomCode)
  })
}

export const useEnterSpeechMutation = (roomCode: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: roomsApi.PlayerPayload) => roomsApi.enterSpeech(roomCode, payload),
    onSuccess: () => invalidateRoom(queryClient, roomCode)
  })
}

export const useSubmitTeamMutation = (roomCode: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: roomsApi.SubmitTeamPayload) => roomsApi.submitTeam(roomCode, payload),
    onSuccess: () => invalidateRoom(queryClient, roomCode)
  })
}

export const useSubmitTeamVoteMutation = (roomCode: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: roomsApi.SubmitTeamVotePayload) => roomsApi.submitTeamVote(roomCode, payload),
    onSuccess: () => invalidateRoom(queryClient, roomCode)
  })
}

export const useSubmitMissionVoteMutation = (roomCode: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: roomsApi.SubmitMissionVotePayload) => roomsApi.submitMissionVote(roomCode, payload),
    onSuccess: () => invalidateRoom(queryClient, roomCode)
  })
}

export const useNextRoundMutation = (roomCode: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: roomsApi.PlayerPayload) => roomsApi.nextRound(roomCode, payload),
    onSuccess: () => invalidateRoom(queryClient, roomCode)
  })
}

export const useAssassinateMutation = (roomCode: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: roomsApi.AssassinatePayload) => roomsApi.assassinate(roomCode, payload),
    onSuccess: () => invalidateRoom(queryClient, roomCode)
  })
}

export const useResetGameMutation = (roomCode: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: { hostPlayerId: string }) => roomsApi.resetGame(roomCode, payload),
    onSuccess: () => invalidateRoom(queryClient, roomCode)
  })
}
